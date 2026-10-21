#!/usr/bin/env node
// New VS4 adversarial synthetic suite: expected outcomes are defined by
// case construction, not extracted from interpreter outputs.
// Seeds never enter the repository. This is a compositional synthetic challenge,
// not an external-natural-supplier holdout.
import {randomBytes,createHash} from 'node:crypto';
import {mkdirSync,writeFileSync} from 'node:fs';
import {resolve,join} from 'node:path';
const opt={};for(let i=2;i<process.argv.length;i+=2)opt[process.argv[i]]=process.argv[i+1];
if(!opt['--seed']||!opt['--output']||!opt['--count'])throw Error('Usage: node generate-adversarial.mjs --seed SECRET --count 40 --output /tmp/folder');
const n=Number(opt['--count']);if(!Number.isInteger(n)||n<16||n>500)throw Error('Bad count');
const h=x=>createHash('sha256').update(x).digest('hex');
let x=parseInt(h(opt['--seed']).slice(0,8),16)>>>0;
const rand=()=>{x^=x<<13;x^=x>>>17;x^=x<<5;return (x>>>0)/4294967296};
const pick=a=>a[Math.floor(rand()*a.length)];
const modelNames=['Quanta','Lumio','Zenora','Atrium','Novix','Vektor','Pulsar','Kavon','Ametra','Modira','Voron'];
const colors=['Azul','Preto','Verde','Roxo','Prata','Bronze','Rosa'];
const categories=['📚 Componentes especiais','📚 Linha eletrônicos','📚 Distribuição varejo','📚 Equipamentos variados'];
const conditions=['Lacrado','CPO','Caixa aberta'];
const fmt=(v,mode)=>mode==='bare'?String(v).replace(/\B(?=(\d{3})+(?!\d))/g,'.'):'R$ '+String(v).replace(/\B(?=(\d{3})+(?!\d))/g,'.')+',00';
const typeIds=[
 'AMBIG_TWO_COLORS_ONE_PRICE',
 'AMBIG_CONDITION_CONFLICT',
 'AMBIG_NO_CONDITION',
 'AMBIG_NO_PRICE',
 'AMBIG_PIPE_CONDITION_CONFLICT',
 'VALID_STACKED',
 'VALID_REVERSE',
 'VALID_PIPE'
];
const out=[],root=resolve(opt['--output']);mkdirSync(root,{recursive:true});
for(let i=0;i<n;i++){
 const type=typeIds[i%typeIds.length],name=pick(modelNames)+' '+(100+Math.floor(rand()*899))+' 256GB';
 const color=pick(colors),other=pick(colors.filter(c=>c!==color));
 const price=2500+Math.floor(rand()*6000),condition=pick(conditions);
 const lines=[pick(categories), '📱 '+name];
 let expectedReason=null,expectedOffer=null;
 if(type==='AMBIG_TWO_COLORS_ONE_PRICE'){
   lines.push('📋 Condição: '+condition,'🎨 '+color,'🎨 '+other,'💵 '+fmt(price,pick(['bare','brl'])));
   expectedReason='MULTIPLE_COLORS_PRICE_SCOPE_UNCLEAR';
 }else if(type==='AMBIG_CONDITION_CONFLICT'){
   lines[1]+=' — CPO';
   lines.push('📋 Condição: Lacrado','🎨 '+color,'💵 '+fmt(price,'brl'));
   expectedReason='CONDITION_CONFLICT';
 }else if(type==='AMBIG_NO_CONDITION'){
   lines.push('🎨 '+color,'💵 '+fmt(price,'brl'));
   expectedReason='CONDITION_NOT_EXPLICIT';
 }else if(type==='AMBIG_NO_PRICE'){
   lines.push('📋 Condição: '+condition,'🎨 '+color);
   expectedReason='INCOMPLETE_VARIANT_OR_PRICE';
 }else if(type==='AMBIG_PIPE_CONDITION_CONFLICT'){
   lines.push('📋 Condição: CPO',color+' | '+fmt(price,'bare')+' | Lacrado');
   expectedReason='CONDITION_CONFLICT_INLINE_ROW';
 }else if(type==='VALID_STACKED'){
   lines.push('📋 Condição: '+condition,'🎨 '+color,'💵 '+fmt(price,'brl'));
   expectedOffer={model:name,capacity_gb:256,color,condition,price_minor:price*100};
 }else if(type==='VALID_REVERSE'){
   lines.push('📋 Condição: '+condition,'💵 '+fmt(price,'brl'),'🎨 '+color);
   expectedOffer={model:name,capacity_gb:256,color,condition,price_minor:price*100};
 }else if(type==='VALID_PIPE'){
   lines.push(color+' | '+fmt(price,pick(['bare','brl']))+' | '+condition);
   expectedOffer={model:name,capacity_gb:256,color,condition,price_minor:price*100};
 }
 const document=lines.join('\n')+'\n';
 const basename='case_'+String(i+1).padStart(3,'0')+'.txt';
 writeFileSync(join(root,basename),document);
 out.push({id:'case_'+String(i+1).padStart(3,'0'),type,filename:basename,
   source_sha256:h(document),oracle_kind:expectedReason?'MUST_ABSTAIN':'MUST_PROPOSE',
   expected_reason:expectedReason,expected_offer:expectedOffer,
   expected_proposals:expectedOffer?1:0});
}
const truth={contract_version:'external-calc-adversarial-oracle/v1',synthetic:true,
 independent_of_parser:true,seed_commitment_sha256:h('vs4-adversarial:'+opt['--seed']),
 count:n,unsafe_cases:out.filter(c=>c.oracle_kind==='MUST_ABSTAIN').length,
 valid_cases:out.filter(c=>c.oracle_kind==='MUST_PROPOSE').length,cases:out};
writeFileSync(join(root,'oracle.json'),JSON.stringify(truth,null,2)+'\n');
writeFileSync(join(root,'manifest.json'),JSON.stringify({
 source_kind:'SYNTHETIC_ADVERSARIAL',created_after_freeze:true,
 seed_commitment_sha256:truth.seed_commitment_sha256,
 oracle_sha256:h(JSON.stringify(truth,null,2)+'\n'),
 case_hashes:out.map(c=>({id:c.id,sha256:c.source_sha256}))
},null,2)+'\n');
console.log('VS4_ADVERSARIAL_GENERATED count='+n+' unsafe='+truth.unsafe_cases+' valid='+truth.valid_cases+
 ' oracle_sha='+h(JSON.stringify(truth)));
