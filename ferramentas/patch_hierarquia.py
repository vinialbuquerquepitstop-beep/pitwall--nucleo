# Reorganizacao da hierarquia do frontend: Conteudo (kanban com data),
# Rotina (grade de 7 colunas) e Hoje (reordenado), mais o sistema trilho x sinal.
#
# Patch cirurgico no app.js (minificado, uma linha so). Espelha patch_historico.py:
# cada troca e ancorada em texto exato e falha alto se a ancora nao bater ou nao
# for unica. As funcoes novas entram LEGIVEIS no fim do arquivo.
# Roda da raiz: python ferramentas/patch_hierarquia.py
import sys, pathlib
sys.stdout.reconfigure(encoding='utf-8')

RAIZ = pathlib.Path(__file__).resolve().parent.parent
ALVO = RAIZ / 'public' / 'app.js'
src = ALVO.read_text(encoding='utf-8')
orig = src

def troca(velho, novo, rotulo):
    global src
    n = src.count(velho)
    if n != 1:
        print('  FALHOU [%s]: ancora aparece %dx, esperava 1x' % (rotulo, n))
        sys.exit(1)
    src = src.replace(velho, novo, 1)
    print('  ok [%s]' % rotulo)

def exige_ausente(marca, rotulo):
    if marca in src:
        print('  FALHOU [%s]: patch ja aplicado (achei "%s")' % (rotulo, marca))
        sys.exit(1)

exige_ausente('function trilhoDe', 'idempotencia')

# ------------------------------------------------- helpers do sistema trilho x sinal
HELPERS = r'''
var TRILHO_MAPA={fila_follow_up:"--tr-fila-follow-up",captacao:"--tr-captacao",conteudo:"--tr-conteudo",loja_estoque:"--tr-loja-estoque",pos_venda:"--tr-pos-venda",analise:"--tr-analise",fechamento:"--tr-fechamento"};
var TRILHO_ANEL=["--tr-fila-follow-up","--tr-captacao","--tr-conteudo","--tr-loja-estoque","--tr-pos-venda","--tr-analise","--tr-fechamento"];
// Categoria nova entra pelo anel, por hash do CODIGO (invariante 12: nunca o rotulo).
// Deterministico: a mesma categoria recebe a mesma cor em toda sessao.
function trilhoDe(cod){
var k=String(cod||"");
if(TRILHO_MAPA[k])return"var("+TRILHO_MAPA[k]+")";
var h=0,i=0;for(;i<k.length;i++)h=(h*31+k.charCodeAt(i))>>>0;
return"var("+TRILHO_ANEL[h%7]+")"}
var ICONE_MAPA={
fila_follow_up:'<path d="M4 7h10M4 12h16M4 17h7" stroke-linecap="round"/>',
captacao:'<circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="3.2"/>',
conteudo:'<rect x="4" y="5" width="16" height="15" rx="2"/><path d="M4 10h16" stroke-linecap="round"/>',
loja_estoque:'<path d="M4 8h16l-1 12H5L4 8z"/><path d="M9 8V6a3 3 0 0 1 6 0v2" stroke-linecap="round"/>',
pos_venda:'<path d="M12 21s-7-4.5-7-9.5A4 4 0 0 1 12 8a4 4 0 0 1 7 3.5c0 5-7 9.5-7 9.5z" stroke-linejoin="round"/>',
analise:'<path d="M5 19V11M12 19V5M19 19v-6" stroke-linecap="round"/>',
fechamento:'<circle cx="12" cy="12" r="8"/><path d="M12 8v4l3 2" stroke-linecap="round"/>'};
// O icone NAO e enfeite: as colisoes de luminancia entre trilho e cor semantica
// ficam entre 1.14 e 1.44, entao matiz sozinho nao distingue. Trilho sem icone
// e regressao.
function iconeCat(cod){
return'<svg class="tr-ico" viewBox="0 0 24 24" aria-hidden="true">'+(ICONE_MAPA[String(cod||"")]||'<circle cx="12" cy="12" r="7"/>')+"</svg>"}
// Nivel DERIVADO na leitura (invariante 4), nunca coluna no banco.
// Usa l() (hoje no fuso do Brasil), nunca new Date() cru (invariante 10).
function nivelPeca(dt,st){
if("publicado"===st)return"ok";
if("descartado"===st)return"nulo";
var h=new Date(l()+"T12:00:00"),d=new Date(String(dt||"")+"T12:00:00");
if(isNaN(d.getTime()))return"nulo";
var dd=Math.round((d-h)/864e5);
if(dd<0)return"vencido";
if(0===dd)return"quente";
if(dd<=6)return"morno";
return"frio"}
// dias_semana null ou vazio = TODOS os dias (o proprio formulario diz isso).
function cargaSemana(cats){
var n=[0,0,0,0,0,0,0,0];
(cats||[]).forEach(function(ct){(ct.tarefas||[]).forEach(function(t){
var ds=t.dias_semana&&t.dias_semana.length?t.dias_semana:[1,2,3,4,5,6,7];
ds.forEach(function(d){d>=1&&d<=7&&n[d]++})})});
return n}
function tarefasDoDia(cats,iso){
var out=[];
(cats||[]).forEach(function(ct){(ct.tarefas||[]).forEach(function(t){
var ds=t.dias_semana&&t.dias_semana.length?t.dias_semana:[1,2,3,4,5,6,7];
ds.indexOf(iso)>=0&&out.push({cat:ct,tarefa:t})})});
return out}
'''

