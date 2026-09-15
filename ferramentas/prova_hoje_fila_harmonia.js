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

console.log('\nHoje: fila harmonica');

ok('linha Hoje posiciona Enviar mensagem logo abaixo de Por que agora',
  app.indexOf('fxMotivo(a,!0)+\'<div class="fila-mensagem-linha">') >= 0 &&
  app.indexOf('class="fila-ident-main"') < 0);

ok('acao de contato vira um unico CTA Enviar mensagem',
  app.indexOf('class="btn-acao sugerir fila-sug fila-msg"') >= 0 &&
  app.indexOf('>Enviar mensagem</button>') >= 0);

ok('CTA da Hoje fica em linha propria abaixo do motivo e alinhado a esquerda',
  css.indexOf('#lista[data-aba=\"hoje\"] .fila-mensagem-linha{display:flex;justify-content:flex-start;margin-top:8px}') >= 0 &&
  css.indexOf('#lista[data-aba=\"hoje\"] .fila-mensagem-linha>.fila-msg{margin-left:0;') >= 0);

ok('Hoje nao empilha mais Sugerir e Enviar no cabecalho',
  app.indexOf('+filaEnviarHTML(a)+\'</div><div class="fila-contexto"') < 0);

ok('registro normal fica reduzido a toque e registrar resultado',
  app.indexOf('class="fila-registro"') >= 0 &&
  app.indexOf('class="btn-acao toque fila-toque"') >= 0 &&
  app.indexOf('class="btn-acao fila-reg-btn"') >= 0 &&
  app.indexOf('>Registrar resultado</button>') >= 0);

ok('cinco desfechos continuam disponiveis',
  ['respondeu','conversando','retomar','fechou','sem-interesse'].every(a => app.indexOf('data-acao="' + a + '"') >= 0));

ok('desfechos da Hoje ficam fechados por padrao',
  /\.fila-lin>\.desfechos\s*\{[^}]*display:none/s.test(css) &&
  /\.fila-lin>\.desfechos\.aberto\s*\{\s*display:grid\s*\}/s.test(css));

ok('leque preserva classes e aria-expanded ao abrir',
  app.indexOf('s.classList.toggle("aberto",!aberto)') >= 0 &&
  app.indexOf('e.setAttribute("aria-expanded",aberto?"false":"true")') >= 0);

ok('painel de resultado tem contexto proprio',
  app.indexOf('class="fila-desfecho-tit">O que aconteceu?</div>') >= 0 &&
  css.indexOf('.fila-lin>.desfechos .fila-desfecho-tit') >= 0);

ok('mensagem sugerida continua no proprio lead',
  app.indexOf('class="scripts" data-scripts') >= 0 &&
  app.indexOf('"hoje-sugerir"===o') >= 0);

ok('contratos de escrita permanecem intactos',
  app.indexOf('q("registrar_toque",{p_lead_id:t}') >= 0 &&
  app.indexOf('q("registrar_resposta",{p_lead_id:t}') >= 0 &&
  app.indexOf('q("registrar_conversando",{p_lead_id:t}') >= 0 &&
  app.indexOf('q("registrar_desfecho",{p_lead_id:t,p_tipo:"sem_interesse"}') >= 0 &&
  app.indexOf('reagendar_proximo_contato') >= 0);

ok('mobile preserva Enviar mensagem abaixo do motivo e desfechos legiveis',
  css.indexOf('.fila-fluxo{align-items:stretch;flex-direction:column}') >= 0 &&
  css.indexOf('#lista[data-aba=\"hoje\"] .fila-mensagem-linha>.fila-msg{margin-left:0;width:auto;min-width:0}') >= 0 &&
  css.indexOf('.fila-lin>.desfechos{grid-template-columns:repeat(2,minmax(0,1fr))}') >= 0);

console.log('\n=== ' + (total - falhas) + ' OK, ' + falhas + ' falhas ===');
process.exit(falhas ? 1 : 0);
