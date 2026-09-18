(() => {
  const execution = new Set(["NOT_STARTED","QUEUED","RUNNING","SUCCEEDED","FAILED","CANCELLED"]);
  const offer = new Set(["VALID","REVIEW_REQUIRED","INVALID","EXCLUDED"]);

  function assertMoney(value) {
    if (!value) return;
    if (!Number.isInteger(value.amount_minor)) throw new Error("Money.amount_minor deve ser inteiro.");
    if (!/^[A-Z]{3}$/.test(value.currency || "")) throw new Error("Money.currency inválida.");
  }

  function assertC01Response(value) {
    if (!value || !value.execution) throw new Error("Resposta C01 ausente.");
    if (value.execution.contract_id !== "C01") throw new Error("contract_id precisa ser C01.");
    if (!execution.has(value.execution.execution_status)) throw new Error("execution_status não canônico.");
    if (value.execution.freshness_status !== "CURRENT") throw new Error("Output STALE não pode alimentar a tela corrente.");
    (value.offers || []).forEach(function(item) {
      if (!item.offer_ref) throw new Error("OfferRef ausente.");
      if (item.offer_ref.analysis_id !== value.execution.analysis_id) throw new Error("OfferRef incompatível com a análise.");
      if (!offer.has(item.status)) throw new Error("Offer status não canônico.");
      assertMoney(item.supplier_offer_price);
    });
    return value;
  }

  function validOffers(value) {
    assertC01Response(value);
    if (value.execution.execution_status !== "SUCCEEDED") return [];
    return (value.offers || []).filter(function(item){ return item.status === "VALID"; });
  }

  window.ExternalCalcContracts = { assertC01Response, validOffers };
})();