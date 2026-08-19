# -*- coding: utf-8 -*-
"""
patch_veredito.py - Fatia 1: a Fila deixa de ser lista e vira decisao.

19/08/2026. Frontend puro. Nenhuma escrita nova no banco: as tres colunas novas
(veredito, veredito_ordem, veredito_motivo) sao DERIVADAS na v_lead, e o app ja
lia a view inteira com select("*"), entao elas chegam sozinhas.

O que muda na tela:
  1. A fila ordena por VEREDITO, depois por dinheiro em jogo, depois por data.
     Ate hoje era data e desempate ALFABETICO por nome.
  2. O chip da linha para de dizer so quanto atrasou e passa a dizer o que fazer.
  3. Entra o MOTIVO embaixo da linha, em texto, vindo do banco.
  4. A aba Hoje ganha o contador de lead esperando o primeiro toque.

Degradacao proposital: lead SEM veredito (banco anterior a migration, ou fixture
do harness) cai no chip antigo e na ordem antiga. A tela nunca mostra chip vazio.

Rodar da raiz do repo:  python ferramentas/patch_veredito.py
"""
import io, os, sys

RAIZ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
JS   = os.path.join(RAIZ, 'public', 'app.js')
CSS  = os.path.join(RAIZ, 'public', 'app.css')

def ler(p):
    with io.open(p, encoding='utf-8') as f: return f.read()

def gravar(p, s):
    with io.open(p, 'w', encoding='utf-8', newline='') as f: f.write(s)

def troca(s, velho, novo, rotulo):
    n = s.count(velho)
    if n != 1:
        print('REPROVOU: "%s" apareceu %d vezes, esperado 1' % (rotulo, n)); sys.exit(1)
    print('  ok  %s' % rotulo)
    return s.replace(velho, novo)

js  = ler(JS)
css = ler(CSS)

# ---------------------------------------------------------------- 1. rotulos
# Default embutido: o dicionario_rotulos do banco sobrescreve na hora do login,
# mas antes disso o chip precisa ter palavra. Chave e o CODIGO (invariante 12).
js = troca(js,
    'nivel:{quente:"Quente",morno:"Morno",frio:"Frio"}',
    'nivel:{quente:"Quente",morno:"Morno",frio:"Frio"},'
    'veredito:{prioridade:"Prioridade",agora:"Agora",mande:"Mande",'
    'espere:"Espere",pare:"Pare",nao_mande:"N\u00e3o mande"}',
    'rotulos padrao do veredito')

# ------------------------------------------------------- 2. a nova ordenacao
CMP = (
 'function ordVer(a){var n=a&&a.veredito_ordem;return"number"==typeof n?n:4}'
 'function valVer(a){var n=Number(a&&a.valor_em_jogo);return isNaN(n)?0:n}'
 'function cmpVer(a,e){'
   'var t=ordVer(a),i=ordVer(e);if(t!==i)return t-i;'
   'var n=valVer(a),r=valVer(e);if(n!==r)return r-n;'
   'if(a.proximo_contato!==e.proximo_contato)return a.proximo_contato<e.proximo_contato?-1:1;'
   'return String(a.nome||"").localeCompare(String(e.nome||""))}'
)
SORT_VELHO = ('.sort(function(a,e){return a.proximo_contato!==e.proximo_contato?'
              'a.proximo_contato<e.proximo_contato?-1:1:'
              'String(a.nome||"").localeCompare(String(e.nome||""))})')

if js.count(SORT_VELHO) != 2:
    print('REPROVOU: o sort antigo apareceu %d vezes, esperado 2 (fila e pos-venda)'
          % js.count(SORT_VELHO)); sys.exit(1)
js = js.replace(SORT_VELHO, '.sort(cmpVer)')
print('  ok  fila e pos-venda passam a ordenar por veredito')

js = troca(js, 'function vPos(a,e){', CMP + 'function vPos(a,e){',
           'comparador cmpVer instalado')

