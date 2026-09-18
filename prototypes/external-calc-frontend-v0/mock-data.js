(() => {
  const clone = value => JSON.parse(JSON.stringify(value));

  const records = [
    {
      record_id: "offer-001",
      state: "interpreted",
      fields: {
        model: { id: "device_alpha_256", label: "Device Alpha 256GB" },
        condition: "Lacrado",
        color: "Preto",
        supplier: "Fornecedor A",
        price: 5200,
        currency: "BRL"
      },
      trace: [
        {
          field: "model",
          chosen: "device_alpha_256",
          sources: [3],
          derived_from: [],
          rules: ["direct_extraction"],
          alternatives: [],
          score: 0.99
        },
        {
          field: "price",
          chosen: 5200,
          sources: [4],
          derived_from: [],
          rules: ["direct_extraction", "currency_normalization"],
          alternatives: [],
          score: 1
        }
      ]
    },
    {
      record_id: "offer-002",
      state: "inferred",
      fields: {
        model: { id: "device_beta_128", label: "Device Beta 128GB" },
        condition: "Seminovo",
        color: "Azul",
        supplier: "Fornecedor B",
        price: 3100,
        currency: "BRL"
      },
      trace: [
        {
          field: "model",
          chosen: "device_beta_128",
          sources: [8],
          derived_from: [7],
          rules: ["alias_resolution"],
          alternatives: ["device_beta_256"],
          score: 0.86
        },
        {
          field: "condition",
          chosen: "Seminovo",
          sources: [7],
          derived_from: [7],
          rules: ["context_inheritance"],
          alternatives: [],
          score: 0.91
        },
        {
          field: "price",
          chosen: 3100,
          sources: [9],
          derived_from: [],
          rules: ["direct_extraction"],
          alternatives: [],
          score: 1
        }
      ]
    }
  ];

  const ambiguities = [
    {
      ambiguity_id: "amb-001",
      field: "model",
      cause: "entity_unresolved",
      raw: "Device Gamma 512",
      candidates: ["device_gamma_512", "device_gamma_pro_512"],
      sources: [12],
      context: { supplier: "Fornecedor C" }
    }
  ];

  const invalid = [
    {
      cause: "missing_price",
      raw: "Device Delta 256GB — consultar",
      sources: [15]
    }
  ];

  const ready = {
    contract_version: "external-calc-workspace-mock/v0",
    document: {
      document_id: "demo-list-001",
      source_kind: "plain_text",
      filename: "lista-demo.txt",
      status: "ready"
    },
    interpretation: {
      run: {
        run_id: "demo-run-001",
        document_id: "demo-list-001",
        document_hash: "mock:42d9",
        engine_version: "interpreter-core/mock",
        schema_id: "apple-electronics",
        schema_version: "v1",
        knowledge_version: "mock-v1",
        status: "ready"
      },
      summary: {
        records: 2,
        interpreted: 1,
        inferred: 1,
        ambiguous: 1,
        invalid: 1
      },
      records: clone(records),
      ambiguities: clone(ambiguities),
      invalid: clone(invalid),
      warnings: ["no_persistence", "mock_payload"],
      metrics: {
        n_lines: 16,
        n_records: 2,
        n_ambiguous: 1,
        n_invalid: 1,
        parse_ms: 84,
        fallback_calls: 0
      }
    },
    source_text: "DEVICE ALPHA 256GB PRETO\nLACRADO\nR$ 5.200\n\nDEVICE BETA 128GB AZUL\nSEMINOVO\nR$ 3.100\n\nDEVICE GAMMA 512\n\nDEVICE DELTA 256GB — consultar"
  };

  const idle = clone(ready);
  idle.document = { document_id: null, source_kind: "plain_text", filename: null, status: "idle" };
  idle.interpretation.run = {
    run_id: null,
    engine_version: "interpreter-core/mock",
    schema_id: "apple-electronics",
    schema_version: "v1",
    knowledge_version: "mock-v1",
    status: "idle"
  };
  idle.interpretation.summary = { records: 0, interpreted: 0, inferred: 0, ambiguous: 0, invalid: 0 };
  idle.interpretation.records = [];
  idle.interpretation.ambiguities = [];
  idle.interpretation.invalid = [];
  idle.interpretation.warnings = [];
  idle.interpretation.metrics = { n_lines: 0, n_records: 0, n_ambiguous: 0, n_invalid: 0, parse_ms: 0, fallback_calls: 0 };
  idle.source_text = "";

  const processing = clone(idle);
  processing.document = { document_id: "demo-list-pending", source_kind: "plain_text", filename: "lista-demo.txt", status: "interpreting" };
  processing.interpretation.run.run_id = "demo-run-pending";
  processing.interpretation.run.status = "interpreting";
  processing.source_text = ready.source_text;

  const partial = clone(ready);
  partial.document.status = "ready";
  partial.interpretation.run.run_id = "demo-run-partial";
  partial.interpretation.run.status = "ready";
  partial.interpretation.records = [clone(records[0])];
  partial.interpretation.summary = { records: 1, interpreted: 1, inferred: 0, ambiguous: 1, invalid: 1 };
  partial.interpretation.metrics = { n_lines: 16, n_records: 1, n_ambiguous: 1, n_invalid: 1, parse_ms: 97, fallback_calls: 0 };
  partial.interpretation.warnings = ["partial_result", "no_persistence", "mock_payload"];

  const empty = clone(ready);
  empty.document.status = "ready";
  empty.interpretation.run.run_id = "demo-run-empty";
  empty.interpretation.run.status = "ready";
  empty.interpretation.records = [];
  empty.interpretation.ambiguities = [];
  empty.interpretation.invalid = [];
  empty.interpretation.summary = { records: 0, interpreted: 0, inferred: 0, ambiguous: 0, invalid: 0 };
  empty.interpretation.metrics = { n_lines: 4, n_records: 0, n_ambiguous: 0, n_invalid: 0, parse_ms: 31, fallback_calls: 0 };
  empty.interpretation.warnings = ["no_offers_found", "no_persistence", "mock_payload"];
  empty.source_text = "Bom dia!\nTabela atualizada amanhã.\nQualquer dúvida me chama.";

  const failed = clone(processing);
  failed.document.status = "failed";
  failed.interpretation.run.status = "failed";
  failed.interpretation.warnings = ["mock_failure", "retry_available"];
  failed.error = {
    code: "INTERPRETATION_FAILED",
    message: "A leitura não foi concluída. Tente novamente sem perder a lista."
  };

  window.EXTERNAL_CALC_SCENARIOS = { ready, idle, processing, partial, empty, failed };
  window.EXTERNAL_CALC_MOCK = ready;
})();
