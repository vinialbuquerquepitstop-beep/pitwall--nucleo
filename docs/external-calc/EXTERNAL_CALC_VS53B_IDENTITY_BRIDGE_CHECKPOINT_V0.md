# External Calc — VS5.3b / Bridge de identidade existente

Data: 21/10/2026. **PR #192** DRAFT, empilhado no #191 e dependente dos PRs anteriores. Nenhuma rota registrada no runtime operacional.

## Hipótese, implementação e escopo
- A função **real** `resolveIdentity(request,config,fetchImpl)` exportada de `external-calc-runtime/v0/runtime.js` consulta o Auth `/auth/v1/user`, depois `app_usuario` (tenant_id, papel, ativo).
- `identity-bridge-shadow.cjs` conecta esse componente existente à rota experimental `preview-api-shadow.cjs`, sem duplicar autenticação nem modificar a identidade definida pelo servidor.
- Entrada HTTP no experimento limitada a `trusted_input_ref`; tenant, usuário, permissão, oferta, preço e decisão não vêm do cliente.
- Fonte resolvida por `trustedInputResolver` injetado, escopado pelo tenant e ator. Saída PREVIEW_ONLY e `REVIEW_REQUIRED`, sem oferta C01 válida.

## Evidência de testes isolados
- [CI #39638035641](https://github.com/vinialbuquerquepitstop-beep/pitwall--nucleo/actions/runs/39638035641): `EXTERNAL_CALC_VS53B_IDENTITY_BRIDGE=PASS checks=9 write_attempts=0`.
- Casos: owner tenant-A autorizado; beta validator tenant-B autorizado à fonte B, recusado para fonte A; vendedor recusado; perfil inativo recusado; token desconhecido/ausente recusado; corpo injetando tenant/ator/aceitação rejeitado; rota operacional bloqueada; fingerprint estável e token oculto.
- O adaptador `fetchImpl` no teste emula o protocolo HTTP de Auth e perfil. Requisições diferentes de GET abortam; `write_attempts=0`. **Nenhuma credencial real, URL real, banco ou RPC usado no teste.**
- `registered_in_operational_runtime=false`. O método mantém a rota experimental fora da produção e não incorpora a proposta ao C01.

## Limites e bloqueios
1. **Não está provado** que a política RLS real no Supabase protege a fonte: o `trustedInputResolver` é um stub com filtro tenant. Para provar RLS, são necessários ambiente de homologação autorizado, duas contas de tenants diferentes e fonte canônica tenant-scoped.
2. **Não está provado** JWT real, latência, expiração, revogação, cache, CORS de uma nova rota, limites de Worker nem navegador E2E.
3. Não existem autorizações para `persistCandidate`, `persistReview`, `auto_promote`, `runExternalCalcCorePipeline` nem C02–C05 no novo endpoint.
4. Quarentena/reconciliação de revisões antigas (#178–#180) e política de rollback ainda bloqueiam mudança do C01 autoritativo.

## Próximo gate linear
**VS5.3c — homol real, sem escrita:** identificar fonte de inputs tenant-scoped e seu contrato de acesso no banco existente, aprovar plano de teste de duas contas em ambiente isolado, executar testes negativos RLS com JWTs reais **somente após autorização e confirmação de ambiente**. Caso falte ambiente seguro, registrar `BLOCKED_UNVERIFIED`, não reaproveitar produção silenciosamente. Em paralelo, revisar ameaças (tokens, quota, SSRF, CORS, input size) e fronteiras de trace.

Estado: `VS53B_ISOLATED_AUTH_BRIDGE=PASS`, `REAL_RLS=NOT_RUN`, `PRODUCTION=NO_GO`.
