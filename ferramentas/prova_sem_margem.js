// prova_sem_margem.js — assere a decisao do dono de 15/08/2026: as classes
// "1ª Linha" (paralelo), "Garmin" e "Moto Elétrica" entram na calc do dono
// pelo CUSTO e nao recebem margem nenhuma.
//
// Roda da raiz do repo:  node ferramentas/prova_sem_margem.js
// Confere o EXIT CODE, nunca o texto da saida.
//
// Le as funcoes DO ARQUIVO REAL (nao copia a logica), senao a prova passa a
// provar a si mesma em vez de provar a calc.

const fs = require('fs');
const path = require('path');

const RAIZ = path.join(__dirname, '..');
const DONO = path.join(RAIZ, 'public', 'calc', 'index.html');
const html = fs.readFileSync(DONO, 'utf8');

let falhas = 0, total = 0;
function ok(nome, cond) {
  total++;
  if (cond) console.log('  ok   ' + nome);
  else { falhas++; console.log('  FALHA ' + nome); }
}
function eq(nome, obtido, esperado) {
  ok(nome + '  [esperado ' + JSON.stringify(esperado) + ', obtido ' + JSON.stringify(obtido) + ']',
     JSON.stringify(obtido) === JSON.stringify(esperado));
}

// --- carrega SEMMARGEM, semMargem e mg do arquivo real --------------------
const mSet = html.match(/const SEMMARGEM=new Set\(\[[^\]]*\]\);/);
const mSem = html.match(/function semMargem\(c\)\{[^}]*\}/);
// O arquivo tem terminador CRLF: sem o \r? opcional a regex nao casa.
const mMg  = html.match(/function mg\(c\)\{.*?\}\r?\n/);
if (!mSet || !mSem || !mMg) {
  console.log('FALHA: nao achei SEMMARGEM / semMargem / mg em public/calc/index.html');
  process.exit(1);
}
const CFG = { d: 300, iav: 550, ipc: 650, mav: 1200, mpc: 1300 };
const ctx = new Function('CFG', mSet[0] + mSem[0] + mMg[0] +
  'return {SEMMARGEM, semMargem, mg};')(CFG);
const { semMargem, mg } = ctx;

console.log('\n== classes de custo puro nao recebem margem ==');
for (const c of ['1ª Linha', 'Garmin', 'Moto Elétrica']) {
  ok('semMargem("' + c + '") e verdadeiro', semMargem(c) === true);
  eq('mg("' + c + '") zera a margem', mg(c), { av: 0, pc: 0 });
}

console.log('\n== as categorias que vendem seguem intactas ==');
eq('mg("MacBook") mantem a margem de Mac', mg('MacBook'), { av: CFG.mav, pc: CFG.mpc });
for (const c of ['iPhone', 'iPad', 'Apple Watch']) {
  eq('mg("' + c + '") mantem a margem de iPhone', mg(c), { av: CFG.iav, pc: CFG.ipc });
}
for (const c of ['iPhone', 'iPad', 'MacBook', 'Apple Watch', 'Acessório']) {
  ok('semMargem("' + c + '") e falso', semMargem(c) === false);
}

console.log('\n== a margem continua vindo do config, nunca fixa no codigo ==');
const CFG2 = { d: 300, iav: 700, ipc: 800, mav: 1500, mpc: 1600 };
const ctx2 = new Function('CFG', mSet[0] + mSem[0] + mMg[0] + 'return {mg};')(CFG2);
eq('mg("iPhone") acompanha o config', ctx2.mg('iPhone'), { av: 700, pc: 800 });
eq('mg("Garmin") segue zero mesmo com config outro', ctx2.mg('Garmin'), { av: 0, pc: 0 });

console.log('\n== o painel de preco de venda some para essas classes ==');
ok('vCalc esconde #vres quando semMargem',
   /if\(semMargem\(cat\)\)\{document\.getElementById\('vres'\)\.style\.display='none'/.test(html));
ok('vCalc retorna antes de calcular preco de venda',
   /semMargem\(cat\)\)\{[^}]*return;\}/.test(html));
ok('o rotulo da categoria diz "só custo"',
   /semMargem\(p\.c\)\?`Cat <strong>\$\{p\.c\}<\/strong> → <strong>só custo<\/strong>/.test(html));

console.log('\n== o scanner de oportunidades ignora essas classes ==');
ok('scanner pula Acessorio e as classes sem margem',
   /if\(p\.c==='Acessório'\|\|semMargem\(p\.c\)\)return;/.test(html));

console.log('\n== colisao de nome com o produto original ==');
ok('o paralelo nao se chama apenas "AirPods Pro"',
   !/"n":"AirPods Pro","c":"1ª Linha"/.test(html));

console.log('\n' + (falhas ? 'REPROVOU: ' : 'PASSOU: ') + (total - falhas) + '/' + total + ' assercoes');
process.exit(falhas ? 1 : 0);
