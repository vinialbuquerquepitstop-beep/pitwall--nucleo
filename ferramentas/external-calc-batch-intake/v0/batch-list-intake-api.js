'use strict';

const { TextDecoder } = require('node:util');
const { readZipEntries } = require('../../external-calc-universal-input/v1/xlsx-zip-reader');
const { processListIntakeCommand } = require('../../external-calc-list-intake/v0/list-intake-api');

const BATCH_LIST_INTAKE_PATH = '/api/external-calc/v0/batch-list-intake';
const API_VERSION = 'external-calc-batch-list-intake-api/v0';
const LIMITS = Object.freeze({
  maxArchiveBytes: 10 * 1024 * 1024,
  maxEntries: 64,
  maxEntryUncompressedBytes: 2 * 1024 * 1024,
  maxTotalUncompressedBytes: 24 * 1024 * 1024
});

function error(code, message, status = 400) {
  return Object.assign(new Error(message), { code, status });
}

function allowedOrigin(origin, env) {
  if (!origin) return null;
  const configured = new Set(String(env?.EXTCALC_ALLOWED_ORIGINS || '').split(',').map((x) => x.trim()).filter(Boolean));
  if (configured.has(origin)) return origin;
  if (/^https:\/\/external-calc-frontend-v1-preview(?:-[a-z0-9-]+)?\.vercel\.app$/i.test(origin)) return origin;
  if (origin === 'http://localhost:3000' || origin === 'http://127.0.0.1:3000') return origin;
  return null;
}

function headers(origin) {
  return {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store',
    ...(origin ? {
      'access-control-allow-origin': origin,
      'access-control-allow-methods': 'POST,OPTIONS',
      'access-control-allow-headers': 'authorization,content-type',
      'vary': 'Origin'
    } : {})
  };
}

function out(status, body, origin) {
  return new Response(JSON.stringify(body), { status, headers: headers(origin) });
}

function bearer(request) {
  const match = /^Bearer\s+(.+)$/i.exec(request.headers.get('authorization') || '');
  return match ? match[1].trim() : '';
}

function normalizeBody(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw error('BATCH_INTAKE_INVALID', 'body invalido');
  const allowed = new Set(['filename', 'mime_type', 'content_base64']);
  for (const key of Object.keys(value)) if (!allowed.has(key)) throw error('BATCH_INTAKE_INVALID', 'campo nao permitido: ' + key);

  const filename = typeof value.filename === 'string' && value.filename.trim() ? value.filename.trim() : 'listas.zip';
  if (filename.length > 180 || !filename.toLowerCase().endsWith('.zip')) throw error('BATCH_INTAKE_INVALID', 'arquivo .zip obrigatorio');

  const mimeType = typeof value.mime_type === 'string' ? value.mime_type.trim().toLowerCase() : 'application/zip';
  if (!['application/zip', 'application/x-zip-compressed', 'application/octet-stream'].includes(mimeType)) {
    throw error('BATCH_INTAKE_INVALID', 'mime_type de ZIP invalido');
  }

  const base64 = typeof value.content_base64 === 'string' ? value.content_base64.trim() : '';
  if (!base64 || !/^[A-Za-z0-9+/]+={0,2}$/.test(base64)) throw error('BATCH_INTAKE_INVALID', 'ZIP base64 invalido');
  const bytes = Buffer.from(base64, 'base64');
  if (!bytes.length) throw error('BATCH_INTAKE_INVALID', 'ZIP vazio');
  if (bytes.length > LIMITS.maxArchiveBytes) throw error('BATCH_INTAKE_TOO_LARGE', 'ZIP excede 10 MB', 413);

  return { filename, mime_type: mimeType, bytes };
}

