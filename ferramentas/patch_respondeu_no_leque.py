# -*- coding: utf-8 -*-
"""
Move o botao `Respondeu` da fileira de escrita para DENTRO do leque `Desfecho`.

Pedido do dono, 03/08/2026: "o botao de respondeu estar fora do desfecho.
poderia estar ali".

O que NAO foi feito, e por que: o dono disse que "ja vale a funcao do
conversando". Conferido no banco no mesmo dia, e nao vale:

  registrar_resposta    -> grava respondido_em / ultima_resposta
  registrar_conversando -> grava etapa_cadencia
  fn_regua_varredura    -> le respondido_em, e NAO le etapa_cadencia

Ou seja: `Conversando` escreve numa coluna que a regua nunca abre (a pendencia 3
da v45 chama `etapa_cadencia` de decorativa). Quem freia a cadencia e so o
`Respondeu`, pelo invariante 2. Por isso ele MUDOU DE LUGAR e nao sumiu:
sumir seria tirar o unico freio da regua sem aviso nenhum na tela.

Efeito colateral bem-vindo: a fileira de escrita cai de 3 para 2 botoes, e a
390px `Toque enviado` parava de caber em uma linha com 3.

Idempotente: rodar duas vezes nao duplica.
"""
import sys, pathlib

APP = pathlib.Path(__file__).resolve().parent.parent / 'public' / 'app.js'

# 1. sai da fileira de escrita
SAI = ('<button class="btn-acao respondeu" data-acao="respondeu" '
       'data-id="\'+g+\'">Respondeu</button>')

# 2. entra como PRIMEIRO item do leque, antes de Conversando
ANCORA = '<div class="desfechos"><button class="btn-desf" data-acao="conversando"'
ENTRA = ('<div class="desfechos"><button class="btn-desf respondeu" '
         'data-acao="respondeu" data-id="\'+g+\'">Respondeu</button>'
         '<button class="btn-desf" data-acao="conversando"')

src = APP.read_text(encoding='utf-8')
antes = len(src.encode('utf-8'))

if 'btn-desf respondeu' in src:
    print('ja aplicado, nada a fazer'); sys.exit(0)

if src.count(SAI) != 1:
    print(f'ABORTA: achei {src.count(SAI)} botoes Respondeu na fileira, esperava 1.')
    sys.exit(2)
if src.count(ANCORA) != 1:
    print(f'ABORTA: achei {src.count(ANCORA)} leques, esperava 1.')
    sys.exit(2)

src = src.replace(SAI, '', 1).replace(ANCORA, ENTRA, 1)
APP.write_text(src, encoding='utf-8', newline='')
depois = len(src.encode('utf-8'))

n = src.count('data-acao="respondeu"')
if n != 1:
    print(f'ABORTA DEPOIS DE ESCREVER: {n} botoes respondeu, esperava 1'); sys.exit(3)

print(f'ok: {antes} -> {depois} bytes ({depois - antes:+d})')
print(f'   data-acao="respondeu" no arquivo: {n} (prova_regua.js exige exatamente 1)')