# ------------------------------------------------- 3. o chip e o motivo
# Seis vereditos dividem CINCO familias de token semantico. O projeto ja mediu
# que matiz sozinho nao separa (quente x morno x frio ficam em 1.00-1.01 de
# luminancia entre si), e foi por isso que os 7 trilhos de categoria passaram a
# exigir icone. Mesma regra aqui: o icone carrega a distincao, nao e enfeite.
CHIP = (
 'var VD_ICO={'
   'prioridade:"M12 3l2.4 5.6 6.1.5-4.6 4 1.4 5.9L12 15.9 6.7 19l1.4-5.9-4.6-4 6.1-.5L12 3z",'
   'agora:"M13 2L4.5 13.5H11l-1 8.5 8.5-11.5H12l1-8.5z",'
   'mande:"M4 12h13m-5-6l6 6-6 6",'
   'espere:"M12 7v5l3.5 2M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0z",'
   'pare:"M9 3h6l6 6v6l-6 6H9l-6-6V9l6-6z",'
   'nao_mande:"M5 5l14 14M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0z"};'
 'function fxVerIco(a){var e=VD_ICO[a];return e?'
   '\'<svg class="vrd-ico" viewBox="0 0 24 24" aria-hidden="true"><path d="\'+e+'
   '\'" stroke-linecap="round" stroke-linejoin="round"></path></svg>\':""}'
 # Lead sem veredito cai no chip de sinal de antes: a tela degrada, nunca vaza vazio.
 'function fxVerChip(a,e){var o=a&&a.veredito;'
   'if(!o||"fora"===o){var t=fxSinal(a,e);return\'<span class="chip est \'+t[0]+\'">\'+c(t[1])+"</span>"}'
   'var i=s("veredito",o);'
   'if(("agora"===o||"mande"===o)&&e>0)i+=" \\u00b7 "+e+"d";'
   'return\'<span class="chip est vrd vrd-\'+c(o)+\'">\'+fxVerIco(o)+c(i)+"</span>"}'
 # O motivo vive na LINHA, nunca em tooltip: motivo escondido atras de hover nao
 # existe no celular, que e onde a fila e trabalhada.
 'function fxMotivo(a){var e=a&&a.veredito_motivo;'
   'return e?\'<div class="card-motivo">\'+c(e)+"</div>":""}'
)
js = troca(js, 'function fxFila(a,i){', CHIP + 'function fxFila(a,i){',
           'chip de veredito e linha de motivo instalados')

js = troca(js, 'function fxFila(a,i){var sn=fxSinal(a,i),tel=',
                'function fxFila(a,i){var tel=',
           'fxFila para de calcular o sinal duas vezes')
js = troca(js,
    '<div class="card-dir"><span class="chip est \'+sn[0]+\'">\'+c(sn[1])+"</span>"',
    '<div class="card-dir">\'+fxVerChip(a,i)',
    'o chip da linha passa a ser o veredito')
js = troca(js,
    '\'">Editar</button>\':"")+"</div></div>"}function fxCli(a){',
    '\'">Editar</button>\':"")+"</div></div>"+fxMotivo(a)}function fxCli(a){',
    'o motivo entra embaixo da linha')

# ------------------------------------------------------------ 4. export
js = troca(js, 'entraNaFila:m,montarFila:v,',
               'entraNaFila:m,montarFila:v,ordenarFila:cmpVer,vereditoChip:fxVerChip,',
           'comparador e chip expostos para a suite')

# --------------------------------- 5. o relogio do primeiro toque na Hoje
# Furo medido em 19/08/2026: mediana de 118h ate o primeiro toque e NENHUM lead
# tocado em menos de 24h, contra um benchmark de 5 minutos. O dado
# (horas_esperando_1o_toque) ja era calculado na v_lead desde sempre e NENHUMA
# tela lia. Sem este contador, lead novo so aparece na fila do dia seguinte.
ESPERA = (
'function hjEspera(h){var n=Number(h)||0;return n<48?Math.round(n)+"h":Math.round(n/24)+"d"}\n'
'function hojePendencias(d){')
js = troca(js, 'function hojePendencias(d){', ESPERA, 'formatador de espera')

ALVO = ('if(atrasados)linhas+=hjPendLin("fila","lead"+(1===atrasados?"":"s")+'
        '" com contato atrasado",atrasados,"abaFila",!0);\n')
NOVO = ALVO + (
'var esp=0,pior=0,he;\n'
'for(k=0;k<ativos.length;k++){\n'
'he=ativos[k].horas_esperando_1o_toque;\n'
'if("pendente"!==ativos[k].status||null==he)continue;\n'
'esp++;if(Number(he)>pior)pior=Number(he)}\n'
'if(esp)linhas+=hjPendLin("espera","sem 1\\u00ba toque \\u00b7 o mais antigo h\\u00e1 "'
'+hjEspera(pior),esp,"abaFila",pior>=24);\n')
js = troca(js, ALVO, NOVO, 'contador de lead esperando o primeiro toque')

# ------------------------------------------------ 7. a legenda da Fila
# A legenda ensinava "Em andamento / Urgente / Pendente", que sao os chips que
# acabaram de sair da linha. Legenda que explica chip inexistente e pior que
# legenda nenhuma: ela ensina o vocabulario errado. Aqui ela passa a ensinar os
# seis vereditos, COM O ICONE de cada um, porque o icone e justamente a parte
# que o operador precisa aprender a ler (espere e pare dividem a mesma cor).
HTML = os.path.join(RAIZ, 'public', 'index.html')
html = ler(HTML)

def leg(cod, rot, d):
    return ('        <span class="chip est vrd vrd-' + cod + '">'
            '<svg class="vrd-ico" viewBox="0 0 24 24" aria-hidden="true">'
            '<path d="' + d + '" stroke-linecap="round" stroke-linejoin="round"></path>'
            '</svg>' + rot + '</span>\n')

