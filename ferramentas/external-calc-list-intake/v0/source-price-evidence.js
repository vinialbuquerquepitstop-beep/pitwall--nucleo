'use strict';
// Promote only when the monetary value is present on a traced source price line.
// Missing cents never proves a non-zero-cent amount.
function escapeNumberFormat(value){
  return String(value).replace(/\./g,'\\.').replace(/ /g,'\\s+');
}
function grouped(whole,sep){return whole.replace(/\B(?=(\d{3})+(?!\d))/g,sep);}
function exactBRLAmountInText(text,amountMinor){
  if(!Number.isSafeInteger(amountMinor)||amountMinor<=0)return false;
  const major=Math.floor(amountMinor/100),cents=amountMinor%100;
  const whole=String(major),fraction=String(cents).padStart(2,'0');
  const variants=[
    [whole,'[.,]'],
    [grouped(whole,'.'),','],
    [grouped(whole,','),'\\.'],
    [grouped(whole,' '),'[.,]']
  ];
  const formatted=new Set();
  for(const [base,sep] of variants){
    const normalized=escapeNumberFormat(base);
    if(cents===0){
      formatted.add(normalized);
      formatted.add(normalized+sep+'00');
    } else {
      formatted.add(normalized+sep+fraction);
    }
  }
  const expression=new RegExp('(?<![\\d.,])(?:'+[...formatted].join('|')+')(?![\\d.,])','u');
  return expression.test(String(text||''));
}
function linkedPriceHasExactAmount(candidate){
  const evidence=candidate?.review_evidence;
  const refs=evidence?.field_sources?.price;
  const lines=evidence?.source_lines;
  const amountMinor=candidate?.interpreted_offer?.price?.amount_minor;
  if(!Array.isArray(refs)||!refs.length||!Array.isArray(lines))return false;
  const linked=new Set(refs);
  return lines.some(line=>linked.has(line?.line_number)
    &&exactBRLAmountInText(line?.raw,amountMinor));
}
module.exports={exactBRLAmountInText,linkedPriceHasExactAmount};
