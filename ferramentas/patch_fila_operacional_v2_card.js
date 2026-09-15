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

function trocaFaixa(rotulo, inicio, fim, depois) {
  const ini = src.indexOf(inicio);
  const prox = ini < 0 ? -1 : src.indexOf(fim, ini + inicio.length);
  if (ini < 0 || prox < 0 || src.indexOf(inicio, ini + 1) >= 0) {
    throw new Error(rotulo + ': limites nao sao unicos');
  }
  src = src.slice(0, ini) + depois + src.slice(prox);
}

trocaUnica(
  'classificacao executavel e resumo dos excluidos',
  'function m(a,e){return!(!a||"pendente"!==a.status)&&podeAbordar(a)&&(!(!a.proximo_contato||a.proximo_contato>e)&&u(a.ultimo_toque_em)!==e)}function mPos(a,e){return!!a&&"convertido"===a.status&&!a.arquivado_em&&podeAbordar(a)&&!!a.cadencia_passo&&!a.cadencia_encerrada&&!!a.proximo_contato&&a.proximo_contato<=e&&u(a.ultimo_toque_em)!==e}',
  'function devidoCom(a,e){return!!a&&!a.arquivado_em&&"pendente"===a.status&&!!a.proximo_contato&&a.proximo_contato<=e&&u(a.ultimo_toque_em)!==e}function devidoPos(a,e){return!!a&&"convertido"===a.status&&!a.arquivado_em&&!!a.cadencia_passo&&!a.cadencia_encerrada&&!!a.proximo_contato&&a.proximo_contato<=e&&u(a.ultimo_toque_em)!==e}function m(a,e){return devidoCom(a,e)&&podeAbordar(a)}function mPos(a,e){return devidoPos(a,e)&&podeAbordar(a)}function motivoFora(a){var d=String(a&&a.whatsapp_digitos||"").replace(/\\D/g,"");if(!d)return"sem canal";if(!a||!0!==a.consentimento)return"sem consentimento";if(a.duplicata_de)return"duplicata";var v=a.veredito;return"pare"===v?"pare":"nao_mande"===v?"não mande":"espere"===v?"aguardando":"fora"===v?"fora da cadência":"bloqueio da régua"}function filaExcluidos(a,e){var cont={},total=0,ordem=["pare","sem consentimento","sem canal","duplicata","não mande","aguardando","fora da cadência","bloqueio da régua"];(a||[]).forEach(function(x){if(!(devidoCom(x,e)||devidoPos(x,e))||podeAbordar(x))return;var r=motivoFora(x);cont[r]=(cont[r]||0)+1;total++});return{total:total,motivos:ordem.filter(function(r){return!!cont[r]}).map(function(r){return{rotulo:r,total:cont[r]}})}}function filaForaTexto(a,e){var f=filaExcluidos(a,e),ms=f.motivos.map(function(x){return(x.total>1?x.total+" ":"")+x.rotulo}).join(" · ");return f.total+" fora da fila"+(ms?": "+ms:"")}'
);

trocaUnica(
  'recorte com excluidos',
  'function filaRecorte(a,e){var ps=(a||[]).filter(function(x){return"convertido"===x.status}).length,cs=(a||[]).length-ps,d=String(e).slice(8,10)+"/"+String(e).slice(5,7);return\'<div class="fila-recorte" role="note"><span class="fila-recorte-tit">Fila unificada</span><span class="fila-recorte-cont">\'+cs+(1===cs?" comercial":" comerciais")+" · "+ps+" de pós-venda"+\'</span><span class="fila-recorte-jan">pós-venda com passo vencendo até \'+c(d)+"</span></div>"}',
  'function filaRecorte(a,e){var ps=(a||[]).filter(function(x){return"convertido"===x.status}).length,cs=(a||[]).length-ps,d=String(e).slice(8,10)+"/"+String(e).slice(5,7),fora=filaForaTexto(i,e);return\'<div class="fila-recorte" role="note"><span class="fila-recorte-tit">Fila unificada</span><span class="fila-recorte-cont">\'+cs+(1===cs?" comercial":" comerciais")+" · "+ps+" de pós-venda"+\'</span><span class="fila-recorte-fora">\'+c(fora)+\'</span><span class="fila-recorte-jan">pós-venda com passo vencendo até \'+c(d)+"</span></div>"}'
);

