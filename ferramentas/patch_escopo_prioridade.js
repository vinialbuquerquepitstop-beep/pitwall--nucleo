// Fatia B da aba Escopo: o roteador aprende as duas acoes novas do grafico.
//
// 1) "esc-prio"  o <select> de urgencia chama definir_prioridade_acao
// 2) "esc-ir"    tocar a coluna do grafico rola ate o bloco daquela frente
// 3) Y("lista","change",A)  o delegado passa a ouvir change, nao so click
//
// Sobre (3): A() resolve `a.target.closest("[data-acao]")`. Os outros tres
// <select> que vivem dentro de #lista (capFrente, diaNovaCat, rotNovaCat) NAO
// tem [data-acao] em nenhum ancestral, entao o closest devolve null e o
// delegado nao faz nada com o change deles. Foi conferido antes de registrar:
// listener novo em delegado velho e a forma classica de acordar handler que
// ninguem pediu.
//
// O bloco do Escopo entra ANTES de "rot-dia", que e o vizinho estavel usado
// pelos patches anteriores desta mesma aba.
//
// Rodar da raiz do repo: node ferramentas/patch_escopo_prioridade.js
'use strict';
const fs = require('fs');
const path = require('path');

const ALVO = path.join(__dirname, '..', 'public', 'app.js');
let src = fs.readFileSync(ALVO, 'utf8');
const antes = src.length;

const VIZINHO = 'if("rot-dia"===o)';
const CLICK = 'Y("lista","click",A),';

// `t` ja e o data-id, resolvido no topo de A(). Os nomes escAlvo/escPv/escPa
// nao existem em nenhum outro ponto da funcao: var dentro de bloco e hoisted
// para a funcao inteira, entao nome repetido aqui atropelaria outro handler.
const BLOCO =
  'if("esc-ir"===o){var escAlvo=E("escFrente_"+e.getAttribute("data-frente"));' +
  'return void(escAlvo&&escAlvo.scrollIntoView&&escAlvo.scrollIntoView({behavior:"smooth",block:"start"}))}' +
  // Escolher o valor que ja estava (ou cancelar o seletor nativo do celular,
  // que nem dispara change) NAO escreve: gravacao a toa gera toast, re-render
  // e uma linha de auditoria de nada.
  'if("esc-prio"===o){var escPv=e.value||"",escPa=e.getAttribute("data-atual")||"";' +
  'if(escPv===escPa)return;' +
  'return void q("definir_prioridade_acao",{p_id:t,p_prioridade:escPv||null},e)}';

let falhou = null;

if (src.indexOf('"esc-prio"===o') >= 0 || src.indexOf('Y("lista","change",A)') >= 0)
  falhou = 'o patch JA foi aplicado neste app.js. Nada foi gravado.';

const i = src.indexOf(VIZINHO);
if (!falhou && i < 0) falhou = 'nao achei o vizinho ' + VIZINHO + ' no delegado. Nada foi gravado.';

const j = src.indexOf(CLICK);
if (!falhou && j < 0) falhou = 'nao achei ' + CLICK + ' no init. Nada foi gravado.';

// O vizinho tem que ser UNICO, senao o insert cai no lugar errado sem avisar.
if (!falhou && src.indexOf(VIZINHO, i + 1) >= 0)
  falhou = VIZINHO + ' aparece mais de uma vez: ancora ambigua. Nada foi gravado.';

if (falhou) {
  console.error('REPROVOU: ' + falhou);
  process.exit(1);
}

src = src.slice(0, i) + BLOCO + src.slice(i);
src = src.replace(CLICK, CLICK + 'Y("lista","change",A),');

fs.writeFileSync(ALVO, src);

const cresceu = src.length - antes;
console.log('app.js: +' + cresceu + ' chars');
console.log('  esc-ir   ' + (src.indexOf('"esc-ir"===o') >= 0 ? 'ok' : 'FALTOU'));
console.log('  esc-prio ' + (src.indexOf('"esc-prio"===o') >= 0 ? 'ok' : 'FALTOU'));
console.log('  change   ' + (src.indexOf('Y("lista","change",A)') >= 0 ? 'ok' : 'FALTOU'));
console.log('APLICADO. Conferir com: node --check public/app.js');
