'use strict';
const assert=require('node:assert/strict');
const {unpackOriginalZip}=require('./original-zip-unpacker');
function crc32(buffer){
 let crc=0xffffffff;
 for(const b of buffer){crc^=b;for(let k=0;k<8;k++)crc=(crc&1)?(0xedb88320^(crc>>>1)):(crc>>>1)}
 return (crc^0xffffffff)>>>0;
}
function storedZip(files){
 const chunks=[],central=[];let offset=0;
 for(const [name,text] of files){
  const filename=Buffer.from(name,'utf8'),data=Buffer.from(text,'utf8'),crc=crc32(data);
  const local=Buffer.alloc(30);
  local.writeUInt32LE(0x04034b50,0);local.writeUInt16LE(20,4);local.writeUInt16LE(0x0800,6);
  local.writeUInt32LE(crc,14);local.writeUInt32LE(data.length,18);local.writeUInt32LE(data.length,22);
  local.writeUInt16LE(filename.length,26);
  chunks.push(local,filename,data);
  const dir=Buffer.alloc(46);
  dir.writeUInt32LE(0x02014b50,0);dir.writeUInt16LE(20,4);dir.writeUInt16LE(20,6);
  dir.writeUInt16LE(0x0800,8);dir.writeUInt32LE(crc,16);dir.writeUInt32LE(data.length,20);
  dir.writeUInt32LE(data.length,24);dir.writeUInt16LE(filename.length,28);dir.writeUInt32LE(offset,42);
  central.push(dir,filename);offset+=local.length+filename.length+data.length;
 }
 const dirBytes=Buffer.concat(central);
 const tail=Buffer.alloc(22);tail.writeUInt32LE(0x06054b50,0);
 tail.writeUInt16LE(files.length,8);tail.writeUInt16LE(files.length,10);
 tail.writeUInt32LE(dirBytes.length,12);tail.writeUInt32LE(offset,16);
 return Buffer.concat([...chunks,dirBytes,tail]).toString('base64');
}
const input=storedZip([['_chat.txt','[12/11/26, 12:00] Quality: iPhone 17 256GB Azul R$ 5.399,99'],['media.jpg','binary-photo']]);
const result=unpackOriginalZip(input);
assert.equal(result.read_only,true);
assert.equal(result.original_sources.length,1);
assert.equal(result.original_sources[0].source_ref,'zip:_chat.txt');
assert.ok(result.original_sources[0].text.includes('5.399,99'));
assert.equal(result.skipped.length,1);
assert.equal(result.coverage_warning,true);
assert.throws(()=>unpackOriginalZip('bad!!!'),e=>e.code==='AI_ZIP_INVALID');
const bad=storedZip([['../escape.txt','iPhone 17 R$ 5000']]);
assert.throws(()=>unpackOriginalZip(bad),e=>e.reason==='UNSAFE_ENTRY_PATH');
console.log('EXTERNAL_AI_ORIGINAL_ZIP_READONLY=PASS',7);
