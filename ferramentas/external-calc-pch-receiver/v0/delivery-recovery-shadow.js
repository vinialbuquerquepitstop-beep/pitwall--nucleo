'use strict';
// G10 pure recovery decisions only. No network, retry loop or queue mutation.
const STATES=Object.freeze({CONFIRMED:'CONFIRMED',RECONCILE:'RECONCILE',HOLD:'HOLD'});
function decideAfterDispatch({transport,receipt}={}){
 if(!transport||!['RESPONSE','TIMEOUT','NETWORK_ERROR'].includes(transport.kind))return {state:STATES.HOLD,reason:'INVALID_TRANSPORT'};
 if(transport.kind!=='RESPONSE')return {state:STATES.RECONCILE,reason:'OUTCOME_UNKNOWN'};
 if(!Number.isInteger(transport.status)||transport.status<100||transport.status>599)return {state:STATES.HOLD,reason:'INVALID_HTTP'};
 if(transport.status>=200&&transport.status<300)return {state:STATES.RECONCILE,reason:'RECEIPT_VERIFICATION_REQUIRED'};
 if([408,429].includes(transport.status)||transport.status>=500)return {state:STATES.RECONCILE,reason:'POSSIBLE_ACCEPTANCE'};
 return {state:STATES.HOLD,reason:'REJECTED_OR_UNAUTHORIZED'};
}
function decideAfterLookup({lookup,recordMatches}={}){
 if(lookup==='ACCEPTED'&&recordMatches===true)return {state:STATES.CONFIRMED,reason:'DURABLE_RECEIPT_MATCH'};
 if(lookup==='CONFLICT')return {state:STATES.HOLD,reason:'IDENTITY_CONFLICT'};
 if(lookup==='NOT_FOUND')return {state:STATES.RECONCILE,reason:'ABSENCE_NOT_SAFE_TO_RETRY'};
 return {state:STATES.RECONCILE,reason:'LOOKUP_UNAVAILABLE'};
}
module.exports={STATES,decideAfterDispatch,decideAfterLookup};
