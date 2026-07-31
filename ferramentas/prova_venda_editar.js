// Prova da CORRECAO e do ARQUIVAMENTO de venda (31/07/2026), recortada do
// public/app.js real, nao de uma copia: se o arquivo mudar, esta prova le a
// versao nova. O que ela guarda, em uma frase: a tela nunca manda data_venda
// nem lead_id na correcao (sao a ancora do pos-venda e o dono da venda), e
// arquivar nunca acontece sem o operador ler o que vai perder.
// Nao substitui harness.py (Chrome headless, cor computada), que segue sem
// rodar nesta maquina por falta de Python.
//   node ferramentas/prova_venda_editar.js
const fs = require('fs');
const SRC = fs.readFileSync(process.argv[2] || 'public/app.js', 'utf8');

function recorte(de, ate) {
  const i = SRC.indexOf(de), j = SRC.indexOf(ate, i);
  if (i < 0 || j < 0) throw new Error('nao achei o bloco: ' + de);
  return SRC.slice(i, j);
}

const escReal = recorte('function c(a){return String(null==a?', 'function d(a){');
const telReal = recorte('function f(a){var e=String(a||"").replace(/\\D/g,"")', 'function filtClientes(');
const cliReal = recorte('function cliDig(x){', '// As TRES linhas aparecem sempre');
const blocoVendas = recorte('var vendasData=[]', 'function calcLucroVenda()');
const blocoPainel = recorte('function calcLucroVenda()', '// ---- Aba Clientes');

// --- dubles do mundo de fora ----------------------------------------------
// E() fabrica o elemento na primeira chamada: o painel tem 30 campos e listar
// todos aqui so criaria uma segunda lista para divergir da primeira.
const preludio = `
  ${escReal}
  ${telReal}
  ${cliReal}
  var FONTE={v_venda:[],venda:[],catalogo_iphone:[]};
  var TOASTS=[],RPC=[],CONSULTAS=[],CONFIRMS=[],RELEU=0;
  var RPC_RESP={ok:true},CONFIRMA=true;
  var i=[],n='vendas',ELS={};
  function I(m,e){TOASTS.push({msg:m,erro:!!e})}
  function B(){RELEU++}
  function fmtDia(a){return a?String(a).split('-').reverse().join('/'):''}
  function nfLinhaVenda(){return ''}
  function carregarNfs(){return Promise.resolve()}
  function subirNf(){return Promise.resolve({ok:true})}
  function E(id){
    if(!ELS[id])ELS[id]={value:'',disabled:false,textContent:'',innerHTML:'',
      className:'',files:null,focus:function(){},
      setAttribute:function(k,v){this[k]=v},
      getAttribute:function(k){return this[k]}};
    return ELS[id]}
  function alvo(tab){return{
    order:function(){CONSULTAS.push({tabela:tab,filtro:null});
      return Promise.resolve({data:(FONTE[tab]||[]).slice()})},
    eq:function(){return alvo(tab)},
    not:function(col,op,val){CONSULTAS.push({tabela:tab,filtro:col+' '+op+' '+val});
      return{order:function(){return Promise.resolve({data:(FONTE[tab]||[]).slice()})}}}
  }}
  var t={
    from:function(tab){return{select:function(){return alvo(tab)}}},
    rpc:function(nome,args){RPC.push({nome:nome,args:args});
      return Promise.resolve({data:RPC_RESP})}
  };
  var window={confirm:function(m){CONFIRMS.push(m);return CONFIRMA}};
`;

const api = new Function(preludio + blocoVendas + blocoPainel + `
  return {vendaCliLinha,cardVenda,cardVendaArq,renderVendas,carregarVendas,
          carregarVendasArq,abrirPainelVenda,fecharPainelVenda,salvarVenda,
          arquivarVendaUI,desarquivarVenda,vendaAcao,fvCliClick,
          setFonte:function(v,a){FONTE.v_venda=v;FONTE.venda=a},
          setLeads:function(l){i=l},
          setCampo:function(id,v){E(id).value=v},
          campo:function(id){return E(id)},
          modoEdicao:function(){return VENDA_EDIT},
          setRpcResp:function(r){RPC_RESP=r},
          setConfirma:function(b){CONFIRMA=b},
          espiar:function(){return{RPC:RPC,TOASTS:TOASTS,CONFIRMS:CONFIRMS,
            CONSULTAS:CONSULTAS,RELEU:RELEU,aba:n}},
          limpar:function(){RPC.length=0;TOASTS.length=0;CONFIRMS.length=0;
            CONSULTAS.length=0;RELEU=0}};
`)();

