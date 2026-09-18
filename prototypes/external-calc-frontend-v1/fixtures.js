(() => {
  const createdAt = "2026-09-18T06:40:00-03:00";

  function execution(status, runId) {
    const value = {
      run_id: runId,
      analysis_id: "analysis-demo-001",
      source_id: "source-demo-001",
      contract_id: "C01",
      contract_version: "1",
      engine_version: "interpreter-fixture/1.0",
      stage: "INTERPRETATION",
      run_kind: "INITIAL",
      attempt_no: 1,
      execution_status: status,
      freshness_status: "CURRENT",
      input_fingerprint: "sha256:fixture-demo",
      created_at: createdAt,
      provenance_refs: [{kind:"source",ref_id:"source-demo-001"}]
    };
    if (status === "FAILED") {
      value.error = {
        error_code: "INTERPRETER_UNAVAILABLE",
        error_class: "DEPENDENCY_UNAVAILABLE",
        safe_message: "A interpretação não foi concluída. Sua lista continua disponível para uma nova tentativa.",
        retryable: true,
        source_stage: "INTERPRETATION",
        occurred_at: createdAt
      };
    }
    return value;
  }

  const source = {
    source_id: "source-demo-001",
    source_type: "plain_text",
    source_name: "fornecedor-setembro.txt",
    content:
      "IPHONE 17 PRO 256GB PRETO - LACRADO - R$ 6.500\\n" +
      "IPHONE 17 128GB AZUL - LACRADO - R$ 4.850\\n" +
      "IPHONE 16 PRO 256 NATURAL - SEMINOVO - R$ 5.100\\n" +
      "IPHONE AIR 256 - R$ 5.700\\n" +
      "IPHONE 15 128GB - consultar"
  };

  const valid1 = {
    offer_ref:{analysis_id:"analysis-demo-001",offer_id:"offer-001",offer_revision:1},
    product:{
      display_name:"iPhone 17 Pro 256GB",
      brand:"Apple",
      model:"iPhone 17 Pro",
      storage:"256GB",
      condition:"Lacrado",
      attributes:{color:"Preto",supplier:"Fornecedor Demo",interpretation_mode:"interpreted"}
    },
    supplier_offer_price:{amount_minor:650000,currency:"BRL"},
    status:"VALID",
    interpretation_confidence:{score:.99},
    evidence_refs:[{kind:"source_line",ref_id:"1"}]
  };

  const valid2 = {
    offer_ref:{analysis_id:"analysis-demo-001",offer_id:"offer-002",offer_revision:1},
    product:{
      display_name:"iPhone 17 128GB",
      brand:"Apple",
      model:"iPhone 17",
      storage:"128GB",
      condition:"Lacrado",
      attributes:{color:"Azul",supplier:"Fornecedor Demo",interpretation_mode:"interpreted"}
    },
    supplier_offer_price:{amount_minor:485000,currency:"BRL"},
    status:"VALID",
    interpretation_confidence:{score:.98},
    evidence_refs:[{kind:"source_line",ref_id:"2"}]
  };

  const inferred = {
    offer_ref:{analysis_id:"analysis-demo-001",offer_id:"offer-003",offer_revision:1},
    product:{
      display_name:"iPhone 16 Pro 256GB",
      brand:"Apple",
      model:"iPhone 16 Pro",
      storage:"256GB",
      condition:"Seminovo",
      attributes:{color:"Natural",supplier:"Fornecedor Demo",interpretation_mode:"inferred"}
    },
    supplier_offer_price:{amount_minor:510000,currency:"BRL"},
    status:"VALID",
    interpretation_confidence:{score:.86},
    evidence_refs:[{kind:"source_line",ref_id:"3"}]
  };

  const reviewOffer = {
    offer_ref:{analysis_id:"analysis-demo-001",offer_id:"offer-004",offer_revision:1},
    product:{
      display_name:"iPhone Air 256GB",
      brand:"Apple",
      model:"iPhone Air",
      storage:"256GB",
      attributes:{color:null,supplier:"Fornecedor Demo",interpretation_mode:"inferred"}
    },
    supplier_offer_price:{amount_minor:570000,currency:"BRL"},
    status:"REVIEW_REQUIRED",
    interpretation_confidence:{score:.62},
    evidence_refs:[{kind:"source_line",ref_id:"4"}]
  };

  const ambiguity = {
    issue_id:"issue-001",
    kind:"AMBIGUITY",
    outcome:"REVIEW_REQUIRED",
    offer_id:"offer-004",
    field:"condition",
    cause:"condition_missing",
    raw:"IPHONE AIR 256 - R$ 5.700",
    candidates:[
      {value:"Lacrado",label:"Lacrado",detail:"Produto novo / caixa lacrada"},
      {value:"Seminovo",label:"Seminovo",detail:"Produto usado"}
    ],
    source_refs:[{kind:"source_line",ref_id:"4"}]
  };

  const invalid = {
    issue_id:"issue-002",
    kind:"INVALID",
    outcome:"INVALID",
    cause:"missing_price",
    raw:"IPHONE 15 128GB - consultar",
    source_refs:[{kind:"source_line",ref_id:"5"}]
  };

  const traces = {
    "offer-001":[
      {field:"model",chosen:"iPhone 17 Pro",rule:"direct_extraction",source:"linha 1",score:.99},
      {field:"storage",chosen:"256GB",rule:"direct_extraction",source:"linha 1",score:1},
      {field:"price",chosen:"R$ 6.500",rule:"currency_normalization",source:"linha 1",score:1}
    ],
    "offer-002":[
      {field:"model",chosen:"iPhone 17",rule:"direct_extraction",source:"linha 2",score:.98}
    ],
    "offer-003":[
      {field:"model",chosen:"iPhone 16 Pro",rule:"alias_resolution",source:"linha 3",score:.86},
      {field:"condition",chosen:"Seminovo",rule:"context_extraction",source:"linha 3",score:.94}
    ],
    "offer-004":[
      {field:"model",chosen:"iPhone Air",rule:"alias_resolution",source:"linha 4",score:.82},
      {field:"condition",chosen:null,rule:"unresolved",source:"linha 4",score:.31}
    ]
  };

  function response(status, offers, issues, runId) {
    return { execution:execution(status,runId), offers:offers || [], issues:issues || [] };
  }

  const scenarios = {
    ready:{
      source,
      c01:response("SUCCEEDED",[valid1,valid2,inferred],[invalid],"run-ready-001"),
      traces
    },
    review:{
      source,
      c01:response("SUCCEEDED",[valid1,valid2,inferred,reviewOffer],[ambiguity,invalid],"run-review-001"),
      traces
    },
    idle:{
      source:{source_id:"source-preview",source_type:"plain_text",source_name:null,content:""},
      c01:response("NOT_STARTED",[],[],"run-idle-001"),
      traces:{}
    },
    processing:{
      source,
      c01:response("RUNNING",[],[],"run-processing-001"),
      traces:{}
    },
    empty:{
      source:{...source,content:"Bom dia!\\nTabela atualizada amanhã."},
      c01:response("SUCCEEDED",[],[],"run-empty-001"),
      traces:{}
    },
    failed:{
      source,
      c01:response("FAILED",[],[],"run-failed-001"),
      traces:{}
    }
  };

  window.ExternalCalcFixtures = scenarios;
})();