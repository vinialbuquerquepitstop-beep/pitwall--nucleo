'use strict';

const fs = require('fs');
const path = require('path');
const { interpretResolved, isFieldOnlySegment } = require('./core');
const { adaptLegacyCalcV2 } = require('./legacy-calc-v2-adapter');
const { compareSemanticShadow } = require('./semantic-shadow');
const { analyzeDivergences } = require('./divergence-analyzer');

function die(message, code = 1) {
  console.error(`FALHOU: ${message}`);
  process.exit(code);
}

function readText(file) {
  try { return fs.readFileSync(file, 'utf8'); }
  catch (err) { die(`nao foi possivel ler ${file}: ${err.message}`); }
}

function readJson(file) {
  try { return JSON.parse(readText(file)); }
  catch (err) { die(`JSON invalido em ${file}: ${err.message}`); }
}

const rawPath = process.argv[2];
const legacyPath = process.argv[3];
if (!rawPath || !legacyPath) {
  die('uso: node benchmark_real_load.js <raw.txt> <legacy-bench.json>');
}

const schema = readJson(path.join(__dirname, 'domains', 'apple-iphone-v0.schema.json'));
const knowledge = readJson(path.join(__dirname, 'domains', 'apple-iphone-v0.knowledge.json'));
const raw = readText(rawPath);
const legacyBench = readJson(legacyPath);

if (!raw.trim()) die('documento bruto vazio');
if (legacyBench.guarda_conservacao?.ok !== true) {
  die('guarda de conservacao do leitor legado nao esta verde');
}

const legacy = adaptLegacyCalcV2(legacyBench, knowledge);
if (legacy.offers.length === 0) {
  die('snapshot legado nao produziu nenhuma oferta suportada pelo dominio Apple V0');
}

const coreBundle = interpretResolved({
  document: {
    contract_version: 'raw-document/v1',
    document_id: 'real-load-shadow',
    content: raw,
    source: { kind: 'plain_text' }
  },
  schema,
  knowledge
});

const report = compareSemanticShadow({ legacy, coreBundle });
const reportNoColor = compareSemanticShadow({ legacy, coreBundle, options: { include_color: false } });
const divergence = analyzeDivergences({ legacy, coreBundle });

function distinctFieldValues(segment, field) {
  return [...new Set(
    (segment.field_candidates || [])
      .filter(candidate => candidate.field === field)
      .map(candidate => JSON.stringify(candidate.value))
  )];
}

function modelContextDiagnostics(bundle) {
  const segments = bundle.segments || [];
  let priceSegments = 0;
  let priceWithDirectModel = 0;
  let priceWithInheritedModel = 0;
  let priceWithoutModel = 0;
  let modelCandidateSegments = 0;
  let modelCandidateResolved = 0;
  let modelCandidateUnresolved = 0;
  let modelCandidateAmbiguous = 0;

  for (const segment of segments) {
    const prices = distinctFieldValues(segment, 'price');
    const directModels = (segment.field_candidates || []).filter(candidate => candidate.field === 'model');
    const semanticModels = (segment.semantic_candidates || []).filter(candidate => candidate.field === 'model');

    if (directModels.length) {
      modelCandidateSegments += 1;
      if (semanticModels.some(candidate => candidate.state === 'interpreted' || candidate.state === 'inferred')) {
        modelCandidateResolved += 1;
      } else if (semanticModels.some(candidate => candidate.state === 'ambiguous')) {
        modelCandidateAmbiguous += 1;
      } else {
        modelCandidateUnresolved += 1;
      }
    }

    if (prices.length !== 1) continue;
    priceSegments += 1;
    if (directModels.length) priceWithDirectModel += 1;
    else if (segment.inherited_context?.model) priceWithInheritedModel += 1;
    else priceWithoutModel += 1;
  }

  return {
    price_segments: priceSegments,
    price_with_direct_model: priceWithDirectModel,
    price_with_inherited_model: priceWithInheritedModel,
    price_without_model: priceWithoutModel,
    model_candidate_segments: modelCandidateSegments,
    model_candidate_resolved: modelCandidateResolved,
    model_candidate_unresolved: modelCandidateUnresolved,
    model_candidate_ambiguous: modelCandidateAmbiguous
  };
}

