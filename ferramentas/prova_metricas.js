// Prova das funcoes novas (afericao + painel de metricas) recortadas do app.js
// real, nao de uma copia: se o arquivo mudar, esta prova le a versao nova.
// Nao substitui harness.py (Chrome headless, cor computada), que nao roda nesta
// maquina por falta de Python. Cobre o HTML gerado e a logica pura.
const fs = require('fs');
const SRC = fs.readFileSync(process.argv[2] || 'public/app.js', 'utf8');

function recorte(de, ate) {
  const i = SRC.indexOf(de), j = SRC.indexOf(ate, i);
  if (i < 0 || j < 0) throw new Error('nao achei o bloco: ' + de);
  return SRC.slice(i, j);
}

// helpers reais tirados do proprio arquivo
const escReal = recorte('function c(a){return String(null==a?', 'function d(a){');
const blocoAfericao = recorte('function fmtNum(n)', 'function contMoverCtl(x)');
const blocoDash = recorte('var METRICA_DIAS=90;', 'async function renderDash()');

const HOJE = '2026-07-25';
const preludio = `
  ${escReal}
  function l(){return '${HOJE}'}
  function fmtDia(a){return a? 'dia '+a : ''}
  function iconeTipo(cod){return '<svg class="tp-ico" data-t="'+(cod||'')+'"></svg>'}
  function tipoDe(cod){return 'var(--tp-'+(cod||'outro')+')'}
  function brlV(n){return 'R$ '+Number(n||0).toLocaleString('pt-BR',{minimumFractionDigits:2,maximumFractionDigits:2})}
  function I(){}
  var n='conteudo';
  async function renderConteudo(){}
  async function renderHoje(){}
  async function renderDash(){}
  var O=async function(){return {ok:true}};
`;
const api = new Function(preludio + blocoAfericao + blocoDash + `
  return {fmtNum,contAferivel,contMetricaNums,contMetrica,metBarra,metLinOrigem,
          metOrigem,metTipoChip,metPeca,metConteudo,metTopo,
          setDias:function(d){METRICA_DIAS=d},getDias:function(){return METRICA_DIAS}};
`)();

let ok = 0, falhas = [];
function ass(nome, cond, extra) {
  if (cond) { ok++; console.log('  ok  ' + nome); }
  else { falhas.push(nome + (extra ? ' | ' + extra : '')); console.log('FALHOU ' + nome + (extra ? ' | ' + extra : '')); }
}

const pubOntem = { id: 'i1', status_codigo: 'publicado', data: '2026-07-24', titulo: 'Peca' };
const pubHoje = { id: 'i2', status_codigo: 'publicado', data: HOJE };
const pubAmanha = { id: 'i3', status_codigo: 'publicado', data: '2026-07-26' };
const aProduzir = { id: 'i4', status_codigo: 'a_produzir', data: '2026-07-20' };
const semData = { id: 'i5', status_codigo: 'publicado' };

console.log('\n--- afericao: quem pode ser aferido ---');
ass('publicada ontem e aferivel', api.contAferivel(pubOntem) === true);
ass('publicada hoje e aferivel', api.contAferivel(pubHoje) === true);
ass('publicada com data no futuro NAO e aferivel', api.contAferivel(pubAmanha) === false);
ass('peca a produzir NAO e aferivel', api.contAferivel(aProduzir) === false);
ass('publicada sem data (painel_do_dia antigo) e aferivel', api.contAferivel(semData) === true);

console.log('\n--- afericao: HTML do card ---');
const semMet = api.contMetrica(pubOntem);
ass('nao aferida mostra "sem aferição"', semMet.indexOf('sem aferição') >= 0);
ass('nao aferida oferece "Aferir"', semMet.indexOf('>Aferir</button>') >= 0);
ass('card nao aferivel nao rende nada', api.contMetrica(pubAmanha) === '' && api.contMetrica(aProduzir) === '');
ass('form tem os dois campos', semMet.indexOf('data-af="alcance"') >= 0 && semMet.indexOf('data-af="conversas"') >= 0);
ass('form comeca fechado (sem classe aberto)', semMet.indexOf('class="cont-met"') >= 0 && semMet.indexOf('cont-met aberto') < 0);
ass('acoes tem data-acao de salvar e cancelar',
  semMet.indexOf('data-acao="cont-aferir-ok"') >= 0 && semMet.indexOf('data-acao="cont-aferir-cancel"') >= 0);

