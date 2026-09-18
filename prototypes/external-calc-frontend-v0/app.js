(() => {
  const scenarios = window.EXTERNAL_CALC_SCENARIOS;
  const els = {
    scenario: document.getElementById("scenario-select"),
    sourceText: document.getElementById("source-text"),
    sourceFile: document.getElementById("source-file"),
    uploadFile: document.getElementById("upload-file"),
    interpret: document.getElementById("interpret-list"),
    newAnalysis: document.getElementById("new-analysis"),
    inputFeedback: document.getElementById("input-feedback"),
    documentStatus: document.getElementById("document-status"),
    sourceFilename: document.getElementById("source-filename"),
    sourceKind: document.getElementById("source-kind"),
    processingTitle: document.getElementById("processing-title"),
    processingDescription: document.getElementById("processing-description"),
    stateDot: document.getElementById("state-dot"),
    stepper: document.getElementById("stepper"),
    summaryTitle: document.getElementById("summary-title"),
    summaryStatus: document.getElementById("summary-status"),
    summaryCopy: document.getElementById("summary-copy"),
    metrics: document.getElementById("metrics"),
    runMeta: document.getElementById("run-meta"),
    offersBody: document.getElementById("offers-body"),
    offersTableWrap: document.getElementById("offers-table-wrap"),
    offersEmpty: document.getElementById("offers-empty"),
    offersEmptyTitle: document.getElementById("offers-empty-title"),
    offersEmptyCopy: document.getElementById("offers-empty-copy"),
    ambiguityList: document.getElementById("ambiguity-list"),
    ambiguityCount: document.getElementById("ambiguity-count"),
    ambiguityEmpty: document.getElementById("ambiguity-empty"),
    invalidList: document.getElementById("invalid-list"),
    invalidCount: document.getElementById("invalid-count"),
    invalidEmpty: document.getElementById("invalid-empty"),
    filters: [...document.querySelectorAll("[data-filter]")],
    drawer: document.getElementById("evidence-drawer"),
    drawerBackdrop: document.getElementById("drawer-backdrop"),
    closeDrawer: document.getElementById("close-drawer"),
    drawerRecord: document.getElementById("drawer-record"),
    traceList: document.getElementById("trace-list"),
    drawerRunMeta: document.getElementById("drawer-run-meta")
  };

  let activeScenario = "ready";
  let activeFilter = "all";
  let selectedRecordId = null;
  let customSourceText = null;
  let customFilename = null;
  let processingTimer = null;

  function esc(value) {
    return String(value == null ? "" : value)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function money(value, currency) {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: currency || "BRL"
    }).format(Number(value || 0));
  }

  function currentData() {
    return scenarios[activeScenario] || scenarios.ready;
  }

  function countLabel(value, singular, plural) {
    return value + " " + (value === 1 ? singular : plural);
  }

  function statusConfig(status) {
    const map = {
      idle: { label: "Inicial", cls: "neutral" },
      uploading: { label: "Enviando", cls: "info" },
      queued: { label: "Na fila", cls: "info" },
      interpreting: { label: "Interpretando", cls: "info" },
      ready: { label: "Pronto", cls: "good" },
      failed: { label: "Falhou", cls: "danger" }
    };
    return map[status] || map.idle;
  }

  function renderProcessing(data) {
    const status = data.document.status;
    const copy = {
      idle: ["Pronto para uma nova análise", "Cole uma lista ou envie um arquivo .txt."],
      uploading: ["Recebendo o documento", "O arquivo está sendo preparado para interpretação."],
      queued: ["Análise na fila", "O documento aguarda o início da interpretação."],
      interpreting: ["Interpretando lista", "O motor está extraindo registros e separando incertezas."],
      ready: ["Interpretação pronta", "A leitura terminou e está disponível para revisão."],
      failed: ["A interpretação falhou", data.error ? data.error.message : "Tente novamente."]
    };
    const message = copy[status] || copy.idle;
    els.processingTitle.textContent = message[0];
    els.processingDescription.textContent = message[1];

    els.stateDot.className = "state-dot";
    if (status === "interpreting" || status === "queued" || status === "uploading") els.stateDot.classList.add("is-processing");
    if (status === "failed") els.stateDot.classList.add("is-failed");
    if (status === "idle") els.stateDot.classList.add("is-idle");

    const stepStates = {
      idle: ["pending", "pending", "pending"],
      uploading: ["current", "pending", "pending"],
      queued: ["done", "current", "pending"],
      interpreting: ["done", "current", "pending"],
      ready: ["done", "done", "done"],
      failed: ["done", "current", "pending"]
    };
    const states = stepStates[status] || stepStates.idle;
    const labels = ["Entrada", "Interpretação", "Revisão"];
    els.stepper.innerHTML = labels.map((label, index) => {
      const state = states[index];
      const cls = state === "done" ? "is-done" : state === "current" ? "is-current" : "";
      const mark = state === "done" ? "✓" : String(index + 1);
      return '<div class="step ' + cls + '"><span class="step-mark">' + mark + '</span><span>' + label + '</span></div>';
    }).join("");
  }

  function renderSource(data) {
    const cfg = statusConfig(data.document.status);
    els.documentStatus.className = "status " + cfg.cls;
    els.documentStatus.textContent = cfg.label;
    els.sourceFilename.textContent = customFilename || data.document.filename || "sem arquivo";
    els.sourceKind.textContent = data.document.source_kind === "plain_text" ? "texto simples" : esc(data.document.source_kind || "entrada");
    if (customSourceText == null) els.sourceText.value = data.source_text || "";
    els.interpret.disabled = data.document.status === "interprereting" || data.document.status === "interpreting";
  }

  function renderSummary(data) {
    const summary = data.interpretation.summary;
    const status = data.document.status;
    const cfg = statusConfig(status);

    els.summaryStatus.className = "status " + cfg.cls;
    els.summaryStatus.textContent = cfg.label;

    if (status === "idle") {
      els.summaryTitle.textContent = "Nenhuma leitura iniciada";
      els.summaryCopy.textContent = "O resumo aparece depois que uma lista for interpretada.";
    } else if (status === "interpreting") {
      els.summaryTitle.textContent = "Leitura em andamento";
      els.summaryCopy.textContent = "Os resultados só aparecem quando o bundle estiver pronto.";
    } else if (status === "failed") {
      els.summaryTitle.textContent = "Leitura não concluída";
      els.summaryCopy.textContent = "Nenhum resultado parcial é promovido silenciosamente após falha.";
    } else if (summary.records === 0 && status === "ready") {
      els.summaryTitle.textContent = "Nenhuma oferta encontrada";
      els.summaryCopy.textContent = "O documento foi lido, mas não produziu registros válidos.";
    } else {
      els.summaryTitle.textContent = activeScenario === "partial" ? "Resultado parcial para revisão" : "Interpretação concluída";
      els.summaryCopy.textContent = "Interpretado, inferido, ambíguo e inválido permanecem estados distintos.";
    }

    const metrics = [
      [summary.records, "ofertas"],
      [summary.interpreted, "interpretadas"],
      [summary.inferred, "inferidas"],
      [summary.ambiguous + summary.invalid, "para revisar"]
    ];
    els.metrics.innerHTML = metrics.map(item =>
      '<div class="metric"><strong>' + esc(item[0]) + '</strong><span>' + esc(item[1]) + '</span></div>'
    ).join("");

    const run = data.interpretation.run || {};
    const meta = [
      run.run_id ? "run " + run.run_id : null,
      run.engine_version || null,
      run.schema_id && run.schema_version ? run.schema_id + " · " + run.schema_version : null,
      data.interpretation.metrics ? data.interpretation.metrics.parse_ms + " ms" : null
    ].filter(Boolean);
    els.runMeta.innerHTML = meta.map(item => '<span class="meta-chip">' + esc(item) + '</span>').join("");
  }

  function filteredRecords(data) {
    const records = data.interpretation.records || [];
    if (activeFilter === "all") return records;
    return records.filter(record => record.state === activeFilter);
  }

  function stateBadge(state) {
    if (state === "interpreted") return '<span class="status good">Interpretado</span>';
    if (state === "inferred") return '<span class="status info">Inferido</span>';
    return '<span class="status neutral">' + esc(state) + '</span>';
  }

  function renderOffers(data) {
    const status = data.document.status;
    const records = filteredRecords(data);
    const shouldHideTable = status !== "ready" || records.length === 0;

    els.offersTableWrap.classList.toggle("is-hidden", shouldHideTable);
    els.offersEmpty.classList.toggle("is-hidden", !shouldHideTable);

    if (status === "idle") {
      els.offersEmptyTitle.textContent = "Aguardando uma lista";
      els.offersEmptyCopy.textContent = "Inicie uma análise para preencher este workspace.";
    } else if (status === "interpreting") {
      els.offersEmptyTitle.textContent = "Interpretando";
      els.offersEmptyCopy.textContent = "As ofertas aparecerão somente quando a leitura estiver pronta.";
    } else if (status === "failed") {
      els.offersEmptyTitle.textContent = "Sem resultado";
      els.offersEmptyCopy.textContent = "A execução falhou. A lista continua disponível para nova tentativa.";
    } else if (records.length === 0 && activeFilter !== "all") {
      els.offersEmptyTitle.textContent = "Nenhuma oferta neste filtro";
      els.offersEmptyCopy.textContent = "Troque o filtro para visualizar os outros estados.";
    } else {
      els.offersEmptyTitle.textContent = "Nenhuma oferta válida";
      els.offersEmptyCopy.textContent = "O documento não produziu registros que possam seguir para cálculo.";
    }

    els.offersBody.innerHTML = records.map(record => {
      const f = record.fields || {};
      const model = f.model || {};
      const selectedClass = record.record_id === selectedRecordId ? " is-selected" : "";
      return '<tr class="row-select' + selectedClass + '" data-record="' + esc(record.record_id) + '">' +
        '<td>' + stateBadge(record.state) + '</td>' +
        '<td class="model-cell"><strong>' + esc(model.label || model.id || "—") + '</strong><span>' + esc(record.record_id) + '</span></td>' +
        '<td>' + esc(f.condition || "—") + '</td>' +
        '<td>' + esc(f.color || "—") + '</td>' +
        '<td>' + esc(f.supplier || "—") + '</td>' +
        '<td class="price-cell">' + money(f.price, f.currency) + '</td>' +
        '<td><button class="table-link" data-evidence="' + esc(record.record_id) + '">Evidência</button></td>' +
      '</tr>';
    }).join("");

    els.offersBody.querySelectorAll("[data-record]").forEach(row => {
      row.addEventListener("click", event => {
        if (event.target.closest("[data-evidence]")) return;
        selectedRecordId = row.dataset.record;
        renderOffers(currentData());
      });
    });

    els.offersBody.querySelectorAll("[data-evidence]").forEach(button => {
      button.addEventListener("click", event => {
        event.stopPropagation();
        selectedRecordId = button.dataset.evidence;
        renderOffers(currentData());
        openEvidence(button.dataset.evidence);
      });
    });
  }

  function renderIssues(data) {
    const ambiguities = data.document.status === "ready" ? (data.interpretation.ambiguities || []) : [];
    const invalid = data.document.status === "ready" ? (data.interpretation.invalid || []) : [];

    els.ambiguityCount.textContent = countLabel(ambiguities.length, "caso", "casos");
    els.invalidCount.textContent = countLabel(invalid.length, "caso", "casos");

    els.ambiguityList.innerHTML = ambiguities.map(item =>
      '<div class="issue is-ambiguity">' +
        '<strong>' + esc(item.field ? "Campo: " + item.field : "Ambiguidade") + '</strong>' +
        '<p class="raw">“' + esc(item.raw || "Trecho sem resolução") + '”</p>' +
        '<span class="issue-meta">' + esc(item.cause) + ' · fontes ' + esc((item.sources || []).join(", ")) + '</span>' +
      '</div>'
    ).join("");

    els.invalidList.innerHTML = invalid.map(item =>
      '<div class="issue is-invalid">' +
        '<strong>Registro não utilizável</strong>' +
        '<p class="raw">“' + esc(item.raw || "Trecho inválido") + '”</p>' +
        '<span class="issue-meta">' + esc(item.cause) + ' · fontes ' + esc((item.sources || []).join(", ")) + '</span>' +
      '</div>'
    ).join("");

    els.ambiguityEmpty.classList.toggle("is-hidden", ambiguities.length !== 0);
    els.invalidEmpty.classList.toggle("is-hidden", invalid.length !== 0);
  }

  function renderFilters() {
    els.filters.forEach(button => button.classList.toggle("is-active", button.dataset.filter === activeFilter));
  }

  function openEvidence(recordId) {
    const data = currentData();
    const record = (data.interpretation.records || []).find(item => item.record_id === recordId);
    if (!record) return;

    const fields = record.fields || {};
    const model = fields.model || {};
    els.drawerRecord.innerHTML =
      '<strong>' + esc(model.label || model.id || record.record_id) + '</strong>' +
      '<span>' + stateBadge(record.state) + ' · ' + esc(fields.supplier || "sem fornecedor") + ' · ' + money(fields.price, fields.currency) + '</span>';

    els.traceList.innerHTML = (record.trace || []).map(trace => {
      const rules = (trace.rules || []).join(", ") || "—";
      const sources = (trace.sources || []).join(", ") || "—";
      const derived = (trace.derived_from || []).join(", ") || "—";
      const alternatives = (trace.alternatives || []).join(", ") || "—";
      const score = trace.score == null ? "sem score" : "score " + Number(trace.score).toFixed(2);
      return '<div class="trace-item">' +
        '<div class="trace-top"><strong>' + esc(trace.field) + '</strong><span class="trace-score">' + esc(score) + '</span></div>' +
        '<div class="trace-chosen">Escolhido: <strong>' + esc(trace.chosen) + '</strong></div>' +
        '<div class="trace-meta">' +
          '<span>regras: ' + esc(rules) + '</span>' +
          '<span>fontes: ' + esc(sources) + '</span>' +
          '<span>derivado de: ' + esc(derived) + '</span>' +
          '<span>alternativas: ' + esc(alternatives) + '</span>' +
        '</div>' +
      '</div>';
    }).join("");

    const run = data.interpretation.run || {};
    const rows = [
      ["run_id", run.run_id],
      ["engine", run.engine_version],
      ["schema", run.schema_id && run.schema_version ? run.schema_id + "/" + run.schema_version : null],
      ["knowledge", run.knowledge_version],
      ["document_hash", run.document_hash]
    ].filter(row => row[1]);
    els.drawerRunMeta.innerHTML = rows.map(row =>
      '<div class="drawer-meta-row"><span>' + esc(row[0]) + '</span><span>' + esc(row[1]) + '</span></div>'
    ).join("");

    els.drawerBackdrop.hidden = false;
    requestAnimationFrame(() => els.drawer.classList.add("is-open"));
    els.drawer.setAttribute("aria-hidden", "false");
  }

  function closeEvidence() {
    els.drawer.classList.remove("is-open");
    els.drawer.setAttribute("aria-hidden", "true");
    window.setTimeout(() => { els.drawerBackdrop.hidden = true; }, 180);
  }

  function render() {
    const data = currentData();
    renderProcessing(data);
    renderSource(data);
    renderSummary(data);
    renderFilters();
    renderOffers(data);
    renderIssues(data);
  }

  function setScenario(name, options) {
    if (processingTimer) {
      clearTimeout(processingTimer);
      processingTimer = null;
    }
    activeScenario = scenarios[name] ? name : "ready";
    selectedRecordId = null;
    if (!(options && options.keepCustomSource)) {
      customSourceText = null;
      customFilename = null;
    }
    els.scenario.value = activeScenario;
    els.inputFeedback.textContent = "";
    closeEvidence();
    render();
  }

  els.scenario.addEventListener("change", () => setScenario(els.scenario.value));

  els.filters.forEach(button => {
    button.addEventListener("click", () => {
      activeFilter = button.dataset.filter;
      renderFilters();
      renderOffers(currentData());
    });
  });

  els.sourceText.addEventListener("input", () => {
    customSourceText = els.sourceText.value;
    els.inputFeedback.textContent = "";
  });

  els.uploadFile.addEventListener("click", () => els.sourceFile.click());
  els.sourceFile.addEventListener("change", async () => {
    const file = els.sourceFile.files && els.sourceFile.files[0];
    if (!file) return;
    if (!file.name.toLowerCase().endsWith(".txt")) {
      els.inputFeedback.textContent = "Nesta slice, o preview local aceita apenas .txt.";
      return;
    }
    customSourceText = await file.text();
    customFilename = file.name;
    activeScenario = "idle";
    els.scenario.value = "idle";
    render();
    els.sourceText.value = customSourceText;
    els.sourceFilename.textContent = customFilename;
  });

  els.interpret.addEventListener("click", () => {
    const value = els.sourceText.value.trim();
    if (!value) {
      els.inputFeedback.textContent = "Cole uma lista ou envie um arquivo antes de interpretar.";
      return;
    }
    customSourceText = value;
    activeScenario = "processing";
    els.scenario.value = "processing";
    render();
    els.sourceText.value = customSourceText;
    if (customFilename) els.sourceFilename.textContent = customFilename;

    processingTimer = window.setTimeout(() => {
      activeScenario = "ready";
      els.scenario.value = "ready";
      render();
      els.sourceText.value = customSourceText;
      if (customFilename) els.sourceFilename.textContent = customFilename;
      processingTimer = null;
    }, 850);
  });

  els.newAnalysis.addEventListener("click", () => {
    customSourceText = "";
    customFilename = null;
    setScenario("idle", { keepCustomSource: true });
    els.sourceText.value = "";
    els.sourceText.focus();
  });

  els.closeDrawer.addEventListener("click", closeEvidence);
  els.drawerBackdrop.addEventListener("click", closeEvidence);
  document.addEventListener("keydown", event => {
    if (event.key === "Escape") closeEvidence();
  });

  setScenario("ready");
})();