trocaFaixa(
  'hierarquia operacional do card',
  'function fxMotivo',
  'function fxCli',
  'function fxMotivo(a){var e=a&&a.veredito_motivo;return e?\'<div class="card-motivo"><span class="card-motivo-rot">Por que agora</span><span>\'+c(e)+"</span></div>":""}function fxDataCurta(v){return v?String(v).slice(8,10)+"/"+String(v).slice(5,7):""}function fxOperacao(a,hoje,i){var passo=a.cadencia_rotulo||(null!=a.cadencia_passo?"Passo "+a.cadencia_passo:""),vence=a.cadencia_vence_em||a.proximo_contato,dias=vence?p(vence,hoje):i,prazo=vence?fxDataCurta(vence):"sem data",valor=Number(a.valor_em_jogo),v="";if(vence)prazo+=(dias>0?" · "+dias+"d atrasado":0===dias?" · hoje":"");if(isFinite(valor)&&valor>0)v=\'<span class="card-op-item card-op-valor"><span class="card-op-rot">\'+("convertido"===a.status?"compra registrada":"valor em jogo")+\'</span><span class="card-op-val">R$ \'+valor.toLocaleString("pt-BR",{minimumFractionDigits:2,maximumFractionDigits:2})+"</span></span>";return\'<div class="card-operacao">\'+\'<span class="card-op-item"><span class="card-op-rot">passo</span><span class="chip cad-mono card-passo">\'+c(passo||"sem passo")+"</span></span>"+\'<span class="card-op-item"><span class="card-op-rot">vencimento</span><span class="card-op-val card-vencimento">\'+c(prazo)+"</span></span>"+v+"</div>"}function fxOrigem(a){var r=c(s("origem",a.origem));return"indicacao"===a.origem&&a.indicado_por?r+\' <span class="cond">\\u00b7 por \'+c(a.indicado_por)+"</span>":r}function fxFila(a,i,hoje){var tel=f(a.whatsapp_digitos),ini=String(a.nome||"?").trim().charAt(0).toUpperCase()||"?",prod=c(a.produto||"")+(a.condicao?\' <span class="cond">\\u00b7 \'+c(s("condicao",a.condicao))+"</span>":"");return\'<div class="card-linha">\'+\'<div class="card-av" aria-hidden="true">\'+c(ini)+"</div>"+\'<div class="card-id"><div class="card-nome">\'+c(a.nome||"")+"</div>"+\'<div class="card-code">\'+c(a.lead_code||"")+(tel?\' <span class="card-tel-in">\\u00b7 \'+c(tel)+"</span>":"")+"</div></div>"+fxCol("produto",prod,"sem produto")+fxCol("origem",fxOrigem(a),"sem origem")+\'<div class="card-dir">\'+fxVerChip(a,i)+(a.id?\'<button class="btn-editar" data-acao="editar" data-id="\'+c(a.id)+\'">Editar</button>\':"")+"</div></div>"+fxOperacao(a,hoje,i)+fxMotivo(a)}'
);

trocaUnica(
  'cadencia sem duplicacao e data no card',
  '"fila"===e&&"convertido"===a.status&&(n.push(\'<span class="chip st-convertido">\'+c(s("status",a.status))+"</span>"),a.cadencia_rotulo&&n.push(\'<span class="chip cad-mono">\'+c(a.cadencia_rotulo)+"</span>"));',
  '"fila"===e&&"convertido"===a.status&&n.push(\'<span class="chip st-convertido">\'+c(s("status",a.status))+"</span>");'
);

