# Vendas: modelo vira texto livre (datalist -> modelo_texto no payload) e busca de
# cliente liga a venda ao lead (lead_id). Backend ja aceita ambos (registrar_venda).
# Patch cirurgico no app.js, molde de patch_vendas.py: ancoras exatas, falha alto.
# Roda da raiz: python ferramentas/patch_vendas_cliente_modelo.py
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
        print('  FALHOU [%s]: ancora aparece %dx, esperava 1x' % (rotulo, n)); sys.exit(1)
    src = src.replace(velho, novo, 1)
    print('  ok [%s]' % rotulo)

if 'function buscaClienteVenda' in src:
    print('  FALHOU: patch ja aplicado'); sys.exit(1)

# 1) funcoes da busca de cliente + vinculo ao lead, injetadas antes de salvarVenda.
#    Reusa g (filtrarBusca), f (fmtTel), i (leads), c (esc). fvLeadSel guarda o vinculo.
FUNCS = (
    'var fvLeadSel=null;'
    'function fvCliHit(a){return\'<button type="button" class="fv-cli-hit" data-acao="fv-cli-pick" data-id="\'+c(a.id)+\'"><strong>\'+c(a.nome||"(sem nome)")+\'</strong><span>\'+(a.whatsapp_digitos?c(f(a.whatsapp_digitos)):"sem telefone")+(a.produto?" · "+c(a.produto):"")+\'</span></button>\'}'
    'function buscaClienteVenda(){var cx=E("fvClienteResultados");if(!cx)return;var termo=E("fvClienteBusca")?E("fvClienteBusca").value:"";if(!String(termo).trim()){cx.innerHTML="";return}var ativos=(i||[]).filter(function(x){return!x.arquivado_em}),hits=g(ativos,termo).slice(0,6);cx.innerHTML=hits.length?hits.map(fvCliHit).join(""):\'<div class="fv-cli-vazio">Nenhum cliente na base com esse termo.</div>\'}'
    'function preencherClienteVenda(id){var L=(i||[]).filter(function(x){return String(x.id)===String(id)})[0];if(!L)return;fvLeadSel=L;if(E("fvNome"))E("fvNome").value=L.nome||"";if(E("fvWhats"))E("fvWhats").value=L.whatsapp_digitos?f(L.whatsapp_digitos):"";if(E("fvClienteResultados"))E("fvClienteResultados").innerHTML="";if(E("fvClienteBusca"))E("fvClienteBusca").value="";var st=E("fvLeadStatus");if(st)st.innerHTML=\'Vinculado a \'+c(L.nome||L.lead_code||"lead")+(L.lead_code?\' · \'+c(L.lead_code):"")+\' <button type="button" class="fv-cli-desfazer" data-acao="fv-cli-limpar">desfazer</button>\'}'
    'function limparClienteVenda(){fvLeadSel=null;if(E("fvClienteBusca"))E("fvClienteBusca").value="";if(E("fvClienteResultados"))E("fvClienteResultados").innerHTML="";if(E("fvLeadStatus"))E("fvLeadStatus").innerHTML=""}'
    'function fvCliClick(ev){var el=ev.target&&ev.target.closest?ev.target.closest("[data-acao]"):null;if(!el)return;var o=el.getAttribute("data-acao");if("fv-cli-pick"===o)preencherClienteVenda(el.getAttribute("data-id"));else if("fv-cli-limpar"===o)limparClienteVenda()}'
)
troca('async function salvarVenda(){', FUNCS + 'async function salvarVenda(){', 'funcoes busca de cliente')

# 2) abrirPainelVenda: modelo/capacidade viram datalist; limpa a busca de cliente.
#    Extrai o corpo por fronteiras estaveis (a linha do <option> placeholder tem
#    reticencia U+2026, que atrapalha match exato).
a = src.index('async function abrirPainelVenda(){')
b = src.index('function fecharPainelVenda()', a)
NOVO_ABRIR = (
    'async function abrirPainelVenda(){\n'
    'var r=await t.from("catalogo_iphone").select("id,rotulo").eq("ativo",!0).order("ordem");\n'
    'var mopts=(((r&&r.data)||[]).map(function(m){return\'<option value="\'+c(m.rotulo)+\'"></option>\'}).join(""));\n'
    'if(E("fvModeloLista"))E("fvModeloLista").innerHTML=mopts;\n'
    'if(E("fvCapacidadeLista"))E("fvCapacidadeLista").innerHTML=["64GB","128GB","256GB","512GB","1TB"].map(function(x){return\'<option value="\'+x+\'"></option>\'}).join("");\n'
    'if(E("fvModelo"))E("fvModelo").value="";\n'
    'limparClienteVenda();\n'
    'if(E("fvErro"))E("fvErro").textContent="";\n'
    'calcLucroVenda();\n'
    'if(E("painelVenda"))E("painelVenda").className="painel-cadastro"}\n'
)
src = src[:a] + NOVO_ABRIR + src[b:]
print('  ok [abrirPainelVenda datalist]')

# 3) payload: modelo_texto (texto livre) + lead_id (vinculo). modelo_id sai.
troca('modelo_id:val("fvModelo")',
      'modelo_texto:val("fvModelo"),lead_id:(fvLeadSel?fvLeadSel.id:"")',
      'payload modelo_texto+lead_id')

# 4) validacao no cliente: exige modelo_texto (era modelo_id).
troca('if(!payload.modelo_id){if(E("fvErro"))E("fvErro").textContent="Escolha o modelo.";return}',
      'if(!String(payload.modelo_texto||"").trim()){if(E("fvErro"))E("fvErro").textContent="Informe o modelo.";return}',
      'validacao modelo_texto')

# 5) wiring: input da busca + delegacao de clique no painelVenda (A so cobre #lista).
troca('Y("fvTaxas","input",calcLucroVenda),',
      'Y("fvTaxas","input",calcLucroVenda),Y("fvClienteBusca","input",buscaClienteVenda),Y("painelVenda","click",fvCliClick),',
      'wiring busca de cliente')

if src == orig:
    print('  FALHOU: nada mudou'); sys.exit(1)
ALVO.write_text(src, encoding='utf-8')
print('patch_vendas_cliente_modelo: aplicado, %d -> %d bytes' % (len(orig), len(src)))
