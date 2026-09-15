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
  'chip sem prazo duplicado na Hoje',
  'function fxVerChip(a,e){',
  'function fxVerChip(a,e,semPrazo){'
);

trocaUnica(
  'prazo opcional no chip',
  'if(["prioridade","agora","mande"].indexOf(o)>=0)i+=',
  'if(!semPrazo&&["prioridade","agora","mande"].indexOf(o)>=0)i+='
);

trocaUnica(
  'motivo compacto quando passo e atraso ja estao estruturados',
  'function fxMotivo(a){var e=a&&a.veredito_motivo;return e?\'<div class="card-motivo"><span class="card-motivo-rot">Por que agora</span><span>\'+c(e)+"</span></div>":""}',
  'function fxMotivo(a,limpo){var e=a&&a.veredito_motivo;if(limpo&&e&&a.cadencia_rotulo){var ini=a.cadencia_rotulo+" vencido ha ";if(0===e.indexOf(ini)){var fim=e.indexOf(". ",ini.length);fim>ini.length&&(e=e.slice(fim+2))}}return e?\'<div class="card-motivo"><span class="card-motivo-rot">Por que agora</span><span>\'+c(e)+"</span></div>":""}'
);

trocaUnica(
  'remove etiqueta de atraso duplicada da Hoje',
  'atr=p(a.proximo_contato,hj),tag=atr>0?\'<span class="fila-atraso">\'+atr+\'d de atraso</span>\':\'<span class="fila-prazo-hoje">vence hoje</span>\',prod=',
  'atr=p(a.proximo_contato,hj),prod='
);

trocaUnica(
  'veredito limpo na Hoje',
  'fxVerChip(a,atr)+tag+',
  'fxVerChip(a,atr,!0)+'
);

trocaUnica(
  'motivo compacto na Hoje',
  'fxOperacao(a,hj,atr)+fxMotivo(a)+',
  'fxOperacao(a,hj,atr)+fxMotivo(a,!0)+'
);

fs.writeFileSync(alvo, src, 'utf8');
console.log('PATCH_FILA_CARD_V2_FIX_OK');
