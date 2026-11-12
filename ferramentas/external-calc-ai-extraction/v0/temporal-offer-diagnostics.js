'use strict';
// Conservative historical diagnostics for WhatsApp text exports.
// Timestamps and senders are *claims in untrusted text*, not authenticated facts.
// Never select a winning/latest price or persist over a previous revision.
function norm(s){return String(s||'').normalize('NFKD').replace(/[\u0300-\u036f]/g,'').trim().toLowerCase().replace(/\s+/g,' ')}
const HEADER=/^(?:\u200e)?(?:\[(\d{1,2})\/(\d{1,2})\/(\d{2,4}),\s*(\d{1,2}:\d{2})(?::\d{2})?\]\s*([^:]+?)\s*:\s?|(\d{1,2})\/(\d{1,2})\/(\d{2,4}),\s*(\d{1,2}:\d{2})(?::\d{2})?\s+-\s+([^:]+?)\s*:\s?)/;
function dateKey(match){
 const day=Number(match[1]||match[6]),month=Number(match[2]||match[7]);
 let year=Number(match[3]||match[8]);if(year<100)year+=2000;
 const time=(match[4]||match[9]).split(':');const hh=Number(time[0]),mm=Number(time[1]);
 const date=new Date(Date.UTC(year,month-1,day,hh,mm));
 if(date.getUTCFullYear()!==year||date.getUTCMonth()!==month-1||date.getUTCDate()!==day||hh>23||mm>59) return null;
 return date.getTime();
}
function messages(source){
 const lines=source.text.split(/\r?\n/);
 const out=[];let current=null;let offset=0;
 for(const line of lines){
  const hit=HEADER.exec(line);
  if(hit){
   if(current){current.end=offset;out.push(current)}
   current={start:offset,end:source.text.length,stamp:dateKey(hit),sender:norm(hit[5]||hit[10]),source_ref:source.source_ref};
  }
  offset+=line.length+1;
 }
 if(current){current.end=source.text.length;out.push(current)}
 return out;
}
function location(s,quote){
 const first=s.text.indexOf(quote);
 if(first<0||s.text.indexOf(quote,first+quote.length)>=0)return null;
 return first;
}
function detectUnboundPartialUpdates(sources){
 const found=[];
 for(const source of sources){
  for(const message of messages(source)){
   const body=source.text.slice(message.start,message.end);
   // Strip only the first WhatsApp header. The remaining message is not
   // trusted and must never be applied as an authoritative update.
   const stripped=body.replace(HEADER,'');
   const hasPrice=/(?:R\\$\\s*)?(?:\\d{1,3}(?:\\.\\d{3})+|\\d{4,7}),\\d{2}/i.test(stripped);
   const explicitUpdate=/\\b(?:baixou|aumentou|atualizad[oa]|novo\\s+preco|novo\\s+valor|agora\\s+r\\$|corrigindo|alterado)\\b/i.test(stripped);
   const product=/\\b(?:iphone|ipad|macbook|airpods|galaxy|poco|samsung|xiaomi)\\b/i.test(stripped);
   if(hasPrice&&explicitUpdate&&!product){
    found.push({source_ref:source.source_ref,reason:'PARTIAL_PRICE_UPDATE_UNBOUND',
      timestamp_claim:message.stamp,sender_claim:message.sender});
   }
  }
 }
 return found;
}
function temporalDiagnostics(extraction){
 const sourceMap=new Map(extraction.sources.map(s=>[s.source_ref,s]));
 const segments=new Map(extraction.sources.map(s=>[s.source_ref,messages(s)]));
 const groups=new Map();
 const issues=[],events=[];
 const partialUpdates=detectUnboundPartialUpdates(extraction.sources);
 for(const o of extraction.offers){
  if(!o.model||!o.price)continue;
  const priceEv=o.field_evidence.price;
  if(!Array.isArray(priceEv)||priceEv.length!==1){continue}
  const ev=priceEv[0],src=sourceMap.get(ev.source_ref);
  if(!src)continue;
  const offset=location(src,ev.quote);
  const scoped=offset===null?[]:(segments.get(src.source_ref)||[]).filter(m=>offset>=m.start&&offset<m.end);
  const msg=scoped.length===1?scoped[0]:null;
  // Do not merge across different sources or independently asserted supplier
  // identities. Within one chat source, sender is part of the group key.
  const k=JSON.stringify([src.source_ref,msg?.sender||null,norm(o.model),o.capacity_gb,norm(o.color),norm(o.condition)]);
  const event={offer_ref:o.offer_ref,source_ref:src.source_ref,amount_minor:o.price.amount_minor,
   timestamp_claim:msg?.stamp??null,sender_claim:msg?.sender??null,
   scope_verified:!!msg&&msg.stamp!==null};
  if(!groups.has(k))groups.set(k,[]);groups.get(k).push(event);
  events.push(event);
 }
 for(const group of groups.values()){
  if(group.length<2)continue;
  const prices=new Set(group.map(e=>e.amount_minor));
  const seen=new Set(group.map(e=>e.timestamp_claim));
  const chronological=group.every(e=>e.scope_verified)&&seen.size===group.length;
  if(prices.size===1){
   for(const e of group)issues.push({offer_ref:e.offer_ref,field:'price',
     reason:chronological?'REPEATED_SAME_PRICE_MESSAGE':'POSSIBLE_DUPLICATE_OFFER'});
   continue;
  }
  const reason=chronological?'HISTORICAL_PRICE_UPDATE_REQUIRES_REVIEW':'CONFLICTING_PRICE_CHRONOLOGY_UNKNOWN';
  for(const e of group)issues.push({offer_ref:e.offer_ref,field:'price',reason});
 }
 return {issues,events:events.map(({offer_ref,source_ref,scope_verified})=>({offer_ref,source_ref,scope_verified})),
   unbound_partial_updates:partialUpdates.length,partial_update_sources:[...new Set(partialUpdates.map(x=>x.source_ref))],
   chronological_authority:false,selected_latest_offer_ref:null};
}
module.exports={temporalDiagnostics,messages,detectUnboundPartialUpdates};
