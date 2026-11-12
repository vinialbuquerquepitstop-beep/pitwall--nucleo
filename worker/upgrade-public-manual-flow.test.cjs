'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const {readFileSync} = require('node:fs');
const {join} = require('node:path');
const html = readFileSync(join(__dirname,'../../public/upgrade/index.html'),'utf8');

test('Upgrade starts in manual capture mode without a non-operational catalog request',()=>{
 assert.match(html,/manualCatalog\(\);\s*<\/script>/);
 assert.doesNotMatch(html,/refresh\(\);\s*loadCatalog\(\);\s*<\/script>/);
 assert.match(html,/function manualCatalog\(\)/);
});
test('public submission still targets V2 endpoint with stable request key',()=>{
 assert.match(html,/post\('\/api\/upgrade\/v1\/lead',\{request_key:requestKey,selection,contact,consent:true\}\)/);
 assert.match(html,/const requestKey=crypto\.randomUUID\(\)/);
 assert.match(html,/Não foi possível confirmar o recebimento/);
});
test('financial quote UI remains disabled without approved pricing',()=>{
 assert.match(html,/id="simulate"[^>]+disabled/);
 assert.match(html,/A cotação automática da Calculadora Pitwall V2 ainda não está disponível/);
});
