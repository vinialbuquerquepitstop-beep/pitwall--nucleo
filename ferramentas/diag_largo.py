# Diagnostico de layout em MONITOR GRANDE. Irmao do diag_mobile.py: mesma
# tecnica (app.js real em Chrome headless dentro de um iframe da largura pedida,
# preambulo reusado do harness.py), medida oposta.
#
# O diag_mobile pergunta "estourou pra fora da tela?". Este pergunta
# "sobrou tela sem uso, e o bloco ficou colado numa borda?".
#
#   python ferramentas/diag_largo.py [largura]      (padrao 1920)
#
# Por que existe: ate 02/09/2026 o app.css nao tinha UMA media query de
# min-width acima de 1080px. O .conteudo travava em max-width:1080px e, por ser
# item de grid com teto, encostava na esquerda. A 1920px isso media 608px de
# vazio a direita nas 14 abas; a 2560px, 1248px. A suite inteira passava verde
# porque nenhuma ferramenta olhava acima de 1440px.
#
# Duas medidas, as duas em pixel:
#   1. teto do conteudo por degrau: >=1500px pede 1280, >=1800px pede 1440,
#      >=2300px pede 1600, sempre limitado pela coluna que sobra depois da barra
#      lateral. Numero abaixo do degrau = teto travado de novo.
#   2. centragem na coluna: a folga a esquerda e a folga a direita do bloco,
#      dentro da coluna de conteudo, tem que bater (tolerancia 4px). Bloco
#      colado numa borda com centenas de pixel do outro lado e o defeito
#      original, e e isto que reprova se alguem tirar o margin-inline:auto.
#
# Nao mede sobreposicao nem estouro: quem faz isso e o diag_mobile, que vale em
# QUALQUER largura. Rodar os dois.
import json, pathlib, subprocess, sys, tempfile, os, html as H
sys.stdout.reconfigure(encoding='utf-8')

RAIZ = pathlib.Path(__file__).resolve().parent.parent
LARG = int(sys.argv[1]) if len(sys.argv) > 1 else 1920
ALT = 1000

# ---- reusa o preambulo do harness (CHROME, css, corpo, js, STUB) sem copiar ----
fonte = (RAIZ / 'ferramentas' / 'harness.py').read_text(encoding='utf-8')
corte = fonte.index('# ---- o teste:')
ns = {'__file__': str(RAIZ / 'ferramentas' / 'harness.py')}
exec(compile(fonte[:corte], 'harness.py[preambulo]', 'exec'), ns)
CHROME, css, corpo, js, STUB = ns['CHROME'], ns['css'], ns['corpo'], ns['js'], ns['STUB']

# degraus contratados pelo CSS (secao MONITOR GRANDE do app.css)
DEGRAUS = [(2300, 1600), (1800, 1440), (1500, 1280)]
def teto_esperado(w):
    for corte_w, teto in DEGRAUS:
        if w >= corte_w:
            return teto
    return None          # abaixo de 1500 o teto de 1080 e o desenho aprovado