function iphoneModelShape(value) {
  const key = String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/promax/g, 'pro max')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();

  const generation = /\biphone\s+(xr|\d{1,2}e?)\b/.exec(key)?.[1] || null;
  if (!generation) return null;

  let variant = 'base';
  if (/\bpro\s+max\b/.test(key)) variant = 'pro max';
  else if (/\bpro\b/.test(key)) variant = 'pro';
  else if (/\bplus\b/.test(key)) variant = 'plus';
  else if (/\bmini\b/.test(key)) variant = 'mini';
  else if (/\bair\b/.test(key)) variant = 'air';

  const gb = /\b(64|128|256|512|1024|2048)\s*gb\b/.exec(key);
  const tb = /\b([12])\s*tb\b/.exec(key);
  let capacity = gb ? Number(gb[1]) : null;
  if (tb) capacity = Number(tb[1]) * 1024;
  if (capacity == null) {
    const bare = /\b(64|128|256|512|1024|2048)\b/.exec(key);
    capacity = bare ? Number(bare[1]) : null;
  }
  if (capacity == null) return null;
  return `${generation}|${variant}|${capacity}`;
}

function orderedPairFallbackDiagnostics(bundle) {
  const segments = bundle.segments || [];
  const blocks = [];
  let current = null;

  const close = end => {
    if (current && end > current.start) blocks.push({ ...current, end });
    current = null;
  };

  for (let index = 0; index < segments.length; index += 1) {
    const segment = segments[index];
    const hardBoundary = (segment.context_events || []).some(event =>
      event.reason === 'timestamp_boundary' || event.reason === 'domain_boundary'
    );
    if (hardBoundary) close(index);

    const semanticModels = (segment.semantic_candidates || []).filter(candidate => candidate.field === 'model');
    const hasModelCandidate = (segment.field_candidates || []).some(candidate => candidate.field === 'model');
    if (hasModelCandidate) {
      close(index);
      const resolved = semanticModels.find(candidate =>
        (candidate.state === 'interpreted' || candidate.state === 'inferred') && candidate.entity_id
      );
      if (resolved) current = { start: index, model_id: resolved.entity_id };
    }
  }
  close(segments.length);

  let equalBlocks = 0;
  let mismatchBlocks = 0;
  let mismatchColorRows = 0;
  let mismatchBarePriceRows = 0;
  let uniqueNearestColorRows = 0;
  let tiedNearestColorRows = 0;
  const uniqueNearestByDirectionDistance = {};

  for (const block of blocks) {
    const colors = [];
    const prices = [];
    for (let index = block.start; index < block.end; index += 1) {
      const segment = segments[index];
      const colorCandidates = distinctFieldValues(segment, 'color');
      const priceCandidates = distinctFieldValues(segment, 'price');
      if (colorCandidates.length > 0 && priceCandidates.length === 0 && isFieldOnlySegment(segment, 'color')) {
        colors.push({ index, line: segment.line_number });
      }
      if (priceCandidates.length === 1 && colorCandidates.length === 0) {
        prices.push({ index, line: segment.line_number });
      }
    }

    if (!colors.length || !prices.length) continue;
    if (colors.length === prices.length) {
      equalBlocks += 1;
      continue;
    }

    mismatchBlocks += 1;
    mismatchColorRows += colors.length;
    mismatchBarePriceRows += prices.length;

    for (const color of colors) {
      const distances = prices
        .map(price => Math.abs(price.index - color.index))
        .sort((a, b) => a - b);
      if (!distances.length) continue;
      if (distances.length === 1 || distances[0] < distances[1]) {
        uniqueNearestColorRows += 1;
        const nearest = prices
          .map(price => ({ price, distance: Math.abs(price.index - color.index) }))
          .sort((a, b) => a.distance - b.distance || a.price.index - b.price.index)[0];
        const direction = nearest.price.index > color.index ? 'before_price' : 'after_price';
        const key = `${direction}|distance=${nearest.distance}`;
        uniqueNearestByDirectionDistance[key] = (uniqueNearestByDirectionDistance[key] || 0) + 1;
      } else tiedNearestColorRows += 1;
    }
  }

  return {
    equal_pairable_blocks: equalBlocks,
    mismatched_pair_blocks: mismatchBlocks,
    mismatch_color_rows: mismatchColorRows,
    mismatch_bare_price_rows: mismatchBarePriceRows,
    unique_nearest_color_rows: uniqueNearestColorRows,
    tied_nearest_color_rows: tiedNearestColorRows,
    unique_nearest_by_direction_distance: uniqueNearestByDirectionDistance
  };
}

