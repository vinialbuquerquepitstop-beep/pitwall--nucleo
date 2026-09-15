const fs = require('fs');
const path = require('path');

global.window = { __PITWALL_SEM_INIT: 1 };
const appPath = path.join(__dirname, '..', 'public', 'app.js');
const source = fs.readFileSync(appPath, 'utf8');
require(appPath);

const api = global.window.PitWall;
const hoje = '2026-09-13';
let falhas = 0;
let total = 0;

function ok(nome, condicao, detalhe) {
  total += 1;
  if (condicao) {
    console.log('OK  ' + nome);
    return;
  }
  falhas += 1;
  console.error('FALHA  ' + nome + (detalhe ? ' | ' + detalhe : ''));
}

function lead(ajustes) {
  return Object.assign({
    id: 'lead-base',
    lead_code: 'LEAD-BASE',
    nome: 'Lead Base',
    status: 'pendente',
    arquivado_em: null,
    perfil: 'avaliando',
    proximo_contato: hoje,
    ultimo_toque_em: null,
    whatsapp_digitos: '5521999999999',
    consentimento: true,
    veredito: 'agora',
    veredito_ordem: 2,
    valor_em_jogo: 0,
    cadencia_passo: 1,
    cadencia_encerrada: false
  }, ajustes || {});
}

console.log('\nFatia 1: classificacao operacional');

ok('lead comercial executavel entra', api.entraNaFila(lead(), hoje) === true);
ok('sem telefone nao entra na fila executavel',
  api.entraNaFila(lead({ whatsapp_digitos: null }), hoje) === false);
ok('sem consentimento nao entra na fila executavel',
  api.entraNaFila(lead({ consentimento: false, veredito: 'nao_mande', veredito_ordem: 6 }), hoje) === false);
ok('veredito pare nao entra na fila executavel',
  api.entraNaFila(lead({ veredito: 'pare', veredito_ordem: 5 }), hoje) === false);
ok('veredito nao_mande nao entra na fila executavel',
  api.entraNaFila(lead({ veredito: 'nao_mande', veredito_ordem: 6 }), hoje) === false);

const pos = lead({
  id: 'pos-prioridade',
  lead_code: 'LEAD-POS',
  nome: 'Cliente Pos',
  status: 'convertido',
  perfil: 'comprou',
  veredito: 'prioridade',
  veredito_ordem: 1,
  cadencia_rotulo: 'P1'
});

ok('pos-venda executavel entra', api.entraNoPosVenda(pos, hoje) === true);
ok('pos-venda sem canal nao entra',
  api.entraNoPosVenda(Object.assign({}, pos, { whatsapp_digitos: null }), hoje) === false);
ok('pos-venda sem consentimento nao entra',
  api.entraNoPosVenda(Object.assign({}, pos, { consentimento: false }), hoje) === false);

ok('a fila operacional unificada existe', typeof api.montarFilaOperacional === 'function');
ok('a aba Fila usa a classificacao unificada',
  source.indexOf('filaOp=vOperacional(o,a)') >= 0 && source.indexOf('N(e,filaOp,"fila"') >= 0);
ok('a aba Hoje usa a mesma classificacao unificada',
  source.indexOf('fila=vOperacional(ativos,l())') >= 0);
ok('a Fila declara a composicao comercial e pos-venda sem separar a ordem',
  source.indexOf('class="fila-recorte"') >= 0 && source.indexOf('filaRecorte(filaOp,a)') >= 0);
ok('a Hoje reaproveita o mesmo recorte da fila unificada',
  source.indexOf('filaRecorte(fila,l())') >= 0);
if (typeof api.montarFilaOperacional === 'function') {
  const comercial = lead({
    id: 'comercial-agora',
    lead_code: 'LEAD-COM',
    veredito: 'agora',
    veredito_ordem: 2,
    valor_em_jogo: 99999
  });
  const bloqueado = lead({
    id: 'bloqueado',
    lead_code: 'LEAD-BLOQ',
    veredito: 'pare',
    veredito_ordem: 5
  });
  const fila = api.montarFilaOperacional([comercial, pos, bloqueado], hoje);
  ok('Fila e Hoje podem consumir o mesmo conjunto executavel', fila.length === 2,
    fila.map(function (x) { return x.lead_code; }).join(','));
  ok('prioridade e global entre comercial e pos-venda', fila[0] && fila[0].lead_code === 'LEAD-POS',
    fila.map(function (x) { return x.lead_code; }).join(','));
}

