#!/usr/bin/env node
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
const {parseTextSource}=require('../../external-calc-universal-input/v1/text-adapter');
const {segmentCanonical}=require('./segment-shadow.cjs');
const {resolveAssociations}=require('./associate-shadow.cjs');
const {evaluateReview,validateShadow}=require('./review-shadow.cjs');
const doc=s=>parseTextSource({filename:'synthetic.txt',content:s},{idFactory:()=> 'vs3-shadow'});
const input=[
 '📚 Equipamentos Z',
 '📱 ZenX Pro 256GB',
 '📋 Condição: Lacrado',
 '🎨 Azul — R$ 5.100,00',
 '🎨 Branco — R$ 5.200,00',
 '📱 Dispositivo Delta 128GB',
 '📋 Condição: CPO',
 '🎨 Preto',
 '💰 R$ 3.500,00'
].join('\n');
let checks=0;
const test=(name,fn)=>{fn();checks++;console.log('VS3_OK '+checks+' '+name)};
test('valid proposed offers are never authorized',()=>{
 const d=doc(input),out=evaluateReview(d);
 assert.equal(out.review.summary.review_required,3);
 assert.equal(out.review.summary.critical_candidates,0);
 assert.equal(out.review.decision,'REVIEW_REQUIRED');
 assert.deepEqual(out.review.authorized_offers,[]);
 assert.equal(out.review.auto_approvable_count,0);
 assert(out.review.candidate_assessments.every(x=>x.reasons.includes('NOT_HUMAN_APPROVED')));
});
test('uncertainty in one block is explicitly material, not hidden',()=>{
 const d=doc('📱 QuantaX 128GB\n📋 Condição: Lacrado\n🎨 Verde\n🎨 Roxo\n💵 R$ 3.100,00');
 const {review,association}=evaluateReview(d);
 assert.equal(association.proposals.length,0);
 assert(association.abstentions.some(a=>a.reason==='MULTIPLE_COLORS_PRICE_SCOPE_UNCLEAR'));
 assert(review.summary.material_abstentions>0);
 assert(review.global_risks.some(x=>x.reason==='MATERIAL_ABSTENTION'));
});
test('forged price provenance is rejected as critical',()=>{
 const d=doc(input),s=segmentCanonical(d),a=resolveAssociations(d,s);
 a.proposals[0].source_spans.price=['line:999'];
 const review=validateShadow(d,s,a);
 assert(review.summary.critical_candidates>0);
 assert(review.candidate_assessments[0].reasons.includes('SOURCE_OUTSIDE_PRODUCT_BLOCK_PRICE'));
});
test('valid but out-of-block source is rejected',()=>{
 const d=doc(input),s=segmentCanonical(d),a=resolveAssociations(d,s);
 a.proposals[0].source_spans.color=['line:8'];
 const review=validateShadow(d,s,a);
 assert(review.candidate_assessments[0].reasons.includes('SOURCE_OUTSIDE_PRODUCT_BLOCK_COLOR'));
});
test('missing edge never remains unflagged',()=>{
 const d=doc(input),s=segmentCanonical(d),a=resolveAssociations(d,s);
 a.edges=a.edges.filter(e=>!(e.to===a.proposals[0].proposal_id&&e.relation==='unit_price'));
 const review=validateShadow(d,s,a);
 assert(review.candidate_assessments[0].reasons.includes('MISSING_PRICE_EDGE'));
});
test('auto-approved candidate becomes critical, never authorized',()=>{
 const d=doc(input),s=segmentCanonical(d),a=resolveAssociations(d,s);
 a.proposals[0].decision='READY';
 const review=validateShadow(d,s,a);
 assert(review.candidate_assessments[0].reasons.includes('PROMOTION_NOT_AUTHORIZED'));
 assert.deepEqual(review.authorized_offers,[]);
});
test('tampered source document hash fails closed',()=>{
 const d=doc(input),s=segmentCanonical(d),a=resolveAssociations(d,s);
 a.document_source_hash='faked';
 assert.throws(()=>validateShadow(d,s,a),/VS3_INVALID_SHADOW_ENVELOPE/);
});
test('duplicated proposals fail closed',()=>{
 const d=doc(input),s=segmentCanonical(d),a=resolveAssociations(d,s);
 a.proposals.push({...a.proposals[0]});
 assert.throws(()=>validateShadow(d,s,a),/VS3_DUPLICATE_PROPOSAL_ID/);
});
test('unconfirmed model anchor triggers document-level warning',()=>{
 const d=doc('• Produto Imagínario 512GB\n📦 FIM DA LISTA');
 const r=evaluateReview(d).review;
 assert(r.global_risks.some(x=>x.reason==='UNASSIGNED_MATERIAL_SOURCE'));
});
test('contradictory condition creates explicit risk',()=>{
 const d=doc('📱 ZenX 128GB — CPO\n📋 Condição: Lacrado\n🎨 Azul\n💵 R$ 3.100,00');
 const r=evaluateReview(d).review;
 assert.equal(r.summary.review_required,0);
 assert(r.global_risks.some(x=>x.code==='CONDITION_CONFLICT'));
});
test('no price and no color do not create offers',()=>{
 const r=evaluateReview(doc('📱 ZenX 128GB\n📋 Condição: Lacrado')).review;
 assert.equal(r.summary.total_proposals,0);
 assert.equal(r.auto_approvable_count,0);
});
console.log('EXTERNAL_CALC_VS3_REVIEW_SHADOW=PASS checks='+checks);
