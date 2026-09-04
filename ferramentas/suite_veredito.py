# Veredito de CORRIDA, separado do veredito de ASSERCAO.
#
# Por que este arquivo existe, medido em 04/09/2026:
# o harness saia com codigo 1 em dois casos que nao se parecem em nada.
#
#   1. uma assercao ficou vermelha, ou um rotulo declarado nao executou.
#      Isso e REGRESSAO: o produto mudou e a prova pegou.
#   2. o Chrome devolveu um DOM sem o <pre id="RESULTADO">, ou estourou o teto
#      de tempo. Isso NAO e regressao: nenhuma assercao chegou a ser medida.
#
# O CLAUDE.md manda conferir o EXIT CODE e nunca o texto da saida. Com os dois
# casos saindo 1, o exit code era exatamente o que nao separava um do outro.
# Em 04/09/2026 isso aconteceu de verdade: o P-ABRE reprovou, e as sete corridas
# seguintes deram 1087/1087 sem nada ter mudado no repo.
#
# O historico do proprio harness registra a mesma classe duas vezes antes:
# 08/08/2026 (o orcamento de tempo virtual em 25000 estourou) e 01/09/2026 (uma
# assercao media antes da leitura terminar, e caia em 1 de cada 3 corridas).
#
# A separacao vive aqui, fora do harness, por um motivo pratico: o harness roda
# tudo no nivel do modulo, entao importa-lo executaria a suite inteira. Uma
# funcao pura num arquivo proprio pode ser provada por ferramentas/prova_suite.py
# em milissegundos, sem Chrome.

# A TAG, nao a palavra. Procurar 'RESULTADO' cru engana: a string existe dentro
# do proprio <script> injetado na pagina, entao o guard passava e o split
# estourava com IndexError depois.
MARCA = 'id="RESULTADO">'

# Codigos de saida do harness. Sao contrato com quem le o portao.
OK = 0             # tudo verde
REGRESSAO = 1      # assercao vermelha, ou rotulo declarado que nao executou
INCONCLUSIVO = 2   # a suite nao chegou ao fim; nada foi medido


def veredito_corrida(dom, estourou_tempo=False):
    """A corrida chegou ao fim? Devolve (terminou, motivo).

    Nao olha assercao nenhuma: responde so se houve o que medir. `motivo` e ''
    quando terminou, e uma frase curta quando nao.
    """
    if estourou_tempo:
        return False, 'o Chrome estourou o teto de tempo'
    if not dom:
        return False, 'o Chrome nao devolveu DOM nenhum'
    if MARCA not in dom:
        return False, f'o DOM saiu sem <pre {MARCA} ({len(dom)} chars)'
    return True, ''
