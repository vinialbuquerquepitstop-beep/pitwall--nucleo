#!/usr/bin/env node
// VS3 review-shadow report: no DB, authorization, or C01 changes.
import {createRequire} from 'node:module';
import {readFileSync,writeFileSync} from 'node:fs';
import {resolve} from 'node:path';
const require=createRequire(import.meta.url);
const {parseTextSource}=require('../../external-calc-universal-input/v1/text-adapter');
const {evaluateReview}=require('./review-shadow.cjs');
const argv={};for(let i=2;i<process.argv.length;i+=2)argv[process.argv[i]]=process.argv[i+1];
if(!argv['--source']||!argv['--report'])throw Error('Usage: node run-review-shadow.mjs --source file --report json');
const doc=parseTextSource({filename:'synthetic.txt',content:readFileSync(resolve(argv['--source']),'utf8')},{idFactory:()=> 'vs3-read-only'});
const {review}=evaluateReview(doc);
writeFileSync(resolve(argv['--report']),JSON.stringify(review,null,2)+'\n','utf8');
console.log('VS3_REVIEW=REVIEW_REQUIRED total='+review.summary.total_proposals+
 ' critical='+review.summary.critical_candidates+' material_abstentions='+
 review.summary.material_abstentions+' authorized='+review.authorized_offers.length);
