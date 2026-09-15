const fs = require('fs');
const path = require('path');

const source = fs.readFileSync(path.join(__dirname, '..', 'public', 'app.js'), 'utf8');
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

console.log('\nFatia 3: execucao assistida');

ok('variantes continuam vindo da RPC sugerir_mensagem',
  source.indexOf('t.rpc("sugerir_mensagem",{p_lead_id:id})') >= 0 &&
  source.indexOf('var ops=d.opcoes||[]') >= 0);

ok('escolher variante apenas troca o texto e o link, sem registrar toque',
  source.indexOf('function pintarVariante(id,card,idx)') >= 0 &&
  source.indexOf('data-acao="variante"') >= 0 &&
  source.indexOf('encodeURIComponent(op.texto||"")') >= 0);

ok('copiar script reconhece card da Fila e linha da Hoje',
  source.indexOf('btn.closest(".card,.fila-lin")') >= 0);

ok('dispatcher reconhece a linha da Hoje como contexto operacional',
  source.indexOf('n=e.closest(".card")||e.closest(".fila-lin")') >= 0);

ok('Hoje recebe fechamento operacional sem navegar para outra aba',
  source.indexOf('function filaResultadoHTML(a,hj)') >= 0 &&
  source.indexOf('data-acao="toque"') >= 0 &&
  source.indexOf('data-acao="leque"') >= 0 &&
  source.indexOf('filaResultadoHTML(a,hj)') >= 0);

ok('desfechos da Hoje reutilizam os contratos existentes',
  source.indexOf('data-acao="respondeu"') >= 0 &&
  source.indexOf('data-acao="conversando"') >= 0 &&
  source.indexOf('data-acao="retomar"') >= 0 &&
  source.indexOf('data-acao="fechou"') >= 0 &&
  source.indexOf('data-acao="sem-interesse"') >= 0);

ok('toque continua sendo uma acao explicita',
  source.indexOf('q("registrar_toque",{p_lead_id:t},e,"Toque registrado"') >= 0 &&
  source.indexOf('data-acao="toque"') >= 0);

ok('abrir WhatsApp nao chama registrar_toque',
  source.indexOf('<a class="btn-wa" target="_blank" rel="noopener" href="https://wa.me/') >= 0 &&
  source.indexOf('data-acao="wa-toque"') < 0 &&
  source.indexOf('data-acao="enviar-toque"') < 0);

ok('canal e consentimento seguem guardando o WhatsApp sugerido',
  source.indexOf('var wa=dig&&data.consent?') >= 0 &&
  source.indexOf('Sem consentimento') >= 0 &&
  source.indexOf('Sem telefone') >= 0);

ok('a Hoje continua carregando sugestao no proprio item',
  source.indexOf('"hoje-sugerir"===o') >= 0 &&
  source.indexOf('e.closest(".fila-lin")') >= 0 &&
  source.indexOf('<div class="scripts" data-scripts></div>') >= 0);

console.log('\n=== ' + (total - falhas) + ' OK, ' + falhas + ' falhas ===');
process.exit(falhas ? 1 : 0);
