'use strict';
const assert=require('assert');
const {buildQueue}=require('./list-intake-api');
const {partitionCandidates}=require('./auto-promotion-authority');

const sample=[
  'Fornecedor Alpha — ATACADO',
  'iPhone 15 128GB',
  '🎨 Preto',
  '💵 R$ 4.500,00'
].join('\n');
const first=buildQueue({filename:'lista.txt',mime_type:'text/plain',content:sample});
const second=buildQueue({filename:'lista.txt',mime_type:'text/plain',content:sample});

const supplierUnknown=partitionCandidates(first.queue,{supplierVerified:false});
assert.strictEqual(supplierUnknown.auto.length,0,'no supplier: must not auto-promote');
assert.ok(supplierUnknown.review.every(x=>x.assessment.reasons.includes('SUPPLIER_IDENTITY_UNVERIFIED')));
const supplierImplicit=partitionCandidates(first.queue);
assert.strictEqual(supplierImplicit.auto.length,0,'missing verification context must fail closed');
assert.ok(supplierImplicit.review.every(x=>x.assessment.reasons.includes('SUPPLIER_IDENTITY_UNVERIFIED')));
const supplierBound=partitionCandidates(first.queue,{supplierVerified:true});
assert.strictEqual(supplierBound.auto.length,1,'verified supplier preserves valid promotion');


// C01 auto-promotion must have both model and price grounded in actual source lines.
// Missing trace linkage or a fabricated line cannot be rescued by high confidence.
const modelWithoutSource=JSON.parse(JSON.stringify(first.queue.candidates[0]));
delete modelWithoutSource.review_evidence.field_sources.model;
const modelWithoutSourceDecision=partitionCandidates({
  candidates:[modelWithoutSource],unresolved_ambiguities:[]
},{supplierVerified:true});
assert.strictEqual(modelWithoutSourceDecision.auto.length,0);
assert.ok(modelWithoutSourceDecision.review[0].assessment.reasons.includes('MODEL_SOURCE_UNVERIFIED'));

const priceWithUnmatchedLine=JSON.parse(JSON.stringify(first.queue.candidates[0]));
priceWithUnmatchedLine.review_evidence.field_sources.price=[99999];
const priceWithUnmatchedLineDecision=partitionCandidates({
  candidates:[priceWithUnmatchedLine],unresolved_ambiguities:[]
},{supplierVerified:true});
assert.strictEqual(priceWithUnmatchedLineDecision.auto.length,0);
assert.ok(priceWithUnmatchedLineDecision.review[0].assessment.reasons.includes('PRICE_SOURCE_UNVERIFIED'));

const priceWithEmptyRaw=JSON.parse(JSON.stringify(first.queue.candidates[0]));
const priceRefs=new Set(priceWithEmptyRaw.review_evidence.field_sources.price);
for(const line of priceWithEmptyRaw.review_evidence.source_lines){
  if(priceRefs.has(line.line_number))line.raw='';
}
const priceWithEmptyRawDecision=partitionCandidates({
  candidates:[priceWithEmptyRaw],unresolved_ambiguities:[]
},{supplierVerified:true});
assert.strictEqual(priceWithEmptyRawDecision.auto.length,0);
assert.ok(priceWithEmptyRawDecision.review[0].assessment.reasons.includes('PRICE_SOURCE_UNVERIFIED'));

const explicitOutlier=partitionCandidates({
  candidates:[first.queue.candidates[0]],unresolved_ambiguities:[]
},{supplierVerified:true,price_risk:'OUTLIER_REVIEW_REQUIRED'});
assert.strictEqual(explicitOutlier.auto.length,0);
assert.ok(explicitOutlier.review[0].assessment.reasons.includes('PRICE_OUTLIER_REVIEW_REQUIRED'));


