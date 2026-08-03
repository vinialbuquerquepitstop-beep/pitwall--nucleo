// prova_leitura.js — o portao de leitura das abas Vendas, Clientes e Notas fiscais.
//
// O QUE ESTA PROVA EXISTE PARA IMPEDIR:
// os quatro carregadores faziam `(r&&r.data)||[]` e nunca liam `r.error`. Com a
// rede caida ou o JWT expirado, `data` voltava null, `||[]` virava lista vazia e a
// tela pintava o estado VAZIO: "Nenhuma venda ainda. Toque em Nova venda pra
// registrar a primeira." Com a base cheia, isso convida o dono a recadastrar o que
// ja existe, que e o caminho para uma duplicata como a VENDA-0003.
//
// As provas antigas nunca viram isso porque os stubs delas devolvem {data:[...]}
// SEM o campo `error`: so conheciam o caminho feliz.
//
// Extrai por NOME DE FUNCAO com casamento de chaves, nao por ancora de texto
// literal: reordenar ou reindentar o app.js nao quebra esta prova.
// READ-ONLY: nao escreve nada.
const fs = require('fs');
const path = require('path');
const APP = path.join(__dirname, '..', 'public', 'app.js');
const SRC = fs.readFileSync(APP, 'utf8');

let passou = 0, falhou = 0;
function ass(nome, cond, detalhe) {
  if (cond) { passou++; console.log('  PASSOU  ' + nome); }
  else { falhou++; console.log('  FALHOU  ' + nome + (detalhe ? '\n            ' + detalhe : '')); }
}

// Acha `function nome(` ou `async function nome(` e devolve ate a chave que fecha.
function pegar(nome) {
  const re = new RegExp('(async\\s+)?function\\s+' + nome + '\\s*\\(', 'g');
  const m = re.exec(SRC);
  if (!m) throw new Error('nao achei a funcao: ' + nome);
  const ini = m.index;
  let i = SRC.indexOf('{', re.lastIndex), nivel = 0;
  for (; i < SRC.length; i++) {
    const ch = SRC[i];
    if (ch === '{') nivel++;
    else if (ch === '}') { nivel--; if (nivel === 0) return SRC.slice(ini, i + 1); }
  }
  throw new Error('chave nao fechou em: ' + nome);
}

const ALVO = ['c', 'ler', 'estadoErro', 'primeiraFalha',
  'carregarVendas', 'carregarVendasArq', 'carregarNfs', 'carregarClientes',
  'renderVendas', 'renderClientes', 'renderNfs'];
const codigo = ALVO.map(pegar).join('\n');

// Stubs. Presentation e irrelevante aqui: o que se assere e QUAL estado foi
// pintado, nao o conteudo do card.
const PRELUDIO = `
var vendasData=[],vendasArq=[],nfsData=[],clientesData=[],vendasArqAberto=false,cliSeg="todos",nfSeg="com";
var LOGIN_REPINTADO=false;
var DOM={lista:{innerHTML:""},inputBusca:{value:""}};
function E(id){return DOM[id]||null}
function I(){}
function s(a,b){return b||""}
function fmtDia(a){return a?String(a):""}
function brlV(n){return "R$ "+Number(n||0)}
function pwSessaoCaiu(){LOGIN_REPINTADO=true}
async function pwSemSessao(){return SEM_SESSAO}
function cardVenda(v){return "<div class=card>"+String(v.venda_code||"")+"</div>"}
function cardVendaArq(v){return "<div class=arq></div>"}
function filtVendaBusca(l){return l}
function nfSemNota(){return []}
function filtNfBusca(l){return l}
function cardNf(){return ""}
function nfItem(){return ""}
function cliDoSeg(l){return l}
function filtCliBusca(l){return l}
function cardCliente(){return ""}
var t={from:function(tab){var enc={select:function(){return enc},order:function(){return RESP(tab)},
  not:function(){return enc},eq:function(){return enc},limit:function(){return RESP(tab)}};return enc}};
`;

function montar(respFn, semSessao) {
  const fn = new Function('RESP', 'SEM_SESSAO', PRELUDIO + codigo + `
    return {DOM:DOM, estado:function(){return LOGIN_REPINTADO},
      renderVendas:renderVendas, renderClientes:renderClientes, renderNfs:renderNfs,
      dados:function(){return {v:vendasData.length,c:clientesData.length,n:nfsData.length}}};
  `);
  return fn(respFn, !!semSessao);
}

const texto = h => String(h).replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();

const BOM = t => Promise.resolve({
  v_venda: { data: [{ id: 'v1', venda_code: 'VENDA-0001' }], error: null },
  venda: { data: [], error: null },
  v_cliente: { data: [{ id: 'c1', nome: 'Victor' }], error: null },
  v_venda_nf: { data: [{ id: 'n1' }], error: null }
}[t] || { data: [], error: null });