const pare = lead({ veredito: 'pare', veredito_ordem: 5 });
ok('pare nao recebe link pela funcao de WhatsApp', api.waHrefFila(pare) === null);
const cardPare = api.cardHTML(pare, 'fila', hoje);
ok('pare nao recebe CTA de sugestao no card', cardPare.indexOf('data-acao="sugerir"') < 0);
ok('pare nao recebe CTA de toque no card', cardPare.indexOf('data-acao="toque"') < 0);

ok('devido hoje fica identificado no chip',
  api.vereditoChip({ veredito: 'agora' }, 0).toLowerCase().indexOf('hoje') >= 0);
ok('atrasado continua identificado em dias',
  api.vereditoChip({ veredito: 'agora' }, 3).indexOf('3d') >= 0);

console.log('\nFatia 2: recorte e card operacional');

const semConsentimento = lead({
  id: 'sem-consentimento',
  lead_code: 'LEAD-SEM-CONSENT',
  consentimento: false,
  veredito: 'nao_mande',
  veredito_ordem: 6
});
const resumoFora = api.resumirExcluidosFila([lead(), pare, semConsentimento], hoje);
ok('o resumo conta somente os devidos que ficaram fora da fila executavel',
  resumoFora.total === 2, JSON.stringify(resumoFora));
ok('o resumo separa pare de sem consentimento',
  resumoFora.motivos.some(function (x) { return x.rotulo === 'pare' && x.total === 1; }) &&
  resumoFora.motivos.some(function (x) { return x.rotulo === 'sem consentimento' && x.total === 1; }),
  JSON.stringify(resumoFora));

const cardOperacional = api.cardHTML(lead({
  id: 'card-operacional',
  lead_code: 'LEAD-CARD',
  produto: 'iPhone 18 Pro 256GB',
  condicao: 'lacrado',
  origem: 'indicacao',
  indicado_por: 'Camila',
  cadencia_rotulo: 'R3 · D7',
  cadencia_vence_em: hoje,
  valor_em_jogo: 7850,
  veredito_motivo: 'Ja respondeu e voltou ao silencio. Melhor aposta da fila.'
}), 'fila', hoje);

ok('o card mostra passo e vencimento da regua',
  cardOperacional.indexOf('R3 · D7') >= 0 &&
  cardOperacional.indexOf('card-vencimento') >= 0 &&
  cardOperacional.indexOf('13/09 · hoje') >= 0);
ok('o motivo tem rotulo visivel e vem do veredito_motivo',
  cardOperacional.indexOf('Por que agora') >= 0 &&
  cardOperacional.indexOf('Melhor aposta da fila') >= 0);
ok('o contexto comercial preserva produto, condicao, origem e indicacao',
  cardOperacional.indexOf('iPhone 18 Pro 256GB') >= 0 &&
  cardOperacional.indexOf('Lacrado') >= 0 &&
  cardOperacional.indexOf('Indicação') >= 0 &&
  cardOperacional.indexOf('por Camila') >= 0);
ok('valor em jogo com lastro aparece formatado',
  cardOperacional.indexOf('valor em jogo') >= 0 &&
  cardOperacional.indexOf('R$ 7.850,00') >= 0);
ok('valor zero nao vira cifra decorativa no card',
  api.cardHTML(lead({ valor_em_jogo: 0 }), 'fila', hoje).indexOf('card-op-valor') < 0);
ok('a acao principal do card e inequivoca',
  cardOperacional.indexOf('card-acao-principal') >= 0 &&
  cardOperacional.indexOf('Chamar no WhatsApp') >= 0);
ok('Fila e Hoje declaram os excluidos sem renderiza-los como cards',
  source.indexOf('fila-recorte-fora') >= 0 &&
  source.indexOf('e.insertAdjacentHTML("afterbegin",filaRecorte(filaOp,a))') >= 0 &&
  source.indexOf('recorte=filaRecorte(fila,l())') >= 0);
ok('a Hoje concentra o prazo na faixa operacional sem repetir no veredito e motivo',
  source.indexOf('fxVerChip(a,atr,!0)') >= 0 &&
  source.indexOf('fxMotivo(a,!0)') >= 0 &&
  source.indexOf('fxOperacao(a,hj,atr)') >= 0);

console.log('\n=== ' + (total - falhas) + ' OK, ' + falhas + ' falhas ===');
process.exit(falhas ? 1 : 0);