// Gate 1: the price field must agree with the source text, not just its line number.
const {exactBRLAmountInText}=require('./source-price-evidence');
assert.equal(exactBRLAmountInText('💵 R$ 4.500,00',450000),true);
assert.equal(exactBRLAmountInText('🔵 4200',420000),true);
assert.equal(exactBRLAmountInText('💰5,650',565000),true);
assert.equal(exactBRLAmountInText('R$ 6.900,50',690050),true);
assert.equal(exactBRLAmountInText('R$ 6.900,50',690000),false);
assert.equal(exactBRLAmountInText('R$ 6.900',690050),false);
assert.equal(exactBRLAmountInText('R$ 6.900,00',690050),false);
assert.equal(exactBRLAmountInText('R$ 45.000',450000),false);
const incorrectC01Price=JSON.parse(JSON.stringify(first.queue.candidates[0]));
incorrectC01Price.interpreted_offer.price.amount_minor=449000;
const mismatchDecision=partitionCandidates({candidates:[incorrectC01Price],unresolved_ambiguities:[]},{supplierVerified:true});
assert.equal(mismatchDecision.auto.length,0,'wrong amount must never auto-promote');
assert.ok(mismatchDecision.review[0].assessment.reasons.includes('PRICE_SOURCE_AMOUNT_UNVERIFIED'));

// Gate 1: never silently promote a material price discrepancy among like-for-like variants.
const siblingAnomaly=buildQueue({filename:'sibling-outlier.txt',mime_type:'text/plain',content:[
  'iPhone 16 128GB','🎨 Azul','💵 415',
  'iPhone 16 128GB','🎨 Preto','💵 4200',
  'iPhone 16 128GB','🎨 Branco','💵 4250',
  'iPhone 16 128GB','🎨 Rosa','💵 4300'
].join('\n')});
const siblingDecision=partitionCandidates(siblingAnomaly.queue,{supplierVerified:true});
assert.strictEqual(siblingDecision.review.length,1,'one source-relative price outlier must require review');
assert.ok(siblingDecision.review[0].assessment.reasons.includes('SIBLING_PRICE_OUTLIER'));
assert.strictEqual(siblingDecision.review[0].candidate.interpreted_offer.price.amount_minor,41500);
assert.strictEqual(siblingDecision.auto.length,3,'other comparable prices must remain eligible');
const differentProducts=buildQueue({filename:'cross-product-prices.txt',mime_type:'text/plain',content:[
  'Apple Pencil USB-C','💵 415',
  'iPhone 16 128GB','🎨 Preto','💵 4200',
  'iPhone 16 128GB','🎨 Branco','💵 4250',
  'iPhone 16 128GB','🎨 Rosa','💵 4300'
].join('\n')});
const independentDecision=partitionCandidates(differentProducts.queue,{supplierVerified:true});
assert.ok(independentDecision.review.every(x=>!x.assessment.reasons.includes('SIBLING_PRICE_OUTLIER')),
  'different products must not share price baselines');

assert.strictEqual(first.analysis_id,second.analysis_id);
assert.strictEqual(first.source_id,second.source_id);
assert.ok(first.queue.candidates.length>=1);

// Regressão corpus SP: preço com vírgula e três dígitos não pode ser truncado.
const macMiniCommaPrice=buildQueue({
  filename:'mac-mini-thousands.txt',mime_type:'text/plain',
  content:'✅MAC MINI M4 16 RAM 512💰5,650'
});
assert.strictEqual(macMiniCommaPrice.queue.candidates.length,1);
assert.strictEqual(macMiniCommaPrice.queue.candidates[0].interpreted_offer.price.amount_minor,565000,
  '5,650 deve representar R$ 5.650,00, nunca R$ 5,65');

// Regressão ON CELL: cor Teal explícita não deve herdar Branco anterior.
const tealByNameAndEmoji=buildQueue({filename:'oncell-teal.txt',mime_type:'text/plain',content:[
  'iPhone 16 128GB',
  '⚪white',
  '💰 4300',
  '🩵teal',
  '💰 4200'
].join('\n')});
assert.strictEqual(tealByNameAndEmoji.queue.candidates.length,2);
assert.strictEqual(tealByNameAndEmoji.queue.candidates[0].interpreted_offer.color,'Branco');
assert.strictEqual(tealByNameAndEmoji.queue.candidates[1].interpreted_offer.color,'Teal');
assert.strictEqual(tealByNameAndEmoji.queue.candidates[1].interpreted_offer.price.amount_minor,420000);

