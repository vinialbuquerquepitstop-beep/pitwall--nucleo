'use strict';
// F1 missing-offer recovery: only a server-resolved IMMUTABLE original may
// create a REVIEW_REQUIRED C01 candidate; never a sellable/auto-promoted offer.
const crypto=require('node:crypto');
const sha=text=>crypto.createHash('sha256').update(text,'utf8').digest('hex');
const CONTRACT='external-calc-c01-manual-recovery/v0';
function fail(code){throw Object.assign(new Error(code),{code,status:422});}
function nonempty(s){return typeof s==='string'&&s.trim().length>0;}
function eqSourceText(a,b){return String(a).normalize('NFKC').toLocaleLowerCase('pt-BR').replace(/\s+/g,' ').trim()===
 String(b).normalize('NFKC').toLocaleLowerCase('pt-BR').replace(/\s+/g,' ').trim();}
function tokenFound(haystack,needle){
 const norm=s=>String(s).normalize('NFKC').toLocaleLowerCase('pt-BR').replace(/\s+/g,' ').trim();
 const h=norm(haystack),n=norm(needle);
 let i=h.indexOf(n);
 while(i>=0){
  const before=i===0?' ':h[i-1],after=h[i+n.length]||' ';
  if(!/[\p{L}\d]/u.test(before)&&!(/[\p{L}\d]/u.test(after)))return true;
  i=h.indexOf(n,i+1);
 }
 return false;
}
function moneyFromSource(line){
 const format='(?:\\d{1,3}(?:\\.\\d{3})+|\\d{3,6})(?:,\\d{2})?';
 const patterns=[
  new RegExp('R\\$\\s*\\*?\\s*('+format+')','giu'),
  new RegExp('[💵💰💲]\\s*\\*?\\s*(?:R\\$\\s*)?('+format+')','gu')
 ];
 const matches=[];
 for(const rx of patterns){for(const m of line.matchAll(rx)){
  const amount=m[1].replace(/\./g,'');
  const [whole,cents='00']=amount.split(',');
  const minor=Number(whole)*100+Number(cents);
  if(Number.isSafeInteger(minor)&&minor>0)matches.push({start:m.index,end:m.index+m[0].length,minor});
 }}
 // overlapping emoji/R$ hits represent one token; distinct tokens are ambiguous
 const unique=[];
 for(const m of matches){
  if(unique.some(p=>!(m.end<=p.start||m.start>=p.end)))continue;
  unique.push(m);
 }
 if(unique.length!==1)fail('RECOVERY_EXACT_ONE_MONETARY_PRICE_REQUIRED');
 return unique[0].minor;
}
function intLine(n,lines){
 if(!Number.isSafeInteger(n)||n<1||n>lines.length)fail('RECOVERY_SOURCE_LINE_INVALID');
 return lines[n-1];
}
function strictKeys(obj,allowed,code){
 if(!obj||typeof obj!=='object'||Array.isArray(obj))fail(code);
 if(Object.keys(obj).some(x=>!allowed.includes(x)))fail(code);
}
function normalizeCommand(command){
 strictKeys(command,['trusted_input_ref','model_line','price_line','color_line','condition_line','model_id','capacity_gb','color','condition','price_amount_minor'], 'RECOVERY_COMMAND_INVALID');
 if(!nonempty(command.trusted_input_ref)||command.trusted_input_ref.length>240)fail('RECOVERY_TRUSTED_REF_REQUIRED');
 const lines=['model_line','price_line','color_line','condition_line'];
 for(const k of lines)if(command[k]!=null&&(!Number.isSafeInteger(command[k])||command[k]<1))fail('RECOVERY_SOURCE_LINE_INVALID');
 if(!Number.isSafeInteger(command.model_line)||!Number.isSafeInteger(command.price_line))fail('RECOVERY_SOURCE_LINES_REQUIRED');
 if(!nonempty(command.model_id)||command.model_id.length>120)fail('RECOVERY_MODEL_REQUIRED');
 if(!Number.isSafeInteger(command.capacity_gb)||command.capacity_gb<32||command.capacity_gb>8192)fail('RECOVERY_CAPACITY_INVALID');
 if(!Number.isSafeInteger(command.price_amount_minor)||command.price_amount_minor<=0)fail('RECOVERY_PRICE_INVALID');
 if(command.color !=null && (!nonempty(command.color)||!command.color_line))fail('RECOVERY_COLOR_LINE_REQUIRED');
 if(command.condition !=null && (!nonempty(command.condition)||!command.condition_line))fail('RECOVERY_CONDITION_LINE_REQUIRED');
 return {...command,model_id:command.model_id.trim(),
  color:command.color==null?null:command.color.trim(),
  condition:command.condition==null?null:command.condition.trim()};
}
function assertTrustedSource(resolved,ref){
 if(!resolved||typeof resolved!=='object'||Array.isArray(resolved)||
 !nonempty(resolved.analysis_id)||!nonempty(resolved.source_id)||
 !nonempty(resolved.supplier_id)||typeof resolved.original_text!=='string'||
 !nonempty(resolved.original_sha256)||sha(resolved.original_text)!==resolved.original_sha256||
 !Array.isArray(resolved.models)||resolved.models.length===0||
 resolved.trusted_input_ref!==ref||resolved.is_immutable!==true||
 resolved.is_authorized!==true||resolved.is_quarantined===true||
 resolved.is_supplier_bound!==true)fail('RECOVERY_TRUSTED_ORIGINAL_UNAVAILABLE');
 return resolved;
}
function buildManualRecoveryCandidate(resolved,command){
 const c=normalizeCommand(command);
 const src=assertTrustedSource(resolved,c.trusted_input_ref);
 const lines=src.original_text.replace(/\r\n/g,'\n').split('\n');
 const modelLine=intLine(c.model_line,lines),priceLine=intLine(c.price_line,lines);
 // Match the installed C01 gate: one adjoining model/price pair, and color
 // is the complete material field in the same line as the single R$ token.
 if(c.price_line!==c.model_line+1 || !c.color || c.color_line!==c.price_line)
  fail('RECOVERY_STRICT_C01_SOURCE_SCOPE_REQUIRED');
 const model=src.models.find(m=>m&&m.id===c.model_id);
 if(!model||!nonempty(model.label)||!tokenFound(modelLine,model.label))
  fail('RECOVERY_MODEL_NOT_IN_ORIGINAL');
 const slug=model.label.trim().toLocaleLowerCase('en-US').replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'');
 if(model.id!==slug)fail('RECOVERY_MODEL_C01_IDENTITY_MISMATCH');
 const afterModel=modelLine.trim().slice(model.label.length).trim();
 if(!modelLine.trim().toLocaleLowerCase('en-US').startsWith(model.label.toLocaleLowerCase('en-US')) ||
   !new RegExp('^'+c.capacity_gb+'\\s*GB(?:\\s|$)','iu').test(afterModel))
   fail('RECOVERY_MODEL_SCOPE_UNVERIFIED');
 // A shorter model cannot be selected if the exact original contains a
 // longer, distinct approved model, e.g. "iPhone 17" vs "iPhone 17 Pro".
 if(src.models.some(m=>m&&m.id!==model.id&&nonempty(m.label)&&
   m.label.length>model.label.length&&tokenFound(modelLine,m.label)))fail('RECOVERY_LONGER_MODEL_IN_ORIGINAL');
 if(!new RegExp('(?:^|[^\\d])'+c.capacity_gb+'\\s*(?:GB|G)(?:$|[^\\p{L}\\d])','iu').test(modelLine))
  fail('RECOVERY_CAPACITY_NOT_IN_ORIGINAL');
 const amount=moneyFromSource(priceLine);
 if(amount!==c.price_amount_minor)fail('RECOVERY_PRICE_NOT_IN_ORIGINAL');
 if((priceLine.match(/R\$\s*\d/giu)||[]).length!==1 || /[+\/|]/u.test(priceLine))
  fail('RECOVERY_STRICT_SINGLE_BRL_PRICE_REQUIRED');
 const normalizeColor=text=>text.replace(/[^\p{L}\d]+/gu,' ').trim().toLocaleLowerCase('pt-BR');
 const colorPrefix=priceLine.slice(0,priceLine.indexOf('R$'));
 if(normalizeColor(colorPrefix)!==normalizeColor(c.color))
   fail('RECOVERY_COLOR_EXACT_SEGMENT_REQUIRED');
 const colorLine=c.color==null?null:intLine(c.color_line,lines);
 if(c.color!=null&&!tokenFound(colorLine,c.color))fail('RECOVERY_COLOR_NOT_IN_ORIGINAL');
 const conditionLine=c.condition==null?null:intLine(c.condition_line,lines);
 if(c.condition!=null&&!tokenFound(conditionLine,c.condition))fail('RECOVERY_CONDITION_NOT_IN_ORIGINAL');
 const evidenceByField={model:[c.model_line],capacity_gb:[c.model_line],price:[c.price_line]};
 if(c.color)evidenceByField.color=[c.color_line];
 if(c.condition)evidenceByField.condition=[c.condition_line];
 const numbers=[...new Set(Object.values(evidenceByField).flat())].sort((a,b)=>a-b);
 const interpreted_offer={
  supplier_id:src.supplier_id,
  model:{id:model.id,label:model.label,attributes:{}},
  capacity_gb:c.capacity_gb,
  condition:c.condition,color:c.color,price:{amount_minor:amount,currency:'BRL'}
 };
 const identityMaterial={supplier_id:interpreted_offer.supplier_id,model:model.id,
  capacity_gb:c.capacity_gb,condition:c.condition,color:c.color};
 const offerId='off_'+sha([src.analysis_id,src.source_id,'manual',c.model_line,c.price_line,
  c.color_line??'',c.condition_line??'',model.id,c.capacity_gb,c.color||'',c.condition||'',amount].join('\x1f')).slice(0,24);
 const runId='manual_'+sha(src.source_id+'|'+src.original_sha256).slice(0,24);
 const candidate={
  contract_version:'external-calc-c01-readonly/v1',
  analysis_id:src.analysis_id,source_id:src.source_id,
  offer_id:offerId,offer_revision:1,stage:'REVIEW',
  execution_status:'SUCCEEDED',domain_outcome:'REVIEW_REQUIRED',
  freshness_status:'CURRENT',interpretation_run_id:runId,
  interpretation_engine_version:CONTRACT,
  interpretation_confidence:{overall:null,by_field:{},record_state:'human_source_recovery'},
  offer_identity_fingerprint:sha(JSON.stringify(identityMaterial)),
  offer_value_fingerprint:sha(JSON.stringify(interpreted_offer)),
  interpreted_offer,reviewed_offer:null,review:null,
  review_evidence:{record_id:offerId,field_sources:evidenceByField,
   source_lines:numbers.map(n=>({line_number:n,raw:lines[n-1]}))},
  provenance_refs:['manual_recovery:'+CONTRACT,'source_sha256:'+src.original_sha256],
  trace:[]
 };
 return {candidate,proof:{
  contract_version:CONTRACT,original_sha256:src.original_sha256,source_lines:numbers,
  manually_recovered:true,auto_promotable:false,review_required:true
 }};
}
function createManualMissingOfferRecoveryV0({trustedInputResolver,candidateRepository}={}){
 if(typeof trustedInputResolver?.resolve!=='function')throw new Error('RECOVERY_RESOLVER_REQUIRED');
 if(typeof candidateRepository?.persistCandidate!=='function')throw new Error('RECOVERY_CANDIDATE_REPOSITORY_REQUIRED');
 return {
  async execute({command,actor_ref}={}){
   if(!nonempty(actor_ref))fail('RECOVERY_AUTHENTICATED_ACTOR_REQUIRED');
   const c=normalizeCommand(command);
   // Never use client-provided source bytes, supplier, tenant or model aliases.
   const source=await trustedInputResolver.resolve({trusted_input_ref:c.trusted_input_ref,actor_ref});
   const out=buildManualRecoveryCandidate(source,c);
   const receipt=await candidateRepository.persistCandidate(out.candidate);
   if(!receipt||receipt.ok!==true||receipt.analysis_id!==out.candidate.analysis_id||
    receipt.offer_id!==out.candidate.offer_id||receipt.offer_revision!==1)
    fail('RECOVERY_PERSISTENCE_NOT_CONFIRMED');
   return {contract_version:CONTRACT,status:'REVIEW_REQUIRED',
    offer_id:out.candidate.offer_id,analysis_id:out.candidate.analysis_id,
    offer_revision:1,idempotent:receipt.idempotent===true,
    proof:out.proof, quoteable:false};
  }
 };
}
module.exports={CONTRACT,normalizeCommand,buildManualRecoveryCandidate,createManualMissingOfferRecoveryV0};
