'use strict';

const zlib = require('node:zlib');

const DEFAULT_LIMITS = Object.freeze({
  maxArchiveBytes: 25 * 1024 * 1024,
  maxEntries: 4096,
  maxEntryUncompressedBytes: 25 * 1024 * 1024,
  maxTotalUncompressedBytes: 100 * 1024 * 1024
});

function zipError(reason, message) {
  const error = new Error(message);
  error.code = 'PARSER_FAILURE';
  error.reason = reason;
  return error;
}

function asBuffer(input) {
  if (Buffer.isBuffer(input)) return input;
  if (input instanceof Uint8Array) return Buffer.from(input.buffer, input.byteOffset, input.byteLength);
  if (input instanceof ArrayBuffer) return Buffer.from(input);
  throw zipError('SOURCE_BINARY_REQUIRED', 'XLSX exige bytes binarios');
}

function safeEntryName(name) {
  if (!name || name.includes('\0')) return false;
  const normalized = name.replace(/\\/g, '/');
  if (normalized.startsWith('/') || /^[A-Za-z]:\//.test(normalized)) return false;
  const parts = normalized.split('/');
  return !parts.some(part => part === '..');
}

function decodeFilename(bytes, utf8) {
  if (!utf8 && bytes.some(byte => byte >= 0x80)) {
    throw zipError('NON_UTF8_FILENAME', 'nome ZIP nao ASCII sem flag UTF-8');
  }
  const name = bytes.toString('utf8');
  if (!safeEntryName(name)) throw zipError('UNSAFE_ENTRY_PATH', 'path inseguro no XLSX');
  return name.replace(/\\/g, '/');
}

function hasZip64Extra(extra) {
  let offset = 0;
  while (offset + 4 <= extra.length) {
    const id = extra.readUInt16LE(offset);
    const size = extra.readUInt16LE(offset + 2);
    offset += 4;
    if (offset + size > extra.length) throw zipError('MALFORMED_EXTRA', 'extra field ZIP invalido');
    if (id === 0x0001) return true;
    offset += size;
  }
  if (offset !== extra.length) throw zipError('MALFORMED_EXTRA', 'extra field ZIP truncado');
  return false;
}

let CRC_TABLE = null;
function crc32(buffer) {
  if (!CRC_TABLE) {
    CRC_TABLE = Array.from({ length: 256 }, (_, n) => {
      let c = n;
      for (let k = 0; k < 8; k += 1) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
      return c >>> 0;
    });
  }
  let crc = 0xFFFFFFFF;
  for (const byte of buffer) crc = CRC_TABLE[(crc ^ byte) & 0xFF] ^ (crc >>> 8);
  return (crc ^ 0xFFFFFFFF) >>> 0;
}

function findEocd(buffer) {
  const minimum = Math.max(0, buffer.length - 65557);
  for (let offset = buffer.length - 22; offset >= minimum; offset -= 1) {
    if (buffer.readUInt32LE(offset) === 0x06054b50) return offset;
  }
  throw zipError('EOCD_NOT_FOUND', 'fim do ZIP nao encontrado');
}

function readZipEntries(input, customLimits = {}) {
  const buffer = asBuffer(input);
  const limits = { ...DEFAULT_LIMITS, ...customLimits };
  if (buffer.length > limits.maxArchiveBytes) throw zipError('ARCHIVE_TOO_LARGE', 'XLSX excede limite comprimido');
  if (buffer.length < 22) throw zipError('ZIP_TRUNCATED', 'XLSX/ZIP truncado');

  const eocd = findEocd(buffer);
  const disk = buffer.readUInt16LE(eocd + 4);
  const centralDisk = buffer.readUInt16LE(eocd + 6);
  const entriesDisk = buffer.readUInt16LE(eocd + 8);
  const entriesTotal = buffer.readUInt16LE(eocd + 10);
  const centralSize = buffer.readUInt32LE(eocd + 12);
  const centralOffset = buffer.readUInt32LE(eocd + 16);
  const commentLength = buffer.readUInt16LE(eocd + 20);

  if (eocd + 22 + commentLength !== buffer.length) throw zipError('ZIP_TRAILING_DATA', 'dados apos EOCD nao permitidos');
  if (disk !== 0 || centralDisk !== 0 || entriesDisk !== entriesTotal) throw zipError('MULTI_DISK_UNSUPPORTED', 'ZIP multi-disco nao suportado');
  if (entriesTotal === 0xFFFF || centralSize === 0xFFFFFFFF || centralOffset === 0xFFFFFFFF) {
    throw zipError('ZIP64_UNSUPPORTED', 'ZIP64 nao suportado');
  }
  if (entriesTotal > limits.maxEntries) throw zipError('TOO_MANY_ENTRIES', 'XLSX possui entradas demais');
  if (centralOffset + centralSize > eocd) throw zipError('CENTRAL_DIRECTORY_INVALID', 'diretorio central invalido');

  let pointer = centralOffset;
  let totalUncompressed = 0;
  const entries = new Map();

  for (let index = 0; index < entriesTotal; index += 1) {
    if (pointer + 46 > buffer.length || buffer.readUInt32LE(pointer) !== 0x02014b50) {
      throw zipError('CENTRAL_ENTRY_INVALID', 'entrada de diretorio central invalida');
    }
    const flags = buffer.readUInt16LE(pointer + 8);
    const method = buffer.readUInt16LE(pointer + 10);
    const crc = buffer.readUInt32LE(pointer + 16);
    const compressedSize = buffer.readUInt32LE(pointer + 20);
    const uncompressedSize = buffer.readUInt32LE(pointer + 24);
    const nameLength = buffer.readUInt16LE(pointer + 28);
    const extraLength = buffer.readUInt16LE(pointer + 30);
    const fileCommentLength = buffer.readUInt16LE(pointer + 32);
    const diskStart = buffer.readUInt16LE(pointer + 34);
    const localOffset = buffer.readUInt32LE(pointer + 42);
    const end = pointer + 46 + nameLength + extraLength + fileCommentLength;
    if (end > buffer.length) throw zipError('CENTRAL_ENTRY_TRUNCATED', 'entrada ZIP truncada');
    if (diskStart !== 0) throw zipError('MULTI_DISK_UNSUPPORTED', 'entrada em outro disco');
    if (flags & 0x0001) throw zipError('ENCRYPTED_ENTRY', 'XLSX criptografado nao suportado');
    if (![0, 8].includes(method)) throw zipError('COMPRESSION_UNSUPPORTED', 'metodo ZIP nao suportado');
    if (compressedSize === 0xFFFFFFFF || uncompressedSize === 0xFFFFFFFF || localOffset === 0xFFFFFFFF) {
      throw zipError('ZIP64_UNSUPPORTED', 'entrada ZIP64 nao suportada');
    }
    if (uncompressedSize > limits.maxEntryUncompressedBytes) throw zipError('ENTRY_TOO_LARGE', 'entrada XLSX excede limite');
    totalUncompressed += uncompressedSize;
    if (totalUncompressed > limits.maxTotalUncompressedBytes) throw zipError('ARCHIVE_EXPANSION_TOO_LARGE', 'XLSX excede limite descomprimido');

    const nameBytes = buffer.subarray(pointer + 46, pointer + 46 + nameLength);
    const extra = buffer.subarray(pointer + 46 + nameLength, pointer + 46 + nameLength + extraLength);
    if (hasZip64Extra(extra)) throw zipError('ZIP64_UNSUPPORTED', 'ZIP64 extra field nao suportado');
    const name = decodeFilename(nameBytes, Boolean(flags & 0x0800));
    if (entries.has(name)) throw zipError('DUPLICATE_ENTRY', 'entrada ZIP duplicada');

    if (localOffset + 30 > buffer.length || buffer.readUInt32LE(localOffset) !== 0x04034b50) {
      throw zipError('LOCAL_HEADER_INVALID', 'header local ZIP invalido');
    }
    const localFlags = buffer.readUInt16LE(localOffset + 6);
    const localMethod = buffer.readUInt16LE(localOffset + 8);
    const localNameLength = buffer.readUInt16LE(localOffset + 26);
    const localExtraLength = buffer.readUInt16LE(localOffset + 28);
    if (localFlags !== flags || localMethod !== method) throw zipError('HEADER_MISMATCH', 'header local diverge do diretorio central');
    const localNameStart = localOffset + 30;
    const localNameEnd = localNameStart + localNameLength;
    const dataStart = localNameEnd + localExtraLength;
    if (dataStart + compressedSize > buffer.length) throw zipError('ENTRY_TRUNCATED', 'dados ZIP truncados');
    const localName = decodeFilename(buffer.subarray(localNameStart, localNameEnd), Boolean(flags & 0x0800));
    if (localName !== name) throw zipError('FILENAME_MISMATCH', 'nome do header local diverge');

    const compressed = buffer.subarray(dataStart, dataStart + compressedSize);
    let data;
    try {
      data = method === 0
        ? Buffer.from(compressed)
        : zlib.inflateRawSync(compressed, { maxOutputLength: limits.maxEntryUncompressedBytes });
    } catch (cause) {
      const error = zipError('DECOMPRESSION_FAILED', 'falha ao descomprimir XLSX');
      error.cause = cause;
      throw error;
    }
    if (data.length !== uncompressedSize) throw zipError('SIZE_MISMATCH', 'tamanho descomprimido divergente');
    if (crc32(data) !== crc) throw zipError('CRC_MISMATCH', 'CRC32 da entrada XLSX diverge');

    entries.set(name, data);
    pointer = end;
  }

  if (pointer !== centralOffset + centralSize) throw zipError('CENTRAL_SIZE_MISMATCH', 'tamanho do diretorio central divergente');
  return { entries, stats: { entry_count: entries.size, compressed_bytes: buffer.length, uncompressed_bytes: totalUncompressed } };
}

module.exports = { DEFAULT_LIMITS, asBuffer, crc32, readZipEntries };
