'use strict';

const fs = require('fs');
const path = require('path');
const { interpretResolved, isFieldOnlySegment, normalizeKey } = require('./core');
const { adaptLegacyCalcV2 } = require('./legacy-calc-v2-adapter');
const { compareSemanticShadow } = require('./semantic-shadow');
const { analyzeDivergences, normFields, removeExactMatches, pairWithinModel } = require('./divergence-analyzer');
const { applyReferenceAdjudication } = require('./reference-adjudication');

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
const referenceAdjudication = readJson(
  path.join(__dirname, 'benchmark-reference-adjudications.v1.json')
);
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

const canonicalReference = applyReferenceAdjudication({
  legacyBundle: legacy,
  knowledgeSnapshot: knowledge,
  reference: referenceAdjudication,
  sourceLoadId: process.env.LOAD_ID || null
});

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

const canonicalReferenceReport = compareSemanticShadow({
  legacy: canonicalReference.legacy,
  coreBundle
});
const canonicalReferenceReportNoColor = compareSemanticShadow({
  legacy: canonicalReference.legacy,
  coreBundle,
  options: { include_color: false }
});
const canonicalReferenceDivergence = analyzeDivergences({
  legacy: canonicalReference.legacy,
  coreBundle
});

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

function rejectedColorSourceDiagnostics(bundle) {
  const segments = bundle.segments || [];
  let activeModel = null;
  const byModel = {};
  const byRoleReason = {};
  const featureCounts = {};
  let total = 0;

  for (const segment of segments) {
    const hardBoundary = (segment.context_events || []).some(event =>
      event.reason === 'timestamp_boundary' || event.reason === 'domain_boundary' ||
      event.reason === 'supplier_boundary' || event.reason === 'product_header_boundary'
    );
    if (hardBoundary) activeModel = null;

    const resolvedModels = (segment.semantic_candidates || []).filter(candidate =>
      candidate.field === 'model' &&
      (candidate.state === 'interpreted' || candidate.state === 'inferred') &&
      candidate.entity_id
    );
    if (resolvedModels.length === 1) activeModel = resolvedModels[0].entity_id;

    const colors = distinctFieldValues(segment, 'color');
    const prices = distinctFieldValues(segment, 'price');
    if (!colors.length || prices.length || isFieldOnlySegment(segment, 'color')) continue;

    total += 1;
    const model = activeModel || '(none)';
    byModel[model] = (byModel[model] || 0) + 1;
    const top = segment.role_candidates?.[0];
    const roleKey = `${top?.role || '(none)'}|${top?.reason || '(none)'}`;
    byRoleReason[roleKey] = (byRoleReason[roleKey] || 0) + 1;

    const candidates = segment.field_candidates || [];
    const features = [
      candidates.some(c => c.field === 'model') ? 'has_model' : null,
      candidates.some(c => c.field === 'capacity_gb') ? 'has_capacity' : null,
      candidates.some(c => c.field === 'condition') ? 'has_condition' : null,
      /\\d/.test(segment.normalized || '') ? 'has_digit' : 'no_digit'
    ].filter(Boolean).join('+');
    featureCounts[features] = (featureCounts[features] || 0) + 1;
  }

  return { rejected_color_source_rows: total, by_model: byModel, by_role_reason: byRoleReason, by_features: featureCounts };
}


