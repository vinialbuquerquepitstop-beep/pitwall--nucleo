# Diagnostico de layout MOBILE. Reusa o stub do harness.py (Supabase falso com
# linha real do banco) e roda o app.js REAL em Chrome headless num viewport de
# celular. Nao assere comportamento: MEDE geometria.
#
# Tres medidas, todas em pixel, nenhuma no olho:
#   1. sobreposicao: par de elementos com texto cujos retangulos se cruzam
#   2. estouro horizontal: scrollWidth do documento maior que a largura da tela
#   3. barra inferior: altura real das .abas vs o padding-bottom do .conteudo
#      (se a barra e mais alta que o respiro, ela COBRE o conteudo)
#
#   python ferramentas/diag_mobile.py [largura]      (padrao 390)
#
# ARMADILHA MEDIDA EM 31/07/2026: `--window-size=390,844` NAO da um viewport de
# 390px. O headless do Chrome no Windows tem piso de ~500px de largura, entao a
# pagina renderiza a 500 e a media query de celular mede errado (o primeiro
# diagnostico acusou 110px de estouro horizontal que nao existia). Por isso a
# pagina do app roda dentro de um IFRAME com a largura pedida: a media query
# enxerga o viewport do iframe. O script ABORTA se innerWidth divergir.
import json, pathlib, subprocess, sys, tempfile, os
sys.stdout.reconfigure(encoding='utf-8')

RAIZ = pathlib.Path(__file__).resolve().parent.parent
LARG = int(sys.argv[1]) if len(sys.argv) > 1 else 390
ALT = 844

# ---- reusa o preambulo do harness (CHROME, css, corpo, js, STUB) sem copiar ----
fonte = (RAIZ / 'ferramentas' / 'harness.py').read_text(encoding='utf-8')
corte = fonte.index('# ---- o teste:')
ns = {'__file__': str(RAIZ / 'ferramentas' / 'harness.py')}
exec(compile(fonte[:corte], 'harness.py[preambulo]', 'exec'), ns)
CHROME, css, corpo, js, STUB = ns['CHROME'], ns['css'], ns['corpo'], ns['js'], ns['STUB']

