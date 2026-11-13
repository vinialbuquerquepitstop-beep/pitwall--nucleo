'use strict';
// Read-only unpacking of small operator-supplied WhatsApp ZIP exports.
// Reuse existing ZIP reader's ZIP64, traversal, CRC and bomb defenses.
const {TextDecoder}=require('node:util');
const {readZipEntries}=require('../../external-calc-universal-input/v1/xlsx-zip-reader');
const LIMITS=Object.freeze({
 maxArchiveBytes:2*1024*1024,
 maxEntries:32,
 maxEntryUncompressedBytes:1024*1024,
 maxTotalUncompressedBytes:1024*1024
});
function fail(code,message){throw Object.assign(new Error(message),{code,status:422})}
function unpackOriginalZip(base64){
 if(typeof base64!=='string'||base64.length>2*1024*1024*1.4||
   !/^[A-Za-z0-9+/]+={0,2}$/.test(base64))
   fail('AI_ZIP_INVALID','ZIP original precisa ser base64 valido ate 2MB');
 const bytes=Buffer.from(base64,'base64');
 if(bytes.length>LIMITS.maxArchiveBytes||bytes.length<22)
  fail('AI_ZIP_TOO_LARGE','ZIP original fora do limite');
 const parsed=readZipEntries(bytes,LIMITS);
 const original_sources=[],skipped=[];
 // Match the portable validator: a source text must fit 200,000 JS characters
 // and its source_ref must fit 100. Reject rather than truncating evidence.
 const decode=new TextDecoder('utf-8',{fatal:true});
 for(const [path,content] of parsed.entries){
  const lower=path.toLowerCase();
  if(lower.endsWith('/'))continue;
  if(lower.startsWith('__macosx/')||lower.endsWith('/.ds_store'))continue;
  if(!lower.endsWith('.txt')&&!lower.endsWith('.csv')){
   skipped.push({filename:path,reason:'UNSUPPORTED_ENTRY'});
   continue;
  }
  if(content.length===0||content.includes(0)){
   skipped.push({filename:path,reason:'EMPTY_OR_BINARY'});
   continue;
  }
  let text;
  try{text=decode.decode(content)}catch{
   skipped.push({filename:path,reason:'NON_UTF8_TEXT'});
   continue;
  }
  if(!text.trim()){skipped.push({filename:path,reason:'EMPTY_TEXT'});continue}
  if(text.length>200000)fail('AI_ZIP_SOURCE_TOO_LARGE','Um texto ZIP excede os 200 mil caracteres aceitos na validacao');
  if(('zip:'+path).length>100||path.length>180)
   fail('AI_ZIP_SOURCE_REF_TOO_LONG','O caminho interno ZIP excede o limite de referencia da fonte');
  original_sources.push({source_ref:'zip:'+path,text});
 }
 if(!original_sources.length)fail('AI_ZIP_NO_READABLE_TEXT','ZIP sem TXT/CSV legivel em UTF-8');
 return {original_sources,skipped,coverage_warning:skipped.length>0,
  read_only:true,source_ref_rule:'zip:<path-in-archive>'};
}
module.exports={LIMITS,unpackOriginalZip};
