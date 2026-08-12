# -*- coding: utf-8 -*-
r"""
Aba Hoje: marcar uma tarefa deixa de refazer o dia inteiro.

Segunda metade do conserto pedido em 11/08/2026 ("corrija o carregamento
acionado toda vez que alguma funcao e clicada"). O `patch_carga_quieta.py`
cuidou da base e da Fila; aqui e o Hoje.

O QUE ACONTECIA: todo `data-acao` do Hoje passava `renderHoje` como callback do
`qF()`. Marcar UMA tarefa apagava `#lista`, chamava `painel_do_dia` de novo e
remontava placar, tarefas, conteudo, lembretes e a nota. O foco ia embora e o
dia inteiro piscava para virar um checkbox.

O QUE MUDA:
  - `dia-marcar` e `lemb-marcar`: viram o `aria-checked` DAQUELE botao e
    recalculam o placar contando o DOM. Zero rede alem da propria RPC.
  - `dia-remover` e `lemb-remover`: tiram AQUELA linha e recalculam.
  - `dia-add`, `lemb-add` e `dia-puxar`: item novo so o servidor conhece, entao
    re-render de verdade, mas SILENCIOSO (`renderHoje(!0)`). Inventar a linha no
    cliente para evitar a leitura seria a tela mentindo sobre o id, a ordem e a
    categoria da tarefa.
  - `nf-seg` (o segmentado com/sem nota) tambem para de piscar: e so um filtro
    de exibicao.

O placar acha a celula por `data-cel`, que este patch faz o `capCel()` emitir.
A chave e o CODIGO (`rotina`, `conteudo`, `lembretes`), nunca o rotulo exibido,
que e display e editavel: invariante 12, que a v33 promoveu para qualquer
dominio. Por isso `capCel` ganha um 4o argumento em vez de a busca casar texto.

ESCOPO E ROTINA FICARAM DE FORA DE PROPOSITO. O placar de uma frente do Escopo
(`nota`, `faixa`, `dias_parada`) e derivado no servidor, dentro de
`escopo_completo`. Recalcular isso no cliente para poupar uma leitura seria
inventar numero que o cliente nao possui, e a tela passaria a afirmar uma nota
que ninguem pode auditar. Aquelas abas ficam com o re-render silencioso que o
`aposAcao()` ja da: sem spinner, sem baixar a base de leads, e sem estado
aberto para perder (conferido: nao ha `aria-expanded` nem painel expansivel nos
blocos de Escopo e Rotina).

Idempotente: rodar duas vezes nao duplica.
Grava com newline='\n' (a armadilha de CRLF da v50).
"""
import sys, pathlib

APP = pathlib.Path(__file__).resolve().parent.parent / 'public' / 'app.js'

MARCA = 'function hojePlacarAtualiza('

src = APP.read_text(encoding='utf-8')
antes = len(src.encode('utf-8'))

if MARCA in src:
    print('ja aplicado, nada a fazer')
    sys.exit(0)

# --------------------------------------------------------------------------
# 1) a celula do placar ganha chave estavel, e os helpers nascem junto
# --------------------------------------------------------------------------
CAPCEL_ANTIGO = ('function capCel(rot,num,pe){return\'<div class="pb-celula">'
                 '<div class="pb-rot">\'+c(rot)+\'</div>')
CAPCEL_NOVO = (
    # vira o proprio checkbox, sem tocar no resto da linha
    'function viraCheck(b){b.setAttribute("aria-checked","true"===b.getAttribute("aria-checked")?"false":"true")}'
    # a linha e o pai do botao: <div class="dia-lin"><button marcar><button remover></div>
    'function tiraLinha(b){var p=b.parentNode;if(p&&p.parentNode)p.parentNode.removeChild(p)}'
    'function pbCel(cod){var l=E("lista");return l?l.querySelector(\'.pb-celula[data-cel="\'+cod+\'"]\'):null}'
    'function pbTexto(cel,cls,txt){if(!cel)return;var el=cel.querySelector(cls);if(el)el.textContent=txt}'
    # conta o DOM, que e a fonte do que esta na tela. Nao ha numero inventado
    # aqui: feitas, total e lembretes em aberto sao exatamente as linhas visiveis.
    'function hojePlacarAtualiza(){var l=E("lista");if(!l)return;var j,'
    'ts=l.querySelectorAll(\'[data-acao="dia-marcar"]\'),f=0,'
    'ls=l.querySelectorAll(\'[data-acao="lemb-marcar"]\'),ab=0;'
    'for(j=0;j<ts.length;j++)if("true"===ts[j].getAttribute("aria-checked"))f++;'
    'for(j=0;j<ls.length;j++)if("true"!==ls[j].getAttribute("aria-checked"))ab++;'
    'var cr=pbCel("rotina");'
    'pbTexto(cr,".pb-num",(ts.length?Math.round(100*f/ts.length):0)+"%");'
    'pbTexto(cr,".pb-pe",f+" de "+ts.length+" feitas");'
    'pbTexto(pbCel("lembretes"),".pb-num",String(ab))}'
    'function hojeQuieto(){renderHoje(!0)}'
    'function capCel(rot,num,pe,cod){return\'<div class="pb-celula" data-cel="\'+c(cod||rot)+\'">'
    '<div class="pb-rot">\'+c(rot)+\'</div>'
)

