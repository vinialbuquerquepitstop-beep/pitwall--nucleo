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

# ------------------------------------------------------------------ gravar
if src == orig:
    print('  FALHOU: nada mudou'); sys.exit(1)
ALVO.write_text(src, encoding='utf-8')
print('patch_hierarquia: aplicado, %d -> %d bytes' % (len(orig), len(src)))