function normalizeText(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase('pt-BR')
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function cleanHeaderLine(value) {
  return String(value || '')
    .normalize('NFKC')
    .replace(/[\p{Extended_Pictographic}\uFE0F]/gu, ' ')
    .replace(/[*_~#]+/g, ' ')
    .replace(/^[\s\-–—=|:]+|[\s\-–—=|:]+$/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function extractPhones(value) {
  const matches = String(value || '').match(/(?:\+?55\s*)?\(?\d{2}\)?\s*\d{4,5}[-\s]?\d{4}/g) || [];
  return [...new Set(matches.map((item) => item.replace(/\D/g, '').replace(/^55(?=\d{10,11}$)/, '')).filter((item) => item.length >= 10))];
}

function supplierSignalText(filename, content) {
  return [filename, ...String(content).split(/\r?\n/).filter((line) => line.trim()).slice(0, 14)].join('\n');
}

function isGenericSupplierHeading(value) {
  const normalized = normalizeText(value);
  if (!normalized) return true;
  return /^(estoque|estoque atualizado|lista|lista atualizada|tabela|tabela atualizada|precos|precos atualizados|disponiveis|disponivel|novidades|promocao|promocoes|ofertas|bom dia|boa tarde|boa noite|comunicado|comunicado importante|atualizacao|atualizado|atualizada)$/i.test(normalized);
}

function parseWhatsAppHeader(line) {
  const source = String(line || '').replace(/^\u200e/, '');
  let match = /^\[(\d{1,2}\/\d{1,2}\/\d{2,4}),\s*(\d{1,2}:\d{2}(?::\d{2})?)\]\s*([^:]+?)\s*:\s?(.*)$/.exec(source);
  if (match) {
    return { date: match[1], time: match[2], sender: match[3].trim(), first_line: match[4] || '' };
  }
  match = /^(\d{1,2}\/\d{1,2}\/\d{2,4}),\s*(\d{1,2}:\d{2}(?::\d{2})?)\s+-\s+([^:]+?)\s*:\s?(.*)$/.exec(source);
  if (match) {
    return { date: match[1], time: match[2], sender: match[3].trim(), first_line: match[4] || '' };
  }
  return null;
}

function splitWhatsAppExport(content) {
  const lines = String(content || '').split(/\r?\n/);
  const messages = [];
  let current = null;

  for (const line of lines) {
    const header = parseWhatsAppHeader(line);
    if (header) {
      if (current) messages.push(current);
      current = {
        date: header.date,
        time: header.time,
        sender: header.sender,
        lines: header.first_line ? [header.first_line] : []
      };
      continue;
    }
    if (current) current.lines.push(line);
  }
  if (current) messages.push(current);

  if (messages.length < 1) return [];
  const headerCount = lines.filter((line) => parseWhatsAppHeader(line)).length;
  if (headerCount < 1) return [];

  return messages.map((message, index) => ({
    index: index + 1,
    date: message.date,
    time: message.time,
    sender: message.sender,
    content: message.lines.join('\n').trim()
  }));
}

function looksLikeSupplierList(content) {
  const normalized = normalizeText(content);
  if (!normalized) return false;
  const hasProduct = /\b(iphone|ipad|macbook|airpods|apple watch|watch|poco|samsung|xiaomi|galaxy|garmin|mac mini)\b/i.test(normalized);
  const hasPrice = /r\$\s*\d{3,6}|\b\d{3,6}[,.]\d{2}\b|(?:^|\s)\d{3,5}(?:\s|$)/m.test(String(content));
  return hasProduct && hasPrice;
}

function candidateSupplierHeader(content) {
  const lines = String(content).split(/\r?\n/).map((line) => line.trim()).filter(Boolean).slice(0, 10);
  for (let index = 0; index < lines.length; index += 1) {
    const cleaned = cleanHeaderLine(lines[index]);
    const normalized = normalizeText(cleaned);
    if (!normalized || cleaned.length < 3 || cleaned.length > 120) continue;
    if (isGenericSupplierHeading(cleaned)) continue;
    if (parseWhatsAppHeader(lines[index])) continue;
    if (/^(av|avenida|rua|r |tel|telefone|whatsapp|garantia|politicas?)\b/.test(normalized)) continue;
    if (/\b(iphone|ipad|macbook|airpods|watch|poco|samsung|xiaomi|celular|lacrado|lacrados|seminovo|seminovos)\b/.test(normalized)) continue;
    if (/r\$|\b\d{3,6}[,.]\d{2}\b/.test(lines[index])) continue;
    if (extractPhones(lines[index]).length) continue;

    const name = cleaned
      .replace(/\s+[—–-]\s*(?:atacado|varejo|lista|estoque).*$/iu, '')
      .replace(/\s+/g, ' ')
      .trim();
    if (name.length < 3) continue;

    const nearby = lines.slice(0, Math.min(lines.length, 7)).join('\n');
    const hasContactContext = extractPhones(nearby).length > 0 || /\b(av|avenida|rua|centro|rj|sp|mg|pr|sc|ba)\b/i.test(normalizeText(nearby));
    const upperLetters = name.replace(/[^\p{L}]/gu, '');
    const uppercaseRatio = upperLetters.length
      ? [...upperLetters].filter((char) => char === char.toLocaleUpperCase('pt-BR')).length / [...upperLetters].length
      : 0;

    return {
      name,
      normalized_name: normalizeText(name),
      phone: extractPhones(nearby)[0] || null,
      // Uppercase alone is not proof of a supplier: category headings in real lists are often uppercase.
      confidence: index <= 2 && hasContactContext && uppercaseRatio > 0.8 ? 0.97 : 0.78
    };
  }
  return null;
}

async function supabaseJson(env, token, path, init = {}) {
  const response = await fetch(String(env.SUPABASE_URL).replace(/\/+$/, '') + path, {
    ...init,
    headers: {
      apikey: String(env.SUPABASE_ANON_KEY),
      authorization: 'Bearer ' + token,
      ...(init.headers || {})
    }
  });
  const payload = await response.json().catch(() => null);
  if (!response.ok) throw error('BATCH_SUPPLIER_STORE_FAILED', payload?.message || payload?.error || 'falha no cadastro de fornecedor', response.status);
  return payload;
}

async function loadSuppliers(env, token) {
  const payload = await supabaseJson(
    env,
    token,
    '/rest/v1/extcalc_supplier?select=supplier_id,name,phone,city&order=name.asc'
  );
  return Array.isArray(payload) ? payload : [];
}

async function createSupplier(env, token, candidate) {
  const payload = await supabaseJson(env, token, '/rest/v1/extcalc_supplier?select=supplier_id,name,phone,city', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      prefer: 'return=representation'
    },
    body: JSON.stringify({
      name: candidate.name,
      phone: candidate.phone,
      notes: 'Criado automaticamente pelo Batch Supplier Intake V0 a partir de identificação forte no arquivo.'
    })
  });
  if (!Array.isArray(payload) || !payload[0]?.supplier_id) throw error('BATCH_SUPPLIER_STORE_FAILED', 'fornecedor criado sem retorno');
  return payload[0];
}

function resolveExistingSupplier({ filename, content, suppliers }) {
  const signal = supplierSignalText(filename, content);
  const normalizedSignal = normalizeText(signal);
  const phones = new Set(extractPhones(signal));
  const scored = [];

  for (const supplier of suppliers) {
    let score = 0;
    const phone = String(supplier.phone || '').replace(/\D/g, '').replace(/^55(?=\d{10,11}$)/, '');
    if (phone.length >= 10 && phones.has(phone)) score = Math.max(score, 1);

    const name = normalizeText(supplier.name);
    if (name.length >= 4 && normalizedSignal.includes(name)) {
      const firstLines = normalizeText(String(content).split(/\r?\n/).filter((line) => line.trim()).slice(0, 4).join(' '));
      score = Math.max(score, firstLines.includes(name) ? 0.96 : 0.9);
    }

    const normalizedFilename = normalizeText(filename);
    if (name.length >= 4 && normalizedFilename.includes(name)) score = Math.max(score, 0.86);
    if (score > 0) scored.push({ supplier, score });
  }

  scored.sort((a, b) => b.score - a.score || String(a.supplier.name).localeCompare(String(b.supplier.name), 'pt-BR'));
  if (!scored.length) return { state: 'NOT_FOUND', supplier: null, confidence: 0, alternatives: [] };
  const top = scored[0];
  const second = scored[1];
  if (second && top.score - second.score < 0.08) {
    return {
      state: 'AMBIGUOUS',
      supplier: null,
      confidence: top.score,
      alternatives: scored.slice(0, 3).map((item) => ({ supplier_id: item.supplier.supplier_id, name: item.supplier.name, confidence: item.score }))
    };
  }
  return { state: 'MATCHED_EXISTING', supplier: top.supplier, confidence: top.score, alternatives: [] };
}

function decodeText(buffer) {
  if (!buffer.length) throw error('BATCH_ENTRY_EMPTY', 'arquivo vazio', 422);
  if (buffer.includes(0)) throw error('BATCH_BINARY_ENTRY_REJECTED', 'arquivo binario nao permitido', 422);
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(buffer);
  } catch {
    throw error('BATCH_ENTRY_ENCODING_UNSUPPORTED', 'arquivo deve estar em UTF-8', 422);
  }
}

function entryKind(name) {
  const lower = name.toLowerCase();
  if (lower.endsWith('/')) return 'DIRECTORY';
  if (lower.startsWith('__macosx/') || lower.endsWith('/.ds_store') || lower === '.ds_store') return 'METADATA';
  if (lower.endsWith('.zip') || lower.endsWith('.7z') || lower.endsWith('.rar')) return 'NESTED_ARCHIVE';
  if (lower.endsWith('.txt')) return 'TXT';
  if (lower.endsWith('.csv')) return 'CSV';
  return 'UNSUPPORTED';
}

async function processListUnit({ env, token, unit, suppliers, files }) {
  const { filename, path, kind, content, origin } = unit;
  let resolution = resolveExistingSupplier({ filename, content, suppliers });
  let supplier = resolution.supplier;
  let supplierState = resolution.state;
  let confidence = resolution.confidence;
  let candidate = null;

  if (!supplier && resolution.state === 'NOT_FOUND') {
    candidate = candidateSupplierHeader(content);
    if (candidate?.confidence >= 0.95) {
      const duplicate = suppliers.find((item) => normalizeText(item.name) === candidate.normalized_name);
      if (duplicate) {
        supplier = duplicate;
        supplierState = 'MATCHED_EXISTING';
        confidence = 0.99;
      } else {
        try {
          supplier = await createSupplier(env, token, candidate);
          suppliers.push(supplier);
          supplierState = 'AUTO_CREATED';
          confidence = candidate.confidence;
        } catch (supplierError) {
          files.push({
            filename,
            path,
            origin,
            status: 'SUPPLIER_CREATE_FAILED',
            supplier: null,
            supplier_candidate: candidate,
            alternatives: resolution.alternatives,
            intake: null,
            message: supplierError.message
          });
          return;
        }
      }
    }
  }

  if (!supplier) {
    files.push({
      filename,
      path,
      origin,
      status: 'REVIEW_REQUIRED',
      supplier: null,
      supplier_candidate: candidate,
      alternatives: resolution.alternatives,
      intake: null,
      message: resolution.state === 'AMBIGUOUS'
        ? 'Mais de um fornecedor corresponde a esta lista.'
        : 'Fornecedor nao identificado com confianca suficiente.'
    });
    return;
  }

  try {
    const intake = await processListIntakeCommand({
      env,
      token,
      rawCommand: {
        supplier_id: supplier.supplier_id,
        filename,
        mime_type: kind === 'CSV' ? 'text/csv' : 'text/plain',
        content
      }
    });
    files.push({
      filename,
      path,
      origin,
      status: 'PROCESSED',
      supplier: {
        supplier_id: supplier.supplier_id,
        name: supplier.name,
        resolution: supplierState,
        confidence
      },
      intake,
      message: null
    });
  } catch (entryError) {
    files.push({
      filename,
      path,
      origin,
      status: 'INTAKE_FAILED',
      supplier: {
        supplier_id: supplier.supplier_id,
        name: supplier.name,
        resolution: supplierState,
        confidence
      },
      intake: null,
      message: entryError instanceof Error ? entryError.message : 'falha ao interpretar lista'
    });
  }
}

async function processBatch({ env, token, command }) {
  const parsed = readZipEntries(command.bytes, LIMITS);
  const suppliers = await loadSuppliers(env, token);
  const files = [];

  for (const [entryPath, buffer] of parsed.entries) {
    const kind = entryKind(entryPath);
    const filename = entryPath.split('/').pop() || entryPath;

    if (kind === 'DIRECTORY' || kind === 'METADATA') continue;
    if (kind === 'NESTED_ARCHIVE') {
      files.push({ filename, path: entryPath, status: 'REJECTED_NESTED_ARCHIVE', supplier: null, intake: null, message: 'ZIP/arquivo compactado aninhado nao e aceito.' });
      continue;
    }
    if (kind === 'UNSUPPORTED') {
      files.push({ filename, path: entryPath, status: 'SKIPPED_UNSUPPORTED', supplier: null, intake: null, message: 'Formato ignorado. V0 processa TXT e CSV.' });
      continue;
    }

    let content;
    try {
      content = decodeText(buffer);
    } catch (entryError) {
      files.push({ filename, path: entryPath, status: entryError.code || 'ENTRY_INVALID', supplier: null, intake: null, message: entryError.message });
      continue;
    }

    const whatsappMessages = kind === 'TXT' ? splitWhatsAppExport(content) : [];
    if (whatsappMessages.length) {
      let candidateMessages = 0;
      for (const message of whatsappMessages) {
        if (!looksLikeSupplierList(message.content)) continue;
        candidateMessages += 1;
        await processListUnit({
          env,
          token,
          suppliers,
          files,
          unit: {
            filename: `${filename} · mensagem ${message.index}`,
            path: `${entryPath}#message-${message.index}`,
            kind: 'TXT',
            content: message.content,
            origin: {
              container_file: entryPath,
              transport: 'WHATSAPP_EXPORT',
              message_index: message.index,
              sent_at: `${message.date} ${message.time}`,
              sender: message.sender
            }
          }
        });
      }
      if (candidateMessages === 0) {
        files.push({
          filename,
          path: entryPath,
          origin: { container_file: entryPath, transport: 'WHATSAPP_EXPORT' },
          status: 'SKIPPED_NO_LIST_MESSAGES',
          supplier: null,
          intake: null,
          message: 'Export do WhatsApp sem mensagens que parecam listas de fornecedor.'
        });
      }
      continue;
    }

    await processListUnit({
      env,
      token,
      suppliers,
      files,
      unit: {
        filename,
        path: entryPath,
        kind,
        content,
        origin: { container_file: entryPath, transport: 'FILE' }
      }
    });
  }

  const processed = files.filter((item) => item.status === 'PROCESSED');
  return {
    contract_version: 'external-calc-batch-supplier-intake/v0',
    archive: {
      filename: command.filename,
      compressed_bytes: parsed.stats.compressed_bytes,
      uncompressed_bytes: parsed.stats.uncompressed_bytes,
      entries_total: parsed.stats.entry_count
    },
    summary: {
      files_seen: files.length,
      processed: processed.length,
      review_required: files.filter((item) => item.status === 'REVIEW_REQUIRED').length,
      auto_created_suppliers: processed.filter((item) => item.supplier?.resolution === 'AUTO_CREATED').length,
      skipped: files.filter((item) => item.status.startsWith('SKIPPED_')).length,
      rejected: files.filter((item) => item.status.startsWith('REJECTED_')).length,
      failed: files.filter((item) => item.status.endsWith('_FAILED')).length,
      candidates: processed.reduce((sum, item) => sum + (item.intake?.candidates || 0), 0),
      auto_promoted: processed.reduce((sum, item) => sum + (item.intake?.auto_promoted || 0), 0),
      offer_review_required: processed.reduce((sum, item) => sum + (item.intake?.review_required || 0), 0)
    },
    files
  };
}

function createBatchListIntakeApiV0({ env } = {}) {
  if (!env) throw new Error('env obrigatorio');
  return {
    matches(path) { return path === BATCH_LIST_INTAKE_PATH; },
    async handle(request) {
      const origin = allowedOrigin(request.headers.get('origin'), env);
      if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: headers(origin) });
      if (request.method !== 'POST') return out(405, { error: { code: 'METHOD_NOT_ALLOWED', message: 'use POST' } }, origin);
      try {
        const token = bearer(request);
        if (!token) return out(401, { error: { code: 'UNAUTHENTICATED', message: 'autenticacao obrigatoria' } }, origin);
        let raw;
        try { raw = await request.json(); } catch { throw error('BATCH_INTAKE_INVALID', 'JSON invalido'); }
        const command = normalizeBody(raw);
        const result = await processBatch({ env, token, command });
        return out(200, { api_version: API_VERSION, batch: result }, origin);
      } catch (cause) {
        const code = cause?.code || cause?.reason || 'BATCH_INTAKE_FAILED';
        const status = cause?.status || (code === 'BATCH_INTAKE_TOO_LARGE' || code === 'ARCHIVE_TOO_LARGE' || code === 'ARCHIVE_EXPANSION_TOO_LARGE' ? 413 : 400);
        return out(status, { error: { code, message: cause instanceof Error ? cause.message : 'falha no pacote de listas' } }, origin);
      }
    }
  };
}

module.exports = {
  BATCH_LIST_INTAKE_PATH,
  API_VERSION,
  LIMITS,
  normalizeText,
  candidateSupplierHeader,
  parseWhatsAppHeader,
  splitWhatsAppExport,
  looksLikeSupplierList,
  resolveExistingSupplier,
  processBatch,
  createBatchListIntakeApiV0
};
