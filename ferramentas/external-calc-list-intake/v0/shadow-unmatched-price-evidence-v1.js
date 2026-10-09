'use strict';
// Audit price-like source lines not explained by any shadow parser.
// A price-like line is NOT necessarily an offer; this is only an audit signal.
const crypto=require('node:crypto');
const {reconcileShadowSource}=require('./shadow-source-reconciliation-v1');
const sha=x=>crypto.createHash('sha256').update(String(x)).digest('hex');
const PRICE_SIGNAL=/(?:💲|💵|💰|R\$\s*|\b(?:pre[cç]o|valor)\s*[:=]\s*(?:R\$)?\s*[0-9])/iu;
function auditUnmatchedPriceEvidence(content){
 if(typeof content!=='string')throw new Error('SOURCE_REQUIRED');
 const lines=content.split(/\r?\n/);
 const reconciliation=reconcileShadowSource(content);
 const covered=new Set(reconciliation.candidates.map(x=>x.priceLine)
  .filter(x=>Number.isSafeInteger(x)&&x>0));
 const priceLike=[];
 for(let i=0;i<lines.length;i++){
  if(PRICE_SIGNAL.test(lines[i])){
   priceLike.push({line:i+1,fingerprint:sha(lines[i]),covered_by_shadow:covered.has(i+1)});
  }
 }
 return {contract_version:'external-calc-shadow-price-evidence/v1',
  source_sha256:sha(content),price_like_lines:priceLike.length,
  covered_price_like_lines:priceLike.filter(x=>x.covered_by_shadow).length,
  unmatched_price_like_lines:priceLike.filter(x=>!x.covered_by_shadow).length,
  // No source text or prices included; unmatched is not automatically an extraction failure.
  source_truth_verified:false,release_status:'NO_GO',evidence:priceLike};
}
module.exports={auditUnmatchedPriceEvidence};
