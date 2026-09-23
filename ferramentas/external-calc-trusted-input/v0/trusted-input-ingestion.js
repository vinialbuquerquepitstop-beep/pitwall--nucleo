'use strict';

const crypto = require('crypto');

const VERSION = 'external-calc-trusted-input/v0';
const DEFAULT_LIMITS = Object.freeze({
  maxUploadBytes: 15 * 1024 * 1024,
  maxMemberBytes: 10 * 1024 * 1024,
  maxUncompressedBytes: 40 * 1024 * 1024,
  maxMembers: 50,
  maxCompressionRatio: 100
});

const BLOCKED_EXTENSIONS = new Set([
  '.exe','.dll','.com','.bat','.cmd','.ps1','.sh','.js','.mjs','.cjs','.jar','.msi','.scr','.app'
]);
const ARCHIVE_EXTENSIONS = new Set(['.zip','.rar','.7z','.tar','.gz','.tgz']);

function fail(code, message) {
  const error = new Error(message);
  error.code = code;
  throw error;
}

function cleanName(value) {
  const name = String(value || '').replace(/\\/g, '/');
  if (!name || name.startsWith('/') || /^[a-zA-Z]:\//.test(name)) fail('UNSAFE_PATH', 'caminho absoluto nao permitido');
  const parts = name.split('/');
  if (parts.some(part => part === '..')) fail('UNSAFE_PATH', 'path traversal nao permitido');
  return name;
}

function extension(name) {
  const leaf = name.toLowerCase().split('/').pop() || '';
  const index = leaf.lastIndexOf('.');
  return index >= 0 ? leaf.slice(index) : '';
}

function sha256(bytes) {
  return crypto.createHash('sha256').update(bytes).digest('hex');
}

function createTrustedInputIngestionV0(options = {}) {
  const repository = options.repository;
  const zipReader = options.zipReader;
  const limits = { ...DEFAULT_LIMITS, ...(options.limits || {}) };

  if (!repository || typeof repository.persistOriginal !== 'function' || typeof repository.persistSource !== 'function') {
    throw new Error('repository persistOriginal/persistSource obrigatorio');
  }

  async function persistSource({ tenantId, actorRef, ingestionId, filename, contentType, bytes, containerHash = null }) {
    const safeName = cleanName(filename);
    const ext = extension(safeName);
    if (BLOCKED_EXTENSIONS.has(ext)) fail('BLOCKED_FILE_TYPE', 'tipo de arquivo bloqueado');
    if (ARCHIVE_EXTENSIONS.has(ext)) fail('NESTED_ARCHIVE', 'arquivo compactado interno nao permitido');
    if (bytes.length > limits.maxMemberBytes) fail('MEMBER_TOO_LARGE', 'arquivo excede limite');
    const hash = sha256(bytes);
    const sourceId = `src_${hash}`;
    const trustedInputRef = `trusted:v0:${tenantId}:${sourceId}`;
    await repository.persistSource({
      version: VERSION, tenant_id: tenantId, actor_ref: actorRef, ingestion_id: ingestionId,
      source_id: sourceId, trusted_input_ref: trustedInputRef, filename: safeName,
      content_type: contentType || 'application/octet-stream', byte_length: bytes.length,
      sha256: hash, container_sha256: containerHash, bytes
    });
    return { source_id: sourceId, trusted_input_ref: trustedInputRef, filename: safeName, sha256: hash };
  }

  return {
    version: VERSION,
    async ingest(command) {
      if (!command || typeof command !== 'object') fail('INVALID_INPUT', 'command obrigatorio');
      const tenantId = String(command.tenant_id || '').trim();
      const actorRef = String(command.actor_ref || '').trim();
      if (!tenantId || !actorRef) fail('UNAUTHENTICATED', 'tenant e ator obrigatorios');
      const filename = cleanName(command.filename);
      const bytes = Buffer.isBuffer(command.bytes) ? command.bytes : Buffer.from(command.bytes || []);
      if (!bytes.length) fail('EMPTY_UPLOAD', 'arquivo vazio');
      if (bytes.length > limits.maxUploadBytes) fail('UPLOAD_TOO_LARGE', 'upload excede limite');

      const originalHash = sha256(bytes);
      const ingestionId = `ing_${originalHash}`;
      await repository.persistOriginal({
        version: VERSION, tenant_id: tenantId, actor_ref: actorRef, ingestion_id: ingestionId,
        filename, content_type: command.content_type || 'application/octet-stream',
        byte_length: bytes.length, sha256: originalHash, bytes
      });

      if (extension(filename) !== '.zip') {
        const source = await persistSource({
          tenantId, actorRef, ingestionId, filename, contentType: command.content_type, bytes
        });
        return { version: VERSION, ingestion_id: ingestionId, original_sha256: originalHash, status: 'READY', accepted: [source], rejected: [] };
      }

      if (!zipReader || typeof zipReader.read !== 'function') fail('ZIP_READER_REQUIRED', 'leitor ZIP seguro obrigatorio');
      const archive = await zipReader.read(bytes);
      if (archive.encrypted) fail('ENCRYPTED_ARCHIVE', 'ZIP criptografado nao suportado');
      const members = Array.isArray(archive.members) ? archive.members : [];
      if (members.length > limits.maxMembers) fail('TOO_MANY_MEMBERS', 'ZIP excede quantidade de arquivos');

      let total = 0;
      const accepted = [];
      const rejected = [];
      for (const member of members) {
        if (member.directory) continue;
        try {
          if (member.symlink) fail('SYMLINK_NOT_ALLOWED', 'symlink nao permitido');
          const memberName = cleanName(member.name);
          const compressed = Number(member.compressed_size || 0);
          const memberBytes = Buffer.isBuffer(member.bytes) ? member.bytes : Buffer.from(member.bytes || []);
          total += memberBytes.length;
          if (total > limits.maxUncompressedBytes) fail('ZIP_BOMB', 'ZIP excede limite descompactado');
          if (compressed > 0 && memberBytes.length / compressed > limits.maxCompressionRatio) fail('ZIP_BOMB', 'razao de compressao suspeita');
          accepted.push(await persistSource({
            tenantId, actorRef, ingestionId, filename: memberName,
            contentType: member.content_type, bytes: memberBytes, containerHash: originalHash
          }));
        } catch (error) {
          rejected.push({ filename: String(member.name || ''), code: error.code || 'REJECTED' });
        }
      }
      if (!accepted.length) fail('NO_SUPPORTED_SOURCE', 'ZIP sem fonte aceita');
      return { version: VERSION, ingestion_id: ingestionId, original_sha256: originalHash, status: rejected.length ? 'PARTIAL' : 'READY', accepted, rejected };
    }
  };
}

module.exports = { VERSION, DEFAULT_LIMITS, createTrustedInputIngestionV0 };