// Fonte ON CELL: cada linha de cor mantém o próprio preço. Capacidades ausentes exigem revisão.
const onCellScoped = buildQueue({filename:'oncell-scoped.txt',mime_type:'text/plain',content:[
  'ON CELL — LOJA',
  '📲 17 PRO MAX 256 - ANATEL.',
  '⚪️branco. 7100',
  '📲 17 PRO MAX 256GB 🇺🇸',
  '⚪️silver. 6900',
  '📲17 PRO 256🇺🇸',
  '⚪️silver. 6700',
  '📲 16 128gb',
  '⚪️white. 4300',
  '🟣pink. 4300',
  '🩵teal. 4200',
  '⚫️black. 4250',
  '💻 Macbook neo 256gb',
  '⚪️silver 4800'
].join('\n')});
assert.strictEqual(onCellScoped.queue.candidates.length,8);
assert.deepStrictEqual(onCellScoped.queue.candidates.map(c=>c.interpreted_offer.price.amount_minor),
 [710000,690000,670000,430000,430000,420000,425000,480000]);
assert.deepStrictEqual(onCellScoped.queue.candidates.map(c=>c.interpreted_offer.color),
 ['Branco','Prata','Prata','Branco','Rosa','Teal','Preto','Prata']);
const onCellAssessment=partitionCandidates(onCellScoped.queue,{supplierVerified:true});
assert.strictEqual(onCellAssessment.review.length,2,'bare 256 iPhones sem capacidade devem revisar');
assert.ok(onCellAssessment.review.every(x=>x.assessment.reasons.includes('CAPACITY_EXPECTED_BUT_MISSING')));
// Não aceitar números fora de linhas coloridas (datas, contato, identificação comercial).
const nonPriceContext=buildQueue({filename:'oncell-guard.txt',mime_type:'text/plain',content:[
 '📲 16 128gb',
 'Contato 21999990000',
 'Retirada no dia 08 2026'
].join('\n')});
assert.strictEqual(nonPriceContext.queue.candidates.length,0);

