# Fase 5: aba Captação no front.
# Backend ja provado (3 tabelas, RLS isolando tenant, auditoria, 4 RPCs).
# Cada troca e ancorada em texto exato e falha alto se a ancora nao bater ou nao for unica.
import sys, pathlib
sys.stdout.reconfigure(encoding='utf-8')

RAIZ = pathlib.Path(__file__).resolve().parent.parent
falhou = []

def patch(caminho, trocas):
    alvo = RAIZ / caminho
    src = alvo.read_text(encoding='utf-8')
    orig = src
    for velho, novo, rotulo in trocas:
        n = src.count(velho)
        if n != 1:
            print(f'  FALHOU [{caminho} :: {rotulo}]: ancora aparece {n}x, esperava 1x')
            falhou.append(rotulo); continue
        src = src.replace(velho, novo, 1)
        print(f'  ok [{caminho} :: {rotulo}]')
    if src != orig:
        alvo.write_text(src, encoding='utf-8')
        print(f'     {caminho}: {len(orig):,} -> {len(src):,} bytes')

# =================================================================== index.html
ABA = (
'      <button class="aba" id="abaCaptacao" role="tab" aria-selected="false">\n'
'        <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="8"/>'
'<circle cx="12" cy="12" r="3.2"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3" stroke-linecap="round"/></svg>\n'
'        <span class="aba-txt">Captação</span>\n'
'        <span class="nav-badge" id="badgeCaptacao"></span>\n'
'      </button>\n'
'\n'
'      <p class="nav-rot nav-rot-2">'
)
patch('public/index.html', [
    ('\n      <p class="nav-rot nav-rot-2">', '\n' + ABA, 'aba Captação no grupo Operação'),
])

# =================================================================== app.js
FUNCS = r'''
function capCel(rot,num,pe){return'<div class="pb-celula"><div class="pb-rot">'+c(rot)+'</div><div class="pb-num">'+c(String(num))+'</div><div class="pb-pe">'+c(pe)+'</div></div>'}
function capPlacar(p){
var tot=p.total||0;
return'<div class="pitboard">'
+capCel("hoje",p.feitas||0,"de "+(p.alvo||0)+" na meta")
+capCel("abordadas",tot,"desde o início")
+capCel("viraram lead",p.leads_gerados||0,"de "+tot+" abordadas")
+capCel("não abordar",p.pararam||0,"pediram para parar")
+"</div>"}
function capRegistro(){
var o=(capFrentes||[]).map(function(f){return'<option value="'+c(f.codigo)+'">'+c(f.rotulo)+"</option>"}).join("");
return'<div class="cap-reg"><div class="cap-reg-lin"><select id="capFrente" aria-label="Frente">'+o+'</select>'
+'<input class="ident" id="capIdent" placeholder="@perfil" aria-label="Perfil abordado" autocomplete="off">'
+'<button class="btn-cap" data-acao="cap-registrar">Registrar</button></div>'
+'<div id="capMsg"></div>'
+'<button class="cap-mais" data-acao="cap-mais">+ nome e observação</button>'
+'<div class="cap-det" id="capDet"><input id="capNome" placeholder="Nome (opcional)" aria-label="Nome">'
+'<textarea id="capObs" placeholder="Observação (opcional)"></textarea></div></div>'}
function capLinha(x){
var nome=x.nome?'<div class="cap-nome">'+c(x.nome)+"</div>":"";
var fim,cls="";
if(x.parou){fim='<span class="cap-selo">não abordar</span>';cls=" parou"}
else if(x.virou_lead){fim='<span class="cap-virou">virou lead</span>';cls=" virou"}
else fim='<button class="btn-parar" data-acao="cap-parar" data-id="'+c(x.id)+'">parar</button>';
return'<div class="cap-lin'+cls+'"><div class="cap-hora">'+c(x.hora||"")+'</div>'
+'<div class="cap-quem"><div class="cap-ident">'+c(x.identificador||"")+"</div>"+nome+"</div>"
+'<div class="cap-frente">'+c(x.frente_rotulo||x.frente||"")+"</div>"
+'<div class="cap-fim">'+fim+"</div></div>"}
function capLog(linhas){
if(!linhas||!linhas.length)return'<div class="cap-log"><div class="cap-vazio"><div class="cap-vazio-t">Nenhuma abordagem hoje.</div><div class="cap-vazio-s">A meta '+(capAlvo?"são "+capAlvo:"do dia")+'. Comece pelo campo acima.</div></div></div>';
return'<div class="cap-log"><div class="cap-log-cab"><span>hora</span><span>quem</span><span>frente</span><span></span></div>'+linhas.map(capLinha).join("")+"</div>"}
var capFrentes=[],capAlvo=0;
async function renderCaptacao(){
var e=E("lista");
e.innerHTML='<div class="estado">Lendo a captação...</div>';
if(!capFrentes.length){
  var rf=await t.from("captacao_frente").select("codigo,rotulo,ordem,ativo").order("ordem",{ascending:!0});
  if(!rf.error&&rf.data)capFrentes=rf.data.filter(function(f){return f.ativo});
}
var rp=await t.rpc("placar_captacao",{});
var rl=await t.rpc("captacao_do_dia",{});
if(rp.error||rl.error){
  e.innerHTML='<div class="estado erro">Falha ao ler a captação: '+c((rp.error||rl.error).message)+". Toque em Atualizar para tentar de novo.</div>";return}
var p=rp.data||{},lg=rl.data||{};
capAlvo=p.alvo||0;
if(E("topoSub"))E("topoSub").textContent=E("topoSub").textContent+" · "+(p.feitas||0)+" de "+(p.alvo||0)+" hoje";
if(E("badgeCaptacao"))E("badgeCaptacao").textContent=p.feitas?String(p.feitas):"";
e.innerHTML=capPlacar(p)+capRegistro()+capLog(lg.linhas||[]);
}
function capMsg(cls,msg){var d=E("capMsg");if(d)d.innerHTML=msg?'<div class="cap-msg '+cls+'">'+c(msg)+"</div>":""}
function alternarCapDet(btn){
var d=E("capDet");if(!d)return;
var ab=d.className.indexOf("aberto")>=0;
d.className="cap-det"+(ab?"":" aberto");
if(btn)btn.textContent=ab?"+ nome e observação":"− nome e observação";
if(!ab&&E("capNome"))E("capNome").focus()}
async function registrarCaptacao(btn){
var f=E("capFrente"),id=E("capIdent");
if(!f||!id)return;
var ident=String(id.value||"").trim();
if(!ident){capMsg("erro","Digite o @perfil antes de registrar.");id.focus();return}
var args={p_frente:f.value,p_identificador:ident};
var nm=E("capNome"),ob=E("capObs");
if(nm&&nm.value.trim())args.p_nome=nm.value;
if(ob&&ob.value.trim())args.p_observacoes=ob.value;
if(btn)btn.disabled=!0;
var res=await t.rpc("registrar_captacao",args);
if(btn)btn.disabled=!1;
if(res.error){capMsg("erro","Falha: "+res.error.message);return}
var d=res.data;
if(!d||!1===d.ok){capMsg(d&&d.duplicado?"erro":"parada",d&&d.msg||"Abordagem recusada");return}
I(d.msg||"Abordagem registrada");
await renderCaptacao();
var novo=E("capIdent");if(novo)novo.focus()}
async function pararCaptacao(id,btn){
if(!id)return;
if(btn)btn.disabled=!0;
var res=await t.rpc("registrar_opt_out",{p_captacao_id:id});
if(btn)btn.disabled=!1;
if(res.error){I("Falha: "+res.error.message,!0);return}
var d=res.data;
if(!d||!1===d.ok){I(d&&d.msg||"Nao foi possivel marcar",!0);return}
I(d.msg||"Marcada como nao abordar");
await renderCaptacao()}
function capKeydown(a){
if("Enter"!==a.key)return;
var alvo=a.target;
if(!alvo||"capIdent"!==alvo.id)return;
a.preventDefault();
var b=E("lista").querySelector('[data-acao="cap-registrar"]');
registrarCaptacao(b)}
var scriptsData={};'''.replace('\n', '')

