#!/usr/bin/env node
// VS2 shadow CLI: no C01 writes, no production credentials.
import {readFileSync,writeFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
const {parseTextSource}=require('../../external-calc-universal-input/v1/text-adapter');
const {resolveAssociations}=require('./associate-shadow.cjs');
const args={};for(let i=2;i<process.argv.length;i+=2)args[process.argv[i]]=process.argv[i+1];
if(!args['--source']||!args['--report'])throw Error('Usage: node run-association-shadow.mjs --source supplier.txt --report associations.json');
const content=readFileSync(resolve(args['--source']),'utf8');
const doc=parseTextSource({filename:'synthetic-list.txt',content},{idFactory:()=> 'vs2-shadow-readonly'});
const result=resolveAssociations(doc);
writeFileSync(resolve(args['--report']),JSON.stringify(result,null,2)+'\n');
console.log('VS2_SHADOW_REPORT=OK blocks='+result.block_count+' proposals='+result.proposals.length+
  ' abstentions='+result.abstentions.length+' authorized_offers='+result.offers.length);
