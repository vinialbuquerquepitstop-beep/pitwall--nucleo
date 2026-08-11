# -*- coding: utf-8 -*-
"""
Tira uma foto da tela real do app, sem login e sem banco.

Por que existe: durante a sessao de 08/08/2026 o Claude passou horas grepando
CSS e afirmando o que a tela "ganhou", sem nunca ter olhado para ela. O dono
abriu e disse: "nenhuma diferenca relevante, nao mudou absolutamente nada".
Estava certo. Prova de cor computada nao substitui olhar.

Como funciona: o harness ja assembla index.html + app.css + app.js + stub das
RPCs num arquivo unico em %TEMP%/pitwall_harness.html. Este script reusa esse
arquivo, ARRANCA o bloco de teste do fim (senao a suite clica por 20 abas e a
foto sai de onde ela parou), enxerta um clique na aba pedida e manda o Chrome
fotografar.

Uso:
    python ferramentas/foto.py                 # aba Hoje, 1280px
    python ferramentas/foto.py fila 390        # aba Fila, largura de celular
    python ferramentas/foto.py conteudo 1280

Exige que `python ferramentas/harness.py` tenha rodado ao menos uma vez nesta
maquina, para o arquivo montado existir.
"""
import os, sys, pathlib, tempfile, subprocess

CHROME = None
for p in [r'C:\Program Files\Google\Chrome\Application\chrome.exe',
          r'C:\Program Files (x86)\Google\Chrome\Application\chrome.exe']:
    if os.path.exists(p):
        CHROME = p
        break
if not CHROME:
    print('ABORTA: Chrome nao encontrado nos dois caminhos padrao.')
    sys.exit(2)

aba = (sys.argv[1] if len(sys.argv) > 1 else 'hoje').lower()
larg = int(sys.argv[2]) if len(sys.argv) > 2 else 1280
alt = int(sys.argv[3]) if len(sys.argv) > 3 else 1400

montado = pathlib.Path(tempfile.gettempdir()) / 'pitwall_harness.html'
if not montado.exists():
    print(f'ABORTA: {montado} nao existe. Rode `python ferramentas/harness.py` uma vez.')
    sys.exit(2)

pagina = montado.read_text(encoding='utf-8')

# Arrancar o ultimo <script>: e o bloco de teste, que clica por toda aba e
# deixaria a foto onde a suite parou. O corte e pelo ULTIMO <script>, porque o
# stub e o app.js vem antes e os dois sao necessarios.
corte = pagina.rfind('<script>')
if corte < 0:
    print('ABORTA: nao achei o bloco de teste para arrancar.')
    sys.exit(2)
pagina = pagina[:corte]

ID = {'hoje': 'abaHoje', 'fila': 'abaFila', 'todos': 'abaTodos',
      'vendas': 'abaVendas', 'conteudo': 'abaConteudo', 'rotina': 'abaRotina',
      'clientes': 'abaClientes', 'escopo': 'abaEscopo'}.get(aba)
if not ID:
    print(f'ABORTA: aba "{aba}" desconhecida. Use: {", ".join(sorted(ID or {}))}'
          if ID else f'ABORTA: aba "{aba}" desconhecida.')
    sys.exit(2)

# window.PitWall.init() e o que liga o app. Sem ele a foto sai da tela de LOGIN,
# porque o app so troca de tela depois de o init resolver a sessao (o stub
# devolve uma sessao valida em getSession). Foi o primeiro erro deste script.
pagina += f"""<script>
window.addEventListener('load', function () {{
  window.PitWall.init();
  setTimeout(function () {{
    var b = document.getElementById('{ID}');
    if (b && '{ID}' !== 'abaHoje') b.click();
  }}, 400);
}});
</script></body></html>"""

tmp = pathlib.Path(tempfile.gettempdir()) / f'pitwall_foto_{aba}.html'
tmp.write_text(pagina, encoding='utf-8')

saida = pathlib.Path(__file__).resolve().parent.parent / 'docs' / 'design' / f'foto_{aba}_{larg}.png'
saida.parent.mkdir(parents=True, exist_ok=True)

perfil = tempfile.mkdtemp()
r = subprocess.run([CHROME, '--headless=new', '--disable-gpu', '--no-sandbox',
                    f'--user-data-dir={perfil}',
                    '--virtual-time-budget=20000',
                    '--hide-scrollbars',
                    f'--window-size={larg},{alt}',
                    f'--screenshot={saida}',
                    tmp.as_uri()],
                   capture_output=True, text=True, encoding='utf-8', timeout=120)

if not saida.exists():
    print('ABORTA: o Chrome nao gravou a foto.')
    for ln in (r.stderr or '').splitlines()[-8:]:
        print(' ', ln[:200])
    sys.exit(1)

print(f'ok: {saida}  ({saida.stat().st_size} bytes, {larg}x{alt}, aba {aba})')
