# External Calc — VS5.3 / endpoint de preview isolado

Data: 21/10/2026. [PR #191](https://github.com/vinialbuquerquepitstop-beep/pitwall--nucleo/pull/191) DRAFT, empilhado no #190 e dependente do método #182–#189.

## Escopo efetivamente implementado
- `ferramentas/external-calc-generalization/v0/preview-api-shadow.cjs` expõe fábrica HTTP-shaped `createVS53PreviewApi({authenticate,trustedInputResolver})` **não registrada** em `external-calc-runtime/v0/runtime.js`.
- Caminho reservado somente para o experimento: `POST /api/external-calc/v0/experimental/preview`. Sem alterações em `/execute`, `/review`, `candidate-runtime`, C01–C05 ou Service operacional.
- `authenticate(request)` precisa ser uma fronteira **servidora confiável**: verifica `tenant_id`, `subject` e `can_execute_external_calc`. Nenhum tenant, ator, preço, lista, decisão, offer_id, token ou conteúdo de catálogo é aceito no body; **apenas** `trusted_input_ref`.
- O resolver recebe `trusted_input_ref + tenant_id + actor_ref` autenticados e deve resolver a fonte já existente **no tenant certo**, ou recusar. Códigos: 401 sem identidade, 403 sem permissão, 404 para fonte/tenant inacessível, 400 corpo inadequado, 422 falha interna com mensagem genérica. `cache-control: no-store`.
- Chama o preview da VS5.2, não a autoridade C01. Resultado `READ_ONLY_PREVIEW`, candidatos `REVIEW_REQUIRED`, `offer_id=null`, `offer_revision=null`, `analysis_id=null`, e `persisted_count=0`; todas ações accept/persist/quote/publish desabilitadas.

## Evidência e limites
- [CI #39635853582](https://github.com/vinialbuquerquepitstop-beep/pitwall--nucleo/actions/runs/39635853582): `EXTERNAL_CALC_VS53_AUTH_PREVIEW=PASS checks=9`. Cobriu rotas, auth-before-lookup, permissão, tenant, body allowlist, referência inacessível, entrada grande, replay, erro opaco e saída sem autoridade.
- **Autenticação real NÃO foi conectada nem comprovada.** O callback nos testes é memória simulada, não JWT Supabase nem RLS real.
- O teste `writeCalls=0` demonstra que o experimento **não possui dependência de escrita**; não substitui auditoria de queries/permits em Postgres.
- `runtime_registered=false`, `real_auth=NOT_RUN`, `tenant_rls=NOT_RUN`, `browser_e2e=NOT_RUN`, `production=NO_GO`.
- O preview não deve ser exposto ao público nem conectado à produção antes de autorização separada de integração, prova de fail-closed da fonte e auditoria dos PRs #178–#180/quarentena.

## Próximo slice VS5.3b
Criar prova de integração **isolada** com o `resolveIdentity` real reutilizado do runtime, cliente Supabase de teste sem escrita e resolver RLS tenant-scoped, só quando houver ambiente de homologação seguro. Conferir rota não registrada, ausência de persistência, quotas e falhas HTTP. Registrar SHA do código e evidência de browser. Não exigir igualdade com o legado: comparar com oracle independente.

**Status:** `VS5.3_ISOLATED_ROUTE=CI_PASS`; `PRODUCTION_SERVICE=UNCHANGED`; `GATE1=NO_GO`.
