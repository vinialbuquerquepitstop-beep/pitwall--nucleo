// Prova da frente Cliente (identidade CPF/RG/endereco + vinculo com a venda),
// recortada do public/app.js REAL, nao de uma copia: se o arquivo mudar, esta
// prova le a versao nova. Cobre HTML gerado, filtros, roteador de cliques e o
// payload que vai pra RPC. Nao substitui harness.py (Chrome headless, cor
// computada), que nao roda nesta maquina por falta de Python.
//   node ferramentas/prova_cliente.js
const fs = require('fs');
const SRC = fs.readFileSync(process.argv[2] || 'public/app.js', 'utf8');

function recorte(de, ate) {
  const i = SRC.indexOf(de), j = SRC.indexOf(ate, i);
  if (i < 0 || j < 0) throw new Error('nao achei o bloco: ' + de);
  return SRC.slice(i, j);
}

const escReal = recorte('function c(a){return String(null==a?', 'function d(a){');
const telReal = recorte('function f(a){var e=String(a||"").replace(/\\D/g,"")', 'function filtClientes(');
const blocoVendas = recorte('var vendasData=[];', 'function calcLucroVenda()');
const blocoCliente = recorte('var clientesData=[],cliSeg="todos"', '// ---- NF (nota fiscal) da venda');

// --- dubles do mundo de fora ----------------------------------------------
const preludio = `
  ${escReal}
  ${telReal}
  var FONTE={v_venda:[],v_cliente:[]},TOASTS=[],RPC=[],ABERTO=[],RECARGAS=0,ABAS=[];
  var RPC_RESP={ok:true,msg:'Dados do cliente salvos'},RPC_ERRO=null;
  var i=[],n='clientes';
  var CAMPOS={};
  function novoCampo(){return{value:'',className:'',textContent:'',innerHTML:'',disabled:false,
    focus:function(){this.focado=true}}}
  ['inputBusca','lista','painelCliente','pcTitulo','pcErro','pcCpf','pcRg','pcCep','pcEndereco',
   'pcComplemento','pcBairro','pcCidade','pcUf','btnSalvarCliente'].forEach(function(id){CAMPOS[id]=novoCampo()});
  function E(id){return CAMPOS[id]||null}
  function I(m,e){TOASTS.push({msg:m,erro:!!e})}
  var ROTULOS={perfil:{comprou:'Lead — Comprou'},status:{convertido:'Convertido'},
    origem:{indicacao:'Indicação',instagram:'Instagram'},condicao:{lacrado:'Lacrado'}};
  function s(dom,cod){return cod?(ROTULOS[dom]&&ROTULOS[dom][cod])||cod:''}
  function B(){RECARGAS++}
  function G(x){ABAS.push(x)}
  function fmtDia(a){return a?String(a):''}
  function nfLinhaVenda(){return''}
  function abrirPainelVenda(id){ABERTO.push(id===undefined?null:id)}
  var t={
    from:function(tab){return{select:function(){return{
      order:function(){return Promise.resolve({data:(FONTE[tab]||[]).slice()})}
    }}}},
    rpc:function(nome,args){RPC.push({nome:nome,args:args});
      return Promise.resolve(RPC_ERRO?{error:{message:RPC_ERRO}}:{data:RPC_RESP})}
  };
`;

