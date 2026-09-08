# Diagnostico de layout da CALC DO DONO (public/calc/index.html), no celular.
#
#   python ferramentas/diag_calc.py [largura]      (padrao 360)
#
# Por que ele existe, medido em 08/09/2026: `diag_mobile.py` e `diag_largo.py`
# medem `public/index.html` (o painel), reusando o stub do `harness.py`. **Nenhuma
# ferramenta olhava para a calc.** Quando a barra de abas da calc saiu de CINCO
# para SEIS colunas (aba Catalogo, Bloco 1.3), a suite inteira ficou verde sem
# ter medido a mudanca: em 360px cada aba cai para 60px e o rotulo `CATÁLOGO`
# pode estourar a coluna sem ninguem ver.
#
# MEDE geometria, nao comportamento:
#   1. estouro horizontal do documento (scrollWidth > innerWidth)
#   2. rotulo de aba mais largo que a propria coluna (scrollWidth > clientWidth)
#   3. sobreposicao entre abas vizinhas
#   4. altura da .tab-bar contra o padding-bottom do body (barra que COBRE o
#      conteudo em vez de conviver com ele)
#
# ARMADILHA JA MEDIDA (31/07/2026, no diag_mobile): `--window-size=360,x` NAO da
# viewport de 360px, porque o headless do Chrome no Windows tem piso de ~500px.
# Por isso a pagina roda dentro de um IFRAME com a largura pedida, e o script
# ABORTA se innerWidth divergir. Mesma defesa aqui.
import json
import re
import pathlib
import subprocess
import sys
import tempfile
import os
sys.stdout.reconfigure(encoding='utf-8')

RAIZ = pathlib.Path(__file__).resolve().parent.parent
LARG = int(sys.argv[1]) if len(sys.argv) > 1 else 360
ALT = 844

# reusa a deteccao de Chrome do harness, sem copiar o caminho
fonte = (RAIZ / 'ferramentas' / 'harness.py').read_text(encoding='utf-8')
corte = fonte.index('# ---- o teste:')
ns = {'__file__': str(RAIZ / 'ferramentas' / 'harness.py')}
exec(compile(fonte[:corte], 'harness.py[preambulo]', 'exec'), ns)
CHROME = ns['CHROME']
if not CHROME:
    print('SEM CHROME: nao da para medir geometria. INCONCLUSIVO.')
    sys.exit(2)

ALVO = RAIZ / 'public' / 'calc' / 'index.html'
if not ALVO.exists():
    print('REPROVOU: nao achei ' + str(ALVO))
    sys.exit(1)

# A calc pede login e busca o supabase-js num CDN. Nada disso importa aqui: a
# tab-bar e HTML estatico, ja no DOM antes de qualquer sessao.
#
# O <script src> do CDN sai da COPIA medida, nunca do arquivo real. Sem isso o
# Chrome headless fica pendurado esperando a rede (medido em 08/09/2026: o
# processo passou de 180s sem devolver nada). Tirar o CDN nao afeta a geometria
# da barra, que e HTML e CSS puros.
html = ALVO.read_text(encoding='utf-8')
html = re.sub(r'<script src="https?://[^"]*"></script>', '', html)

PAGINA = """<!doctype html><meta charset="utf-8">
<style>html,body{margin:0;padding:0}iframe{border:0;display:block}</style>
<iframe id="f" width="%d" height="%d" srcdoc="%s"></iframe>
""" % (LARG, ALT, html.replace('&', '&amp;').replace('"', '&quot;'))

TESTE = r"""
(function(){
  var f = document.getElementById('f');
  var D = f.contentDocument, W = f.contentWindow;
  var out = { larguraReal: W.innerWidth, erros: [], abas: [], doc: {}, barra: {} };

  // O gate e o overlay de login cobrem a tela; nao mexem na geometria da barra,
  // mas atrapalham a leitura. Removemos SO na medicao.
  ['calc-gate','calc-login'].forEach(function(id){
    var e = D.getElementById(id); if (e) e.remove();
  });

  out.doc.scrollWidth = D.documentElement.scrollWidth;
  out.doc.clientWidth = D.documentElement.clientWidth;

  var barra = D.querySelector('.tab-bar');
  if (!barra) { out.erros.push('nao achei .tab-bar'); return out; }
  var rb = barra.getBoundingClientRect();
  out.barra.altura = Math.round(rb.height);
  out.barra.largura = Math.round(rb.width);
  out.barra.colunas = W.getComputedStyle(barra).gridTemplateColumns.split(' ').length;

  var pb = W.getComputedStyle(D.body).paddingBottom;
  out.barra.respiroBody = Math.round(parseFloat(pb) || 0);

  var abas = barra.querySelectorAll('.tb');
  for (var i = 0; i < abas.length; i++) {
    var a = abas[i], r = a.getBoundingClientRect();
    out.abas.push({
      id: a.id,
      texto: (a.textContent || '').replace(/\s+/g, ' ').trim(),
      largura: Math.round(r.width * 100) / 100,
      esquerda: Math.round(r.left * 100) / 100,
      direita: Math.round(r.right * 100) / 100,
      scrollWidth: a.scrollWidth,
      clientWidth: a.clientWidth
    });
  }
  return out;
})()
"""

