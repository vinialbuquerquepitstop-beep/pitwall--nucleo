#!/usr/bin/env node
// Synthetic structure generator for External Calc generalization, not supplier learning.
// Emits document + independent oracle BEFORE the parser runs. No real supplier data.
import { createHash } from 'node:crypto';
import { mkdirSync,writeFileSync } from 'node:fs';
import { join,resolve } from 'node:path';
const sha=s=>createHash('sha256').update(s).digest('hex');
function args(argv){const out={seed:null,profile:'dev',count:18,output:null};for(let i=0;i<argv.length;i++){let a=argv[i];if(a==='--seed')out.seed=argv[++i];else if(a==='--profile')out.profile=argv[++i];else if(a==='--count')out.count=Number(argv[++i]);else if(a==='--output')out.output=argv[++i];else throw Error('Unknown flag: '+a)}return out}
const o=args(process.argv.slice(2));
if(!o.seed||o.seed.length<6||!['dev','challenge'].includes(o.profile)||!Number.isInteger(o.count)||o.count<2||o.count>250||!o.output)throw Error('Usage: node generate.mjs --seed [secret-after-freeze] --profile dev|challenge --count 18 --output ./tmp');
function rng(seed){let v=parseInt(sha(seed).slice(0,8),16)>>>0;return()=>{v^=v<<13;v^=v>>>17;v^=v<<5;return (v>>>0)/4294967296}}
const random=rng(o.seed),pick=a=>a[Math.floor(random()*a.length)];
const products=[
 {label:'iPhone 15 128GB',storage:128,category:'Telefone',colors:['Preto','Rosa','Azul','Verde'],min:290000},
 {label:'iPhone 16 Pro 256GB',storage:256,category:'Telefone',colors:['Preto','Natural','Prata','Azul'],min:610000},
 {label:'iPhone 17 Air 256GB',storage:256,category:'Telefone',colors:['Preto','Azul','Dourado'],min:490000},
 {label:'iPad Air M4 128GB',storage:128,category:'Tablet',colors:['Roxo','Azul','Prata'],min:340000},
 {label:'MacBook Air M5 16/512GB',storage:512,category:'Notebook',colors:['Starlight','Midnight'],min:650000},
 {label:'Apple Watch SE 3 44mm',storage:null,category:'Relógio',colors:['Midnight','Starlight'],min:150000},
 {label:'Garmin Forerunner 165',storage:null,category:'Relógio',colors:['Preto','Branco'],min:140000},
 {label:'AirPods Max USB-C',storage:null,category:'Áudio',colors:['Midnight','Azul'],min:330000}
];
const names=['Vetor','Órbita','Polar','Delta','Zênite','Prisma','Atlas','Lume','Sonda','Fóton'];
const fictitiousName='LAB-'+pick(names)+'-'+Math.floor(1000+random()*8999);
const lines=[],oracle=[],nonOffers=[];
function line(value){lines.push(value);return lines.length}
const currency=cents=>(cents/100).toLocaleString('pt-BR',{minimumFractionDigits:2,maximumFractionDigits:2});
const displayPrice=(minor,form)=>form==='bare'?String(Math.floor(minor/100)).replace(/\B(?=(\d{3})+(?!\d))/g,'.'):form==='no-prefix'?currency(minor):'R$ '+currency(minor);
function price(){return Math.floor((280000+random()*370000)/1000)*1000}
const flags=['📦','🔥','✅','📲','▫️','⭐','💻'];
const header=line('📦 '+fictitiousName+' • DISTRIBUIDORA FICTÍCIA (TESTE)');
line('📅 Boletim simulado — sem estoque, preços ou fornecedores reais');
line('⚠️ Uso exclusivo de avaliação do interpretador');
let lastGroup='';
for(let i=0;i<o.count;i++){
 const product=pick(products),condition=pick(['Lacrado','CPO','Caixa aberta']);
 const layout=pick(o.profile==='dev'?['inline','stacked','shared','reverse']:['shared','reverse','inline','stacked','piped']);
 const shuffled=[...product.colors];
 for(let k=shuffled.length-1;k>0;k--){const j=Math.floor(random()*(k+1));[shuffled[k],shuffled[j]]=[shuffled[j],shuffled[k]]}
 const colors=shuffled.slice(0,1+Math.floor(random()*Math.min(3,product.colors.length)));
 const blockId='block_'+String(i+1).padStart(3,'0');
 line('━━━━━━━━━━');
 if(lastGroup!==product.category||random()<.33){line('📚 '+product.category+' | Lote '+(i+1));lastGroup=product.category}
 const modelLine=line(pick(['📱 ','• ','✅ ','▹ ','*'])+product.label+(layout==='inline'?' — '+condition:''));
 const conditionLine=layout==='inline'?modelLine:line('📋 Condição: '+condition);
 const shared=layout==='shared';
 const base=price()+Math.floor(random()*10)*100; // integer BRL, suitable even when price has no cents
 const amounts=colors.map((_,v)=>shared?base:base+(v*7000));
 let priceLine=null, colorLine=null;
 const push=(color,amt,priceRef,colorRef)=>oracle.push({
  offer_key:blockId+'#'+String(oracle.filter(r=>r.block_id===blockId).length+1),
  block_id:blockId,category:product.category,model:product.label,capacity_gb:product.storage,color,
  condition,price_minor:amt,currency:'BRL',
  lineage:{model_lines:[modelLine],condition_lines:[conditionLine],color_lines:[colorRef],price_lines:[priceRef]}
 });
 if(shared){
   colorLine=line('🎨 '+colors.map(c=>'['+c+']').join(' + '));
   priceLine=line('💰 Cada cor no mesmo valor: '+displayPrice(base,pick(['brl','no-prefix'])));
   for(const col of colors)push(col,base,priceLine,colorLine);
 }else if(layout==='reverse'){
   for(let j=0;j<colors.length;j++){
     priceLine=line('💵 Valor unitário: '+displayPrice(amounts[j],'brl'));
     colorLine=line('🎨 Cor desta oferta: '+colors[j]);
     push(colors[j],amounts[j],priceLine,colorLine);
   }
 }else if(layout==='stacked'){
   for(let j=0;j<colors.length;j++){
     colorLine=line('🎨 '+colors[j]);
     priceLine=line('💰 '+displayPrice(amounts[j],j%2?'no-prefix':'brl'));
     push(colors[j],amounts[j],priceLine,colorLine);
   }
 }else if(layout==='piped'){
   for(let j=0;j<colors.length;j++){
     let n=line(colors[j]+' | '+displayPrice(amounts[j],j%2?'no-prefix':'brl')+' | '+condition);
     push(colors[j],amounts[j],n,n);
   }
 }else{
   for(let j=0;j<colors.length;j++){
     let n=line(pick(['🎨 ','▫️ '])+colors[j]+' — '+displayPrice(amounts[j],j%2?'bare':'brl'));
     push(colors[j],amounts[j],n,n);
   }
 }
 // Explicit non-offer numeric and contact distractors.
 if(random()<.45)nonOffers.push({line:line('☎️ Atendimento: (21) 9'+Math.floor(1000+random()*8999)+'-'+Math.floor(1000+random()*8999)),role:'contact'});
 if(random()<.35)nonOffers.push({line:line('📌 Pedido mínimo de 2 unidades; consultar disponibilidade'),role:'commercial_notice'});
}
line('⚠️ Todos os preços acima são inventados para testes. Não comercializar.');
line('📦 FIM DA LISTA SINTÉTICA');
const text=lines.join('\n')+'\n';
const truth={
 contract_version:'external-calc-synthetic-oracle/v1',generator_version:'0.1.0',
 partition:o.profile==='challenge'?'SYNTHETIC_CHALLENGE':'DEV',
 synthetic:true,noncommercial:true,independent_of_parser:true,
 supplier_label:fictitiousName,source_sha256:sha(text),offer_count:oracle.length,
 block_count:o.count,offers:oracle,non_offer_lines:nonOffers,
 note:'Created from synthetic spec before running any parser. No claim of natural blind supplier.'
};
const dest=resolve(o.output);
mkdirSync(dest,{recursive:true});
writeFileSync(join(dest,'supplier.txt'),text,'utf8');
writeFileSync(join(dest,'oracle.json'),JSON.stringify(truth,null,2)+'\n','utf8');
const man={
 contract_version:'external-calc-synthetic-manifest/v1',profile:o.profile,synthetic:true,
 generator_version:truth.generator_version,
 seed_commitment_sha256:sha('external-calc-generalization-v1:'+o.seed),
 source_sha256:sha(text),
 oracle_sha256:sha(JSON.stringify(truth,null,2)+'\n'),offer_count:oracle.length,block_count:o.count,
 generator_is_not_interpreter:true,holds_natural_external_sources:false
};
writeFileSync(join(dest,'manifest.json'),JSON.stringify(man,null,2)+'\n','utf8');
console.log('SYNTHETIC_GENERATOR_PASS blocks='+o.count+' offers='+oracle.length+' manifest_sha='+sha(JSON.stringify(man)));