const real="*👑 REAL COMÉRCIO — ATACADO*\n\n📍 Av. Rio Branco – Centro RJ\n📲 (21) 97171-9477\n\n━━━━━━━━━━━━\n\n📱*Celular — Lacrado*\n\niPhone 17 pro 256gb\n🎨 Prata\n💵 *R$6.850,00*\n\n📱PocoF8 Pro 5G 12/256GB\n🎨 Blue\n💵 *3280,00*\n\n📱PocoF8 Pro 5G 12/256GB\n🎨 Black \n💵 *3349,00*\n\n📱PocoF8 Pro 5G 12/512gb\n🎨 Blue\n💵 *3639,00*\n\n📱PocoF8 Ultra 5G 12/256gb \n🎨 Black \n💵 *4550,00*\n\n━━━━━━━━━━━━\n\n💻 MacBook — Lacrados\n\n💻 MacBook Neo a18 13\" 8/256gb \n🎨 Blush\n💵*4.785,00*\n\n💻 MacBook Air M5 13\" 16/512gb\n🎨 SkyBlue\n💵*8.450,00*\n\n💻 MacBook pro M5 14\" 16/512gb\n🎨 Meia noite \n💵*11.500,00*\n\n💻 MacBook pro M5 14\" 16/1tb\n🎨 Meia noite \n💵*12.649,00*\n\n💻 MacBook pro M5 14\" 24/1tb\n🎨 Meia noite \n💵*14.998,00*\n\n💻 MacBook pro M5 pro 14\" 24/1tb\n🎨 Preto espacial  \n💵*16.289,00*\n\n💻 Mac Mini m4 16/512gb\n💵*6.050,00*\n\n━━━━━━━━━━━━\n\n⌚Watch lacrados \n\n⌚ Apple Watch SE 3 40mm GPS\n🎨 Starlight Aluminum Case com Sport Band Starligh\n*💵 R$  1.778,00*\n\n⌚ Garmin Forerunner 165\n🎨 Preto e Cinza Ardosia\n*💵 R$ 1.600,00*\n\n━━━━━━━━━━━━\n\n📲 iPad — Lacrados \n\n📲 iPad Air 11 M4 128GB Wi-Fi  \n🎨 Cinza Espacial \n*💵 R$ 4798,00*\n\n📲 iPad Air 11 M4 128GB Wi-Fi  \n🎨 Blue \n*💵 R$ 4950,00*\n\n📲 iPad Air 11 M4 128GB Wi-Fi  \n🎨 Starligth \n*💵 R$ 4897,59*\n\n━━━━━━━━━━━━\n\n🎧 AirPods — Lacrado\n\n🎧 AirPods Pro 3ª Geração\n*💵 R$ 1.467,00*\n\n━━━━━━━━━━━━\n\n🛡 Garantia\n* Lacrados: Apple\n\n📃 Políticas\n* Não estornamos PIX (crédito loja)\n* Lacrados podem apresentar diferença entre data de compra e garantia";
const parsed=buildQueue({filename:'real-comercio.txt',mime_type:'text/plain',content:real});
assert.strictEqual(parsed.queue.candidates.length,18,'lista REAL COMERCIO deve produzir 18 ofertas');
const offers=parsed.queue.candidates.map(c=>c.interpreted_offer);
assert.ok(offers.every(o=>o.model&&o.model.id&&o.model.label),'todo produto precisa de identidade');
assert.ok(offers.every(o=>o.price&&o.price.amount_minor>0&&o.price.currency==='BRL'),'todo produto precisa de preco BRL');
assert.ok(offers.some(o=>o.model.id==='iphone-17-pro-256'),'fallback deve preservar identidade do iPhone 17 Pro existente');
const labels=offers.map(o=>String(o.model.label||'').toLocaleLowerCase('pt-BR'));
const countLabel=(needle)=>labels.filter(label=>label.includes(needle.toLocaleLowerCase('pt-BR'))).length;
assert.strictEqual(countLabel('PocoF8 Pro 5G 12/256GB'),2);
assert.strictEqual(countLabel('PocoF8 Pro 5G 12/512gb'),1);
assert.strictEqual(countLabel('PocoF8 Ultra 5G 12/256gb'),1);
assert.ok(offers.some(o=>o.model.label.includes('MacBook pro M5 14" 24/1tb')&&o.capacity_gb===1024));
console.log('REAL_COMERCIO_MODELS='+JSON.stringify(offers.map(o=>({label:o.model.label,capacity_gb:o.capacity_gb,color:o.color,price:o.price.amount_minor}))));
assert.strictEqual(countLabel('iPad Air 11 M4 128GB Wi-Fi'),3);
assert.strictEqual(countLabel('AirPods'),1);
// Corpus ON CELL: a capacidade aparece sem GB na linha do modelo.
// Se o valor da capacidade se perder na interpretação, nunca auto-promover.
const bareCapacityCandidate=JSON.parse(JSON.stringify(parsed.queue.candidates[0]));
bareCapacityCandidate.interpreted_offer.model.label='iPhone 17 PRO MAX 256';
bareCapacityCandidate.interpreted_offer.capacity_gb=null;
const bareCapacityReview=partitionCandidates({candidates:[bareCapacityCandidate],unresolved_ambiguities:[]},{supplierVerified:true});
assert.strictEqual(bareCapacityReview.auto.length,0,'iPhone 17 256 sem capacidade resolvida nao pode auto-promover');
assert.deepStrictEqual(bareCapacityReview.review[0].assessment.reasons.includes('CAPACITY_EXPECTED_BUT_MISSING'),true);

