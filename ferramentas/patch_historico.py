# Fase 4: liga o front ao historico que o banco JA oferece.
# Nada de SQL: historico_lead() e registrar_nota() ja existem, security invoker,
# com EXECUTE para authenticated. O front simplesmente nao as chamava.
#
# Patch cirurgico no app.js (minificado, uma linha so). Cada troca e ancorada em
# texto exato e falha alto se a ancora nao bater ou nao for unica.
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
        print(f'  FALHOU [{rotulo}]: ancora aparece {n}x, esperava 1x')
        sys.exit(1)
    src = src.replace(velho, novo, 1)
    print(f'  ok [{rotulo}]')

# ---------------------------------------------------------------- 1. botao no card
# .card-acoes e flex com flex:1 nos filhos -> divide a linha com a acao primaria.
troca(
    '\'<div class="card-acoes">\'+r+"</div>"',
    '\'<div class="card-acoes">\'+r+(a.id?\'<button class="btn-acao" data-acao="historico" data-id="\'+c(a.id)+\'">Histórico</button>\':"")+"</div>"',
    'botao Historico em .card-acoes'
)

# ---------------------------------------------------------------- 2. painel vazio no card
# Irmao de [data-scripts]. Nasce VAZIO e fechado: sem clique, nada e buscado nem pintado.
troca(
    '("fila"===e&&a.id?\'<div class="scripts" data-scripts></div>\':"")',
    '("fila"===e&&a.id?\'<div class="scripts" data-scripts></div>\':"")+(a.id?\'<div class="hist" data-hist></div>\':"")',
    'painel [data-hist] no card'
)

# ---------------------------------------------------------------- 3. as funcoes
FUNCS = r'''
function histAtor(tipo){
if("fechou"===tipo||"respondeu"===tipo)return"ok";
if("sem_interesse"===tipo||"arquivado"===tipo)return"fim";
if("cadencia_iniciada"===tipo||"cadencia_avancou"===tipo||"cadencia_encerrada"===tipo||"perfil_transicionado"===tipo||"esfriado_por_silencio"===tipo)return"regua";
return"operador"}
function histLinha(ev){
var autor=ev.autor||"Régua";
var q=String(ev.quando||"").replace(/^(\d{2}\/\d{2})\/\d{4} /,"$1 ");
var det=ev.detalhe?'<div class="hist-'+("nota"===ev.tipo?"nota-txt":"det")+'">'+c(ev.detalhe)+"</div>":"";
return'<li class="hist-ev ator-'+histAtor(ev.tipo)+'"><div class="hist-quando">'+c(q)+'</div><div class="hist-marca"><span class="hist-ponto"></span></div><div class="hist-corpo"><div class="hist-rot">'+c(ev.rotulo||ev.tipo||"")+' <span class="hist-autor">· '+c(autor)+'</span></div>'+det+"</div></li>"}
function histTopo(id){return'<div class="hist-topo"><div class="hist-tit">Histórico</div><button class="btn-nota" data-acao="nota" data-id="'+c(id)+'">+ Nota</button></div>'}
function histForm(id){return'<div class="hist-form"><textarea placeholder="O que aconteceu? A nota entra no histórico e não pode ser apagada."></textarea><div class="hist-form-pe"><input type="date" value="'+c(l())+'" aria-label="Data da nota"><button class="btn-nota ok" data-acao="nota-ok" data-id="'+c(id)+'">Registrar</button></div></div>'}
function pintarHist(cont,id,evs){
var lista=evs&&evs.length?'<ol class="hist-lista">'+evs.map(histLinha).join("")+"</ol>":'<div class="hist-vazio">Nenhum evento ainda.</div>';
cont.innerHTML=histTopo(id)+histForm(id)+lista}
function histErro(f,msg){
var v=f.querySelector(".hist-erro");v&&v.parentNode.removeChild(v);
var d=document.createElement("div");d.className="hist-erro";d.textContent=msg;
var pe=f.querySelector(".hist-form-pe");pe?f.insertBefore(d,pe):f.appendChild(d)}
function alternarNota(card){
var f=card.querySelector(".hist-form");if(!f)return;
var ab=f.className.indexOf("aberto")>=0;
f.className="hist-form"+(ab?"":" aberto");
if(!ab){var ta=f.querySelector("textarea");ta&&ta.focus()}}
async function abrirHistorico(id,btn,card){
var cont=card.querySelector("[data-hist]");if(!cont)return;
if(cont.className.indexOf("aberto")>=0){cont.className="hist";cont.innerHTML="";if(btn)btn.className="btn-acao";return}
cont.className="hist aberto";
cont.innerHTML=histTopo(id)+'<div class="hist-vazio">Buscando histórico...</div>';
if(btn){btn.disabled=!0;btn.className="btn-acao ligado"}
var res=await t.rpc("historico_lead",{p_lead_id:id});
if(btn)btn.disabled=!1;
if(res.error){cont.innerHTML=histTopo(id)+'<div class="hist-vazio">Falha: '+c(res.error.message)+"</div>";return}
var d=res.data;
if(!d||!1===d.ok){cont.innerHTML=histTopo(id)+'<div class="hist-vazio">'+c(d&&d.msg||"Sem histórico")+"</div>";return}
pintarHist(cont,id,d.eventos||[])}
async function registrarNota(id,btn,card){
var f=card.querySelector(".hist-form");if(!f)return;
var ta=f.querySelector("textarea"),dt=f.querySelector('input[type=date]');
var txt=ta?String(ta.value):"";
if(!txt.trim()){histErro(f,"Escreva a nota antes de registrar.");return}
var args={p_lead_id:id,p_texto:txt};
if(dt&&dt.value)args.p_data=dt.value;
if(btn)btn.disabled=!0;
var res=await t.rpc("registrar_nota",args);
if(btn)btn.disabled=!1;
if(res.error){histErro(f,"Falha: "+res.error.message);return}
var d=res.data;
if(!d||!1===d.ok){histErro(f,d&&d.msg||"Nota recusada");return}
I(d.msg||"Nota registrada");
var cont=card.querySelector("[data-hist]");
var r2=await t.rpc("historico_lead",{p_lead_id:id});
cont&&r2&&!r2.error&&r2.data&&pintarHist(cont,id,r2.data.eventos||[])}
var scriptsData={};'''.replace('\n', '')

troca('var scriptsData={};', FUNCS, 'funcoes do historico')

# ---------------------------------------------------------------- 4. handler de clique
# Entra no mesmo bloco early-return de "sugerir", que ja roda antes da cadeia de else.
troca(
    'if("sugerir"===o)return void sugerirMensagem(t,e,n);',
    'if("sugerir"===o)return void sugerirMensagem(t,e,n);'
    'if("historico"===o)return void abrirHistorico(t,e,n);'
    'if("nota"===o)return void alternarNota(n);'
    'if("nota-ok"===o)return void registrarNota(t,e,n);',
    'casos no handler de clique'
)

if src == orig:
    print('  nada mudou'); sys.exit(1)
ALVO.write_text(src, encoding='utf-8')
print(f'\napp.js: {len(orig):,} -> {len(src):,} bytes (+{len(src)-len(orig):,})')
