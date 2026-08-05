// CORRECAO CRITICA: toda acao de escrita da aba Escopo lancava TypeError.
//
// O delegado e `function A(a){var e=a.target...closest("[data-acao]")...}`:
// **`a` e o EVENTO, `e` e o ELEMENTO clicado.** Os 11 handlers que ja existiam
// usam `e.getAttribute(...)`. O bloco do Escopo entrou usando `a.getAttribute`,
// que nao existe em Event: cada toque em chip, travar, adicionar ou descartar
// morria em `a.getAttribute is not a function`, sem chamar RPC nenhuma.
//
// Passou por 3 revisoes porque TODA a prova do caminho de escrita era
// string-matching sobre a fonte (`SRC.indexOf('p_status:"travado"')`), que casa
// igual com o codigo quebrado. Nenhuma prova CLICAVA no controle.
//
// Sao 12 pontos, nao 7: alem dos getAttribute, 5 chamadas passam `a` como o
// argumento "botao" de q(), e O() faz `o.disabled=!0` nele. Com o Event ali, a
// trava de toque duplo nunca se aplica ao botao de verdade.
//
// Rodar da raiz do repo: node ferramentas/patch_escopo_delegado.js
'use strict';
const fs = require('fs');
const path = require('path');

const ALVO = path.join(__dirname, '..', 'public', 'app.js');
let src = fs.readFileSync(ALVO, 'utf8');
const antes = src.length;

// O bloco do Escopo dentro do delegado, delimitado pelos dois vizinhos estaveis.
const INI = 'if("esc-criar"===o){';
const FIM = 'if("rot-dia"===o)';

const i = src.indexOf(INI), j = src.indexOf(FIM, i);
if (i < 0 || j < 0) {
  console.error('REPROVOU: nao achei o bloco do Escopo no delegado. Nada foi gravado.');
  process.exit(1);
}

const bloco = src.slice(i, j);
const nGet = bloco.split('a.getAttribute(').length - 1;
const nArg = bloco.split(',a)').length - 1;

if (nGet !== 7 || nArg !== 5) {
  console.error(`REPROVOU: esperava 7 a.getAttribute e 5 ",a)" no bloco, achei ${nGet} e ${nArg}.`);
  console.error('O bloco mudou desde que esta correcao foi escrita. Nada foi gravado.');
  process.exit(1);
}
if (bloco.indexOf('e.getAttribute(') >= 0) {
  console.error('REPROVOU: o bloco ja tem e.getAttribute. A correcao ja foi aplicada? Nada foi gravado.');
  process.exit(1);
}

const corrigido = bloco
  .split('a.getAttribute(').join('e.getAttribute(')
  .split(',a)').join(',e)');

src = src.slice(0, i) + corrigido + src.slice(j);
console.log(`ok  1. ${nGet} a.getAttribute -> e.getAttribute (a e o Event, e e o elemento)`);
console.log(`ok  2. ${nArg} argumentos ",a)" -> ",e)" (q() precisa do BOTAO para desabilitar)`);

// O placar de LEAD nao pode aparecer em cima do placar de FRENTES.
// A guarda do validar.py que pegaria isso (linha 172) esta vermelha e herdada
// desde a v45, entao a obra passou por cima dela sem alarme.
const DE_PB = '["captacao","hoje","conteudo","rotina","dashboard","nfs","vendas","clientes","indicacoes"].indexOf(n)>=0?" oculto":""';
const PARA_PB = '["captacao","hoje","conteudo","rotina","dashboard","nfs","vendas","clientes","indicacoes","escopo"].indexOf(n)>=0?" oculto":""';
const nPb = src.split(DE_PB).length - 1;
if (nPb !== 1) {
  console.error(`REPROVOU: 3. lista do pitboard, esperava 1 ocorrencia, achei ${nPb}. Nada foi gravado.`);
  process.exit(1);
}
src = src.replace(DE_PB, PARA_PB);
console.log('ok  3. a aba escopo entra na lista que esconde o pitboard de LEAD');

fs.writeFileSync(ALVO, src, 'utf8');
console.log(`\napp.js: ${antes} -> ${src.length} bytes (${src.length - antes >= 0 ? '+' : ''}${src.length - antes})`);
console.log('APROVOU: 3 correcoes aplicadas.');