const partition=partitionCandidates(parsed.queue,{supplierVerified:true});
console.log('REAL_COMERCIO_RESIDUAL_AMBIGUITIES='+JSON.stringify(parsed.queue.unresolved_ambiguities.map(item=>({field:item.field,cause:item.cause,raw:item.raw,sources:item.sources}))));
console.log('REAL_COMERCIO_RESIDUAL_INVALID='+JSON.stringify(parsed.queue.invalid_items));
assert.strictEqual(parsed.queue.unresolved_ambiguities.length,0,'lista REAL COMERCIO nao deve deixar ambiguidade estrutural falsa');
assert.strictEqual(parsed.queue.invalid_items.length,0,'linhas vazias, divisores e metadados nao devem aparecer como invalidos');
assert.strictEqual(partition.auto.length+partition.review.length,18);
assert.ok(partition.auto.length>=15,'lista REAL COMERCIO deve autopromover a ampla maioria');
assert.ok(partition.review.length<=3,'revisao deve ser excecao, nao pedágio');
assert.ok(partition.auto.every(item=>item.promoted.domain_outcome==='VALID'));
assert.ok(partition.auto.every(item=>item.promoted.review===null));

const allImportsParsed=buildQueue({filename:'all-imports.txt',mime_type:'text/plain',content:"✨ LISTA COMPLETA – CELULARES📲✨\n\n🔥 IPHONES SEMINOVOS 🔥\n\n📲IPHONE 12 PRO 128GB⚪️\nR$1.950/ BATERIA 🔋 🟰100%\n\n📲IPHONE 13 PRO 128GB⚫️🔵(gold)\nR$2.350/ BATERIA🔋🟰100%\n\n📲IPHONE 13 PRO MAX 128 GB🟢🩶\nR$ 2.799/ BATERIA 🔋 🟰85%\n\n📲IPHONE 14 128GB ⚫️🟣🔵\nR$ 2.050/ BATERIA🔋🟰 100%\n\n📲IPHONE 14 256GB⚫️🔵\nR$2.350/ BATERIA 🔋 🟰90%\n\n📲IPHONE 14 PRO 128GB⚫️🟣\nR$2.799/ BATERIA 🔋 🟰83%\n\n📲IPHONE 15 128GB ⚫️\nR$2.550/ BATERIA 🔋 🟰100%\n\n📲IPHONE 15 128GB🔵\nR$2.650/BATERIA🔋🟰100%\n\n📲IPHONE 15 256 🩷\nR$ 2.850/ BATERIA 🔋 🟰 93%\n\n📲IPHONE 15 PRO 128GB 🩶\nR$3.450/ BATERIA 🔋 🟰90%\n\n📲IPHONE 15 PRO MAX 256GB 🔵🩶\nR$ 3.999/ BATERIA 🔋 🟰91%\n\n📲IPHONE 16 PLUS 128GB ⚫️\nR$3.799/ BATERIA 🔋 🟰91%\n\n📲IPHONE 16 PRO MAX 256 ⚪️(gold) ⚫️\nR$4.999/BATERIA🔋🟰92%\n\n🔥IPHONE LACRADO 🔥\n\n📲IPHONE 15 128GB ⚫️\nR$3.790/ BATERIA 🔋 🟰 100%\n\n📲IPHONE 16 PRO MAX 512🩶\nR$6.690/ BATERIA 🔋 🟰100%"});
assert.strictEqual(allImportsParsed.queue.candidates.length,25,'All imports deve produzir 25 variantes comerciais por cor');
const allImportsOffers=allImportsParsed.queue.candidates.map(c=>c.interpreted_offer);
assert.strictEqual(allImportsOffers.filter(o=>o.condition==='Seminovo').length,23,'All imports deve herdar 23 variantes seminovas');
assert.strictEqual(allImportsOffers.filter(o=>o.condition==='Lacrado').length,2,'All imports deve herdar 2 lacrados');
assert.ok(allImportsOffers.every(o=>Number.isInteger(o.capacity_gb)),'All imports deve resolver capacidade de todos os iPhones');

