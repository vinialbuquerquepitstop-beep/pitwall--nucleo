'use strict';
// Experimental, read-only source reconciliation. Not part of C01 or auto-promotion.
const HEAD=/^\s*(?:⌚(?:️)?|🖌(?:️)?|🕶(?:️)?|🖱(?:️)?|🔌)\s*(.+)$/u;
const PRICE=/^\s*💲\s*([1-9]\d{0,2}(?:\.\d{3})*|[1-9]\d{2,5})(?:\s+a unidade)?\s*$/iu;
const BOX=/^\s*📦\s*Caixa com\s*(\d+)\s*:\s*💲\s*(\d{2,5})\s*$/iu;
const VARIANT=/^\s*⚓️?\s+(.+)$/u;
const SECTION=/^(?:Varejo|Atacado)(?:\s*\(.*\))?\s*$/iu;
const RESET=/^(?:📳|💻|❌|🚨|🏴|🍏)/u;
function reconcileStandaloneReview(input){
 const rows=[];let product=null,tier=null,variant=null;
 const lines=String(input).split(/\r?\n/);
 for(let i=0;i<lines.length;i++){
  const line=lines[i].trim();if(!line)continue;
  const header=line.match(HEAD);
  if(header){product={name:header[1].trim(),line:i+1};tier=null;variant=null;continue;}
  if(RESET.test(line)){product=null;tier=null;variant=null;continue;}
  if(!product)continue;
  const section=line.match(SECTION);
  if(section){tier=/^atacado/i.test(line)?'WHOLESALE':'RETAIL';variant=null;continue;}
  const color=line.match(VARIANT);
  if(color){variant={label:color[1].trim(),line:i+1};continue;}
  const box=line.match(BOX);
  const money=line.match(PRICE);
  if(!box&&!money)continue;
  const raw=box?box[2]:money[1];
  const units=box?Number(box[1]):1;
  rows.push({product:product.name,productLine:product.line,
   variant:variant?.label??null,variantLine:variant?.line??null,
   tier:box?'BOX':(tier??'UNSPECIFIED'),units,
   amount_minor:Number(raw.replace(/\./g,''))*100,priceLine:i+1,
   review_required:true,autoPromote:false,
   reviewReason:box?'PACKAGING_AND_TIER_REVIEW':'STANDALONE_PRICE_REVIEW'});
 }
 return rows;
}
module.exports={reconcileStandaloneReview};