const comMet = api.contMetrica(Object.assign({}, pubOntem, {
  metrica: { alcance: 1240, conversas: 3, medido_dias: 0 }
}));
ass('numero sai formatado em pt-BR', comMet.indexOf('1.240') >= 0, comMet);
ass('mostra a palavra alcance', comMet.indexOf('</span> alcance</span>') >= 0);
ass('plural de conversa com 3', comMet.indexOf('conversas') >= 0);
ass('idade do numero aparece (medido hoje)', comMet.indexOf('medido hoje') >= 0);
ass('ja aferida oferece "Aferir de novo"', comMet.indexOf('>Aferir de novo</button>') >= 0);

const umaConversa = api.contMetrica(Object.assign({}, pubOntem, { metrica: { conversas: 1, medido_dias: 1 } }));
ass('singular de conversa com 1', umaConversa.indexOf('1</span> conversa</span>') >= 0, umaConversa);
ass('medido ontem quando medido_dias=1', umaConversa.indexOf('medido ontem') >= 0);
// so o rotulo do formulario pode dizer "alcance"; o bloco de numeros, nao
ass('sem alcance nao inventa alcance', umaConversa.indexOf('</span> alcance</span>') < 0);
const antiga = api.contMetrica(Object.assign({}, pubOntem, { metrica: { alcance: 10, medido_dias: 7 } }));
ass('medido ha N dias quando N>1', antiga.indexOf('medido há 7 dias') >= 0, antiga);
const zerado = api.contMetrica(Object.assign({}, pubOntem, { metrica: { alcance: 0, conversas: 0, medido_dias: 2 } }));
ass('zero aferido e diferente de nao aferido', zerado.indexOf('sem aferição') < 0 && zerado.indexOf('>0</span> alcance') >= 0, zerado);

console.log('\n--- painel: barra proporcional ---');
ass('barra vazia com valor 0', api.metBarra(0, 9).indexOf('width:0%') >= 0);
ass('barra cheia no maximo', api.metBarra(9, 9).indexOf('width:100%') >= 0);
ass('valor minusculo ainda aparece (piso 3%)', api.metBarra(1, 400).indexOf('width:3%') >= 0);
ass('sem divisao por zero', api.metBarra(0, 0).indexOf('width:0%') >= 0);

console.log('\n--- painel: origem ---');
const dOrigem = {
  origem: {
    itens: [
      { codigo: 'whatsapp_direto', rotulo: 'WhatsApp direto', leads: 9, clientes: 3, taxa: 33, valor_venda: 0, valor_historico: 19599.99 },
      { codigo: 'indicacao', rotulo: 'Indicação', leads: 1, clientes: 1, taxa: 100, valor_venda: 4899.99, valor_historico: 0 }
    ],
    total: { leads: 10, clientes: 4, valor_venda: 4899.99, valor_historico: 19599.99 }
  }
};
const htmlOrigem = api.metOrigem(dOrigem);
ass('rotulo da origem aparece', htmlOrigem.indexOf('WhatsApp direto') >= 0);
ass('R$ vendido formatado', htmlOrigem.indexOf('R$ 4.899,99') >= 0, htmlOrigem);
// a palavra "historico" tambem aparece no rodape explicativo; o que nao pode
// repetir e a LINHA de valor historico, que so vale para quem tem valor > 0
ass('historico so aparece na linha de quem tem valor',
  htmlOrigem.indexOf('histórico R$ 19.599,99') >= 0 && htmlOrigem.split('histórico R$').length === 2);
ass('taxa de conversao aparece', htmlOrigem.indexOf('33%') >= 0 && htmlOrigem.indexOf('100%') >= 0);
ass('singular de lead/cliente com 1', htmlOrigem.indexOf('1 lead · 1 cliente · 100%') >= 0, htmlOrigem);
ass('plural com 9', htmlOrigem.indexOf('9 leads · 3 clientes · 33%') >= 0);
ass('total do bloco aparece no cabecalho', htmlOrigem.indexOf('10 leads · 4 viraram cliente') >= 0);
ass('declara o criterio de coorte (primeiro contato)', htmlOrigem.indexOf('primeiro contato') >= 0);
ass('declara que vendido e historico nao se somam', htmlOrigem.indexOf('não se somam') >= 0);
ass('origem vazia nao quebra', api.metOrigem({ origem: { itens: [], total: {} } }).indexOf('Nenhum lead nesta janela') >= 0);