const jtParsed=buildQueue({filename:'jt-telles.txt',mime_type:'text/plain',content:"*LISTA ATUALIZADA*🔥*17/08*\n______________________________\n1 MÊS DE GARANTIA✅\n🚨SEM SELO / SEM GARANTIA🚨\n🚨NÃO DAMOS GARANTIA DE BATERIA🚨\n\n11 64GB 🇺🇸\n*R$750*\n⚫️PRETO - 100%\n\n12 Pro 128GB 🇺🇸\n*R$1.800*\n🔵AZUL - 90%\n\n12 Pro Max 128GB\n*R$2.200*\n🟡GOLD - 78%\n⚫️GRAFITE - 89%\n⚪️ SILVER - 90%\n\n13 128GB *A*🇺🇸\n*R$1850*\n🔵AZUL - 86%\n⚫️PRETO - 66%\n🔴VERMELHO - 86%\n\n13 Pro 128GB *A*🇺🇸\n*R$2400*\n🟡GOLD - 85%\n⚪️SILVER - 85%\n⚫️GRAFITE - 100%\n🟢VERDE - 85%\n\n14 128GB *A*🇺🇸\n*R$2050*\n⚪️BRANCO - 85% 82% 83%\n🟡AMARELO - 77%\n\n14 256GB *A*🇺🇸\n*R$2300*\n⚫️PRETO - 84% 83%\n\n14 PLUS 128GB *A*🇺🇸\n*R$2.200*\n🟣ROXO - 83% 84% 91%\n\n14 Pro 128GB *A*🇺🇸\n*R$2750*\n🟣ROXO - 84% 91%\n🟡GOLD - 82% 91%\n\n14 PRO MAX 128GB *A🇺🇸*\n*R$3250*\n🟣ROXO - 80% 85% 91%\n\n15 128GB *A*🇺🇸\n*R$2650*\n🌹ROSA - 85%\n🔵AZUL - 85% 88%\n\n15 256GB *A*🇺🇸\n*R$2900*\n🌹ROSA - 93%\n⚫️ PRETO - 85% 88%\n\n15 PLUS 128GB *A*🇺🇸\n*R$2800*\n🌹ROSA - 85%\n\n15 PRO 128GB *A*🇺🇸\n*R$3.350*\n⚪️BRANCO - 80%\n⚫️PRETO - 88%\n\n15 PRO 256GB *A*🇺🇸\n*R$3.500*\n🔵AZUL - 81%\n\n15 PRO MAX 256GB *A*🇺🇸\n*R$4.100*\n🔵AZUL - 81% 90% 85% 84%\n⚪️BRANCO - 84% 83%\n⚫️PRETO - 88%\n\n16 128GB *A*🇺🇸\n*R$3.650*\n⚪️BRANCO - 91%\n\n16 PRO MAX 256GB *A*🇺🇸\n*R$5.100*\n💛DESERT - 90%\n⚪️BRANCO - 92%\n⚫️PRETO - 90%\n\n16 PRO MAX 512GB *A*🇺🇸\n*R$5.400*\n⚪️BRANCO - 91%"});
assert.strictEqual(jtParsed.queue.candidates.length,35,'JT Telles deve expandir 35 variantes comerciais por cor');
assert.ok(jtParsed.queue.candidates.every(c=>c.interpreted_offer.model?.id),'JT Telles deve dar identidade a todos os modelos');
assert.ok(jtParsed.queue.candidates.every(c=>Number.isInteger(c.interpreted_offer.capacity_gb)),'JT Telles deve extrair capacidade de todos os modelos');


