'use strict';

const assert = require('node:assert/strict');
const { crc32 } = require('../../external-calc-universal-input/v1/xlsx-zip-reader');
const {
  normalizeText,
  candidateSupplierHeader,
  splitWhatsAppExport,
  looksLikeSupplierList,
  resolveExistingSupplier,
  processBatch
} = require('./batch-list-intake-api');

function u16(value) {
  const b = Buffer.alloc(2);
  b.writeUInt16LE(value);
  return b;
}
function u32(value) {
  const b = Buffer.alloc(4);
  b.writeUInt32LE(value >>> 0);
  return b;
}

function makeStoredZip(entries) {
  const locals = [];
  const centrals = [];
  let offset = 0;

  for (const [name, raw] of entries) {
    const nameBytes = Buffer.from(name, 'utf8');
    const data = Buffer.isBuffer(raw) ? raw : Buffer.from(raw, 'utf8');
    const crc = crc32(data);

    const local = Buffer.concat([
      u32(0x04034b50),
      u16(20),
      u16(0x0800),
      u16(0),
      u16(0),
      u16(0),
      u32(crc),
      u32(data.length),
      u32(data.length),
      u16(nameBytes.length),
      u16(0),
      nameBytes,
      data
    ]);

    const central = Buffer.concat([
      u32(0x02014b50),
      u16(20),
      u16(20),
      u16(0x0800),
      u16(0),
      u16(0),
      u16(0),
      u32(crc),
      u32(data.length),
      u32(data.length),
      u16(nameBytes.length),
      u16(0),
      u16(0),
      u16(0),
      u16(0),
      u32(0),
      u32(offset),
      nameBytes
    ]);

    locals.push(local);
    centrals.push(central);
    offset += local.length;
  }

  const centralBlock = Buffer.concat(centrals);
  const localBlock = Buffer.concat(locals);
  const eocd = Buffer.concat([
    u32(0x06054b50),
    u16(0),
    u16(0),
    u16(entries.length),
    u16(entries.length),
    u32(centralBlock.length),
    u32(localBlock.length),
    u16(0)
  ]);

  return Buffer.concat([localBlock, centralBlock, eocd]);
}

const realSupplier = {
  supplier_id: '11111111-1111-4111-8111-111111111111',
  name: 'Real Comércio',
  phone: '(21) 97171-9477',
  city: 'Rio de Janeiro'
};

const existingResolution = resolveExistingSupplier({
  filename: 'lista-real.txt',
  content: '*👑 REAL COMÉRCIO — ATACADO*\n📲 (21) 97171-9477\niPhone 15 128GB\nR$ 4.500,00',
  suppliers: [realSupplier]
});
assert.equal(existingResolution.state, 'MATCHED_EXISTING');
assert.equal(existingResolution.supplier.supplier_id, realSupplier.supplier_id);
assert.ok(existingResolution.confidence >= 0.96);

const candidate = candidateSupplierHeader(
  '*📦 QUALITY DISTRIBUIDORA — ATACADO*\n📲 (21) 98888-7777\niPhone 15 128GB\nR$ 4.400,00'
);
assert.equal(normalizeText(candidate.name), 'quality distribuidora');
assert.ok(candidate.confidence >= 0.95);
assert.equal(candidate.phone, '21988887777');

// Unknown supplier without contact/location must abstain: uppercase category/catalog titles are not a seller identity.
const unverifiedHeader = candidateSupplierHeader('GARMIN — TABELA ATUALIZADA\\n⌚ FENIX 9 43mm — R$ 5.950');
assert.ok(!unverifiedHeader || unverifiedHeader.confidence < 0.95);
const namedNoContact = candidateSupplierHeader('MEGA CENTER\\niPhone 18 Pro Max 256GB\\nPRETO 8.800');
assert.ok(namedNoContact && namedNoContact.confidence < 0.95);

const whatsappSample = [
  '[06/10/26, 02:11:19] Alb. : *👑 REAL COMÉRCIO — ATACADO*',
  '📲 (21) 97171-9477',
  'iPhone 15 128GB',
  '💵 R$ 4.500,00',
  '[06/10/26, 02:12:04] Alb. : ESTOQUE ATUALIZADO',
  'iPhone 16 128GB',
  '💵 R$ 3.550,00'
].join('\n');
const whatsappMessages = splitWhatsAppExport(whatsappSample);
assert.equal(whatsappMessages.length, 2);
assert.equal(whatsappMessages[0].sender, 'Alb.');
assert.match(whatsappMessages[0].content, /REAL COMÉRCIO/);
assert.equal(looksLikeSupplierList(whatsappMessages[0].content), true);
assert.equal(looksLikeSupplierList(whatsappMessages[1].content), true);
assert.equal(candidateSupplierHeader(whatsappMessages[1].content), null);

const realList = [
  '*👑 REAL COMÉRCIO — ATACADO*',
  '📍 Av. Rio Branco – Centro RJ',
  '📲 (21) 97171-9477',
  '',
  'iPhone 15 128GB',
  '🎨 Preto',
  '💵 R$ 4.500,00'
].join('\n');

const qualityList = [
  '*📦 QUALITY DISTRIBUIDORA — ATACADO*',
  '📍 Centro RJ',
  '📲 (21) 98888-7777',
  '',
  'iPhone 15 128GB',
  '🎨 Azul',
  '💵 R$ 4.400,00'
].join('\n');