TESTE = r"""
window.__saida = { abas: [], nav: null, erros: [], larguraReal: 0 };
var D = null;   // document do iframe

function espera(ms){ return new Promise(function(r){ setTimeout(r, ms); }); }
function W(){ return D.defaultView; }
function vis(el){
  var s = W().getComputedStyle(el);
  if (s.display === 'none' || s.visibility === 'hidden' || parseFloat(s.opacity) === 0) return false;
  var r = el.getBoundingClientRect();
  return r.width > 0 && r.height > 0;
}
// elemento "de texto": tem filho texto direto nao-vazio. E o nivel onde a
// sobreposicao vira letra em cima de letra, nao caixa em cima de caixa.
function ehTexto(el){
  for (var i = 0; i < el.childNodes.length; i++){
    var n = el.childNodes[i];
    if (n.nodeType === 3 && n.textContent.trim().length > 1) return true;
  }
  return false;
}
function nome(el){
  var s = el.tagName.toLowerCase();
  if (el.id) s += '#' + el.id;
  if (el.className && typeof el.className === 'string')
    s += '.' + el.className.trim().split(/\s+/).slice(0,3).join('.');
  return s;
}
function txt(el){ return (el.textContent || '').replace(/\s+/g,' ').trim().slice(0,42); }
// Camada FLUTUANTE (barra inferior, toast) fica fora do teste de sobreposicao:
// ela cruza o conteudo rolado por desenho, e isso e o comportamento certo de
// qualquer barra fixa. O que importa nela e outra medida — se a barra cabe no
// respiro que o .conteudo reserva — e essa e feita em navInfo(), separada.
// Sem este corte o diagnostico acusava 37 "sobreposicoes" que eram so o
// conteudo passando por tras da barra durante a rolagem.
function flutua(el){
  for (var n = el; n && n.nodeType === 1; n = n.parentElement)
    if (W().getComputedStyle(n).position === 'fixed') return true;
  return false;
}

function medir(rotulo){
  var raiz = D.getElementById('telaApp');
  var todos = [].slice.call(raiz.querySelectorAll('*'));
  var alvos = todos.filter(function(el){ return vis(el) && ehTexto(el) && !flutua(el); });

  // ---- 1. sobreposicao ----
  var sobre = [];
  for (var i = 0; i < alvos.length; i++){
    for (var j = i + 1; j < alvos.length; j++){
      var a = alvos[i], b = alvos[j];
      if (a.contains(b) || b.contains(a)) continue;
      var ra = a.getBoundingClientRect(), rb = b.getBoundingClientRect();
      var w = Math.min(ra.right, rb.right) - Math.max(ra.left, rb.left);
      var h = Math.min(ra.bottom, rb.bottom) - Math.max(ra.top, rb.top);
      if (w <= 1 || h <= 1) continue;
      var area = w * h, menor = Math.min(ra.width * ra.height, rb.width * rb.height);
      if (area < 12 || area / menor < 0.12) continue;   // roce de 1px nao conta
      sobre.push({ a: nome(a), ta: txt(a), b: nome(b), tb: txt(b),
                   px: Math.round(area), frac: +(area / menor).toFixed(2) });
    }
  }

  // ---- 2. estouro horizontal (elemento a elemento) ----
  var estouro = [];
  var L = W().innerWidth;
  todos.forEach(function(el){
    if (!vis(el)) return;
    var r = el.getBoundingClientRect();
    if (r.right > L + 1.5 || r.left < -1.5)
      estouro.push({ el: nome(el), t: txt(el), left: Math.round(r.left), right: Math.round(r.right) });
  });

  window.__saida.abas.push({ aba: rotulo, sobre: sobre, estouro: estouro.slice(0, 14),
                             larguraDoc: Math.round(D.documentElement.scrollWidth) });
}

async function rodar(){
  var ifr = document.getElementById('palco');
  D = ifr.contentDocument;
  D.open(); D.write(window.__FONTE); D.close();
  await espera(500);
  window.__saida.larguraReal = W().innerWidth;
  W().PitWall.init();
  await espera(500);

  // ---- barra inferior: altura real x respiro reservado ----
  var abas = D.getElementById('abas'), cont = D.querySelector('.conteudo');
  function navInfo(estado){
    var r = abas.getBoundingClientRect();
    var pb = parseFloat(W().getComputedStyle(cont).paddingBottom);
    var linhas = [].slice.call(abas.querySelectorAll('.aba')).filter(vis).map(function(el){
      var q = el.getBoundingClientRect();
      var t = el.querySelector('.aba-txt');
      return { id: el.id, txt: txt(el), top: Math.round(q.top), left: Math.round(q.left),
               w: Math.round(q.width), h: Math.round(q.height),
               // rotulo cortado pela reticencia: cabe, mas o operador le pela metade
               cortado: !!t && t.scrollWidth > t.clientWidth + 1 };
    });
    return { estado: estado, altura: Math.round(r.height), topo: Math.round(r.top),
             paddingBottomConteudo: Math.round(pb), abasVisiveis: linhas };
  }
  var fechado = navInfo('fechado');
  var bm = D.getElementById('abaMais');
  if (bm) { bm.click(); await espera(160); }
  var aberto = navInfo('mais aberto');
  if (bm) { bm.click(); await espera(160); }
  window.__saida.nav = { fechado: fechado, aberto: aberto };

  var abasIds = ['abaHoje','abaFila','abaTodos','abaVendas','abaConteudo',
                 'abaClientes','abaIndicacoes','abaCaptacao','abaRotina','abaDash','abaNfs'];
  for (var k = 0; k < abasIds.length; k++){
    var el = D.getElementById(abasIds[k]);
    if (!el) { window.__saida.erros.push('sem ' + abasIds[k]); continue; }
    el.click();
    await espera(430);
    medir(abasIds[k]);
  }
  fim();
}
function fim(){
  var d = document.createElement('pre'); d.id = 'RESULTADO';
  d.textContent = JSON.stringify(window.__saida);
  document.body.appendChild(d);
}
window.addEventListener('error', function(e){ window.__saida.erros.push('runtime: ' + e.message); });
rodar().catch(function(e){
  window.__saida.erros.push('rodar() estourou: ' + (e && e.message ? e.message : e));
  fim();
});
"""

# A pagina do app inteira vira string JS no pai e e escrita dentro do iframe.
# `</` escapado para nao fechar o <script> do pai cedo demais.
alvo = f"""<!doctype html><html><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<style>{css}</style></head>
<body>{corpo}
<script>{STUB}</script>
<script>{js}</script>
</body></html>"""
alvo_js = json.dumps(alvo).replace('</', '<\\/')