function supportedBlockDiagnostics(bundle) {
  const segments = bundle.segments || [];
  let currentModelId = null;
  let supportedAnchors = 0;
  let supportedBlockPriceSegments = 0;
  let supportedBlockSinglePriceSegments = 0;
  let supportedBlockMultiPriceSegments = 0;
  let supportedBlockPriceWithDirectColor = 0;
  let supportedBlockPriceWithoutDirectColor = 0;
  const perModel = {};
  const touch = modelId => {
    if (!perModel[modelId]) {
      perModel[modelId] = {
        anchors: 0,
        price_segments: 0,
        price_with_color: 0,
        price_without_color: 0,
        color_only_rows: 0,
        color_candidates_on_color_only_rows: 0,
        materialized_records: 0
      };
    }
    return perModel[modelId];
  };

  for (const record of bundle.records || []) {
    const modelId = record.fields?.model?.id;
    if (modelId) touch(modelId).materialized_records += 1;
  }

  for (const segment of segments) {
    if ((segment.context_events || []).some(event => event.reason === 'timestamp_boundary')) {
      currentModelId = null;
    }

    const modelCandidates = (segment.semantic_candidates || []).filter(candidate =>
      candidate.field === 'model'
    );
    if (modelCandidates.length) {
      const resolved = modelCandidates.find(candidate =>
        (candidate.state === 'interpreted' || candidate.state === 'inferred') && candidate.entity_id
      );
      currentModelId = resolved?.entity_id || null;
      if (currentModelId) {
        supportedAnchors += 1;
        touch(currentModelId).anchors += 1;
      }
    }

    if (!currentModelId) continue;
    const colors = distinctFieldValues(segment, 'color');
    const prices = distinctFieldValues(segment, 'price');

    if (colors.length > 0 && prices.length === 0 && isFieldOnlySegment(segment, 'color')) {
      touch(currentModelId).color_only_rows += 1;
      touch(currentModelId).color_candidates_on_color_only_rows += colors.length;
    }

    if (!prices.length) continue;

    supportedBlockPriceSegments += 1;
    touch(currentModelId).price_segments += 1;
    if (prices.length === 1) supportedBlockSinglePriceSegments += 1;
    else supportedBlockMultiPriceSegments += 1;

    if (colors.length) {
      supportedBlockPriceWithDirectColor += 1;
      touch(currentModelId).price_with_color += 1;
    } else {
      supportedBlockPriceWithoutDirectColor += 1;
      touch(currentModelId).price_without_color += 1;
    }
  }

  return {
    supported_anchors: supportedAnchors,
    supported_block_price_segments: supportedBlockPriceSegments,
    supported_block_single_price_segments: supportedBlockSinglePriceSegments,
    supported_block_multi_price_segments: supportedBlockMultiPriceSegments,
    supported_block_price_with_direct_color: supportedBlockPriceWithDirectColor,
    supported_block_price_without_direct_color: supportedBlockPriceWithoutDirectColor,
    materialized_records: (bundle.records || []).length,
    per_model: perModel
  };
}

function relaxedSupportedHeaderDiagnostics(bundle, knowledgeSnapshot) {
  const supported = new Map();
  for (const entity of knowledgeSnapshot.entities || []) {
    if (entity.kind !== 'model') continue;
    const shape = iphoneModelShape(entity.label);
    if (shape) supported.set(shape, entity.id);
  }

  const byModel = {};
  let candidates = 0;
  let withIphoneToken = 0;
  let withoutIphoneToken = 0;
  let proMaxCompact = 0;

  for (const segment of bundle.segments || []) {
    if ((segment.field_candidates || []).some(candidate => candidate.field === 'model')) continue;
    if (distinctFieldValues(segment, 'price').length > 0) continue;
    const raw = String(segment.normalized || '');
    if (!raw || raw.length > 90) continue;
    const key = raw
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase();

    const capMatch = /(?:^|\D)(64|128|256|512)(?:\s*gb)?(?:\D|$)/.exec(key);
    if (!capMatch) continue;
    const capacity = Number(capMatch[1]);

    const genMatch = /(?:iphone\s*)?\b(13|15|16e?|17e?)\b/.exec(key)
      || /\b(13|15|16e?|17e?)(?=(?:pm|p)\b)/.exec(key);
    if (!genMatch) continue;
    const generation = genMatch[1];

    let variant = 'base';
    if (/\bpro\s*max\b|\bpromax\b|\b(?:13|15|16|17)pm\b/.test(key)) {
      variant = 'pro max';
      if (/\b(?:13|15|16|17)pm\b/.test(key)) proMaxCompact += 1;
    } else if (/\bpro\b|\b(?:13|15|16|17)p\b/.test(key)) {
      variant = 'pro';
    } else if (/\bair\b/.test(key)) {
      variant = 'air';
    } else if (/\bplus\b/.test(key)) {
      variant = 'plus';
    } else if (/\bmini\b/.test(key)) {
      variant = 'mini';
    }

    const shape = `${generation}|${variant}|${capacity}`;
    const modelId = supported.get(shape);
    if (!modelId) continue;

    candidates += 1;
    if (/\biphone\b/.test(key)) withIphoneToken += 1;
    else withoutIphoneToken += 1;
    byModel[modelId] = (byModel[modelId] || 0) + 1;
  }

  return {
    relaxed_supported_header_candidates: candidates,
    with_iphone_token: withIphoneToken,
    without_iphone_token: withoutIphoneToken,
    compact_pro_max_candidates: proMaxCompact,
    by_model: byModel
  };
}

