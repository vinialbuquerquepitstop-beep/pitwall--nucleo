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
    python ferramentas/foto.py dashboard 1440 2200 "[data-acao=dv-janela][data-id=mes]"

O 4o argumento e um SELETOR clicado depois da aba. Existe porque estado que so
aparece depois de um clique dentro da aba era INFOTOGRAFAVEL: o dashboard abre
em Trimestre, e as regras de comparacao do card de Insights so tem base na
janela Mes. Foto que nao alcanca o estado em questao nao prova nada sobre ele.

Exige que `python ferramentas/harness.py` tenha rodado ao menos uma vez nesta
maquina, para o arquivo montado existir.
"""
import os, sys, re, json, pathlib, tempfile, subprocess

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
seletor = sys.argv[4] if len(sys.argv) > 4 else ''
# O seletor entra no nome do arquivo: sem isso a foto do estado clicado
# SOBRESCREVE a do estado base, e ficam duas leituras diferentes com um nome so.
sufixo = ('_' + re.sub(r'[^a-z0-9]+', '-', seletor.lower()).strip('-')[:40]) if seletor else ''

montado = pathlib.Path(tempfile.gettempdir()) / 'pitwall_harness.html'
if not montado.exists():
    print(f'ABORTA: {montado} nao existe. Rode `python ferramentas/harness.py` uma vez.')
    sys.exit(2)

# ARMADILHA MEDIDA EM 12/08/2026: este arquivo e montado pelo harness.py, e o
# foto.py so o LE. Depois de editar app.js/app.css sem rodar o harness de novo, a
# foto sai IDENTICA a anterior e parece que a correcao nao funcionou — foi
# exatamente o que aconteceu, e quase virou "consertei e nao mudou nada".
# Fotografar estado velho e pior que nao fotografar: da uma leitura errada da
# tela com a confianca de quem olhou.
_raiz = pathlib.Path(__file__).resolve().parent.parent
_fontes = [_raiz / 'public' / 'app.js', _raiz / 'public' / 'app.css',
           _raiz / 'public' / 'index.html']
_velhas = [f.name for f in _fontes if f.exists() and f.stat().st_mtime > montado.stat().st_mtime]
if _velhas:
    print(f'ABORTA: {", ".join(_velhas)} mudou depois da ultima montagem.\n'
          f'        A foto sairia do estado ANTIGO. Rode antes:\n'
          f'          python ferramentas/harness.py')
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

# O mapa e uma CONSTANTE, e nao um .get() inline: antes o erro tentava listar as
# abas validas a partir de `ID`, que nessa altura ja era None por definicao, e a
# mensagem saia sem lista nenhuma. Quem erra o nome da aba precisa ver os nomes.
ABAS = {'hoje': 'abaHoje', 'fila': 'abaFila', 'todos': 'abaTodos',
        'vendas': 'abaVendas', 'conteudo': 'abaConteudo', 'rotina': 'abaRotina',
        'clientes': 'abaClientes', 'escopo': 'abaEscopo',
        'dashboard': 'abaDash', 'nfs': 'abaNfs', 'captacao': 'abaCaptacao',
        'indicacoes': 'abaIndicacoes'}
ID = ABAS.get(aba)
if not ID:
    print(f'ABORTA: aba "{aba}" desconhecida. Use: {", ".join(sorted(ABAS))}')
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
    var sel = {json.dumps(seletor)};
    if (!sel) return;
    setTimeout(function () {{
      var alvo = document.querySelector(sel);
      if (alvo) {{ alvo.click(); return; }}
      // Seletor que nao casa tem que APARECER na foto. Se falhasse calado, a
      // imagem sairia do estado base com cara de estado clicado, que e a mesma
      // familia de mentira da montagem velha que este script ja aborta.
      var av = document.createElement('div');
      av.textContent = 'FOTO INVALIDA: seletor nao encontrado -> ' + sel;
      av.setAttribute('style', 'position:fixed;top:0;left:0;right:0;z-index:99999;'
        + 'background:#B01235;color:#fff;font:600 15px sans-serif;padding:10px 14px');
      document.body.appendChild(av);
    }}, 400);
  }}, 400);
}});
</script></body></html>"""

tmp = pathlib.Path(tempfile.gettempdir()) / f'pitwall_foto_{aba}{sufixo}.html'
tmp.write_text(pagina, encoding='utf-8')

saida = pathlib.Path(__file__).resolve().parent.parent / 'docs' / 'design' / f'foto_{aba}_{larg}{sufixo}.png'
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
