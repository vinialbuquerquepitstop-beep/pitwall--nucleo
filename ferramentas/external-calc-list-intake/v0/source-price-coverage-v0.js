'use strict';
// REVIEW ONLY. Monetary signals are audit hints, not proof of a sellable offer.
// The source text is authoritative; never infer missing offers as valid C01.
const crypto = require('node:crypto');
const {createHash}=crypto;
const EXPLICIT_PRICE=/(?:R\$\s*\d|[💵💰💲]\s*(?:R\$)?\s*[\d(]|\b(?:pre[cç]o|valor)\s*[:=]\s*(?:R\$)?\s*\d)/iu;
const BRL_FORMAT=/\b\d{1,3}(?:\.\d{3})+(?:,\d{2})?(?!\d)/u;
const BARE_WITH_CENTS=/(?:^|[^\p{L}\d])\d{4,6},\d{2}(?![\p{L}\d])/u;
const hash = s => createHash('sha256').update(s,'utf8').digest('hex');

function isPriceSignal(line){
 return EXPLICIT_PRICE.test(line)||BRL_FORMAT.test(line)||BARE_WITH_CENTS.test(line);
}
function priceEvidenceLines(candidate,lines){
 const refs=candidate?.review_evidence?.field_sources?.price;
 const evidence=candidate?.review_evidence?.source_lines;
 if(!Array.isArray(refs)||!Array.isArray(evidence)||refs.length===0)return [];
 const output=[];
 for(const v of refs){
  const idx=(Number.isSafeInteger(v)?v:(typeof v==='string'&&/^[1-9]\d*$/.test(v)?Number(v):null));
  if(!Number.isSafeInteger(idx)||idx<1||idx>lines.length)continue;
  if(evidence.some(x=>x&&x.line_number===idx&&x.raw===lines[idx-1])){
   output.push(idx);
  }
 }
 return output;
}
function auditSourcePriceCoverage(source,candidates){
 if(typeof source!=='string')throw new Error('COVERAGE_SOURCE_REQUIRED');
 if(!Array.isArray(candidates))throw new Error('COVERAGE_CANDIDATES_REQUIRED');
 const lines=source.replace(/\r\n/g,'\n').split('\n');
 const priceSignals=[];
 for(let i=0;i<lines.length;i++)if(isPriceSignal(lines[i])){
  priceSignals.push({line_number:i+1,line_sha256:hash(lines[i])});
 }
 const evidenced=new Set();
 let candidates_without_verified_price_span=0;
 for(const candidate of candidates){
  const refs=priceEvidenceLines(candidate,lines);
  if(refs.length===0)candidates_without_verified_price_span++;
  for(const idx of refs)evidenced.add(idx);
 }
 const unmatched=priceSignals.filter(x=>!evidenced.has(x.line_number));
 const multiToken=priceSignals.filter(x=>(lines[x.line_number-1].match(/R\$\s*\d/gi)||[]).length>1);
 return {
  contract_version:'external-calc-source-price-coverage/v0',
  source_sha256:hash(source),
  signal_definition:'HEURISTIC_PRICE_SIGNALS_ONLY',
  source_truth_verified:false,
  can_auto_promote:false,
  raw_line_count:lines.length,
  detected_price_signal_lines:priceSignals.length,
  covered_price_signal_lines:priceSignals.length-unmatched.length,
  unmatched_price_signal_lines:unmatched.length,
  unmatched_line_numbers:unmatched.map(x=>x.line_number),
  unverified_candidate_price_spans:candidates_without_verified_price_span,
  multiple_explicit_prices_lines:multiToken.map(x=>x.line_number),
  evidence:priceSignals.map(x=>({...x,matched:evidenced.has(x.line_number)})),
  review_required:true
 };
}
module.exports={auditSourcePriceCoverage,isPriceSignal,priceEvidenceLines};