patch('public/app.js', [
    ('var scriptsData={};', FUNCS, 'funcoes da captacao'),

    # roteador: aria-selected da aba nova
    ('E("abaDash")&&E("abaDash").setAttribute("aria-selected","dashboard"===n?"true":"false")',
     'E("abaDash")&&E("abaDash").setAttribute("aria-selected","dashboard"===n?"true":"false"),'
     'E("abaCaptacao")&&E("abaCaptacao").setAttribute("aria-selected","captacao"===n?"true":"false")',
     'aria-selected da aba Captacao'),

    # titulo
    ('"indicacoes"===n?"Indicações":"Dashboard"',
     '"indicacoes"===n?"Indicações":"captacao"===n?"Captação":"Dashboard"',
     'titulo da aba Captacao'),

    # o pitboard de LEAD nao pode aparecer na captacao: sao numeros de outro laco
    ('E("blocoBusca").className="busca"+("todos"===n?" visivel":"")',
     'E("blocoBusca").className="busca"+("todos"===n?" visivel":""),'
     'E("pitboard")&&(E("pitboard").className="pitboard"+("captacao"===n?" oculto":""))',
     'esconder o pitboard de lead na aba Captacao'),

    # rota
    ('else if("dashboard"===n)',
     'else if("captacao"===n)renderCaptacao();else if("dashboard"===n)',
     'rota da aba Captacao'),

    # listeners
    ('Y("abaDash","click",function(){n="dashboard",k()})',
     'Y("abaDash","click",function(){n="dashboard",k()}),'
     'Y("abaCaptacao","click",function(){n="captacao",k()}),'
     'Y("lista","keydown",capKeydown)',
     'listeners da aba Captacao'),

    # handler de clique: entra ANTES da cadeia que exige .card (captacao nao vive em card)
    ('var o=e.getAttribute("data-acao"),t=e.getAttribute("data-id"),n=e.closest(".card");',
     'var o=e.getAttribute("data-acao"),t=e.getAttribute("data-id"),n=e.closest(".card");'
     'if("cap-registrar"===o)return void registrarCaptacao(e);'
     'if("cap-mais"===o)return void alternarCapDet(e);'
     'if("cap-parar"===o)return void pararCaptacao(t,e);',
     'casos da captacao no handler de clique'),
])

if falhou:
    print('\nREPROVOU:', falhou); sys.exit(1)
print('\nok')