const colorSharedPrice=buildQueue({
  filename:'color-shared-price.txt',
  mime_type:'text/plain',
  content:'📱15 PRO 128GB\n*AZUL🔵/ PRETO⚫️/ NATURAL🔘*\n*R$ 3.350,00*'
});
assert.deepStrictEqual(
  colorSharedPrice.queue.candidates.map(c=>c.interpreted_offer.color).sort(),
  ['Azul','Natural','Preto'],
  'uma linha multicolor com preco comum deve expandir uma oferta por cor'
);

const colorOwnPrice=buildQueue({
  filename:'color-own-price.txt',
  mime_type:'text/plain',
  content:'iPhone 17 256GB\n🫟 Preto💰R$4950\n🫟 Azul 💰R$4900'
});
assert.deepStrictEqual(
  colorOwnPrice.queue.candidates
    .map(c=>[c.interpreted_offer.color,c.interpreted_offer.price.amount_minor])
    .sort((a,b)=>a[0].localeCompare(b[0],'pt-BR')),
  [['Azul',490000],['Preto',495000]],
  'preco por cor deve preservar cada combinacao'
);

const colorAfterPrice=buildQueue({
  filename:'color-after-price.txt',
  mime_type:'text/plain',
  content:'12 Pro Max 128GB\n*R$2.200*\n🟡GOLD - 78%\n⚫️GRAFITE - 89%\n⚪️ SILVER - 90%'
});
assert.deepStrictEqual(
  colorAfterPrice.queue.candidates.map(c=>c.interpreted_offer.color).sort(),
  ['Gold','Grafite','Prata'],
  'cores apos preco devem permanecer associadas ao modelo anterior'
);

const colorInlineEmoji=buildQueue({
  filename:'color-inline.txt',
  mime_type:'text/plain',
  content:'iPhone 14 128GB ⚫️🟣🔵\nR$ 2.050'
});
assert.deepStrictEqual(
  colorInlineEmoji.queue.candidates.map(c=>c.interpreted_offer.color).sort(),
  ['Azul','Preto','Roxo'],
  'emojis inline devem expandir variantes de cor'
);

const fs=require('fs');
const path=require('path');
const campoGrandeHeldout=fs.readFileSync(path.join(__dirname,'fixtures/heldout/campo-grande-grade-a-2026-10-01.txt'),'utf8');
const campoGrandeParsed=buildQueue({
  filename:'campo-grande-grade-a-2026-10-01.txt',
  mime_type:'text/plain',
  content:campoGrandeHeldout
});
console.log('HELDOUT_CAMPO_GRANDE='+JSON.stringify({
  candidates:campoGrandeParsed.queue.candidates.length,
  offers:campoGrandeParsed.queue.candidates.map(c=>({
    model:c.interpreted_offer.model?.label??null,
    capacity_gb:c.interpreted_offer.capacity_gb??null,
    color:c.interpreted_offer.color??null,
    price:c.interpreted_offer.price?.amount_minor??null,
    condition:c.interpreted_offer.condition??null
  })),
  ambiguities:campoGrandeParsed.queue.unresolved_ambiguities.map(item=>({
    field:item.field,cause:item.cause,raw:item.raw,sources:item.sources
  })),
  invalid:campoGrandeParsed.queue.invalid_items
}));

const observeHeldout=(label,filename)=>{
  const content=fs.readFileSync(path.join(__dirname,'fixtures/heldout',filename),'utf8');
  const parsedHeldout=buildQueue({filename,mime_type:'text/plain',content});
  console.log(label+'='+JSON.stringify({
    candidates:parsedHeldout.queue.candidates.length,
    offers:parsedHeldout.queue.candidates.map(c=>({
      model:c.interpreted_offer.model?.label??null,
      capacity_gb:c.interpreted_offer.capacity_gb??null,
      color:c.interpreted_offer.color??null,
      price:c.interpreted_offer.price?.amount_minor??null,
      condition:c.interpreted_offer.condition??null
    })),
    ambiguities:parsedHeldout.queue.unresolved_ambiguities.map(item=>({
      field:item.field,cause:item.cause,raw:item.raw,sources:item.sources
    })),
    invalid:parsedHeldout.queue.invalid_items
  }));
};
observeHeldout('HELDOUT_PRONTA_ENTREGA','estoque-atualizado-pronta-entrega-2026-10-01.txt');
observeHeldout('HELDOUT_IPHONE_NEW_LACRADO','iphone-new-lacrado-2026-10-01.txt');

