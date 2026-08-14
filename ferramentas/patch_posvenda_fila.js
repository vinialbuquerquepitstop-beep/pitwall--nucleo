// Bloco "Pos-venda" dentro da aba Fila, no nucleo minificado do app.js.
//
// POR QUE ESTE PATCH EXISTE
// A fila filtra por status === 'pendente'. Quem comprou vira 'convertido' e
// SAI da fila. Mas a cadencia de pos-venda do perfil `comprou` tem 6 passos
// ativos (P1 D1 ate P6 D365) e 18 scripts prontos no banco, e a regua conta
// esses leads como atrasados todo dia as 8h. O botao "Toque enviado" aparece
// UMA unica vez no app inteiro, e so dentro do card em modo fila. Resultado
// medido em 14/08/2026: 5 clientes com o passo P1 vencido (o mais antigo ha 28
// dias) e NENHUM caminho na tela para registrar o toque. Encanamento sem
// superficie. Este patch e a superficie.
//
// Cada troca e conferida como ocorrencia UNICA: aborta se achar 0 ou 2.
// Rodar da raiz do repo: node ferramentas/patch_posvenda_fila.js
'use strict';
const fs = require('fs');
const path = require('path');

const ALVO = path.join(__dirname, '..', 'public', 'app.js');
let src = fs.readFileSync(ALVO, 'utf8');
const antes = src.length;

// --- as funcoes novas, injetadas antes de v() (que ja e a lista da fila) ---
// mPos e o espelho de m() para o pos-venda:
//   m()    = status pendente        + venceu + nao tocado hoje
//   mPos() = status convertido + passo de cadencia VIVO + venceu + nao tocado hoje
// `cadencia_passo` nao nulo importa: `cadencia_encerrada` vem de
// COALESCE(ce.encerrada,false), entao um convertido SEM linha de cadencia
// tambem devolveria false e entraria no bloco sem ter passo nenhum.
const F_POS =
  'function mPos(a,e){return!!a&&"convertido"===a.status&&!a.arquivado_em&&!!a.cadencia_passo' +
  '&&!a.cadencia_encerrada&&!!a.proximo_contato&&a.proximo_contato<=e&&u(a.ultimo_toque_em)!==e}' +
  'function vPos(a,e){return(a||[]).filter(function(a){return mPos(a,e)})' +
  '.sort(function(a,e){return a.proximo_contato!==e.proximo_contato?a.proximo_contato<e.proximo_contato?-1:1' +
  ':String(a.nome||"").localeCompare(String(e.nome||""))})}' +
  'function posAnexar(cont,ativos,hj){var ps=vPos(ativos,hj);if(!cont||!ps.length)return;' +
  'var d=String(hj).slice(8,10)+"/"+String(hj).slice(5,7);' +
  'cont.insertAdjacentHTML("beforeend",' +
  '\'<div class="pos-cab"><svg class="pos-ico" viewBox="0 0 24 24" aria-hidden="true">\'' +
  '+\'<path d="M3.5 7.5l8.5-4 8.5 4-8.5 4-8.5-4z" stroke-linejoin="round"></path>\'' +
  '+\'<path d="M3.5 12l8.5 4 8.5-4M3.5 16.5l8.5 4 8.5-4" stroke-linecap="round" stroke-linejoin="round"></path></svg>\'' +
  '+\'<span class="pos-tit">P\\u00f3s-venda</span><span class="pos-cont">\'+ps.length+\'</span>\'' +
  '+\'<span class="pos-jan">quem j\\u00e1 comprou e tem passo vencendo at\\u00e9 \'+c(d)+\'</span></div>\'' +
  '+ps.map(function(a){return x(a,"fila",hj)}).join(""))}';

const COSTURAS = [
  {
    nome: '1. mPos/vPos/posAnexar entram antes de v() (mesmo escopo, depois de m e u)',
    de: 'function v(a,e){return(a||[]).filter(function(a){return m(a,e)}).sort(',
    para: F_POS + 'function v(a,e){return(a||[]).filter(function(a){return m(a,e)}).sort('
  },
  {
    nome: '2. card de cliente na fila ganha o chip de status e o rotulo do passo',
    // Em modo fila o card ESCONDE o chip de status ("fila"!==e&&a.status&&...).
    // Sem estes dois chips o cliente aparece identico a um lead novo, e o
    // operador manda script de venda para quem ja comprou.
    de: '"indicacao"===a.origem&&a.indicado_por&&n.push(\'<span class="chip ind">Ind. por \'+c(a.indicado_por)+"</span>");',
    para: '"indicacao"===a.origem&&a.indicado_por&&n.push(\'<span class="chip ind">Ind. por \'+c(a.indicado_por)+"</span>");'
        + '"fila"===e&&"convertido"===a.status&&(n.push(\'<span class="chip st-convertido">\'+c(s("status",a.status))+"</span>"),'
        + 'a.cadencia_rotulo&&n.push(\'<span class="chip cad-mono">\'+c(a.cadencia_rotulo)+"</span>"));'
  },
  {
    nome: '3. a aba Fila anexa o bloco de pos-venda depois da fila de venda',
    de: ');prefetchFilaSug(24).then(filaWaAtualizar)}',
    para: ');posAnexar(e,o,a);prefetchFilaSug(24).then(filaWaAtualizar)}'
  },
  {
    nome: '4. trocarCard nao pode sumir com o card de pos-venda por engano',
    // m(novo,hj) e SEMPRE false para um convertido. Sem o mPos aqui, qualquer
    // acao que rele o lead (editar, historico) apagaria o card da tela mesmo
    // sem toque nenhum registrado.
    de: '("fila"===n&&!m(novo,hj))',
    para: '("fila"===n&&!m(novo,hj)&&!mPos(novo,hj))'
  },
  {
    nome: '6. mPos/vPos entram na superficie de teste, como entraNaFila/montarFila',
    // Sem export nao ha prova possivel: o nucleo e um IIFE e as funcoes novas
    // ficariam inalcancaveis de fora. O app ja expoe os gemeos delas
    // (entraNaFila:m, montarFila:v) exatamente por este motivo.
    de: 'entraNaFila:m,montarFila:v,',
    para: 'entraNaFila:m,montarFila:v,entraNoPosVenda:mPos,montarPosVenda:vPos,'
  },
  {
    nome: '5. prefetch de sugestao passa a cobrir tambem o pos-venda',
    // Sem isto o link de WhatsApp do cliente sai pelado (wa.me sem texto),
    // enquanto o script "Deu tudo certo com o {produto}?" existe no banco.
    de: 'top=v(ativos,l()).slice(0,lim||5)',
    para: 'top=v(ativos,l()).concat(vPos(ativos,l())).slice(0,lim||5)'
  }
];

let erros = 0;
for (const cst of COSTURAS) {
  const n = src.split(cst.de).length - 1;
  if (n !== 1) {
    console.error(`REPROVOU: ${cst.nome}\n  esperava 1 ocorrencia, achou ${n}`);
    erros++;
    continue;
  }
  src = src.replace(cst.de, cst.para);
  console.log(`ok  ${cst.nome}`);
}

if (erros) {
  console.error(`\nREPROVOU: ${erros} costura(s) sem ocorrencia unica. Nada foi gravado.`);
  process.exit(1);
}

fs.writeFileSync(ALVO, src);
console.log(`\nAPROVOU: ${COSTURAS.length} costuras aplicadas. ${antes} -> ${src.length} chars (+${src.length - antes}).`);