function scopedRejectedColorPairingDiagnostics(bundle) {
  const segments = bundle.segments || [];
  let activeModel = null;
  let blockStart = 0;
  const rows = [];
  const byModel = {};
  const safeByModel = {};
  let totalInActiveModel = 0;
  let conservativeCandidates = 0;

  const isHardBoundary = segment => (segment.context_events || []).some(event =>
    event.reason === 'timestamp_boundary' ||
    event.reason === 'domain_boundary' ||
    event.reason === 'supplier_boundary' ||
    event.reason === 'product_header_boundary'
  );

  const onePrice = segment => {
    const values = distinctFieldValues(segment, 'price');
    return values.length === 1 ? values[0] : null;
  };

  const hasCondition = segment =>
    (segment.field_candidates || []).some(candidate => candidate.field === 'condition');

  for (let index = 0; index < segments.length; index += 1) {
    const segment = segments[index];

    if (isHardBoundary(segment)) {
      activeModel = null;
      blockStart = index;
    }

    const resolvedModels = (segment.semantic_candidates || []).filter(candidate =>
      candidate.field === 'model' &&
      (candidate.state === 'interpreted' || candidate.state === 'inferred') &&
      candidate.entity_id
    );
    if (resolvedModels.length === 1) {
      activeModel = resolvedModels[0].entity_id;
      blockStart = index;
    }

    const colors = distinctFieldValues(segment, 'color');
    const prices = distinctFieldValues(segment, 'price');
    if (!activeModel || !colors.length || prices.length || isFieldOnlySegment(segment, 'color')) continue;

    totalInActiveModel += 1;
    byModel[activeModel] = (byModel[activeModel] || 0) + 1;

    const scan = direction => {
      for (let j = index + direction; j >= blockStart && j < segments.length; j += direction) {
        const probe = segments[j];
        if (j !== index && isHardBoundary(probe)) break;

        const probeModels = (probe.semantic_candidates || []).filter(candidate =>
          candidate.field === 'model' &&
          (candidate.state === 'interpreted' || candidate.state === 'inferred') &&
          candidate.entity_id
        );
        if (j !== index && probeModels.length === 1 && probeModels[0].entity_id !== activeModel) break;

        const p = onePrice(probe);
        if (p != null) {
          return {
            line: probe.line_number,
            distance: Math.abs(j - index),
            price: Number(p),
            has_condition: hasCondition(probe),
            index: j
          };
        }
      }
      return null;
    };

    const prev = scan(-1);
    const nextPrice = scan(1);
    const nearest = [prev, nextPrice]
      .filter(Boolean)
      .sort((a, b) => a.distance - b.distance || a.index - b.index);
    const uniqueNearest = nearest.length === 1 || (
      nearest.length > 1 && nearest[0].distance < nearest[1].distance
    );

    let crossedCondition = false;
    if (uniqueNearest && nearest[0]) {
      const lo = Math.min(index, nearest[0].index);
      const hi = Math.max(index, nearest[0].index);
      crossedCondition = segments.slice(lo + 1, hi).some(hasCondition);
    }

    const topRole = segment.role_candidates?.[0];
    const conservative =
      uniqueNearest &&
      nearest[0] &&
      nearest[0].distance <= 2 &&
      !crossedCondition &&
      !nearest[0].has_condition &&
      colors.length === 1;

    if (conservative) {
      conservativeCandidates += 1;
      safeByModel[activeModel] = (safeByModel[activeModel] || 0) + 1;
    }

    rows.push({
      model: activeModel,
      line: segment.line_number,
      color_count: colors.length,
      role: topRole?.role || null,
      reason: topRole?.reason || null,
      previous_price: prev ? { line: prev.line, distance: prev.distance } : null,
      next_price: nextPrice ? { line: nextPrice.line, distance: nextPrice.distance } : null,
      unique_nearest: uniqueNearest,
      crossed_condition: crossedCondition,
      conservative_candidate: conservative
    });
  }

  return {
    rejected_color_rows_in_active_model: totalInActiveModel,
    conservative_pair_candidates: conservativeCandidates,
    by_model: byModel,
    conservative_by_model: safeByModel,
    rows
  };
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
  const candidateDetails = [];
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

    const directConditions = distinctFieldValues(segment, 'condition').map(value => JSON.parse(value));
    const inheritedCondition = segment.inherited_context?.condition
      ? {
          value: segment.inherited_context.condition.value,
          source_line: segment.inherited_context.condition.source_line
        }
      : null;

    candidateDetails.push({
      line: segment.line_number,
      model_id: modelId,
      generation,
      variant,
      capacity,
      has_lacrado: /\blacrad[oa]s?\b/i.test(raw),
      has_cpo: /\bcpo\b/i.test(raw),
      has_seminovo: /\bseminov[oa]s?\b/i.test(raw),
      has_nacional: /\bnacional\b/i.test(raw),
      has_nf: /(?:^|\s)nf(?:\s|$)/i.test(raw),
      has_importado: /\bimportad[oa]s?\b/i.test(raw),
      has_esim: /\be\s*sim\b|\besim\b/i.test(raw),
      direct_conditions: directConditions,
      inherited_condition: inheritedCondition
    });
  }

  return {
    relaxed_supported_header_candidates: candidates,
    with_iphone_token: withIphoneToken,
    without_iphone_token: withoutIphoneToken,
    compact_pro_max_candidates: proMaxCompact,
    by_model: byModel,
    candidate_details: candidateDetails
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
    const colorRows = [];
    const structuralRows = [];
    const priceRows = [];
    let conditionCandidateRows = 0;
    const conditionCounts = { Lacrado: 0, Seminovo: 0, CPO: 0, other: 0 };

    for (const blockSegment of block) {
      const prices = distinctFieldValues(blockSegment, 'price');
      const colors = distinctFieldValues(blockSegment, 'color');
      const conditions = distinctFieldValues(blockSegment, 'condition')
        .map(value => JSON.parse(value));

      structuralRows.push({
        line: blockSegment.line_number,
        model_candidates: distinctFieldValues(blockSegment, 'model').map(value => JSON.parse(value)),
        capacity_candidates: distinctFieldValues(blockSegment, 'capacity_gb').map(value => JSON.parse(value)),
        condition_candidates: conditions,
        color_count: colors.length,
        price_count: prices.length,
        context_event_reasons: (blockSegment.context_events || []).map(event => event.reason || event.type).filter(Boolean),
        inherited_model_source_line: blockSegment.inherited_context?.model?.source_line || null,
        inherited_condition_source_line: blockSegment.inherited_context?.condition?.source_line || null
      });

      if (prices.length > 0) {
        priceSegments += 1;
        if (prices.length === 1) singlePriceSegments += 1;
        else multiPriceSegments += 1;
        if (colors.length > 0) priceWithDirectColor += 1;
        else priceWithoutDirectColor += 1;
        priceRows.push({
          line: blockSegment.line_number,
          price_count: prices.length,
          direct_color_count: colors.length,
          direct_conditions: conditions,
          inherited_condition: blockSegment.inherited_context?.condition
            ? {
                value: blockSegment.inherited_context.condition.value,
                source_line: blockSegment.inherited_context.condition.source_line
              }
            : null
        });
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
      price_rows: priceRows,
      structural_rows: structuralRows,
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


function localHeader15128Diagnostics(bundle) {
  const segments = bundle.segments || [];
  const records = bundle.records || [];
  const headers = [];

  for (let index = 0; index < segments.length; index += 1) {
    const segment = segments[index];
    const normalized = String(segment.normalized || '');
    if (/iphone/i.test(normalized)) continue;
    if (!/^[^A-Za-z0-9]{0,12}15\s+128(?:\s*GB)?(?=\D|$)/i.test(normalized)) continue;

    let end = segments.length;
    for (let j = index + 1; j < segments.length; j += 1) {
      const next = segments[j];
      const boundary = (next.context_events || []).some(event =>
        event.reason === 'product_header_boundary' ||
        event.reason === 'timestamp_boundary' ||
        event.reason === 'domain_boundary'
      );
      if (boundary) { end = j; break; }
    }

    const block = segments.slice(index, end);
    const blockLines = new Set(block.map(s => Number(s.line_number)));
    const conditions = distinctFieldValues(segment, 'condition').map(value => JSON.parse(value));
    const modelCandidates = (segment.field_candidates || [])
      .filter(candidate => candidate.field === 'model')
      .map(candidate => String(candidate.value));
    const semanticModels = (segment.semantic_candidates || [])
      .filter(candidate => candidate.field === 'model')
      .map(candidate => ({ state: candidate.state, entity_id: candidate.entity_id || null }));

    const priceRows = [];
    const structuralRows = [];
    let colorOnlyRows = 0;
    for (const blockSegment of block) {
      const prices = distinctFieldValues(blockSegment, 'price');
      const colors = distinctFieldValues(blockSegment, 'color');
      const rowConditions = distinctFieldValues(blockSegment, 'condition').map(value => JSON.parse(value));

      const rowModels = distinctFieldValues(blockSegment, 'model').map(value => JSON.parse(value));
      const rowCapacities = distinctFieldValues(blockSegment, 'capacity_gb').map(value => JSON.parse(value));
      structuralRows.push({
        line: blockSegment.line_number,
        model_candidates: rowModels,
        capacity_candidates: rowCapacities,
        condition_candidates: rowConditions,
        color_count: colors.length,
        price_count: prices.length,
        context_event_reasons: (blockSegment.context_events || []).map(event => event.reason || event.type).filter(Boolean),
        inherited_model_source_line: blockSegment.inherited_context?.model?.source_line || null,
        inherited_condition_source_line: blockSegment.inherited_context?.condition?.source_line || null
      });
      if (prices.length > 0) {
        priceRows.push({
          line: blockSegment.line_number,
          price_count: prices.length,
          direct_color_count: colors.length,
          direct_conditions: rowConditions,
          inherited_condition: blockSegment.inherited_context?.condition
            ? {
                value: blockSegment.inherited_context.condition.value,
                source_line: blockSegment.inherited_context.condition.source_line
              }
            : null
        });
      }
      if (colors.length > 0 && prices.length === 0 && isFieldOnlySegment(blockSegment, 'color')) {
        colorOnlyRows += 1;
      }
    }

    const blockRecords = records.filter(record => {
      const priceTrace = (record.trace || []).find(trace => trace.field === 'price');
      const line = Array.isArray(priceTrace?.sources) ? Number(priceTrace.sources[0]) : null;
      return line != null && blockLines.has(line);
    });

    headers.push({
      line: segment.line_number,
      has_lacrado: /\blacrad[oa]s?\b/i.test(normalized),
      has_cpo: /\bcpo\b/i.test(normalized),
      has_seminovo: /\bseminov[oa]s?\b/i.test(normalized),
      has_nacional: /\bnacional\b/i.test(normalized),
      has_nf: /(?:^|\s)nf(?:\s|$)/i.test(normalized),
      has_importado: /\bimportad[oa]s?\b/i.test(normalized),
      has_esim: /\be\s*sim\b|\besim\b/i.test(normalized),
      has_chip_fisico: /\bchip\s+f[ií]sico\b/i.test(normalized),
      has_chip_virtual: /\bchip\s+virtual\b/i.test(normalized),
      direct_conditions: conditions,
      model_candidates: modelCandidates,
      semantic_models: semanticModels,
      block_segment_count: block.length,
      price_rows: priceRows,
      structural_rows: structuralRows,
      color_only_rows: colorOnlyRows,
      materialized_records: blockRecords.length,
      materialized_15_128: blockRecords.filter(record => record.fields?.model?.id === 'iphone_15_128gb').length
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
    const colorRows = [];
    let directConditionRows = 0;
    const directConditions = {};
    const priceContext = [];

    for (const segment of slice) {
      const prices = distinctFieldValues(segment, 'price');
      const colors = distinctFieldValues(segment, 'color');
      const conditions = distinctFieldValues(segment, 'condition').map(value => JSON.parse(value));

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

      if (colors.length > 0) {
        colorRows.push({
          line: segment.line_number,
          colors: colors.map(value => JSON.parse(value)),
          price_count: prices.length,
          field_only_color: prices.length === 0 && isFieldOnlySegment(segment, 'color')
        });
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
      color_rows: colorRows,
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


function targetModelPairDiagnostics(legacyBundle, coreBundle, modelId) {
  const coreOffers = (coreBundle.records || [])
    .map(record => ({
      fields: record.fields || {},
      core_record_id: record.record_id,
      trace: record.trace || []
    }))
    .filter(offer => offer.fields?.model?.id && Number.isFinite(Number(offer.fields?.price)));

  const base = removeExactMatches(legacyBundle.offers || [], coreOffers);
  const paired = pairWithinModel(base.remainingLegacy, base.remainingCore);

  const countConditions = offers => {
    const out = {};
    for (const offer of offers) {
      if (normFields(offer).model !== modelId) continue;
      const condition = normFields(offer).condition ?? '(null)';
      out[condition] = (out[condition] || 0) + 1;
    }
    return out;
  };

  const pairs = [];
  for (const pair of paired.pairs) {
    if (normFields(pair.legacy).model !== modelId) continue;
    const conditionTrace = (pair.core.trace || []).find(trace => trace.field === 'condition');
    const modelTrace = (pair.core.trace || []).find(trace => trace.field === 'model');
    const priceTrace = (pair.core.trace || []).find(trace => trace.field === 'price');
    pairs.push({
      core_record_id: pair.core.core_record_id,
      price_line: Array.isArray(priceTrace?.sources) ? Number(priceTrace.sources[0]) : null,
      model_source_line: Array.isArray(modelTrace?.sources) ? Number(modelTrace.sources[0]) : null,
      diffs: pair.diffs,
      legacy_condition: normFields(pair.legacy).condition ?? '(null)',
      core_condition: normFields(pair.core).condition ?? '(null)',
      condition_source_lines: Array.isArray(conditionTrace?.sources)
        ? conditionTrace.sources.map(Number)
        : [],
      condition_rules: Array.isArray(conditionTrace?.rules) ? conditionTrace.rules : []
    });
  }

  const unpairedLegacyDetails = (paired.unpairedLegacy || [])
    .filter(offer => normFields(offer).model === modelId)
    .map(offer => ({
      legacy_record_id: offer.legacy_record_id || null,
      product_index: offer.metadata?.product_index ?? null,
      condition: normFields(offer).condition ?? '(null)',
      color: normFields(offer).color ?? '(null)',
      capacity_gb: normFields(offer).capacity_gb,
      supplier_present: Boolean(String(offer.metadata?.supplier ?? '').trim())
    }));

  return {
    model_id: modelId,
    paired_non_exact: pairs,
    unpaired_legacy_by_condition: countConditions(paired.unpairedLegacy),
    unpaired_core_by_condition: countConditions(paired.unpairedCore),
    unpaired_legacy_details: unpairedLegacyDetails
  };
}


function whatIf16ProMaxShorthand(rawDocument, baseSchema, baseKnowledge, legacyBundle, baseCoreBundle, options = {}) {
  const candidateSchema = JSON.parse(JSON.stringify(baseSchema));
  const candidateKnowledge = JSON.parse(JSON.stringify(baseKnowledge));

  const modelField = (candidateSchema.fields || []).find(field => field.name === 'model');
  const capacityField = (candidateSchema.fields || []).find(field => field.name === 'capacity_gb');
  if (!modelField || !capacityField) {
    throw new Error('what-if 16 Pro Max: schema sem model/capacity_gb');
  }

  modelField.extractors = [...(modelField.extractors || []), {
    id: 'what_if_16_promax_256_model',
    kind: 'regex',
    pattern: options.require_cpo_same_header === true
      ? '^[^A-Za-z0-9]{0,12}(16\\s+Pro\\s+Max\\s+256\\s*(?:GB)?)(?=.*\\bCPO\\b)'
      : '^[^A-Za-z0-9]{0,12}(16\\s+Pro\\s+Max\\s+256\\s*(?:GB)?)(?=\\D|$)',
    flags: 'i',
    group: 1,
    transform: 'trim',
    score: 0.91
  }];

  capacityField.extractors = [...(capacityField.extractors || []), {
    id: 'what_if_16_promax_256_capacity',
    kind: 'regex',
    pattern: options.require_cpo_same_header === true
      ? '^[^A-Za-z0-9]{0,12}16\\s+Pro\\s+Max\\s+(256)(?:\\s*GB)?(?=.*\\bCPO\\b)'
      : '^[^A-Za-z0-9]{0,12}16\\s+Pro\\s+Max\\s+(256)(?:\\s*GB)?(?=\\D|$)',
    flags: 'i',
    group: 1,
    transform: 'integer',
    score: 0.9
  }];

  const aliases = Array.isArray(candidateKnowledge.aliases) ? candidateKnowledge.aliases : [];
  for (const text of ['16 Pro Max 256GB', '16 Pro Max 256']) {
    if (!aliases.some(alias =>
      alias.kind === 'model' &&
      alias.text === text &&
      alias.target_id === 'iphone_16_pro_max_256gb'
    )) {
      aliases.push({
        kind: 'model',
        text,
        normalized: null,
        target_id: 'iphone_16_pro_max_256gb'
      });
    }
  }
  candidateKnowledge.aliases = aliases;

  const candidateBundle = interpretResolved({
    document: {
      contract_version: 'raw-document/v1',
      document_id: options.require_cpo_same_header === true
        ? 'real-load-shadow-what-if-16-promax-cpo'
        : 'real-load-shadow-what-if-16-promax',
      content: rawDocument,
      source: { kind: 'plain_text' }
    },
    schema: candidateSchema,
    knowledge: candidateKnowledge
  });

  const candidateReport = compareSemanticShadow({ legacy: legacyBundle, coreBundle: candidateBundle });
  const candidateNoColor = compareSemanticShadow({
    legacy: legacyBundle,
    coreBundle: candidateBundle,
    options: { include_color: false }
  });
  const candidateDivergence = analyzeDivergences({ legacy: legacyBundle, coreBundle: candidateBundle });
  const targetGap = (candidateDivergence.top_model_gaps || [])
    .find(row => row.model === 'iphone_16_pro_max_256gb') || null;

  const candidateCoreOffers = (candidateBundle.records || [])
    .map(record => ({
      fields: record.fields || {},
      core_record_id: record.record_id,
      trace: record.trace || []
    }))
    .filter(offer => offer.fields?.model?.id && Number.isFinite(Number(offer.fields?.price)));

  const baseRecordIds = new Set((baseCoreBundle.records || []).map(record => record.record_id));
  const exactRemoval = removeExactMatches(legacyBundle.offers || [], candidateCoreOffers);
  const remainingIds = new Set((exactRemoval.remainingCore || []).map(offer => offer.core_record_id));
  const residualPairs = pairWithinModel(exactRemoval.remainingLegacy, exactRemoval.remainingCore);
  const residualDiffsById = new Map(
    (residualPairs.pairs || []).map(pair => [pair.core.core_record_id, pair.diffs])
  );
  const residualPairById = new Map(
    (residualPairs.pairs || []).map(pair => [pair.core.core_record_id, pair])
  );
  const unpairedIds = new Set((residualPairs.unpairedCore || []).map(offer => offer.core_record_id));

  const addedRecords = candidateCoreOffers
    .filter(offer =>
      offer.fields?.model?.id === 'iphone_16_pro_max_256gb' &&
      !baseRecordIds.has(offer.core_record_id)
    )
    .map(offer => {
      const priceTrace = (offer.trace || []).find(trace => trace.field === 'price');
      const modelTrace = (offer.trace || []).find(trace => trace.field === 'model');
      const conditionTrace = (offer.trace || []).find(trace => trace.field === 'condition');
      const diffs = residualDiffsById.get(offer.core_record_id) || [];
      const classification = !remainingIds.has(offer.core_record_id)
        ? 'exact'
        : residualDiffsById.has(offer.core_record_id)
          ? (diffs.length === 1 && diffs[0] === 'price' ? 'wrong_price_only' : 'field_mismatch')
          : unpairedIds.has(offer.core_record_id)
            ? 'extra'
            : 'residual_unclassified';
      return {
        core_record_id: offer.core_record_id,
        price_line: Array.isArray(priceTrace?.sources) ? Number(priceTrace.sources[0]) : null,
        model_source_line: Array.isArray(modelTrace?.sources) ? Number(modelTrace.sources[0]) : null,
        condition: offer.fields?.condition ?? '(null)',
        color: offer.fields?.color ?? '(null)',
        condition_source_lines: Array.isArray(conditionTrace?.sources)
          ? conditionTrace.sources.map(Number)
          : [],
        condition_rules: Array.isArray(conditionTrace?.rules) ? conditionTrace.rules : [],
        classification,
        diffs
      };
    });


  const targetWrongPriceRecords = (residualPairs.pairs || [])
    .filter(pair =>
      normFields(pair.legacy).model === 'iphone_16_pro_max_256gb' &&
      pair.diffs.length === 1 &&
      pair.diffs[0] === 'price'
    )
    .map(pair => {
      const priceTrace = (pair.core.trace || []).find(trace => trace.field === 'price');
      const modelTrace = (pair.core.trace || []).find(trace => trace.field === 'model');
      const conditionTrace = (pair.core.trace || []).find(trace => trace.field === 'condition');
      const colorTrace = (pair.core.trace || []).find(trace => trace.field === 'color');
      return {
        core_record_id: pair.core.core_record_id,
        existed_in_baseline: baseRecordIds.has(pair.core.core_record_id),
        price_line: Array.isArray(priceTrace?.sources) ? Number(priceTrace.sources[0]) : null,
        model_source_line: Array.isArray(modelTrace?.sources) ? Number(modelTrace.sources[0]) : null,
        condition: normFields(pair.core).condition ?? '(null)',
        color: normFields(pair.core).color ?? '(null)',
        condition_source_lines: Array.isArray(conditionTrace?.sources)
          ? conditionTrace.sources.map(Number)
          : [],
        condition_rules: Array.isArray(conditionTrace?.rules) ? conditionTrace.rules : [],
        color_source_lines: Array.isArray(colorTrace?.sources)
          ? colorTrace.sources.map(Number)
          : [],
        color_rules: Array.isArray(colorTrace?.rules) ? colorTrace.rules : []
      };
    });

  const baselineTargetBlocks = targetModelBlockDiagnostics(baseCoreBundle, 'iphone_16_pro_max_256gb');
  const candidateTargetBlocks = targetModelBlockDiagnostics(candidateBundle, 'iphone_16_pro_max_256gb');
  const baselineAnchors = new Set(
    (baselineTargetBlocks.block_summaries || []).map(block => Number(block.anchor_line))
  );
  const newlyRecognizedBlocks = (candidateTargetBlocks.block_summaries || [])
    .filter(block => !baselineAnchors.has(Number(block.anchor_line)));

  return {
    candidate: options.candidate || 'explicit_16_pro_max_256_shorthand',
    metrics: {
      core_offers: candidateReport.metrics.core_offers,
      matched_offers: candidateReport.metrics.matched_offers,
      missing_offers: candidateReport.metrics.missing_offers,
      extra_offers: candidateReport.metrics.extra_offers,
      agreement_ratio: candidateReport.metrics.agreement_ratio,
      agreement_ratio_without_color: candidateNoColor.metrics.agreement_ratio,
      no_silent_wrong_price: candidateReport.gates.no_silent_wrong_price,
      exact_multiset: candidateReport.gates.exact_multiset
    },
    divergence_categories: candidateDivergence.categories,
    target_model_gap: targetGap,
    added_target_records: addedRecords,
    target_wrong_price_records: targetWrongPriceRecords,
    wrong_price_diagnostics: candidateDivergence.wrong_price_diagnostics,
    newly_recognized_target_blocks: newlyRecognizedBlocks
  };
}


function whatIf16Base128Shorthand(rawDocument, baseSchema, baseKnowledge, legacyBundle, baseCoreBundle, options = {}) {
  const candidateSchema = JSON.parse(JSON.stringify(baseSchema));
  const candidateKnowledge = JSON.parse(JSON.stringify(baseKnowledge));
  const targetModelId = 'iphone_16_128gb';

  const modelField = (candidateSchema.fields || []).find(field => field.name === 'model');
  const capacityField = (candidateSchema.fields || []).find(field => field.name === 'capacity_gb');
  if (!modelField || !capacityField) {
    throw new Error('what-if 16 128: schema sem model/capacity_gb');
  }

  modelField.extractors = [...(modelField.extractors || []), {
    id: 'what_if_16_128_model',
    kind: 'regex',
    pattern: options.require_lacrado_same_header === true
      ? '^[^A-Za-z0-9]{0,12}(16\\s+128\\s*(?:GB)?)(?=.*\\bLacrad[oa]s?\\b)'
      : '^[^A-Za-z0-9]{0,12}(16\\s+128\\s*(?:GB)?)(?=\\D|$)',
    flags: 'i',
    group: 1,
    transform: 'trim',
    score: 0.91
  }];

  capacityField.extractors = [...(capacityField.extractors || []), {
    id: 'what_if_16_128_capacity',
    kind: 'regex',
    pattern: options.require_lacrado_same_header === true
      ? '^[^A-Za-z0-9]{0,12}16\\s+(128)(?:\\s*GB)?(?=.*\\bLacrad[oa]s?\\b)'
      : '^[^A-Za-z0-9]{0,12}16\\s+(128)(?:\\s*GB)?(?=\\D|$)',
    flags: 'i',
    group: 1,
    transform: 'integer',
    score: 0.9
  }];

  const aliases = Array.isArray(candidateKnowledge.aliases) ? candidateKnowledge.aliases : [];
  for (const text of ['16 128GB', '16 128']) {
    if (!aliases.some(alias =>
      alias.kind === 'model' &&
      alias.text === text &&
      alias.target_id === targetModelId
    )) {
      aliases.push({
        kind: 'model',
        text,
        normalized: null,
        target_id: targetModelId
      });
    }
  }
  candidateKnowledge.aliases = aliases;

  const candidateBundle = interpretResolved({
    document: {
      contract_version: 'raw-document/v1',
      document_id: options.require_lacrado_same_header === true
        ? 'real-load-shadow-what-if-16-128-lacrado'
        : 'real-load-shadow-what-if-16-128',
      content: rawDocument,
      source: { kind: 'plain_text' }
    },
    schema: candidateSchema,
    knowledge: candidateKnowledge
  });

  const candidateReport = compareSemanticShadow({ legacy: legacyBundle, coreBundle: candidateBundle });
  const candidateNoColor = compareSemanticShadow({
    legacy: legacyBundle,
    coreBundle: candidateBundle,
    options: { include_color: false }
  });
  const candidateDivergence = analyzeDivergences({ legacy: legacyBundle, coreBundle: candidateBundle });
  const targetGap = (candidateDivergence.top_model_gaps || [])
    .find(row => row.model === targetModelId) || null;

  const candidateCoreOffers = (candidateBundle.records || [])
    .map(record => ({
      fields: record.fields || {},
      core_record_id: record.record_id,
      trace: record.trace || []
    }))
    .filter(offer => offer.fields?.model?.id && Number.isFinite(Number(offer.fields?.price)));

  const baseRecordIds = new Set((baseCoreBundle.records || []).map(record => record.record_id));
  const exactRemoval = removeExactMatches(legacyBundle.offers || [], candidateCoreOffers);
  const remainingIds = new Set((exactRemoval.remainingCore || []).map(offer => offer.core_record_id));
  const residualPairs = pairWithinModel(exactRemoval.remainingLegacy, exactRemoval.remainingCore);
  const residualDiffsById = new Map(
    (residualPairs.pairs || []).map(pair => [pair.core.core_record_id, pair.diffs])
  );
  const unpairedIds = new Set((residualPairs.unpairedCore || []).map(offer => offer.core_record_id));

  const addedRecords = candidateCoreOffers
    .filter(offer =>
      offer.fields?.model?.id === targetModelId &&
      !baseRecordIds.has(offer.core_record_id)
    )
    .map(offer => {
      const priceTrace = (offer.trace || []).find(trace => trace.field === 'price');
      const modelTrace = (offer.trace || []).find(trace => trace.field === 'model');
      const conditionTrace = (offer.trace || []).find(trace => trace.field === 'condition');
      const colorTrace = (offer.trace || []).find(trace => trace.field === 'color');
      const diffs = residualDiffsById.get(offer.core_record_id) || [];
      const classification = !remainingIds.has(offer.core_record_id)
        ? 'exact'
        : residualDiffsById.has(offer.core_record_id)
          ? (diffs.length === 1 && diffs[0] === 'price' ? 'wrong_price_only' : 'field_mismatch')
          : unpairedIds.has(offer.core_record_id)
            ? 'extra'
            : 'residual_unclassified';

      return {
        core_record_id: offer.core_record_id,
        price_line: Array.isArray(priceTrace?.sources) ? Number(priceTrace.sources[0]) : null,
        model_source_line: Array.isArray(modelTrace?.sources) ? Number(modelTrace.sources[0]) : null,
        condition: normFields(offer).condition ?? '(null)',
        color: normFields(offer).color ?? '(null)',
        condition_source_lines: Array.isArray(conditionTrace?.sources)
          ? conditionTrace.sources.map(Number)
          : [],
        condition_rules: Array.isArray(conditionTrace?.rules) ? conditionTrace.rules : [],
        color_source_lines: Array.isArray(colorTrace?.sources)
          ? colorTrace.sources.map(Number)
          : [],
        color_rules: Array.isArray(colorTrace?.rules) ? colorTrace.rules : [],
        classification,
        diffs
      };
    });

  const baselineTargetBlocks = targetModelBlockDiagnostics(baseCoreBundle, targetModelId);
  const candidateTargetBlocks = targetModelBlockDiagnostics(candidateBundle, targetModelId);
  const baselineAnchors = new Set(
    (baselineTargetBlocks.block_summaries || []).map(block => Number(block.anchor_line))
  );
  const newlyRecognizedBlocks = (candidateTargetBlocks.block_summaries || [])
    .filter(block => !baselineAnchors.has(Number(block.anchor_line)));

  const classificationCounts = {};
  for (const record of addedRecords) {
    classificationCounts[record.classification] = (classificationCounts[record.classification] || 0) + 1;
  }

  return {
    candidate: options.candidate || 'explicit_16_128_shorthand',
    metrics: {
      core_offers: candidateReport.metrics.core_offers,
      matched_offers: candidateReport.metrics.matched_offers,
      missing_offers: candidateReport.metrics.missing_offers,
      extra_offers: candidateReport.metrics.extra_offers,
      agreement_ratio: candidateReport.metrics.agreement_ratio,
      agreement_ratio_without_color: candidateNoColor.metrics.agreement_ratio,
      no_silent_wrong_price: candidateReport.gates.no_silent_wrong_price,
      exact_multiset: candidateReport.gates.exact_multiset
    },
    divergence_categories: candidateDivergence.categories,
    target_model_gap: targetGap,
    added_target_record_classifications: classificationCounts,
    added_target_records: addedRecords,
    newly_recognized_target_blocks: newlyRecognizedBlocks
  };
}

function whatIfScopedBase128Shorthand(rawDocument, baseSchema, baseKnowledge, legacyBundle, baseCoreBundle, options) {
  const generation = String(options.generation || '').trim();
  const targetModelId = String(options.target_model_id || '').trim();
  const condition = String(options.condition || '').trim();
  const conditionPattern = condition === 'Lacrado'
    ? 'Lacrad[oa]s?'
    : condition === 'Seminovo'
      ? 'Seminov[oa]s?'
      : null;

  if (!generation || !targetModelId || !conditionPattern) {
    throw new Error('what-if scoped base 128: options incompletas');
  }

  const candidateSchema = JSON.parse(JSON.stringify(baseSchema));
  const candidateKnowledge = JSON.parse(JSON.stringify(baseKnowledge));
  const modelField = (candidateSchema.fields || []).find(field => field.name === 'model');
  const capacityField = (candidateSchema.fields || []).find(field => field.name === 'capacity_gb');
  if (!modelField || !capacityField) throw new Error('what-if scoped base 128: schema sem model/capacity_gb');

  modelField.extractors = [...(modelField.extractors || []), {
    id: 'what_if_' + generation + '_128_' + condition.toLowerCase() + '_model',
    kind: 'regex',
    pattern: '^[^A-Za-z0-9]{0,12}(' + generation + '\\s+128\\s*(?:GB)?)(?=.*\\b' + conditionPattern + '\\b)',
    flags: 'i', group: 1, transform: 'trim', score: 0.91,
    context_expire_on_field_declaration: options.expire_model_on_condition_declaration === true
      ? ['condition']
      : null
  }];

  capacityField.extractors = [...(capacityField.extractors || []), {
    id: 'what_if_' + generation + '_128_' + condition.toLowerCase() + '_capacity',
    kind: 'regex',
    pattern: '^[^A-Za-z0-9]{0,12}' + generation + '\\s+(128)(?:\\s*GB)?(?=.*\\b' + conditionPattern + '\\b)',
    flags: 'i', group: 1, transform: 'integer', score: 0.9
  }];

  const aliases = Array.isArray(candidateKnowledge.aliases) ? candidateKnowledge.aliases : [];
  for (const text of [generation + ' 128GB', generation + ' 128']) {
    if (!aliases.some(alias => alias.kind === 'model' && alias.text === text && alias.target_id === targetModelId)) {
      aliases.push({ kind: 'model', text, normalized: null, target_id: targetModelId });
    }
  }
  candidateKnowledge.aliases = aliases;

  const candidateBundle = interpretResolved({
    document: {
      contract_version: 'raw-document/v1',
      document_id: 'real-load-shadow-what-if-' + generation + '-128-' + condition.toLowerCase(),
      content: rawDocument,
      source: { kind: 'plain_text' }
    },
    schema: candidateSchema,
    knowledge: candidateKnowledge
  });

  const candidateReport = compareSemanticShadow({ legacy: legacyBundle, coreBundle: candidateBundle });
  const candidateNoColor = compareSemanticShadow({ legacy: legacyBundle, coreBundle: candidateBundle, options: { include_color: false } });
  const candidateDivergence = analyzeDivergences({ legacy: legacyBundle, coreBundle: candidateBundle });
  const candidateCoreOffers = (candidateBundle.records || []).map(record => ({
    fields: record.fields || {}, core_record_id: record.record_id, trace: record.trace || []
  })).filter(offer => offer.fields?.model?.id && Number.isFinite(Number(offer.fields?.price)));

  const baseRecordIds = new Set((baseCoreBundle.records || []).map(record => record.record_id));
  const exactRemoval = removeExactMatches(legacyBundle.offers || [], candidateCoreOffers);
  const remainingIds = new Set((exactRemoval.remainingCore || []).map(offer => offer.core_record_id));
  const residualPairs = pairWithinModel(exactRemoval.remainingLegacy, exactRemoval.remainingCore);
  const residualDiffsById = new Map((residualPairs.pairs || []).map(pair => [pair.core.core_record_id, pair.diffs]));
  const unpairedIds = new Set((residualPairs.unpairedCore || []).map(offer => offer.core_record_id));

  const addedRecords = candidateCoreOffers.filter(offer =>
    offer.fields?.model?.id === targetModelId && !baseRecordIds.has(offer.core_record_id)
  ).map(offer => {
    const priceTrace = (offer.trace || []).find(trace => trace.field === 'price');
    const modelTrace = (offer.trace || []).find(trace => trace.field === 'model');
    const conditionTrace = (offer.trace || []).find(trace => trace.field === 'condition');
    const colorTrace = (offer.trace || []).find(trace => trace.field === 'color');
    const diffs = residualDiffsById.get(offer.core_record_id) || [];
    const classification = !remainingIds.has(offer.core_record_id)
      ? 'exact'
      : residualDiffsById.has(offer.core_record_id)
        ? (diffs.length === 1 && diffs[0] === 'price' ? 'wrong_price_only' : 'field_mismatch')
        : unpairedIds.has(offer.core_record_id) ? 'extra' : 'residual_unclassified';
    return {
      core_record_id: offer.core_record_id,
      price_line: Array.isArray(priceTrace?.sources) ? Number(priceTrace.sources[0]) : null,
      model_source_line: Array.isArray(modelTrace?.sources) ? Number(modelTrace.sources[0]) : null,
      condition: normFields(offer).condition ?? '(null)',
      color: normFields(offer).color ?? '(null)',
      condition_source_lines: Array.isArray(conditionTrace?.sources) ? conditionTrace.sources.map(Number) : [],
      condition_rules: Array.isArray(conditionTrace?.rules) ? conditionTrace.rules : [],
      color_source_lines: Array.isArray(colorTrace?.sources) ? colorTrace.sources.map(Number) : [],
      color_rules: Array.isArray(colorTrace?.rules) ? colorTrace.rules : [],
      classification, diffs
    };
  });

  const classificationCounts = {};
  for (const record of addedRecords) classificationCounts[record.classification] = (classificationCounts[record.classification] || 0) + 1;

  const baselineTargetBlocks = targetModelBlockDiagnostics(baseCoreBundle, targetModelId);
  const candidateTargetBlocks = targetModelBlockDiagnostics(candidateBundle, targetModelId);
  const baselineAnchors = new Set(
    (baselineTargetBlocks.block_summaries || []).map(block => Number(block.anchor_line))
  );
  const newlyRecognizedBlocks = (candidateTargetBlocks.block_summaries || [])
    .filter(block => !baselineAnchors.has(Number(block.anchor_line)));

  return {
    candidate: options.candidate || generation + '_128_' + condition.toLowerCase() + '_same_header',
    metrics: {
      core_offers: candidateReport.metrics.core_offers,
      matched_offers: candidateReport.metrics.matched_offers,
      missing_offers: candidateReport.metrics.missing_offers,
      extra_offers: candidateReport.metrics.extra_offers,
      agreement_ratio: candidateReport.metrics.agreement_ratio,
      agreement_ratio_without_color: candidateNoColor.metrics.agreement_ratio,
      no_silent_wrong_price: candidateReport.gates.no_silent_wrong_price,
      exact_multiset: candidateReport.gates.exact_multiset
    },
    divergence_categories: candidateDivergence.categories,
    target_model_gap: (candidateDivergence.top_model_gaps || []).find(row => row.model === targetModelId) || null,
    added_target_record_classifications: classificationCounts,
    added_target_records: addedRecords,
    newly_recognized_target_blocks: newlyRecognizedBlocks
  };
}


function whatIf17256ImportadoEsimShorthand(rawDocument, baseSchema, baseKnowledge, legacyBundle, baseCoreBundle) {
  const targetModelId = 'iphone_17_256gb';
  const candidateSchema = JSON.parse(JSON.stringify(baseSchema));
  const candidateKnowledge = JSON.parse(JSON.stringify(baseKnowledge));
  const modelField = (candidateSchema.fields || []).find(field => field.name === 'model');
  const capacityField = (candidateSchema.fields || []).find(field => field.name === 'capacity_gb');
  if (!modelField || !capacityField) throw new Error('what-if 17 256 importado eSIM: schema sem model/capacity_gb');

  const scopeSuffix = '(?=.*\\bImportad[oa]s?\\b)(?=.*(?:\\be\\s*sim\\b|\\besim\\b))';
  modelField.extractors = [...(modelField.extractors || []), {
    id: 'what_if_17_256_importado_esim_model',
    kind: 'regex',
    pattern: '^[^A-Za-z0-9]{0,12}(17\\s+256\\s*(?:GB)?)' + scopeSuffix,
    flags: 'i', group: 1, transform: 'trim', score: 0.91
  }];
  capacityField.extractors = [...(capacityField.extractors || []), {
    id: 'what_if_17_256_importado_esim_capacity',
    kind: 'regex',
    pattern: '^[^A-Za-z0-9]{0,12}17\\s+(256)(?:\\s*GB)?' + scopeSuffix,
    flags: 'i', group: 1, transform: 'integer', score: 0.9
  }];

  const aliases = Array.isArray(candidateKnowledge.aliases) ? candidateKnowledge.aliases : [];
  for (const text of ['17 256GB', '17 256']) {
    if (!aliases.some(alias => alias.kind === 'model' && alias.text === text && alias.target_id === targetModelId)) {
      aliases.push({ kind: 'model', text, normalized: null, target_id: targetModelId });
    }
  }
  candidateKnowledge.aliases = aliases;

  const candidateBundle = interpretResolved({
    document: {
      contract_version: 'raw-document/v1',
      document_id: 'real-load-shadow-what-if-17-256-importado-esim',
      content: rawDocument,
      source: { kind: 'plain_text' }
    },
    schema: candidateSchema,
    knowledge: candidateKnowledge
  });

  const candidateReport = compareSemanticShadow({ legacy: legacyBundle, coreBundle: candidateBundle });
  const candidateNoColor = compareSemanticShadow({
    legacy: legacyBundle,
    coreBundle: candidateBundle,
    options: { include_color: false }
  });
  const candidateDivergence = analyzeDivergences({ legacy: legacyBundle, coreBundle: candidateBundle });

  const candidateCoreOffers = (candidateBundle.records || []).map(record => ({
    fields: record.fields || {}, core_record_id: record.record_id, trace: record.trace || []
  })).filter(offer => offer.fields?.model?.id && Number.isFinite(Number(offer.fields?.price)));

  const baseRecordIds = new Set((baseCoreBundle.records || []).map(record => record.record_id));
  const exactRemoval = removeExactMatches(legacyBundle.offers || [], candidateCoreOffers);
  const remainingIds = new Set((exactRemoval.remainingCore || []).map(offer => offer.core_record_id));
  const residualPairs = pairWithinModel(exactRemoval.remainingLegacy, exactRemoval.remainingCore);
  const residualDiffsById = new Map((residualPairs.pairs || []).map(pair => [pair.core.core_record_id, pair.diffs]));
  const unpairedIds = new Set((residualPairs.unpairedCore || []).map(offer => offer.core_record_id));

  const addedRecords = candidateCoreOffers.filter(offer =>
    offer.fields?.model?.id === targetModelId && !baseRecordIds.has(offer.core_record_id)
  ).map(offer => {
    const priceTrace = (offer.trace || []).find(trace => trace.field === 'price');
    const modelTrace = (offer.trace || []).find(trace => trace.field === 'model');
    const conditionTrace = (offer.trace || []).find(trace => trace.field === 'condition');
    const colorTrace = (offer.trace || []).find(trace => trace.field === 'color');
    const diffs = residualDiffsById.get(offer.core_record_id) || [];
    const classification = !remainingIds.has(offer.core_record_id)
      ? 'exact'
      : residualDiffsById.has(offer.core_record_id)
        ? (diffs.length === 1 && diffs[0] === 'price' ? 'wrong_price_only' : 'field_mismatch')
        : unpairedIds.has(offer.core_record_id) ? 'extra' : 'residual_unclassified';
    return {
      core_record_id: offer.core_record_id,
      price_line: Array.isArray(priceTrace?.sources) ? Number(priceTrace.sources[0]) : null,
      model_source_line: Array.isArray(modelTrace?.sources) ? Number(modelTrace.sources[0]) : null,
      condition: normFields(offer).condition ?? '(null)',
      color: normFields(offer).color ?? '(null)',
      condition_source_lines: Array.isArray(conditionTrace?.sources) ? conditionTrace.sources.map(Number) : [],
      condition_rules: Array.isArray(conditionTrace?.rules) ? conditionTrace.rules : [],
      color_source_lines: Array.isArray(colorTrace?.sources) ? colorTrace.sources.map(Number) : [],
      color_rules: Array.isArray(colorTrace?.rules) ? colorTrace.rules : [],
      classification, diffs
    };
  });

  const classificationCounts = {};
  for (const record of addedRecords) {
    classificationCounts[record.classification] = (classificationCounts[record.classification] || 0) + 1;
  }

  const baselineTargetBlocks = targetModelBlockDiagnostics(baseCoreBundle, targetModelId);
  const candidateTargetBlocks = targetModelBlockDiagnostics(candidateBundle, targetModelId);
  const baselineAnchors = new Set(
    (baselineTargetBlocks.block_summaries || []).map(block => Number(block.anchor_line))
  );
  const newlyRecognizedBlocks = (candidateTargetBlocks.block_summaries || [])
    .filter(block => !baselineAnchors.has(Number(block.anchor_line)));

  return {
    candidate: '17_256_importado_esim_same_header',
    metrics: {
      core_offers: candidateReport.metrics.core_offers,
      matched_offers: candidateReport.metrics.matched_offers,
      missing_offers: candidateReport.metrics.missing_offers,
      extra_offers: candidateReport.metrics.extra_offers,
      agreement_ratio: candidateReport.metrics.agreement_ratio,
      agreement_ratio_without_color: candidateNoColor.metrics.agreement_ratio,
      no_silent_wrong_price: candidateReport.gates.no_silent_wrong_price,
      exact_multiset: candidateReport.gates.exact_multiset
    },
    divergence_categories: candidateDivergence.categories,
    target_model_gap: (candidateDivergence.top_model_gaps || []).find(row => row.model === targetModelId) || null,
    added_target_record_classifications: classificationCounts,
    added_target_records: addedRecords,
    newly_recognized_target_blocks: newlyRecognizedBlocks
  };
}


function invariantWrongPriceAdjudicationDiagnostics(legacyBundle, coreBundle) {
  const coreOffers = (coreBundle.records || []).map(record => ({
    fields: record.fields || {},
    core_record_id: record.record_id,
    trace: record.trace || []
  })).filter(offer => offer.fields?.model?.id && Number.isFinite(Number(offer.fields?.price)));

  const base = removeExactMatches(legacyBundle.offers || [], coreOffers);
  const nonPriceKey = offer => {
    const n = normFields(offer);
    return JSON.stringify([n.model, n.capacity_gb, n.condition, n.color]);
  };

  const legacyByKey = new Map();
  for (const offer of base.remainingLegacy) {
    const key = nonPriceKey(offer);
    if (!legacyByKey.has(key)) legacyByKey.set(key, []);
    legacyByKey.get(key).push(offer);
  }

  const out = [];
  for (const core of base.remainingCore) {
    const legacyCandidates = legacyByKey.get(nonPriceKey(core)) || [];
    if (!legacyCandidates.length) continue;

    const corePrice = normFields(core).price;
    const differentPriceLegacy = legacyCandidates.filter(legacy => normFields(legacy).price !== corePrice);
    if (!differentPriceLegacy.length) continue;

    const modelTrace = (core.trace || []).find(trace => trace.field === 'model');
    const priceTrace = (core.trace || []).find(trace => trace.field === 'price');
    const colorTrace = (core.trace || []).find(trace => trace.field === 'color');
    const modelSourceLine = Array.isArray(modelTrace?.sources) ? Number(modelTrace.sources[0]) : null;
    const priceLine = Array.isArray(priceTrace?.sources) ? Number(priceTrace.sources[0]) : null;
    const colorSourceLine = Array.isArray(colorTrace?.sources) ? Number(colorTrace.sources[0]) : null;

    const scopedSegments = (coreBundle.segments || []).filter(segment => {
      if (!Number.isFinite(modelSourceLine)) return false;
      if (Number(segment.line_number) < modelSourceLine) return false;
      const inheritedSource = Number(segment.inherited_context?.model?.source_line);
      if (Number.isFinite(inheritedSource) && inheritedSource === modelSourceLine) return true;
      return Number(segment.line_number) === modelSourceLine;
    });

    const distinctSuppliers = new Set(
      differentPriceLegacy
        .map(legacy => String(legacy.metadata?.supplier ?? '').trim())
        .filter(Boolean)
    );

    const legacyMatches = differentPriceLegacy.map(legacy => {
      const legacyPrice = normFields(legacy).price;
      const matchingLines = [];
      for (const segment of scopedSegments) {
        const prices = distinctFieldValues(segment, 'price').map(value => Number(JSON.parse(value)));
        if (!prices.some(price => Number.isFinite(price) && price === legacyPrice)) continue;
        const colors = distinctFieldValues(segment, 'color').map(value => JSON.parse(value));
        matchingLines.push({
          line: segment.line_number,
          direct_colors: colors,
          same_color_as_core: colors.some(color => normalizeKey(color) === normFields(core).color)
        });
      }

      const sameModelCoreWithLegacyPrice = coreOffers
        .filter(other =>
          normFields(other).model === normFields(core).model &&
          normFields(other).price === legacyPrice
        )
        .map(other => {
          const otherPriceTrace = (other.trace || []).find(trace => trace.field === 'price');
          return {
            core_record_id: other.core_record_id,
            price_line: Array.isArray(otherPriceTrace?.sources) ? Number(otherPriceTrace.sources[0]) : null,
            condition: normFields(other).condition,
            color: normFields(other).color
          };
        });

      return {
        legacy_record_id: legacy.legacy_record_id || null,
        product_index: legacy.metadata?.product_index ?? null,
        matching_direct_price_lines_in_same_model_scope: matchingLines,
        same_model_core_records_with_legacy_price: sameModelCoreWithLegacyPrice
      };
    });

    out.push({
      core_record_id: core.core_record_id,
      model: normFields(core).model,
      capacity_gb: normFields(core).capacity_gb,
      condition: normFields(core).condition,
      color: normFields(core).color,
      model_source_line: modelSourceLine,
      price_line: priceLine,
      color_source_line: colorSourceLine,
      price_is_direct_same_line: Number.isFinite(priceLine) && priceLine === colorSourceLine,
      legacy_same_nonprice_different_price_count: differentPriceLegacy.length,
      legacy_distinct_supplier_count: distinctSuppliers.size,
      legacy_matches: legacyMatches
    });
  }

  return {
    invariant_wrong_price_candidates: out.length,
    candidates: out
  };
}


function multiPriceNearestFallbackRiskDiagnostics(bundle) {
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
      event.reason === 'timestamp_boundary' ||
      event.reason === 'domain_boundary' ||
      event.reason === 'supplier_boundary' ||
      event.reason === 'product_header_boundary'
    );
    if (hardBoundary) close(index);

    const directModel = (segment.semantic_candidates || []).find(candidate =>
      candidate.field === 'model' &&
      (candidate.state === 'interpreted' || candidate.state === 'inferred') &&
      candidate.entity_id
    );
    const hasModelCandidate = (segment.field_candidates || []).some(candidate => candidate.field === 'model');

    if (hasModelCandidate) {
      close(index);
      if (directModel?.entity_id) {
        current = {
          start: index,
          anchor_line: segment.line_number,
          model_id: directModel.entity_id
        };
      }
    }
  }
  close(segments.length);

  const riskyBlocks = [];

  for (const block of blocks) {
    const slice = segments.slice(block.start, block.end);
    const multiPriceLines = slice
      .filter(segment => distinctFieldValues(segment, 'price').length > 1)
      .map(segment => segment.line_number);

    if (!multiPriceLines.length) continue;

    const nearestTargets = [];
    for (const segment of slice) {
      const candidates = (segment.field_candidates || []).filter(candidate =>
        candidate.field === 'color' &&
        candidate.evidence?.kind === 'nearest_unique_pair'
      );
      if (!candidates.length) continue;

      nearestTargets.push({
        target_line: segment.line_number,
        source_lines: [...new Set(
          candidates
            .map(candidate => Number(candidate.evidence?.source_line))
            .filter(Number.isFinite)
        )],
        candidate_count: candidates.length,
        target_price_count: distinctFieldValues(segment, 'price').length
      });
    }

    if (!nearestTargets.length) continue;

    riskyBlocks.push({
      model_id: block.model_id,
      anchor_line: block.anchor_line,
      multi_price_lines: multiPriceLines,
      nearest_targets: nearestTargets
    });
  }

  return {
    risky_block_count: riskyBlocks.length,
    risky_target_count: riskyBlocks.reduce((n, block) => n + block.nearest_targets.length, 0),
    risky_blocks: riskyBlocks
  };
}


function targetModelBoundaryDiagnostics(bundle, modelId) {
  const segments = bundle.segments || [];
  const anchors = [];

  for (let index = 0; index < segments.length; index += 1) {
    const segment = segments[index];
    const directTarget = (segment.semantic_candidates || []).some(candidate =>
      candidate.field === 'model' &&
      candidate.entity_id === modelId &&
      (candidate.state === 'interpreted' || candidate.state === 'inferred')
    );
    if (!directTarget) continue;

    const rows = [];
    let lostAt = null;
    for (let cursor = index; cursor < segments.length && cursor <= index + 24; cursor += 1) {
      const row = segments[cursor];
      const inheritedModelSource = Number(row.inherited_context?.model?.source_line);
      const afterModelSource = Number(row.context_after?.model?.source_line);
      const modelCandidates = (row.field_candidates || [])
        .filter(candidate => candidate.field === 'model')
        .map(candidate => String(candidate.value));
      const semanticModels = (row.semantic_candidates || [])
        .filter(candidate => candidate.field === 'model')
        .map(candidate => ({
          state: candidate.state,
          entity_id: candidate.entity_id || null
        }));
      const eventReasons = (row.context_events || []).map(event => event.reason).filter(Boolean);

      rows.push({
        line: row.line_number,
        model_candidates: modelCandidates,
        semantic_models: semanticModels,
        condition_candidates: distinctFieldValues(row, 'condition').map(value => JSON.parse(value)),
        color_count: distinctFieldValues(row, 'color').length,
        price_count: distinctFieldValues(row, 'price').length,
        inherited_model_source_line: Number.isFinite(inheritedModelSource) ? inheritedModelSource : null,
        context_after_model_source_line: Number.isFinite(afterModelSource) ? afterModelSource : null,
        context_event_reasons: eventReasons
      });

      if (cursor > index && !lostAt) {
        const hadTargetBefore = Number(row.context_before?.model?.source_line) === Number(segment.line_number);
        const hasTargetAfter = Number(row.context_after?.model?.source_line) === Number(segment.line_number);
        if (hadTargetBefore && !hasTargetAfter) {
          lostAt = {
            line: row.line_number,
            event_reasons: eventReasons
          };
        }
      }

      if (cursor > index && modelCandidates.length > 0) break;
      if (lostAt && cursor >= index + 4) break;
    }

    anchors.push({
      anchor_line: segment.line_number,
      rows,
      first_context_loss: lostAt
    });
  }

  return {
    model_id: modelId,
    anchor_count: anchors.length,
    anchors
  };
}


function crossModelResidualDiagnostics(legacyBundle, coreBundle, legacyModelId) {
  const coreOffers = (coreBundle.records || []).map(record => ({
    fields: record.fields || {},
    core_record_id: record.record_id,
    trace: record.trace || []
  })).filter(offer => offer.fields?.model?.id && Number.isFinite(Number(offer.fields?.price)));

  const base = removeExactMatches(legacyBundle.offers || [], coreOffers);
  const paired = pairWithinModel(base.remainingLegacy, base.remainingCore);
  const residualLegacy = (paired.unpairedLegacy || []).filter(offer =>
    normFields(offer).model === legacyModelId
  );

  const matches = residualLegacy.map(legacy => {
    const target = normFields(legacy);
    const candidates = coreOffers.filter(core => {
      const n = normFields(core);
      return n.model !== target.model &&
        n.capacity_gb === target.capacity_gb &&
        n.condition === target.condition &&
        n.color === target.color &&
        n.price === target.price;
    }).map(core => {
      const priceTrace = (core.trace || []).find(trace => trace.field === 'price');
      const modelTrace = (core.trace || []).find(trace => trace.field === 'model');
      return {
        core_record_id: core.core_record_id,
        core_model: normFields(core).model,
        price_line: Array.isArray(priceTrace?.sources) ? Number(priceTrace.sources[0]) : null,
        model_source_line: Array.isArray(modelTrace?.sources) ? Number(modelTrace.sources[0]) : null
      };
    });

    return {
      legacy_record_id: legacy.legacy_record_id || null,
      product_index: legacy.metadata?.product_index ?? null,
      condition: target.condition ?? '(null)',
      color: target.color ?? '(null)',
      candidate_count: candidates.length,
      candidates
    };
  });

  const byCoreModel = {};
  for (const row of matches) {
    for (const candidate of row.candidates) {
      byCoreModel[candidate.core_model] = (byCoreModel[candidate.core_model] || 0) + 1;
    }
  }

  return {
    legacy_model_id: legacyModelId,
    residual_count: residualLegacy.length,
    residuals_with_cross_model_exact_match: matches.filter(row => row.candidate_count > 0).length,
    by_core_model: byCoreModel,
    matches
  };
}


function simulateOracleModelAdjudication(legacyBundle, coreBundle, crossModelDiagnostic) {
  const coreById = new Map(
    (coreBundle.records || []).map(record => [record.record_id, record])
  );

  const corrections = [];
  const usedCore = new Set();
  const correctionByLegacyId = new Map();

  for (const row of crossModelDiagnostic?.matches || []) {
    if (Number(row.candidate_count) !== 1) continue;
    const candidate = row.candidates?.[0];
    if (!candidate?.core_record_id || usedCore.has(candidate.core_record_id)) continue;
    const coreRecord = coreById.get(candidate.core_record_id);
    if (!coreRecord?.fields?.model?.id) continue;

    usedCore.add(candidate.core_record_id);
    correctionByLegacyId.set(row.legacy_record_id, coreRecord.fields.model);
    corrections.push({
      legacy_record_id: row.legacy_record_id,
      product_index: row.product_index ?? null,
      from_model: crossModelDiagnostic.legacy_model_id,
      to_model: coreRecord.fields.model.id,
      core_record_id: candidate.core_record_id,
      model_source_line: candidate.model_source_line ?? null
    });
  }

  const correctedLegacy = {
    ...legacyBundle,
    offers: (legacyBundle.offers || []).map(offer => {
      const correctedModel = correctionByLegacyId.get(offer.legacy_record_id);
      if (!correctedModel) return offer;
      return {
        ...offer,
        fields: {
          ...(offer.fields || {}),
          model: correctedModel
        }
      };
    })
  };

  const report = compareSemanticShadow({ legacy: correctedLegacy, coreBundle });
  const reportNoColor = compareSemanticShadow({
    legacy: correctedLegacy,
    coreBundle,
    options: { include_color: false }
  });
  const divergence = analyzeDivergences({ legacy: correctedLegacy, coreBundle });

  return {
    status: corrections.length > 0 ? 'provisional_oracle_adjudication' : 'no_corrections',
    raw_metrics_preserved: true,
    correction_count: corrections.length,
    corrections,
    adjudicated_metrics: {
      matched_offers: report.metrics.matched_offers,
      missing_offers: report.metrics.missing_offers,
      extra_offers: report.metrics.extra_offers,
      agreement_ratio: report.metrics.agreement_ratio,
      agreement_ratio_without_color: reportNoColor.metrics.agreement_ratio
    },
    adjudicated_divergence_categories: divergence.categories,
    adjudicated_top_model_gaps: divergence.top_model_gaps
  };
}


function crossConditionResidualDiagnostics(legacyBundle, coreBundle, modelId) {
  const coreOffers = (coreBundle.records || []).map(record => ({
    fields: record.fields || {},
    core_record_id: record.record_id,
    trace: record.trace || []
  })).filter(offer => offer.fields?.model?.id && Number.isFinite(Number(offer.fields?.price)));

  const exact = removeExactMatches(legacyBundle.offers || [], coreOffers);
  const residualLegacy = (exact.remainingLegacy || []).filter(offer =>
    normFields(offer).model === modelId
  );

  const rows = residualLegacy.map(legacy => {
    const ln = normFields(legacy);
    const candidates = coreOffers.filter(core => {
      const cn = normFields(core);
      return cn.model === ln.model &&
        cn.capacity_gb === ln.capacity_gb &&
        cn.color === ln.color &&
        cn.price === ln.price &&
        cn.condition !== ln.condition;
    }).map(core => {
      const conditionTrace = (core.trace || []).find(trace => trace.field === 'condition');
      const modelTrace = (core.trace || []).find(trace => trace.field === 'model');
      const priceTrace = (core.trace || []).find(trace => trace.field === 'price');
      return {
        core_record_id: core.core_record_id,
        core_condition: normFields(core).condition,
        condition_source_lines: Array.isArray(conditionTrace?.sources) ? conditionTrace.sources.map(Number) : [],
        condition_rules: Array.isArray(conditionTrace?.rules) ? conditionTrace.rules : [],
        model_source_line: Array.isArray(modelTrace?.sources) ? Number(modelTrace.sources[0]) : null,
        price_line: Array.isArray(priceTrace?.sources) ? Number(priceTrace.sources[0]) : null
      };
    });

    return {
      legacy_record_id: legacy.legacy_record_id || null,
      product_index: legacy.metadata?.product_index ?? null,
      legacy_condition: ln.condition,
      color: ln.color,
      candidate_count: candidates.length,
      candidates
    };
  });

  return {
    model_id: modelId,
    residual_count: rows.length,
    residuals_with_cross_condition_exact_match: rows.filter(row => row.candidate_count > 0).length,
    rows
  };
}


function locateResidualOffersInSegments(legacyBundle, coreBundle, modelId) {
  const coreOffers = (coreBundle.records || []).map(record => ({
    fields: record.fields || {},
    core_record_id: record.record_id,
    trace: record.trace || []
  })).filter(offer => offer.fields?.model?.id && Number.isFinite(Number(offer.fields?.price)));

  const exact = removeExactMatches(legacyBundle.offers || [], coreOffers);
  const residualLegacy = (exact.remainingLegacy || []).filter(offer =>
    normFields(offer).model === modelId
  );

  const segments = coreBundle.segments || [];

  const rows = residualLegacy.map(legacy => {
    const ln = normFields(legacy);
    const candidateSegments = [];

    for (const segment of segments) {
      const prices = distinctFieldValues(segment, 'price')
        .map(value => Number(JSON.parse(value)))
        .filter(Number.isFinite);
      if (!prices.includes(ln.price)) continue;

      const colors = distinctFieldValues(segment, 'color')
        .map(value => normalizeKey(JSON.parse(value)))
        .filter(Boolean);

      const colorMatchesDirect = ln.color != null && colors.includes(ln.color);
      const nearbyColors = [];
      if (!colorMatchesDirect && ln.color != null) {
        const index = segments.indexOf(segment);
        for (let delta = -3; delta <= 3; delta += 1) {
          if (delta === 0) continue;
          const neighbor = segments[index + delta];
          if (!neighbor) continue;
          const neighborColors = distinctFieldValues(neighbor, 'color')
            .map(value => normalizeKey(JSON.parse(value)))
            .filter(Boolean);
          if (neighborColors.includes(ln.color)) nearbyColors.push({
            line: neighbor.line_number,
            distance: Math.abs(delta)
          });
        }
      }

      if (!colorMatchesDirect && !nearbyColors.length) continue;

      const directModels = (segment.semantic_candidates || [])
        .filter(candidate =>
          candidate.field === 'model' &&
          (candidate.state === 'interpreted' || candidate.state === 'inferred')
        )
        .map(candidate => candidate.entity_id)
        .filter(Boolean);

      candidateSegments.push({
        line: segment.line_number,
        direct_color_match: colorMatchesDirect,
        nearby_color_lines: nearbyColors,
        direct_models: directModels,
        inherited_model_source_line: Number.isFinite(Number(segment.inherited_context?.model?.source_line))
          ? Number(segment.inherited_context.model.source_line)
          : null,
        inherited_model_value: segment.inherited_context?.model?.value ?? null,
        inherited_condition: segment.inherited_context?.condition?.value ?? null,
        inherited_condition_source_line: Number.isFinite(Number(segment.inherited_context?.condition?.source_line))
          ? Number(segment.inherited_context.condition.source_line)
          : null,
        context_event_reasons: (segment.context_events || []).map(event => event.reason).filter(Boolean)
      });
    }

    return {
      legacy_record_id: legacy.legacy_record_id || null,
      product_index: legacy.metadata?.product_index ?? null,
      condition: ln.condition,
      color: ln.color,
      candidate_segment_count: candidateSegments.length,
      candidate_segments: candidateSegments
    };
  });

  return {
    model_id: modelId,
    residual_count: rows.length,
    located_residual_count: rows.filter(row => row.candidate_segment_count > 0).length,
    rows
  };
}


function whatIf17256BareUnqualifiedHeader(rawDocument, baseSchema, baseKnowledge, legacyBundle, baseCoreBundle) {
  const targetModelId = 'iphone_17_256gb';
  const candidateSchema = JSON.parse(JSON.stringify(baseSchema));
  const candidateKnowledge = JSON.parse(JSON.stringify(baseKnowledge));
  const modelField = (candidateSchema.fields || []).find(field => field.name === 'model');
  const capacityField = (candidateSchema.fields || []).find(field => field.name === 'capacity_gb');
  if (!modelField || !capacityField) throw new Error('what-if 17 256 bare: schema sem model/capacity_gb');

  const excluded = '(?:Lacrad[oa]s?|CPO|Seminov[oa]s?|Nacional|Importad[oa]s?|NF|e\\s*SIM|eSIM)';
  modelField.extractors = [...(modelField.extractors || []), {
    id: 'what_if_17_256_bare_unqualified_model',
    kind: 'regex',
    pattern: '^(?!.*\\b' + excluded + '\\b)[^A-Za-z0-9]{0,12}(17\\s+256\\s*(?:GB)?)(?=\\D|$)',
    flags: 'i',
    group: 1,
    transform: 'trim',
    score: 0.91
  }];

  capacityField.extractors = [...(capacityField.extractors || []), {
    id: 'what_if_17_256_bare_unqualified_capacity',
    kind: 'regex',
    pattern: '^(?!.*\\b' + excluded + '\\b)[^A-Za-z0-9]{0,12}17\\s+(256)(?:\\s*GB)?(?=\\D|$)',
    flags: 'i',
    group: 1,
    transform: 'integer',
    score: 0.9
  }];

  const aliases = Array.isArray(candidateKnowledge.aliases) ? candidateKnowledge.aliases : [];
  for (const text of ['17 256GB', '17 256']) {
    if (!aliases.some(alias => alias.kind === 'model' && alias.text === text && alias.target_id === targetModelId)) {
      aliases.push({ kind: 'model', text, normalized: null, target_id: targetModelId });
    }
  }
  candidateKnowledge.aliases = aliases;

  const candidateBundle = interpretResolved({
    document: {
      contract_version: 'raw-document/v1',
      document_id: 'real-load-shadow-what-if-17-256-bare-unqualified',
      content: rawDocument,
      source: { kind: 'plain_text' }
    },
    schema: candidateSchema,
    knowledge: candidateKnowledge
  });

  const report = compareSemanticShadow({ legacy: legacyBundle, coreBundle: candidateBundle });
  const reportNoColor = compareSemanticShadow({
    legacy: legacyBundle,
    coreBundle: candidateBundle,
    options: { include_color: false }
  });
  const divergence = analyzeDivergences({ legacy: legacyBundle, coreBundle: candidateBundle });

  const baseIds = new Set((baseCoreBundle.records || []).map(record => record.record_id));
  const candidateCoreOffers = (candidateBundle.records || []).map(record => ({
    fields: record.fields || {},
    core_record_id: record.record_id,
    trace: record.trace || []
  })).filter(offer => offer.fields?.model?.id && Number.isFinite(Number(offer.fields?.price)));

  const exactRemoval = removeExactMatches(legacyBundle.offers || [], candidateCoreOffers);
  const remainingIds = new Set((exactRemoval.remainingCore || []).map(offer => offer.core_record_id));
  const residualPairs = pairWithinModel(exactRemoval.remainingLegacy, exactRemoval.remainingCore);
  const residualDiffsById = new Map(
    (residualPairs.pairs || []).map(pair => [pair.core.core_record_id, pair.diffs])
  );
  const residualPairById = new Map(
    (residualPairs.pairs || []).map(pair => [pair.core.core_record_id, pair])
  );
  const unpairedIds = new Set((residualPairs.unpairedCore || []).map(offer => offer.core_record_id));

  const added = candidateCoreOffers
    .filter(offer => offer.fields?.model?.id === targetModelId && !baseIds.has(offer.core_record_id))
    .map(offer => {
      const priceTrace = (offer.trace || []).find(trace => trace.field === 'price');
      const modelTrace = (offer.trace || []).find(trace => trace.field === 'model');
      const conditionTrace = (offer.trace || []).find(trace => trace.field === 'condition');
      const colorTrace = (offer.trace || []).find(trace => trace.field === 'color');
      const diffs = residualDiffsById.get(offer.core_record_id) || [];
      const paired = residualPairById.get(offer.core_record_id) || null;
      const classification = !remainingIds.has(offer.core_record_id)
        ? 'exact'
        : residualDiffsById.has(offer.core_record_id)
          ? (diffs.length === 1 && diffs[0] === 'price' ? 'wrong_price_only' : 'field_mismatch')
          : unpairedIds.has(offer.core_record_id)
            ? 'extra'
            : 'residual_unclassified';
      return {
        core_record_id: offer.core_record_id,
        price_line: Array.isArray(priceTrace?.sources) ? Number(priceTrace.sources[0]) : null,
        model_source_line: Array.isArray(modelTrace?.sources) ? Number(modelTrace.sources[0]) : null,
        condition: normFields(offer).condition ?? '(null)',
        color: normFields(offer).color ?? '(null)',
        condition_source_lines: Array.isArray(conditionTrace?.sources) ? conditionTrace.sources.map(Number) : [],
        color_source_lines: Array.isArray(colorTrace?.sources) ? colorTrace.sources.map(Number) : [],
        classification,
        diffs,
        paired_legacy: paired ? {
          legacy_record_id: paired.legacy?.legacy_record_id || null,
          product_index: paired.legacy?.metadata?.product_index ?? null,
          model: normFields(paired.legacy).model,
          capacity_gb: normFields(paired.legacy).capacity_gb,
          condition: normFields(paired.legacy).condition,
          color: normFields(paired.legacy).color,
          supplier_present: Boolean(String(paired.legacy?.metadata?.supplier ?? '').trim())
        } : null
      };
    });

  const classificationCounts = {};
  for (const row of added) classificationCounts[row.classification] = (classificationCounts[row.classification] || 0) + 1;

  return {
    candidate: '17_256_bare_unqualified_header',
    metrics: {
      core_offers: report.metrics.core_offers,
      matched_offers: report.metrics.matched_offers,
      missing_offers: report.metrics.missing_offers,
      extra_offers: report.metrics.extra_offers,
      agreement_ratio: report.metrics.agreement_ratio,
      agreement_ratio_without_color: reportNoColor.metrics.agreement_ratio
    },
    divergence_categories: divergence.categories,
    target_model_gap: (divergence.top_model_gaps || []).find(row => row.model === targetModelId) || null,
    added_target_record_count: added.length,
    added_target_record_classifications: classificationCounts,
    added_target_records: added
  };
}


function whatIfRelaxedColorSourceOnly(rawDocument, baseSchema, baseKnowledge, legacyBundle) {
  const candidateSchema = JSON.parse(JSON.stringify(baseSchema));
  const candidateKnowledge = JSON.parse(JSON.stringify(baseKnowledge));
  const colorField = (candidateSchema.fields || []).find(field => field.name === 'color');
  if (!colorField?.pair_by_order_with_trigger) throw new Error('what-if relaxed color source-only: policy ausente');
  colorField.pair_by_order_with_trigger.require_source_only = false;
  const candidateBundle = interpretResolved({
    document: { contract_version: 'raw-document/v1', document_id: 'real-load-shadow-what-if-relaxed-color-source-only', content: rawDocument, source: { kind: 'plain_text' } },
    schema: candidateSchema,
    knowledge: candidateKnowledge
  });
  const report = compareSemanticShadow({ legacy: legacyBundle, coreBundle: candidateBundle });
  const reportNoColor = compareSemanticShadow({ legacy: legacyBundle, coreBundle: candidateBundle, options: { include_color: false } });
  const divergence = analyzeDivergences({ legacy: legacyBundle, coreBundle: candidateBundle });
  return {
    candidate: 'relaxed_color_source_only',
    metrics: {
      core_offers: report.metrics.core_offers, matched_offers: report.metrics.matched_offers,
      missing_offers: report.metrics.missing_offers, extra_offers: report.metrics.extra_offers,
      agreement_ratio: report.metrics.agreement_ratio, agreement_ratio_without_color: reportNoColor.metrics.agreement_ratio,
      no_silent_wrong_price: report.gates.no_silent_wrong_price, exact_multiset: report.gates.exact_multiset
    },
    divergence_categories: divergence.categories,
    top_model_gaps: divergence.top_model_gaps
  };
}

function simulateUnsupportedRawModelExclusionAdjudication(
  legacyBundle,
  coreBundle,
  residualLocator,
  knowledgeSnapshot,
  options = {}
) {
  const expectedPattern = options.expected_raw_model_pattern
    ? new RegExp(options.expected_raw_model_pattern, options.flags || 'i')
    : null;
  if (!expectedPattern) throw new Error('unsupported raw model adjudication: pattern ausente');

  const knownModelKeys = new Set();
  for (const entity of knowledgeSnapshot.entities || []) {
    if (entity.kind === 'model') knownModelKeys.add(normalizeKey(entity.label));
  }
  for (const alias of knowledgeSnapshot.aliases || []) {
    if (alias.kind === 'model') knownModelKeys.add(normalizeKey(alias.normalized || alias.text));
  }

  const excludedIds = [];
  const evidence = [];

  for (const row of residualLocator?.rows || []) {
    if (!row.legacy_record_id) continue;
    const values = [...new Set(
      (row.candidate_segments || [])
        .map(segment => String(segment.inherited_model_value || '').trim())
        .filter(Boolean)
    )];
    if (!values.length) continue;

    const allMatchExpected = values.every(value => expectedPattern.test(value));
    const anyKnown = values.some(value => knownModelKeys.has(normalizeKey(value)));
    if (!allMatchExpected || anyKnown) continue;

    excludedIds.push(row.legacy_record_id);
    evidence.push({
      legacy_record_id: row.legacy_record_id,
      product_index: row.product_index ?? null,
      raw_model_values: values,
      reason: 'raw_model_outside_supported_domain'
    });
  }

  const excludedSet = new Set(excludedIds);
  const adjudicatedLegacy = {
    ...legacyBundle,
    offers: (legacyBundle.offers || []).filter(offer => !excludedSet.has(offer.legacy_record_id))
  };

  const report = compareSemanticShadow({ legacy: adjudicatedLegacy, coreBundle });
  const reportNoColor = compareSemanticShadow({
    legacy: adjudicatedLegacy,
    coreBundle,
    options: { include_color: false }
  });
  const divergence = analyzeDivergences({ legacy: adjudicatedLegacy, coreBundle });

  return {
    status: excludedIds.length ? 'provisional_unsupported_raw_model_exclusion' : 'no_exclusions',
    raw_metrics_preserved: true,
    exclusion_count: excludedIds.length,
    evidence,
    adjudicated_metrics: {
      legacy_supported_offers: adjudicatedLegacy.offers.length,
      matched_offers: report.metrics.matched_offers,
      missing_offers: report.metrics.missing_offers,
      extra_offers: report.metrics.extra_offers,
      agreement_ratio: report.metrics.agreement_ratio,
      agreement_ratio_without_color: reportNoColor.metrics.agreement_ratio
    },
    adjudicated_divergence_categories: divergence.categories,
    adjudicated_top_model_gaps: divergence.top_model_gaps
  };
}


function combineProvisionalReferenceAdjudications(
  legacyBundle,
  coreBundle,
  modelAdjudication,
  unsupportedAdjudication
) {
  const coreById = new Map(
    (coreBundle.records || []).map(record => [record.record_id, record])
  );

  const correctionByLegacyId = new Map();
  for (const correction of modelAdjudication?.corrections || []) {
    const coreRecord = coreById.get(correction.core_record_id);
    if (!coreRecord?.fields?.model?.id) continue;
    correctionByLegacyId.set(correction.legacy_record_id, coreRecord.fields.model);
  }

  const excludedIds = new Set(
    (unsupportedAdjudication?.evidence || [])
      .map(row => row.legacy_record_id)
      .filter(Boolean)
  );

  const adjudicatedLegacy = {
    ...legacyBundle,
    offers: (legacyBundle.offers || [])
      .filter(offer => !excludedIds.has(offer.legacy_record_id))
      .map(offer => {
        const correctedModel = correctionByLegacyId.get(offer.legacy_record_id);
        if (!correctedModel) return offer;
        return {
          ...offer,
          fields: {
            ...(offer.fields || {}),
            model: correctedModel
          }
        };
      })
  };

  const report = compareSemanticShadow({ legacy: adjudicatedLegacy, coreBundle });
  const reportNoColor = compareSemanticShadow({
    legacy: adjudicatedLegacy,
    coreBundle,
    options: { include_color: false }
  });
  const divergence = analyzeDivergences({ legacy: adjudicatedLegacy, coreBundle });

  return {
    status: 'provisional_combined_reference_adjudication',
    raw_metrics_preserved: true,
    model_correction_count: correctionByLegacyId.size,
    unsupported_exclusion_count: excludedIds.size,
    total_reference_adjustments: correctionByLegacyId.size + excludedIds.size,
    adjudicated_metrics: {
      legacy_supported_offers: adjudicatedLegacy.offers.length,
      matched_offers: report.metrics.matched_offers,
      missing_offers: report.metrics.missing_offers,
      extra_offers: report.metrics.extra_offers,
      agreement_ratio: report.metrics.agreement_ratio,
      agreement_ratio_without_color: reportNoColor.metrics.agreement_ratio
    },
    adjudicated_divergence_categories: divergence.categories,
    adjudicated_top_model_gaps: divergence.top_model_gaps
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
const rejectedColorSourceDiagnostic = rejectedColorSourceDiagnostics(coreBundle);
const scopedRejectedColorPairingDiagnostic = scopedRejectedColorPairingDiagnostics(coreBundle);
const supplierBoundaryDiagnostic = supplierBoundaryDiagnostics(coreBundle);
const conditionDistributionDiagnostic = conditionDistributionDiagnostics(legacy, coreBundle);
const localHeader17256Diagnostic = localHeader17256Diagnostics(coreBundle);
const localHeader15128Diagnostic = localHeader15128Diagnostics(coreBundle);
const target16ProMax256Diagnostic = targetModelBlockDiagnostics(coreBundle, 'iphone_16_pro_max_256gb');
const target16128Diagnostic = targetModelBlockDiagnostics(coreBundle, 'iphone_16_128gb');
const target16ProMax256PairDiagnostic = targetModelPairDiagnostics(legacy, coreBundle, 'iphone_16_pro_max_256gb');
const target16256Diagnostic = targetModelBlockDiagnostics(coreBundle, 'iphone_16_256gb');
const target16256PairDiagnostic = targetModelPairDiagnostics(legacy, coreBundle, 'iphone_16_256gb');
const target16256BoundaryDiagnostic = targetModelBoundaryDiagnostics(coreBundle, 'iphone_16_256gb');
const target16256CrossModelDiagnostic = crossModelResidualDiagnostics(
  legacy, coreBundle, 'iphone_16_256gb'
);
const target16256OracleAdjudication = simulateOracleModelAdjudication(
  legacy, coreBundle, target16256CrossModelDiagnostic
);
const target17512Diagnostic = targetModelBlockDiagnostics(coreBundle, 'iphone_17_512gb');
const target17512PairDiagnostic = targetModelPairDiagnostics(legacy, coreBundle, 'iphone_17_512gb');
const target17512BoundaryDiagnostic = targetModelBoundaryDiagnostics(coreBundle, 'iphone_17_512gb');
const target17512CrossModelDiagnostic = crossModelResidualDiagnostics(
  legacy, coreBundle, 'iphone_17_512gb'
);
const target17512CrossConditionDiagnostic = crossConditionResidualDiagnostics(
  legacy, coreBundle, 'iphone_17_512gb'
);
const target17512ResidualLocatorDiagnostic = locateResidualOffersInSegments(
  legacy, coreBundle, 'iphone_17_512gb'
);
const target17512UnsupportedRawModelAdjudication = simulateUnsupportedRawModelExclusionAdjudication(
  legacy,
  coreBundle,
  target17512ResidualLocatorDiagnostic,
  knowledge,
  {
    expected_raw_model_pattern: '17\\s*(?:Pro\\s*Max|Promax)\\s*512\\s*(?:GB)?'
  }
);
const combinedReferenceAdjudication = combineProvisionalReferenceAdjudications(
  legacy,
  coreBundle,
  target16256OracleAdjudication,
  target17512UnsupportedRawModelAdjudication
);
const whatIf16ProMaxDiagnostic = whatIf16ProMaxShorthand(raw, schema, knowledge, legacy, coreBundle);
const whatIf16ProMaxCpoDiagnostic = whatIf16ProMaxShorthand(
  raw,
  schema,
  knowledge,
  legacy,
  coreBundle,
  {
    candidate: 'explicit_16_pro_max_256_cpo_same_header',
    require_cpo_same_header: true
  }
);
const whatIf16Base128Diagnostic = whatIf16Base128Shorthand(raw, schema, knowledge, legacy, coreBundle);
const whatIf16Base128LacradoDiagnostic = whatIf16Base128Shorthand(
  raw,
  schema,
  knowledge,
  legacy,
  coreBundle,
  {
    candidate: 'explicit_16_128_lacrado_same_header',
    require_lacrado_same_header: true
  }
);
const whatIf15Base128LacradoDiagnostic = whatIfScopedBase128Shorthand(
  raw, schema, knowledge, legacy, coreBundle,
  { generation: '15', target_model_id: 'iphone_15_128gb', condition: 'Lacrado' }
);
const whatIf15Base128LacradoScopedDiagnostic = whatIfScopedBase128Shorthand(
  raw, schema, knowledge, legacy, coreBundle,
  {
    candidate: '15_128_lacrado_same_header_until_next_condition',
    generation: '15',
    target_model_id: 'iphone_15_128gb',
    condition: 'Lacrado',
    expire_model_on_condition_declaration: true
  }
);
const whatIf15Base128SeminovoDiagnostic = whatIfScopedBase128Shorthand(
  raw, schema, knowledge, legacy, coreBundle,
  { generation: '15', target_model_id: 'iphone_15_128gb', condition: 'Seminovo' }
);
const whatIf17256ImportadoEsimDiagnostic = whatIf17256ImportadoEsimShorthand(
  raw, schema, knowledge, legacy, coreBundle
);
const whatIf17256BareUnqualifiedDiagnostic = whatIf17256BareUnqualifiedHeader(
  raw, schema, knowledge, legacy, coreBundle
);
const invariantWrongPriceDiagnostic = invariantWrongPriceAdjudicationDiagnostics(
  legacy, coreBundle
);
const whatIfRelaxedColorSourceOnlyDiagnostic = whatIfRelaxedColorSourceOnly(
  raw, schema, knowledge, legacy
);
const multiPriceNearestFallbackRiskDiagnostic = multiPriceNearestFallbackRiskDiagnostics(coreBundle);

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
  rejected_color_source_diagnostic: rejectedColorSourceDiagnostic,
  scoped_rejected_color_pairing_diagnostic: scopedRejectedColorPairingDiagnostic,
  supplier_boundary_diagnostic: supplierBoundaryDiagnostic,
  condition_distribution_diagnostic: conditionDistributionDiagnostic,
  local_header_17_256_diagnostic: localHeader17256Diagnostic,
  local_header_15_128_diagnostic: localHeader15128Diagnostic,
  target_16_pro_max_256_diagnostic: target16ProMax256Diagnostic,
  target_16_128_diagnostic: target16128Diagnostic,
  target_16_pro_max_256_pair_diagnostic: target16ProMax256PairDiagnostic,
  target_16_256_diagnostic: target16256Diagnostic,
  target_16_256_pair_diagnostic: target16256PairDiagnostic,
  target_16_256_boundary_diagnostic: target16256BoundaryDiagnostic,
  target_16_256_cross_model_diagnostic: target16256CrossModelDiagnostic,
  target_16_256_oracle_adjudication: target16256OracleAdjudication,
  target_17_512_diagnostic: target17512Diagnostic,
  target_17_512_pair_diagnostic: target17512PairDiagnostic,
  target_17_512_boundary_diagnostic: target17512BoundaryDiagnostic,
  target_17_512_cross_model_diagnostic: target17512CrossModelDiagnostic,
  target_17_512_cross_condition_diagnostic: target17512CrossConditionDiagnostic,
  target_17_512_residual_locator: target17512ResidualLocatorDiagnostic,
  target_17_512_unsupported_raw_model_adjudication: target17512UnsupportedRawModelAdjudication,
  combined_reference_adjudication: combinedReferenceAdjudication,
  canonical_reference_v1: {
    status: 'canonical_reference_v1',
    raw_metrics_preserved: true,
    audit: canonicalReference.audit,
    metrics: {
      legacy_supported_offers: canonicalReference.legacy.offers.length,
      matched_offers: canonicalReferenceReport.metrics.matched_offers,
      missing_offers: canonicalReferenceReport.metrics.missing_offers,
      extra_offers: canonicalReferenceReport.metrics.extra_offers,
      agreement_ratio: canonicalReferenceReport.metrics.agreement_ratio,
      agreement_ratio_without_color: canonicalReferenceReportNoColor.metrics.agreement_ratio
    },
    divergence_categories: canonicalReferenceDivergence.categories,
    top_model_gaps: canonicalReferenceDivergence.top_model_gaps
  },
  what_if_16_pro_max_256_shorthand: whatIf16ProMaxDiagnostic,
  what_if_16_pro_max_256_cpo_same_header: whatIf16ProMaxCpoDiagnostic,
  what_if_16_128_shorthand: whatIf16Base128Diagnostic,
  what_if_16_128_lacrado_same_header: whatIf16Base128LacradoDiagnostic,
  what_if_15_128_lacrado_same_header: whatIf15Base128LacradoDiagnostic,
  what_if_15_128_lacrado_scoped_until_next_condition: whatIf15Base128LacradoScopedDiagnostic,
  what_if_15_128_seminovo_same_header: whatIf15Base128SeminovoDiagnostic,
  what_if_17_256_importado_esim_same_header: whatIf17256ImportadoEsimDiagnostic,
  what_if_17_256_bare_unqualified_header: whatIf17256BareUnqualifiedDiagnostic,
  invariant_wrong_price_adjudication: invariantWrongPriceDiagnostic,
  what_if_relaxed_color_source_only: whatIfRelaxedColorSourceOnlyDiagnostic,
  multi_price_nearest_fallback_risk: multiPriceNearestFallbackRiskDiagnostic
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
