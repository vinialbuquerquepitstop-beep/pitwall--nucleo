#!/usr/bin/env node
// VS1 structural tests: independent oracle validates anchors and boundaries.
// No C01 writes, no model alias dictionaries, no "training" on an eval holdout.
import assert from 'node:assert/strict';
import {mkdtempSync,readFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {spawnSync} from 'node:child_process';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
const {parseTextSource}=require('../../external-calc-universal-input/v1/text-adapter');
const {classifyLine,segmentCanonical}=require('./segment-shadow.cjs');
const root=mkdtempSync(join(tmpdir(),'vs1-shadow-'));
let checked=0;
const ok=(name,fn)=>{fn();checked++;console.log('VS1_OK '+checked+' '+name)};
const document=(s)=>parseTextSource({filename:'synthetic.txt',content:s},{idFactory:()=> 'shadow-vs1-test'});
function checkBlockAgainstOracle(corpus,truth){
 const doc=document(corpus),output=segmentCanonical(doc);
 assert.equal(output.mode,'SHADOW_READ_ONLY');
 assert.equal(output.product_blocks.length,truth.block_count,'all product blocks must be detected, independently of their brand');
 assert.deepEqual(output.offers,[],'VS1 must not authorize or fabricate offers');
 const groups=new Map();
 for(const offer of truth.offers){
   if(!groups.has(offer.block_id))groups.set(offer.block_id,[]);
   groups.get(offer.block_id).push(offer);
 }
 const allPriceRefs=new Set();
 for(const [index,[blockKey,offers]] of [...groups.entries()].entries()){
   const block=output.product_blocks[index];
   const modelLine=offers[0].lineage.model_lines[0];
   assert.equal(block.model_span.line,modelLine,'product anchor mismatch at '+blockKey);
   const refs=new Set(block.members.map(x=>x.source_ref));
   for(const offer of offers){
     assert(refs.has('line:'+offer.lineage.condition_lines[0]),'condition outside product block');
     assert(refs.has('line:'+offer.lineage.color_lines[0]),'color outside product block');
     assert(refs.has('line:'+offer.lineage.price_lines[0]),'price outside product block');
     allPriceRefs.add('line:'+offer.lineage.price_lines[0]);
   }
   if(index>0){
     assert(block.model_span.line>output.product_blocks[index-1].model_span.line,
       'model anchors must be ordered');
   }
 }
 for(const block of output.product_blocks){
   assert(!block.members.some(x=>x.role==='product_candidate'),'nested product anchor leaked into previous block');
 }
 for(const r of output.unassigned){
   assert(!allPriceRefs.has(r.source_ref),'commercial price left unassigned');
 }
 return output;
}
function generated(seed,count){
 const dir=join(root,seed);
 const r=spawnSync(process.execPath,[new URL('./generate.mjs',import.meta.url).pathname,
   '--seed',seed,'--profile','dev','--count',String(count),'--output',dir],{encoding:'utf8'});
 if(r.status!==0)throw Error('generator failed: '+r.stderr);
 return {source:readFileSync(join(dir,'supplier.txt'),'utf8'),
 oracle:JSON.parse(readFileSync(join(dir,'oracle.json'),'utf8'))};
}
try{
 ok('no product/SKU/supplier hardcoding in structural roles',()=>{
   for(const label of ['Cenários Neo 512GB','QuantaX USB-C Pro','OutraMarca Relógio 44mm']){
     assert.equal(classifyLine('📱 '+label).role,'product_candidate');
   }
   assert.equal(classifyLine('☎️ Atendimento: (21) 99999-1111').role,'contact');
   assert.equal(classifyLine('📌 Pedido mínimo de 2 unidades; consultar disponibilidade').role,'notice');
   assert.equal(classifyLine('📚 Grupo totalmente fictício | Lote 1').role,'section');
 });
 ok('independent generator DEV seed a — product anchor coverage and span scope',()=>{
   const x=generated('dev-shadow-alpha-0001',20);
   const result=checkBlockAgainstOracle(x.source,x.oracle);
   console.log('VS1_SAMPLE_A products='+result.product_blocks.length+' offers_in_oracle='+x.oracle.offer_count);
 });
 ok('independent generator DEV seed b — different sample and count',()=>{
   const x=generated('dev-shadow-beta-0002',35);
   const result=checkBlockAgainstOracle(x.source,x.oracle);
   console.log('VS1_SAMPLE_B products='+result.product_blocks.length+' offers_in_oracle='+x.oracle.offer_count);
 });
 ok('unmarked typed models and explicit model labels remain segmentable',()=>{
   const source=[
     '📚 Peças e eletrônicos especiais',
     'QuantaX Pro 512GB',
     '📋 Condição: Lacrado',
     '🎨 Bronze',
     '💰 R$ 4.100,00',
     'Modelo: LumoBook Edition',
     '📋 Condição: Caixa aberta',
     '🎨 Cinza',
     '💵 R$ 3.500,00',
     '📦 FIM DA LISTA'
   ].join('\n');
   const out=segmentCanonical(document(source));
   assert.equal(out.product_blocks.length,2);
   assert.deepEqual(out.product_blocks.map(b=>b.model_span.text),['QuantaX Pro 512GB','LumoBook Edition']);
   assert.deepEqual(out.product_blocks.map(b=>b.model_span.line),[2,6]);
   assert(out.product_blocks[0].members.some(m=>m.role==='price'));
   assert(out.product_blocks[1].members.some(m=>m.role==='price'));
   assert.deepEqual(out.offers,[]);
 });
 ok('no price inheritance across product anchors',()=>{
   const input=[
     '📚 Categoria Fictícia',
     '📱 Dispositivo A 128GB',
     '📋 Condição: Lacrado',
     '🎨 Azul',
     '💵 R$ 3.000,00',
     '📱 Dispositivo B 256GB',
     '📋 Condição: CPO',
     '🎨 Verde',
     '💵 R$ 4.000,00',
     '📦 FIM DA LISTA'
   ].join('\n');
   const out=segmentCanonical(document(input));
   assert.equal(out.product_blocks.length,2);
   assert.deepEqual(out.product_blocks.map(b=>b.model_span.line),[2,6]);
   assert(!out.product_blocks[0].members.some(m=>m.text.includes('4.000')));
   assert(!out.product_blocks[1].members.some(m=>m.text.includes('3.000')));
   assert.deepEqual(out.offers,[]);
 });
 ok('nonoffers never become model blocks or price spans',()=>{
   const input=[
      '📦 Inventado distribuidora teste',
      '📱 QuantaX Neo 512GB',
      '📋 Condição: Lacrado',
      '☎️ Atendimento: (21) 98888-7777',
      '📌 Pedido mínimo de 2 unidades; consultar disponibilidade',
      '🎨 Azul',
      '💵 R$ 5.100,00',
      '📦 FIM DA LISTA'
   ].join('\n');
   const out=segmentCanonical(document(input));
   assert.equal(out.product_blocks.length,1);
   assert(out.product_blocks[0].members.some(x=>x.role==='contact'));
   assert(out.product_blocks[0].members.some(x=>x.role==='notice'));
   assert(out.product_blocks[0].members.some(x=>x.role==='price'));
   assert.deepEqual(out.offers,[]);
 });
 ok('metamorphic: price/color reordering, separators and new category names preserve anchor count',()=>{
   const x=[
     '📚 Grupo 01 — nome desconhecido',
     '📱 XeniaX Model 128GB',
     '📋 Condição: Lacrado',
     '🎨 Prata',
     '💵 R$ 1.500,00',
     '━━━━━━━━━━',
     '📚 Grupo B completamente novo',
     '▹ Modelo R 256GB',
     '📋 Condição: CPO',
     '💰 R$ 2.900,00',
     '🎨 Bronze'
   ];
   const base=segmentCanonical(document(x.join('\n')));
   const changed=x.map(t=>t.replace('1.500,00','1.600,00').replace('Grupo 01 — nome desconhecido','Nova divisão comercial'));
   const lastPrice=changed[9];changed[9]=changed[10];changed[10]=lastPrice;
   const next=segmentCanonical(document(changed.join('\n')));
   assert.equal(base.product_blocks.length,2);
   assert.equal(next.product_blocks.length,2);
   assert.deepEqual(base.product_blocks.map(b=>b.model_span.text),next.product_blocks.map(b=>b.model_span.text));
   assert.deepEqual(next.offers,[]);
 });
 ok('no model anchor without structural support (abstain)',()=>{
   const out=segmentCanonical(document('• Produto Fantasma 512GB\n📦 FIM DA LISTA\n'));
   assert.equal(out.product_blocks.length,0);
   assert(out.unassigned.some(x=>x.reason==='unconfirmed_product_anchor'));
 });
 console.log('EXTERNAL_CALC_VS1_STRUCTURAL_SHADOW=PASS checks='+checked);
}finally{rmSync(root,{force:true,recursive:true})}
