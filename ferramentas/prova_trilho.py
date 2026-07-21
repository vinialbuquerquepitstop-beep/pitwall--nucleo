# Prova que os 7 trilhos de categoria passam o alvo de 3:1 contra o fundo branco.
# Cor semantica se MEDE, nao se escolhe no olho (CLAUDE.md).
# Roda da raiz: python ferramentas/prova_trilho.py
import sys, pathlib, re
sys.path.insert(0, 'ferramentas')
sys.stdout.reconfigure(encoding='utf-8')
from contraste import ratio

RAIZ = pathlib.Path(__file__).resolve().parent.parent
css = (RAIZ / 'public' / 'app.css').read_text(encoding='utf-8')

ESPERADO = {
    '--tr-fila-follow-up': '#5B6BA8',
    '--tr-captacao':       '#3E8C8C',
    '--tr-conteudo':       '#7A5FA8',
    '--tr-loja-estoque':   '#A87155',
    '--tr-pos-venda':      '#6B8C5B',
    '--tr-analise':        '#5F7386',
    '--tr-fechamento':     '#8C5F7A',
}
SEMANTICOS = {'quente': '#F26B31', 'morno': '#C48808', 'frio': '#8395AF',
              'ok': '#17A06B', 'erro': '#B01235', 'accent': '#0025cc'}
ALVO = 3.0

falhas = []
for var, hexo in ESPERADO.items():
    m = re.search(re.escape(var) + r'\s*:\s*(#[0-9A-Fa-f]{6})', css)
    if not m:
        falhas.append('%s ausente do app.css' % var); continue
    achado = m.group(1)
    if achado.upper() != hexo.upper():
        falhas.append('%s = %s, esperava %s' % (var, achado, hexo)); continue
    r = ratio(achado, '#FFFFFF')
    pior_k, pior_r = min(((k, ratio(achado, v)) for k, v in SEMANTICOS.items()),
                         key=lambda kv: kv[1])
    marca = 'OK' if r >= ALVO else 'REPROVA'
    print('  %-22s %s  vs branco %5.2f  [%s]   pior par: %s %.2f'
          % (var, achado, r, marca, pior_k, pior_r))
    if r < ALVO:
        falhas.append('%s tem %.2f contra branco, alvo %.1f' % (var, r, ALVO))

print()
if falhas:
    print('REPROVOU:'); [print('  - ' + f) for f in falhas]; sys.exit(1)
print('7 trilhos OK. Lembrete: as colisoes com semantico sao BAIXAS (1.1 a 1.5).')
print('Matiz sozinho nao separa. O icone e obrigatorio, nao e enfeite.')