function unresolvedModelDiagnostics(bundle, knowledgeSnapshot) {
  const supportedByShape = new Map();
  for (const entity of knowledgeSnapshot.entities || []) {
    if (entity.kind !== 'model') continue;
    const shape = iphoneModelShape(entity.label);
    if (shape) supportedByShape.set(shape, entity.id);
  }

  let unresolvedCandidates = 0;
  let unresolvedNearSupported = 0;
  const nearSupportedByModel = {};

  for (const segment of bundle.segments || []) {
    const semantic = (segment.semantic_candidates || []).filter(candidate =>
      candidate.field === 'model' && candidate.state === 'unresolved'
    );
    for (const candidate of semantic) {
      unresolvedCandidates += 1;
      const shape = iphoneModelShape(candidate.input);
      const modelId = shape ? supportedByShape.get(shape) : null;
      if (!modelId) continue;
      unresolvedNearSupported += 1;
      nearSupportedByModel[modelId] = (nearSupportedByModel[modelId] || 0) + 1;
    }
  }

  return {
    unresolved_model_candidates: unresolvedCandidates,
    unresolved_near_supported: unresolvedNearSupported,
    unresolved_near_supported_by_model: nearSupportedByModel
  };
}

function supplierBoundaryDiagnostics(bundle) {
  const out = {
    boundary_events: 0,
    supplier_only_segments: 0,
    with_model: 0,
    with_price: 0,
    with_condition: 0,
    with_color: 0,
    with_timestamp: 0,
    by_supplier: {}
  };

  for (const segment of bundle.segments || []) {
    const boundary = (segment.context_events || []).some(event => event.reason === 'supplier_boundary');
    if (!boundary) continue;
    out.boundary_events += 1;

    const supplierCandidates = (segment.field_candidates || []).filter(candidate => candidate.field === 'supplier');
    const suppliers = distinctFieldValues(segment, 'supplier');
    const supplier = suppliers.length === 1 ? JSON.parse(suppliers[0]) : '(ambiguous)';
    out.by_supplier[supplier] = (out.by_supplier[supplier] || 0) + 1;

    out.by_captured_alias = out.by_captured_alias || {};
    for (const candidate of supplierCandidates) {
      const captured = candidate.evidence?.captured || '(unknown)';
      out.by_captured_alias[captured] = (out.by_captured_alias[captured] || 0) + 1;
    }

    const hasModel = distinctFieldValues(segment, 'model').length > 0;
    const hasPrice = distinctFieldValues(segment, 'price').length > 0;
    const hasCondition = distinctFieldValues(segment, 'condition').length > 0;
    const hasColor = distinctFieldValues(segment, 'color').length > 0;
    const hasTimestamp = (segment.context_events || []).some(event => event.reason === 'timestamp_boundary');

    if (hasModel) out.with_model += 1;
    if (hasPrice) out.with_price += 1;
    if (hasCondition) out.with_condition += 1;
    if (hasColor) out.with_color += 1;
    if (hasTimestamp) out.with_timestamp += 1;
    if (!hasModel && !hasPrice && !hasCondition && !hasColor) out.supplier_only_segments += 1;
  }

  return out;
}

function conditionDistributionDiagnostics(legacyBundle, coreBundle) {
  const count = offers => {
    const out = {};
    for (const offer of offers || []) {
      const model = offer?.fields?.model?.id;
      if (!model) continue;
      const condition = offer?.fields?.condition == null ? '(null)' : String(offer.fields.condition);
      out[model] = out[model] || {};
      out[model][condition] = (out[model][condition] || 0) + 1;
    }
    return out;
  };

  return {
    legacy: count(legacyBundle?.offers || []),
    core: count((coreBundle?.records || []).map(record => ({ fields: record.fields || {} })))
  };
}

