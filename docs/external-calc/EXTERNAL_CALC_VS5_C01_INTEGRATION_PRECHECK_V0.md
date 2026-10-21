# External Calc — VS5 / Pré-integração C01 com dois caminhos read-only

Data: 21/10/2026. Branch `feat/external-calc-vs5-c01-compatibility-readonly-20261021`; [PR #188](https://github.com/vinialbuquerquepitstop-beep/pitwall--nucleo/pull/188) DRAFT, empilhado nos PRs #182–#187.

## Escopo implementado
- `ferramentas/external-calc-generalization/v0/c01-compatibility-shadow.cjs`: adapter **SHADOW**, converte proposições de VS2/VS3 para apresentação dos mesmos *campos materiais* do C01 (`model / capacity_gb / condition / color / price`), mantendo `source_spans` e evidência de origem.
- **Não** emite o contrato executável `external-calc-c01-readonly/v1`: `contract_version=null`, `offer_id=null`, `offer_revision=null`, `reviewed_offer=null`, `accept_disabled/persist_disabled/quote_disabled/publish_disabled=true`.
- `compareToExistingC01ReadOnly` executa `buildQueue` real e motor VS2/VS3 sobre a **mesma fonte textual e hash canônico**, compara multiconjunto exato modelo/capacidade/cor/condição/preço, preservando diferenças em vez de impor igualdade falsa.
- Nenhum Worker, DB, API, tenant, Supabase, RLS, auto-promotion, Core V1 FROZEN ou frontend modificado.

## Evidência de CI
- [Run #39631712396](https://github.com/vinialbuquerquepitstop-beep/pitwall--nucleo/actions/runs/39631712396): `EXTERNAL_CALC_VS5_COMPATIBILITY=PASS checks=6`. Verifica shape não autoritativo, rastreabilidade, fonte idêntica, replay determinístico, abstenção segura e bloqueio de entrada vazia.
- Amostra manual artificial com 2 propostas VS2/VS3 → 0 candidatos C01, 0 matches: `MISMATCH`.
- Amostra artificial gerada `dev-vs5-dualpath-0001`, 12 blocos: **23 propostas VS2/VS3**, **20 candidatos C01**, **1 match material**, **22 só no shadow** e **19 só no C01**. `VS5_C01_EQUIVALENCE=MISMATCH`.
- Essa divergência **não demonstra** que 22 propostas são corretas e 19 erradas. A prova de *truth* exige oracle independente sobre a mesma amostra e diff de campos, fontes e origem. O motor shadow teve generalização sintética positiva/negativa em outras famílias; isso não é equivalência C01 no runtime.
- `CI_PASS` prova os invariantes do adapter e a capacidade de detectar diferenças, **não** aprova o C01 atual ou sua substituição.

## Proposta de integração, não aprovação
1. Congelar SHA único + corpos originais + oracle independente; cruzar `C01 atual × VS2/VS3 × oracle` por `model/capacity/color/condition/price` e `source_span`, sem mudar qualquer regra com essa amostra até adjudicar o resultado.
2. Definir interface versionada no Service C01 **sem replicar regras no frontend** e sem quebrar consumidores C02–C05. Se o contrato do Core FROZEN precisar mudar, exigir proposta de unfreeze e gate humano independente.
3. Implementar em ambiente isolado com `write=false`; prova de revisão humana antes de qualquer `VALID`. Não reativar `auto-promotion` só porque um parser obteve zero ambiguidades.
4. Auditar PRs #178–#180 de segurança/contaminação e schema RPC antes de qualquer deploy, incluir teste de rollback e tenant/Auth/RLS com sessão real.
5. Validar navegador desktop e mobile, navegação, revisão, cotação, trade-in, simulação e histórico com o **mesmo SHA de backend**; imagens e fixture UI não substituem browse gate.
6. Só após esses gates considerar beta controlado; fornecedor real externo ainda não visto continua um gate próprio da VS6.

## Status
- VS5 Adapter e diff read-only: **IMPLEMENTED / CI PASS**.
- VS5 Equivalência C01: **MISMATCH / NO-GO**.
- VS5 E2E humano/tenant/browser: **NOT_RUN**.
- VS6 Real external unseen: **UNAVAILABLE**.
- Production: **NO-GO**.

Próximo slice executável: implementar *triangular proof* com oracle independente e relatório por campo (read-only). Sem aceitar `MATCH` do legado como prova de verdade.