# As funcoes entram DENTRO do IIFE (var PitWall=function(){...}()), nao depois
# dele. Ancora original do brief ('window.__PITWALL_SEM_INIT||') fica FORA do
# IIFE, em contexto de EXPRESSAO (lado direito do operador virgula que fecha o
# arquivo inteiro num unico ExpressionStatement de topo — confirmado via
# esprima: ast.body tem exatamente 1 elemento). Inserir var/function ali quebra
# a sintaxe (esprima: "Unexpected token var") porque declaracao nao e expressao.
# 'var scriptsData={};' e a mesma ancora que patch_historico.py usou: fica
# DENTRO do corpo do IIFE, em contexto de statement valido, e e unica no
# arquivo. Preserva o invariante que validar.py cobra (secao 1): contagem de
# statements de TOPO tem que continuar igual a antes (1), porque tudo que
# entra aqui fica aninhado dentro da mesma funcao, nao pendurado no topo.
troca(
    'var scriptsData={};',
    HELPERS + 'var scriptsData={};',
    'helpers trilho x sinal'
)

def troca_funcao(nome, novo_corpo, rotulo):
    """Substitui uma funcao inteira, de 'async function NOME(' ate a chave que fecha.
    Falha alto se o nome nao aparecer exatamente 1x.

    ARMADILHA: conta chaves cegamente, entao quebra se houver '{' ou '}' dentro de
    uma string literal do corpo. As funcoes trocadas aqui tem varias strings HTML e
    NENHUMA contem chave (conferido). Se um dia passarem a conter, este helper para
    de servir e a troca tem que voltar a ser por ancora de texto exato."""
    global src
    marca = 'async function %s(' % nome
    n = src.count(marca)
    if n != 1:
        print('  FALHOU [%s]: "%s" aparece %dx, esperava 1x' % (rotulo, marca, n))
        sys.exit(1)
    i = src.index(marca)
    j = src.index('{', i)
    d, k = 0, j
    while k < len(src):
        if src[k] == '{': d += 1
        elif src[k] == '}':
            d -= 1
            if d == 0: break
        k += 1
    if d != 0:
        print('  FALHOU [%s]: chaves desbalanceadas' % rotulo); sys.exit(1)
    src = src[:i] + novo_corpo.strip() + src[k+1:]
    print('  ok [%s] (%d bytes trocados)' % (rotulo, k + 1 - i))

