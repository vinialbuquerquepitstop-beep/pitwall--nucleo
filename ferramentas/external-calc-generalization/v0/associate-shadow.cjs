'use strict';
/**
 * External Calc VS2 — read-only association proposal engine.
 * Inputs are VS1 source-scoped blocks; NEVER promotes an offer or writes.
 * Numeric and color extraction are grammars, not SKU / supplier aliases.
 */
const VERSION='external-calc-association-shadow/v0';
const {segmentCanonical}=require('./segment-shadow.cjs');
const {validateCanonicalDocument}=require('../../external-calc-universal-input/v1/canonical-document');
const trim=s=>String(s??'').normalize('NFKC').replace(/\u00a0/g,' ').trim();
const AMOUNT=/(?:\d{1,3}(?:\.\d{3})+(?:,\d{2})?|\d{3,6}(?:,\d{2})?)/u.source;
const MONEY=new RegExp('(?:R\\$\\s*)?('+AMOUNT+')(?![\\d.,])','gu');
const MONEY_WITH_CUE=/(?:R\$|[💵💰]|pre[cç]o|valor|cada cor)/iu;
const VARIANT_BARE_PRICE=/(?:[—–|=:])\s*\d{1,3}(?:\.\d{3})+(?:,\d{2})?\s*\*?\s*$|(?:[—–|=:])\s*\d{3,6}(?:,\d{2})?\s*\*?\s*$/u;
const NONCOMMERCIAL=/(?:pedido\s+m[ií]nimo|mínimo\s+de|parcela|vezes|telefone|contato|whatsapp|atendimento|frete|desconto|economize|retirada|disponibilidade|boletim|cat[aá]logo|revendedor|estoque|importado|fict[ií]cio)/iu;
const CONDITION=/\b(cpo|lacrad[oa]s?|caixa aberta|open box|seminov[oa]s?|recondicionad[oa]s?|usad[oa]s?|n[aã]o ativad[oa])\b/iu;
function conditionToken(t){
 const m=CONDITION.exec(t);if(!m)return null;
 const v=m[1].toLocaleLowerCase('pt-BR');
 return v==='cpo'?'CPO':v.startsWith('lacrad')?'Lacrado':
  v==='open box'||v==='caixa aberta'?'Caixa aberta':
  v.startsWith('seminov')?'Seminovo':v.startsWith('usad')?'Usado':
  v.startsWith('recondicionad')?'Recondicionado':'Não ativado';
}
function minor(raw){
 const s=String(raw).replace(/^R\$\s*/,'').replace(/\./g,'').replace(',','.');
 const n=Number(s);if(!Number.isFinite(n)||n<=0||!Number.isSafeInteger(Math.round(n*100)))return null;
 return Math.round(n*100);
}
function getPrice(member) {
 const t=trim(member.text);
 if(['product','contact','notice','section'].includes(member.role)||NONCOMMERCIAL.test(t))return null;
 if(member.role!=='price'&&!MONEY_WITH_CUE.test(t)&&
     !(member.role==='variant'&&VARIANT_BARE_PRICE.test(t)))return null;
 let selected=null,count=0;
 for(const m of t.matchAll(MONEY)){count++;selected=minor(m[1]);}
 if(count!==1||selected===null)return {kind:'ambiguous_price',source_ref:member.source_ref};
 return {kind:'price',minor:selected,source_ref:member.source_ref,text:t};
}
function getColor(member,hasPrice){
 const t=trim(member.text);
 if(['product','notice','contact','condition','section'].includes(member.role))return null;
 const bracket=[...t.matchAll(/\[([^\]]{1,48})\]/gu)].map(m=>m[1].trim()).filter(Boolean);
 if(bracket.length)return {colors:bracket,source_ref:member.source_ref};
 let text=t.replace(/^🎨\s*/u,'')
   .replace(/^(?:cor(?:es)?(?:\s+desta\s+oferta)?\s*:)\s*/iu,'');
 if(hasPrice){
   text=text.replace(/R\$\s*\d{1,3}(?:\.\d{3})+(?:,\d{2})?|R\$\s*\d{3,6}(?:,\d{2})?|\d{1,3}(?:\.\d{3})+(?:,\d{2})?|\d{3,6}(?:,\d{2})?/gu,'');
   text=text.replace(/[|:—–=]+\s*$/gu,'').trim();
 }
 const withCue=member.role==='variant'||/^🎨/u.test(t);
 const inline=hasPrice&&(member.role==='price')&&
   /[|—–=]/u.test(t)&&/[^\d\s|:—–=.,R$*💵💰]/u.test(text);
 if(!withCue&&!inline)return null;
 // Normalize Unicode variation selectors before stripping an emoji bullet.
 // VS16 is a presentation marker, not part of the actual color name.
 text=text.replace(/[\uFE0E\uFE0F]/gu,'')
   .replace(/^[•▫*]\s*/u,'').replace(/^(?:colou?r|cor|cores)\s*:/iu,'').trim();
 text=text.replace(/\s*[|:—–=]\s*$/u,'').trim();
 text=text.replace(/[|:—–=]/gu,'').trim();
 if(!text||/\b(?:valor|pre[cç]o|cada\s+cor|unit[aá]rio)\b/iu.test(text))return null;
 if(/(?:\s+(?:ou|e)\s+|\/|\+)/iu.test(text))return {uncertain:true,source_ref:member.source_ref};
 if(/[\d]/u.test(text))return null;
 if(text.length>52||!/\p{L}/u.test(text))return null;
 return {colors:[text],source_ref:member.source_ref};
}
function readCondition(block){
 const signals=[];
 const inModel=conditionToken(block.model_span.text);
 if(inModel)signals.push({value:inModel,source_ref:block.model_span.source_ref});
 for(const m of block.members.slice(1)){
   if(m.role!=='condition')continue;
   const token=conditionToken(m.text);
   if(token)signals.push({value:token,source_ref:m.source_ref});
 }
 const unique=[...new Set(signals.map(s=>s.value))];
 if(unique.length!==1)return {ok:false,reason:unique.length>1?'CONDITION_CONFLICT':'CONDITION_NOT_EXPLICIT',sources:signals.map(s=>s.source_ref)};
 return {ok:true,value:unique[0],sources:[...new Set(signals.map(s=>s.source_ref))]};
}
function cleanModel(raw){
 return trim(raw).replace(/\s*[—–-]\s*(?:lacrad[oa]s?|cpo|caixa aberta|open box|seminov[oa]s?|usad[oa]s?)\s*$/iu,'').trim();
}
function capacity(model){
 const matches=[...model.matchAll(/(\d{2,4})\s*(GB|TB)\b/giu)];
 if(!matches.length)return null;
 const m=matches.at(-1);
 return Number(m[1])*(m[2].toUpperCase()==='TB'?1024:1);
}
function resolveProduct(block){
 const model=cleanModel(block.model_span.text),cond=readCondition(block);
 const candidates=[],abstentions=[],edges=[];
 let pendingColors=[],pendingPrice=null;
 const abstain=(reason,sources,metadata={})=>{
   abstentions.push({block_id:block.block_id,reason,source_refs:[...new Set(sources.filter(Boolean))],...metadata});
 };
 const proposal=(color,price)=>{
   if(!cond.ok){
     abstain(cond.reason,[...cond.sources,color.source_ref,price.source_ref,block.model_span.source_ref]);return;
   }
   const spans={
     model:[block.model_span.source_ref],
     capacity:capacity(model)!==null?[block.model_span.source_ref]:[],
     color:[color.source_ref],
     condition:cond.sources,
     price:[price.source_ref]
   };
   if(Object.entries(spans).some(([key,refs])=>key!=='capacity'&&!refs.length)){
     abstain('MISSING_SOURCE_PROVENANCE',[color.source_ref,price.source_ref]);return;
   }
   const id=block.block_id+'-proposal-'+String(candidates.length+1).padStart(3,'0');
   candidates.push({
     proposal_id:id,block_id:block.block_id,decision:'PROPOSED_REVIEW',
     model,capacity_gb:capacity(model),color:color.value,
     condition:cond.value,price_minor:price.minor,currency:'BRL',
     source_spans:spans,association_reason:price.reason,
     confidence:'STRUCTURALLY_SUPPORTED_NOT_AUTHORIZED'
   });
   edges.push(
     {from:price.source_ref,to:id,relation:'unit_price',reason:price.reason},
     {from:color.source_ref,to:id,relation:'variant_color',reason:price.reason},
     {from:block.model_span.source_ref,to:id,relation:'product',reason:'within_product_block'}
   );
 };
 const flush=why=>{
   if(pendingColors.length||pendingPrice){
     abstain(why,[...pendingColors.map(x=>x.source_ref),pendingPrice?.source_ref]);
   }
   pendingColors=[];pendingPrice=null;
 };
 for(const m of block.members.slice(1)){
   if(['notice','contact','unknown'].includes(m.role))continue;
   const price=getPrice(m);
   const color=getColor(m,Boolean(price&&price.kind==='price'));
   if(price?.kind==='ambiguous_price'){
     flush('CONTRADICTORY_OR_MULTIPLE_PRICES');abstain('UNPARSEABLE_PRICE',[m.source_ref]);continue;
   }
   if(color?.uncertain){
     flush('COMPOUND_COLOR_UNRESOLVED');abstain('MULTIPLE_COLORS_WITHOUT_EVIDENCE',[m.source_ref]);continue;
   }
   if(price&&color?.colors?.length===1){
     flush('UNPAIRED_CONTEXT_BEFORE_INLINE');
     proposal({value:color.colors[0],source_ref:color.source_ref},{...price,reason:'same_line_color_price'});continue;
   }
   if(price&&color?.colors?.length>1){
     flush('UNPAIRED_CONTEXT_BEFORE_INLINE');abstain('MULTIPLE_INLINE_COLORS',[m.source_ref]);continue;
   }
   if(color?.colors?.length){
     if(pendingPrice){
       if(color.colors.length===1){
         proposal({value:color.colors[0],source_ref:color.source_ref},{...pendingPrice,reason:'price_before_color'});
         pendingPrice=null;continue;
       }
       flush('PRICE_WITH_MULTIPLE_LATER_COLORS');continue;
     }
     pendingColors.push(...color.colors.map(value=>({value,source_ref:color.source_ref})));continue;
   }
   if(price?.kind==='price'){
     if(pendingColors.length){
       const shared=/\b(?:cada\s+cor|mesmo\s+valor|mesmo\s+pre[cç]o|por\s+cor)\b/iu.test(m.text);
       if(pendingColors.length===1||shared){
         for(const colorItem of pendingColors){
           proposal(colorItem,{...price,reason:shared?'explicit_shared_price':'color_before_price'});
         }
       }else abstain('MULTIPLE_COLORS_PRICE_SCOPE_UNCLEAR',
         [...pendingColors.map(x=>x.source_ref),m.source_ref]);
       pendingColors=[];
     }else if(pendingPrice){
       abstain('TWO_PRICES_NO_COLOR',[pendingPrice.source_ref,m.source_ref]);pendingPrice=null;
     }else pendingPrice=price;
   }
 }
 flush('INCOMPLETE_VARIANT_OR_PRICE');
 return {block_id:block.block_id,model_anchor:block.model_span,
   proposals:candidates,edges,abstentions};
}
function resolveAssociations(document,segments=null){
 validateCanonicalDocument(document);
 const structure=segments??segmentCanonical(document);
 if(structure.mode!=='SHADOW_READ_ONLY'||
     structure.document_source_hash!==document.source.content_hash||
     !Array.isArray(structure.product_blocks)){
   throw new Error('VS2_INVALID_OR_MISMATCHED_VS1_STRUCTURE');
 }
 const blocks=structure.product_blocks.map(resolveProduct);
 const proposals=blocks.flatMap(b=>b.proposals),abstentions=blocks.flatMap(b=>b.abstentions),edges=blocks.flatMap(b=>b.edges);
 return {
   contract_version:VERSION,mode:'SHADOW_READ_ONLY',offers:[],
   document_source_hash:document.source.content_hash,
   block_count:blocks.length,proposals,edges,abstentions,
   summary:{blocks:blocks.length,proposals:proposals.length,abstentions:abstentions.length,
     structurally_unassigned:structure.unassigned.length},
   disclaimer:'All outputs are PROPOSED_REVIEW; they are not approved C01 offers.'
 };
}
module.exports={VERSION,resolveAssociations,resolveProduct,minor,getPrice,getColor};
