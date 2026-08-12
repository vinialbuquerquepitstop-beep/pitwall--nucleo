# -*- coding: utf-8 -*-
"""
Move o botao Respondeu da fileira de escrita para DENTRO do leque Desfecho.

Pedido do dono em 03/08/2026. O CSS e as assercoes do harness entraram naquele
dia (`.btn-desf.respondeu{flex:1 1 100%}` no app.css, e a regra antiga
`.btn-acao.respondeu` foi removida com comentario dizendo que o botao mudou de
lugar). O JS nunca foi mexido: por dois commits a fileira seguiu com tres botoes
e tres assercoes seguiram vermelhas, tratadas como "falhas herdadas".

Ele SO muda de lugar, nao some. `registrar_resposta` grava `respondido_em`, que
e o unico freio que `fn_regua_varredura` le. Tirar o botao tiraria o freio.

Fica em PRIMEIRO no leque porque a regra de CSS lhe da `flex:1 1 100%`: ele ocupa
a linha inteira, com Conversando, Retomar, Fechou e Sem interesse abaixo.

Idempotente: rodar duas vezes nao duplica.
"""
import sys, pathlib

APP = pathlib.Path(__file__).resolve().parent.parent / 'public' / 'app.js'

# O botao, exatamente como nasce hoje na fileira de escrita.
ANTIGO = ('<button class="btn-acao respondeu" data-acao="respondeu" '
          'data-id="\'+g+\'">Respondeu</button>')

# O mesmo botao, com a classe do leque. data-acao e data-id intactos: o handler
# e delegado por data-acao, entao nenhuma ligacao de evento muda.
NOVO = ('<button class="btn-desf respondeu" data-acao="respondeu" '
        'data-id="\'+g+\'">Respondeu</button>')

# Onde ele passa a morar: colado logo depois da abertura do leque.
ABRE_LEQUE = '<div class="desfechos">'

src = APP.read_text(encoding='utf-8')
antes = len(src.encode('utf-8'))

if NOVO in src:
    print('ja aplicado, nada a fazer'); sys.exit(0)

for nome, agulha, esperado in (('botao antigo', ANTIGO, 1),
                               ('abertura do leque', ABRE_LEQUE, 1)):
    n = src.count(agulha)
    if n != esperado:
        print(f'ABORTA: {nome} aparece {n} vezes, esperava {esperado}. '
              f'O app.js mudou de forma.')
        sys.exit(2)

src = src.replace(ANTIGO, '', 1)
src = src.replace(ABRE_LEQUE, ABRE_LEQUE + NOVO, 1)

APP.write_text(src, encoding='utf-8', newline='')
depois = len(src.encode('utf-8'))
delta = len(NOVO) - len(ANTIGO)

print(f'ok: {antes} -> {depois} bytes ({depois - antes:+d}, esperado {delta:+d})')
assert depois - antes == delta, 'delta de bytes inesperado'
