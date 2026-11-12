'use strict';

// Fail-closed source-to-variant association. It must not equate "quoted somewhere
// in the same document" with price belonging to the selected model/color.
const key=s=>String(s||'').normalize('NFKD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/\s+/g,' ').trim();
const reason=(offer_ref,code)=>({offer_ref,field:'price',reason:code});
const findAll=(text,quote)=>{
 const offsets=[];let at=0;
 while(at<text.length){const n=text.indexOf(quote,at);if(n<0)break;offsets.push(n);at=n+Math.max(quote.length,1);if(offsets.length>10)break}
 return offsets;
};
const location=(source,quote)=>{
 const starts=findAll(source.text,quote);
 if(starts.length!==1)return {unique:false};
 const begin=starts[0];
 const lines=source.text.slice(0,begin).split(/\r?\n/);
 const lineNo=lines.length-1;
 const all=source.text.split(/\r?\n/);
 return {unique:true,line:lineNo,text:all[lineNo],lineCount:all.length};
};
const moneyTokens=s=>String(s).match(/(?:R\$\s*)?(?:\d{1,3}(?:\.\d{3})+|\d{4,7})(?:,\d{2})/g)||[];
const scoped=(a,b)=>a.source_ref===b.source_ref;
function checkVariantEvidenceBinding(extraction){
 const sources=new Map(extraction.sources.map(s=>[s.source_ref,s]));
 const issues=[];
 for(const offer of extraction.offers){
  if(!offer.model||!offer.price)continue;
  const modelQuotes=offer.field_evidence.model||[];
  const priceQuotes=offer.field_evidence.price||[];
  if(modelQuotes.length!==1||priceQuotes.length!==1){
   issues.push(reason(offer.offer_ref,'VARIANT_BINDING_REQUIRES_SINGLE_MODEL_AND_PRICE_QUOTE'));continue;
  }
  const m=modelQuotes[0],p=priceQuotes[0];
  if(!scoped(m,p)){issues.push(reason(offer.offer_ref,'MODEL_PRICE_DIFFERENT_SOURCES'));continue}
  const source=sources.get(m.source_ref);
  if(!source){issues.push(reason(offer.offer_ref,'SOURCE_NOT_FOUND'));continue}
  const modelLoc=location(source,m.quote),priceLoc=location(source,p.quote);
  if(!modelLoc.unique||!priceLoc.unique){
   issues.push(reason(offer.offer_ref,'DUPLICATED_QUOTE_LOCATION'));continue;
  }
  // Single-line lines containing >1 price cannot be safely assigned to a
  // specific product without an independent row/cell structure.
  if(moneyTokens(priceLoc.text).length!==1){
   issues.push(reason(offer.offer_ref,'MULTIPLE_PRICES_SAME_LINE'));continue;
  }
  // Multiple product headings on a single source line defeat a single-variant
  // assignment even when the AI supplies an apparently precise model quote.
  if((modelLoc.text.match(/\b(?:iphone|ipad|macbook|airpods|galaxy|poco)\b/gi)||[]).length>1){
   issues.push(reason(offer.offer_ref,'MULTIPLE_MODELS_SAME_LINE'));continue;
  }
  // If a model name is a prefix of another more specific model on the same
  // line, a bare iPhone 17 must not be confused with an iPhone 17 Pro/Max.
  const suffix=modelLoc.text.slice(modelLoc.text.indexOf(m.quote)+m.quote.length);
  if(/^(?:\s+)(?:pro(?:\s+max)?|plus|air|max|e)\b/i.test(suffix) &&
     !/\b(?:pro|plus|air|max)\b/i.test(offer.model)){
    issues.push(reason(offer.offer_ref,'MODEL_VARIANT_SUFFIX_CONFLICT'));continue;
  }
  if(modelLoc.line>priceLoc.line){
   issues.push(reason(offer.offer_ref,'PRICE_BEFORE_MODEL_CONTEXT'));continue;
  }
  if(modelLoc.line!==priceLoc.line){
   const between=source.text.split(/\r?\n/).slice(modelLoc.line+1,priceLoc.line);
   if(between.length>6||between.some(line=>!line.trim())){
    issues.push(reason(offer.offer_ref,'PRICE_OUTSIDE_MODEL_BLOCK'));continue;
   }
   // A later, intervening model title or other price could override scope.
   if(between.some(line=>/\b(?:iphone|ipad|macbook|airpods|galaxy|poco)\b/i.test(line))){
    issues.push(reason(offer.offer_ref,'INTERVENING_MODEL_OR_PRICE'));continue;
   }
   const previousPrices=between.filter(line=>moneyTokens(line).length);
   if(previousPrices.length && (!offer.color ||
      !key(priceLoc.text).includes(key(offer.color)) ||
      previousPrices.some(line=>key(line).includes(key(offer.color))))){
    issues.push(reason(offer.offer_ref,'INTERVENING_MODEL_OR_PRICE'));continue;
   }
   // Multiple price rows under one heading are permitted only when color
   // is on the price row and independently evidenced; no implicit matching.
   const block=source.text.split(/\r?\n/);
   const next=block.slice(priceLoc.line+1).findIndex(line=>!line.trim()||/\b(?:iphone|ipad|macbook|airpods|galaxy|poco)\b/i.test(line));
   const end=next<0?Math.min(block.length,priceLoc.line+5):priceLoc.line+1+next;
   const priceRows=block.slice(modelLoc.line+1,end).filter(line=>moneyTokens(line).length===1);
   if(priceRows.length>1){
    const color=offer.color&&offer.field_evidence.color||[];
    if(!offer.color||color.length!==1||color[0].source_ref!==p.source_ref||
       !location(source,color[0].quote).unique||
       location(source,color[0].quote).line!==priceLoc.line||
       !key(priceLoc.text).includes(key(offer.color))){
      issues.push(reason(offer.offer_ref,'MULTI_PRICE_VARIANT_COLOR_NOT_LINKED'));continue;
    }
   }
  }else{
   // When model and price share a line, repeated model/price rows are
   // distinguished by their uniquely located evidence quotes.
   if(modelLoc.text!==priceLoc.text){
    issues.push(reason(offer.offer_ref,'SOURCE_LINE_MISMATCH'));continue;
   }
  }
  // Color cannot be borrowed from another offer's row.
  if(offer.color){
   const colors=offer.field_evidence.color||[];
   if(colors.length!==1||colors[0].source_ref!==p.source_ref){
    issues.push(reason(offer.offer_ref,'COLOR_PRICE_SOURCE_MISMATCH'));continue;
   }
   const c=location(source,colors[0].quote);
   if(!c.unique || (c.line!==modelLoc.line && c.line!==priceLoc.line)){
    issues.push(reason(offer.offer_ref,'COLOR_PRICE_ROW_MISMATCH'));continue;
   }
  }
 }
 return issues;
}
module.exports={checkVariantEvidenceBinding};