console.log('\n--- painel: conteudo ---');
const dConteudo = {
  conteudo: {
    total: { publicadas: 9, afericoes: 1, alcance: 1240, conversas: 3 },
    por_tipo: [{ codigo: 'story', rotulo: 'Story', publicadas: 8, afericoes: 1, alcance: 1240, conversas: 3 },
               { codigo: 'feed', rotulo: 'Feed', publicadas: 1, afericoes: 0, alcance: 0, conversas: 0 }],
    pecas: [
      { id: 'p1', titulo: 'Story <b>19/07</b>', data: '2026-07-19', tipo_codigo: 'story', tipo_rotulo: 'Story', alcance: 1240, conversas: 3, medido_em: '2026-07-25T18:00:00Z', medido_dias: 0 },
      { id: 'p2', titulo: 'Feed 11/07', data: '2026-07-11', tipo_codigo: 'feed', tipo_rotulo: 'Feed', alcance: null, conversas: null, medido_em: null, medido_dias: null }
    ]
  }
};
const htmlCont = api.metConteudo(dConteudo);
ass('publicadas x aferidas sempre juntas', htmlCont.indexOf('9 publicadas · 1 aferidas') >= 0, htmlCont);
ass('marca alerta quando aferidas < publicadas', htmlCont.indexOf('met-sec-tot alerta') >= 0);
ass('so lista as pecas aferidas', htmlCont.indexOf('Story &lt;b&gt;19/07&lt;/b&gt;') >= 0 && htmlCont.indexOf('Feed 11/07') < 0);
ass('titulo escapado (sem HTML injetado)', htmlCont.indexOf('<b>19/07</b>') < 0);
ass('declara quantas ficaram sem afericao', htmlCont.indexOf('1 peça publicada ainda sem aferição') >= 0, htmlCont);
ass('declara a cobertura do total', htmlCont.indexOf('cobre só 1 de 9') >= 0);
ass('chip por tipo mostra publicadas e afericoes', htmlCont.indexOf('8 pub · 1 afer') >= 0);
ass('conversas do tipo so quando ha afericao',
  htmlCont.indexOf('<span class="met-tipo-num forte">· 3 conversas</span>') >= 0 &&
  htmlCont.split('met-tipo-num forte').length === 2);
ass('diz que a ordem e por conversas', htmlCont.indexOf('Ordenado por conversas') >= 0);

const semPublicada = api.metConteudo({ conteudo: { total: { publicadas: 0, afericoes: 0 }, por_tipo: [], pecas: [] } });
ass('sem peca publicada explica o criterio', semPublicada.indexOf('status no Notion vira Publicado') >= 0);
const semAferir = api.metConteudo({
  conteudo: { total: { publicadas: 9, afericoes: 0 }, por_tipo: [], pecas: dConteudo.conteudo.pecas.map(function (p) { return Object.assign({}, p, { medido_em: null }); }) }
});
ass('nenhuma aferida ensina o caminho', semAferir.indexOf('coluna Publicado') >= 0);

console.log('\n--- painel: topo e janela ---');
const topo = api.metTopo({ ini: '2026-04-27', fim: '2026-07-25' });
ass('janela declarada no topo', topo.indexOf('dia 2026-04-27 a dia 2026-07-25') >= 0, topo);
ass('faixa de 90 dias marcada por padrao', topo.indexOf('data-dias="90" aria-pressed="true"') >= 0);
ass('so uma faixa marcada', topo.split('aria-pressed="true"').length === 2);
api.setDias(30);
const topo30 = api.metTopo({ ini: '2026-06-26', fim: '2026-07-25' });
ass('trocar a janela move a marca', topo30.indexOf('data-dias="30" aria-pressed="true"') >= 0 && topo30.split('aria-pressed="true"').length === 2);
api.setDias(90);

console.log('\n=== ' + ok + ' assercoes, ' + falhas.length + ' falhas ===');
if (falhas.length) { falhas.forEach(function (f) { console.log(' - ' + f); }); process.exit(1); }
process.exit(0);
