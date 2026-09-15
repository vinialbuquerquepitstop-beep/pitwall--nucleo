const fs = require('fs');
const path = require('path');

const app = fs.readFileSync(path.join(__dirname, '..', 'public', 'app.js'), 'utf8');
const css = fs.readFileSync(path.join(__dirname, '..', 'public', 'app.css'), 'utf8');
let falhas = 0, total = 0;
function ok(nome, condicao) {
  total += 1;
  if (condicao) console.log('OK  ' + nome);
  else { falhas += 1; console.error('FALHA  ' + nome); }
}

console.log('\nFatia 6: Indicadores de execucao');

ok('metricas sao derivadas no frontend sem nova persistencia',
  app.indexOf('function medirExecucaoFila(eventos,hj,eventosOk)') >= 0 &&
  app.indexOf('FILA_EXEC_EVENTOS') >= 0);

ok('fonte de conclusao usa lead_evento do dia',
  app.indexOf('t.from("lead_evento").select("lead_id,tipo,criado_em")') >= 0 &&
  app.indexOf('.gte("criado_em",inicio).lt("criado_em",fim)') >= 0);

ok('pendentes atuais reutilizam a fila operacional soberana',
  app.indexOf('fila=vOperacional(ativos,hj)') >= 0);

ok('atrasado real usa vencimento anterior a hoje',
  app.indexOf('p(x.proximo_contato,hj)>0') >= 0);

ok('sem canal e medido como pendencia devida sem WhatsApp',
  app.indexOf('(devidoCom(x,hj)||devidoPos(x,hj))&&!dig') >= 0);

ok('taxa de execucao usa concluidos sobre carga observada',
  app.indexOf('Math.round(100*concluidos/cargaN)') >= 0 &&
  app.indexOf('concluídos hoje mais pendentes atuais') >= 0);

ok('indicadores minimos visuais sao quatro e operacionais',
  ['execução','na fila','pós-venda','sem canal'].every(x => app.indexOf('filaExecCel("'+x+'"') >= 0));

ok('indicadores entram antes do recorte da fila de hoje',
  app.indexOf("'+indic+recorte+top+") >= 0 || app.indexOf("'+indic+recorte+'<div") >= 0);

ok('falha de eventos degrada somente metricas de conclusao',
  app.indexOf('metricas:medirExecucaoFila([],hj,!1)') >= 0 &&
  app.indexOf('eventos indisponíveis') >= 0);

ok('layout desktop e mobile esta definido',
  css.indexOf('.fila-exec{') >= 0 &&
  css.indexOf('grid-template-columns:repeat(4,minmax(0,1fr))') >= 0 &&
  css.indexOf('.fila-exec{grid-template-columns:repeat(2,minmax(0,1fr))}') >= 0);

ok('nao antecipa Fatia 7 com notificacoes ou alertas externos',
  app.indexOf('Notification(') < 0 && app.indexOf('notify(') < 0);

ok('nao cria RPC nova para os indicadores',
  app.indexOf('rpc("indicadores') < 0 && app.indexOf('rpc("fila_execucao') < 0);

console.log('\n=== ' + (total - falhas) + ' OK, ' + falhas + ' falhas ===');
process.exit(falhas ? 1 : 0);
