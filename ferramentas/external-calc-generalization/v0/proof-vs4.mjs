#!/usr/bin/env node
import assert from 'node:assert/strict';
import {mkdtempSync,readFileSync,writeFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {spawnSync} from 'node:child_process';
const root=mkdtempSync(join(tmpdir(),'vs4-audit-'));
const run=(filename,args)=>{
 const p=spawnSync(process.execPath,[new URL(filename,import.meta.url).pathname,...args],{encoding:'utf8'});
 return p;
};
try{
 const d=join(root,'synthetic');
 for(const [name,args] of [
  ['./generate.mjs',['--seed','dev-vs4-evaluator-0001','--profile','dev','--count','24','--output',d]],
  ['./verify.mjs',[d]],
  ['./run-association-shadow.mjs',['--source',join(d,'supplier.txt'),'--report',join(root,'association.json')]],
  ['./run-review-shadow.mjs',['--source',join(d,'supplier.txt'),'--report',join(root,'review.json')]]
 ]){const p=run(name,args);assert.equal(p.status,0,name+': '+p.stderr)}
 const args=['--oracle',join(d,'oracle.json'),'--association',join(root,'association.json'),'--review',join(root,'review.json'),'--report',join(root,'metrics.json')];
 const clean=run('./evaluate-vs4.mjs',args);
 assert.equal(clean.status,0,'clean reference: '+clean.stdout+' '+clean.stderr);
 const base=JSON.parse(readFileSync(join(root,'association.json'),'utf8'));
 const original=JSON.stringify(base);
 base.proposals[0].price_minor+=100;
 writeFileSync(join(root,'association.json'),JSON.stringify(base));
 let result=run('./evaluate-vs4.mjs',args);
 assert.notEqual(result.status,0,'wrong price must fail');
 let metrics=JSON.parse(readFileSync(join(root,'metrics.json'),'utf8'));
 assert(metrics.critical_silent_errors>0,'wrong price not caught by review must be reported as silent');
 writeFileSync(join(root,'association.json'),original);
 const fake=JSON.parse(original);
 fake.proposals[0].source_spans.price=['line:9999'];
 writeFileSync(join(root,'association.json'),JSON.stringify(fake));
 result=run('./evaluate-vs4.mjs',args);
 assert.notEqual(result.status,0,'forged lineage must fail');
 metrics=JSON.parse(readFileSync(join(root,'metrics.json'),'utf8'));
 assert(metrics.wrong_lineage>0,'lineage mismatch must be measured');
 writeFileSync(join(root,'association.json'),original);
 const review=JSON.parse(readFileSync(join(root,'review.json'),'utf8'));
 review.authorized_offers=[{}];
 writeFileSync(join(root,'review.json'),JSON.stringify(review));
 result=run('./evaluate-vs4.mjs',args);
 assert.notEqual(result.status,0,'nonempty authorized offers must fail envelope');
 console.log('VS4_EVALUATOR_PROOF=PASS controls=4');
}finally{rmSync(root,{recursive:true,force:true})}
