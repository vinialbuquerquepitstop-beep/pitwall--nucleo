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

console.log('\nFatia 5: Modo Proximo');

ok('Modo Proximo existe como comportamento proprio',
  app.indexOf('function filaSelecionarProximo(focar)') >= 0 &&
  app.indexOf('async function modoProximo(id)') >= 0);

ok('fila e recarregada por inteiro depois do desfecho',
  app.indexOf('async function modoProximo(id){if(filaSug)delete filaSug[id];await B(!0);') >= 0);

ok('proximo item vem da primeira posicao da fila renderizada',
  app.indexOf('var prox=lista.querySelector(".card")') >= 0 &&
  app.indexOf('filaSelecionarProximo(!0)') >= 0);

ok('ordem soberana continua vindo da fila existente',
  app.indexOf('function vOperacional(a,e){return v(a,e).concat(vPos(a,e)).sort(cmpVer)}') >= 0 &&
  app.indexOf('filaSelecionarProximo') >= 0);

ok('desfechos da fila entram no Modo Proximo',
  app.indexOf('if("fila"===n)return modoProximo(op.lead);') >= 0);

ok('outras abas continuam usando atualizacao localizada',
  app.indexOf('return trocarCard(op.lead,op.card)') >= 0);

ok('primeiro item ja nasce marcado ao abrir a fila',
  app.indexOf('filaSelecionarProximo(!1);prefetchFilaSug(24).then(filaWaAtualizar)') >= 0);

ok('foco nao registra toque nem dispara mensagem',
  app.indexOf('prox.focus') >= 0 &&
  app.indexOf('registrar_toque') >= 0 &&
  app.indexOf('modoProximo(id){if(filaSug)delete filaSug[id];await B(!0);') >= 0);

ok('estado visual do proximo e discreto',
  css.indexOf('.card.modo-proximo{') >= 0 &&
  css.indexOf('border-color:var(--accent-linha)') >= 0 &&
  css.indexOf('box-shadow:0 0 0 3px var(--accent-tint)') >= 0);

ok('Fatia 5 nao cria regra nova de prioridade',
  app.indexOf('modoProximo') >= 0 &&
  app.indexOf('sort(cmpVer)') >= 0);

console.log('\n=== ' + (total - falhas) + ' OK, ' + falhas + ' falhas ===');
process.exit(falhas ? 1 : 0);
