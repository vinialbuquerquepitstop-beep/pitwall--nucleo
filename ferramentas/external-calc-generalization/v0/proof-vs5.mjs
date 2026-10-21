#!/usr/bin/env node
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {mkdtempSync,readFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {spawnSync} from 'node:child_process';
const require=createRequire(import.meta.url);
const {shadowAsC01ReadOnlyPreview,compareToExistingC01ReadOnly}=require('./c01-compatibility-shadow.cjs');
let passed=0;const test=(name,fn)=>{fn();passed++;console.log('VS5_OK '+passed+' '+name)};
const sample=[
 '📚 Aparelhos artificiais',
 '📱 QuantaX 256GB','📋 Condição: Lacrado',
 '🎨 Azul — R$ 4.900,00',
 '🎨 Branco — R$ 5.000,00'
].join('\n');
const dir=mkdtempSync(join(tmpdir(),'vs5-readonly-'));
try{
 test('C01 material-field shape is correct but operational contract is absent',()=>{
   const out=shadowAsC01ReadOnlyPreview({content:sample});
   assert.equal(out.mode,'VS5_SHADOW_C01_PREVIEW');
   assert.equal(out.candidates.length,2);
   assert.equal(out.auto_promoted,0);assert.equal(out.persisted,0);
   assert.equal(out.production_queue,false);
   for(const candidate of out.candidates){
     assert.equal(candidate.contract_version,null);
     assert.equal(candidate.domain_outcome,'REVIEW_REQUIRED');
     assert.equal(candidate.reviewed_offer,null);
     assert.equal(candidate.offer_id,null);
     assert.equal(candidate.review_revision,null);
     assert(candidate.authorization.accept_disabled);
     assert(candidate.authorization.persist_disabled);
     assert(candidate.authorization.quote_disabled);
     assert(candidate.authorization.publish_disabled);
     assert.deepEqual(Object.keys(candidate.interpreted_offer).sort(),
      ['supplier_id','model','capacity_gb','condition','color','price'].sort());
     assert(candidate.review_evidence.field_sources.model?.length);
     assert(candidate.review_evidence.field_sources.price?.length);
   }
 });
 test('same source is used in both parsers; discrepancies are explicit',()=>{
   const result=compareToExistingC01ReadOnly({content:sample});
   assert(result.same_source_hash);
   assert.equal(result.shadow_candidates,2);
   assert.equal(result.mode,'READ_ONLY_COMPARISON');
   assert.equal(result.production_gate,'NO_GO');
   assert.equal(result.exact_material_matches+result.shadow_only.length,2);
   assert(result.existing_c01_candidates>=0);
   console.log('VS5_DIFF_DEV='+JSON.stringify({
     shadow:result.shadow_candidates,c01:result.existing_c01_candidates,
     exact:result.exact_material_matches,shadow_only:result.shadow_only.length,
     c01_only:result.existing_only_count,equivalent:result.equivalence_status
   }));
 });
 test('ambiguous source cannot be promoted or silently rewritten',()=>{
   const s=['📱 Quanta 256GB','📋 Condição: Lacrado',
    '🎨 Azul','🎨 Preto','💵 R$ 4.900,00'].join('\n');
   const out=shadowAsC01ReadOnlyPreview({content:s});
   assert.equal(out.candidates.length,0);
   assert(out.unresolved.some(x=>x.reason==='MULTIPLE_COLORS_PRICE_SCOPE_UNCLEAR'));
   assert.equal(out.auto_promoted,0);
 });
 test('same source hash and deterministic replay',()=>{
   const a=shadowAsC01ReadOnlyPreview({content:sample}),b=shadowAsC01ReadOnlyPreview({content:sample});
   assert.equal(a.source_hash,b.source_hash);
   assert.deepEqual(a.candidates,b.candidates);
 });
 test('synthetic DEV integration sample produces explicit diff, never automatic equivalence',()=>{
   const d=join(dir,'fixture');
   const p=spawnSync(process.execPath,[new URL('./generate.mjs',import.meta.url).pathname,
     '--seed','dev-vs5-dualpath-0001','--profile','dev','--count','12','--output',d],{encoding:'utf8'});
   assert.equal(p.status,0,p.stderr);
   const content=readFileSync(join(d,'supplier.txt'),'utf8');
   const diff=compareToExistingC01ReadOnly({content});
   assert(diff.same_source_hash);
   assert.equal(diff.production_gate,'NO_GO');
   assert(diff.shadow_candidates>0);
   console.log('VS5_DIFF_12_BLOCKS='+JSON.stringify({
     shadow:diff.shadow_candidates,legacy:diff.existing_c01_candidates,
     exact:diff.exact_material_matches,shadow_only:diff.shadow_only.length,
     legacy_only:diff.existing_only_count,equivalent:diff.equivalence_status
   }));
 });
 test('empty source cannot generate candidate',()=>{
   assert.throws(()=>shadowAsC01ReadOnlyPreview({content:'   '}),/SOURCE_REQUIRED/);
 });
 console.log('EXTERNAL_CALC_VS5_COMPATIBILITY=PASS checks='+passed);
}finally{rmSync(dir,{recursive:true,force:true})}