function localHeader17256Diagnostics(bundle) {
  const segments = bundle.segments || [];
  const records = bundle.records || [];
  const headers = [];

  for (let index = 0; index < segments.length; index += 1) {
    const segment = segments[index];
    const normalized = String(segment.normalized || '');
    if (/iphone/i.test(normalized)) continue;
    if (!/^[^A-Za-z0-9]{0,12}17\s+256(?:\s*GB)?(?=\D|$)/i.test(normalized)) continue;

    let end = segments.length;
    for (let j = index + 1; j < segments.length; j += 1) {
      const next = segments[j];
      const boundary = (next.context_events || []).some(event =>
        event.reason === 'product_header_boundary' ||
        event.reason === 'timestamp_boundary' ||
        event.reason === 'domain_boundary'
      );
      if (boundary) {
        end = j;
        break;
      }
    }

    const block = segments.slice(index, end);
    const blockLines = new Set(block.map(s => Number(s.line_number)));
    const modelCandidates = (segment.field_candidates || [])
      .filter(candidate => candidate.field === 'model')
      .map(candidate => String(candidate.value));
    const semanticModels = (segment.semantic_candidates || [])
      .filter(candidate => candidate.field === 'model')
      .map(candidate => ({
        state: candidate.state,
        entity_id: candidate.entity_id || null
      }));

    let priceSegments = 0;
    let singlePriceSegments = 0;
    let multiPriceSegments = 0;
    let priceWithDirectColor = 0;
    let priceWithoutDirectColor = 0;
    let colorOnlyRows = 0;
    let colorCandidates = 0;
    let conditionCandidateRows = 0;
    const conditionCounts = { Lacrado: 0, Seminovo: 0, CPO: 0, other: 0 };

    for (const blockSegment of block) {
      const prices = distinctFieldValues(blockSegment, 'price');
      const colors = distinctFieldValues(blockSegment, 'color');
      const conditions = distinctFieldValues(blockSegment, 'condition')
        .map(value => JSON.parse(value));

      if (prices.length > 0) {
        priceContext.push({
          line: segment.line_number,
          direct_conditions: conditions,
          inherited_condition: segment.inherited_context?.condition
            ? {
                value: segment.inherited_context.condition.value,
                source_line: segment.inherited_context.condition.source_line
              }
            : null,
          inherited_model_source_line: segment.inherited_context?.model?.source_line || null
        });
        priceSegments += 1;
        if (prices.length === 1) singlePriceSegments += 1;
        else multiPriceSegments += 1;
        if (colors.length > 0) priceWithDirectColor += 1;
        else priceWithoutDirectColor += 1;
      }

      if (colors.length > 0 && prices.length === 0 && isFieldOnlySegment(blockSegment, 'color')) {
        colorOnlyRows += 1;
        colorCandidates += colors.length;
      }

      if (conditions.length > 0) {
        conditionCandidateRows += 1;
        for (const condition of conditions) {
          if (Object.prototype.hasOwnProperty.call(conditionCounts, condition)) {
            conditionCounts[condition] += 1;
          } else {
            conditionCounts.other += 1;
          }
        }
      }
    }

    const blockRecords = records.filter(record => {
      const priceTrace = (record.trace || []).find(trace => trace.field === 'price');
      const line = Array.isArray(priceTrace?.sources) ? Number(priceTrace.sources[0]) : null;
      return line != null && blockLines.has(line);
    });

    headers.push({
      line: segment.line_number,
      has_lacrado: /\blacrado\b/i.test(normalized),
      has_a_plus: /\bA\+\b/i.test(normalized),
      has_nacional: /\bnacional\b/i.test(normalized),
      has_nf: /(?:^|\s)nf(?:\s|$)/i.test(normalized),
      has_esim: /\be\s*sim\b|\besim\b/i.test(normalized),
      has_importado: /\bimportad[oa]s?\b/i.test(normalized),
      has_chip_fisico: /\bchip\s+f[ií]sico\b/i.test(normalized),
      has_chip_virtual: /\bchip\s+virtual\b/i.test(normalized),
      has_seminovo: /\bseminov[oa]s?\b/i.test(normalized),
      has_cpo: /\bcpo\b/i.test(normalized),
      model_candidates: modelCandidates,
      semantic_models: semanticModels,
      block_segment_count: block.length,
      price_segments: priceSegments,
      single_price_segments: singlePriceSegments,
      multi_price_segments: multiPriceSegments,
      price_with_direct_color: priceWithDirectColor,
      price_without_direct_color: priceWithoutDirectColor,
      color_only_rows: colorOnlyRows,
      color_candidates: colorCandidates,
      condition_candidate_rows: conditionCandidateRows,
      condition_counts: conditionCounts,
      materialized_records: blockRecords.length,
      materialized_17256: blockRecords.filter(record => record.fields?.model?.id === 'iphone_17_256gb').length
    });
  }

  return {
    header_count: headers.length,
    unresolved_header_count: headers.filter(header => header.semantic_models.length === 0).length,
    headers
  };
}


