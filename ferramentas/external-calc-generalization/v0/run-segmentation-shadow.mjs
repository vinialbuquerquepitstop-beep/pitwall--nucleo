#!/usr/bin/env node
// Shadow-only VS1 diagnostic; does not call the operational C01 path.
import {readFileSync,writeFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import {resolve} from 'node:path';
const require=createRequire(import.meta.url);
const {parseTextSource}=require('../../external-calc-universal-input/v1/text-adapter');
const {segmentCanonical}=require('./segment-shadow.cjs');
const args={};for(let i=2;i<process.argv.length;i+=2)args[process.argv[i]]=process.argv[i+1];
if(!args['--source']||!args['--report'])throw Error('Usage: node run-segmentation-shadow.mjs --source file --report json');
const content=readFileSync(resolve(args['--source']),'utf8');
const doc=parseTextSource({filename:'synthetic.txt',content},{idFactory:()=> 'vs1-shadow-readonly'});
const result=segmentCanonical(doc);
writeFileSync(resolve(args['--report']),JSON.stringify(result,null,2)+'\n');
console.log('VS1_SHADOW_REPORT=OK blocks='+result.product_blocks.length+
 ' unassigned='+result.unassigned.length+' offers='+result.offers.length);
