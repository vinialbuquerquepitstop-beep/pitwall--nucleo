'use strict';
// Isolated read-only prototype. Never feed these rows into C01 or automatic promotion.
const MONEY=/^\s*💲\s*\(\s*([1-9]\d{2,5})\s*\)\s*$/u;
const COLOR=/^\s*❇️\s*([^💲\n]+?)(?:\s*💲\s*\(\s*([1-9]\d{2,5})\s*\))?\s*$/u;
const PRODUCT=/\b(?:air\s*pods|pencil|pincel|magic\s*mouse|fonte|cabo|macbook|imac|ipad|iphone|watch|apple\s*tv)\b/i;
const SECTION=/\b(?:lacrado|garantia|categoria|acess[oó]rios)\b/i;
function extractScopedRows(text){
 const rows=[];let model=null,scope=null;
 const lines=String(text).split(/\r?\n/);
 for(let i=0;i<lines.length;i++){
  const line=lines[i].trim();if(!line)continue;
  const color=line.match(COLOR),money=line.match(MONEY);
  if(!color&&!money&&SECTION.test(line)&&!/\d/.test(line)){model=null;scope=null;continue;}
  if(!color&&!money&&PRODUCT.test(line)){model={label:line,line:i+1};scope=null;continue;}
  if(!model)continue;
  if(money){scope={amount:Number(money[1]),line:i+1};continue;}
  if(color){
   const inline=color[2]?Number(color[2]):null;
   const price=inline||scope?.amount||null;
   rows.push({model:model.label,modelLine:model.line,color:color[1].trim(),price,
    priceLine:inline?i+1:scope?.line??null,variantLine:i+1,
    needsReview:price===null,autoPromote:false});
  }
 }
 return rows;
}
module.exports={extractScopedRows};
