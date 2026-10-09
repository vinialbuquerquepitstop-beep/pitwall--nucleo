'use strict';
// Shadow-only reconciliation. NEVER invoke C01 persistence or auto promotion here.
const {extractScopedRows}=require('./experimental-scoped-price-boundaries-v2');
const {extractCaptainScopedVariants}=require('./experimental-captain-scoped-variants-v1');
const {reconcileStandaloneReview}=require('./experimental-captain-standalone-review-v1');
const crypto=require('node:crypto');
const sha=t=>crypto.createHash('sha256').update(String(t)).digest('hex');

function reconcileShadowSource(content){
 const lines=String(content).split(/\r?\n/);
 const engines=[
  ['MEGA_SCOPED',extractScopedRows],
  ['CAPTAIN_VARIANTS',extractCaptainScopedVariants],
  ['CAPTAIN_STANDALONE',reconcileStandaloneReview]
 ];
 const candidates=[];
 let nonOfferMarkers=0;
 for(const [engine,fn] of engines){
  for(const item of fn(content)){
   const modelLine=item.modelLine??item.productLine;
   const variantLine=item.variantLine;
   const priceLine=item.priceLine;
   // A source line is evidence only when line indexes genuinely exist in THIS document.
   if(!Number.isSafeInteger(modelLine)||modelLine<1||modelLine>lines.length)continue;
   if(!Number.isSafeInteger(priceLine)||priceLine<1||priceLine>lines.length)continue;
   if(variantLine!=null&&(!Number.isSafeInteger(variantLine)||variantLine<1||variantLine>lines.length))continue;
   const amountMinor=item.amount_minor??(Number.isInteger(item.price)?item.price*100:null);
   // Standalone separators/category banners have no price and are not offers.
   // Suppress only a narrow, explicitly recognized group; other missing prices stay review-required.
   const variantText=String(item.color??item.variant??'').trim();
   const decoration=amountMinor===null && (
     /^(?:LANÇAMENTO|IPHONE CPO)\s*❇️?$/iu.test(variantText)
     || /^[❇️\s]{2,}$/u.test(variantText)
   );
   if(decoration){nonOfferMarkers++;continue;}
   candidates.push({
    engine,model:item.model??item.product,variant:item.color??item.variant??null,
    amount_minor:amountMinor,modelLine,variantLine:variantLine??null,priceLine,
    source_fingerprint:sha(lines.slice(Math.max(0,modelLine-1),priceLine).join('\n')),
    disposition:'REVIEW_REQUIRED',autoPromote:false,
    reviewReasons:['SHADOW_PROTOTYPE_NOT_C01_VALIDATED',...(item.reviewReasons??[]),
      ...(item.reviewReason?[item.reviewReason]:[]),
      ...(item.needsReview?['SOURCE_REQUIRES_REVIEW']:[])]
   });
  }
 }
 const byPriceLine=new Map();
 for(const row of candidates){
  if(row.priceLine===null)continue;
  const k=row.priceLine;
  if(!byPriceLine.has(k))byPriceLine.set(k,[]);
  byPriceLine.get(k).push(row);
 }
 let overlappingPriceLines=0,sharedPriceScopeLines=0;
 for(const matches of byPriceLine.values()){
  if(matches.length<=1)continue;
  const scopes=new Set(matches.map(row=>[row.engine,row.modelLine,row.amount_minor].join('|')));
  // Multiple colors may legitimately inherit the same price inside one model block.
  // A conflict exists only when the price line is attributed across distinct scopes.
  if(scopes.size===1){
   sharedPriceScopeLines++;
   continue;
  }
  overlappingPriceLines++;
  for(const row of matches){row.reviewReasons.push('MULTIPLE_PARSERS_SAME_PRICE_LINE');}
 }
 return {contract_version:'external-calc-shadow-reconciliation/v1',
  source_sha256:sha(content),source_lines:lines.length,
  shadow_candidates:candidates.length,non_offer_markers:nonOfferMarkers,
  shared_price_scope_lines:sharedPriceScopeLines,
  overlapping_price_lines:overlappingPriceLines,
  review_required:candidates.length,auto_promoted:0,
  candidates};
}
module.exports={reconcileShadowSource};
