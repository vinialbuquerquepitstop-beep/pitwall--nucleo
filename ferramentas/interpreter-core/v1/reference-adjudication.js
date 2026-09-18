'use strict';

function fail(message) {
  throw new Error(`reference adjudication: ${message}`);
}

function modelEntityById(knowledgeSnapshot, modelId) {
  return (knowledgeSnapshot?.entities || []).find(entity =>
    entity?.kind === 'model' && entity?.id === modelId
  ) || null;
}

function applyReferenceAdjudication({
  legacyBundle,
  knowledgeSnapshot,
  reference,
  sourceLoadId = null
}) {
  if (!legacyBundle || !Array.isArray(legacyBundle.offers)) fail('legacy bundle invalido');
  if (!reference || reference.contract_version !== 'interpreter-reference-adjudication/v1') {
    fail('contract_version invalido');
  }
  if (sourceLoadId && reference.source_load_id && sourceLoadId !== reference.source_load_id) {
    fail(`source_load_id divergente: esperado ${reference.source_load_id}, recebido ${sourceLoadId}`);
  }

  const byId = new Map();
  for (const offer of legacyBundle.offers) {
    const id = offer?.legacy_record_id;
    if (!id) fail('oferta legado sem legacy_record_id');
    if (byId.has(id)) fail(`legacy_record_id duplicado: ${id}`);
    byId.set(id, offer);
  }

  const corrections = Array.isArray(reference.corrections) ? reference.corrections : [];
  const exclusions = Array.isArray(reference.exclusions) ? reference.exclusions : [];
  const correctionById = new Map();
  const excludedIds = new Set();

  for (const row of corrections) {
    const id = row?.legacy_record_id;
    if (!id || correctionById.has(id)) fail(`correcao invalida ou duplicada: ${id || '(sem-id)'}`);
    const offer = byId.get(id);
    if (!offer) fail(`correcao referencia registro ausente: ${id}`);

    const currentModel = offer?.fields?.model?.id || null;
    if (row.expected_from_model && currentModel !== row.expected_from_model) {
      fail(`modelo de origem divergente em ${id}: esperado ${row.expected_from_model}, recebido ${currentModel}`);
    }

    const target = modelEntityById(knowledgeSnapshot, row.to_model);
    if (!target) fail(`modelo destino desconhecido em ${id}: ${row.to_model}`);

    correctionById.set(id, {
      kind: 'model',
      id: target.id,
      label: target.label,
      attributes: target.attributes || {}
    });
  }

  for (const row of exclusions) {
    const id = row?.legacy_record_id;
    if (!id || excludedIds.has(id)) fail(`exclusao invalida ou duplicada: ${id || '(sem-id)'}`);
    if (correctionById.has(id)) fail(`registro nao pode ser corrigido e excluido: ${id}`);

    const offer = byId.get(id);
    if (!offer) fail(`exclusao referencia registro ausente: ${id}`);

    const currentModel = offer?.fields?.model?.id || null;
    if (row.expected_model && currentModel !== row.expected_model) {
      fail(`modelo esperado divergente na exclusao ${id}: esperado ${row.expected_model}, recebido ${currentModel}`);
    }
    excludedIds.add(id);
  }

  const offers = legacyBundle.offers
    .filter(offer => !excludedIds.has(offer.legacy_record_id))
    .map(offer => {
      const correctedModel = correctionById.get(offer.legacy_record_id);
      if (!correctedModel) return offer;
      return {
        ...offer,
        fields: {
          ...(offer.fields || {}),
          model: correctedModel
        }
      };
    });

  return {
    legacy: {
      ...legacyBundle,
      offers
    },
    audit: {
      adjudication_id: reference.adjudication_id || null,
      status: reference.status || null,
      source_load_id: reference.source_load_id || null,
      raw_offer_count: legacyBundle.offers.length,
      adjudicated_offer_count: offers.length,
      correction_count: correctionById.size,
      exclusion_count: excludedIds.size,
      total_adjustments: correctionById.size + excludedIds.size,
      corrected_ids: [...correctionById.keys()].sort(),
      excluded_ids: [...excludedIds].sort()
    }
  };
}

module.exports = {
  applyReferenceAdjudication
};
