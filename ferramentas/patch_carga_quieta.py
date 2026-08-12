# -*- coding: utf-8 -*-
r"""
Fim da recarga a cada clique: carga quieta + troca cirurgica do card.

Pedido do dono em 11/08/2026: "corrija o carregamento acionado toda vez que
alguma funcao e clicada".

O QUE ACONTECIA (medido nesta maquina, Chrome headless, fila de 25 leads):
clique em `Toque enviado` = 20 chamadas de rede (17 `sugerir_mensagem` + a RPC
do toque + `dicionario_rotulos` + `v_lead`), a lista piscava com
`<div class="estado carregando">Lendo a base…</div>`, e os 24 cards eram
recriados do zero: 0 de 24 sobreviviam, e o Historico que o operador tinha
deixado aberto fechava.

A causa: `q()` chamava `B()` (carga completa) no sucesso de QUALQUER acao, e
`B()` apagava `#lista` antes de buscar, relia `dicionario_rotulos` (config que
nao muda na sessao) e terminava em `k()`, que na Fila dispara
`prefetchFilaSug(24)` depois de zerar o cache `filaSug`.

O QUE ESTE PATCH FAZ (camadas 1, 2 e 4 do plano, mais o cirurgico da Fila):

  1. `B(sil)`: com `sil` verdadeiro nao apaga a lista. A troca so acontece com o
     dado na mao. O spinner continua no lugar certo: primeira carga, troca de
     aba e o botao Atualizar.
  2. `dicionario_rotulos` carrega UMA vez por sessao (guarda `dicOk`). Atualizar
     e o login limpam a guarda: e o botao que existe para forcar releitura.
  3. O bloco anonimo que recalcula o pitboard vira a funcao nomeada `pb()`, para
     o caminho cirurgico atualizar os contadores sem tocar na rede.
  4. `q()` deixa de chamar `B()` e passa a chamar `aposAcao(op)`, que decide:
     acao de lead com card na mao -> `trocarCard`; outra aba -> re-render
     silencioso SO daquela aba (nunca mais baixar `v_lead` para uma tela que nao
     mostra lead); resto -> `B(!0)`.
  5. `trocarCard(id, card)`: rele UM lead (`.eq("id", id)`), atualiza o array
     local pelo Lead ID (invariante 5), recalcula o pitboard e troca SO aquele
     card, pelo mesmo `x()` que a lista usa. Se o lead saiu da fila, o card sai;
     se a fila esvaziou, `k()` pinta o estado vazio de verdade.
  6. `prefetchFilaSug` para de zerar `filaSug` e busca so o que falta. O lead
     tocado tem a entrada INVALIDADA antes de repintar: depois de um toque a
     cadencia andou, entao sugestao em cache estaria errada, e sugestao velha e
     pior que sugestao ausente (invariante 13).

POR QUE `trocarCard` REMOVE O CARD NA MAIORIA DOS CASOS: `registrar_toque` grava
`ultimo_toque_em = now()` (pg_get_functiondef, conferido no banco em
11/08/2026), e `entraNaFila` exige `dataLocalDe(ultimo_toque_em) !== hoje`. O
toque tira o lead da fila do dia. `registrar_resposta` nao mexe em nada disso:
esse card fica, e e trocado no lugar. Os dois caminhos existem de verdade.

ARMADILHA FECHADA AQUI: `Y("btnAtualizar","click",B)` passava o objeto Event
como primeiro argumento. Com `B(sil)`, o Event (truthy) faria o botao Atualizar
virar silencioso. Por isso o listener vira uma funcao explicita, que ainda
aproveita para limpar a guarda do dicionario.

O que NAO muda: nenhum `data-acao`, nenhum HTML de card (o cirurgico usa o mesmo
`x()`), nenhuma regra de LGPD (o link continua saindo de `filaWaCard`, que so
devolve href com `consentimento === true`), e nada de banco.

Idempotente: rodar duas vezes nao duplica.
Grava com newline='\n': `Path.write_text()` no Windows converte para CRLF, e foi
isso que quase mandou 5.313 linhas de ruido para o repo na v50.
"""
import sys, pathlib

