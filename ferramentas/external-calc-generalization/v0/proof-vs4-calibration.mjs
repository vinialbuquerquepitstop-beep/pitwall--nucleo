#!/usr/bin/env node
// Known adversarial calibration suite, NOT a blind external holdout.
// Independent expectations precede the parser. Zero proposals expected for
// ambiguous cases; valid controls ensure the mechanism does not abstain on all.
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
const {parseTextSource}=require('../../external-calc-universal-input/v1/text-adapter');
const {evaluateReview}=require('./review-shadow.cjs');
const doc=text=>parseTextSource({filename:'vs4-calibration-synthetic.txt',content:text},
 {idFactory:()=> 'vs4-calibration'});
const cases=[
 {id:'two_colors_one_unmarked_price',unsafe:true,reason:'MULTIPLE_COLORS_PRICE_SCOPE_UNCLEAR',
  text:'📱 Quanta 256GB\n📋 Condição: CPO\n🎨 Azul\n🎨 Preto\n💵 R$ 4.500,00'},
 {id:'contradictory_condition',unsafe:true,reason:'CONDITION_CONFLICT',
  text:'📱 Quanta 256GB — CPO\n📋 Condição: Lacrado\n🎨 Azul\n💵 R$ 4.500,00'},
 {id:'condition_missing',unsafe:true,reason:'CONDITION_NOT_EXPLICIT',
  text:'📱 Quanta 256GB\n🎨 Azul\n💵 R$ 4.500,00'},
 {id:'missing_price',unsafe:true,reason:'INCOMPLETE_VARIANT_OR_PRICE',
  text:'📱 Quanta 256GB\n📋 Condição: Lacrado\n🎨 Azul'},
 {id:'mixed_valid_and_conflicting',unsafe:true,reason:'CONDITION_CONFLICT_INLINE_ROW',
  text:'📱 Quanta 256GB\n📋 Condição: CPO\nAzul | 4.500 | Lacrado'},
 {id:'legitimate_stacked',unsafe:false,expected:1,
  text:'📱 Quanta 256GB\n📋 Condição: Lacrado\n🎨 Azul\n💵 R$ 4.500,00'},
 {id:'legitimate_price_before_color',unsafe:false,expected:1,
  text:'📱 Quanta 256GB\n📋 Condição: Lacrado\n💵 R$ 4.500,00\n🎨 Azul'},
 {id:'legitimate_typed_columns',unsafe:false,expected:1,
  text:'📱 Quanta 256GB\nAzul | 4.500 | Lacrado'}
];
let unsafeCount=0,correctAbstentions=0,unsafeProposals=0,positiveCount=0,covered=0;
const diagnostics=[];
for(const entry of cases){
 const {association,review}=evaluateReview(doc(entry.text));
 const output={id:entry.id,unsafe:entry.unsafe,proposals:association.proposals.length,
   abstentions:association.abstentions.map(x=>x.reason),global_risks:review.global_risks.map(x=>x.reason),
   authorized:review.authorized_offers.length};
 diagnostics.push(output);
 assert.equal(output.authorized,0,'no authorizations ever');
 if(entry.unsafe){
   unsafeCount++;unsafeProposals+=output.proposals;
   if(!output.proposals && output.abstentions.includes(entry.reason))correctAbstentions++;
 }else{
   positiveCount++;
   if(output.proposals===entry.expected)covered++;
 }
}
const report={contract_version:'vs4-adversarial-calibration-dev/v0',partition:'KNOWN_DEV',
 unsafe_cases:unsafeCount,correct_abstentions:correctAbstentions,unsafe_proposals:unsafeProposals,
 positive_cases:positiveCount,covered_positives:covered,
 results:diagnostics,
 decision:correctAbstentions===unsafeCount && unsafeProposals===0 && covered===positiveCount?'PASS':'FAIL'};
console.log('VS4_CALIBRATION='+report.decision+' unsafe='+unsafeCount+' correctly_abstained='+correctAbstentions+
 ' unsafe_proposals='+unsafeProposals+' positives='+covered+'/'+positiveCount);
for(const d of diagnostics)console.log('VS4_CASE='+JSON.stringify(d));
if(report.decision!=='PASS')process.exitCode=1;
