#!/usr/bin/env node
// Regression of the evaluation harness, not a claim about the interpreter.
import {mkdtempSync,readFileSync,writeFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {spawnSync} from 'node:child_process';
import assert from 'node:assert/strict';
const root=mkdtempSync(join(tmpdir(),'extcalc-gen-'));
const invoke=(file,args,success=true)=>{
 const r=spawnSync(process.execPath,[new URL(file,import.meta.url).pathname,...args],{encoding:'utf8'});
 if(success&&r.status!==0)throw Error(file+' expected success\n'+r.stdout+'\n'+r.stderr);
 if(!success&&r.status===0)throw Error(file+' accepted a deliberate corruption');
 return r;
};
try{
 const a=join(root,'a'),b=join(root,'b'),c=join(root,'c');
 for(const dir of [a,b])invoke('./generate.mjs',['--seed','dev-demo-north-0001','--profile','dev','--count','20','--output',dir]);
 invoke('./generate.mjs',['--seed','dev-demo-south-0002','--profile','dev','--count','20','--output',c]);
 for(const dir of [a,b,c])invoke('./verify.mjs',[dir]);
 assert.equal(readFileSync(join(a,'supplier.txt'),'utf8'),readFileSync(join(b,'supplier.txt'),'utf8'),'same seed must be byte-identical');
 assert.equal(readFileSync(join(a,'oracle.json'),'utf8'),readFileSync(join(b,'oracle.json'),'utf8'),'same seed oracle must be byte-identical');
 assert.notEqual(readFileSync(join(a,'supplier.txt'),'utf8'),readFileSync(join(c,'supplier.txt'),'utf8'),'different seed must change source');
 const oracle=JSON.parse(readFileSync(join(a,'oracle.json'),'utf8'));
 const actual=oracle.offers.map(o=>({
  model:o.model,capacity_gb:o.capacity_gb,color:o.color,condition:o.condition,
  price_minor:o.price_minor,source_model_lines:o.lineage.model_lines,
  source_price_lines:o.lineage.price_lines
 }));
 const actualPath=join(root,'actual.json'),report=join(root,'report.json');
 writeFileSync(actualPath,JSON.stringify({items:actual}));
 invoke('./compare.mjs',['--oracle',join(a,'oracle.json'),'--actual',actualPath,'--report',report]);
 assert.equal(JSON.parse(readFileSync(report,'utf8')).decision,'SYNTHETIC_EXACT_PASS');
 actual[0].price_minor+=100;
 writeFileSync(actualPath,JSON.stringify({items:actual}));
 const failure=invoke('./compare.mjs',['--oracle',join(a,'oracle.json'),'--actual',actualPath,'--report',report],false);
 assert.match(failure.stdout,/GENERALIZATION_COMPARE=FAIL/);
 assert.equal(JSON.parse(readFileSync(report,'utf8')).missing_count,1);
 const corrupt=join(a,'supplier.txt');
 writeFileSync(corrupt,readFileSync(corrupt,'utf8')+'ADULTERADO\n');
 invoke('./verify.mjs',[a],false);
 console.log('GENERALIZATION_HARNESS_PASS deterministic_oracle=true altered_price_denied=true tamper_denied=true');
}finally{rmSync(root,{recursive:true,force:true})}
