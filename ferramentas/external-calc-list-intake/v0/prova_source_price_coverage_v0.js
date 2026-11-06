'use strict';
const assert=require('node:assert/strict');
const {auditSourcePriceCoverage:audit,isPriceSignal}=require('./source-price-coverage-v0');

const text=[
 'iPhone 17 Pro 256GB',
 'Azul R$ 6.900,00',
 'Preto R$ 7.050,00',
 'Frete: R$ 90,00'
].join('\n');
const good={review_evidence:{
 source_lines:[{line_number:2,raw:'Azul R$ 6.900,00'}],
 field_sources:{price:[2]}
}};
let r=audit(text,[good]);
assert.equal(r.contract_version,'external-calc-source-price-coverage/v0');
assert.equal(r.detected_price_signal_lines,3);
assert.equal(r.covered_price_signal_lines,1);
assert.equal(r.unmatched_price_signal_lines,2);
assert.deepEqual(r.unmatched_line_numbers,[3,4]);
assert.equal(r.source_truth_verified,false);
assert.equal(r.review_required,true);
assert.equal(r.can_auto_promote,false);
assert.equal(r.unverified_candidate_price_spans,0);
assert.equal(r.evidence.length,3);
assert.equal(JSON.stringify(r).includes('6.900,00'),false); // no raw supplier prices
assert.equal(JSON.stringify(r).includes('iPhone 17'),false); // no raw supplier models

r=audit(text,[{review_evidence:{
 source_lines:[{line_number:2,raw:'Azul R$ 6.800,00'}],
 field_sources:{price:[2]}
}}]);
assert.deepEqual(r.unmatched_line_numbers,[2,3,4],'forged raw span cannot cover source');

r=audit(text,[{review_evidence:{source_lines:[{line_number:2,raw:'Azul R$ 6.900,00'}],field_sources:{price:[123]}}}]);
assert.equal(r.unverified_candidate_price_spans,1,'invalid line reference must abstain');

r=audit('Produto lacrado\nR$ 6500 | R$ 6600',[]);
assert.deepEqual(r.multiple_explicit_prices_lines,[2]);
assert.deepEqual(r.unmatched_line_numbers,[2]);

assert.equal(isPriceSignal('💰5,650'),true);
assert.equal(isPriceSignal('iPhone 17 Pro 256GB'),false);
assert.equal(isPriceSignal('256GB'),false);
assert.equal(isPriceSignal('128/256GB'),false);
assert.equal(isPriceSignal('R$ 6.950,00'),true);

const empty=audit('Lista nova\nSem preços confirmados',[]);
assert.equal(empty.detected_price_signal_lines,0);
assert.equal(empty.review_required,true,'zero signals is NOT release authority');
assert.throws(()=>audit(null,[]),/COVERAGE_SOURCE_REQUIRED/);
assert.throws(()=>audit('x',null),/COVERAGE_CANDIDATES_REQUIRED/);
assert.deepEqual(audit(text,[good]),audit(text,[good]),'audit must be deterministic');
console.log('C01_CONTROLLED_PRICE_COVERAGE_V0=PASS');