function targetModelBlockDiagnostics(bundle, modelId) {
  const segments = bundle.segments || [];
  const records = bundle.records || [];
  const blocks = [];
  let current = null;

  const close = end => {
    if (current && end > current.start) blocks.push({ ...current, end });
    current = null;
  };

  for (let index = 0; index < segments.length; index += 1) {
    const segment = segments[index];
    const hardBoundary = (segment.context_events || []).some(event =>
      event.reason === 'timestamp_boundary' || event.reason === 'domain_boundary'
    );
    if (hardBoundary) close(index);

    const semanticModels = (segment.semantic_candidates || []).filter(candidate =>
      candidate.field === 'model'
    );
    const hasModelCandidate = (segment.field_candidates || []).some(candidate =>
      candidate.field === 'model'
    );

    if (hasModelCandidate) {
      close(index);
      const resolved = semanticModels.find(candidate =>
        (candidate.state === 'interpreted' || candidate.state === 'inferred') && candidate.entity_id
      );
      if (resolved?.entity_id === modelId) {
        current = {
          start: index,
          anchor_line: segment.line_number
        };
      }
    }
  }
  close(segments.length);

  const blockSummaries = [];
  const totals = {
    blocks: blocks.length,
    price_segments: 0,
    single_price_segments: 0,
    multi_price_segments: 0,
    price_with_direct_color: 0,
    price_without_direct_color: 0,
    color_only_rows: 0,
    color_candidates: 0,
    direct_condition_rows: 0,
    materialized_records: 0,
    materialized_conditions: {}
  };

  for (const block of blocks) {
    const slice = segments.slice(block.start, block.end);
    const blockLines = new Set(slice.map(segment => Number(segment.line_number)));
    let priceSegments = 0;
    let singlePriceSegments = 0;
    let multiPriceSegments = 0;
    let priceWithDirectColor = 0;
    let priceWithoutDirectColor = 0;
    let colorOnlyRows = 0;
    let colorCandidates = 0;
    let directConditionRows = 0;
    const directConditions = {};
    const priceContext = [];

    for (const segment of slice) {
      const prices = distinctFieldValues(segment, 'price');
      const colors = distinctFieldValues(segment, 'color');
      const conditions = distinctFieldValues(segment, 'condition').map(value => JSON.parse(value));

      if (prices.length > 0) {
        priceSegments += 1;
        if (prices.length === 1) singlePriceSegments += 1;
        else multiPriceSegments += 1;
        if (colors.length > 0) priceWithDirectColor += 1;
        else priceWithoutDirectColor += 1;
      }

      if (colors.length > 0 && prices.length === 0 && isFieldOnlySegment(segment, 'color')) {
        colorOnlyRows += 1;
        colorCandidates += colors.length;
      }

      if (conditions.length > 0) {
        directConditionRows += 1;
        for (const condition of conditions) {
          const key = condition == null ? '(null)' : String(condition);
          directConditions[key] = (directConditions[key] || 0) + 1;
        }
      }
    }

    const blockRecords = records.filter(record => {
      if (record.fields?.model?.id !== modelId) return false;
      const priceTrace = (record.trace || []).find(trace => trace.field === 'price');
      const line = Array.isArray(priceTrace?.sources) ? Number(priceTrace.sources[0]) : null;
      return line != null && blockLines.has(line);
    });

    const materializedConditions = {};
    const materializedTrace = [];
    for (const record of blockRecords) {
      const key = record.fields?.condition == null ? '(null)' : String(record.fields.condition);
      materializedConditions[key] = (materializedConditions[key] || 0) + 1;
      totals.materialized_conditions[key] = (totals.materialized_conditions[key] || 0) + 1;
      const conditionTrace = (record.trace || []).find(trace => trace.field === 'condition');
      const priceTrace = (record.trace || []).find(trace => trace.field === 'price');
      materializedTrace.push({
        price_line: Array.isArray(priceTrace?.sources) ? Number(priceTrace.sources[0]) : null,
        condition: key,
        condition_source_lines: Array.isArray(conditionTrace?.sources) ? conditionTrace.sources.map(Number) : [],
        condition_rules: Array.isArray(conditionTrace?.rules) ? conditionTrace.rules : []
      });
    }

    totals.price_segments += priceSegments;
    totals.single_price_segments += singlePriceSegments;
    totals.multi_price_segments += multiPriceSegments;
    totals.price_with_direct_color += priceWithDirectColor;
    totals.price_without_direct_color += priceWithoutDirectColor;
    totals.color_only_rows += colorOnlyRows;
    totals.color_candidates += colorCandidates;
    totals.direct_condition_rows += directConditionRows;
    totals.materialized_records += blockRecords.length;

    blockSummaries.push({
      anchor_line: block.anchor_line,
      block_segment_count: slice.length,
      price_segments: priceSegments,
      single_price_segments: singlePriceSegments,
      multi_price_segments: multiPriceSegments,
      price_with_direct_color: priceWithDirectColor,
      price_without_direct_color: priceWithoutDirectColor,
      color_only_rows: colorOnlyRows,
      color_candidates: colorCandidates,
      direct_condition_rows: directConditionRows,
      direct_conditions: directConditions,
      price_context: priceContext,
      materialized_records: blockRecords.length,
      materialized_conditions: materializedConditions,
      materialized_trace: materializedTrace
    });
  }

  return {
    model_id: modelId,
    ...totals,
    block_summaries: blockSummaries
  };
}