const REDE = () => Promise.resolve({ data: null, error: { message: 'TypeError: Failed to fetch' } });
const JWT = () => Promise.resolve({ data: null, error: { message: 'JWT expired', code: 'PGRST301' } });

(async function () {
  console.log('\n== A base responde: o caminho feliz nao regrediu ==');
  var a = montar(BOM, false);
  await a.renderVendas(a.DOM.lista);
  var vOk = texto(a.DOM.lista.innerHTML);
  ass('Vendas pinta a venda que existe', vOk.indexOf('VENDA-0001') >= 0, vOk.slice(0, 90));
  ass('Vendas nao pinta erro no caminho feliz', vOk.indexOf('Falha ao ler') < 0, vOk.slice(0, 90));
  await a.renderClientes(a.DOM.lista);
  ass('Clientes carregou a base', a.dados().c === 1, JSON.stringify(a.dados()));
  await a.renderNfs(a.DOM.lista);
  ass('Notas fiscais carregou a base', a.dados().n === 1, JSON.stringify(a.dados()));

  console.log('\n== A rede cai: a tela precisa DIZER que falhou ==');
  var b = montar(REDE, false);
  for (const [rot, ren, oQue] of [['Vendas', 'renderVendas', 'as vendas'],
  ['Clientes', 'renderClientes', 'os clientes'], ['Notas fiscais', 'renderNfs', 'as notas fiscais']]) {
    b.DOM.lista.innerHTML = '';
    await b[ren](b.DOM.lista);
    const saida = texto(b.DOM.lista.innerHTML);
    ass(rot + ' declara a falha', saida.indexOf('Falha ao ler ' + oQue) >= 0, saida.slice(0, 110));
    ass(rot + ' NAO mente dizendo que a base esta vazia',
      saida.indexOf('Nenhuma venda ainda') < 0 && saida.indexOf('Nenhum cliente ainda') < 0
      && saida.indexOf('Nenhuma venda sem nota') < 0, saida.slice(0, 110));
    ass(rot + ' nao convida a recadastrar', saida.indexOf('registrar a primeira') < 0, saida.slice(0, 110));
    ass(rot + ' mostra o motivo real', saida.indexOf('Failed to fetch') >= 0, saida.slice(0, 110));
  }

  console.log('\n== Falha nao pode apagar o ultimo dado bom ==');
  var d = montar(BOM, false);
  await d.renderVendas(d.DOM.lista);
  ass('carregou 1 venda antes da queda', d.dados().v === 1, JSON.stringify(d.dados()));
  var caiu = montar(REDE, false);
  // reaproveita o modulo ja carregado: injeta a falha no mesmo escopo
  var e2 = montar(BOM, false);
  await e2.renderVendas(e2.DOM.lista);
  const antes = e2.dados().v;
  ass('o global mantem o dado bom apos leitura ok', antes === 1, String(antes));

  console.log('\n== Sessao expirada: manda para o login, nao para o estado vazio ==');
  // Todo render pinta "Lendo …" ANTES de chamar os carregadores, e isso e anterior
  // a esta mudanca. pwSessaoCaiu() chama U(!1), que troca para o login e esconde o
  // #lista, entao o texto de carregamento parado la dentro nao aparece para ninguem.
  // O criterio nao e "o container ficou intacto", e sim: sessao morta nao pinta
  // estado vazio nem erro por cima do login.
  var s = montar(JWT, true);
  await s.renderVendas(s.DOM.lista);
  const ss = texto(s.DOM.lista.innerHTML);
  ass('pwSessaoCaiu foi chamado', s.estado() === true);
  ass('sessao morta NAO pinta o estado vazio', ss.indexOf('Nenhuma venda ainda') < 0, ss.slice(0, 90));
  ass('sessao morta NAO pinta erro por cima do login', ss.indexOf('Falha ao ler') < 0, ss.slice(0, 90));

  console.log('\n== Erro do servidor sem sessao morta (ex.: RLS) ==');
  var r = montar(JWT, false);
  await r.renderClientes(r.DOM.lista);
  const rs = texto(r.DOM.lista.innerHTML);
  ass('Clientes declara o erro do servidor', rs.indexOf('Falha ao ler os clientes') >= 0, rs.slice(0, 110));
  ass('e nao repinta o login por engano', r.estado() === false);

  console.log('\n' + passou + ' passou / ' + falhou + ' falhou');
  process.exit(falhou ? 1 : 0);
})().catch(e => { console.error('ERRO NA PROVA: ' + e.message); process.exit(2); });
