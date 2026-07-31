// Prova das funcoes de NF (upload, card da venda, aba Notas fiscais) recortadas
// do public/app.js real, nao de uma copia: se o arquivo mudar, esta prova le a
// versao nova. Nao substitui harness.py (Chrome headless, cor computada), que
// nao roda nesta maquina por falta de Python. Cobre HTML gerado e logica pura,
// mais o ponto que importa para seguranca: o CAMINHO montado no bucket.
//   node ferramentas/prova_nf.js
const fs = require('fs');
const SRC = fs.readFileSync(process.argv[2] || 'public/app.js', 'utf8');

function recorte(de, ate) {
  const i = SRC.indexOf(de), j = SRC.indexOf(ate, i);
  if (i < 0 || j < 0) throw new Error('nao achei o bloco: ' + de);
  return SRC.slice(i, j);
}

const escReal = recorte('function c(a){return String(null==a?', 'function d(a){');
const blocoVendas = recorte('var vendasData=[]', 'function calcLucroVenda()');
const blocoNf = recorte('var nfsData=[],NF_TENANT=null', 'function G(x){M();R();');

// --- dublês do mundo de fora ---------------------------------------------
const preludio = `
  ${escReal}
  var FONTE={v_venda:[],v_venda_nf:[]},TOASTS=[],SUBIU=[],RPC=[],SIGN=[];
  var UPLOAD_ERRO=null,RPC_RESP={ok:true},CAMPOS={inputBusca:{value:''}};
  var n='nfs';
  function I(m,e){TOASTS.push({msg:m,erro:!!e})}
  function E(id){return CAMPOS[id]||null}
  var t={
    from:function(tab){return{select:function(){return{
      order:function(){return Promise.resolve({data:(FONTE[tab]||[]).slice()})},
      limit:function(){return Promise.resolve({data:[{tenant_id:'TEN-1'}]})}
    }}}},
    storage:{from:function(b){return{
      upload:function(caminho,file,opt){SUBIU.push({bucket:b,caminho:caminho,opt:opt,nome:file.name});
        return Promise.resolve(UPLOAD_ERRO?{error:{message:UPLOAD_ERRO}}:{data:{path:caminho}})},
      createSignedUrl:function(caminho,seg){SIGN.push({caminho:caminho,seg:seg});
        return Promise.resolve({data:{signedUrl:'https://exemplo/'+caminho+'?t='+seg}})}
    }}},
    rpc:function(nome,args){RPC.push({nome:nome,args:args});return Promise.resolve({data:RPC_RESP})}
  };
  var window={crypto:{randomUUID:function(){return 'UUID-FIXO'}},confirm:function(){return true},open:function(){return {location:{}}}};
`;

const api = new Function(preludio + blocoVendas + blocoNf + `
  return {nfExt,nfTam,nfQuando,nfLinhaVenda,nfItem,cardNf,cardVenda,nfSemNota,
          filtNfBusca,nfsDaVenda,subirNf,carregarNfs,carregarVendas,renderNfs,
          setFonte:function(v,f){FONTE.v_venda=v;FONTE.v_venda_nf=f},
          setSeg:function(s){nfSeg=s},
          setBusca:function(q){CAMPOS.inputBusca={value:q}},
          setUploadErro:function(e){UPLOAD_ERRO=e},
          setRpcResp:function(r){RPC_RESP=r},
          espiar:function(){return{SUBIU:SUBIU,RPC:RPC,SIGN:SIGN,TOASTS:TOASTS}},
          limpar:function(){SUBIU.length=0;RPC.length=0;SIGN.length=0;TOASTS.length=0}};
`)();

let ok = 0; const falhas = [];
function ass(nome, cond, extra) {
  if (cond) { ok++; console.log('  ok  ' + nome); }
  else { falhas.push(nome + (extra ? ' | ' + extra : '')); console.log('FALHOU ' + nome + (extra ? ' | ' + extra : '')); }
}

// --- dados ----------------------------------------------------------------
const V1 = { id: 'v1', venda_code: 'VENDA-0001', modelo_rotulo: 'iPhone 15', capacidade: '128GB', cliente_nome: 'Ana', status: 'concluida', valor_venda: 5000, lucro: 900, nf_numero: '1042', data_venda: '2026-07-20' };
const V2 = { id: 'v2', venda_code: 'VENDA-0002', modelo_rotulo: 'iPhone 13', cliente_nome: 'Bruno', status: 'concluida', valor_venda: 3000, lucro: 400 };
const V3 = { id: 'v3', venda_code: 'VENDA-0003', modelo_rotulo: 'iPad', cliente_nome: 'Caio', status: 'cancelada', valor_venda: 2000, lucro: 0 };
const NF1 = { id: 'nf1', venda_id: 'v1', venda_code: 'VENDA-0001', numero: '1042', arquivo: 'TEN-1/v1/aaa.pdf', nome_original: 'nota.pdf', mime: 'application/pdf', tamanho: 204800, enviado_em: '2026-07-21T13:00:00Z', cliente_nome: 'Ana', modelo_rotulo: 'iPhone 15', capacidade: '128GB', data_venda: '2026-07-20' };
const NF2 = { id: 'nf2', venda_id: 'v1', venda_code: 'VENDA-0001', numero: null, arquivo: 'TEN-1/v1/bbb.jpg', nome_original: 'foto.jpg', tamanho: 1572864, enviado_em: '2026-07-22T13:00:00Z', cliente_nome: 'Ana', modelo_rotulo: 'iPhone 15' };

