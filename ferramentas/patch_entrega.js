// Relatorio de entrega (motoboy). Costura o bloco e os bindings dentro do
// app.js minificado. Rodar da raiz do repo: node ferramentas/patch_entrega.js
//
// ATENCAO ao delegado: em `function A(a)`, `a` e o EVENTO e `e` e o ELEMENTO.
// O bloco do Escopo entrou usando a.getAttribute e TODO o caminho de escrita
// morreu em producao (v46, secao 4.6). Aqui nada entra no delegado A: os tres
// botoes do painel sao ligados por id com Y(), e o botao do card passa pelo
// vendaAcao(o,id,el), que ja recebe o elemento pronto.
'use strict';
const fs = require('fs');
const path = require('path');

const ALVO = path.join(__dirname, '..', 'public', 'app.js');
let src = fs.readFileSync(ALVO, 'utf8');
const antes = src.length;

const BLOCO = [
  '// ---- Relatorio de entrega: o que o motoboy precisa saber (08/08/2026) -------',
  '// Nao existe tabela de entrega: os campos sao os DA VENDA (endereco_entrega,',
  '// valor_a_cobrar, motoboy, forma_pagamento, fornecedor_local_retirada), e o',
  '// que o dono corrigir aqui volta para a venda pela editar_venda. Painel que so',
  '// montasse texto faria digitar o endereco duas vezes e guardar zero.',
  '// Nome e telefone do cliente sao LEITURA: identidade mora no lead.',
  'var ENT_EDIT=null;',
  'var ENT_PGTO={pix:"Pix",dinheiro:"Dinheiro",cartao:"Cartão",misto:"Misto"};',
  'function entVal(id){return E(id)?String(E(id).value||"").trim():""}',
  'function entDig(x){return String(x||"").replace(/\\D/g,"")}',
  '// wa.me exige o pais na frente. 10 e 11 digitos e numero brasileiro sem o 55;',
  '// acima disso ja veio com pais e nao se mexe. Mesma regra da RPC.',
  'function entWa(x){var d=entDig(x);return d?(10===d.length||11===d.length?"55"+d:d):""}',
  '// O que falta e dito ANTES do envio, nomeado. So o endereco e o numero do',
  '// motoboy bloqueiam o enviar; o resto e aviso, porque a corrida pode sair',
  '// mesmo sem local de retirada declarado.',
  'function entFaltando(){',
  'var f=[];',
  'if(!entVal("peEntrega"))f.push("endereço de entrega");',
  'if(!entVal("peRetirada"))f.push("local de retirada");',
  'if(!entVal("peNome"))f.push("nome do cliente (no cadastro)");',
  'if(!entDig(entVal("peWhats")))f.push("WhatsApp do cliente (no cadastro)");',
  'if(!entVal("peMotoboy"))f.push("nome do motoboy");',
  'if(!entDig(entVal("peMotoWhats")))f.push("WhatsApp do motoboy");',
  'return f}',
  '// O texto que sai. Campo em branco some da mensagem (o motoboy nao precisa',
  '// ler buraco), MENOS a linha do dinheiro: sem valor ela diz "nada a cobrar".',
  '// Omitir dinheiro e como nasce cobranca errada na porta do cliente.',
  'function entTexto(){',
  'var v=ENT_EDIT||{},L=[];',
  'L.push("ENTREGA · "+(v.venda_code||"venda"));',
  'var ap=[v.modelo_rotulo||v.modelo_texto||"",v.capacidade||"",v.cor||""].filter(Boolean).join(" ");',
  'if(ap)L.push("Aparelho: "+ap);',
  'if(entVal("peNome"))L.push("Cliente: "+entVal("peNome"));',
  'var w=entDig(entVal("peWhats"));if(w)L.push("Contato: "+f(w));',
  'if(entVal("peRetirada"))L.push("Retirar em: "+entVal("peRetirada"));',
  'if(entVal("peEntrega"))L.push("Entregar em: "+entVal("peEntrega"));',
  'var vl=parseFloat(String(entVal("peValor")).replace(",","."));',
  'var pg=ENT_PGTO[entVal("pePgto")]||"";',
  'L.push(vl>0?"Cobrar: "+brlV(vl)+(pg?" · "+pg:" · forma a combinar"):"Cobrar: nada a cobrar na entrega");',
  'if(entVal("peRecado"))L.push("Recado: "+entVal("peRecado"));',
  'return L.join("\\n")}',
  '// A previa mostra o texto EXATO que sai. Sem ela, o dono so descobre o que',
  '// mandou depois de mandar, e ai o motoboy ja leu.',
  'function entPintar(){',
  'if(E("pePrevia"))E("pePrevia").textContent=entTexto();',
  'var fl=entFaltando(),cx=E("peFalta");',
  'if(cx)cx.innerHTML=fl.length?"Falta: "+c(fl.join(", "))+".":""}',
  '// Endereco sugerido do cadastro do cliente quando a venda nao tem o proprio.',
  '// Sugerir NAO e gravar: so vai para o banco se o dono salvar.',
  'function entEndCliente(v){',
  'var L=(i||[]).filter(function(x){return String(x.id)===String(v.lead_id)})[0];',
  'return L?cliEndereco(L):""}',
  'function abrirPainelEntrega(id){',
  'var v=(vendasData||[]).filter(function(x){return String(x.id)===String(id)})[0];',
  'if(!v)return void I("Venda não encontrada",!0);',
  'ENT_EDIT=v;',
  'fvSet("peNome",v.cliente_nome||v.comprador_nome||"");',
  'var cw=v.cliente_whatsapp||v.comprador_whatsapp;',
  'fvSet("peWhats",cw?f(cw):"");',
  'fvSet("peRetirada",v.fornecedor_local_retirada||"");',
  'fvSet("peEntrega",v.endereco_entrega||entEndCliente(v));',
  'fvSet("peValor",null==v.valor_a_cobrar?"":v.valor_a_cobrar);',
  'if(E("pePgto"))E("pePgto").value=v.forma_pagamento||"";',
  'fvSet("peMotoboy",v.motoboy||"");',
  'fvSet("peMotoWhats",v.motoboy_whatsapp?f(v.motoboy_whatsapp):"");',
  'fvSet("peRecado","");',
  'if(E("peAlvo"))E("peAlvo").textContent=(v.venda_code||"Venda")+" · o que você corrigir aqui grava na venda; o recado da corrida, não.";',
  'if(E("peErro"))E("peErro").textContent="";',
  'entPintar();',
  'if(E("painelEntrega"))E("painelEntrega").className="painel-cadastro"}',
  'function fecharPainelEntrega(){',
  'ENT_EDIT=null;',
  'if(E("painelEntrega"))E("painelEntrega").className="painel-cadastro oculto"}',
  '// Grava so o que e da ENTREGA. comprador_nome e comprador_whatsapp ficam de',
  '// fora de proposito: sao leitura aqui, e manda-los criaria uma segunda versao',
  '// do cliente dentro da venda.',
  'async function salvarEntrega(){',
  'var v=ENT_EDIT;',
  'if(!v)return{ok:!1,erro:"Sem venda aberta"};',
  'var pe={id:v.id,fornecedor_local_retirada:entVal("peRetirada"),endereco_entrega:entVal("peEntrega"),',
  'valor_a_cobrar:entVal("peValor"),forma_pagamento:entVal("pePgto"),',
  'motoboy:entVal("peMotoboy"),motoboy_whatsapp:entVal("peMotoWhats")};',
  'var r=await t.rpc("editar_venda",{payload:pe});',
  'var d=r&&r.data;',
  'if(d&&d.ok)return{ok:!0};',
  'return{ok:!1,erro:(d&&d.erro)||(r&&r.error&&r.error.message)||"Falha ao salvar a entrega"}}',
  '// A janela abre no CLIQUE (sincrona) e so depois recebe a URL: aberta depois',
  '// do await, o navegador bloqueia como pop-up. Mesmo padrao do abrirArquivoNf.',
  '// Ordem: salva primeiro, envia depois. Mensagem enviada com o dado nao salvo',
  '// seria a tela e o motoboy discordando do banco.',
  'async function enviarEntrega(btn){',
  'if(!entVal("peEntrega")){',
  'if(E("peErro"))E("peErro").textContent="Sem endereço de entrega não dá pra despachar: preencha o destino.";',
  'return}',
  'var wa=entWa(entVal("peMotoWhats"));',
  'if(!wa){',
  'if(E("peErro"))E("peErro").textContent="Sem o WhatsApp do motoboy dá pra copiar o texto, mas não abrir a conversa.";',
  'return}',
  'if(E("peErro"))E("peErro").textContent="";',
  'var txt=entTexto(),w=window.open("about:blank","_blank");',
  'if(btn)btn.disabled=!0;',
  'var r=await salvarEntrega();',
  'if(btn)btn.disabled=!1;',
  'if(!r.ok){if(w)w.close();if(E("peErro"))E("peErro").textContent=r.erro;return void I(r.erro,!0)}',
  'var u="https://wa.me/"+wa+"?text="+encodeURIComponent(txt);',
  'if(w)w.location.href=u;else I("Libere o pop-up para abrir o WhatsApp",!0);',
  'I("Entrega salva e enviada para "+(entVal("peMotoboy")||"o motoboy"));',
  'fecharPainelEntrega();n="vendas";B()}',
  '// Copia PRIMEIRO, ainda dentro do gesto do clique: depois do await o',
  '// navegador considera a ativacao gasta e o clipboard falha calado.',
  'function copiarEntrega(btn){',
  'var txt=entTexto();',
  'if(navigator.clipboard&&navigator.clipboard.writeText)',
  'navigator.clipboard.writeText(txt).then(function(){I("Relatório copiado")},function(){copiarFallback(txt,"Relatório copiado")});',
  'else copiarFallback(txt,"Relatório copiado");',
  'if(btn)btn.disabled=!0;',
  'salvarEntrega().then(function(r){',
  'if(btn)btn.disabled=!1;',
  'if(r.ok){n="vendas";B()}',
  'else{if(E("peErro"))E("peErro").textContent=r.erro;I(r.erro,!0)}})}',
  '// A linha existe SEMPRE, com endereco ou sem. Venda sem destino se esconderia',
  '// justamente de quem tem que despachar, e o vazio vira o proprio convite.',
  'function entLinhaVenda(v){',
  'var dest=String(v.endereco_entrega||"").trim(),moto=String(v.motoboy||"").trim();',
  'var rot=dest?\'<span class="venda-ent-val">\'+c(dest)+(moto?" · "+c(moto):"")+"</span>"',
  ':\'<span class="venda-ent-falta">sem endereço de entrega</span>\';',
  'return\'<div class="venda-ent"><span class="venda-ent-rot">entrega</span>\'+rot+',
  '\'<button class="btn-acao\'+(dest?"":" ent-pede")+\'" data-acao="venda-entrega" data-id="\'+c(v.id)+\'">Relatório</button></div>\'}',
  ''
].join('\n');

