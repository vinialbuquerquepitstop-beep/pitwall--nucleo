# -*- coding: utf-8 -*-
"""
Da ao #lista um data-aba com a aba corrente.

Por que: Fila, Todos e Clientes renderizam o MESMO .card dentro do MESMO #lista,
que nao carrega marca nenhuma de qual aba esta na tela. Sem gancho, toda regra de
CSS escrita "para a Fila" vaza para a Todos. Este e o menor gancho possivel.

Por que atributo e nao classe: a secao 3 do validar.py le `class="..."` do JS e
cobra regra no CSS para cada classe emitida. Uma classe montada por concatenacao
(`"lista aba-"+n`) entraria la como o fragmento `aba-`, que casa com `.aba-rara`
por acidente e nao por regra. Atributo nao passa por esse contrato e diz melhor o
que e: estado, nao estilo.

Idempotente: rodar duas vezes nao duplica.
"""
import sys, pathlib

APP = pathlib.Path(__file__).resolve().parent.parent / 'public' / 'app.js'

ANCORA = ('E("blocoBusca").className="busca"+("todos"===n||"clientes"===n||'
          '"vendas"===n||"nfs"===n?" visivel":""),')
ENXERTO = 'E("lista")&&E("lista").setAttribute("data-aba",n),'

src = APP.read_text(encoding='utf-8')
antes = len(src.encode('utf-8'))

if ENXERTO in src:
    print('ja aplicado, nada a fazer'); sys.exit(0)

n = src.count(ANCORA)
if n != 1:
    print(f'ABORTA: a ancora aparece {n} vezes, esperava 1. O app.js mudou de forma.')
    sys.exit(2)

src = src.replace(ANCORA, ANCORA + ENXERTO, 1)
APP.write_text(src, encoding='utf-8', newline='')
depois = len(src.encode('utf-8'))

print(f'ok: {antes} -> {depois} bytes (+{depois - antes}, esperado +{len(ENXERTO)})')
assert depois - antes == len(ENXERTO), 'delta de bytes inesperado'