const ambiguityBreakdown=parsed.queue.unresolved_ambiguities.reduce((acc,item)=>{
  const key=(item.field||'_structural')+':'+(item.cause||'unknown');
  acc[key]=(acc[key]||0)+1;
  return acc;
},{});
const invalidBreakdown=parsed.queue.invalid_items.reduce((acc,item)=>{
  const key=item.cause||'unknown';
  acc[key]=(acc[key]||0)+1;
  return acc;
},{});
console.log('REAL_COMERCIO_DIAGNOSTICS ambiguities='+JSON.stringify(ambiguityBreakdown)+' invalid='+JSON.stringify(invalidBreakdown));
console.log('EXTERNAL_CALC_LIST_INTAKE_V0=PASS candidates='+parsed.queue.candidates.length+' auto='+partition.auto.length+' review='+partition.review.length);
require('./prova_scoped_price_boundaries_v2');

require('./prova_captain_scoped_variants_v1');

require('./prova_captain_standalone_review_v1');

require('./prova_private_corpus_benchmark_v1');

require('./prova_shadow_source_reconciliation_v1');

require('./prova_shadow_corpus_report_v1');

require('./prova_shadow_c01_review_preflight_v1');

require('./prova_shadow_authority_gate_v1');

require('./prova_shadow_supplier_resolution_preflight_v1');

require('./prova_shadow_integrated_readonly_v1');

require('./prova_private_integrated_shadow_corpus_v1');

require('./prova_shadow_unmatched_price_evidence_v1');

// Gate 1: mock de RPC, somente sintético e sem escritas reais.
// Um UUID informado não é comprovante de autorização.
async function proveSupplierBindingFailClosed(){
  const {processListIntakeCommand}=require('./list-intake-api');
  const previousFetch=globalThis.fetch;
  const calls=[];
  globalThis.fetch=async(url,request)=>{
    const name=String(url).split('/rpc/')[1];
    calls.push(name);
    if(name==='extcalc_bind_source_supplier_v0'){
      const body=JSON.parse(request.body);
      return {ok:true,status:200,text:async()=>JSON.stringify({
        ok:true,source_id:'source_wrong',supplier_id:body.p_supplier_id
      })};
    }
    return {ok:true,status:200,text:async()=>JSON.stringify({idempotent:false})};
  };
  const env={SUPABASE_URL:'https://example.supabase.co',SUPABASE_ANON_KEY:'synthetic'};
  try{
    const withoutSupplier=await processListIntakeCommand({
      env,token:'synthetic-token',rawCommand:{filename:'gate1-no-supplier.txt',content:sample}
    });
    assert.strictEqual(withoutSupplier.auto_promoted,0);
    assert.strictEqual(withoutSupplier.review_required,withoutSupplier.candidates);
    assert.strictEqual(withoutSupplier.review_reasons.SUPPLIER_IDENTITY_UNVERIFIED,withoutSupplier.candidates);
    assert.ok(!calls.includes('extcalc_persist_auto_promoted_c01_v0'));
    calls.length=0;
    await assert.rejects(
      processListIntakeCommand({env,token:'synthetic-token',rawCommand:{
        filename:'gate1-wrong-receipt.txt',content:sample,
        supplier_id:'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
      }}),
      error=>error.code==='EXTCALC_SUPPLIER_BINDING_UNVERIFIED'
    );
    assert.deepStrictEqual(calls,['extcalc_bind_source_supplier_v0']);
  } finally {
    globalThis.fetch=previousFetch;
  }
}
proveSupplierBindingFailClosed().catch(error=>{console.error(error);process.exitCode=1;});

