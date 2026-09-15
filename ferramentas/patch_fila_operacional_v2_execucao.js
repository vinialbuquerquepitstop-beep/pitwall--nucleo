const fs = require('fs');
const path = require('path');

const alvo = path.join(__dirname, '..', 'public', 'app.js');
let src = fs.readFileSync(alvo, 'utf8');

function trocaUnica(rotulo, antes, depois) {
  const ocorrencias = src.split(antes).length - 1;
  if (ocorrencias !== 1) {
    throw new Error(rotulo + ': esperado 1 trecho, encontrado ' + ocorrencias);
  }
  src = src.replace(antes, depois);
}

trocaUnica(
  'copiar variante tambem na Hoje',
  'function copiarScript(id,btn){var card=btn&&btn.closest?btn.closest(".card"):null;',
  'function copiarScript(id,btn){var card=btn&&btn.closest?btn.closest(".card,.fila-lin"):null;'
);

trocaUnica(
  'acoes de lead reconhecem card da Hoje',
  'var o=e.getAttribute("data-acao"),t=e.getAttribute("data-id"),n=e.closest(".card");',
  'var o=e.getAttribute("data-acao"),t=e.getAttribute("data-id"),n=e.closest(".card")||e.closest(".fila-lin");'
);

trocaUnica(
  'execucao assistida na Hoje',
  'function hojeFilaLin(a){',
  'function filaResultadoHTML(a,hj){if(!a||!a.id||!podeAbordar(a))return"";var g=c(a.id);return\'<div class="card-acoes"><span class="acoes-escrita"><button class="btn-acao toque" data-acao="toque" data-id="\'+g+\'">Toque enviado</button><button class="btn-acao" data-acao="leque" data-id="\'+g+\'">Desfecho</button></span></div><div class="desfechos"><button class="btn-desf respondeu" data-acao="respondeu" data-id="\'+g+\'">Respondeu</button><button class="btn-desf" data-acao="conversando" data-id="\'+g+\'">Conversando</button><button class="btn-desf" data-acao="retomar" data-id="\'+g+\'">Retomar</button><button class="btn-desf ok" data-acao="fechou" data-id="\'+g+\'">Fechou</button><button class="btn-desf frio" data-acao="sem-interesse" data-id="\'+g+\'">Sem interesse</button></div><div class="retomar"><input type="date" value="\'+c(C(hj,1))+\'" aria-label="Retomar em"><button class="btn-desf" data-acao="retomar-ok" data-id="\'+g+\'">Confirmar</button></div>\'}function hojeFilaLin(a){'
);

trocaUnica(
  'Hoje oferece registro depois da mensagem',
  '+fxOperacao(a,hj,atr)+fxMotivo(a,!0)+\'<div class="scripts" data-scripts></div></div>\'}function hojeFila(d)',
  '+fxOperacao(a,hj,atr)+fxMotivo(a,!0)+\'<div class="scripts" data-scripts></div>\'+filaResultadoHTML(a,hj)+\'</div>\'}function hojeFila(d)'
);

fs.writeFileSync(alvo, src, 'utf8');
console.log('PATCH_FILA_EXECUCAO_ASSISTIDA_OK');
