(() => {
  const contracts = window.ExternalCalcContracts;
  const fixtures = window.ExternalCalcFixtures;
  const $ = function(id){ return document.getElementById(id); };
  const els = {
    scenario:$("scenario"), statusDot:$("status-dot"), statusTitle:$("status-title"), statusCopy:$("status-copy"),
    stepPills:$("step-pills"), sourceStatus:$("source-status"), sourceInput:$("source-input"), fileInput:$("file-input"),
    sourceName:$("source-name"), sourceKind:$("source-kind"), chooseFile:$("choose-file"), run:$("run-analysis"),
    newAnalysis:$("new-analysis"), inputMessage:$("input-message"), summaryTitle:$("summary-title"),
    summaryBadge:$("summary-badge"), metrics:$("metrics"), summaryNote:$("summary-note"), runMeta:$("run-meta"),
    rows:$("offer-rows"), table:$("table-scroll"), empty:$("empty-state"), emptyTitle:$("empty-title"),
    emptyCopy:$("empty-copy"), reviewList:$("review-list"), reviewCount:$("review-count"), reviewEmpty:$("review-empty"),
    invalidList:$("invalid-list"), invalidCount:$("invalid-count"), invalidEmpty:$("invalid-empty"),
    next:$("next-step"), tabs:[...document.querySelectorAll("[data-filter]")], drawer:$("evidence-drawer"),
    backdrop:$("drawer-backdrop"), closeDrawer:$("close-drawer"), drawerContent:$("drawer-content"),
    dialog:$("review-dialog"), reviewBody:$("review-body"), reviewForm:$("review-form"), confirmReview:$("confirm-review")
  };

  let scenario = "review";
  let filter = "all";
  let bundle = structuredClone(fixtures[scenario]);
  let selectedIssue = null;
  let timer = null;

  function escapeHtml(value) {
    return String(value == null ? "" : value)
      .replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;")
      .replaceAll('"',"&quot;").replaceAll("'","&#039;");
  }

  function money(value) {
    if (!value || !Number.isInteger(value.amount_minor)) return "—";
    return new Intl.NumberFormat("pt-BR",{style:"currency",currency:value.currency}).format(value.amount_minor/100);
  }

  function statusView(status) {
    const map = {
      NOT_STARTED:{title:"Pronto para uma nova análise",copy:"Cole ou envie uma lista para começar.",label:"Inicial",cls:"neutral",dot:"idle"},
      QUEUED:{title:"Análise na fila",copy:"A entrada foi aceita e aguarda execução.",label:"Na fila",cls:"inferred",dot:"processing"},
      RUNNING:{title:"Interpretando lista",copy:"O motor está estruturando ofertas e separando incertezas.",label:"Processando",cls:"inferred",dot:"processing"},
      SUCCEEDED:{title:"Interpretação pronta",copy:"A leitura terminou e pode ser revisada.",label:"Pronto",cls:"success",dot:""},
      FAILED:{title:"Falha na interpretação",copy:(bundle.c01.execution.error||{}).safe_message || "Tente novamente.",label:"Falhou",cls:"danger",dot:"failed"},
      CANCELLED:{title:"Execução cancelada",copy:"A análise foi interrompida.",label:"Cancelado",cls:"danger",dot:"failed"}
    };
    return map[status] || map.NOT_STARTED;
  }

  function renderSteps(status, hasReview) {
    let states = ["pending","pending","pending"];
    if (status === "RUNNING" || status === "QUEUED") states = ["done","current","pending"];
    if (status === "SUCCEEDED") states = ["done","done",hasReview ? "current" : "done"];
    if (status === "FAILED") states = ["done","current","pending"];
    const labels = ["Entrada","Interpretação","Revisão"];
    els.stepPills.innerHTML = labels.map(function(label,index){
      const cls = states[index] === "done" ? " done" : states[index] === "current" ? " current" : "";
      return '<span class="step-pill'+cls+'">'+escapeHtml(label)+'</span>';
    }).join("");
  }

  function renderHeader() {
    const status = bundle.c01.execution.execution_status;
    const pending = (bundle.c01.issues||[]).some(function(issue){ return issue.outcome === "REVIEW_REQUIRED"; });
    const view = statusView(status);
    els.statusTitle.textContent = view.title;
    els.statusCopy.textContent = view.copy;
    els.statusDot.className = "status-dot" + (view.dot ? " "+view.dot : "");
    renderSteps(status,pending);
    els.sourceStatus.className = "badge "+view.cls;
    els.sourceStatus.textContent = view.label;
  }

  function renderSource() {
    els.sourceInput.value = bundle.source.content || "";
    els.sourceName.textContent = bundle.source.source_name || "sem arquivo";
    els.sourceKind.textContent = bundle.source.source_type || "entrada";
    els.run.disabled = bundle.c01.execution.execution_status === "RUNNING";
  }

  function metric(value,label) {
    return '<div class="metric"><strong>'+escapeHtml(value)+'</strong><span>'+escapeHtml(label)+'</span></div>';
  }

  function renderSummary() {
    const offers = bundle.c01.offers || [];
    const valid = offers.filter(function(item){ return item.status === "VALID"; }).length;
    const review = offers.filter(function(item){ return item.status === "REVIEW_REQUIRED"; }).length;
    const invalid = (bundle.c01.issues || []).filter(function(item){ return item.outcome === "INVALID"; }).length;
    const status = bundle.c01.execution.execution_status;
    const view = statusView(status);

    els.summaryBadge.className = "badge "+view.cls;
    els.summaryBadge.textContent = view.label;

    if (status === "NOT_STARTED") {
      els.summaryTitle.textContent = "Nenhuma leitura iniciada";
      els.summaryNote.textContent = "O resumo aparece quando a interpretação produzir um output C01.";
    } else if (status === "RUNNING" || status === "QUEUED") {
      els.summaryTitle.textContent = "Leitura em andamento";
      els.summaryNote.textContent = "Nenhum resultado parcial é promovido como oferta válida.";
    } else if (status === "FAILED") {
      els.summaryTitle.textContent = "Leitura não concluída";
      els.summaryNote.textContent = "Falha técnica permanece separada de INVALID e INSUFFICIENT_DATA.";
    } else {
      els.summaryTitle.textContent = review ? "Revisão necessária" : "Leitura concluída";
      els.summaryNote.textContent = review ? "Há campos ambíguos que precisam de decisão humana antes do handoff." : "As ofertas válidas já respeitam a fronteira Reviewed Offer.";
    }

    els.metrics.innerHTML =
      metric(offers.length,"ofertas") +
      metric(valid,"válidas") +
      metric(review,"para revisar") +
      metric(invalid,"inválidas");

    const e = bundle.c01.execution;
    els.runMeta.innerHTML = [
      e.run_id,
      "C01/"+e.contract_version,
      e.engine_version,
      "rev current"
    ].map(function(item){ return '<span>'+escapeHtml(item)+'</span>'; }).join("");
  }

  function badge(status, mode) {
    if (status === "REVIEW_REQUIRED") return '<span class="badge review">Revisar</span>';
    if (status === "INVALID") return '<span class="badge danger">Inválido</span>';
    if (mode === "inferred") return '<span class="badge inferred">Inferido</span>';
    return '<span class="badge success">Interpretado</span>';
  }

  function filteredOffers() {
    const offers = bundle.c01.offers || [];
    if (filter === "all") return offers;
    return offers.filter(function(item){ return item.status === filter; });
  }

  function renderOffers() {
    const status = bundle.c01.execution.execution_status;
    const offers = filteredOffers();
    const showTable = status === "SUCCEEDED" && offers.length > 0;
    els.table.classList.toggle("hidden",!showTable);
    els.empty.classList.toggle("hidden",showTable);

    if (!showTable) {
      if (status === "NOT_STARTED") {
        els.emptyTitle.textContent = "Aguardando uma lista";
        els.emptyCopy.textContent = "Inicie uma análise para preencher o workspace.";
      } else if (status === "RUNNING" || status === "QUEUED") {
        els.emptyTitle.textContent = "Interpretando";
        els.emptyCopy.textContent = "Os resultados aparecem somente após a execução concluir.";
      } else if (status === "FAILED") {
        els.emptyTitle.textContent = "Execução não concluída";
        els.emptyCopy.textContent = "A lista foi preservada e pode ser reenviada.";
      } else {
        els.emptyTitle.textContent = filter === "all" ? "Nenhuma oferta encontrada" : "Nenhuma oferta neste filtro";
        els.emptyCopy.textContent = "A leitura não produziu registros para este estado.";
      }
    }

    els.rows.innerHTML = offers.map(function(item){
      const p = item.product || {};
      const attrs = p.attributes || {};
      return '<tr>'+
        '<td>'+badge(item.status,attrs.interpretation_mode)+'</td>'+
        '<td class="offer-title"><strong>'+escapeHtml(p.display_name)+'</strong><span>'+escapeHtml(item.offer_ref.offer_id)+' · rev '+escapeHtml(item.offer_ref.offer_revision)+'</span></td>'+
        '<td>'+escapeHtml(p.condition || "—")+'</td>'+
        '<td>'+escapeHtml(attrs.color || "—")+'</td>'+
        '<td>'+escapeHtml(attrs.supplier || "—")+'</td>'+
        '<td class="numeric">'+escapeHtml(money(item.supplier_offer_price))+'</td>'+
        '<td><button class="link-button" data-evidence="'+escapeHtml(item.offer_ref.offer_id)+'">Evidência</button></td>'+
      '</tr>';
    }).join("");

    els.rows.querySelectorAll("[data-evidence]").forEach(function(button){
      button.addEventListener("click",function(){ openEvidence(button.dataset.evidence); });
    });

    els.next.disabled = contracts.validOffers(bundle.c01).length === 0 ||
      (bundle.c01.issues||[]).some(function(issue){ return issue.outcome === "REVIEW_REQUIRED"; });
  }

  function renderReview() {
    const reviews = (bundle.c01.issues||[]).filter(function(issue){ return issue.outcome === "REVIEW_REQUIRED"; });
    const invalids = (bundle.c01.issues||[]).filter(function(issue){ return issue.outcome === "INVALID"; });

    els.reviewCount.textContent = String(reviews.length);
    els.invalidCount.textContent = String(invalids.length);
    els.reviewEmpty.classList.toggle("hidden",reviews.length !== 0);
    els.invalidEmpty.classList.toggle("hidden",invalids.length !== 0);

    els.reviewList.innerHTML = reviews.map(function(issue){
      return '<article class="review-card">'+
        '<span class="field">'+escapeHtml(issue.field || "campo")+'</span>'+
        '<strong>'+escapeHtml(issue.raw || "Valor ambíguo")+'</strong>'+
        '<p>'+escapeHtml(issue.cause || "review_required")+' · '+escapeHtml((issue.source_refs||[]).map(function(ref){return ref.ref_id;}).join(", "))+'</p>'+
        '<button class="button secondary" data-review="'+escapeHtml(issue.issue_id)+'">Resolver</button>'+
      '</article>';
    }).join("");

    els.invalidList.innerHTML = invalids.map(function(issue){
      return '<article class="invalid-card">'+
        '<span class="field">registro inválido</span>'+
        '<strong>'+escapeHtml(issue.raw || "Registro sem dados suficientes")+'</strong>'+
        '<p>'+escapeHtml(issue.cause || "invalid")+'</p>'+
      '</article>';
    }).join("");

    els.reviewList.querySelectorAll("[data-review]").forEach(function(button){
      button.addEventListener("click",function(){ openReview(button.dataset.review); });
    });
  }

  function renderTabs() {
    els.tabs.forEach(function(button){
      button.classList.toggle("active",button.dataset.filter === filter);
    });
  }

  function render() {
    contracts.assertC01Response(bundle.c01);
    renderHeader();
    renderSource();
    renderSummary();
    renderTabs();
    renderOffers();
    renderReview();
  }

  function openEvidence(offerId) {
    const offer = (bundle.c01.offers||[]).find(function(item){ return item.offer_ref.offer_id === offerId; });
    if (!offer) return;
    const traces = (bundle.traces||{})[offerId] || [];
    const provenance = (offer.evidence_refs||[]).map(function(ref){ return ref.kind+":"+ref.ref_id; }).join(", ") || "—";
    els.drawerContent.innerHTML =
      '<section class="drawer-block"><h3>'+escapeHtml(offer.product.display_name)+'</h3>'+
      '<div class="key-value"><span>offer_id</span><span>'+escapeHtml(offerId)+'</span></div>'+
      '<div class="key-value"><span>revision</span><span>'+escapeHtml(offer.offer_ref.offer_revision)+'</span></div>'+
      '<div class="key-value"><span>status</span><span>'+escapeHtml(offer.status)+'</span></div>'+
      '<div class="key-value"><span>confidence</span><span>'+escapeHtml(offer.interpretation_confidence ? offer.interpretation_confidence.score : "—")+'</span></div>'+
      '<div class="key-value"><span>provenance</span><span>'+escapeHtml(provenance)+'</span></div></section>'+
      '<section class="drawer-block"><h3>Trace</h3>'+
      (traces.length ? traces.map(function(trace){
        return '<div class="key-value"><span>'+escapeHtml(trace.field)+'</span><span>'+escapeHtml(String(trace.chosen == null ? "não resolvido" : trace.chosen))+' · '+escapeHtml(trace.rule)+' · '+escapeHtml(trace.source)+' · '+escapeHtml(trace.score)+'</span></div>';
      }).join("") : '<div class="key-value"><span>trace</span><span>sem detalhe na fixture</span></div>')+
      '</section>'+
      '<section class="drawer-block"><h3>Execução</h3>'+
      '<div class="key-value"><span>run_id</span><span>'+escapeHtml(bundle.c01.execution.run_id)+'</span></div>'+
      '<div class="key-value"><span>engine</span><span>'+escapeHtml(bundle.c01.execution.engine_version)+'</span></div>'+
      '<div class="key-value"><span>fingerprint</span><span>'+escapeHtml(bundle.c01.execution.input_fingerprint)+'</span></div></section>';

    els.backdrop.classList.remove("hidden");
    els.drawer.classList.add("open");
    els.drawer.setAttribute("aria-hidden","false");
  }

  function closeEvidence() {
    els.drawer.classList.remove("open");
    els.drawer.setAttribute("aria-hidden","true");
    window.setTimeout(function(){ els.backdrop.classList.add("hidden"); },180);
  }

  function openReview(issueId) {
    selectedIssue = (bundle.c01.issues||[]).find(function(issue){ return issue.issue_id === issueId; });
    if (!selectedIssue) return;
    const candidates = selectedIssue.candidates || [];
    els.reviewBody.innerHTML =
      '<p class="summary-note">Trecho: <strong>'+escapeHtml(selectedIssue.raw)+'</strong></p>'+
      '<div class="candidate-list">'+
      candidates.map(function(candidate,index){
        return '<label class="candidate"><input type="radio" name="candidate" value="'+escapeHtml(candidate.value)+'" '+(index===0?"checked":"")+'>'+
          '<span><strong>'+escapeHtml(candidate.label)+'</strong><span>'+escapeHtml(candidate.detail || "")+'</span></span></label>';
      }).join("")+
      '</div>';
    els.dialog.showModal();
  }

  function applyReview() {
    if (!selectedIssue) return;
    const chosen = els.reviewForm.querySelector('input[name="candidate"]:checked');
    if (!chosen) return;
    const offer = (bundle.c01.offers||[]).find(function(item){ return item.offer_ref.offer_id === selectedIssue.offer_id; });
    if (!offer) return;
    offer.product.condition = chosen.value;
    offer.status = "VALID";
    offer.offer_ref.offer_revision += 1;
    bundle.c01.issues = bundle.c01.issues.filter(function(issue){ return issue.issue_id !== selectedIssue.issue_id; });
    bundle.traces[offer.offer_ref.offer_id] = (bundle.traces[offer.offer_ref.offer_id] || []).concat([{
      field:selectedIssue.field,chosen:chosen.value,rule:"human_review",source:"review UI",score:1
    }]);
    selectedIssue = null;
    render();
  }

  function setScenario(name) {
    if (timer) window.clearTimeout(timer);
    scenario = fixtures[name] ? name : "ready";
    bundle = structuredClone(fixtures[scenario]);
    filter = "all";
    els.inputMessage.textContent = "";
    closeEvidence();
    render();
  }

  els.scenario.addEventListener("change",function(){ setScenario(els.scenario.value); });
  els.tabs.forEach(function(button){
    button.addEventListener("click",function(){
      filter = button.dataset.filter;
      renderTabs();
      renderOffers();
    });
  });

  els.chooseFile.addEventListener("click",function(){ els.fileInput.click(); });
  els.fileInput.addEventListener("change",async function(){
    const file = els.fileInput.files && els.fileInput.files[0];
    if (!file) return;
    if (!file.name.toLowerCase().endsWith(".txt")) {
      els.inputMessage.textContent = "O preview V1 aceita apenas .txt.";
      return;
    }
    bundle = structuredClone(fixtures.idle);
    bundle.source.source_name = file.name;
    bundle.source.content = await file.text();
    els.scenario.value = "idle";
    render();
  });

  els.run.addEventListener("click",function(){
    const content = els.sourceInput.value.trim();
    if (!content) {
      els.inputMessage.textContent = "Cole uma lista ou envie um arquivo antes de interpretar.";
      return;
    }
    const sourceName = bundle.source.source_name || "entrada-manual.txt";
    bundle = structuredClone(fixtures.processing);
    bundle.source.content = content;
    bundle.source.source_name = sourceName;
    render();
    timer = window.setTimeout(function(){
      bundle = structuredClone(fixtures.review);
      bundle.source.content = content;
      bundle.source.source_name = sourceName;
      els.scenario.value = "review";
      render();
    },700);
  });

  els.newAnalysis.addEventListener("click",function(){
    setScenario("idle");
    els.scenario.value = "idle";
    els.sourceInput.focus();
  });

  els.closeDrawer.addEventListener("click",closeEvidence);
  els.backdrop.addEventListener("click",closeEvidence);
  document.addEventListener("keydown",function(event){ if (event.key === "Escape") closeEvidence(); });

  els.reviewForm.addEventListener("submit",function(event){
    if (event.submitter && event.submitter.value === "default") {
      event.preventDefault();
      applyReview();
      els.dialog.close();
    }
  });

  setScenario("review");
})();