APP = pathlib.Path(__file__).resolve().parent.parent / 'public' / 'app.js'

MARCA = 'function aposAcao('

src = APP.read_text(encoding='utf-8')
antes = len(src.encode('utf-8'))

if MARCA in src:
    print('ja aplicado, nada a fazer')
    sys.exit(0)

# --------------------------------------------------------------------------
# 1) B(sil): nao apaga a lista quando silencioso, e le o dicionario uma vez so
# --------------------------------------------------------------------------
B_ANTIGO = (
    'async function B(){E("lista").innerHTML=\'<div class="estado carregando">Lendo a base…</div>\';'
    'var a=await t.from("dicionario_rotulos").select("dominio,codigo,rotulo");!a.error&&a.data&&d(a.data);'
    'var e=await t.from("v_lead")'
)
B_NOVO = (
    'var dicOk=!1;'
    'async function B(sil){if(!sil)E("lista").innerHTML=\'<div class="estado carregando">Lendo a base…</div>\';'
    'if(!dicOk){var a=await t.from("dicionario_rotulos").select("dominio,codigo,rotulo");'
    '!a.error&&a.data&&(d(a.data),dicOk=!0)}'
    'var e=await t.from("v_lead")'
)

# --------------------------------------------------------------------------
# 2) o pitboard vira funcao nomeada. O corpo e RECORTADO do proprio arquivo,
#    nao redigitado: retipar 500 chars de minificado e como se perde um
#    `nullsFirst` sem ninguem ver.
# --------------------------------------------------------------------------
PB_INI = ',function(a){var e=i.filter(function(a){return!a.arquivado_em}),o=v(e,a),t=o.filter(function(e){return p(e.proximo_contato,a)>0})'
PB_FIM = 'E("pbTotal").textContent=String(e.length)}(l()),k()}}'

# --------------------------------------------------------------------------
# 3) q() -> aposAcao(), e o trio de funcoes novas
# --------------------------------------------------------------------------
Q_ANTIGO = ('async function q(a,e,o,t){var i=await O(a,e,o);'
            'i&&(!1!==i.ok?(I(t||i.msg||"Feito"),B()):I(i.msg||"Operacao recusada",!0))}')
Q_NOVO = (
    'async function q(a,e,o,t,op){var i=await O(a,e,o);'
    'i&&(!1!==i.ok?(I(t||i.msg||"Feito"),aposAcao(op)):I(i.msg||"Operacao recusada",!0))}'
    # abaDeLead: as tres abas que pintam card de lead pelo array local `i`
    'function abaDeLead(){return"fila"===n||"todos"===n||"indicacoes"===n}'
    # reRenderAba: o que so o servidor sabe se rele, mas EM SILENCIO e so na aba
    # corrente. Antes, agir no Escopo baixava a base de leads inteira e apagava
    # a lista duas vezes.
    'function reRenderAba(sil){var e=E("lista");'
    'if("hoje"===n)return renderHoje(sil);'
    'if("conteudo"===n)return renderConteudo(sil);'
    'if("rotina"===n)return renderRotina(sil);'
    'if("escopo"===n)return renderEscopo(sil);'
    'if("captacao"===n)return renderCaptacao(sil);'
    'if("dashboard"===n)return renderDash(sil);'
    'if("vendas"===n)return renderVendas(e,sil);'
    'if("nfs"===n)return renderNfs(e,sil);'
    'if("clientes"===n)return renderClientes(e,sil);'
    'return B(!0)}'
    'function aposAcao(op){'
    'if(op&&op.amplo)return B(!0);'
    'if(op&&op.lead&&op.card&&abaDeLead())return trocarCard(op.lead,op.card);'
    'if(abaDeLead())return B(!0);'
    'return reRenderAba(!0)}'
    # trocarCard: UMA linha de v_lead, nao a base.
    'async function trocarCard(id,card){'
    'if(filaSug)delete filaSug[id];'
    'var r=await t.from("v_lead").select("*").eq("id",id);'
    'if(r.error){if(await pwSemSessao())return pwSessaoCaiu();return void I("Falha ao reler o lead: "+r.error.message,!0)}'
    'var novo=r.data&&r.data[0]||null,hj=l(),j;'
    'for(j=0;j<i.length;j++)if(i[j].id===id){novo?i[j]=novo:i.splice(j,1);break}'
    'pb(hj);'
    'if(!novo||novo.arquivado_em||("fila"===n&&!m(novo,hj))){'
    'var pai=card.parentNode;if(pai)pai.removeChild(card);'
    'if(pai&&!pai.querySelector(".card"))k();return}'
    'card.outerHTML=x(novo,n,hj);'
    'if("fila"===n)prefetchFilaSug(24).then(filaWaAtualizar)}'
)

