'use strict';

const crypto = require('crypto');
const VERSION = 'external-calc-trusted-input-repository/v0';

function cloneWithoutBytes(value) {
  const copy = { ...value };
  delete copy.bytes;
  return copy;
}

function createInMemoryTrustedInputRepository() {
  const originals = new Map();
  const sources = new Map();

  return {
    async persistOriginal(row) {
      const key = `${row.tenant_id}:${row.ingestion_id}`;
      if (!originals.has(key)) originals.set(key, { ...row, bytes: Buffer.from(row.bytes) });
      return cloneWithoutBytes(originals.get(key));
    },
    async persistSource(row) {
      const key = `${row.tenant_id}:${row.source_id}`;
      const existing = sources.get(key);
      if (existing && existing.sha256 !== row.sha256) throw new Error('SOURCE_IMMUTABILITY_VIOLATION');
      if (!existing) sources.set(key, { ...row, bytes: Buffer.from(row.bytes) });
      return cloneWithoutBytes(sources.get(key));
    },
    async resolveSource({ tenant_id, source_id }) {
      const row = sources.get(`${tenant_id}:${source_id}`);
      return row ? { ...row, bytes: Buffer.from(row.bytes) } : null;
    },
    async loadOriginal({ tenant_id, ingestion_id }) {
      const row = originals.get(`${tenant_id}:${ingestion_id}`);
      return row ? { ...row, bytes: Buffer.from(row.bytes) } : null;
    }
  };
}

function parseTrustedRef(ref) {
  const match = /^trusted:v0:([^:]+):(src_[a-f0-9]{64})$/.exec(String(ref || ''));
  if (!match) throw new Error('trusted_input_ref invalido');
  return { tenant_id: match[1], source_id: match[2] };
}

function createTrustedInputResolverV0(options = {}) {
  const repository = options.repository;
  const schema = options.schema;
  const knowledge = options.knowledge || null;
  const supplierProfiles = options.supplier_profiles || null;
  if (!repository || typeof repository.resolveSource !== 'function') throw new Error('repository.resolveSource obrigatorio');
  if (!schema || typeof schema !== 'object') throw new Error('schema obrigatorio');

  return {
    version: VERSION,
    async resolve(command) {
      const identity = parseTrustedRef(command && command.trusted_input_ref);
      if (command.tenant_id && command.tenant_id !== identity.tenant_id) return null;
      const row = await repository.resolveSource(identity);
      if (!row) return null;
      const hash = crypto.createHash('sha256').update(row.bytes).digest('hex');
      if (hash !== row.sha256 || row.source_id !== `src_${hash}`) throw new Error('TRUSTED_INPUT_INTEGRITY_FAILURE');
      return {
        analysis_id: `analysis_${hash.slice(0, 24)}`,
        source_id: row.source_id,
        currency: 'BRL',
        document: {
          contract_version: 'raw-document/v1',
          document_id: `doc_${hash}`,
          content: row.bytes.toString('utf8')
        },
        schema,
        knowledge,
        supplier_profiles: supplierProfiles
      };
    }
  };
}

module.exports = { VERSION, createInMemoryTrustedInputRepository, createTrustedInputResolverV0 };
