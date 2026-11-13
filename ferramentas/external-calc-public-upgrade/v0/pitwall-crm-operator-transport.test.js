'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {createPitwallCrmOperatorTransport,DENIED}=require('./pitwall-crm-operator-transport');
const tenantOrg='e7f2deaf-cc16-4df7-921a-539b6a27c8c0';
const id='a225c1a5-e844-4f44-8d72-08e31cd51240';
const phone='5521999999999';
const origin='https://pitwall-v2.supabase.co';
const requestId='930e39e4-6ee4-414a-861a-99c318bf40a6';
const lead={id,organization_id:tenantOrg,phone,notes:'Pitstop Upgrade V1 | Solicitacao: '+requestId+' | Novo: iPhone 17 Pro'};
const fail=e=>e.code===DENIED;
function fixture({responses=[],token='test-operator-access-token-with-valid-length'}={}){
 const calls=[];
 let i=0;
 const transport=createPitwallCrmOperatorTransport({
  enabled:true,supabaseUrl:origin,publishableKey:'anon-public-test',
  getOperatorAccessToken:async()=>token,
  fetchImpl:async(url,init)=>{
   calls.push({url,init});
   const r=responses[i++]??{ok:true,data:[]};
   return {ok:r.ok,status:r.status??200,json:async()=>r.data};
  }
 });
 return {transport,calls};
}
test('default off never reaches CRM',async()=>{
 await assert.rejects(createPitwallCrmOperatorTransport().findExistingLeads({organizationId:tenantOrg,whatsapp:phone}),fail);
});
test('uses authenticated bearer and organization/phone scoping',async()=>{
 const x=fixture({responses:[{ok:true,data:[lead]}]});
 const rows=await x.transport.findExistingLeads({organizationId:tenantOrg,whatsapp:phone});
 assert.deepEqual(rows,[lead]);
 assert(x.calls[0].url.startsWith(origin+'/rest/v1/pw_leads?'));
 const q=new URL(x.calls[0].url);
 assert.equal(q.searchParams.get('organization_id'),'eq.'+tenantOrg);
 assert.equal(q.searchParams.get('phone'),'eq.'+phone);
 assert.equal(q.searchParams.get('limit'),'3');
 assert.equal(x.calls[0].init.headers.authorization,'Bearer test-operator-access-token-with-valid-length');
 assert.equal(x.calls[0].init.redirect,'error');
});
test('canonical Pitwall RPC uses POST and no privileged service-role key',async()=>{
 const x=fixture({responses:[{ok:true,data:lead}]});
 const result=await x.transport.authenticatedOperatorRpc('pw_s01_create_lead',{
  p_org_id:tenantOrg,p_name:'Ana',p_phone:phone,p_context:{trade_intent:'yes'}
 });
 assert.equal(result.id,id);
 assert.equal(x.calls[0].init.method,'POST');
 assert.equal(x.calls[0].url,origin+'/rest/v1/rpc/pw_s01_create_lead');
 assert.equal(JSON.parse(x.calls[0].init.body).p_org_id,tenantOrg);
 assert.equal(x.calls[0].init.headers.apikey,'anon-public-test');
});
test('deny invalid operator token and invalid targets before network',async()=>{
 const x=fixture({token:''});
 await assert.rejects(x.transport.findExistingLeads({organizationId:tenantOrg,whatsapp:phone}),fail);
 assert.equal(x.calls.length,0);
 const y=fixture();
 await assert.rejects(y.transport.authenticatedOperatorRpc('other_rpc',{p_org_id:tenantOrg}),fail);
 await assert.rejects(y.transport.findExistingLeads({organizationId:'bad',whatsapp:phone}),fail);
 assert.equal(y.calls.length,0);
});
test('rejects duplicate ambiguity, foreign organization and failed HTTP',async()=>{
 for(const responses of [
  [{ok:true,data:[lead,lead,lead]}],
  [{ok:true,data:[{...lead,organization_id:'efbd5c32-e2d4-4adc-964e-40ea0eae9731'}]}],
  [{ok:false,status:401,data:{message:'denied'}}]
 ]){
  const x=fixture({responses});
  await assert.rejects(x.transport.findExistingLeads({organizationId:tenantOrg,whatsapp:phone}),fail);
 }
});
test('rejects malformed RPC response and untrusted transport origin',async()=>{
 const x=fixture({responses:[{ok:true,data:[lead]}]});
 await assert.rejects(x.transport.authenticatedOperatorRpc('pw_s01_create_lead',{p_org_id:tenantOrg,p_name:'Ana',p_phone:phone}),fail);
 assert.throws(()=>createPitwallCrmOperatorTransport({enabled:true,supabaseUrl:'http://example.com/',publishableKey:'anon',getOperatorAccessToken:async()=>''}),fail);
});
