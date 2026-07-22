# Aba Vendas (fatia 1): registro e lista de venda.
# Patch cirurgico no app.js (minificado, uma linha so), no molde de
# patch_hierarquia.py: cada troca e ancorada em texto exato e falha alto se a
# ancora nao bater ou nao for unica. Funcoes novas entram LEGIVEIS dentro do IIFE
# pela ancora 'var scriptsData={};'. Roda da raiz: python ferramentas/patch_vendas.py
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

exige_ausente('function cardVenda', 'idempotencia')

VENDAS = r'''
// ---- Aba Vendas (fatia 1). Le v_venda; escreve pela RPC registrar_venda. ----
var vendasData=[];
function brlV(n){return "R$ "+Number(n||0).toLocaleString("pt-BR",{minimumFractionDigits:2,maximumFractionDigits:2})}
function rotStatusVenda(s){return "pre_venda"===s?"Pré-venda":"cancelada"===s?"Cancelada":"Concluída"}
function fxVenda(v){
var chips='<span class="cli-seg">'+c(rotStatusVenda(v.status))+"</span>";
if(v.tem_trade_in)chips+='<span class="cli-seg">troca</span>';
return '<div class="card-cliente">'+chips+'</div><div class="venda-vals"><span class="v-venda">'+brlV(v.valor_venda)+'</span><span class="v-lucro'+(Number(v.lucro)>=0?"":" neg")+'">lucro '+brlV(v.lucro)+"</span></div>"}
function cardVenda(v){
return '<div class="card"><div class="card-top"><span class="card-code">'+c(v.venda_code||"")+'</span><span class="card-prod">'+c(v.modelo_rotulo||"")+(v.capacidade?" "+c(v.capacidade):"")+(v.cor?" "+c(v.cor):"")+'</span></div><div class="card-sub">'+c(v.cliente_nome||"sem cliente")+(v.data_venda?" · "+c(v.data_venda):"")+(v.imei?" · IMEI "+c(v.imei):"")+"</div>"+fxVenda(v)+"</div>"}
function filtVendaBusca(lista,termo){
var q=String(termo||"").trim().toLowerCase();
if(!q)return lista;
return lista.filter(function(v){return [v.venda_code,v.modelo_rotulo,v.cliente_nome,v.imei].join(" ").toLowerCase().indexOf(q)>=0})}
async function carregarVendas(){
var r=await t.from("v_venda").select("*").order("criado_em",{ascending:!1});
vendasData=(r&&r.data)||[]}
async function renderVendas(e){
e.innerHTML='<div class="estado">Lendo vendas…</div>';
await carregarVendas();
var lista=filtVendaBusca(vendasData,E("inputBusca")?E("inputBusca").value:"");
var topo='<div class="venda-topo"><button class="btn-cad" data-acao="nova-venda">+ Nova venda</button><span class="venda-cont">'+vendasData.length+(1===vendasData.length?" venda":" vendas")+"</span></div>";
e.innerHTML=topo+(lista.length?lista.map(cardVenda).join(""):'<div class="estado"><strong>Nenhuma venda ainda.</strong><br>Toque em Nova venda pra registrar a primeira.</div>')}
function calcLucroVenda(){
var num=function(id){var x=parseFloat(String((E(id)?E(id).value:"")||"").replace(",","."));return isNaN(x)?0:x};
var lu=num("fvValor")-num("fvCusto")-num("fvFrete")-num("fvTaxas");
if(E("fvLucro"))E("fvLucro").textContent="lucro "+brlV(lu)}
async function abrirPainelVenda(){
var r=await t.from("catalogo_iphone").select("id,rotulo").eq("ativo",!0).order("ordem");
var opts='<option value="">modelo…</option>'+(((r&&r.data)||[]).map(function(m){return '<option value="'+c(m.id)+'">'+c(m.rotulo)+"</option>"}).join(""));
if(E("fvModelo"))E("fvModelo").innerHTML=opts;
if(E("fvErro"))E("fvErro").textContent="";
calcLucroVenda();
if(E("painelVenda"))E("painelVenda").className="painel-cadastro"}
function fecharPainelVenda(){if(E("painelVenda"))E("painelVenda").className="painel-cadastro oculto"}
async function salvarVenda(){
var val=function(id){return E(id)?E(id).value:""};
var payload={valor_venda:val("fvValor"),modelo_id:val("fvModelo"),capacidade:val("fvCapacidade"),cor:val("fvCor"),condicao:val("fvCondicao"),imei:val("fvImei"),comprador_nome:val("fvNome"),comprador_whatsapp:val("fvWhats"),comprador_cpf:val("fvCpf"),comprador_nascimento:val("fvNasc"),comprador_instagram:val("fvInsta"),fornecedor_nome:val("fvFornNome"),fornecedor_contato:val("fvFornContato"),fornecedor_local_retirada:val("fvFornLocal"),custo_aparelho:val("fvCusto"),despesa_frete:val("fvFrete"),despesa_taxas:val("fvTaxas"),tem_trade_in:"sim"===val("fvTradeIn"),entrada_modelo:val("fvEntModelo"),entrada_imei:val("fvEntImei"),entrada_valor:val("fvEntValor"),status:val("fvStatus"),endereco_entrega:val("fvEndereco"),valor_a_cobrar:val("fvCobrar"),motoboy:val("fvMotoboy"),forma_pagamento:val("fvPgto"),data_venda:val("fvData"),nf_numero:val("fvNfNum"),observacoes:val("fvObs")};
if(!(parseFloat(payload.valor_venda)>0)){if(E("fvErro"))E("fvErro").textContent="Informe o valor da venda.";return}
if(!payload.modelo_id){if(E("fvErro"))E("fvErro").textContent="Escolha o modelo.";return}
if(E("fvErro"))E("fvErro").textContent="";
var r=await t.rpc("registrar_venda",{payload:payload});
var d=r&&r.data;
if(d&&d.ok){I("Venda "+d.venda_code+" registrada");fecharPainelVenda();n="vendas";k()}
else I(d&&d.erro||r&&r.error&&r.error.message||"Falha ao salvar",!0)}
'''

