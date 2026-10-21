#!/usr/bin/env node
// Verify that a synthetic oracle is internally consistent; never reads parser output.
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {join,resolve} from 'node:path';
const sha=s=>createHash('sha256').update(s).digest('hex');
const dir=process.argv[2];if(!dir)throw Error('Usage: node verify.mjs <generated_dir>');
const root=resolve(dir),txt=readFileSync(join(root,'supplier.txt'),'utf8');
const oracleText=readFileSync(join(root,'oracle.json'),'utf8'),oracle=JSON.parse(oracleText),manifest=JSON.parse(readFileSync(join(root,'manifest.json'),'utf8'));
const lines=txt.split('\n');
function fail(s){throw Error('GENERATOR_INVARIANT_FAIL '+s)}
if(!oracle.synthetic||!oracle.noncommercial||!oracle.independent_of_parser||!txt.includes('DISTRIBUIDORA FICTÍCIA'))fail('synthetic label absent');
if(oracle.source_sha256!==sha(txt)||manifest.source_sha256!==sha(txt)||manifest.oracle_sha256!==sha(oracleText))fail('hash mismatch');
if(oracle.offer_count!==oracle.offers.length||oracle.offers.length<2)fail('offer count');
const keys=new Set();
for(const offer of oracle.offers){
 if(keys.has(offer.offer_key))fail('duplicate offer key');
 keys.add(offer.offer_key);
 if(!offer.model||!offer.color||!offer.condition||!Number.isSafeInteger(offer.price_minor)||offer.price_minor<=0)fail('invalid offer field');
 for(const [key,anchors] of Object.entries(offer.lineage)){
   if(!Array.isArray(anchors)||!anchors.length)fail('missing '+key);
   for(const n of anchors)if(!Number.isInteger(n)||n<1||n>lines.length)fail('invalid source line');
 }
 if(!offer.lineage.model_lines.every(n=>lines[n-1].includes(offer.model)))fail('model trace not found');
 if(!offer.lineage.color_lines.some(n=>lines[n-1].includes(offer.color)))fail('color trace not found');
}
for(const item of oracle.non_offer_lines)if(oracle.offers.some(o=>o.lineage.price_lines.includes(item.line)))fail('contact used as monetary offer');
console.log('SYNTHETIC_ORACLE_VERIFIED blocks='+oracle.block_count+' offers='+oracle.offer_count+' sha='+manifest.oracle_sha256);
