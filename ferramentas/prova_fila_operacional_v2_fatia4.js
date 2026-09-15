const fs = require('fs');
const path = require('path');

const app = fs.readFileSync(path.join(__dirname, '..', 'public', 'app.js'), 'utf8');
const css = fs.readFileSync(path.join(__dirname, '..', 'public', 'app.css'), 'utf8');
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

console.log('\nFatia 4: desfecho rapido');

ok('resultados ficam visiveis sem depender do botao Desfecho',
  css.indexOf('.desfechos{\n  display:grid') >= 0 &&
  css.indexOf('.card-acoes [data-acao="leque"]{display:none}') >= 0);

ok('cinco resultados continuam no contrato visual',
  app.indexOf('data-acao="respondeu"') >= 0 &&
  app.indexOf('data-acao="conversando"') >= 0 &&
  app.indexOf('data-acao="retomar"') >= 0 &&
  app.indexOf('data-acao="fechou"') >= 0 &&
  app.indexOf('data-acao="sem-interesse"') >= 0);

ok('resposta continua usando RPC propria',
  app.indexOf('q("registrar_resposta",{p_lead_id:t}') >= 0);

ok('conversando continua usando RPC propria',
  app.indexOf('q("registrar_conversando",{p_lead_id:t}') >= 0);

ok('toque continua usando RPC propria e explicita',
  app.indexOf('q("registrar_toque",{p_lead_id:t}') >= 0 &&
  app.indexOf('data-acao="toque"') >= 0);

ok('sem interesse continua usando registrar_desfecho',
  app.indexOf('q("registrar_desfecho",{p_lead_id:t,p_tipo:"sem_interesse"}') >= 0);

ok('retomar continua exigindo data antes da RPC',
  app.indexOf('n.querySelector(".retomar input")') >= 0 &&
  app.indexOf('reagendar_proximo_contato') >= 0 &&
  app.indexOf('Escolha a data de retomada') >= 0);

ok('Fechou continua exigindo registro de venda',
  app.indexOf('function fecharComVenda(id)') >= 0 &&
  app.indexOf('abrirPainelVenda(id)') >= 0);

ok('acao concluida continua relendo/recalculando a fila',
  app.indexOf('function q(a,e,o,t,op)') >= 0 &&
  app.indexOf('aposAcao(op)') >= 0 &&
  app.indexOf('trocarCard(op.lead,op.card)') >= 0);

ok('mobile usa grade compacta e legivel',
  css.indexOf('.desfechos{grid-template-columns:repeat(2,minmax(0,1fr))}') >= 0 &&
  css.indexOf('.desfechos .btn-desf:first-child{grid-column:1 / -1}') >= 0);

console.log('\n=== ' + (total - falhas) + ' OK, ' + falhas + ' falhas ===');
process.exit(falhas ? 1 : 0);