# --------------------------------------------------------------------------
# 4) o cache de sugestao sobrevive ao render
# --------------------------------------------------------------------------
PF_ANTIGO = 'async function prefetchFilaSug(lim){filaSug={};var ativos='
PF_NOVO = 'async function prefetchFilaSug(lim){if(!filaSug)filaSug={};var ativos='
PFM_ANTIGO = 'top.map(async function(a){if(!a||!0!==a.consentimento)return;'
PFM_NOVO = 'top.map(async function(a){if(!a||!0!==a.consentimento)return;if(filaSug[a.id])return;'

# --------------------------------------------------------------------------
# 5) os dois renders minificados ganham o modo silencioso que renderConteudo ja
#    tinha desde o kanban
# --------------------------------------------------------------------------
RH_ANTIGO = ('async function renderHoje(){var e=E("lista");'
             'e.innerHTML=\'<div class="estado carregando">Lendo o dia…</div>\';')
RH_NOVO = ('async function renderHoje(sil){var e=E("lista");'
           'if(!sil)e.innerHTML=\'<div class="estado carregando">Lendo o dia…</div>\';')
RC_ANTIGO = ('async function renderCaptacao(){var e=E("lista");'
             'e.innerHTML=\'<div class="estado carregando">Lendo a captação...</div>\';')
RC_NOVO = ('async function renderCaptacao(sil){var e=E("lista");'
           'if(!sil)e.innerHTML=\'<div class="estado carregando">Lendo a captação...</div>\';')

# --------------------------------------------------------------------------
# 6) o Event do clique nao pode virar o argumento `sil`
# --------------------------------------------------------------------------
BT_ANTIGO = 'Y("btnAtualizar","click",B)'
BT_NOVO = 'Y("btnAtualizar","click",function(){dicOk=!1,B()})'

# --------------------------------------------------------------------------
# 7) as acoes de lead passam o card que ja esta na mao do handler (`n`)
# --------------------------------------------------------------------------
ACOES = [
    ('q("registrar_resposta",{p_lead_id:t},e,"Resposta registrada")',
     'q("registrar_resposta",{p_lead_id:t},e,"Resposta registrada",{lead:t,card:n})'),
    ('q("registrar_desfecho",{p_lead_id:t,p_tipo:"sem_interesse"},e,"Marcado sem interesse")',
     'q("registrar_desfecho",{p_lead_id:t,p_tipo:"sem_interesse"},e,"Marcado sem interesse",{lead:t,card:n})'),
    ('q("registrar_conversando",{p_lead_id:t},e,"Conversa registrada")',
     'q("registrar_conversando",{p_lead_id:t},e,"Conversa registrada",{lead:t,card:n})'),
    ('q("registrar_toque",{p_lead_id:t},e,"Toque registrado")',
     'q("registrar_toque",{p_lead_id:t},e,"Toque registrado",{lead:t,card:n})'),
    ('q("reagendar_proximo_contato",{p_lead_id:t,p_data:c},e,"Reagendado")',
     'q("reagendar_proximo_contato",{p_lead_id:t,p_data:c},e,"Reagendado",{lead:t,card:n})'),
]

