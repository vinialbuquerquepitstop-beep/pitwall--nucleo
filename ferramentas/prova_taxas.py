# -*- coding: utf-8 -*-
"""Prova que a tabela de parcelamento e UMA SO (v61, 16/08/2026).

Ate 16/08/2026 os 17 coeficientes viviam em dois arquivos e em nenhum banco:
`const TX` em public/calc/index.html e `config.taxas` em
public/calc/consultor/dados.js. O acrescimo fixo aparecia como `v+100` no codigo
de um e como `config.pb` no outro. Atualizar coeficiente exigia lembrar de dois
lugares, e esquecer um MUDA O QUE O CLIENTE PAGA sem ninguem notar.

A fonte passou a ser `calc_dados.dados.config.taxas` + `.pb`. Este arquivo e o
alarme: enquanto existir copia derivada (o dados.js do consultor e gerado), ela
tem que bater com a fonte, coeficiente a coeficiente.

Uso:
    python ferramentas/prova_taxas.py            # compara os ARQUIVOS entre si
    python ferramentas/prova_taxas.py banco.json # compara tambem com o banco

O banco.json e o resultado de:
    select dados->'config'->'taxas' taxas, dados->'config'->'pb' pb
      from calc_dados where tenant_id = '...0001';

EXIT 0 = tudo igual. EXIT 1 = divergiu, e o relatorio diz onde.
"""
import io
import json
import re
import sys
from pathlib import Path

RAIZ = Path(__file__).resolve().parent.parent
CALC = RAIZ / 'public' / 'calc' / 'index.html'
CONS = RAIZ / 'public' / 'calc' / 'consultor' / 'dados.js'

falhas = []
oks = []


def ck(cond, msg, detalhe=''):
    (oks if cond else falhas).append(msg + (('  <' + str(detalhe) + '>') if detalhe else ''))


def tabela_da_calc(txt):
    """Le `const TX={...}` OU, depois da migracao para fonte unica, confirma que
    a constante sumiu e a calc passou a ler do config."""
    m = re.search(r'const TX\s*=\s*\{([^}]*)\}', txt)
    if not m:
        return None, None
    tx = {}
    for par in m.group(1).split(','):
        if ':' not in par:
            continue
        k, v = par.split(':', 1)
        tx[k.strip().strip('"\'')] = float(v)
    pb = re.search(r'return v>0\?v\+(\d+):v', txt)
    return tx, (int(pb.group(1)) if pb else None)


def tabela_do_consultor(txt):
    m = re.search(r'"taxas"\s*:\s*(\{[^}]*\})', txt)
    if not m:
        return None, None
    tx = {str(k): float(v) for k, v in json.loads(m.group(1)).items()}
    pb = re.search(r'"pb"\s*:\s*(\d+)', txt)
    return tx, (int(pb.group(1)) if pb else None)


def compara(nome_a, a, nome_b, b):
    if a is None or b is None:
        return
    ck(set(a) == set(b),
       'as parcelas de %s e %s sao as mesmas' % (nome_a, nome_b),
       'so em %s: %s | so em %s: %s' % (nome_a, sorted(set(a) - set(b)),
                                        nome_b, sorted(set(b) - set(a))))
    difs = [(k, a[k], b[k]) for k in sorted(set(a) & set(b), key=int)
            if abs(a[k] - b[k]) > 1e-9]
    ck(not difs,
       'todo coeficiente de %s bate com %s' % (nome_a, nome_b),
       '; '.join('%sx: %s vs %s' % d for d in difs))


calc_txt = io.open(CALC, encoding='utf-8').read()
cons_txt = io.open(CONS, encoding='utf-8').read()

tx_calc, pb_calc = tabela_da_calc(calc_txt)
tx_cons, pb_cons = tabela_do_consultor(cons_txt)

ck(tx_cons is not None, 'o dados.js do consultor tem config.taxas')
if tx_cons:
    ck(len(tx_cons) == 17, 'o consultor tem os 17 coeficientes (2x a 18x)', len(tx_cons))
    ck(sorted(map(int, tx_cons)) == list(range(2, 19)),
       'e as parcelas vao de 2 a 18 sem buraco', sorted(map(int, tx_cons)))
    # parcelar mais nunca pode sair mais barato: erro de digitacao aparece aqui
    seq = [tx_cons[str(n)] for n in range(2, 19)]
    ck(all(x <= y for x, y in zip(seq, seq[1:])),
       'os coeficientes sao monotonicos (parcelar mais nunca custa menos)')
    ck(pb_cons == 100, 'o acrescimo fixo do consultor e 100', pb_cons)

# Enquanto a calc ainda declarar a constante, ela tem que bater com o resto.
# Quando a migracao para fonte unica terminar, a constante deixa de existir e
# este bloco vira a prova de que ela sumiu.
if tx_calc is None:
    oks.append('a calc do dono NAO declara mais `const TX` (le do config)')
    ck('config.taxas' in calc_txt or 'CFG.taxas' in calc_txt,
       'e ela referencia as taxas vindas do config')
else:
    ck(len(tx_calc) == 17, 'a calc do dono tem os 17 coeficientes', len(tx_calc))
    ck(pb_calc == 100, 'o acrescimo fixo da calc e 100', pb_calc)
    compara('calc', tx_calc, 'consultor', tx_cons)

# ---- o banco, quando informado -------------------------------------------
if len(sys.argv) > 1:
    b = json.loads(io.open(sys.argv[1], encoding='utf-8').read())
    if isinstance(b, list):
        b = b[0]
    tx_bd = {str(k): float(v) for k, v in (b.get('taxas') or {}).items()}
    pb_bd = int(b.get('pb'))
    ck(len(tx_bd) == 17, 'o banco tem os 17 coeficientes', len(tx_bd))
    ck(pb_bd == 100, 'o acrescimo fixo do banco e 100', pb_bd)
    compara('banco', tx_bd, 'consultor', tx_cons)
    if tx_calc:
        compara('banco', tx_bd, 'calc', tx_calc)
else:
    oks.append('(banco nao informado: rode com o json do calc_dados para comparar)')

print('PROVA DA TABELA DE PARCELAMENTO')
for o in oks:
    print('  ok  ' + o)
for f in falhas:
    print('FALHOU ' + f)
print('\n%d ok, %d falhas' % (len(oks), len(falhas)))
sys.exit(1 if falhas else 0)
