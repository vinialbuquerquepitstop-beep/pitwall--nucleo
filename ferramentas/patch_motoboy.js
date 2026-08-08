// Cadastro de motoboy + botao que despacha direto. Costura sobre o app.js que
// ja recebeu o patch_entrega.js. Rodar da raiz: node ferramentas/patch_motoboy.js
//
// `el` e sempre o ELEMENTO, `ev` o EVENTO. Trocar os dois foi o defeito que
// matou toda a escrita da aba Escopo em producao (v46, secao 4.6).
'use strict';
const fs = require('fs');
const path = require('path');

const ALVO = path.join(__dirname, '..', 'public', 'app.js');
let src = fs.readFileSync(ALVO, 'utf8');
const antes = src.length;

const BLOCO = [
  '// ---- Cadastro de motoboy (08/08/2026) ---------------------------------------',
  '// Antes o motoboy era texto livre dentro de cada venda: o mesmo Hiago virava',
  '// tres grafias e o telefone era redigitado a cada corrida. A lista abaixo passa',
  '// a ser a fonte, e a venda continua guardando nome e telefone DO DIA, do mesmo',
  '// jeito que venda.comprador_* e a fotografia do cliente no dia da compra.',
  'var motoboysData=[];',
  'async function carregarMotoboys(){',
  'var r=await ler(t.from("motoboy").select("id,nome,whatsapp").is("desligado_em",null).order("nome"),"os motoboys");',
  'if(r.ok)motoboysData=r.dados;',
  'return r}',
  '// O telefone fica VISIVEL na linha: escolher o motoboy errado custa uma corrida,',
  '// e dois Hiagos sem numero a vista sao indistinguiveis.',
  'function motoLinha(m){',
  'return\'<div class="moto-linha"><button type="button" class="moto-chip" data-acao="ent-moto-enviar" data-id="\'+c(m.id)+\'">\'',
  '+"<strong>"+c(m.nome||"sem nome")+"</strong><span>"+(m.whatsapp?c(f(m.whatsapp)):"sem WhatsApp")+"</span></button>"',
  '+\'<button type="button" class="moto-rm" data-acao="ent-moto-rm" data-id="\'+c(m.id)+\'" aria-label="Tirar da lista">tirar</button></div>\'}',
  'function pintarMotoboys(){',
  'var cx=E("peMotoLista");',
  'if(!cx)return;',
  'cx.innerHTML=motoboysData.length?motoboysData.map(motoLinha).join("")',
  ':\'<div class="moto-vazio">Nenhum motoboy na lista. Preencha nome e WhatsApp abaixo e toque em Salvar na lista.</div>\'}',
  '// Um toque = despacha. Preenche o motoboy da venda com o da lista e segue pelo',
  '// MESMO enviarEntrega: uma validacao so, um caminho so de escrita. Atalho com',
  '// caminho proprio seria a segunda regra que envelhece sozinha.',
  'async function enviarEntregaPara(mid,btn){',
  'var m=(motoboysData||[]).filter(function(x){return String(x.id)===String(mid)})[0];',
  'if(!m)return void I("Motoboy não encontrado",!0);',
  'if(!m.whatsapp)return void I((m.nome||"Esse motoboy")+" está sem WhatsApp: edite a lista.",!0);',
  'fvSet("peMotoboy",m.nome||"");',
  'fvSet("peMotoWhats",f(m.whatsapp));',
  'entPintar();',
  'await enviarEntrega(btn)}',
  '// Promove o avulso digitado a linha da lista. Nao inventa telefone: a RPC',
  '// recusa cadastro sem numero, porque sem numero nao existe botao de enviar.',
  'async function salvarMotoboyUI(btn){',
  'var nome=entVal("peMotoboy"),tel=entVal("peMotoWhats");',
  'if(!nome){if(E("peErro"))E("peErro").textContent="Digite o nome do motoboy antes de salvar na lista.";return}',
  'if(btn)btn.disabled=!0;',
  'var r=await t.rpc("salvar_motoboy",{payload:{nome:nome,whatsapp:tel}});',
  'if(btn)btn.disabled=!1;',
  'var d=r&&r.data;',
  'if(d&&d.ok){',
  'I(d.msg||"Motoboy salvo");',
  'if(E("peErro"))E("peErro").textContent="";',
  'await carregarMotoboys();pintarMotoboys()}',
  'else{var er=(d&&d.erro)||(r&&r.error&&r.error.message)||"Falha ao salvar o motoboy";',
  'if(E("peErro"))E("peErro").textContent=er;I(er,!0)}}',
  '// Tirar da lista e soft delete no banco: a entrega de ontem continua legivel',
  '// com o nome de quem levou. A confirmacao diz isso.',
  'async function desligarMotoboyUI(mid,btn){',
  'var m=(motoboysData||[]).filter(function(x){return String(x.id)===String(mid)})[0];',
  'if(!window.confirm("Tirar "+((m&&m.nome)||"este motoboy")+" da lista? As entregas antigas continuam registradas com o nome dele."))return;',
  'if(btn)btn.disabled=!0;',
  'var r=await t.rpc("desligar_motoboy",{p_id:mid,p_desligar:!0});',
  'if(btn)btn.disabled=!1;',
  'var d=r&&r.data;',
  'if(d&&d.ok){I(d.msg||"Motoboy removido");await carregarMotoboys();pintarMotoboys()}',
  'else I((d&&d.erro)||(r&&r.error&&r.error.message)||"Falha ao remover",!0)}',
  '// Roteador dos cliques do painel, no mesmo padrao do fvCliClick: o delegado A',
  '// so escuta #lista, e este painel vive fora dela.',
  'function entPainelClick(ev){',
  'var el=ev.target&&ev.target.closest?ev.target.closest("[data-acao]"):null;',
  'if(!el)return;',
  'var o=el.getAttribute("data-acao");',
  'if("ent-moto-enviar"===o){ev.preventDefault();enviarEntregaPara(el.getAttribute("data-id"),el);return}',
  'if("ent-moto-rm"===o){ev.preventDefault();desligarMotoboyUI(el.getAttribute("data-id"),el);return}',
  'if("ent-moto-salvar"===o){ev.preventDefault();salvarMotoboyUI(el);return}}',
  ''
].join('\n');

const COSTURAS = [
  {
    nome: '1. o bloco do motoboy entra antes do relatorio de entrega',
    de: '// ---- Relatorio de entrega: o que o motoboy precisa saber (08/08/2026) -------',
    para: BLOCO + '// ---- Relatorio de entrega: o que o motoboy precisa saber (08/08/2026) -------'
  },
  {
    nome: '2. abrir o painel pinta a lista e recarrega em seguida',
    de: 'if(E("painelEntrega"))E("painelEntrega").className="painel-cadastro"}',
    // pinta com o que ja esta em memoria (painel abre na hora) e so entao vai ao
    // banco: await antes de abrir deixaria o toque parecendo perdido.
    para: 'if(E("painelEntrega"))E("painelEntrega").className="painel-cadastro";\n'
        + 'pintarMotoboys();carregarMotoboys().then(pintarMotoboys)}'
  },
  {
    nome: '3. o painel de entrega ganha o proprio roteador de clique',
    de: 'Y("painelVenda","click",fvCliClick),',
    para: 'Y("painelVenda","click",fvCliClick),Y("painelEntrega","click",entPainelClick),'
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