TESTE = r"""
window.__saida = { larguraReal:0, sideW:0, abas:[], erros:[] };
var D = null;
function espera(ms){ return new Promise(function(r){ setTimeout(r, ms); }); }
function W(){ return D.defaultView; }
function vis(el){
  var s = W().getComputedStyle(el);
  if (s.display === 'none' || s.visibility === 'hidden') return false;
  var r = el.getBoundingClientRect();
  return r.width > 0 && r.height > 0;
}
function nome(el){
  var s = el.tagName.toLowerCase();
  if (el.id) s += '#' + el.id;
  if (el.className && typeof el.className === 'string')
    s += '.' + el.className.trim().split(/\s+/).slice(0,2).join('.');
  return s;
}
// pico = borda direita mais distante DENTRO da lista renderizada. Serve para
// enxergar o caso em que o container cresceu mas nada dentro dele cresceu
// junto (bloco largo com conteudo estreito e vazio disfarcado).
function medir(rot){
  var cont = D.querySelector('.conteudo'), lista = D.getElementById('lista');
  var rc = cont.getBoundingClientRect();
  var maxDir = 0, maxEl = '';
  if (lista) [].slice.call(lista.querySelectorAll('*')).forEach(function(el){
    if (!vis(el)) return;
    var r = el.getBoundingClientRect();
    if (r.right > maxDir) { maxDir = r.right; maxEl = nome(el); }
  });
  window.__saida.abas.push({ aba: rot, esq: Math.round(rc.left),
    dir: Math.round(rc.right), larg: Math.round(rc.width),
    pico: Math.round(maxDir), picoEl: maxEl });
}
async function rodar(){
  var ifr = document.getElementById('palco');
  D = ifr.contentDocument;
  D.open(); D.write(window.__FONTE); D.close();
  await espera(500);
  window.__saida.larguraReal = W().innerWidth;
  W().PitWall.init();
  await espera(600);
  // depois do init(): antes dele a tela do app esta escondida e a barra lateral
  // mede 0, o que fazia a folga da esquerda sair somada com a largura da barra.
  var sd = D.querySelector('.side');
  window.__saida.sideW = sd ? Math.round(sd.getBoundingClientRect().width) : 0;
  // mesma lista de abas do diag_mobile: aba nova entra nas DUAS, senao ela
  // nasce sem medida de um dos dois extremos de tela.
  var ids = ['abaHoje','abaFila','abaTodos','abaVendas','abaConteudo','abaClientes',
             'abaIndicacoes','abaCaptacao','abaRotina','abaDash','abaNfs','abaEscopo',
             'abaPitscare','abaFinanceiro'];
  for (var k = 0; k < ids.length; k++){
    var el = D.getElementById(ids[k]);
    if (!el) { window.__saida.erros.push('sem ' + ids[k]); continue; }
    el.click();
    await espera(430);
    medir(ids[k]);
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

tmp = pathlib.Path(tempfile.gettempdir()) / f'pitwall_diag_largo_{LARG}.html'
tmp.write_text(pagina, encoding='utf-8')
perfil = tempfile.mkdtemp()
out = subprocess.run([CHROME, '--headless=new', '--disable-gpu', '--no-sandbox',
                      f'--user-data-dir={perfil}', f'--window-size={LARG + 60},{ALT + 80}',
                      '--force-device-scale-factor=1', '--hide-scrollbars',
                      '--virtual-time-budget=40000', '--dump-dom', tmp.as_uri()],
                     capture_output=True, text=True, encoding='utf-8', timeout=300)
dom = out.stdout or ''
if 'id="RESULTADO">' not in dom:
    print('o diagnostico nao chegou ao fim. DOM:', len(dom), 'chars')
    print((out.stderr or '')[-2500:])
    sys.exit(1)
res = json.loads(H.unescape(dom.split('id="RESULTADO">', 1)[1].split('</pre>', 1)[0]))

real = res.get('larguraReal', 0)
if real != LARG:
    print(f'ABORTADO: pedi viewport de {LARG}px e o iframe mediu {real}px. '
          f'Medida invalida, nao interpretar.')
    sys.exit(2)

side = res['sideW']
teto = teto_esperado(LARG)
# O degrau nunca pode passar da coluna disponivel: a 1500px de tela a coluna tem
# 1268px (1500 menos a barra lateral), e cobrar 1280 ali seria a ferramenta
# reprovando um limite fisico, nao um defeito. Medido em 02/09/2026, quando a
# primeira corrida a 1500px acusou 14 abas por 12px que nao existem.
if teto:
    teto = min(teto, LARG - side)
rot_teto = f'{teto}' if teto else '1080 (abaixo do primeiro degrau)'
print(f'=== VIEWPORT {LARG}x{ALT} (confirmado: innerWidth={real}) ===')
print(f'coluna de conteudo: de {side}px ate {LARG}px ({LARG - side}px)   '
      f'teto contratado: {rot_teto}px')
print()
cab = ('aba'.ljust(16) + 'x'.rjust(7) + 'largura'.rjust(9) + 'fim'.rjust(7)
       + 'folga esq'.rjust(11) + 'folga dir'.rjust(11) + '   pico do conteudo')
print(cab)

reprova = []
for a in res['abas']:
    fe = a['esq'] - side              # vazio entre a barra lateral e o bloco
    fd = LARG - a['dir']              # vazio entre o bloco e a borda da tela
    mal = []
    if teto and a['larg'] < teto - 1:
        mal.append(f"largura {a['larg']}px abaixo do degrau de {teto}px")
    if abs(fe - fd) > 4:
        mal.append(f"fora de centro: {fe}px de um lado, {fd}px do outro")
    if a['pico'] > LARG + 1:
        mal.append(f"pico {a['pico']}px passa da tela ({a['picoEl']})")
    if mal:
        reprova.append((a['aba'], mal))
    marca = '  <<<' if mal else '     '
    print(a['aba'].ljust(16) + str(a['esq']).rjust(7) + str(a['larg']).rjust(9)
          + str(a['dir']).rjust(7) + str(fe).rjust(11) + str(fd).rjust(11)
          + marca + f" {a['pico']} ({a['picoEl']})")

print()
if res['erros']:
    print('ERROS DE EXECUCAO:')
    for e in res['erros']:
        print('  -', e)
    print()
if reprova or res['erros']:
    for aba, mal in reprova:
        for m in mal:
            print(f'REPROVOU [{aba}]: {m}')
    print(f'\nREPROVOU a {LARG}px.')
    sys.exit(1)
print(f'ok: {len(res["abas"])} abas medidas a {LARG}px, '
      f'todas no teto contratado e centradas.')