trocaUnica(
  'chamada do card operacional',
  '"fila"===e?fxFila(a,i):',
  '"fila"===e?fxFila(a,i,o):'
);

trocaUnica(
  'acao principal da Fila',
  '<a class="btn-wa card-wa-linha" target="_blank" rel="noopener" data-wa-lead="',
  '<a class="btn-wa card-wa-linha card-acao-principal" target="_blank" rel="noopener" data-wa-lead="'
);

trocaUnica(
  'acao principal da Hoje',
  '<a class="btn-wa fila-wa" target="_blank" rel="noopener" href="',
  '<a class="btn-wa fila-wa card-acao-principal" target="_blank" rel="noopener" href="'
);

trocaFaixa(
  'card operacional na Hoje',
  'function hojeFilaLin',
  'function hojeFila(d)',
  'function hojeFilaLin(a){var nv=a.nivel||"quente",hj=l(),atr=p(a.proximo_contato,hj),tag=atr>0?\'<span class="fila-atraso">\'+atr+\'d de atraso</span>\':\'<span class="fila-prazo-hoje">vence hoje</span>\',prod=c(a.produto||"")+(a.condicao?" · "+c(s("condicao",a.condicao)):"sem produto");return\'<div class="fila-lin" data-lead="\'+c(a.lead_code||"")+\'"><div class="fila-lin-topo"><div class="fila-ident">\'+nivelPonto(nv)+\'<span class="fila-nome">\'+c(a.nome||"")+\'</span><span class="fila-nivel n-\'+c(nv)+\'">\'+c(s("nivel",nv))+\'</span></div>\'+fxVerChip(a,atr)+tag+\'<button class="btn-acao sugerir fila-sug" data-acao="hoje-sugerir" data-id="\'+c(a.id)+\'">Sugerir</button>\'+filaEnviarHTML(a)+\'</div><div class="fila-contexto"><span>\'+prod+\'</span><span>\'+(a.perfil?c(s("perfil",a.perfil)):"sem perfil")+"</span></div>"+fxOperacao(a,hj,atr)+fxMotivo(a)+\'<div class="scripts" data-scripts></div></div>\'}'
);

trocaUnica(
  'recorte sempre visivel na Fila',
  'filaOp.length&&e.insertAdjacentHTML("afterbegin",filaRecorte(filaOp,a));',
  'e.insertAdjacentHTML("afterbegin",filaRecorte(filaOp,a));'
);

trocaFaixa(
  'recorte visivel na Hoje vazia',
  'function hojeFila(d)',
  'function hojeLembretes(d)',
  'function hojeFila(d){var ativos=(i||[]).filter(function(x){return!x.arquivado_em}),fila=vOperacional(ativos,l()),recorte=filaRecorte(fila,l());if(!fila.length)return\'<div class="dia-sec"><div class="dia-sec-tit">Fila de hoje</div>\'+recorte+\'<div class="dia-vazio">Fila zerada hoje. Nada vencendo.</div></div>\';var top=fila.slice(0,5).map(hojeFilaLin).join("");return\'<div class="dia-sec"><div class="dia-sec-cab"><div class="dia-sec-tit">Fila de hoje</div><span class="dia-sec-badge">\'+fila.length+\' item\'+(1===fila.length?"":"s")+\'</span>\'+\'<button class="fila-vertodos" data-acao="hoje-verfila">ver todos (\'+fila.length+")</button></div>"+recorte+top+"</div>"}'
);

trocaUnica(
  'exporta resumo puro para prova',
  'montarFilaOperacional:vOperacional,',
  'montarFilaOperacional:vOperacional,resumirExcluidosFila:filaExcluidos,'
);

fs.writeFileSync(alvo, src, 'utf8');
console.log('PATCH_FILA_CARD_V2_OK');