# ------------------------------------------------------- Rotina: grade de 7 colunas
ROTINA = r'''
function rotCargaBarra(n){
var mx=Math.max.apply(null,n.slice(1,8))||1,i=1,out="";
for(;i<=7;i++){
var alt=Math.round(100*n[i]/mx);
out+='<div class="rot-carga-cel"><div class="rot-carga-num">'+n[i]+'</div><div class="rot-carga-tubo"><div class="rot-carga-fita" style="height:'+alt+'%"></div></div><div class="rot-carga-dia">'+DIAS_ISO[i]+"</div></div>"}
return'<div class="rot-carga" aria-label="Carga de tarefas por dia da semana">'+out+"</div>"}
// O botao remove a tarefa do MOLDE INTEIRO, nao daquele dia. Numa grade por dia
// o rotulo "remover" leria como "tirar da segunda", que seria mentira: a mesma
// tarefa aparece em varias colunas e some de todas. Por isso o rotulo e explicito.
function rotCelula(par,pode){
var t=par.tarefa,ct=par.cat;
return'<div class="rot-cel" style="--tr:'+trilhoDe(ct.codigo)+'">'+iconeCat(ct.codigo)+'<span class="rot-cel-cat">'+c(ct.rotulo||ct.codigo)+'</span>'+(pode?'<button class="rot-rm" data-acao="rot-rm-tarefa" data-id="'+c(t.id)+'" title="Remover do molde (some de todos os dias)" aria-label="Remover do molde">×</button>':"")+'<span class="rot-cel-tit">'+c(t.titulo||"")+"</span></div>"}
// A grade so mostra categoria que TEM tarefa. Sem esta legenda, criar uma
// categoria nova nao produz nenhum sinal na tela e parece que falhou. Ela
// tambem e onde o dono aprende o que cada cor de trilho significa.
function rotLegenda(cats){
var itens=(cats||[]).map(function(ct){
var n=(ct.tarefas||[]).length;
return'<span class="rot-leg-item" style="--tr:'+trilhoDe(ct.codigo)+'">'+iconeCat(ct.codigo)+c(ct.rotulo||ct.codigo)+'<span class="rot-leg-n">'+n+"</span></span>"}).join("");
return itens?'<div class="rot-leg">'+itens+"</div>":""}
function rotGrade(cats,pode){
var hj=new Date(l()+"T12:00:00").getDay();
hj=0===hj?7:hj;
var i=1,out="";
for(;i<=7;i++){
var itens=tarefasDoDia(cats,i);
out+='<div class="rot-col'+(i===hj?" hoje":"")+'" data-dia="'+i+'"><div class="rot-col-cab">'+DIAS_ISO[i]+'<span class="rot-col-n">'+itens.length+"</span></div>"+(itens.length?itens.map(function(p){return rotCelula(p,pode)}).join(""):'<div class="rot-col-vazio">livre</div>')+"</div>"}
return'<div class="rot-grade">'+out+"</div>"}
'''
# ATENCAO: ancorar em 'async function renderRotina(' e nao em 'function renderRotina(',
# senao o bloco entra ENTRE o 'async' e o 'function' e quebra a declaracao.
troca('async function renderRotina(', ROTINA + 'async function renderRotina(', 'funcoes da grade da Rotina')

ROTINA_RENDER = r'''
async function renderRotina(){
var e=E("lista");
e.innerHTML='<div class="estado">Lendo o molde…</div>';
var r=await t.rpc("rotina_completa",{});
if(r.error)return void(e.innerHTML='<div class="estado erro">Falha ao ler a rotina: '+c(r.error.message)+". Toque em Atualizar para tentar de novo.</div>");
var d=r.data;
if(!d||!1===d.ok)return void(e.innerHTML='<div class="estado erro">'+c(d&&d.msg||"Falha ao ler a rotina.")+"</div>");
var pode=!0===d.pode_editar,cats=d.categorias||[],corpo,forms="";
corpo=cats.length?rotCargaBarra(cargaSemana(cats))+rotLegenda(cats)+rotGrade(cats,pode):'<div class="estado"><strong>O molde está vazio.</strong>'+(pode?"Crie a primeira categoria abaixo. As tarefas do molde viram o checklist da aba Hoje, todo dia.":"O dono ainda não digitou o molde da rotina.")+"</div>";
if(pode){
var ops=cats.map(function(x){return'<option value="'+c(x.codigo)+'">'+c(x.rotulo)+"</option>"}).join(""),
togs=[1,2,3,4,5,6,7].map(function(i){return'<button class="rot-dia-tog" data-acao="rot-dia" data-dia="'+i+'" aria-pressed="false">'+DIAS_ISO[i]+"</button>"}).join("");
forms='<div class="dia-sec">'+(cats.length?'<div class="dia-sec-tit">Nova tarefa no molde</div><div class="rot-form"><div class="rot-form-lin"><input id="rotNovoTit" placeholder="Título da tarefa…" autocomplete="off"><select id="rotNovaCat" aria-label="Categoria">'+ops+'</select></div><div class="rot-form-lin">'+togs+'<span class="rot-dica">nenhum dia marcado = todo dia</span></div><div class="rot-form-lin"><button class="btn-acao" data-acao="rot-add-tarefa">Adicionar tarefa</button></div></div>':"")+'<div class="rot-form"><div class="dia-sec-tit">Nova categoria</div><div class="rot-form-lin"><input id="rotNovaCatRot" placeholder="Nome da categoria (ex: Atendimento e Vendas)" autocomplete="off"><button class="btn-acao" data-acao="rot-add-cat">Criar categoria</button></div></div></div>'}
e.innerHTML=corpo+forms}
'''
troca_funcao('renderRotina', ROTINA_RENDER, 'renderRotina vira carga + grade')

# ------------------------------------------------------------------ gravar
if src == orig:
    print('  FALHOU: nada mudou'); sys.exit(1)
ALVO.write_text(src, encoding='utf-8')
print('patch_hierarquia: aplicado, %d -> %d bytes' % (len(orig), len(src)))
