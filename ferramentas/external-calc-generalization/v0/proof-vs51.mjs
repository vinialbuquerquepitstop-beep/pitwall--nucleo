#!/usr/bin/env node
// VS5.1: golden independent synthetic oracle versus TWO real code paths.
// Demonstrates ability to detect C01 failure rather than forcing equality.
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {mkdtempSync,readFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {spawnSync} from 'node:child_process';
const require=createRequire(import.meta.url);
const {measureTriangle,truthCompare}=require('./triangular-proof.cjs');
const {shadowAsC01ReadOnlyPreview}=require('./c01-compatibility-shadow.cjs');
let count=0;
const pass=(name,fn)=>{fn();count++;console.log('VS51_OK '+count+' '+name)};
const root=mkdtempSync(join(tmpdir(),'vs51-triangle-'));
function generate(seed,blocks){
 const dir=join(root,seed),r=spawnSync(process.execPath,[
  new URL('./generate.mjs',import.meta.url).pathname,
  '--seed',seed,'--profile','dev','--count',String(blocks),'--output',dir],{encoding:'utf8'});
 assert.equal(r.status,0,r.stderr);
 const check=spawnSync(process.execPath,[new URL('./verify.mjs',import.meta.url).pathname,dir],{encoding:'utf8'});
 assert.equal(check.status,0,check.stderr);
 return {content:readFileSync(join(dir,'supplier.txt'),'utf8'),
  oracle:JSON.parse(readFileSync(join(dir,'oracle.json'),'utf8'))};
}
try{
 pass('truth oracle predates both parsers; material diff has same exact input hash',()=>{
   const {content,oracle}=generate('dev-vs51-triangle-0001',12);
   const report=measureTriangle({content,oracle});
   assert.equal(report.mode,'READ_ONLY');
   assert.equal(report.source_sha256,oracle.source_sha256);
   assert.equal(report.legacy_c01.expected,oracle.offer_count);
   assert.equal(report.shadow_vs2_vs3.expected,oracle.offer_count);
   assert.equal(report.accepted_offers,0);
   assert.equal(report.persisted,0);
   assert.equal(report.production_gate,'NO_GO');
   console.log('VS51_TRIANGLE='+JSON.stringify({
     expected:oracle.offer_count,
     legacy:{observed:report.legacy_c01.observed,exact:report.legacy_c01.exact_material_fields,
       exact_lineage:report.legacy_c01.exact_with_lineage,missing:report.legacy_c01.missing_count,
       extra:report.legacy_c01.extra_count},
     shadow:{observed:report.shadow_vs2_vs3.observed,exact:report.shadow_vs2_vs3.exact_material_fields,
       exact_lineage:report.shadow_vs2_vs3.exact_with_lineage,missing:report.shadow_vs2_vs3.missing_count,
       extra:report.shadow_vs2_vs3.extra_count},
     decision:report.interpretive_conclusion
   }));
 });
 pass('new independent DEV seed also proves lineage and discrepancy reporting',()=>{
   const {content,oracle}=generate('dev-vs51-triangle-0002',20);
   const report=measureTriangle({content,oracle});
   assert.equal(report.legacy_c01.observed>=0,true);
   assert.equal(report.shadow_vs2_vs3.observed,oracle.offer_count);
   assert.equal(report.shadow_vs2_vs3.exact_material_fields,oracle.offer_count);
   assert.equal(report.shadow_vs2_vs3.exact_with_lineage,oracle.offer_count);
   assert.equal(report.shadow_vs2_vs3.status,'EXACT');
   assert.equal(report.production_gate,'NO_GO');
 });
 pass('altered oracle fails before interpreting',()=>{
   const fixture=generate('dev-vs51-tamper-0003',8);
   fixture.oracle.source_sha256='0'.repeat(64);
   assert.throws(()=>measureTriangle(fixture),/ORACLE_INDEPENDENCE_OR_HASH_INVALID/);
 });
 pass('field mutation fails truth comparison despite matching count',()=>{
   const {content,oracle}=generate('dev-vs51-mutation-0004',8);
   const preview=shadowAsC01ReadOnlyPreview({content});
   const copy=structuredClone(preview.candidates);
   assert(copy.length>0);
   copy[0].interpreted_offer.price.amount_minor+=100;
   const result=truthCompare(oracle,copy,'shadow');
   assert(result.extra_count>0&&result.missing_count>0);
   assert.equal(result.status,'MISMATCH');
 });
 pass('source line forgery fails strict lineage while matching field values',()=>{
   const {content,oracle}=generate('dev-vs51-lineage-0005',8);
   const preview=shadowAsC01ReadOnlyPreview({content});
   const copy=structuredClone(preview.candidates);
   assert(copy.length>0);
   copy[0].review_evidence.field_sources.price=[9999];
   const result=truthCompare(oracle,copy,'shadow');
   assert(result.lineage_mismatch_count>0);
   assert.equal(result.status,'MISMATCH');
 });
 pass('no commercial authorization even for exact matching proposals',()=>{
   const {content,oracle}=generate('dev-vs51-authority-0006',8);
   const r=measureTriangle({content,oracle});
   assert.equal(r.accepted_offers,0);assert.equal(r.auto_promotions,0);
   assert.equal(r.persisted,0);assert.equal(r.production_gate,'NO_GO');
 });
 console.log('EXTERNAL_CALC_VS51_TRIANGLE=PASS checks='+count);
}finally{rmSync(root,{recursive:true,force:true})}