with tempfile.TemporaryDirectory() as td:
    pag = pathlib.Path(td) / 'p.html'
    pag.write_text(PAGINA, encoding='utf-8')
    perfil = pathlib.Path(td) / 'perfil'
    cmd = [CHROME, '--headless=new', '--disable-gpu', '--no-sandbox',
           '--allow-file-access-from-files', '--hide-scrollbars',
           '--window-size=%d,%d' % (max(LARG, 800), ALT + 200),
           '--user-data-dir=' + str(perfil),
           '--virtual-time-budget=4000',
           '--dump-dom', pag.as_uri()]
    # O --dump-dom nao roda script sob demanda; usamos o caminho do harness:
    # injetamos o teste como script inline que grava o resultado num <pre>.
    pag.write_text(
        PAGINA + '<pre id="saida"></pre><script>\n'
        'window.addEventListener("load", function(){ setTimeout(function(){\n'
        '  var r; try { r = ' + TESTE + '; } catch(e){ r = {erroFatal: String(e)}; }\n'
        '  document.getElementById("saida").textContent = "@@" + JSON.stringify(r) + "@@";\n'
        '}, 800); });\n</script>', encoding='utf-8')
    dom = subprocess.run(cmd, capture_output=True, text=True, encoding='utf-8',
                         errors='replace', timeout=120).stdout

if '@@' not in dom:
    print('REPROVOU: a pagina nao produziu medida (Chrome nao executou o script)')
    sys.exit(1)
bruto = dom.split('@@')[1]
d = json.loads(bruto)

if d.get('erroFatal'):
    print('REPROVOU: erro ao medir: ' + d['erroFatal'])
    sys.exit(1)

falhas = []
print('CALC · largura pedida %dpx' % LARG)

# 0. o iframe tem mesmo a largura pedida, senao toda medida abaixo mente
real = d.get('larguraReal', 0)
if real != LARG:
    print('  ABORTA: innerWidth do iframe e %dpx, nao %dpx' % (real, LARG))
    sys.exit(2)
print('  viewport conferido: %dpx' % real)

# 1. estouro horizontal do documento
sw, cw = d['doc']['scrollWidth'], d['doc']['clientWidth']
if sw > cw:
    falhas.append('estouro horizontal: scrollWidth %dpx contra %dpx de tela (+%d)'
                  % (sw, cw, sw - cw))
print('  documento: scrollWidth %dpx / clientWidth %dpx' % (sw, cw))

# 2. a barra de abas
b = d['barra']
print('  tab-bar: %d colunas, %dpx de largura, %dpx de altura'
      % (b['colunas'], b['largura'], b['altura']))
if b['altura'] > b['respiroBody']:
    falhas.append('a barra (%dpx) e mais alta que o respiro do body (%dpx): ela COBRE o conteudo'
                  % (b['altura'], b['respiroBody']))
print('  respiro do body: %dpx' % b['respiroBody'])

# 3. cada aba: o rotulo cabe na coluna?
print('  abas:')
for a in d['abas']:
    folga = a['clientWidth'] - a['scrollWidth']
    marca = 'ok  ' if folga >= 0 else 'ESTOURA'
    print('    %-7s %-9s coluna %6.2fpx  conteudo %dpx  folga %dpx'
          % (marca, a['id'], a['largura'], a['scrollWidth'], folga))
    if folga < 0:
        falhas.append('o rotulo de %s (%s) precisa de %dpx e a coluna tem %dpx'
                      % (a['id'], a['texto'], a['scrollWidth'], a['clientWidth']))

# 4. abas vizinhas nao se cruzam
ordenadas = sorted(d['abas'], key=lambda x: x['esquerda'])
for i in range(len(ordenadas) - 1):
    if ordenadas[i]['direita'] > ordenadas[i + 1]['esquerda'] + 0.5:
        falhas.append('as abas %s e %s se sobrepoem'
                      % (ordenadas[i]['id'], ordenadas[i + 1]['id']))

print('')
if falhas:
    print('REPROVOU:')
    for f in falhas:
        print('  - ' + f)
    sys.exit(1)
print('PASSOU: %d abas, nenhuma estoura, sem sobreposicao, sem estouro horizontal'
      % len(d['abas']))
sys.exit(0)