# --------------------------------------------------------------------------
# 8) as cargas amplas viram silenciosas. Login e boot ficam com spinner: la a
#    tela esta vazia mesmo, e o spinner e a resposta certa.
#
#    `n="vendas";B()` aparece CINCO vezes, nao uma: salvar entrega, despachar
#    para o motoboy, corrigir venda, arquivar e desarquivar. Sao todas o mesmo
#    caso (mexeu em venda, a base inteira pode ter mudado), entao aqui a
#    substituicao e de todas as ocorrencias, com o numero conferido.
# --------------------------------------------------------------------------
AMPLAS = [
    ('I(i.msg||"Lead cadastrado"),M(),B()', 'I(i.msg||"Lead cadastrado"),M(),B(!0)'),
    ('I(r.msg||"Lead atualizado"),R(),B()', 'I(r.msg||"Lead atualizado"),R(),B(!0)'),
    ('I(e.msg||"Lead arquivado"),R(),B()', 'I(e.msg||"Lead arquivado"),R(),B(!0)'),
]
VENDA_ANTIGO, VENDA_NOVO, VENDA_N = 'n="vendas";B()', 'n="vendas";B(!0)', 5

# --------------------------------------------------------------------------
# 9) troca de aba revalida em silencio (decisao do dono: o frescor do resto
#    chega aqui, nao a cada clique). k() pinta primeiro, do cache, para a aba
#    nao ficar esperando a rede para aparecer.
# --------------------------------------------------------------------------
G_ANTIGO = 'n=x;k()}'
G_NOVO = 'n=x;k(),("fila"===x||"todos"===x||"indicacoes"===x)&&B(!0)}'

pares = ([(B_ANTIGO, B_NOVO), (Q_ANTIGO, Q_NOVO), (PF_ANTIGO, PF_NOVO),
          (PFM_ANTIGO, PFM_NOVO), (RH_ANTIGO, RH_NOVO), (RC_ANTIGO, RC_NOVO),
          (BT_ANTIGO, BT_NOVO), (G_ANTIGO, G_NOVO)] + ACOES + AMPLAS)

for velho, _ in pares + [(PB_INI, None), (PB_FIM, None)]:
    n = src.count(velho)
    if n != 1:
        print(f'ABORTA: ancora aparece {n} vezes, esperava 1:\n  {velho[:90]}...')
        sys.exit(1)

if src.count(VENDA_ANTIGO) != VENDA_N:
    print(f'ABORTA: `{VENDA_ANTIGO}` aparece {src.count(VENDA_ANTIGO)} vezes, esperava {VENDA_N}. '
          f'Entrou ou saiu um caminho de venda; conferir antes de forcar.')
    sys.exit(1)

# o recorte do pitboard, feito sobre o texto real
ini = src.index(PB_INI)
fim = src.index(PB_FIM) + len(PB_FIM)
trecho = src[ini:fim]
corpo = trecho[len(',function(a){'):-len('}(l()),k()}}')]
src = src[:ini] + ',pb(l()),k()}}function pb(a){a=a||l();' + corpo + '}' + src[fim:]

for velho, novo in pares:
    src = src.replace(velho, novo, 1)
src = src.replace(VENDA_ANTIGO, VENDA_NOVO)   # as cinco

with open(APP, 'w', encoding='utf-8', newline='\n') as f:
    f.write(src)

depois = len(src.encode('utf-8'))
print(f'aplicado. {antes} -> {depois} bytes (+{depois - antes})')
print('conferir agora: node --check public/app.js && python ferramentas/harness.py')