console.log('\n--- extensao e tamanho: o que vira nome de arquivo ---');
ass('pdf maiusculo vira minusculo', api.nfExt('NOTA.PDF') === 'pdf');
ass('nome com varios pontos pega a ultima', api.nfExt('nf.2026.07.jpeg') === 'jpeg');
ass('sem extensao cai em bin', api.nfExt('recibo') === 'bin');
ass('extensao suja e limpa', api.nfExt('nf.p df!') === 'pdf');
ass('extensao so de simbolo cai em bin', api.nfExt('nf.???') === 'bin');
ass('KB abaixo de 1 MB', api.nfTam(204800) === '200 KB');
ass('MB com uma casa', api.nfTam(1572864) === '1.5 MB');
ass('arquivo minusculo nunca mostra 0 KB', api.nfTam(120) === '1 KB');
ass('data em pt-BR', api.nfQuando('2026-07-21T13:00:00Z') === '21/07/2026', api.nfQuando('2026-07-21T13:00:00Z'));
ass('data vazia nao quebra', api.nfQuando(null) === '');

console.log('\n--- caminho no bucket: a policy do Storage exige {tenant}/{venda}/ ---');
(async function () {
  api.limpar();
  const r = await api.subirNf({ name: 'Nota Fiscal.PDF', type: '', size: 1000 }, 'v1', '1042');
  const s = api.espiar();
  ass('sobe no bucket nf', s.SUBIU.length === 1 && s.SUBIU[0].bucket === 'nf');
  // {tenant}/{venda}/{id unico}.{ext}: e exatamente o que a policy do Storage e a
  // RPC conferem. Nome do arquivo do cliente NUNCA entra no caminho.
  const CAMINHO = /^TEN-1\/v1\/[A-Za-z0-9-]+\.pdf$/;
  ass('caminho comeca no tenant e passa pela venda',
    CAMINHO.test(s.SUBIU[0].caminho), s.SUBIU[0].caminho);
  ass('nome original do arquivo nao vai para o caminho',
    s.SUBIU[0].caminho.toLowerCase().indexOf('nota fiscal') < 0 && s.SUBIU[0].caminho.indexOf(' ') < 0);
  ass('mime deduzido da extensao quando o browser nao manda',
    s.SUBIU[0].opt.contentType === 'application/pdf');
  ass('nao sobrescreve arquivo existente', s.SUBIU[0].opt.upsert === false);
  ass('registra o ponteiro pela RPC anexar_nf', s.RPC.length === 1 && s.RPC[0].nome === 'anexar_nf');
  ass('payload leva caminho, numero, nome e tamanho',
    s.RPC[0].args.payload.arquivo === s.SUBIU[0].caminho &&
    s.RPC[0].args.payload.numero === '1042' &&
    s.RPC[0].args.payload.nome_original === 'Nota Fiscal.PDF' &&
    s.RPC[0].args.payload.tamanho === '1000');
  ass('devolve ok quando as duas pontas passam', r.ok === true);

  api.limpar(); api.setUploadErro('bucket cheio');
  const r2 = await api.subirNf({ name: 'x.pdf', type: 'application/pdf', size: 10 }, 'v1', '');
  ass('upload que falha NAO registra ponteiro', api.espiar().RPC.length === 0);
  ass('erro do upload chega legivel', r2.ok === false && r2.erro === 'bucket cheio');
  api.setUploadErro(null);

  api.limpar(); api.setRpcResp({ ok: false, erro: 'Caminho do arquivo fora da pasta da venda' });
  const r3 = await api.subirNf({ name: 'x.pdf', type: 'application/pdf', size: 10 }, 'v1', '');
  ass('recusa da RPC vira mensagem, nao sucesso',
    r3.ok === false && r3.erro === 'Caminho do arquivo fora da pasta da venda');
  api.setRpcResp({ ok: true });

  console.log('\n--- card da venda: com nota x sem nota ---');
  api.setFonte([V1, V2, V3], [NF1, NF2]);
  await api.carregarVendas(); await api.carregarNfs();

  const comNota = api.nfLinhaVenda(V1);
  ass('venda com 2 notas conta as duas', comNota.indexOf('2 notas') >= 0, comNota);
  ass('mostra o numero da nota da venda', comNota.indexOf('nº 1042') >= 0);
  ass('com nota o botao e Ver NF', comNota.indexOf('>Ver NF<') >= 0);
  ass('com nota o botao nao pede acao', comNota.indexOf('nf-pede') < 0);

  const semNota = api.nfLinhaVenda(V2);
  ass('venda sem nota declara que falta', semNota.indexOf('sem nota fiscal') >= 0);
  ass('sem nota o botao e Anexar NF', semNota.indexOf('>Anexar NF<') >= 0);
  ass('sem nota o botao pede acao (morno)', semNota.indexOf('nf-pede') >= 0);
  ass('o botao carrega o id da venda', semNota.indexOf('data-acao="nf-anexar" data-id="v2"') >= 0);
  ass('card da venda inclui a linha de NF', api.cardVenda(V2).indexOf('nf-linha') >= 0);

  console.log('\n--- item de NF: dado + acao, sem vazar HTML ---');
  const it = api.nfItem(NF1);
  ass('mostra o nome do arquivo', it.indexOf('<strong>nota.pdf</strong>') >= 0);
  ass('mostra numero, tamanho e data', it.indexOf('nº 1042') >= 0 && it.indexOf('200 KB') >= 0 && it.indexOf('21/07/2026') >= 0);
  ass('fora do painel mostra de qual venda e', it.indexOf('VENDA-0001') >= 0);
  ass('no painel da venda nao repete o codigo', api.nfItem(NF1, true).indexOf('VENDA-0001') < 0);
  ass('tem Abrir e Remover com o id da nota',
    it.indexOf('data-acao="nf-abrir" data-id="nf1"') >= 0 && it.indexOf('data-acao="nf-remover" data-id="nf1"') >= 0);
  const xss = api.nfItem({ id: 'x', nome_original: '<img src=x onerror=alert(1)>', numero: '<b>1</b>', tamanho: 10, enviado_em: NF1.enviado_em, venda_code: 'V' });
  ass('nome de arquivo hostil sai escapado',
    xss.indexOf('<img src=x') < 0 && xss.indexOf('&lt;img') >= 0, xss.slice(0, 120));
  ass('numero hostil sai escapado', xss.indexOf('<b>1</b>') < 0);

  console.log('\n--- aba Notas fiscais: os dois segmentos ---');
  ass('venda sem NF entra em falta', api.nfSemNota().map(function (v) { return v.id; }).join(',') === 'v2');
  ass('venda cancelada nao cobra nota', api.nfSemNota().filter(function (v) { return v.id === 'v3'; }).length === 0);
  ass('venda com NF sai da lista de falta', api.nfSemNota().filter(function (v) { return v.id === 'v1'; }).length === 0);

  const el = { innerHTML: '' };
  api.setSeg('com'); api.setBusca('');
  await api.renderNfs(el);
  ass('segmento Com nota traz as 2 notas',
    el.innerHTML.indexOf('Com nota <span>2</span>') >= 0, el.innerHTML.slice(0, 260));
  ass('o segmento Falta nota declara quantas vendas faltam',
    el.innerHTML.indexOf('Falta nota <span>1</span>') >= 0);
  ass('Com nota marcado', el.innerHTML.indexOf('nf-seg on" data-acao="nf-seg" data-seg="com"') >= 0);
  ass('so um segmento marcado', el.innerHTML.split('nf-seg on').length === 2);
  ass('lista os dois arquivos', el.innerHTML.indexOf('nota.pdf') >= 0 && el.innerHTML.indexOf('foto.jpg') >= 0);

  api.setSeg('falta');
  await api.renderNfs(el);
  ass('segmento Falta nota mostra a venda sem nota', el.innerHTML.indexOf('VENDA-0002') >= 0);
  ass('e nao mostra a que ja tem nota', el.innerHTML.indexOf('VENDA-0001') < 0);
  ass('a venda cancelada continua fora', el.innerHTML.indexOf('VENDA-0003') < 0);
  ass('a contagem dos dois segmentos aparece nos dois lados',
    el.innerHTML.indexOf('Com nota <span>2</span>') >= 0 && el.innerHTML.indexOf('Falta nota <span>1</span>') >= 0);

  api.setSeg('com'); api.setBusca('foto');
  await api.renderNfs(el);
  ass('busca filtra pelo nome do arquivo', el.innerHTML.indexOf('foto.jpg') >= 0 && el.innerHTML.indexOf('nota.pdf') < 0);
  api.setBusca('1042');
  await api.renderNfs(el);
  ass('busca acha pelo numero da nota', el.innerHTML.indexOf('nota.pdf') >= 0 && el.innerHTML.indexOf('foto.jpg') < 0);
  api.setBusca('');

  api.setFonte([], []);
  await api.carregarVendas(); await api.carregarNfs();
  api.setSeg('com');
  await api.renderNfs(el);
  ass('sem NF nenhuma, a tela ensina o caminho', el.innerHTML.indexOf('Anexar NF</strong> no card da venda') >= 0);
  ass('mesmo vazia a tela declara as duas contagens',
    el.innerHTML.indexOf('Com nota <span>0</span>') >= 0 && el.innerHTML.indexOf('Falta nota <span>0</span>') >= 0);
  api.setSeg('falta');
  await api.renderNfs(el);
  ass('sem venda pendente a tela diz que nao falta nada', el.innerHTML.indexOf('Nenhuma venda sem nota') >= 0);

  console.log('\n=== ' + ok + ' assercoes, ' + falhas.length + ' falhas ===');
  if (falhas.length) { falhas.forEach(function (f) { console.log(' - ' + f); }); process.exit(1); }
  process.exit(0);
})();