function offerExpansionDiagnostics(bundle) {
  const segments = bundle.segments || [];
  let directMultiColorSegments = 0;
  let priceTriggerSegments = 0;
  let priceWithDirectColor = 0;
  let priceWithoutDirectColor = 0;
  let priceWithRecentColorBefore = 0;
  let priceWithContiguousMultiColorBefore = 0;
  let priceWithContiguousMultiColorAfter = 0;
  let expandedRecords = 0;

  for (let index = 0; index < segments.length; index += 1) {
    const segment = segments[index];
    const colors = distinctFieldValues(segment, 'color');
    const prices = distinctFieldValues(segment, 'price');
    if (colors.length > 1) directMultiColorSegments += 1;
    if (prices.length !== 1) continue;

    priceTriggerSegments += 1;
    if (colors.length > 0) priceWithDirectColor += 1;
    else priceWithoutDirectColor += 1;

    if (colors.length === 0) {
      for (let back = index - 1; back >= 0 && back >= index - 4; back -= 1) {
        const prior = segments[back];
        if ((prior.context_events || []).some(event => event.reason === 'timestamp_boundary')) break;
        if (distinctFieldValues(prior, 'model').length > 0) break;
        if (distinctFieldValues(prior, 'color').length > 0) {
          priceWithRecentColorBefore += 1;
          break;
        }
      }
    }

    const immediateBefore = index > 0 ? distinctFieldValues(segments[index - 1], 'color') : [];
    if (immediateBefore.length > 1) priceWithContiguousMultiColorBefore += 1;

    if (index + 1 < segments.length) {
      const next = segments[index + 1];
      const nextHasBoundary = (next.context_events || []).some(event => event.reason === 'timestamp_boundary');
      const nextHasModel = distinctFieldValues(next, 'model').length > 0;
      const nextHasPrice = distinctFieldValues(next, 'price').length > 0;
      const immediateAfter = distinctFieldValues(next, 'color');
      if (!nextHasBoundary && !nextHasModel && !nextHasPrice && immediateAfter.length > 1) {
        priceWithContiguousMultiColorAfter += 1;
      }
    }
  }

  for (const record of bundle.records || []) {
    if (String(record.record_id || '').includes('-exp-')) expandedRecords += 1;
  }

  return {
    direct_multi_color_segments: directMultiColorSegments,
    price_trigger_segments: priceTriggerSegments,
    price_with_direct_color: priceWithDirectColor,
    price_without_direct_color: priceWithoutDirectColor,
    price_with_recent_color_before: priceWithRecentColorBefore,
    price_with_contiguous_multi_color_before: priceWithContiguousMultiColorBefore,
    price_with_contiguous_multi_color_after: priceWithContiguousMultiColorAfter,
    expanded_records: expandedRecords
  };
}

