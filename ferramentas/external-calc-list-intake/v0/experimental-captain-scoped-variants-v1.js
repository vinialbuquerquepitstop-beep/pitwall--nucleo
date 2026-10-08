'use strict';
// Isolated source-line proof. Do not connect to C01 or auto-promotion.
const MODEL=/^\s*(?:📳|💻)\s*((?:1[5-8]\s+(?:PRO(?:\s+MAX)?\s+)?(?:128|256|512)|MACBOOK\s+(?:PRO|NEO|AIR)\b)[^\n]*)$/iu;
const VARIANT=/^\s*⚓️?\s*([^/\n]{2,32})\s*\/\s*💲\s*([1-9]\d{0,2}(?:\.\d{3})+|[1-9]\d{2,5})(?:\s*-\s*(\d+)\s*(?:pc)?)?\s*$/iu;
const SECTION=/^(?:🚨|❌|🔌|🖱|🖌|🕶|⌚|📦|✅|Varejo|Atacado)/iu;
function extractCaptainScopedVariants(input){
 const rows=[];let active=null;
 const lines=String(input).split(/\r?\n/);
 for(let i=0;i<lines.length;i++){
  const line=lines[i].trim();
  if(!line)continue;
  const model=line.match(MODEL);
  if(model){active={label:model[1].trim(),line:i+1};continue;}
  if(SECTION.test(line)){active=null;continue;}
  const variant=line.match(VARIANT);
  if(variant && active){
   const priceText=variant[2],price=Number(priceText.replace(/\./g,''));
   rows.push({model:active.label,modelLine:active.line,variantLine:i+1,priceLine:i+1,
    color:variant[1].trim(),price,quantity:variant[3]?Number(variant[3]):null,
    needsReview:false,autoPromote:false});
   continue;
  }
  // Unknown lines after a model must not propagate its identity into later sections.
  if(active && (/[💲]/u.test(line)|| /^[📳💻]/u.test(line)))active=null;
 }
 return rows;
}
module.exports={extractCaptainScopedVariants};
