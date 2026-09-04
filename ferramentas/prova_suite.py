# Prova de FERRAMENTA, nao de produto. Alvo: ferramentas/suite_veredito.py.
#
# Prefixo `suite:`, que o portao 6.2 do docs/financeiro/CONTRATO.md admite
# exatamente para isto: prova da propria ferramenta de validacao.
#
# Roda em milissegundos e nao abre Chrome. E de proposito: a coisa provada aqui
# e a decisao de codigo de saida, e ela precisa continuar provada mesmo quando o
# Chrome for justamente o que esta quebrado.
import pathlib, sys

sys.stdout.reconfigure(encoding='utf-8')
sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
from suite_veredito import veredito_corrida, MARCA, OK, REGRESSAO, INCONCLUSIVO

_n_ok = _n_falhou = 0


def ok(nome, cond, extra=''):
    global _n_ok, _n_falhou
    if cond:
        _n_ok += 1
        print(f'PASSOU  {nome}' + (f'  <{extra}>' if extra else ''))
    else:
        _n_falhou += 1
        print(f'FALHOU  {nome}' + (f'  <{extra}>' if extra else ''))


DOM_BOM = f'<html><body><pre {MARCA}PASSOU  x</pre></body></html>'

# ---------------------------------------------------------------- corrida boa
_t, _m = veredito_corrida(DOM_BOM)
ok('suite: DOM com a tag RESULTADO conta como corrida terminada', _t is True)
ok('suite: e corrida terminada nao carrega motivo nenhum', _m == '', repr(_m))

# ------------------------------------------------------------ corrida truncada
_t, _m = veredito_corrida('<html><body>meia pagina</body></html>')
ok('suite: DOM sem a tag RESULTADO nao terminou', _t is False)
ok('suite: e o motivo diz o tamanho do DOM, para dar o que investigar',
   'chars' in _m, _m)

_t, _m = veredito_corrida('')
ok('suite: DOM vazio nao terminou', _t is False)
ok('suite: e DOM vazio tem motivo proprio, nao o mesmo do truncado',
   'nao devolveu DOM' in _m, _m)

_t, _m = veredito_corrida(DOM_BOM, estourou_tempo=True)
ok('suite: estouro de tempo nao terminou, mesmo com DOM na mao', _t is False)
ok('suite: e o motivo nomeia o teto de tempo', 'teto de tempo' in _m, _m)

# ----------------------------------------------------- a armadilha ja cometida
# O guard antigo procurava a palavra 'RESULTADO' crua. Ela existe dentro do
# proprio <script> injetado na pagina, entao uma corrida truncada passava pelo
# guard e o split estourava com IndexError depois.
_t, _m = veredito_corrida('<script>var x = "RESULTADO";</script>')
ok('suite: a palavra RESULTADO solta, sem a tag, nao engana o veredito',
   _t is False, _m)

# ----------------------------------------------------------- os codigos de saida
ok('suite: corrida que nao terminou sai 2, nunca 1', INCONCLUSIVO == 2)
ok('suite: 1 fica reservado para regressao medida', REGRESSAO == 1)
ok('suite: e os tres codigos sao distintos entre si',
   len({OK, REGRESSAO, INCONCLUSIVO}) == 3, f'{OK}/{REGRESSAO}/{INCONCLUSIVO}')

# ------------------------------------------------- o harness usa mesmo a funcao
_h = (pathlib.Path(__file__).resolve().parent / 'harness.py').read_text(encoding='utf-8')
ok('suite: o harness importa o veredito em vez de reimplementar a checagem',
   'from suite_veredito import' in _h)
ok('suite: e o caminho inconclusivo do harness sai por INCONCLUSIVO',
   'sys.exit(INCONCLUSIVO)' in _h)
ok('suite: nenhum sys.exit(1) cru sobrou no harness',
   'sys.exit(1)' not in _h)
ok('suite: o estouro de tempo e capturado, nao sobe como traceback',
   'except subprocess.TimeoutExpired' in _h)
ok('suite: a corrida e repetida uma vez antes de desistir',
   'TENTATIVAS = 2' in _h)

print(f'\n{_n_ok} passou, {_n_falhou} falhou')
if _n_falhou:
    print('\nREPROVOU: a ferramenta que decide o portao esta errada.')
sys.exit(REGRESSAO if _n_falhou else OK)
