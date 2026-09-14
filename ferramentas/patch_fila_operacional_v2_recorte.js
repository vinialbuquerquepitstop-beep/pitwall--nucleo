// Patch cirurgico da Fatia 1 sobre o nucleo minificado de public/app.js.
// Mantem comercial e pos-venda na mesma ordenacao, mas declara a composicao
// e a janela do pos-venda antes dos cards.
const fs = require('fs');
const path = require('path');

const alvo = path.join(__dirname, '..', 'public', 'app.js');
let src = fs.readFileSync(alvo, 'utf8');

function trocaUma(velho, novo, rotulo) {
  const partes = src.split(velho);
  if (partes.length !== 2) {
    throw new Error(rotulo + ': esperado 1 alvo, encontrado ' + (partes.length - 1));
  }
  src = partes[0] + novo + partes[1];
}

trocaUma(
  'function vOperacional(a,e){return v(a,e).concat(vPos(a,e)).sort(cmpVer)}',
  'function vOperacional(a,e){return v(a,e).concat(vPos(a,e)).sort(cmpVer)}' +
  'function filaRecorte(a,e){var ps=(a||[]).filter(function(x){return"convertido"===x.status}).length,cs=(a||[]).length-ps,d=String(e).slice(8,10)+"/"+String(e).slice(5,7);return\'<div class="fila-recorte" role="note"><span class="fila-recorte-tit">Fila unificada</span><span class="fila-recorte-cont">\'+cs+(1===cs?" comercial":" comerciais")+" · "+ps+" de pós-venda"+\'</span><span class="fila-recorte-jan">pós-venda com passo vencendo até \'+c(d)+"</span></div>"}',
  'funcao filaRecorte'
);

trocaUma(
  '"fila"===n){N(e,vOperacional(o,a),"fila",a,\'<div class="estado"><strong>Fila limpa.</strong><br>Nenhum lead vence hoje. O proximo entra sozinho na data marcada.</div>\');prefetchFilaSug(24).then(filaWaAtualizar)}',
  '"fila"===n){var filaOp=vOperacional(o,a);N(e,filaOp,"fila",a,\'<div class="estado"><strong>Fila limpa.</strong><br>Nenhum lead vence hoje. O proximo entra sozinho na data marcada.</div>\');filaOp.length&&e.insertAdjacentHTML("afterbegin",filaRecorte(filaOp,a));prefetchFilaSug(24).then(filaWaAtualizar)}',
  'render da aba Fila'
);

const inicioHoje = src.indexOf('function hojeFila(d){');
const fimHoje = src.indexOf('function hojeLembretes(d){', inicioHoje);
if (inicioHoje < 0 || fimHoje < 0) throw new Error('funcao hojeFila nao encontrada');
const hojeAntigo = src.slice(inicioHoje, fimHoje);
let hojeNovo = hojeAntigo;
hojeNovo = hojeNovo.replace(
  'fila.length+\' pendente\'+(1===fila.length?"":"s")',
  'fila.length+\' item\'+(1===fila.length?"":"s")'
);
hojeNovo = hojeNovo.replace(
  '\')</button></div>\'+top+"</div>"}',
  '\')</button></div>\'+filaRecorte(fila,l())+top+"</div>"}'
);
if (hojeNovo === hojeAntigo || hojeNovo.indexOf('filaRecorte(fila,l())') < 0) {
  throw new Error('render da Hoje mudou de forma; conferir antes de forcar');
}
src = src.slice(0, inicioHoje) + hojeNovo + src.slice(fimHoje);

fs.writeFileSync(alvo, src, 'utf8');
console.log('OK: recorte da Fila Operacional v2 aplicado.');
