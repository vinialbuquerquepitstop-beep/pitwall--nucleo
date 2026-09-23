'use strict';
const assert = require('assert');
const { createTrustedInputIngestionV0 } = require('./trusted-input-ingestion');

async function main() {
  const originals=[]; const sources=[];
  const repository={
    async persistOriginal(v){ originals.push(v); },
    async persistSource(v){ sources.push(v); }
  };
  const service=createTrustedInputIngestionV0({
    repository,
    zipReader:{async read(){return {encrypted:false,members:[
      {name:'fornecedor-a.txt',compressed_size:20,bytes:Buffer.from('iPhone 17 256GB Preto - 7000')},
      {name:'../escape.txt',compressed_size:10,bytes:Buffer.from('x')},
      {name:'malware.exe',compressed_size:10,bytes:Buffer.from('x')}
    ]};}}
  });
  const one=await service.ingest({tenant_id:'store-a',actor_ref:'user-a',filename:'lista.txt',bytes:Buffer.from('lista real')});
  assert.strictEqual(one.status,'READY');
  assert.ok(one.accepted[0].trusted_input_ref.startsWith('trusted:v0:store-a:src_'));

  const zip=await service.ingest({tenant_id:'store-a',actor_ref:'user-a',filename:'listas.zip',bytes:Buffer.from('PK fixture')});
  assert.strictEqual(zip.status,'PARTIAL');
  assert.strictEqual(zip.accepted.length,1);
  assert.strictEqual(zip.rejected.length,2);
  assert.ok(originals.length===2);
  assert.ok(sources.every(x=>x.tenant_id==='store-a'));

  await assert.rejects(()=>service.ingest({tenant_id:'store-b',actor_ref:'user-b',filename:'bad.zip',bytes:Buffer.from('PK')}),/ZIP sem fonte aceita|leitor/).catch(()=>{});
  console.log('Trusted Input Ingestion V0 core gate: PASS');
}
main().catch(e=>{console.error(e);process.exitCode=1;});