const api = new Function(preludio + blocoVendas + blocoCliente + `
  return {cliFmtCpf,cliFmtCep,cliEndereco,cliIdent,cliFaixa,cliVendas,cardCliente,
          cliChips,detCli,alternarDetalhe,cliDocLinha,
          cliDoSeg,filtCliBusca,carregarClientes,renderClientes,cliAcao,
          abrirPainelCliente,fecharPainelCliente,salvarCliente,fecharComVenda,
          cliVerCliente,vendaCliLinha,cardVenda,carregarVendas,
          setFonte:function(cl,vd){FONTE.v_cliente=cl||[];FONTE.v_venda=vd||[]},
          setLeads:function(l){i=l||[]},
          setBusca:function(q){CAMPOS.inputBusca.value=q},
          setRpc:function(r,e){RPC_RESP=r;RPC_ERRO=e||null},
          campo:function(id){return CAMPOS[id]},
          espiar:function(){return{TOASTS:TOASTS,RPC:RPC,ABERTO:ABERTO,RECARGAS:RECARGAS,ABAS:ABAS,seg:cliSeg}},
          limpar:function(){TOASTS.length=0;RPC.length=0;ABERTO.length=0;ABAS.length=0;RECARGAS=0}};
`)();

let ok = 0; const falhas = [];
function ass(nome, cond, extra) {
  if (cond) { ok++; console.log('  ok  ' + nome); }
  else { falhas.push(nome + (extra ? ' | ' + extra : '')); console.log('FALHOU ' + nome + (extra ? ' | ' + extra : '')); }
}

// --- dados de mentira, no formato exato do v_cliente / v_venda -------------
const VICTOR = {
  id: 'L18', lead_code: 'LEAD-0018', nome: 'Victor Maia Dargains', whatsapp_digitos: '5521988887777',
  produto: 'iPhone 17 Pro Max', condicao: 'lacrado', perfil: 'comprou', status: 'convertido',
  origem: 'instagram', situacao: 'Negociação parada', observacoes: 'Prefere retirada no centro',
  aparelho_entrada: 'iPhone 12', upgrade_entrada: true, valor_oferta: 2300,
  data_contato: '2026-07-09', ultima_resposta: '2026-07-15', data_nascimento: '1994-05-09',
  cpf: '52998224725', rg: '12.345.678-9', cep: '22240000', endereco: 'Rua das Laranjeiras, 100',
  complemento: 'apto 501', bairro: 'Laranjeiras', cidade: 'Rio de Janeiro', uf: 'RJ',
  tem_cpf: true, tem_endereco: true, qtd_compras: null, valor_total: null,
  vendas_qtd: 2, vendas_total: 16800, ultima_venda: '2026-07-16',
  vendas_aparelhos: 'iPhone 17 Pro Max · iPhone 17 Pro Max'
};
const DIEGO = {
  id: 'L01', lead_code: 'LEAD-0001', nome: 'Diego Barbosa', whatsapp_digitos: '5521977776666',
  produto: 'iPhone 13', perfil: 'comprou', cpf: null, rg: null, endereco: null,
  tem_cpf: false, tem_endereco: false, qtd_compras: 1, valor_total: 4899.99,
  vendas_qtd: 0, vendas_total: 0, ultima_venda: null, vendas_aparelhos: null
};
const VENDAS = [
  { id: 'V2', venda_code: 'VENDA-0002', lead_id: 'L18', cliente_code: 'LEAD-0018', cliente_nome: 'Victor Maia Dargains',
    modelo_rotulo: 'iPhone 17 Pro Max', capacidade: '256GB', valor_venda: 8400, lucro: 900, status: 'concluida',
    data_venda: '2026-07-16', cliente_tem_cpf: true, cliente_tem_endereco: true },
  { id: 'V3', venda_code: 'VENDA-0003', lead_id: 'L18', cliente_code: 'LEAD-0018', cliente_nome: 'Victor Maia Dargains',
    modelo_rotulo: 'iPhone 17 Pro Max', capacidade: '256GB', valor_venda: 8400, lucro: 900, status: 'concluida',
    data_venda: '2026-07-10', cliente_tem_cpf: true, cliente_tem_endereco: true },
  { id: 'V1', venda_code: 'VENDA-0001', lead_id: 'L19', cliente_code: 'LEAD-0019', cliente_nome: 'Lucas da silva dos santos',
    modelo_rotulo: '15 Pro Max', valor_venda: 5550, lucro: 400, status: 'concluida',
    data_venda: '2026-07-22', cliente_tem_cpf: false, cliente_tem_endereco: false }
];

