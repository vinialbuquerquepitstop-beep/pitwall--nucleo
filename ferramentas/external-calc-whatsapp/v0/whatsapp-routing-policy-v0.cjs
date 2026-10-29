'use strict';
// Pure routing policy only: server-owned identity inputs; no text inspection, storage or CRM writes.
const CONTRACT='pitstop-whatsapp-routing-decision/v0';
const outcomes=new Set(['SUPPLIER_EXTERNAL_CALC','CRM_CANDIDATE','HOLD_REVIEW','IGNORE']);
function decision({verifiedProvider=false,tenantAuthorized=false,identity=null,eventKind='text',crmEnabled=false,policyVersion='wm03-v0'}={}){
  let route='HOLD_REVIEW',reason='UNCLASSIFIED';
  if(!verifiedProvider){route='IGNORE';reason='UNVERIFIED_PROVIDER';}
  else if(!tenantAuthorized){route='IGNORE';reason='UNAUTHORIZED_TENANT';}
  else if(eventKind!=='text'){route='IGNORE';reason='UNSUPPORTED_EVENT';}
  else if(identity?.isSupplier===true && identity?.isCustomer===true){reason='DUAL_ROLE';}
  else if(identity?.isSupplier===true && identity?.supplierApproved===true){route='SUPPLIER_EXTERNAL_CALC';reason='APPROVED_SUPPLIER';}
  else if(identity?.isCustomer===true && crmEnabled===true){route='CRM_CANDIDATE';reason='KNOWN_CUSTOMER';}
  else if(identity?.isCustomer===true){reason='CRM_DISABLED';}
  if(!outcomes.has(route))throw new Error('INVALID_ROUTE');
  return Object.freeze({contract_version:CONTRACT,route,reason,policy_version:policyVersion});
}
module.exports={CONTRACT,decision};
