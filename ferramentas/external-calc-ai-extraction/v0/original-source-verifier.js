'use strict';
const {parseExternalAiExtraction}=require('./portable-extraction-validator');
const MAX_ORIGINAL_BYTES=2*1024*1024;
function fail(code,message){throw Object.assign(new Error(message),{code,status:422})}
function verifyOriginalSources(extraction, original_sources){
 if(!Array.isArray(original_sources)||original_sources.length!==extraction.sources.length)
  fail('AI_ORIGINAL_SOURCE_REQUIRED','Forneca um arquivo/texto original independente para cada source_ref');
 const found=new Map();
 let total=0;
 for(const source of original_sources){
  if(!source||typeof source!=='object'||Array.isArray(source)||
    Object.keys(source).sort().join(',')!=='source_ref,text'||
    typeof source.source_ref!=='string'||typeof source.text!=='string')
    fail('AI_ORIGINAL_SOURCE_INVALID','Fonte original invalida');
  if(found.has(source.source_ref))fail('AI_ORIGINAL_SOURCE_DUPLICATE','source_ref original repetido');
  total+=Buffer.byteLength(source.text,'utf8');
  if(total>MAX_ORIGINAL_BYTES)fail('AI_ORIGINAL_SOURCE_TOO_LARGE','Fontes originais excedem 2MB');
  found.set(source.source_ref,source.text);
 }
 for(const source of extraction.sources){
  if(!found.has(source.source_ref))
   fail('AI_ORIGINAL_SOURCE_MISSING','source_ref original ausente');
  // Exact equality is intentional. AI-created/trimmed/excerpted originals do
  // NOT establish provenance. The operator supplies the actual raw source.
  // Any mismatch is a hard stop, never soft confidence scoring.
  if(found.get(source.source_ref)!==source.text)
   fail('AI_ORIGINAL_SOURCE_MISMATCH','Fonte original nao confere com o texto devolvido pela IA');
 }
 return {verified:true,source_count:found.size,original_bytes:total};
}
function verifyPortableAiInput(input){
 if(!input||typeof input!=='object'||Array.isArray(input)||
   Object.keys(input).sort().join(',')!=='extraction,original_sources')
   fail('AI_ORIGINAL_SOURCE_REQUIRED','Envelope deve conter extraction e original_sources');
 const extraction=parseExternalAiExtraction(input.extraction);
 const origin=verifyOriginalSources(extraction,input.original_sources);
 return {...extraction,original_sources_verified:origin.verified,original_source_count:origin.source_count};
}
module.exports={verifyOriginalSources,verifyPortableAiInput};