LEG_VELHA = ('        <span class="chip est sn-andamento">Em andamento</span>\n'
             '        <span class="chip est sn-urgente">Urgente</span>\n'
             '        <span class="chip est sn-pendente">Pendente</span>\n')
LEG_NOVA = (
    leg('prioridade', 'Prioridade',
        'M12 3l2.4 5.6 6.1.5-4.6 4 1.4 5.9L12 15.9 6.7 19l1.4-5.9-4.6-4 6.1-.5L12 3z') +
    leg('agora', 'Agora', 'M13 2L4.5 13.5H11l-1 8.5 8.5-11.5H12l1-8.5z') +
    leg('mande', 'Mande', 'M4 12h13m-5-6l6 6-6 6') +
    leg('espere', 'Espere', 'M12 7v5l3.5 2M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0z') +
    leg('pare', 'Pare', 'M9 3h6l6 6v6l-6 6H9l-6-6V9l6-6z') +
    leg('nao_mande', u'Não mande',
        'M5 5l14 14M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0z'))
html = troca(html, LEG_VELHA, LEG_NOVA, 'legenda da Fila passa a ensinar o veredito')

# ---------------------------------------------------------------- 6. CSS
CSS_NOVO = u"""
/* ==========================================================================
   O VEREDITO — o chip da linha para de dizer QUANTO atrasou e passa a dizer
   O QUE FAZER (v65, 19/08/2026).

   Seis vereditos dividem CINCO familias de token semantico, e este projeto ja
   mediu que matiz sozinho NAO separa: quente x morno x frio ficam entre 1.00 e
   1.01 de luminancia entre si. Foi essa medicao que obrigou icone nos 7 trilhos
   de categoria, e vale igual aqui. `espere` e `pare` chegam a dividir a MESMA
   familia (frio): ali a distincao e o icone MAIS a borda tracejada, que le como
   "fora do fluxo" sem depender de cor nenhuma.

   PREFIXO `vrd-`, e nao `vd-`: `.vd` JA EXISTE desde a v61 (o bloco de Detalhes
   da venda, que nasce display:none ate abrir). A primeira versao deste bloco usou
   `vd` e o chip sumiu da tela inteira, com a suite VERDE: as assercoes mediam cor
   com getComputedStyle, e getComputedStyle devolve a cor certa mesmo de um
   elemento display:none. Por isso ha agora uma assercao de VISIBILIDADE, nao so
   de cor.

   Nenhum token novo (regra 11.2), nenhum hex no JS (11.3) e nenhum uso novo de
   var(--accent) (11.1): decisao nao e navegacao, entao veredito nunca veste a
   cor da marca.
   ========================================================================== */
.chip.est.vrd{gap:5px}
/* o ponto de 5.5px sai: quem carrega a forma agora e o icone */
.chip.est.vrd::before{display:none}
.vrd-ico{width:11px;height:11px;flex:0 0 auto;stroke:currentColor;fill:none;stroke-width:1.9}
.vrd-prioridade{color:var(--ok-fg);background:var(--ok-bg);border-color:var(--ok-linha)}
.vrd-agora{
  color:var(--quente-fg);background:var(--quente-bg);border-color:var(--quente-linha);
  font-variant-numeric:tabular-nums;
}
.vrd-mande{
  color:var(--morno-fg);background:var(--morno-bg);border-color:var(--morno-linha);
  font-variant-numeric:tabular-nums;
}
.vrd-espere{color:var(--frio-fg);background:var(--frio-bg);border-color:var(--frio-linha)}
.vrd-pare{
  color:var(--frio-fg);background:var(--frio-bg);border-color:var(--frio-linha);
  border-style:dashed;
}
.vrd-nao_mande{color:var(--erro-fg);background:var(--erro-bg);border-color:var(--erro-linha)}

/* O MOTIVO e o que separa "faca 13 coisas" de "faca esta primeiro, e por isso".
   Vive na linha, nunca em tooltip: motivo escondido atras de hover simplesmente
   nao existe no celular, que e onde a fila e trabalhada de verdade.
   O recuo de 40px alinha o texto sob o NOME (28px de avatar + 12px de gap), nao
   sob a borda do cartao: assim ele le como continuacao da linha. */
.card-motivo{
  margin-top:8px;padding-left:40px;
  font-size:12.5px;line-height:1.5;color:var(--dim);
}
@media (max-width:560px){
  /* a 360px o avatar ja nao segura recuo: o motivo volta pra margem do cartao */
  .card-motivo{padding-left:0;margin-top:10px}
}
"""
if '.vrd-prioridade' in css:
    print('REPROVOU: o bloco do veredito ja estava no CSS'); sys.exit(1)
css = css.rstrip('\n') + '\n' + CSS_NOVO
print('  ok  bloco do veredito no CSS')

gravar(JS, js)
gravar(CSS, css)
gravar(HTML, html)
print('\nAplicado. Rodar agora:')
print('  node --check public/app.js')
print('  python ferramentas/validar.py')
print('  python ferramentas/harness.py')
