#!/usr/bin/env node
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {mkdtempSync,readFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {spawnSync} from 'node:child_process';
const require=createRequire(import.meta.url);
const {parseTextSource}=require('../../external-calc-universal-input/v1/text-adapter');
const {resolveAssociations}=require('./associate-shadow.cjs');
const {segmentCanonical}=require('./segment-shadow.cjs');
const root=mkdtempSync(join(tmpdir(),'vs2-association-'));
const doc=text=>parseTextSource({filename:'fictitious-whatsapp.txt',content:text},{idFactory:()=> 'vs2-structural-shadow'});
const get=text=>resolveAssociations(doc(text));
let checked=0;
const ok=(name,fn)=>{fn();checked++;console.log('VS2_OK '+checked+' '+name)};
const expected=(result,spec)=>{
 assert.deepEqual(result.offers,[],'SHADOW never permits commercial offers');
 assert.equal(result.mode,'SHADOW_READ_ONLY');
 assert.equal(result.proposals.length,spec.length);
 for(let i=0;i<spec.length;i++){
   const p=result.proposals[i],e=spec[i];
   assert.deepEqual([p.model,p.color,p.condition,p.price_minor,p.capacity_gb],e,
     'semantic association candidate '+(i+1));
   assert.equal(p.decision,'PROPOSED_REVIEW');
   for(const key of ['model','condition','color','price']){
     assert(p.source_spans[key].length>0,'missing evidence for '+key);
   }
   assert(result.edges.some(edge=>edge.to===p.proposal_id&&edge.relation==='unit_price'));
 }
};
function generated(seed,count){
 const dir=join(root,seed);
 const r=spawnSync(process.execPath,[new URL('./generate.mjs',import.meta.url).pathname,
 '--seed',seed,'--profile','dev','--count',String(count),'--output',dir],{encoding:'utf8'});
 if(r.status!==0)throw Error(r.stderr);
 return {source:readFileSync(join(dir,'supplier.txt'),'utf8'),
 oracle:JSON.parse(readFileSync(join(dir,'oracle.json'),'utf8'))};
}
function matching(result,oracle){
 const normal=x=>String(x??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().trim();
 const keyof=x=>JSON.stringify([normal(x.model),x.capacity_gb??null,normal(x.color),
  normal(x.condition),x.price_minor]);
 const expectedPairs=new Map();
 for(const o of oracle.offers){
   const key=keyof(o);
   if(!expectedPairs.has(key))expectedPairs.set(key,[]);
   expectedPairs.get(key).push(o);
 }
 let exact=0,lineage=0,unexpected=0;
 for(const p of result.proposals){
   const q=expectedPairs.get(keyof(p));
   if(!q||!q.length){unexpected++;continue}
   const e=q.pop();exact++;
   const have=(key,expectedLines)=>
    p.source_spans[key].some(ref=>expectedLines.some(n=>ref==='line:'+n));
   if(!have('model',e.lineage.model_lines)||
     !have('color',e.lineage.color_lines)||
     !have('price',e.lineage.price_lines)||
     !have('condition',e.lineage.condition_lines))lineage++;
 }
 const missing=[...expectedPairs.values()].reduce((n,arr)=>n+arr.length,0);
 return {expected:oracle.offer_count,proposed:result.proposals.length,exact,missing,unexpected,
  lineage,abstentions:result.abstentions.length};
}
try{
 ok('same-line color+price and stacked association',()=>{
   const out=get([
     '📚 Grupo experimental','📱 ZenX 256GB — Lacrado',
     '🎨 Azul — R$ 5.100,00','🎨 Branco','💵 R$ 5.200,00'
   ].join('\n'));
   expected(out,[['ZenX 256GB','Azul','Lacrado',510000,256],
                 ['ZenX 256GB','Branco','Lacrado',520000,256]]);
   assert.equal(out.abstentions.length,0);
 });
 ok('price before color, twice',()=>{
   const out=get([
     '📚 Coleção Q','📱 QuantaX Pro 512GB','📋 Condição: CPO',
     '💵 Valor unitário: R$ 4.500,00','🎨 Cor desta oferta: Bronze',
     '💵 Valor unitário: R$ 4.600,00','🎨 Cor desta oferta: Silver'
   ].join('\n'));
   expected(out,[['QuantaX Pro 512GB','Bronze','CPO',450000,512],
                 ['QuantaX Pro 512GB','Silver','CPO',460000,512]]);
 });
 ok('explicit shared price across bracketed colors',()=>{
   const out=get([
     '📚 Fones sem catálogo','✅ Dispositivo Delta 128GB',
     '📋 Condição: Caixa aberta','🎨 [Preto] + [Rosa] + [Verde]',
     '💰 Cada cor no mesmo valor: R$ 3.900,00'
   ].join('\n'));
   expected(out,[['Dispositivo Delta 128GB','Preto','Caixa aberta',390000,128],
                 ['Dispositivo Delta 128GB','Rosa','Caixa aberta',390000,128],
                 ['Dispositivo Delta 128GB','Verde','Caixa aberta',390000,128]]);
   assert.equal(new Set(out.proposals.map(p=>p.source_spans.price[0])).size,1);
 });
 ok('bare unit price on a colored variant line is a price, not a capacity',()=>{
   const out=get([
     '📚 Linha B',
     '📱 Dispositivo Neon 256GB',
     '📋 Condição: Lacrado',
     '🎨 Azul — 3.677',
     '🎨 Prata — 3.799'
   ].join('\n'));
   expected(out,[['Dispositivo Neon 256GB','Azul','Lacrado',367700,256],
                 ['Dispositivo Neon 256GB','Prata','Lacrado',379900,256]]);
   const negative=get('📱 Dispositivo Neon 256GB\n📋 Condição: Lacrado\n🎨 Azul — 13GB');
   assert.equal(negative.proposals.length,0,'storage unit cannot be interpreted as price');
 });
 ok('multiple colors without shared price abstain',()=>{
   const out=get([
     '📚 Grupo A','📱 Atlas 256GB','📋 Condição: Lacrado',
     '🎨 Azul','🎨 Preto','💵 R$ 4.750,00'
   ].join('\n'));
   assert.equal(out.proposals.length,0);
   assert(out.abstentions.some(x=>x.reason==='MULTIPLE_COLORS_PRICE_SCOPE_UNCLEAR'));
 });
 ok('missing or contradictory condition abstains',()=>{
   const missing=get('📱 ZenX 128GB\n🎨 Azul\n💵 R$ 3.100,00');
   assert.equal(missing.proposals.length,0);
   assert(missing.abstentions.some(x=>x.reason==='CONDITION_NOT_EXPLICIT'));
   const conflict=get('📱 ZenX 128GB — CPO\n📋 Condição: Lacrado\n🎨 Azul\n💵 R$ 3.100,00');
   assert.equal(conflict.proposals.length,0);
   assert(conflict.abstentions.some(x=>x.reason==='CONDITION_CONFLICT'));
 });
 ok('contact and order minimum are not prices',()=>{
   const out=get([
     '📚 Eletrônicos','📱 Modelo GX 256GB','📋 Condição: Lacrado',
     '☎️ Atendimento: (21) 99999-1111',
     '📌 Pedido mínimo de 2 unidades; consultar disponibilidade',
     '🎨 Verde','💵 R$ 4.900,00'
   ].join('\n'));
   expected(out,[['Modelo GX 256GB','Verde','Lacrado',490000,256]]);
   assert(!out.edges.some(x=>['line:4','line:5'].includes(x.from)));
 });
 ok('new product never inherits old price or condition',()=>{
   const out=get([
     '📚 Teste','📱 Unidade A 128GB — CPO','🎨 Azul','💵 R$ 3.000,00',
     '📱 Unidade B 256GB','📋 Condição: Lacrado','🎨 Branco','💵 R$ 4.500,00'
   ].join('\n'));
   expected(out,[['Unidade A 128GB','Azul','CPO',300000,128],
                 ['Unidade B 256GB','Branco','Lacrado',450000,256]]);
   assert(out.proposals[1].source_spans.condition.every(x=>x!=='line:2'));
 });
 ok('tampered VS1 document hash rejected',()=>{
   const d=doc('📱 Quanta 128GB\n📋 Condição: CPO\n🎨 Azul\n💰 R$ 2.800,00');
   const s=segmentCanonical(d);s.document_source_hash='sha256:tampered';
   assert.throws(()=>resolveAssociations(d,s),/MISMATCHED_VS1_STRUCTURE/);
 });
 ok('independent oracle DEV remains a measured benchmark, not a training target',()=>{
   for(const [seed,count] of [['dev-vs2-alpha-0003',20],['dev-vs2-beta-0004',35]]){
     const x=generated(seed,count),output=get(x.source),m=matching(output,x.oracle);
     assert.equal(output.block_count,count,'VS1 boundary prerequisite');
     assert(output.proposals.every(p=>p.decision==='PROPOSED_REVIEW'));
     assert(output.proposals.every(p=>['model','color','price','condition']
      .every(k=>p.source_spans[k]?.length)),'no unproven fields');
     console.log('VS2_DEV_ORACLE='+JSON.stringify({seed,...m}));
     assert.equal(m.missing,0,'KNOWN DEV coverage mismatch: '+seed);
     assert.equal(m.unexpected,0,'KNOWN DEV false positives: '+seed);
     assert.equal(m.lineage,0,'KNOWN DEV source trace mismatch: '+seed);
     if(m.missing||m.unexpected){
       const expectedByBlock=new Map();
       for(const offer of x.oracle.offers){
         if(!expectedByBlock.has(offer.block_id))expectedByBlock.set(offer.block_id,[]);
         expectedByBlock.get(offer.block_id).push(offer);
       }
       for(let i=0;i<output.block_count;i++){
         const key='block_'+String(i+1).padStart(3,'0');
         const expect=expectedByBlock.get(key)||[];
         const actual=output.proposals.filter(o=>o.block_id==='shadow-block-'+String(i+1).padStart(3,'0'));
         const normalize=a=>JSON.stringify([a.model,a.capacity_gb,a.color,a.condition,a.price_minor]);
         const expSig=expect.map(normalize).sort(),actSig=actual.map(normalize).sort();
         if(JSON.stringify(expSig)!==JSON.stringify(actSig)){
           console.log('VS2_DEV_MISMATCH='+JSON.stringify({seed,block:key,
             expected:expect.map(o=>({model:o.model,color:o.color,condition:o.condition,price:o.price_minor,lineage:o.lineage})),
             actual:actual.map(o=>({model:o.model,color:o.color,condition:o.condition,price:o.price_minor,source_spans:o.source_spans})),
             abstentions:output.abstentions.filter(o=>o.block_id==='shadow-block-'+String(i+1).padStart(3,'0')),
             source_excerpt:x.source.split('\n').slice(expect[0]?.lineage?.model_lines?.[0]-2,
               Math.max(...expect.flatMap(o=>o.lineage.price_lines))+1),
             vs1_members:segmentCanonical(doc(x.source)).product_blocks[i]?.members?.map(r=>({line:r.line,role:r.role,text:r.text}))
           }));
         }
       }
     }
   }
 });
 console.log('EXTERNAL_CALC_VS2_ASSOCIATION_SHADOW=PASS checks='+checked);
}finally{rmSync(root,{recursive:true,force:true})}
