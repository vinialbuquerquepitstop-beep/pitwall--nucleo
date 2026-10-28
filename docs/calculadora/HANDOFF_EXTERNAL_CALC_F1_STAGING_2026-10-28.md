# External Calc F1 — Handoff / Brain Checkpoint — 2026-10-28

**Estado:** `DEPLOY=BLOCKED`, `F1_STAGING_E2E=NOT_RUN`, `RELEASE_NO_GO`, produção intocada.

## Objetivo
Concluir o fluxo real F1: lista de fornecedor → original imutável → C01 em revisão → recuperação manual → persistência → revisão humana e auditoria. Não duplicar C01–C05 no frontend, não criar QA visual artificial, não reabrir telas aprovadas.

## Refs
- Backend `vinialbuquerquepitstop-beep/pitwall--nucleo`, branch remota `feat/external-calc-f1-controlled-intake-20261022`, HEAD referenciado pelo Codex `c22f127abf0638d2ce24c90242b39617ef52c29f`. PR #200 em draft.
- Codex local relatado: branch `codex/external-calc-f1-staging-deploy-20261028`, checkout `C:\Users\jessi\OneDrive\Documentos\ChatGPT\pitswall\external-calc-f1-staging`. **Não presumir que arquivos locais foram enviados ao remoto.**
- Frontend `pitstop-calc`, PR #93, branch `feat/external-calc-f1-real-review-pilot-20261022`.
- Worker staging proposto `external-calc-f1-staging` e arquivo obrigatório `wrangler.external-calc-staging.jsonc`.
- Worker produtivo `flat-resonance-09ba`: **não acessar, alterar ou redeployar**.

## Evidências
- Supabase staging **real**: projeto `mfsshvckclnmftpaprxk` (conta conectada `PitswallV2`); migrações VS53I e VS53P `20261028013107` registradas. VS53P passou ensaio `ROLLBACK` e foi aplicada apenas no staging.
- RPCs instaladas e verificadas: `extcalc_register_original_source_v0`, `extcalc_resolve_manual_recovery_source_v0`, `extcalc_persist_review_candidate_v0`, `extcalc_persist_review_result_v0`. Seis tabelas públicas extcalc com RLS, zero linhas na última consulta. Anon sem EXECUTE nas duas RPCs de fonte, authenticated sem leitura direta da tabela privada. **Não equivale a autorização A/B comprovada.**
- GitHub CI anterior: `C01_MANUAL_MISSING_OFFER_RECOVERY_V0=PASS scenario_count=20` e `C01_MANUAL_RECOVERY_API_V0=PASS`. Falhas de precedência de códigos C01 foram corrigidas.
- Codex informou 14 scripts locais Node com exit 0, usando mocks/fixtures/estático; evidências locais `artifacts/f1-staging-20261028/local-tests.json`, `deployment-preflight.json`. Testes **não são HTTP nem PostgreSQL E2E**. Preflight estático de isolamento passou; preflight global exit 2 por falta de credenciais. `node --check` Worker e script de smoke passou, mas nenhum smoke foi executado.
- Nenhum deploy Cloudflare, URL de Worker, version ID ou bundle Wrangler comprovados. Plano Cloudflare e bindings remotos não inspecionados.
- GitHub Actions **não usar** (pedido do usuário por quota). Trigger automático F1 removido no commit `c22f127`.

## Bloqueio
Credenciais do GitHub **não migram automaticamente** ao ambiente Codex. Na sessão do Codex faltavam `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`, `SUPABASE_ANON_KEY` (valores exclusivos de staging), sessão Wrangler e binário/cache Wrangler. Usuário já afirmou cadastrá-las no GitHub, mas não no terminal. Não solicitar segredos no chat nem usar `service_role`.

## Retomada em ordem
1. Reabrir checkout no Codex/novo executor, conferir branch, `git status`, commit, alterações locais e os dois artefatos de teste. Preservar tudo.
2. Autenticar Cloudflare por ambiente seguro no terminal do executor (ou `npx wrangler@4.135.0 login` se interativo), verificar a identidade com `whoami`, conta e plano gratuito; bloquear se incertos.
3. Executar `node ferramentas/external-calc-runtime/v0/preflight-f1-staging.mjs` e `npx wrangler@4.135.0 deploy --dry-run --config wrangler.external-calc-staging.jsonc`. Nunca usar configuração padrão.
4. Configurar no Worker staging somente `SUPABASE_ANON_KEY` por stdin seguro com `wrangler secret put ... --config wrangler.external-calc-staging.jsonc`, sem logs de valor; então deploy isolado via `wrangler deploy --config wrangler.external-calc-staging.jsonc`. Registrar URL/version ID retornados (não inventar).
5. Definir `F1_STAGING_WORKER_URL` real e executar `node ferramentas/external-calc-runtime/v0/smoke-f1-staging.mjs`; exigir respostas API 204/401 corretas, não HTML 200.
6. Prova C01 E2E real com donos autenticados A/B de tenants diferentes e JWTs válidos: fonte imutável + hash + fornecedor, candidato REVIEW_REQUIRED/quoteable=false, persistência relida independentemente, idempotência, isolamento cruzado A→B/B→A, falhas sem escrita, revisão **humana** e auditoria com ator/tenant. Não automatizar ACCEPT, não confundir recibo `RECORDED_AWAITING_C01_AUTHORITY` com oferta cotável/C02–C05.
7. Atualizar PRs #200/#93 e as evidências; manter NO_GO até gate positivo. Não aplicar SQL já instalado novamente, não mexer em produção.

## Brain checkpoint
**Evidence:** migração VS53P comprovadamente instalada; RPCs presentes; testes locais reportados; E2E não executado.
**Decisions:** GitHub Actions fora do processo; deploy direto via Codex/terminal + Wrangler e staging isolado.
**Failures:** credenciais ausentes no executor; nenhum bundle ou deploy; correções de ordem de erros de recuperação C01.
**Cases:** modelo curto/longo; capacidade divergente; origem imutável; prova de tenants A/B ainda pendente.
**Patterns:** fixture/CI ≠ E2E; config isolada ≠ deploy isolado; segredos do GitHub ≠ segredos do Codex.
**Method hypotheses (não canonizar):** preflight de credenciais/ambiente antes do deploy; matriz A/B para novas RPCs SECURITY DEFINER.
**Brain sync:** registrar como handoff de projeto; não declarar escrita no `BRAIN_CONTROL_CENTER` ou alteração do cânone do Brain sem confirmação.

## Comando de retomada
> Continue External Calc F1 a partir deste HANDOFF. Não use GitHub Actions, não refaça os 14 testes locais sem motivo, não mexa em produção. Reabra checkout Codex e confira evidências; depois credenciais seguras, Wrangler staging dry-run, deploy isolado, smoke e E2E autenticado A/B. Mantenha `RELEASE_NO_GO` até prova.
