'use strict';

const { spawnSync } = require('child_process');
const path = require('path');

const proofs = [
  'prova_core.js',
  'prova_cli.js',
  'prova_apple_domain.js',
  'prova_shadow_comparator.js',
  'prova_divergence_analyzer.js',
  'prova_offer_expansion_v1.js',
  'prova_real_shadow_semantic.js'
];

let passed = 0;

for (const proof of proofs) {
  const file = path.join(__dirname, proof);
  console.log(`\n===== ${proof} =====`);
  const result = spawnSync(process.execPath, [file], {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
    env: { PATH: process.env.PATH }
  });

  if (result.stdout) process.stdout.write(result.stdout);
  if (result.stderr) process.stderr.write(result.stderr);

  if (result.status !== 0) {
    console.error(`\nGATE_LOCAL=FAIL proof=${proof} exit=${result.status}`);
    process.exit(result.status || 1);
  }
  passed += 1;
}

console.log(`\nGATE_LOCAL=PASS proofs=${passed}/${proofs.length}`);
console.log('NEXT_GATE=REAL_CORPUS_SHADOW');
