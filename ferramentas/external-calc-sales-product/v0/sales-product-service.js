'use strict';
const crypto=require('crypto');
const {calculateInstallments}=require('../../external-calc-c02/v1/c02-calculator');

const VARIANT_VERSION='external-calc-variant-offer-resolver/v0';
const TRADE_IN_VERSION='external-calc-trade-in-estimate/v0';
const SIM_VERSION='external-calc-sales-simulation/v0';

function fail(code,msg=code){const e=new Error(msg);e.code=code;throw e;}
function str(v,f){if(typeof v!=='string'||!v.trim())fail('SALE_SIMULATION_INVALID',f+' obrigatorio');return v.trim();}
function hash(v){return crypto.createHash('sha256').update(JSON.stringify(v)).digest('hex');}
function money(v,f='money',allowZero=true){if(!v||!Number.isSafeInteger(v.amount_minor)||v.amount_minor<0||(!allowZero&&v.amount_minor===0)||String(v.currency||'').toUpperCase()!=='BRL')fail('SALE_AMOUNT_INVALID',f+' invalido');return {amount_minor:v.amount_minor,currency:'BRL'};}
function modelId(o){return o?.reviewed_offer?.model?.id||null;}
function eligible(c){
 return !!c&&c.execution_status==='SUCCEEDED'&&c.domain_outcome==='VALID'&&c.freshness_status==='CURRENT'&&c.reviewed_offer&&
   c.reviewed_offer.availability!==false&&String(c.reviewed_offer.availability||'').toUpperCase()!=='UNAVAILABLE';
}
function normalizeVariantCommand(c){
 if(!c||typeof c!=='object'||Array.isArray(c))fail('VARIANT_SELECTION_INVALID');
 const allowed=new Set(['supplier_id','model_id','capacity_gb','color']);
 for(const k of Object.keys(c))if(!allowed.has(k))fail('VARIANT_SELECTION_INVALID','campo proibido: '+k);
 const out={supplier_id:str(c.supplier_id,'supplier_id'),model_id:str(c.model_id,'model_id'),capacity_gb:c.capacity_gb,color:c.color==null?null:str(c.color,'color')};
 if(out.capacity_gb!=null&&(!Number.isInteger(out.capacity_gb)||out.capacity_gb<=0))fail('VARIANT_SELECTION_INVALID','capacity_gb invalida');
 return out;
}
function resolveVariant(candidates,command){
 const q=normalizeVariantCommand(command);
 let rows=(candidates||[]).filter(eligible).filter(x=>x.reviewed_offer.supplier_id===q.supplier_id&&modelId(x)===q.model_id);
 if(q.capacity_gb!=null)rows=rows.filter(x=>x.reviewed_offer.capacity_gb===q.capacity_gb);
 if(!rows.length)fail('VARIANT_NOT_FOUND');
 const colors=[...new Set(rows.map(x=>x.reviewed_offer.color).filter(Boolean))];
 const priceByColor=new Map();
 for(const x of rows){const color=x.reviewed_offer.color||'';const p=x.reviewed_offer.price?.amount_minor;if(!priceByColor.has(color))priceByColor.set(color,new Set());priceByColor.get(color).add(p);}
 if(!q.color&&colors.length>1&&new Set(rows.map(x=>x.reviewed_offer.price?.amount_minor)).size>1)fail('VARIANT_COLOR_REQUIRED');
 if(q.color)rows=rows.filter(x=>String(x.reviewed_offer.color||'').toLowerCase()===q.color.toLowerCase());
 if(!rows.length)fail('VARIANT_NOT_FOUND');
 if(rows.length!==1)fail('VARIANT_AMBIGUOUS');
 const x=rows[0],o=x.reviewed_offer;
 return {resolver_version:VARIANT_VERSION,analysis_id:x.analysis_id,offer_id:x.offer_id,offer_revision:x.offer_revision,offer_identity_fingerprint:x.offer_identity_fingerprint,offer_value_fingerprint:x.offer_value_fingerprint,supplier_id:o.supplier_id,model_id:modelId(x),capacity_gb:o.capacity_gb??null,color:o.color??null,price:money(o.price,'offer.price',false)};
}
function normalizeTradeInCommand(c){
 if(!c||typeof c!=='object'||Array.isArray(c))fail('TRADE_IN_SELECTION_INVALID');
 const allowed=new Set(['model_id','capacity_gb','color']);for(const k of Object.keys(c))if(!allowed.has(k))fail('TRADE_IN_SELECTION_INVALID','campo proibido: '+k);
 const out={model_id:str(c.model_id,'model_id'),capacity_gb:c.capacity_gb,color:c.color==null?null:str(c.color,'color')};
 if(out.capacity_gb!=null&&(!Number.isInteger(out.capacity_gb)||out.capacity_gb<=0))fail('TRADE_IN_SELECTION_INVALID');
 return out;
}
function normalizePolicy(p){
 if(!p)fail('TRADE_IN_POLICY_NOT_CONFIGURED');
 if(p.status!=='ACTIVE'||p.currency!=='BRL'||!p.policy_id||!Number.isInteger(p.version)||p.version<1||!Number.isSafeInteger(p.deduction_amount_minor)||p.deduction_amount_minor<0||!p.fingerprint)fail('TRADE_IN_POLICY_INVALID');
 return p;
}
function buildEstimateId(selection,core){const payload=Buffer.from(JSON.stringify(selection)).toString('base64url');return 'tie_'+payload+'.'+hash(core);}
function parseEstimateSelection(id){if(typeof id!=='string'||!id.startsWith('tie_')||!id.includes('.'))fail('TRADE_IN_ESTIMATE_NOT_FOUND');try{return JSON.parse(Buffer.from(id.slice(4,id.lastIndexOf('.')),'base64url').toString('utf8'));}catch{fail('TRADE_IN_ESTIMATE_NOT_FOUND');}}
function resolveTradeIn(candidates,policy,command){
 const q=normalizeTradeInCommand(command),p=normalizePolicy(policy);
 let rows=(candidates||[]).filter(eligible).filter(x=>modelId(x)===q.model_id);
 if(q.capacity_gb!=null)rows=rows.filter(x=>x.reviewed_offer.capacity_gb===q.capacity_gb);
 if(q.color)rows=rows.filter(x=>String(x.reviewed_offer.color||'').toLowerCase()===q.color.toLowerCase());
 rows=rows.filter(x=>x.reviewed_offer.price?.currency==='BRL'&&Number.isSafeInteger(x.reviewed_offer.price?.amount_minor)&&x.reviewed_offer.price.amount_minor>0);
 if(!rows.length)fail('TRADE_IN_NO_ELIGIBLE_OFFER');
 rows.sort((a,b)=>a.reviewed_offer.price.amount_minor-b.reviewed_offer.price.amount_minor||String(a.offer_id).localeCompare(String(b.offer_id)));
 const x=rows[0],o=x.reviewed_offer,credit=Math.max(o.price.amount_minor-p.deduction_amount_minor,0);
 const core={device:q,source:{analysis_id:x.analysis_id,offer_id:x.offer_id,offer_revision:x.offer_revision,offer_value_fingerprint:x.offer_value_fingerprint},policy:{policy_id:p.policy_id,version:p.version,fingerprint:p.fingerprint},credit};
 return {estimate_id:buildEstimateId(q,core),estimate_version:TRADE_IN_VERSION,device:{model_id:q.model_id,capacity_gb:q.capacity_gb??null,requested_color:q.color},source_offer:{analysis_id:x.analysis_id,offer_id:x.offer_id,offer_revision:x.offer_revision,supplier_id:o.supplier_id,color:o.color??null,price:money(o.price,'source.price',false)},policy:{policy_id:p.policy_id,version:p.version,fingerprint:p.fingerprint},deduction:{amount_minor:p.deduction_amount_minor,currency:'BRL'},estimated_credit:{amount_minor:credit,currency:'BRL'},estimate_fingerprint:hash(core)};
}
function normalizeSaleCommand(c){
 if(!c||typeof c!=='object'||Array.isArray(c))fail('SALE_SIMULATION_INVALID');
 const allowed=new Set(['analysis_id','offer_id','offer_revision','sale_amount','installment_count','trade_in_estimate_id']);
 for(const k of Object.keys(c))if(!allowed.has(k))fail('SALE_SIMULATION_INVALID','campo proibido: '+k);
 if(!Number.isInteger(c.offer_revision)||c.offer_revision<1||!Number.isInteger(c.installment_count)||c.installment_count<1||c.installment_count>18)fail('SALE_SIMULATION_INVALID');
 return {analysis_id:str(c.analysis_id,'analysis_id'),offer_id:str(c.offer_id,'offer_id'),offer_revision:c.offer_revision,sale_amount:money(c.sale_amount,'sale_amount',false),installment_count:c.installment_count,trade_in_estimate_id:c.trade_in_estimate_id==null?null:str(c.trade_in_estimate_id,'trade_in_estimate_id')};
}
function normalizeRateProfile(p,count){
 if(!p)fail('RATE_PROFILE_NOT_CONFIGURED');
 if(p.status!=='ACTIVE'||p.currency!=='BRL'||!p.profile_id||!Number.isInteger(p.version)||!Number.isInteger(p.rate_scale)||p.rate_scale<=0||!p.fingerprint)fail('RATE_PROFILE_INVALID');
 const e=(p.entries||[]).find(x=>x.installment_count===count);
 if(!e||!Number.isSafeInteger(e.rate_units)||e.rate_units<0)fail('INSTALLMENT_RATE_NOT_CONFIGURED');
 return {...p,entry:e};
}
function resolveExactOffer(candidates,q){const rows=(candidates||[]).filter(eligible).filter(x=>x.analysis_id===q.analysis_id&&x.offer_id===q.offer_id&&x.offer_revision===q.offer_revision);if(rows.length!==1)fail('SALE_OFFER_STALE');return rows[0];}
function resolveSimulation(candidates,policy,rateProfile,command){
 const q=normalizeSaleCommand(command),offer=resolveExactOffer(candidates,q);
 if(offer.reviewed_offer.price?.currency!==q.sale_amount.currency)fail('CURRENCY_MISMATCH');
 let trade=null,credit=0;
 if(q.trade_in_estimate_id){
   const selection=parseEstimateSelection(q.trade_in_estimate_id);
   trade=resolveTradeIn(candidates,policy,selection);
   if(trade.estimate_id!==q.trade_in_estimate_id)fail('TRADE_IN_ESTIMATE_STALE');
   credit=trade.estimated_credit.amount_minor;
 }
 const diff=q.sale_amount.amount_minor-credit;
 const direction=diff>0?'CUSTOMER_PAYS':diff<0?'STORE_PAYS':'EVEN';
 const financed=Math.max(diff,0),rp=normalizeRateProfile(rateProfile,q.installment_count);
 const coefficient=1+(rp.entry.rate_units/rp.rate_scale)/100;
 const installments=calculateInstallments(financed,{currency:'BRL',installment_base_addon_minor:0,installment_coefficients:[[q.installment_count,coefficient]]});
 const inst=installments[0]||{total_price:{amount_minor:0,currency:'BRL'},installment_price:{amount_minor:0,currency:'BRL'}};
 const core={offer:[q.analysis_id,q.offer_id,q.offer_revision,offer.offer_value_fingerprint],sale:q.sale_amount,trade:trade?.estimate_fingerprint||null,count:q.installment_count,rate:[rp.profile_id,rp.version,rp.fingerprint],financed};
 return {simulation_id:'sim_'+hash(core).slice(0,32),simulation_version:SIM_VERSION,offer_reference:{analysis_id:q.analysis_id,offer_id:q.offer_id,offer_revision:q.offer_revision,offer_value_fingerprint:offer.offer_value_fingerprint},sale_amount:q.sale_amount,trade_in:trade?{estimate_id:trade.estimate_id,estimated_credit:trade.estimated_credit,estimate_fingerprint:trade.estimate_fingerprint}:null,cash_difference:{direction,amount:{amount_minor:Math.abs(diff),currency:'BRL'}},installment_count:q.installment_count,financed_base:{amount_minor:financed,currency:'BRL'},total:inst.total_price,installment_amount:inst.installment_price,rate_profile_id:rp.profile_id,rate_profile_version:rp.version,rate_profile_fingerprint:rp.fingerprint,simulation_fingerprint:hash(core)};
}
function createSalesProductService({source}={}){
 if(!source)throw new Error('source obrigatorio');
 for(const m of ['loadMembership','loadCurrentOffers','loadActiveTradeInPolicy','loadActiveRateProfile'])if(typeof source[m]!=='function')throw new Error('source.'+m+' obrigatorio');
 async function ctx(auth){const m=await source.loadMembership({auth_user_id:str(auth,'auth_user_id')});if(!m||!m.ativo||!['dono','validador','vendedor'].includes(m.papel))fail('PRODUCT_FORBIDDEN');return m;}
 return {
  async resolveVariant({auth_user_id,command}){await ctx(auth_user_id);return resolveVariant(await source.loadCurrentOffers(),command);},
  async estimateTradeIn({auth_user_id,command}){await ctx(auth_user_id);const [offers,p]=await Promise.all([source.loadCurrentOffers(),source.loadActiveTradeInPolicy()]);return resolveTradeIn(offers,p,command);},
  async simulateSale({auth_user_id,command}){await ctx(auth_user_id);const [offers,p,r]=await Promise.all([source.loadCurrentOffers(),source.loadActiveTradeInPolicy(),source.loadActiveRateProfile()]);return resolveSimulation(offers,p,r,command);}
 };
}
module.exports={VARIANT_VERSION,TRADE_IN_VERSION,SIM_VERSION,resolveVariant,resolveTradeIn,resolveSimulation,createSalesProductService};
