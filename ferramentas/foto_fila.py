# -*- coding: utf-8 -*-
"""
Tira foto de uma aba do app REAL, sem banco e sem login.

Reusa a montagem do harness.py (index.html + app.css + app.js verdadeiros + stub
do Supabase com linha real), tira o script de TESTE e poe no lugar um clique na
aba pedida. Serve para o dono OLHAR a mudanca antes do push, que e a diferenca
entre "a suite passou" e "esta bom".

  python ferramentas/foto_fila.py fila 1280
  python ferramentas/foto_fila.py fila 390
  python ferramentas/foto_fila.py todos 1280
  python ferramentas/foto_fila.py fila 1280 leque   # abre o Desfecho antes da foto

Sai em ferramentas/fotos/<aba>_<largura>.png

Nota: o harness roda como SUBPROCESSO, nunca por import. Ele termina em
sys.exit(), entao importar mataria este script antes da foto.
"""
import pathlib, subprocess, sys, tempfile, os

RAIZ = pathlib.Path(__file__).resolve().parent

CHROME = None
for p in [r'C:\Program Files\Google\Chrome\Application\chrome.exe',
          r'C:\Program Files (x86)\Google\Chrome\Application\chrome.exe']:
    if os.path.exists(p):
        CHROME = p
        break
if not CHROME:
    print('Chrome nao encontrado'); sys.exit(2)

ABA = sys.argv[1] if len(sys.argv) > 1 else 'fila'
LARG = int(sys.argv[2]) if len(sys.argv) > 2 else 1280
ALT = 1400 if LARG >= 900 else 1500
# 3o argumento opcional: data-acao a clicar depois de abrir a aba
CLIQUE = sys.argv[3] if len(sys.argv) > 3 else ''

# regenera a pagina a partir do CSS/JS/HTML de agora
subprocess.run([sys.executable, str(RAIZ / 'harness.py')],
               capture_output=True, text=True, timeout=300)

tmp = pathlib.Path(tempfile.gettempdir()) / 'pitwall_harness.html'
if not tmp.exists():
    print('o harness nao gerou a pagina'); sys.exit(1)
pagina = tmp.read_text(encoding='utf-8')

# fora o roteiro de teste: ele navega ate a ultima aba e cola um <pre> no fim
partes = pagina.rsplit('<script>', 1)
alvo = 'aba' + ABA[:1].upper() + ABA[1:]
pagina = partes[0] + """<script>
(function(){
  // quem tira o app da tela de login e o init(), nao o stub: sem esta chamada a
  // foto sai do formulario de senha (custou uma rodada descobrir)
  window.PitWall.init();
  setTimeout(function(){
    var b = document.getElementById('%s');
    if (b) b.click();
    // clique extra opcional, para fotografar estado que so existe apos interacao
    // (ex.: o leque Desfecho, que nasce display:none)
    var extra = '%s';
    if (extra) setTimeout(function(){
      var e = document.querySelector('#lista [data-acao="' + extra + '"]');
      if (e) e.click();
    }, 500);
  }, 800);
})();
</script>
</body></html>""" % (alvo, CLIQUE)

# ARMADILHA da v45, secao 4.1: --window-size=390 NAO da viewport de 390px. O
# headless do Chrome no Windows tem piso de ~500px de largura de JANELA. Sem
# tratar isso, a media query de celular mede 500, o app renderiza largo e o
# --screenshot apenas RECORTA em 390: a foto mostra conteudo cortado que nao
# existe na tela de verdade. Mesma solucao do diag_mobile.py: o app roda dentro
# de um IFRAME da largura pedida.
if LARG < 520:
    import json
    alvo_js = json.dumps(pagina).replace('</', '<\\/')
    pagina = f"""<!doctype html><html><head><meta charset="utf-8">
<style>html,body{{margin:0;padding:0;background:#fff}}
#palco{{width:{LARG}px;height:{ALT}px;border:0;display:block}}</style></head>
<body><iframe id="palco" src="about:blank"></iframe>
<script>
var f = document.getElementById('palco');
f.contentDocument.open(); f.contentDocument.write({alvo_js}); f.contentDocument.close();
</script>
</body></html>"""

foto_html = pathlib.Path(tempfile.gettempdir()) / f'pitwall_foto_{ABA}_{LARG}.html'
foto_html.write_text(pagina, encoding='utf-8')

saida = RAIZ / 'fotos'
saida.mkdir(exist_ok=True)
png = saida / (f'{ABA}_{LARG}' + (f'_{CLIQUE}' if CLIQUE else '') + '.png')
if png.exists():
    png.unlink()

perfil = tempfile.mkdtemp()
r = subprocess.run([CHROME, '--headless=new', '--disable-gpu', '--no-sandbox',
                    f'--user-data-dir={perfil}', '--hide-scrollbars',
                    '--force-device-scale-factor=1', '--virtual-time-budget=9000',
                    f'--window-size={max(LARG, 520)},{ALT}',
                    f'--screenshot={png}', foto_html.as_uri()],
                   capture_output=True, text=True, timeout=180)

if png.exists():
    print(f'ok: {png}  ({png.stat().st_size} bytes, janela {LARG}x{ALT})')
else:
    print('FALHOU: o Chrome nao gerou o png')
    print((r.stderr or '')[-600:])
    sys.exit(1)