# 1) helpers dentro do IIFE (mesma ancora de statement usada pelos outros patches)
troca('var scriptsData={};', VENDAS + 'var scriptsData={};', 'funcoes da aba Vendas')

# 2) titulo do topo
troca('"todos"===n?"Todos":', '"vendas"===n?"Vendas":"todos"===n?"Todos":', 'titulo Vendas')

# 3) aria-selected da aba
troca(
    'E("abaTodos").setAttribute("aria-selected","todos"===n?"true":"false"),',
    'E("abaTodos").setAttribute("aria-selected","todos"===n?"true":"false"),E("abaVendas")&&E("abaVendas").setAttribute("aria-selected","vendas"===n?"true":"false"),',
    'aria-selected da aba Vendas'
)

# 4) busca visivel tambem em vendas
troca('"todos"===n||"clientes"===n?" visivel"', '"todos"===n||"clientes"===n||"vendas"===n?" visivel"', 'busca visivel em Vendas')

# 5) ramo de render (render proprio, nao o N de card de lead)
troca('else if("clientes"===n)N(', 'else if("vendas"===n)renderVendas(e);else if("clientes"===n)N(', 'ramo de render Vendas')

# 6) binds: aba, salvar, cancelar, e recalculo do lucro ao vivo
troca(
    'Y("abaTodos","click",function(){n="todos",k()}),',
    'Y("abaTodos","click",function(){n="todos",k()}),Y("abaVendas","click",function(){n="vendas",k()}),'
    'Y("btnSalvarVenda","click",salvarVenda),Y("btnCancelarVenda","click",fecharPainelVenda),'
    'Y("fvValor","input",calcLucroVenda),Y("fvCusto","input",calcLucroVenda),Y("fvFrete","input",calcLucroVenda),Y("fvTaxas","input",calcLucroVenda),',
    'binds da aba Vendas'
)

# 7) delegacao de clique do "+ Nova venda"
troca(
    'if("sync-agora"===o)return void sincronizarAgora(e);',
    'if("nova-venda"===o)return void abrirPainelVenda();if("sync-agora"===o)return void sincronizarAgora(e);',
    'acao nova-venda'
)

if src == orig:
    print('  FALHOU: nada mudou'); sys.exit(1)
ALVO.write_text(src, encoding='utf-8')
print('patch_vendas: aplicado, %d -> %d bytes' % (len(orig), len(src)))
