'use strict';
const assert=require('node:assert/strict');
const {processListIntakeCommand}=require('./list-intake-api');
const {buildQueue}=require('./list-intake-api');

// Regression smoke: source identity stays deterministic for a fixed document.
const raw={content:'iPhone 17 Pro 256GB\nR$ 6.850,00',filename:'lista.txt'};
const one=buildQueue(raw),two=buildQueue(raw);
assert.equal(one.source_id,two.source_id);
assert.equal(one.analysis_id,two.analysis_id);
console.log('INTAKE_BOUNDED_PAGING_SOURCE_IDENTITY=PASS');
