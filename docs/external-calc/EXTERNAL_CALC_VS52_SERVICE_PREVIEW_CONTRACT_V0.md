# External Calc — VS5.2 / Service Preview Contract V0

**Data:** 21/10/2026. **PR:** #190, DRAFT, empilhado nos PRs #182–#189. **Gate produção:** NO-GO.

## Motivação, achados reais e decisão

O arquivo `ferramentas/external-calc-service/v0/external-calc-service.js` executa o `runExternalCalcCorePipeline` C01–C05. O runtime `external-calc-c01-review-candidate-runtime/v0/candidate-runtime.js` persiste candidatos de revisão por `candidateRepository.persistCandidate`. A autoridade `external-calc-c01-review/v0/c01-review-authority.js` executa revisão humana e grava o resultado via `reviewRepository.persistReview`.

**Portanto:** não inserir diretamente o resolvedor experimental no Service autoritativo, nem invocar `candidate-runtime.execute` ou `reviewAuthority.review` neste slice. O risco de contaminar revisão/histórico sem homologação é real.

## Implementado (somente Shadow)

`ferramentas/external-calc-generalization/v0/service-preview-contract.cjs` expõe:

```js
const previewService=createVS52PreviewService({
  trustedInputResolver:{ resolve({trusted_input_ref,tenant_id,actor_ref}) {...} }
});
await previewService.preview({
  trusted_input_ref:'trusted-reference-from-server',
  context:{
    tenant_id:'tenant from verified auth server',
    subject:'actor from verified auth server',
    can_execute_external_calc:true
  }
});
```

**Atenção:** a função é uma API **interna de prova**, não endpoint público. O `context` precisa ser criado por middleware de autenticação confiável; um chamador que forneça seu próprio objeto é **fora do modelo de segurança** e não constitui autenticação real. A VS5.3 deve integrar uma fronteira de auth concreta e provar proteção contra impersonação.

### Contrato do envelope preview
- `contract_version: external-calc-vs52-service-preview/v0` — **diferente do C01 autoritativo**;
- `mode: READ_ONLY_PREVIEW`, `stage: REVIEW`, `domain_outcome: REVIEW_REQUIRED`, `freshness_status: PREVIEW_ONLY`;
- `source_hash` original, `preview_fingerprint` SHA-256 determinístico vinculado ao tenant, ator, referência, candidatos e riscos;
- Cada proposta contém campos `model/capacity/color/condition/price`, `field_sources` e `provenance_refs`;
- Campos `analysis_id`, `offer_id`, `offer_revision` = `null`. `authorized_offers=[]`, `persisted_count=0`, `lifecycle=NOT_REGISTERED`;
- `authorization.accept/persist/quote/publish=false`. Nenhum método de revisão ou escrita é disponibilizado.

### Provas de CI
- [CI #39634755305](https://github.com/vinialbuquerquepitstop-beep/pitwall--nucleo/actions/runs/39634755305), `EXTERNAL_CALC_VS52_CONTRACT=PASS checks=8`:
  1. Envelope não é contrato C01 nem candidato persistido;
  2. Mesmo input e contexto → fingerprint idêntico;
  3. Contexto ausente/sem capability → fail-closed;
  4. Tenant autenticado divergente da fonte resolvida → bloqueio;
  5. Referência de origem divergente → bloqueio;
  6. Fonte vazia/referência vazia → bloqueio;
  7. Fingerprint diferente entre tenants;
  8. Proposta não recebe identidade autoritativa.
- A prova usa um `trustedInputResolver` em memória, **não teste de Auth, RLS ou tenant em Supabase**. CI verde não prova enforcement real da infraestrutura.

## Contrato de integração pendente (VS5.3)

1. Definir endpoint interno com autenticação verificável, `trustedInputResolver` tenant-scoped, limites de payload/candidatos, idempotência, trace e erro por invocação. Não confiar em `tenant_id` recebido do cliente.
2. Provar que o endpoint não alcança `persistCandidate`, `persistReview`, `applyHumanReview`, `runExternalCalcCorePipeline` nem RPC de promoção. Garantir ausência de escrita por teste negativo.
3. Especificar mapeamento **versionado** `ProposedReview`→candidato C01, sem confundir pré-visualização com `external-calc-c01-readonly/v1`. Tal mapeamento continuará proibido até gate explícito.
4. Comparar path atual e preview com **mesmo texto**, fingerprint, oracle e logs de divergência; não se exige igualdade com legado quando oracle demonstra que legado erra.
5. Fazer gate de segurança das 24 revisões potencialmente contaminadas e reconciliação/quarentena dos PRs #178–#180 antes de qualquer escrita.
6. Browser desktop/mobile e revisão humana só após runtime com auth, tenant/RLS, rollback e API comprovados; VS6 externo inédito permanece independente.

**Decisão:** `VS5.2_PREVIEW_CONTRACT=CI_PASS`; `ACTUAL_AUTH_RLS=UNVERIFIED`; `C01_SERVICE_INTEGRATION=NOT_RUN`; `GATE1_PRODUCTION=NO_GO`.