let ok = 0; const falhas = [];
// Build quebrado tem que REPROVAR, nunca estourar: prova que morre no meio nao
// diz qual assercao caiu. Toast ausente vira toast vazio e a assercao falha.
function tst(s, k) { return (s.TOASTS || [])[k || 0] || { msg: '', erro: false } }
function ass(nome, cond, extra) {
  if (cond) { ok++; console.log('  ok  ' + nome); }
  else { falhas.push(nome + (extra ? ' | ' + extra : '')); console.log('FALHOU ' + nome + (extra ? ' | ' + extra : '')); }
}

// --- dados: espelham a linha real que motivou a obra ----------------------
// VENDA-0002 e VENDA-0003 sao a duplicata de clique duplo do Victor (LEAD-0018).
const V2 = {
  id: 'v2', venda_code: 'VENDA-0002', lead_id: 'L18', cliente_code: 'LEAD-0018',
  cliente_nome: 'Victor Maia Dargains', cliente_tem_cpf: true, cliente_tem_endereco: true,
  modelo_texto: 'iPhone 17 Pro Max', modelo_rotulo: 'iPhone 17 Pro Max', capacidade: '256GB',
  cor: 'Titânio', condicao: 'lacrado', imei: '111111111111111', status: 'concluida',
  valor_venda: 8400, custo_aparelho: 7000, despesa_frete: 100, despesa_taxas: 50,
  comprador_nome: 'Victor Maia Dargains', comprador_whatsapp: '21999998888',
  comprador_cpf: '12345678909', comprador_nascimento: '1990-05-02',
  comprador_instagram: '@victor', fornecedor_nome: 'Fornecedor X',
  fornecedor_contato: '11988887777', fornecedor_local_retirada: 'São Paulo',
  entrada_modelo: '', entrada_imei: '', entrada_valor: null, tem_trade_in: false,
  endereco_entrega: 'Rua A, 10', valor_a_cobrar: 0, motoboy: 'Zé',
  forma_pagamento: 'pix', nf_numero: '2050', observacoes: 'entregar à tarde',
  data_venda: '2026-07-16'
};
const V3 = Object.assign({}, V2, { id: 'v3', venda_code: 'VENDA-0003', nf_numero: '', observacoes: '' });
const V1 = {
  id: 'v1', venda_code: 'VENDA-0001', lead_id: 'L19', cliente_code: 'LEAD-0019',
  cliente_nome: 'Ana', cliente_tem_cpf: false, cliente_tem_endereco: false,
  modelo_texto: 'iPhone 15', modelo_rotulo: 'iPhone 15', valor_venda: 5000,
  status: 'concluida', data_venda: '2026-07-20'
};
const SEM_DONO = { id: 'v0', venda_code: 'VENDA-0000', modelo_rotulo: 'iPad', valor_venda: 3000, status: 'concluida' };
const ARQ = {
  id: 'v3', venda_code: 'VENDA-0003', modelo_texto: 'iPhone 17 Pro Max',
  comprador_nome: 'Victor Maia Dargains', valor_venda: 8400,
  data_venda: '2026-07-16', arquivado_em: '2026-07-31T10:00:00Z'
};