const COSTURAS = [
  {
    nome: '1. o bloco da entrega entra antes de cardVenda (mesmo escopo do IIFE)',
    de: 'function cardVenda(v){',
    para: BLOCO + 'function cardVenda(v){'
  },
  {
    nome: '2. o card ganha a linha de entrega, entre o cliente e a NF',
    de: '+fxVenda(v)+vendaCliLinha(v)+nfLinhaVenda(v)+"</div>"}',
    para: '+fxVenda(v)+vendaCliLinha(v)+entLinhaVenda(v)+nfLinhaVenda(v)+"</div>"}'
  },
  {
    nome: '3. o botao Relatorio do card cai no roteador da aba Vendas',
    de: 'if("venda-desarquivar"===o){desarquivarVenda(id);return!0}',
    para: 'if("venda-entrega"===o){abrirPainelEntrega(id);return!0}'
         + 'if("venda-desarquivar"===o){desarquivarVenda(id);return!0}'
  },
  {
    nome: '4. trocar de aba fecha o painel de entrega (sem sobreposicao)',
    de: 'function G(x){M();R();fecharPainelVenda();',
    para: 'function G(x){M();R();fecharPainelVenda();fecharPainelEntrega();'
  },
  {
    nome: '5. copiarFallback passa a dizer O QUE copiou',
    de: 'document.body.removeChild(ta);I("Script copiado")}catch(e){I("Nao consegui copiar",!0)}}',
    para: 'document.body.removeChild(ta);I(rot||"Script copiado")}catch(e){I("Nao consegui copiar",!0)}}'
  },
  {
    nome: '5b. ...e recebe o rotulo como segundo argumento',
    de: 'function copiarFallback(txt){',
    para: 'function copiarFallback(txt,rot){'
  },
  {
    nome: '6. os tres botoes e os campos do painel ganham listener no init',
    de: 'Y("btnSalvarVenda","click",salvarVenda),',
    para: 'Y("btnEnviarEntrega","click",function(){enviarEntrega(E("btnEnviarEntrega"))}),'
         + 'Y("btnCopiarEntrega","click",function(){copiarEntrega(E("btnCopiarEntrega"))}),'
         + 'Y("btnFecharEntrega","click",fecharPainelEntrega),'
         + '["peRetirada","peEntrega","peValor","pePgto","peMotoboy","peMotoWhats","peRecado"]'
         + '.forEach(function(id){Y(id,"input",entPintar)}),'
         + 'Y("btnSalvarVenda","click",salvarVenda),'
  },
  {
    nome: '7. o painel de venda passa a gravar o telefone do motoboy',
    de: 'motoboy:val("fvMotoboy"),',
    para: 'motoboy:val("fvMotoboy"),motoboy_whatsapp:val("fvMotoboyWhats"),'
  },
  {
    nome: '8. ...e a limpar o campo novo entre um cadastro e outro',
    de: 'fvSet("fvWhats","");fvSet("fvCpf","");fvSet("fvData","");fvSet("fvTradeIn","");',
    para: 'fvSet("fvWhats","");fvSet("fvCpf","");fvSet("fvData","");fvSet("fvTradeIn","");fvSet("fvMotoboyWhats","");'
  },
  {
    nome: '9. ...e a exibi-lo formatado na correcao de venda',
    de: 'fvSet("fvWhats",v.comprador_whatsapp?f(v.comprador_whatsapp):"");',
    para: 'fvSet("fvWhats",v.comprador_whatsapp?f(v.comprador_whatsapp):"");'
         + 'fvSet("fvMotoboyWhats",v.motoboy_whatsapp?f(v.motoboy_whatsapp):"");'
  }
];

let erros = 0;
for (const cst of COSTURAS) {
  const n = src.split(cst.de).length - 1;
  if (n !== 1) {
    console.error(`REPROVOU: ${cst.nome}\n  esperava 1 ocorrencia, achou ${n}`);
    erros++;
    continue;
  }
  src = src.replace(cst.de, cst.para);
  console.log(`ok  ${cst.nome}`);
}

if (erros) {
  console.error(`\nREPROVOU: ${erros} costura(s) sem ocorrencia unica. Nada foi gravado.`);
  process.exit(1);
}

fs.writeFileSync(ALVO, src, 'utf8');
console.log(`\napp.js: ${antes} -> ${src.length} bytes (+${src.length - antes})`);
console.log(`APROVOU: ${COSTURAS.length} costuras aplicadas.`);