# --------------------------------------------------------------------------
# 2) as tres celulas do Hoje declaram o codigo
# --------------------------------------------------------------------------
PLACAR_ANTIGO = 'capCel("rotina",pct+"%",f+" de "+tt+" feitas")'
PLACAR_NOVO = 'capCel("rotina",pct+"%",f+" de "+tt+" feitas","rotina")'
CONT_ANTIGO = ('capCel("conteúdo",(d.conteudo||[]).length,"peças hoje")'
               '+capCel("lembretes",ab,"em aberto")')
CONT_NOVO = ('capCel("conteúdo",(d.conteudo||[]).length,"peças hoje","conteudo")'
             '+capCel("lembretes",ab,"em aberto","lembretes")')

# --------------------------------------------------------------------------
# 3) os quatro cirurgicos
# --------------------------------------------------------------------------
CIRURGICOS = [
    ('if("dia-marcar"===o)return void qF("marcar_tarefa",'
     '{p_tarefa_id:t,p_concluida:"true"!==e.getAttribute("aria-checked")},e,renderHoje);',
     'if("dia-marcar"===o)return void qF("marcar_tarefa",'
     '{p_tarefa_id:t,p_concluida:"true"!==e.getAttribute("aria-checked")},e,'
     'function(){viraCheck(e),hojePlacarAtualiza()});'),

    ('if("lemb-marcar"===o)return void qF("marcar_lembrete",'
     '{p_lembrete_id:t,p_feito:"true"!==e.getAttribute("aria-checked")},e,renderHoje);',
     'if("lemb-marcar"===o)return void qF("marcar_lembrete",'
     '{p_lembrete_id:t,p_feito:"true"!==e.getAttribute("aria-checked")},e,'
     'function(){viraCheck(e),hojePlacarAtualiza()});'),

    ('qF("remover_tarefa",{p_tarefa_id:t},e,renderHoje)',
     'qF("remover_tarefa",{p_tarefa_id:t},e,function(){tiraLinha(e),hojePlacarAtualiza()})'),

    ('qF("remover_lembrete",{p_lembrete_id:t},e,renderHoje)',
     'qF("remover_lembrete",{p_lembrete_id:t},e,function(){tiraLinha(e),hojePlacarAtualiza()})'),
]

# --------------------------------------------------------------------------
# 4) o segmentado das notas fiscais e so filtro de exibicao
# --------------------------------------------------------------------------
NF_ANTIGO = 'return void renderNfs(E("lista"))}'
NF_NOVO = 'return void renderNfs(E("lista"),!0)}'

pares = [(CAPCEL_ANTIGO, CAPCEL_NOVO), (PLACAR_ANTIGO, PLACAR_NOVO),
         (CONT_ANTIGO, CONT_NOVO), (NF_ANTIGO, NF_NOVO)] + CIRURGICOS

for velho, _ in pares:
    n = src.count(velho)
    if n != 1:
        print(f'ABORTA: ancora aparece {n} vezes, esperava 1:\n  {velho[:90]}...')
        sys.exit(1)

for velho, novo in pares:
    src = src.replace(velho, novo, 1)

# --------------------------------------------------------------------------
# 5) o que sobrou de `renderHoje` como callback sao os tres que PRECISAM reler
#    (dia-add, lemb-add, dia-puxar). Viram releitura silenciosa.
# --------------------------------------------------------------------------
RESTO_ANTIGO, RESTO_NOVO, RESTO_N = ',e,renderHoje)', ',e,hojeQuieto)', 3
if src.count(RESTO_ANTIGO) != RESTO_N:
    print(f'ABORTA: sobraram {src.count(RESTO_ANTIGO)} callbacks `renderHoje`, esperava {RESTO_N} '
          f'(dia-add, lemb-add, dia-puxar). Entrou ou saiu uma acao no Hoje.')
    sys.exit(1)
src = src.replace(RESTO_ANTIGO, RESTO_NOVO)

with open(APP, 'w', encoding='utf-8', newline='\n') as f:
    f.write(src)

depois = len(src.encode('utf-8'))
print(f'aplicado. {antes} -> {depois} bytes (+{depois - antes})')
print('conferir agora: node --check public/app.js && python ferramentas/harness.py')