(async function () {
  console.log('\n--- card: o caminho para corrigir existe em toda venda ---');
  const lin = api.vendaCliLinha(V2);
  ass('o card traz Editar com o id da venda',
    lin.indexOf('data-acao="venda-editar" data-id="v2"') >= 0, lin);
  ass('venda com cliente mantem o Ver cliente', lin.indexOf('data-acao="cli-ver"') >= 0);
  const linSem = api.vendaCliLinha(SEM_DONO);
  ass('venda sem cliente TAMBEM pode ser corrigida',
    linSem.indexOf('data-acao="venda-editar" data-id="v0"') >= 0, linSem);
  ass('venda sem cliente nao inventa codigo de cliente',
    linSem.indexOf('venda-cli-code') < 0, linSem);
  ass('venda sem cliente nao oferece Ver cliente', linSem.indexOf('cli-ver') < 0);
  ass('cliente sem cadastro segue cobrado na venda',
    api.vendaCliLinha(V1).indexOf('sem CPF nem endereço') >= 0);
  // Arquivar NAO mora no card: e destrutivo e vive atras da confirmacao do painel.
  ass('arquivar nao aparece solto na lista',
    api.cardVenda(V2).indexOf('venda-arquivar') < 0);

  console.log('\n--- roteador da aba Vendas ---');
  api.setFonte([V2, V3, V1], [ARQ]);
  await api.carregarVendas();
  api.limpar();
  ass('venda-editar e roteado', api.vendaAcao('venda-editar', 'v2') === true);
  await new Promise(function (r) { setTimeout(r, 0) });
  ass('abre a venda certa', api.modoEdicao() && api.modoEdicao().id === 'v2');
  ass('acao de outro dominio nao e sequestrada', api.vendaAcao('cli-ver', 'x') === false);
  api.fecharPainelVenda();
  ass('id fora da base nao abre painel vazio',
    api.vendaAcao('venda-editar', 'nao-existe') === true && api.modoEdicao() === null);

  console.log('\n--- painel em modo correcao ---');
  await api.abrirPainelVenda(null, V2);
  ass('titulo nomeia a venda', api.campo('pvTitulo').textContent === 'Editar VENDA-0002',
    api.campo('pvTitulo').textContent);
  ass('o botao diz que corrige, nao que cadastra',
    api.campo('btnSalvarVenda').textContent === 'Salvar correção');
  ass('painel entra em modo-edicao (a CSS esconde busca e upload)',
    api.campo('painelVenda').className === 'painel-cadastro modo-edicao',
    api.campo('painelVenda').className);
  ass('modelo preenchido', api.campo('fvModelo').value === 'iPhone 17 Pro Max');
  ass('valor preenchido', api.campo('fvValor').value === '8400');
  ass('custo e despesas preenchidos',
    api.campo('fvCusto').value === '7000' && api.campo('fvFrete').value === '100' && api.campo('fvTaxas').value === '50');
  ass('imei preenchido', api.campo('fvImei').value === '111111111111111');
  ass('fornecedor preenchido', api.campo('fvFornNome').value === 'Fornecedor X');
  ass('numero da NF e observacao preenchidos',
    api.campo('fvNfNum').value === '2050' && api.campo('fvObs').value === 'entregar à tarde');
  ass('whatsapp do comprador entra formatado',
    api.campo('fvWhats').value === '(21) 99999-8888', api.campo('fvWhats').value);
  ass('cpf do comprador entra formatado',
    api.campo('fvCpf').value === '123.456.789-09', api.campo('fvCpf').value);
  ass('data preenchida', api.campo('fvData').value === '2026-07-16');
  // a data ancora o pos-venda desde a v43: aqui ela e leitura, com a razao ao lado
  ass('data NAO e editavel na correcao', api.campo('fvData').disabled === true);
  ass('o cliente aparece em leitura, com o codigo',
    api.campo('fvLeadStatus').innerHTML.indexOf('LEAD-0018') >= 0);
  ass('e a tela diz que mover de cliente e outro caminho',
    api.campo('fvLeadStatus').innerHTML.indexOf('para mover de cliente') >= 0);
  await api.abrirPainelVenda(null, SEM_DONO);
  ass('venda sem cliente declara isso em vez de mentir',
    api.campo('fvLeadStatus').innerHTML.indexOf('sem cliente vinculado') >= 0);

  console.log('\n--- o payload da correcao ---');
  await api.abrirPainelVenda(null, V2);
  api.setCampo('fvValor', '8399,50');
  api.setCampo('fvObs', 'valor corrigido');
  api.limpar();
  await api.salvarVenda();
  let s = api.espiar();
  ass('correcao chama editar_venda', s.RPC.length === 1 && s.RPC[0].nome === 'editar_venda',
    JSON.stringify(s.RPC.map(function (r) { return r.nome })));
  ass('e nao registrar_venda (nao duplica a venda)',
    s.RPC.filter(function (r) { return r.nome === 'registrar_venda' }).length === 0);
  const pe = s.RPC[0].args.payload;
  ass('payload leva o id da venda', pe.id === 'v2');
  // os dois campos que o dono tirou do escopo: a RPC ja os ignora, mas mandar
  // campo que nao vale mente para quem ler este codigo depois
  ass('payload NAO leva data_venda', !('data_venda' in pe), Object.keys(pe).join(','));
  ass('payload NAO leva lead_id', !('lead_id' in pe));
  ass('payload leva o valor corrigido', pe.valor_venda === '8399,50');
  ass('payload leva a observacao corrigida', pe.observacoes === 'valor corrigido');
  ass('payload leva o modelo', pe.modelo_texto === 'iPhone 17 Pro Max');
  ass('toast confirma nomeando a venda',
    s.TOASTS.length === 1 && tst(s).msg.indexOf('corrigida') >= 0 && !tst(s).erro,
    JSON.stringify(s.TOASTS));
  ass('painel fecha depois de corrigir', api.campo('painelVenda').className.indexOf('oculto') >= 0);
  ass('a base e relida', s.RELEU === 1);

  console.log('\n--- correcao recusada ---');
  await api.abrirPainelVenda(null, V2);
  api.setCampo('fvValor', '0');
  api.limpar();
  await api.salvarVenda();
  ass('valor zero nem chega ao servidor', api.espiar().RPC.length === 0);
  ass('e a tela diz onde consertar',
    api.campo('fvErro').textContent.indexOf('valor') >= 0, api.campo('fvErro').textContent);
  api.setCampo('fvValor', '8400'); api.setCampo('fvModelo', '');
  api.limpar();
  await api.salvarVenda();
  ass('modelo vazio nem chega ao servidor', api.espiar().RPC.length === 0);
  // a exigencia de cliente e do CADASTRO: na correcao o dono ja existe e o
  // bloco de busca esta oculto, entao cobrar aqui travaria a correcao
  api.setCampo('fvModelo', 'iPhone 17 Pro Max'); api.setCampo('fvNome', '');
  api.limpar();
  await api.salvarVenda();
  ass('correcao nao e travada por cliente (ele ja existe)',
    api.espiar().RPC.length === 1 && api.espiar().RPC[0].nome === 'editar_venda');

  await api.abrirPainelVenda(null, V2);
  api.setRpcResp({ ok: false, erro: 'Venda arquivada: desarquive antes de corrigir.' });
  api.limpar();
  await api.salvarVenda();
  s = api.espiar();
  ass('recusa do banco vira toast de erro',
    s.TOASTS.length === 1 && tst(s).erro && tst(s).msg.indexOf('desarquive') >= 0,
    JSON.stringify(s.TOASTS));
  ass('painel continua aberto quando o banco recusa',
    api.campo('painelVenda').className.indexOf('oculto') < 0);
  ass('base nao e relida quando nada mudou', s.RELEU === 0);
  api.setRpcResp({ ok: true });

  console.log('\n--- sair da correcao devolve o painel ao cadastro ---');
  api.fecharPainelVenda();
  ass('a data volta a ser editavel', api.campo('fvData').disabled === false);
  ass('o painel sai do modo edicao', api.modoEdicao() === null);
  await api.abrirPainelVenda();
  ass('cadastro novo nao herda o modelo da correcao', api.campo('fvModelo').value === '');
  ass('nem o valor', api.campo('fvValor').value === '');
  ass('nem o fornecedor', api.campo('fvFornNome').value === '');
  ass('nem o numero da NF', api.campo('fvNfNum').value === '');
  ass('titulo volta a Nova venda', api.campo('pvTitulo').textContent === 'Nova venda');
  ass('painel volta ao modo cadastro', api.campo('painelVenda').className === 'painel-cadastro');
  api.setCampo('fvValor', '1000'); api.setCampo('fvModelo', 'iPhone 13'); api.setCampo('fvNome', 'Novo');
  api.limpar();
  await api.salvarVenda();
  ass('e volta a cadastrar pela registrar_venda',
    api.espiar().RPC.length === 1 && api.espiar().RPC[0].nome === 'registrar_venda');

  console.log('\n--- arquivar: destrutivo, atras de confirmacao ---');
  await api.abrirPainelVenda(null, V3);
  api.limpar(); api.setConfirma(false);
  await api.arquivarVendaUI();
  ass('sem confirmar, nada acontece', api.espiar().RPC.length === 0);
  ass('painel continua aberto', api.campo('painelVenda').className.indexOf('oculto') < 0);
  const msg = api.espiar().CONFIRMS[0] || '';
  ass('a confirmacao nomeia a venda', msg.indexOf('VENDA-0003') >= 0, msg);
  ass('e diz que sai do faturamento', msg.indexOf('faturamento') >= 0, msg);
  ass('e diz que da pra voltar atras', msg.indexOf('desarquivar') >= 0, msg);
  // Victor tem duas vendas: arquivar uma nao o deixa sem venda
  ass('com outra venda viva, nao avisa que o cliente fica sem venda',
    msg.indexOf('única venda') < 0, msg);

  api.limpar(); api.setConfirma(true);
  api.setRpcResp({ ok: true, venda_code: 'VENDA-0003', arquivada: true, cliente_ficou_sem_venda: false });
  await api.arquivarVendaUI();
  s = api.espiar();
  ass('arquivar chama a RPC com p_arquivar true',
    s.RPC.length === 1 && s.RPC[0].nome === 'arquivar_venda' &&
    s.RPC[0].args.p_id === 'v3' && s.RPC[0].args.p_arquivar === true,
    JSON.stringify(s.RPC));
  ass('toast confirma', tst(s).msg.indexOf('VENDA-0003 arquivada') >= 0);
  ass('painel fecha e a base e relida',
    api.campo('painelVenda').className.indexOf('oculto') >= 0 && s.RELEU === 1);

  // LEAD-0019 tem uma venda so: o aviso tem que chegar ANTES do clique
  await api.abrirPainelVenda(null, V1);
  api.limpar(); api.setConfirma(false);
  await api.arquivarVendaUI();
  const msg1 = api.espiar().CONFIRMS[0] || '';
  ass('unica venda do cliente: a confirmacao avisa antes',
    msg1.indexOf('única venda') >= 0, msg1);
  ass('e diz que ele continua cliente, com o pos-venda rodando',
    msg1.indexOf('pós-venda') >= 0, msg1);

  api.setConfirma(true);
  api.setRpcResp({ ok: true, venda_code: 'VENDA-0001', arquivada: true, cliente_ficou_sem_venda: true });
  api.limpar();
  await api.arquivarVendaUI();
  ass('o toast repete o que o banco confirmou sobre o cliente',
    tst(api.espiar()).msg.indexOf('sem venda ativa') >= 0,
    JSON.stringify(api.espiar().TOASTS));

  await api.abrirPainelVenda(null, V3);
  api.setRpcResp({ ok: false, erro: 'Venda nao encontrada.' });
  api.limpar();
  await api.arquivarVendaUI();
  ass('falha ao arquivar vira erro legivel e o painel fica',
    tst(api.espiar()).erro === true && api.campo('painelVenda').className.indexOf('oculto') < 0);
  api.setRpcResp({ ok: true });
  api.fecharPainelVenda();

  console.log('\n--- desarquivar ---');
  api.limpar(); api.setConfirma(false);
  await api.desarquivarVenda('v3');
  ass('desarquivar tambem pede confirmacao', api.espiar().RPC.length === 0);
  ass('e explica que volta a contar no faturamento',
    (api.espiar().CONFIRMS[0] || '').indexOf('faturamento') >= 0);
  api.setConfirma(true);
  api.setRpcResp({ ok: true, venda_code: 'VENDA-0003', arquivada: false });
  api.limpar();
  await api.desarquivarVenda('v3');
  s = api.espiar();
  ass('desarquivar chama a MESMA RPC com p_arquivar false',
    s.RPC.length === 1 && s.RPC[0].nome === 'arquivar_venda' && s.RPC[0].args.p_arquivar === false,
    JSON.stringify(s.RPC));
  ass('toast confirma o retorno', tst(s).msg.indexOf('desarquivada') >= 0);

  console.log('\n--- a lista das arquivadas ---');
  api.limpar();
  await api.carregarVendasArq();
  s = api.espiar();
  // a v_venda filtra arquivado_em is null: ler dali devolveria lista vazia para
  // sempre. Vem da TABELA, que o RLS ja isola por tenant.
  ass('as arquivadas vem da tabela venda, nao da v_venda',
    s.CONSULTAS.length === 1 && s.CONSULTAS[0].tabela === 'venda', JSON.stringify(s.CONSULTAS));
  ass('e filtrando por arquivado_em preenchido',
    s.CONSULTAS[0].filtro === 'arquivado_em is null');

  const el = { innerHTML: '' };
  api.setFonte([V2, V1], [ARQ]);
  await api.renderVendas(el);
  ass('o contador declara as vendas ativas', el.innerHTML.indexOf('2 vendas') >= 0, el.innerHTML.slice(0, 300));
  ass('e declara a arquivada em singular',
    el.innerHTML.indexOf('>1 arquivada<') >= 0, el.innerHTML.slice(0, 400));
  ass('a arquivada nao polui a lista ativa', el.innerHTML.indexOf('VENDA-0003') < 0);
  ass('fechada, a lista de arquivadas nao aparece',
    el.innerHTML.indexOf('não contam no faturamento') < 0);
  ass('o contador de arquivadas e um botao', el.innerHTML.indexOf('data-acao="venda-arq-alternar"') >= 0);

  api.vendaAcao('venda-arq-alternar');
  await new Promise(function (r) { setTimeout(r, 0) });
  await api.renderVendas(el);
  ass('aberta, a secao declara que aquilo nao conta no faturamento',
    el.innerHTML.indexOf('não contam no faturamento') >= 0);
  ass('o card arquivado aparece', el.innerHTML.indexOf('VENDA-0003') >= 0);
  ass('com Desarquivar carregando o id',
    el.innerHTML.indexOf('data-acao="venda-desarquivar" data-id="v3"') >= 0);
  api.vendaAcao('venda-arq-alternar');
  await new Promise(function (r) { setTimeout(r, 0) });
  await api.renderVendas(el);
  ass('clicando de novo, fecha', el.innerHTML.indexOf('não contam no faturamento') < 0);

  const cArq = api.cardVendaArq(ARQ);
  // arquivada nao e falha de sistema: familia neutra, nunca a classe de erro
  ass('o card arquivado se identifica pela classe', cArq.indexOf('card arquivada') >= 0);
  ass('e diz em palavras que esta fora do faturamento',
    cArq.indexOf('fora do faturamento') >= 0);
  ass('mostra o valor que saiu da conta', cArq.indexOf('R$ 8.400,00') >= 0, cArq);
  ass('arquivada nunca usa a semantica de erro', cArq.indexOf('erro') < 0);
  const xss = api.cardVendaArq({ id: 'x', venda_code: 'V', modelo_texto: '<img src=x onerror=alert(1)>', comprador_nome: '<b>a</b>', valor_venda: 1 });
  ass('modelo hostil sai escapado', xss.indexOf('<img src=x') < 0 && xss.indexOf('&lt;img') >= 0);
  ass('nome hostil sai escapado', xss.indexOf('<b>a</b>') < 0);

  console.log('\n--- o botao Arquivar do rodape do painel ---');
  await api.abrirPainelVenda(null, V3);
  api.limpar(); api.setConfirma(false);
  api.fvCliClick({ target: { closest: function () { return { getAttribute: function () { return 'venda-arquivar' } } } } });
  await new Promise(function (r) { setTimeout(r, 0) });
  ass('o clique no rodape chega ao arquivamento', api.espiar().CONFIRMS.length === 1);
  api.fecharPainelVenda();

  console.log('\n=== ' + ok + ' assercoes, ' + falhas.length + ' falhas ===');
  if (falhas.length) { falhas.forEach(function (f) { console.log(' - ' + f); }); process.exit(1); }
  process.exit(0);
})();