pagina = f"""<!doctype html><html><head><meta charset="utf-8">
<style>html,body{{margin:0;padding:0}}
#palco{{width:{LARG}px;height:{ALT}px;border:0;display:block}}</style></head>
<body><iframe id="palco" src="about:blank"></iframe>
<script>window.__FONTE = {alvo_js};</script>
<script>{TESTE}</script>
</body></html>"""

tmp = pathlib.Path(tempfile.gettempdir()) / f'pitwall_diag_mobile_{LARG}.html'
tmp.write_text(pagina, encoding='utf-8')
perfil = tempfile.mkdtemp()
out = subprocess.run([CHROME, '--headless=new', '--disable-gpu', '--no-sandbox',
                      f'--user-data-dir={perfil}', f'--window-size={max(LARG,520)},{ALT+80}',
                      '--force-device-scale-factor=1', '--hide-scrollbars',
                      '--virtual-time-budget=40000', '--dump-dom', tmp.as_uri()],
                     capture_output=True, text=True, encoding='utf-8', timeout=300)
dom = out.stdout or ''
if 'id="RESULTADO">' not in dom:
    print('o diagnostico nao chegou ao fim. DOM:', len(dom), 'chars')
    print((out.stderr or '')[-2500:]); sys.exit(1)
import html as H
res = json.loads(H.unescape(dom.split('id="RESULTADO">', 1)[1].split('</pre>', 1)[0]))

real = res.get('larguraReal', 0)
if real != LARG:
    print(f'ABORTADO: pedi viewport de {LARG}px e o iframe mediu {real}px. '
          f'Medida invalida, nao interpretar.')
    sys.exit(2)

print(f'=== VIEWPORT {LARG}x{ALT} (confirmado: innerWidth={real}) ===\n')
nav = res['nav']
nav_reprova = []
cortados = []
for est in ('fechado', 'aberto'):
    n = nav[est]
    # so a barra FECHADA precisa caber no respiro: a gaveta e transitoria, ela
    # cobre o conteudo de proposito enquanto esta aberta.
    cobre = n['altura'] > n['paddingBottomConteudo']
    if est == 'fechado' and cobre:
        nav_reprova.append(f"barra fechada tem {n['altura']}px e o respiro so reserva "
                           f"{n['paddingBottomConteudo']}px")
    print(f"BARRA INFERIOR [{est}]  altura={n['altura']}px  "
          f"respiro do conteudo={n['paddingBottomConteudo']}px  "
          f"{('>>> COBRE O CONTEUDO' if est == 'fechado' else '(gaveta aberta, cobre de proposito)') if cobre else 'ok'}")
    linhas = {}
    for a in n['abasVisiveis']:
        linhas.setdefault(a['top'], []).append(a)
        if a['cortado'] and a['id'] not in cortados: cortados.append(a['id'])
    for top in sorted(linhas):
        itens = ' | '.join(f"{a['txt']}({a['id']},x={a['left']},w={a['w']})"
                           + ('[CORTADO]' if a['cortado'] else '')
                           for a in sorted(linhas[top], key=lambda x: x['left']))
        print(f"   linha y={top}: {itens}")
    print()
if cortados:
    print(f"ROTULO CORTADO pela reticencia em: {', '.join(cortados)}\n")

total_s = total_e = total_doc = 0
for ab in res['abas']:
    s, e = ab['sobre'], ab['estouro']
    doc = ab['larguraDoc'] > LARG
    total_s += len(s); total_e += len(e); total_doc += 1 if doc else 0
    if not s and not e and not doc: continue
    print(f"--- {ab['aba']}  (scrollWidth do documento: {ab['larguraDoc']}px)")
    for x in s:
        print(f"   SOBREPOE {x['px']}px ({int(x['frac']*100)}%): {x['a']} \"{x['ta']}\"")
        print(f"                    x  {x['b']} \"{x['tb']}\"")
    for x in e[:8]:
        print(f"   ESTOURA  {x['el']} [{x['left']}..{x['right']}] \"{x['t']}\"")
    print()

for m in nav_reprova:
    print('REPROVOU: ' + m)
if res['erros']:
    print('ERROS:', res['erros'])
print(f'TOTAL: {total_s} sobreposicoes, {total_e} estouros de elemento, '
      f'{total_doc} abas com documento mais largo que a tela, '
      f'{len(nav_reprova)} reprovacoes da barra')
sys.exit(1 if (total_s or total_e or total_doc or res['erros'] or nav_reprova) else 0)
