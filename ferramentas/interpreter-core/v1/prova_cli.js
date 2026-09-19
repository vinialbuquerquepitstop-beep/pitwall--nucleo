'use strict';

const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

const cli = path.join(__dirname, 'cli.js');
const schema = path.join(__dirname, 'fixtures', 'generic-device-domain.json');
const knowledge = path.join(__dirname, 'fixtures', 'generic-device-knowledge.json');
const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'interpreter-cli-proof-'));
const input = path.join(tempDir, 'lista.txt');

let checks = 0;
function ok(condition, message) {
  assert.ok(condition, message);
  checks += 1;
}

try {
  fs.writeFileSync(input, 'DEVICE ALPHA16\n256GB\n6999\n', 'utf8');

  const result = spawnSync(process.execPath, [
    cli,
    '--input', input,
    '--schema', schema,
    '--knowledge', knowledge,
    '--document-id', 'cli-proof-001',
    '--compact'
  ], {
    encoding: 'utf8',
    env: { PATH: process.env.PATH }
  });

  assert.strictEqual(result.status, 0, result.stderr || 'CLI encerrou com erro');
  checks += 1;

  const bundle = JSON.parse(result.stdout);
  ok(bundle.contract_version === 'interpretation-bundle/v1', 'contrato de saida preservado');
  ok(bundle.records.length === 1, 'CLI materializa um registro');
  ok(bundle.records[0].fields.model.id === 'model-alpha16', 'modelo resolvido por fixture externa');
  ok(bundle.records[0].fields.capacity === 256, 'capacidade preservada');
  ok(bundle.records[0].fields.price === 6999, 'preco preservado');
  ok(bundle.run.invoked_via === 'interpreter-cli/v1', 'superficie CLI identificada');
  ok((bundle.warnings || []).includes('no_persistence'), 'CLI permanece sem persistencia');

  const noKnowledge = spawnSync(process.execPath, [
    cli,
    '--input', input,
    '--schema', schema,
    '--document-id', 'cli-proof-empty-knowledge',
    '--compact'
  ], { encoding: 'utf8' });

  assert.strictEqual(noKnowledge.status, 0, noKnowledge.stderr || 'CLI sem knowledge falhou');
  checks += 1;
  const unresolved = JSON.parse(noKnowledge.stdout);
  ok(Array.isArray(unresolved.ambiguities), 'sem knowledge, ambiguidade continua explicita');
  ok(unresolved.records.length === 0, 'sem knowledge, CLI nao inventa entidade');

  console.log(`PASSOU: ${checks} assercoes CLI V1`);
} finally {
  fs.rmSync(tempDir, { recursive: true, force: true });
}
