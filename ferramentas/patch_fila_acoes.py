# -*- coding: utf-8 -*-
r"""
Uma faixa de acao so na Fila: leitura na esquerda, escrita na direita.

Pedido do dono em 11/08/2026: "realoque os chips de toque, resposta, sugerir de
forma mais coerente, horizontal talvez". Ele estava olhando para tres faixas de
pilula empilhadas embaixo da linha de identidade (chips de leitura, fileira de
leitura, fileira de escrita), e o empilhamento nao dizia nada sobre a diferenca
entre elas.

O que muda: os dois botoes de ESCRITA (`Toque enviado`, `Desfecho`) saem do
proprio `.card-acoes` e entram no `.card-acoes` de LEITURA, dentro de um
`<span class="acoes-escrita">`, que o CSS empurra para a direita com
`margin-left:auto`. Resultado numa faixa unica:

    [Chamar no WhatsApp][Sugerir mensagem][Historico] ... [Toque enviado][Desfecho]
     \_______________ leitura ________________/            \____ escrita ____/

A separacao leitura x escrita da v49 NAO foi derrubada, mudou de eixo: era
vertical (duas faixas), virou horizontal (duas pontas da mesma faixa). Continua
sendo do projeto e nao acidente, e continua sendo um GRUPO de verdade no DOM,
nao dois botoes soltos que por acaso caem no fim da fila.

Por que DOM e nao so CSS: no DOM os dois `.card-acoes` nunca foram vizinhos.
Entre eles moram `.scripts` (o painel do Sugerir) e `.hist` (o painel do
Historico), que nascem vazios. Juntar as duas faixas so com CSS exigiria
esconder painel vazio, e ai o primeiro clique em `Sugerir mensagem` encheria o
painel e jogaria `Toque enviado` para outra linha: a fileira se reorganizaria
embaixo do dedo do operador, todo dia, em todo lead.

O que NAO muda:
  - nenhum `data-acao` some ou troca de nome, entao nenhuma ligacao de evento
    muda (o app usa delegacao por `data-acao`);
  - o leque de desfecho (`.desfechos`) e o `.retomar` seguem onde estavam,
    abrindo ABAIXO da faixa;
  - `Respondeu` continua fora da fileira, dentro do leque, como a v46 deixou;
  - nenhuma outra aba encosta: a fileira de escrita so era montada no ramo
    `"fila"===e&&a.id`.

Efeito colateral assumido: a classe `escrita` deixa de existir no DOM. As duas
regras de CSS que casavam com ela morrem e sao substituidas por `.acoes-escrita`,
e a assercao do `harness.py` que contava `.card-acoes.escrita .btn-acao === 2`
passa a contar `.acoes-escrita .btn-acao === 2`. Mesma intencao, seletor novo:
o guard-rail nao foi calado, foi reapontado para o objeto que o substituiu.

Idempotente: rodar duas vezes nao duplica.
"""
import sys, pathlib

APP = pathlib.Path(__file__).resolve().parent.parent / 'public' / 'app.js'

MARCA = 'acoes-escrita'

# --------------------------------------------------------------------------
# 1) `ve` nasce ao lado de `v`. Sem declarar, a atribuicao de dentro do ramo
#    `"fila"===e` vazaria para o escopo global do IIFE em modo nao estrito, e o
#    arquivo abre com "use strict": seria ReferenceError na primeira Fila.
# --------------------------------------------------------------------------
VAR_ANTIGO = ('var m=a.observacoes?\'<div class="obs">\'+c(a.observacoes)+"</div>":"",v="";')
VAR_NOVO = ('var m=a.observacoes?\'<div class="obs">\'+c(a.observacoes)+"</div>":"",v="",ve="";')

# --------------------------------------------------------------------------
# 2) A fileira de escrita deixa de ser um `.card-acoes` proprio e vira o grupo
#    `.acoes-escrita`, guardado em `ve`. O que sobra em `v` e so o que ABRE:
#    o leque de desfecho e o campo de retomar.
# --------------------------------------------------------------------------
ESCRITA_ANTIGO = (
    'v=\'<div class="card-acoes escrita">'
    '<button class="btn-acao toque" data-acao="toque" data-id="\'+g+\'">Toque enviado</button>'
    '<button class="btn-acao" data-acao="leque" data-id="\'+g+\'">Desfecho</button>'
    '</div>'
)
ESCRITA_NOVO = (
    've=\'<span class="acoes-escrita">'
    '<button class="btn-acao toque" data-acao="toque" data-id="\'+g+\'">Toque enviado</button>'
    '<button class="btn-acao" data-acao="leque" data-id="\'+g+\'">Desfecho</button>'
    '</span>\',v=\''
)

# --------------------------------------------------------------------------
# 3) O grupo entra no fim do `.card-acoes` de leitura. Fora da Fila `ve` e ""
#    e a faixa continua exatamente como era.
# --------------------------------------------------------------------------
LEITURA_ANTIGO = (
    '\'<div class="card-acoes">\'+r+'
    '(a.id?\'<button class="btn-acao" data-acao="historico" data-id="\'+c(a.id)+\'">Histórico</button>\':"")'
    '+"</div>"'
)
LEITURA_NOVO = (
    '\'<div class="card-acoes">\'+r+'
    '(a.id?\'<button class="btn-acao" data-acao="historico" data-id="\'+c(a.id)+\'">Histórico</button>\':"")'
    '+ve+"</div>"'
)

src = APP.read_text(encoding='utf-8')
antes = len(src.encode('utf-8'))

if MARCA in src:
    print('ja aplicado, nada a fazer')
    sys.exit(0)

for nome, agulha in (('declaracao de v', VAR_ANTIGO),
                     ('fileira de escrita', ESCRITA_ANTIGO),
                     ('fileira de leitura', LEITURA_ANTIGO)):
    n = src.count(agulha)
    if n != 1:
        print(f'ABORTA: {nome} aparece {n} vezes, esperava 1. '
              f'O app.js mudou de forma; conferir antes de forcar.')
        sys.exit(1)

src = src.replace(VAR_ANTIGO, VAR_NOVO, 1)
src = src.replace(ESCRITA_ANTIGO, ESCRITA_NOVO, 1)
src = src.replace(LEITURA_ANTIGO, LEITURA_NOVO, 1)

APP.write_text(src, encoding='utf-8')
depois = len(src.encode('utf-8'))
print(f'aplicado. {antes} -> {depois} bytes (+{depois - antes})')
print('conferir agora: node --check public/app.js && python ferramentas/harness.py')
