window.EXTERNAL_CALC_MOCK = {
  "contract_version": "external-calc-workspace-mock/v0",
  "document": {
    "document_id": "demo-list-001",
    "source_kind": "plain_text",
    "filename": "lista-demo.txt",
    "status": "ready"
  },
  "interpretation": {
    "run": {
      "run_id": "demo-run-001",
      "engine_version": "interpreter-core/mock",
      "status": "ready"
    },
    "summary": {
      "records": 2,
      "interpreted": 1,
      "inferred": 1,
      "ambiguous": 1,
      "invalid": 0
    },
    "records": [
      {
        "record_id": "offer-001",
        "state": "interpreted",
        "fields": {
          "model": { "id": "device_alpha_256", "label": "Device Alpha 256GB" },
          "condition": "Lacrado",
          "color": "Preto",
          "supplier": "Fornecedor A",
          "price": 5200,
          "currency": "BRL"
        },
        "trace": [
          { "field": "model", "rule": "direct_extraction", "source_line": 3 },
          { "field": "price", "rule": "direct_extraction", "source_line": 4 }
        ]
      },
      {
        "record_id": "offer-002",
        "state": "inferred",
        "fields": {
          "model": { "id": "device_beta_128", "label": "Device Beta 128GB" },
          "condition": "Seminovo",
          "color": "Azul",
          "supplier": "Fornecedor B",
          "price": 3100,
          "currency": "BRL"
        },
        "trace": [
          { "field": "model", "rule": "alias_resolution", "source_line": 8 },
          { "field": "condition", "rule": "context_inheritance", "source_line": 7 },
          { "field": "price", "rule": "direct_extraction", "source_line": 9 }
        ]
      }
    ],
    "ambiguities": [
      {
        "ambiguity_id": "amb-001",
        "field": "model",
        "cause": "entity_unresolved",
        "source_line": 12,
        "raw": "Device Gamma 512",
        "message": "Modelo não resolvido com segurança."
      }
    ],
    "warnings": ["no_persistence", "mock_payload"]
  },
  "calculation": {
    "selected_record_id": "offer-001",
    "input": {
      "cost": 5200,
      "freight": 50,
      "margin": 800,
      "cash_discount": 0
    },
    "output": {
      "total_cost": 5250,
      "cash_price": 6050,
      "gross_profit": 800,
      "installments": [
        { "months": 12, "installment": 553.92, "total": 6647.04 },
        { "months": 18, "installment": 390.12, "total": 7022.16 }
      ]
    }
  },
  "research": {
    "selected_record_id": "offer-001",
    "status": "ready",
    "observations": [
      { "source_id": "source-a", "label": "Fonte A", "price": 5680, "captured_at": "2026-09-18T00:00:00-03:00" },
      { "source_id": "source-b", "label": "Fonte B", "price": 5790, "captured_at": "2026-09-18T00:00:00-03:00" },
      { "source_id": "source-c", "label": "Fonte C", "price": 5890, "captured_at": "2026-09-18T00:00:00-03:00" }
    ],
    "statistics": {
      "sample_size": 3,
      "min": 5680,
      "median": 5790,
      "max": 5890
    },
    "indicator": {
      "state": "cheap",
      "label": "Abaixo do mercado",
      "reference_price": 5790,
      "analyzed_price": 5200,
      "delta_pct": -10.19,
      "evidence_quality": "sufficient"
    }
  }
};