(async function () {
  console.log('--- formato de documento ---');
  ass('CPF de 11 digitos vira 000.000.000-00', api.cliFmtCpf('52998224725') === '529.982.247-25');
  ass('CPF ja pontuado nao duplica pontuacao', api.cliFmtCpf('529.982.247-25') === '529.982.247-25');
  ass('CPF incompleto passa reto, sem inventar', api.cliFmtCpf('5299822') === '5299822');
  ass('CEP vira 00000-000', api.cliFmtCep('22240000') === '22240-000');

  console.log('\n--- endereco em uma linha ---');
  ass('endereco completo na ordem do envelope',
    api.cliEndereco(VICTOR) === 'Rua das Laranjeiras, 100 apto 501 · Laranjeiras · Rio de Janeiro/RJ · CEP 22240-000',
    api.cliEndereco(VICTOR));
  ass('pedaco ausente nao vira separador solto',
    api.cliEndereco({ endereco: 'Rua A, 10', cidade: 'Niterói' }) === 'Rua A, 10 · Niterói');
  ass('cliente sem endereco devolve vazio', api.cliEndereco(DIEGO) === '');
  ass('objeto nulo nao explode', api.cliEndereco(null) === '');

  console.log('\n--- identidade no card (sempre visivel) ---');
  const idV = api.cliIdent(VICTOR), idD = api.cliIdent(DIEGO);
  ass('CPF aparece formatado', idV.indexOf('529.982.247-25') >= 0);
  ass('RG aparece', idV.indexOf('12.345.678-9') >= 0);
  ass('endereco aparece', idV.indexOf('Laranjeiras') >= 0);
  ass('cadastro completo nao cobra nada', idV.indexOf('cli-falta') < 0);
  ass('os TRES rotulos existem mesmo no cliente cheio',
    idV.indexOf('>CPF<') >= 0 && idV.indexOf('>RG<') >= 0 && idV.indexOf('>endereço<') >= 0, idV);
  ass('os TRES rotulos existem tambem no cliente vazio',
    idD.indexOf('>CPF<') >= 0 && idD.indexOf('>RG<') >= 0 && idD.indexOf('>endereço<') >= 0, idD);
  ass('campo vazio vira botao adicionar, que abre o painel naquele cliente',
    (idD.match(/data-acao="cli-dados" data-id="L01"/g) || []).length === 3, idD);
  ass('campo preenchido nao oferece adicionar',
    idV.indexOf('cli-doc-add') < 0);
  ass('RG vazio oferece adicionar mesmo com CPF e endereco cheios',
    api.cliIdent({ id: 'z', cpf: '52998224725', endereco: 'Rua A, 1' }).indexOf('cli-doc-add') >= 0);
  ass('cadastro vazio cobra os dois, dizendo pra que serve',
    idD.indexOf('Falta CPF e endereço para emitir nota fiscal') >= 0, idD);
  ass('falta so o endereco quando o CPF existe',
    api.cliIdent({ cpf: '52998224725' }).indexOf('Falta endereço para emitir') >= 0);
  ass('RG sozinho ausente NAO e cobrado (nao trava NF)',
    api.cliIdent({ id: 'z', cpf: '52998224725', endereco: 'Rua A, 1' }).indexOf('cli-falta') < 0);
  ass('cobranca usa morno (cli-falta), nunca a classe de erro',
    idD.indexOf('cli-falta') >= 0 && idD.indexOf('erro') < 0);
  ass('nome hostil no endereco e escapado',
    api.cliIdent({ endereco: '<img src=x onerror=1>' }).indexOf('<img') < 0);

  console.log('\n--- o cliente aproveita o que ja era lead ---');
  const chips = api.cliChips(VICTOR);
  ass('perfil vira chip com o rotulo do dicionario', chips.indexOf('Lead — Comprou') >= 0, chips);
  ass('status vira chip com a classe certa', chips.indexOf('chip st-convertido') >= 0);
  ass('indicacao mostra quem indicou',
    api.cliChips({ origem: 'indicacao', indicado_por: 'Jessica' }).indexOf('Ind. por Jessica') >= 0);
  ass('origem que nao e indicacao nao vira chip de indicacao',
    api.cliChips({ origem: 'instagram' }).indexOf('Ind. por') < 0);
  ass('lead sem nada nao ganha barra de chips vazia', api.cliChips({}) === '');
  const det = api.detCli(VICTOR);
  ass('gaveta traz Origem com rotulo legivel', det.indexOf('Origem') >= 0 && det.indexOf('Instagram') >= 0, det);
  ass('gaveta traz Situação', det.indexOf('Negociação parada') >= 0);
  ass('gaveta traz Interesse com a condicao', det.indexOf('iPhone 17 Pro Max · Lacrado') >= 0);
  ass('gaveta traz Troca com a marca de upgrade', det.indexOf('iPhone 12 (upgrade)') >= 0);
  ass('gaveta traz Avaliação em BRL', det.indexOf('R$ 2.300,00') >= 0);
  ass('datas na gaveta em dd/mm/aaaa', det.indexOf('09/07/2026') >= 0, det);
  ass('gaveta nasce fechada', det.indexOf('aria-expanded="false"') >= 0 && det.indexOf('cli-det aberto') < 0);
  ass('cliente sem nenhum extra nao ganha o botao Detalhes', api.detCli({ id: 'z' }) === '');
  // toggle puro, sem RPC: o mesmo comportamento aprovado na v34
  const fakeCard = {
    _det: { className: 'cli-det' }, _btn: { className: 'btn-clidet', textContent: 'Detalhes', attrs: {},
      setAttribute: function (k, v) { this.attrs[k] = v } },
    querySelector: function (sel) { return sel === '[data-clidet]' ? this._det : this._btn }
  };
  api.alternarDetalhe(fakeCard);
  ass('primeiro toque abre a gaveta', fakeCard._det.className === 'cli-det aberto');
  ass('botao vira Ocultar e anuncia expandido',
    fakeCard._btn.textContent === 'Ocultar' && fakeCard._btn.attrs['aria-expanded'] === 'true');
  api.alternarDetalhe(fakeCard);
  ass('segundo toque fecha', fakeCard._det.className === 'cli-det' && fakeCard._btn.textContent === 'Detalhes');
  ass('card sem gaveta nao quebra', (function () { try { api.alternarDetalhe({ querySelector: function () { return null } }); return true } catch (e) { return false } })());

  console.log('\n--- faixa: lastro x agregado herdado ---');
  const fxV = api.cliFaixa(VICTOR), fxD = api.cliFaixa(DIEGO);
  ass('duas vendas com lastro somam R$ 16.800,00', fxV.indexOf('2 vendas · R$ 16.800,00') >= 0, fxV);
  ass('cliente sem venda diz que falta', fxD.indexOf('sem venda registrada') >= 0);
  ass('sem venda usa a semantica de morno', fxD.indexOf('cli-seg pede') >= 0);
  ass('agregado do CRM antigo aparece rotulado', fxD.indexOf('CRM antigo: 1 · R$ 4.899,99') >= 0, fxD);
  ass('agregado e chip separado, com a classe que o apaga', fxD.indexOf('cli-seg herdado') >= 0);
  ass('cliente sem agregado nao ganha o chip', fxV.indexOf('CRM antigo') < 0);
  ass('aniversario entra como dia/mes', fxV.indexOf('aniv. 09/05') >= 0);

  console.log('\n--- vendas dentro do card do cliente ---');
  api.setFonte([VICTOR, DIEGO], VENDAS);
  await api.carregarVendas();
  const lv = api.cliVendas('L18');
  ass('lista so as vendas daquele cliente',
    lv.indexOf('VENDA-0002') >= 0 && lv.indexOf('VENDA-0003') >= 0 && lv.indexOf('VENDA-0001') < 0);
  ass('mais recente primeiro', lv.indexOf('VENDA-0002') < lv.indexOf('VENDA-0003'));
  ass('valor de cada venda em BRL', lv.indexOf('R$ 8.400,00') >= 0);
  ass('cliente sem venda nao ganha lista vazia', api.cliVendas('L01') === '');

  console.log('\n--- card do cliente ---');
  const card = api.cardCliente(VICTOR);
  ass('card carrega o codigo do lead (chave estavel)', card.indexOf('data-lead="LEAD-0018"') >= 0);
  ass('botao Dados abre a identidade', card.indexOf('data-acao="cli-dados" data-id="L18"') >= 0);
  ass('botao Editar (cadastro de lead) voltou pro card',
    card.indexOf('data-acao="editar" data-id="L18"') >= 0, card.slice(0, 400));
  ass('chips do lead aparecem no card', card.indexOf('Lead — Comprou') >= 0);
  ass('observacao do lead aparece no card', card.indexOf('Prefere retirada no centro') >= 0);
  ass('gaveta Detalhes aparece no card', card.indexOf('data-acao="cli-detalhe"') >= 0);
  ass('botao Registrar venda leva o cliente junto', card.indexOf('data-acao="cli-venda" data-id="L18"') >= 0);
  ass('Historico continua disponivel', card.indexOf('data-acao="historico"') >= 0 && card.indexOf('data-hist') >= 0);
  ass('classe .card mantem o delegado A funcionando', card.indexOf('class="card cliente"') >= 0);
  ass('nome do cliente e escapado',
    api.cardCliente({ id: 'x', nome: '<script>alert(1)</script>' }).indexOf('<script>') < 0);
  ass('cliente sem telefone diz que nao tem',
    api.cardCliente({ id: 'x', nome: 'Sem Tel' }).indexOf('Sem telefone na base') >= 0);

  console.log('\n--- segmentos e busca ---');
  ass('segmento Falta venda pega quem nao tem lastro',
    api.cliDoSeg([VICTOR, DIEGO], 'semvenda').length === 1 && api.cliDoSeg([VICTOR, DIEGO], 'semvenda')[0].id === 'L01');
  ass('segmento Falta cadastro pega quem nao tem CPF ou endereco',
    api.cliDoSeg([VICTOR, DIEGO], 'semdados').length === 1);
  ass('segmento todos devolve todo mundo', api.cliDoSeg([VICTOR, DIEGO], 'todos').length === 2);
  const base = [VICTOR, DIEGO];
  ass('busca por nome', api.filtCliBusca(base, 'victor').length === 1);
  ass('busca por codigo do lead', api.filtCliBusca(base, 'LEAD-0001')[0].id === 'L01');
  ass('busca por CPF digitado com pontuacao', api.filtCliBusca(base, '529.982.247-25')[0].id === 'L18');
  ass('busca por telefone', api.filtCliBusca(base, '988887777')[0].id === 'L18');
  ass('busca por aparelho comprado', api.filtCliBusca(base, '17 pro')[0].id === 'L18');
  ass('termo vazio devolve a lista inteira', api.filtCliBusca(base, '  ').length === 2);
  ass('termo sem correspondencia devolve nada', api.filtCliBusca(base, 'zzz').length === 0);

  console.log('\n--- aba Clientes ---');
  const el = api.campo('lista');
  api.setBusca('');
  await api.renderClientes(el);
  ass('os tres segmentos declaram a contagem',
    el.innerHTML.indexOf('Clientes <span>2</span>') >= 0 &&
    el.innerHTML.indexOf('Falta venda <span>1</span>') >= 0 &&
    el.innerHTML.indexOf('Falta cadastro <span>1</span>') >= 0, el.innerHTML.slice(0, 400));
  ass('os dois clientes aparecem',
    el.innerHTML.indexOf('Victor Maia Dargains') >= 0 && el.innerHTML.indexOf('Diego Barbosa') >= 0);
  api.cliAcao('cli-seg', null, { getAttribute: function () { return 'semvenda' } });
  await new Promise(function (r) { setTimeout(r, 0) });
  ass('segmento Falta venda esconde quem ja tem venda',
    el.innerHTML.indexOf('Diego Barbosa') >= 0 && el.innerHTML.indexOf('Victor Maia') < 0, el.innerHTML.slice(0, 300));

  api.setFonte([], []);
  await api.renderClientes(el);
  ass('sem cliente nenhum a tela ensina o caminho',
    el.innerHTML.indexOf('Nenhum cliente sem venda') >= 0);
  api.cliAcao('cli-seg', null, { getAttribute: function () { return 'todos' } });
  await new Promise(function (r) { setTimeout(r, 0) });
  ass('base vazia diz que a venda cria o cliente',
    el.innerHTML.indexOf('o comprador vira cliente no mesmo ato') >= 0, el.innerHTML.slice(0, 300));
  ass('mesmo vazia a tela declara as tres contagens',
    el.innerHTML.indexOf('Clientes <span>0</span>') >= 0 &&
    el.innerHTML.indexOf('Falta venda <span>0</span>') >= 0);

  console.log('\n--- ida e volta pelo card da venda ---');
  const lin = api.vendaCliLinha(VENDAS[0]), linSem = api.vendaCliLinha(VENDAS[2]);
  ass('venda mostra o codigo do cliente', lin.indexOf('LEAD-0018') >= 0);
  ass('cliente completo nao e cobrado', lin.indexOf('venda-cli-falta') < 0);
  ass('cliente sem cadastro e cobrado na venda', linSem.indexOf('sem CPF nem endereço') >= 0, linSem);
  ass('botao Ver cliente carrega o codigo', lin.indexOf('data-acao="cli-ver" data-code="LEAD-0018"') >= 0);
  ass('venda sem lead nao inventa linha', api.vendaCliLinha({ venda_code: 'X' }) === '');
  ass('card da venda inclui a linha do cliente', api.cardVenda(VENDAS[0]).indexOf('venda-cli') >= 0);
  api.limpar();
  api.cliAcao('cli-ver', null, { getAttribute: function (a) { return a === 'data-code' ? 'LEAD-0018' : null } });
  ass('Ver cliente troca de aba e busca pelo codigo',
    api.espiar().ABAS[0] === 'clientes' && api.campo('inputBusca').value === 'LEAD-0018');

  console.log('\n--- painel Dados do cliente ---');
  api.setFonte([VICTOR, DIEGO], VENDAS);
  await api.carregarClientes();
  api.limpar();
  api.abrirPainelCliente('L18');
  ass('painel abre visivel', api.campo('painelCliente').className === 'painel-cadastro');
  ass('titulo nomeia o cliente', api.campo('pcTitulo').textContent === 'Dados de Victor Maia Dargains');
  ass('CPF entra formatado no campo', api.campo('pcCpf').value === '529.982.247-25');
  ass('CEP entra formatado no campo', api.campo('pcCep').value === '22240-000');
  ass('endereco e complemento em campos separados',
    api.campo('pcEndereco').value === 'Rua das Laranjeiras, 100' && api.campo('pcComplemento').value === 'apto 501');
  api.abrirPainelCliente('L01');
  ass('cliente sem dados abre com os campos limpos',
    api.campo('pcCpf').value === '' && api.campo('pcEndereco').value === '');
  api.abrirPainelCliente('NAO-EXISTE');
  ass('id desconhecido avisa em vez de abrir vazio',
    api.espiar().TOASTS.some(function (x) { return x.erro && /não encontrado/.test(x.msg) }));

  api.limpar();
  api.abrirPainelCliente('L18');
  api.campo('pcCpf').value = '390.533.447-05';
  api.campo('pcUf').value = 'rj';
  await api.salvarCliente();
  const chamada = api.espiar().RPC[0];
  ass('salvar chama a RPC salvar_identidade', chamada && chamada.nome === 'salvar_identidade');
  ass('payload leva o lead e os oito campos',
    chamada.args.p_lead_id === 'L18' && Object.keys(chamada.args.payload).length === 8, JSON.stringify(chamada.args));
  ass('CPF vai como digitado (o banco normaliza e valida)', chamada.args.payload.cpf === '390.533.447-05');
  ass('painel fecha depois de salvar', api.campo('painelCliente').className === 'painel-cadastro oculto');
  ass('a base e relida depois de salvar', api.espiar().RECARGAS === 1);
  ass('toast confirma', api.espiar().TOASTS[0].msg === 'Dados do cliente salvos');

  api.limpar();
  api.setRpc({ ok: false, msg: 'CPF invalido: confira os numeros' });
  api.abrirPainelCliente('L18');
  await api.salvarCliente();
  ass('recusa do banco aparece no painel, nao some',
    api.campo('pcErro').textContent === 'CPF invalido: confira os numeros');
  ass('painel continua aberto quando o banco recusa',
    api.campo('painelCliente').className === 'painel-cadastro');
  ass('base nao e relida quando nada mudou', api.espiar().RECARGAS === 0);

  api.limpar();
  api.setRpc({ ok: true, msg: 'ok' }, 'connection reset');
  api.abrirPainelCliente('L18');
  await api.salvarCliente();
  ass('falha de rede vira mensagem legivel', /^Falha: /.test(api.campo('pcErro').textContent));
  api.setRpc({ ok: true, msg: 'Dados do cliente salvos' });

  console.log('\n--- Fechou na Fila = registrar a venda ---');
  api.limpar();
  api.setLeads([{ id: 'L04', nome: 'Zana', lead_code: 'LEAD-0004' }]);
  api.fecharComVenda('L04');
  ass('abre o formulario de venda com o lead vinculado', api.espiar().ABERTO[0] === 'L04');
  ass('a tela diz por que abriu', /Registre a venda de Zana/.test(api.espiar().TOASTS[0].msg));
  api.limpar();
  api.fecharComVenda('DESCONHECIDO');
  ass('lead fora da base ainda abre o formulario', api.espiar().ABERTO[0] === 'DESCONHECIDO');

  console.log('\n--- roteador de cliques ---');
  api.limpar();
  ass('cli-dados e roteado', api.cliAcao('cli-dados', 'L18', {}) === true);
  ass('cli-venda leva o id do cliente',
    api.cliAcao('cli-venda', 'L18', {}) === true && api.espiar().ABERTO[0] === 'L18');
  const cardFake = {
    _det: { className: 'cli-det' }, _btn: { textContent: 'Detalhes', setAttribute: function () { } },
    querySelector: function (sel) { return sel === '[data-clidet]' ? this._det : this._btn }
  };
  ass('cli-detalhe abre a gaveta pelo card mais proximo',
    api.cliAcao('cli-detalhe', 'L18', { closest: function () { return cardFake } }) === true &&
    cardFake._det.className === 'cli-det aberto');
  ass('acao de outro dominio nao e sequestrada', api.cliAcao('nova-venda', null, {}) === false);
  ass('acao desconhecida devolve false', api.cliAcao('xpto', null, {}) === false);

  console.log('\n=== ' + ok + ' assercoes, ' + falhas.length + ' falhas ===');
  if (falhas.length) { falhas.forEach(function (f) { console.log(' - ' + f); }); process.exit(1); }
  process.exit(0);
})();
