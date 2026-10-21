'use strict';
// Three-column structure COLOR | UNIT_PRICE | CONDITION.
// Generic syntax only: no supplier identities, brand names, or SKU whitelist.
// Used solely by the VS2 shadow resolver.
function parsePipedRow(member,helpers){
 const raw=String(member?.text??'');
 const parts=raw.split('|').map(s=>s.trim());
 if(parts.length!==3)return null;
 const color=parts[0].replace(/[\uFE0E\uFE0F]/gu,'')
   .replace(/^[▫•🎨*]\s*/u,'').trim();
 const amountPattern='^(?:R\\$\\s*)?('+helpers.amountSource+')$';
 const match=new RegExp(amountPattern,'u').exec(parts[1]);
 const conditionPattern=/^(?:cpo|lacrad[oa]s?|caixa aberta|open box|seminov[oa]s?|recondicionad[oa]s?|usad[oa]s?|n[aã]o ativad[oa])$/iu;
 if(!/^\p{L}[\p{L}\s-]{0,50}$/u.test(color)||
    !match||!conditionPattern.test(parts[2])||
    helpers.nonCommercial.test(parts[0])){
   return {kind:'invalid',source_ref:member.source_ref};
 }
 const price=helpers.minor(match[1]);
 const condition=helpers.conditionToken(parts[2]);
 if(!price||!condition)return {kind:'invalid',source_ref:member.source_ref};
 return {kind:'piped_offer',color,price_minor:price,condition,source_ref:member.source_ref};
}
module.exports={parsePipedRow};
