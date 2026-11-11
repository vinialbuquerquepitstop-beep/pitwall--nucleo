'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
const {createHash}=require('node:crypto');
const manifest=require('./upgrade-v2-core/source-manifest.json');
test('direct-ingress snapshot matches canonical V2 pinned Git blobs',()=>{
 assert.equal(manifest.source,'vinialbuquerquepitstop-beep/pitswal-v2');
 assert.match(manifest.source_commit,/^[a-f0-9]{40}$/);
 const files=Object.entries(manifest.files);
 assert.equal(files.length,4);
 for(const [name,expectedSha] of files){
  const buf=fs.readFileSync(path.join(__dirname,'upgrade-v2-core',name));
  const gitSha=createHash('sha1').update('blob '+buf.length+'\0').update(buf).digest('hex');
  assert.equal(gitSha,expectedSha,name+' diverged from approved V2 source');
 }
});
test('single existing Worker never depends on a second Worker service or legacy DB',()=>{
 const script=fs.readFileSync(path.join(__dirname,'external-calc-worker.mjs'),'utf8');
 assert.match(script,/createUpgradeV2DirectIngress/);
 assert.doesNotMatch(script,/UPGRADE_V2_INGRESS_SERVICE|upgrade-v2-service-bridge|createUpgradeV1HyperdriveApplication/);
 const config=fs.readFileSync(path.join(__dirname,'..','wrangler.jsonc'),'utf8');
 assert.match(config,/"UPGRADE_V2_PUBLIC_ENABLED": "false"/);
 assert(!/"UPGRADE_V2_DB_INGRESS"\s*,\s*"id"/.test(config),'no invented private Hyperdrive ID');
});
