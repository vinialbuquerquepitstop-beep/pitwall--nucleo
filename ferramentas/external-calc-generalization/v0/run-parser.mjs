#!/usr/bin/env node
// Read-only connection to the real backend module, no auth, persistence or API.
import {createRequire} from 'node:module';
import {readFileSync,writeFileSync} from 'node:fs';
import {resolve} from 'node:path';
const opts={};for(let i=2;i<process.argv.length;i+=2)opts[process.argv[i]]=process.argv[i+1];
if(!opts['--source']||!opts['--actual'])throw Error('Usage: node run-parser.mjs --source supplier.txt --actual actual.json');
const require=createRequire(import.meta.url);
const {buildQueue}=require('../../external-calc-list-intake/v0/list-intake-api.js');
const content=readFileSync(resolve(opts['--source']),'utf8');
const out=buildQueue({filename:'synthetic-supplier.txt',content});
const plain=out.queue.candidates.map(c=>({
 model:c.interpreted_offer?.model?.label??null,capacity_gb:c.interpreted_offer?.capacity_gb??null,
 color:c.interpreted_offer?.color??null,condition:c.interpreted_offer?.condition??null,
 price_minor:c.interpreted_offer?.price?.amount_minor??null,
 source_model_lines:c.review_evidence?.field_sources?.model||[],
 source_price_lines:c.review_evidence?.field_sources?.price||[],
 candidate_id:c.offer_id
}));
writeFileSync(resolve(opts['--actual']),JSON.stringify({items:plain,warnings:out.queue.warnings,ambiguous_count:out.queue.unresolved_ambiguities.length},null,2)+'\n');
console.log('PARSER_READONLY_CANDIDATES='+plain.length);
