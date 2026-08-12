// prova_cpo.js — assere que a condicao CPO se comporta como decidido pelo dono
// em 03/08/2026: comissao igual a lacrado, garantia de 1 ano, chip proprio.
//
// Roda da raiz do repo:  node ferramentas/prova_cpo.js
// Confere o EXIT CODE, nunca o texto da saida.
//
// Le as funcoes DO ARQUIVO REAL (nao copia a logica), senao a prova passa a
// provar a si mesma em vez de provar o consultor.

const fs = require('fs');
const path = require('path');

const RAIZ = path.join(__dirname, '..');
const CONSULTOR = path.join(RAIZ, 'public', 'calc', 'consultor', 'index.html');
const DONO = path.join(RAIZ, 'public', 'calc', 'index.html');
const DADOS = path.join(RAIZ, 'public', 'calc', 'consultor', 'dados.js');

let falhas = 0, total = 0;
function ok(nome, cond) {
  total++;
  if (cond) { console.log('  ok   ' + nome); }
  else { falhas++; console.log('  FALHA ' + nome); }
}
function eq(nome, obtido, esperado) {
  ok(nome + '  [esperado ' + JSON.stringify(esperado) + ', obtido ' + JSON.stringify(obtido) + ']',
     obtido === esperado);
}

// --- carrega o config real do consultor -----------------------------------
const src = fs.readFileSync(DADOS, 'utf8');
const DADOS_OBJ = JSON.parse(src.slice(src.indexOf('{'), src.lastIndexOf('}') + 1));

// --- extrai as tres funcoes do index.html do consultor ---------------------
const html = fs.readFileSync(CONSULTOR, 'utf8');
function extrai(assinatura) {
  const i = html.indexOf(assinatura);
  if (i < 0) throw new Error('nao achei no consultor: ' + assinatura);
  let profundidade = 0, j = html.indexOf('{', i);
  const inicio = j;
  for (; j < html.length; j++) {
    if (html[j] === '{') profundidade++;
    else if (html[j] === '}') { profundidade--; if (profundidade === 0) break; }
  }
  return html.slice(i, j + 1);
}

const corpo = [extrai('function com(cat,tp)'), extrai('function gar(tp)'), extrai('function bdgCls(tp)')].join('\n');
const criar = new Function('C', 'NIVEL', corpo + '\nreturn {com:com, gar:gar, bdgCls:bdgCls};');

console.log('prova_cpo — decisao do dono de 03/08/2026: CPO paga comissao de lacrado\n');

// --- 1. comissao: CPO paga exatamente o que lacrado paga -------------------
console.log('1. comissao (config real do dados.js)');
for (const nivel of ['Embaixador', 'C1', 'C2', 'C3']) {
  const f = criar(DADOS_OBJ.config, nivel);
  for (const cat of ['iPhone', 'iPad', 'Apple Watch', 'MacBook']) {
    eq(nivel + ' ' + cat + ': CPO == Lacrado', f.com(cat, 'CPO'), f.com(cat, 'Lacrado'));
  }
  // regressao: Seminovo NAO pode ter sido arrastado para a tabela de lacrado.
  // Nao da para provar isso comparando com Lacrado: no nivel Embaixador as duas
  // tabelas pagam 100 no iPhone, entao valores iguais ali sao o config, nao bug.
  // A prova honesta le a tabela `seminovo` do config e cobra o valor exato.
  const tabSem = DADOS_OBJ.config.comissao[nivel].seminovo;
  for (const cat of Object.keys(tabSem)) {
    eq(nivel + ' ' + cat + ': Seminovo le a tabela seminovo', f.com(cat, 'Seminovo'), tabSem[cat]);
  }
  // categoria ausente da tabela seminovo tem que cair em 'Consultar loja' (null)
  eq(nivel + ' MacBook: Seminovo nao existe, devolve null', f.com('MacBook', 'Seminovo'), null);
}

// --- 2. garantia ----------------------------------------------------------
console.log('\n2. garantia exibida ao cliente');
const g = criar(DADOS_OBJ.config, 'C1');
eq('CPO mostra 1 ano (garantia Apple)', g.gar('CPO'), '1 ano');
eq('Lacrado segue 1 ano', g.gar('Lacrado'), '1 ano');
eq('Seminovo segue 3 meses', g.gar('Seminovo'), '3 meses');

// --- 3. badge -------------------------------------------------------------
console.log('\n3. badge de condicao (cor propria por condicao)');
eq('CPO usa bdg-b', g.bdgCls('CPO'), 'bdg-b');
eq('Lacrado segue bdg-g', g.bdgCls('Lacrado'), 'bdg-g');
eq('Seminovo segue bdg-o', g.bdgCls('Seminovo'), 'bdg-o');
ok('a classe .bdg-b existe no CSS', /\.bdg-b\{/.test(html));

// --- 4. o chip na calc do dono -------------------------------------------
console.log('\n4. chip de Tipo na calc do dono');
const dono = fs.readFileSync(DONO, 'utf8');
ok("chip CPO existe", /oTipo\('CPO',this\)/.test(dono));
ok('chip Lacrado segue existindo', /oTipo\('Lacrado',this\)/.test(dono));
ok('chip Seminovo segue existindo', /oTipo\('Seminovo',this\)/.test(dono));

// --- 5. o pedido copiado nao marca CPO como pendente de confirmacao -------
console.log('\n5. texto do pedido');
ok("so Seminovo carrega [PENDENTE DE CONFIRMACAO DA LOJA]",
   (html.match(/PENDENTE DE CONFIRMACAO DA LOJA/g) || []).length ===
   (html.match(/==='Seminovo'\?' \[PENDENTE DE CONFIRMACAO DA LOJA\]'/g) || []).length);

// --- fecho ----------------------------------------------------------------
console.log('\n' + (falhas === 0 ? 'APROVOU' : 'REPROVOU') + ': ' + (total - falhas) + '/' + total + ' assercoes');
process.exit(falhas === 0 ? 0 : 1);