const unknownList = [
  'iPhone 15 Pro 256GB',
  '🎨 Natural',
  '💵 R$ 5.900,00'
].join('\n');

const zip = makeStoredZip([
  ['real-comercio.txt', realList],
  ['quality.txt', qualityList],
  ['sem-fornecedor.txt', unknownList],
  ['_chat.txt', whatsappSample],
  ['foto.jpg', Buffer.from([0xff, 0xd8, 0xff, 0xd9])],
  ['outro-pacote.zip', Buffer.from('not-executed', 'utf8')]
]);

const calls = [];
const originalFetch = global.fetch;
global.fetch = async (url, init = {}) => {
  calls.push({ url: String(url), method: init.method || 'GET', body: init.body || null });

  if (String(url).includes('/rest/v1/extcalc_supplier?select=') && (init.method || 'GET') === 'GET') {
    return new Response(JSON.stringify([realSupplier]), {
      status: 200,
      headers: { 'content-type': 'application/json' }
    });
  }

  if (String(url).includes('/rest/v1/extcalc_supplier?select=') && init.method === 'POST') {
    const body = JSON.parse(init.body);
    assert.equal(body.name, 'QUALITY DISTRIBUIDORA');
    assert.equal(body.phone, '21988887777');
    return new Response(JSON.stringify([{
      supplier_id: '22222222-2222-4222-8222-222222222222',
      name: body.name,
      phone: body.phone,
      city: null
    }]), {
      status: 201,
      headers: { 'content-type': 'application/json' }
    });
  }

  if (String(url).includes('/rest/v1/rpc/extcalc_bind_source_supplier_v0')) {
    return new Response(JSON.stringify({ ok: true }), { status: 200, headers: { 'content-type': 'application/json' } });
  }
  if (String(url).includes('/rest/v1/rpc/extcalc_persist_review_candidate_v0')) {
    return new Response(JSON.stringify({ idempotent: false }), { status: 200, headers: { 'content-type': 'application/json' } });
  }
  if (String(url).includes('/rest/v1/rpc/extcalc_persist_auto_promoted_c01_v0')) {
    return new Response(JSON.stringify({ idempotent: false }), { status: 200, headers: { 'content-type': 'application/json' } });
  }

  throw new Error('unexpected fetch: ' + url);
};

(async () => {
  try {
    const result = await processBatch({
      env: {
        SUPABASE_URL: 'https://proof.supabase.co',
        SUPABASE_ANON_KEY: 'proof-anon'
      },
      token: 'proof-user-token',
      command: {
        filename: 'fornecedores.zip',
        mime_type: 'application/zip',
        bytes: zip
      }
    });

    assert.equal(result.contract_version, 'external-calc-batch-supplier-intake/v0');
    assert.equal(result.archive.entries_total, 6);
    assert.equal(result.summary.processed, 3);
    assert.equal(result.summary.review_required, 2);
    assert.equal(result.summary.auto_created_suppliers, 1);
    assert.equal(result.summary.skipped, 1);
    assert.equal(result.summary.rejected, 1);
    assert.ok(result.summary.candidates >= 3);

    const real = result.files.find((item) => item.filename === 'real-comercio.txt');
    assert.equal(real.status, 'PROCESSED');
    assert.equal(real.supplier.resolution, 'MATCHED_EXISTING');
    assert.equal(real.supplier.supplier_id, realSupplier.supplier_id);
    assert.ok(real.intake.source_id.startsWith('source_'));

    const quality = result.files.find((item) => item.filename === 'quality.txt');
    assert.equal(quality.status, 'PROCESSED');
    assert.equal(quality.supplier.resolution, 'AUTO_CREATED');
    assert.equal(quality.supplier.name, 'QUALITY DISTRIBUIDORA');

    const unknown = result.files.find((item) => item.filename === 'sem-fornecedor.txt');
    assert.equal(unknown.status, 'REVIEW_REQUIRED');
    assert.equal(unknown.intake, null);

    const chatReal = result.files.find((item) => item.path === '_chat.txt#message-1');
    assert.equal(chatReal.status, 'PROCESSED');
    assert.equal(chatReal.supplier.name, 'Real Comércio');
    assert.equal(chatReal.origin.transport, 'WHATSAPP_EXPORT');
    assert.equal(chatReal.origin.sender, 'Alb.');

    const chatUnknown = result.files.find((item) => item.path === '_chat.txt#message-2');
    assert.equal(chatUnknown.status, 'REVIEW_REQUIRED');
    assert.equal(chatUnknown.supplier, null);
    assert.equal(chatUnknown.supplier_candidate, null);
    assert.equal(chatUnknown.origin.transport, 'WHATSAPP_EXPORT');

    assert.equal(result.files.find((item) => item.filename === 'foto.jpg').status, 'SKIPPED_UNSUPPORTED');
    assert.equal(result.files.find((item) => item.filename === 'outro-pacote.zip').status, 'REJECTED_NESTED_ARCHIVE');

    assert.ok(calls.some((call) => call.url.includes('extcalc_bind_source_supplier_v0')));
    assert.ok(calls.some((call) => call.url.includes('extcalc_persist_review_candidate_v0')));

    console.log('EXTERNAL_CALC_BATCH_SUPPLIER_INTAKE_V0=PASS ' + JSON.stringify(result.summary));
  } finally {
    global.fetch = originalFetch;
  }
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
