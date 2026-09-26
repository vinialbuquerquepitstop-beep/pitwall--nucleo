'use strict';
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert');
const { crc32, readZipEntries } = require('./xlsx-zip-reader');
const { safeXml } = require('./xlsx-xml');
const { parseXlsxSource } = require('./xlsx-adapter');
const MIME = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

let checks=0;
function check(name,fn){fn();checks+=1;console.log('OK '+checks+' - '+name);}
function fixture(){return Buffer.from(fs.readFileSync(path.join(__dirname,'fixtures','xlsx-multi-sheet.base64.txt'),'utf8').trim(),'base64');}

function storedZip(entries, options={}) {
  const locals=[]; const centrals=[]; let offset=0;
  for (const entry of entries) {
    const nameBuf=Buffer.from(entry.name,'utf8'); const data=Buffer.from(entry.data||'','utf8');
    const crc=(entry.badCrc ? (crc32(data)^1) : crc32(data))>>>0; const flags=(entry.flags||0)|0x0800;
    const local=Buffer.alloc(30+nameBuf.length+data.length);
    local.writeUInt32LE(0x04034b50,0); local.writeUInt16LE(20,4); local.writeUInt16LE(flags,6); local.writeUInt16LE(0,8);
    local.writeUInt32LE(crc,14); local.writeUInt32LE(data.length,18); local.writeUInt32LE(data.length,22);
    local.writeUInt16LE(nameBuf.length,26); nameBuf.copy(local,30); data.copy(local,30+nameBuf.length); locals.push(local);
    const central=Buffer.alloc(46+nameBuf.length); central.writeUInt32LE(0x02014b50,0); central.writeUInt16LE(20,4); central.writeUInt16LE(20,6);
    central.writeUInt16LE(flags,8); central.writeUInt16LE(0,10); central.writeUInt32LE(crc,16); central.writeUInt32LE(data.length,20); central.writeUInt32LE(data.length,24);
    central.writeUInt16LE(nameBuf.length,28); central.writeUInt32LE(offset,42); nameBuf.copy(central,46); centrals.push(central); offset += local.length;
  }
  const centralBuf=Buffer.concat(centrals); const localBuf=Buffer.concat(locals); const eocd=Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50,0); eocd.writeUInt16LE(entries.length,8); eocd.writeUInt16LE(entries.length,10);
  eocd.writeUInt32LE(centralBuf.length,12); eocd.writeUInt32LE(localBuf.length,16);
  return Buffer.concat([localBuf,centralBuf,eocd]);
}

check('XlsxAdapter preserva workbook multi-sheet, ordem e provenance',()=>{
 const d=parseXlsxSource({filename:'fixture.xlsx',mime_type:MIME,content:fixture()},{idFactory:()=> 'doc-xlsx'});
 assert.strictEqual(d.document_id,'doc-xlsx'); assert.strictEqual(d.blocks.length,6);
 assert.strictEqual(d.blocks[0].text,'IPHONE 16 PRO MAX\t256GB\t7499.90');
 assert.strictEqual(d.blocks[0].cells[2].raw,'7499.90');
 assert.strictEqual(d.blocks[0].provenance.source_ref,'Tabela!R1');
 assert.strictEqual(d.blocks[5].provenance.sheet,'Secundária');
 assert.strictEqual(d.blocks[5].cells[0].raw,'Outro & item');
});

check('shared strings rich text, gaps, empty row e merged cells sao preservados',()=>{
 const d=parseXlsxSource({filename:'fixture.xlsx',mime_type:MIME,content:fixture()},{idFactory:()=> 'doc-structure'});
 assert.strictEqual(d.blocks[1].text,'Azul / Preto\t\tlacrado');
 assert.strictEqual(d.blocks[3].text,'');
 assert.deepStrictEqual(d.metadata.sheets[0].merged_cells,['A3:B3']);
 assert.strictEqual(d.metadata.sheets[1].state,'hidden');
});

check('formula e preservada mas nunca executada',()=>{
 const d=parseXlsxSource({filename:'fixture.xlsx',mime_type:MIME,content:fixture()},{idFactory:()=> 'doc-formula'});
 const c=d.blocks[4].cells[0]; assert.strictEqual(c.formula,'1+2'); assert.strictEqual(c.raw,'3');
 assert(d.warnings.some(w=>w.code==='FORMULA_NOT_EVALUATED'));
});

check('source hash e archive stats existem',()=>{
 const d=parseXlsxSource({filename:'fixture.xlsx',mime_type:MIME,content:fixture()},{idFactory:()=> 'doc-hash'});
 assert.match(d.source.content_hash,/^sha256:[a-f0-9]{64}$/); assert(d.metadata.archive.entry_count>=7); assert(d.metadata.archive.uncompressed_bytes>0);
});

check('limite de archive falha fechado antes do parse',()=>{
 const bytes=fixture();
 assert.throws(()=>parseXlsxSource({filename:'fixture.xlsx',mime_type:MIME,content:bytes},{idFactory:()=> 'doc-limit',limits:{maxArchiveBytes:bytes.length-1}}),e=>e.code==='PARSER_FAILURE'&&e.reason==='ARCHIVE_TOO_LARGE');
});

check('ZIP path traversal e rejeitado',()=>{
 const z=storedZip([{name:'../evil.xml',data:'x'}]);
 assert.throws(()=>readZipEntries(z),e=>e.code==='PARSER_FAILURE'&&e.reason==='UNSAFE_ENTRY_PATH');
});

check('ZIP criptografado e rejeitado',()=>{
 const z=storedZip([{name:'safe.xml',data:'x',flags:1}]);
 assert.throws(()=>readZipEntries(z),e=>e.code==='PARSER_FAILURE'&&e.reason==='ENCRYPTED_ENTRY');
});

check('CRC divergente e rejeitado',()=>{
 const z=storedZip([{name:'safe.xml',data:'x',badCrc:true}]);
 assert.throws(()=>readZipEntries(z),e=>e.code==='PARSER_FAILURE'&&e.reason==='CRC_MISMATCH');
});

check('XML DTD/ENTITY e rejeitado',()=>{
 assert.throws(()=>safeXml(Buffer.from('<?xml version="1.0"?><!DOCTYPE x [<!ENTITY boom "x">]><x>&boom;</x>'),'evil'),e=>e.code==='PARSER_FAILURE'&&e.reason==='XML_DTD_FORBIDDEN');
});

check('input nao-binario falha como SOURCE_CORRUPTED',()=>{
 assert.throws(()=>parseXlsxSource({filename:'bad.xlsx',mime_type:MIME,content:'nao-binario'},{idFactory:()=> 'doc-bad'}),e=>e.code==='SOURCE_CORRUPTED');
});

console.log('EXTERNAL_CALC_UNIVERSAL_INPUT_B5_XLSX=PASS checks='+checks);