const expansionDiagnostic = offerExpansionDiagnostics(coreBundle);
const modelContextDiagnostic = modelContextDiagnostics(coreBundle);
const unresolvedModelDiagnostic = unresolvedModelDiagnostics(coreBundle, knowledge);
const relaxedSupportedHeaderDiagnostic = relaxedSupportedHeaderDiagnostics(coreBundle, knowledge);
const supportedBlockDiagnostic = supportedBlockDiagnostics(coreBundle);
const orderedPairFallbackDiagnostic = orderedPairFallbackDiagnostics(coreBundle);
const supplierBoundaryDiagnostic = supplierBoundaryDiagnostics(coreBundle);
const conditionDistributionDiagnostic = conditionDistributionDiagnostics(legacy, coreBundle);
const localHeader17256Diagnostic = localHeader17256Diagnostics(coreBundle);
const target16ProMax256Diagnostic = targetModelBlockDiagnostics(coreBundle, 'iphone_16_pro_max_256gb');

const summary = {
  contract_version: 'real-shadow-benchmark-summary/v1',
  mode: 'shadow_read_only',
  scope: 'apple-iphone-v0-supported-models',
  legacy_guard_ok: true,
  legacy_supported_offers: report.metrics.legacy_supported_offers,
  legacy_unsupported_products: legacy.unsupported.length,
  legacy_invalid_supported: legacy.invalid.length,
  core_offers: report.metrics.core_offers,
  core_ambiguities: report.metrics.core_ambiguities,
  matched_offers: report.metrics.matched_offers,
  missing_offers: report.metrics.missing_offers,
  extra_offers: report.metrics.extra_offers,
  agreement_ratio: report.metrics.agreement_ratio,
  agreement_ratio_without_color: reportNoColor.metrics.agreement_ratio,
  exact_multiset_without_color: reportNoColor.gates.exact_multiset,
  no_silent_wrong_price: report.gates.no_silent_wrong_price,
  exact_multiset: report.gates.exact_multiset,
  promotion_ready:
    report.gates.no_silent_wrong_price === true &&
    report.gates.exact_multiset === true,
  offer_expansion_diagnostic: expansionDiagnostic,
  model_context_diagnostic: modelContextDiagnostic,
  unresolved_model_diagnostic: unresolvedModelDiagnostic,
  relaxed_supported_header_diagnostic: relaxedSupportedHeaderDiagnostic,
  supported_block_diagnostic: supportedBlockDiagnostic,
  ordered_pair_fallback_diagnostic: orderedPairFallbackDiagnostic,
  supplier_boundary_diagnostic: supplierBoundaryDiagnostic,
  condition_distribution_diagnostic: conditionDistributionDiagnostic,
  local_header_17_256_diagnostic: localHeader17256Diagnostic,
  target_16_pro_max_256_diagnostic: target16ProMax256Diagnostic
};

const diagnostic = {
  contract_version: divergence.contract_version,
  version: divergence.version,
  categories: divergence.categories,
  mismatch_signatures: divergence.mismatch_signatures,
  condition_pairs: divergence.condition_pairs,
  condition_pair_provenance: divergence.condition_pair_provenance,
  condition_scope_diagnostics: divergence.condition_scope_diagnostics,
  wrong_price_diagnostics: divergence.wrong_price_diagnostics,
  multi_mismatch_diagnostics: divergence.multi_mismatch_diagnostics,
  ambiguities_by_cause: divergence.ambiguities_by_cause,
  ambiguities_by_field: divergence.ambiguities_by_field,
  top_model_gaps: divergence.top_model_gaps
};

console.log('=== REAL SHADOW BENCHMARK — AGREGADO ===');
console.log(JSON.stringify(summary, null, 2));
console.log('=== DIVERGENCE ANALYZER V1 — AGREGADO ===');
console.log(JSON.stringify(diagnostic, null, 2));
console.log(`PROMOTION_READY=${summary.promotion_ready ? 'true' : 'false'}`);

if (!summary.no_silent_wrong_price) {
  console.log('BLOQUEIO: existe divergencia de preco para modelo suportado; detalhes sensiveis nao sao impressos.');
}
if (!summary.exact_multiset) {
  console.log('BLOQUEIO: o multiconjunto de ofertas ainda diverge; detalhes sensiveis nao sao impressos.');
}

console.log('BENCHMARK_CONCLUIDO=1');
