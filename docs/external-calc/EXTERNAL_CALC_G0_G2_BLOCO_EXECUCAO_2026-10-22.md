# External Calc — Bloco G0→G2 (22/10/2026)

## Escopo e limites
Executado sem GitHub Actions, sem merge e sem escrita em produção. Ambiente de prova: Supabase `external-calc-staging` `mfsshvckclnmftpaprxk` (PitswallV2, PG17). Não confundir esse projeto — com original-source e RLS 9/9 previamente comprovados — com uma réplica das tabelas comerciais C01.

## G0 — Baseline e ambiente
- PRs #178 (regras de origem), #179 (guarda DB) e #180 (quarentena) continuam **abertos, draft e encadeados**.
- Tentativa exclusivamente read-only de inspecionar C01 no Supabase produtivo `unjzpyexgtbcmjfgcqrx` foi recusada pelo conector (`You do not have permission to perform this action`). Não inferir novas contagens do incidente.
- Verificação direta de staging: `public.extcalc_review_candidate`, `public.extcalc_offer_revision`, `public.extcalc_source_supplier`, `public.extcalc_persist_auto_promoted_c01_v0` e ledger de quarentena **não existem** nesse projeto. Não é staging E2E fiel do C01.
- Evidência histórica do PR #178: 25 candidatos, 24 revisões VALID sem revisão humana no incidente da lista de WhatsApp; quatro ou mais erros de associação modelo/preço; 50 subrequests Cloudflare. Essas contagens **não foram revalidadas** em produção nesta execução.
- **G0 = PASS para inventário de riscos e plano de teste; BLOQUEADO para reconciliação integral produtiva / staging C01 fiel.**

## G1 — Autoridade da origem (PR #178)
- Inspeção de código identificou enforcement no intake: `supplierVerified===true`, proveniência `model/price`, `linkedPriceHasExactAmount`, bloqueio de `MODEL_CONTEXT_CROSSES_PRODUCT_HEADER`, tratamento de ambiguidade crítica, anomalia por preços irmãos e particionamento `auto`/`review`.
- Inspeção do intake confirmou paginação de até 12 ofertas por invocação para evitar 50 subrequests de Worker.
- Evidência apenas **estática/legada** nesta execução. Não foram executados o corpus privado 14 TXT/18 golden/62 linhas monetárias nem E2E C01 sob Auth real. Logo `G1 = IMPLEMENTED_CANDIDATE / OPERATIONAL_UNVERIFIED`; não aprovar promoção automática.

## G2 — Guarda no banco (PR #179)
- Código SQL lido diretamente de `ferramentas/external-calc-list-intake/v0/GATE1_DB_AUTO_PROMOTION_GUARD_DRAFT.sql` e asserts oficiais `prova_gate1_db_guard_pg_assert_v0.sql`.
- Prova executada via Supabase MCP `execute_sql` no PostgreSQL 17 do **staging isolado**, dentro de `BEGIN ... ROLLBACK`.
- Criadas dentro da transação, apenas para o ensaio, tabelas C01 mínimas de teste e helpers `privado.fn_tenant_atual`/`fn_papel_atual`, mantendo `auth.uid()` nativo Supabase. Foram aplicados o SQL candidato integral e o DO de asserts do PR (com `request.jwt.claim.sub` em lugar da variável fictícia `test.user_id`).
- Asserções cobrem: não autenticado, papel validador, fonte não vinculada, candidato ausente, preço divergente do snapshot, evidência de linha do modelo/preço ausente/incorreta, fornecedor divergente, tenant cruzado, promoção correta, retry idempotente, inexistência de gravações inválidas. `execute_sql` terminou sem exceção.
- Primeiro envio rejeitou sintaxe por falta do ponto-e-vírgula na concatenação de arquivos; foi corrigido na **montagem da prova**, sem modificar a proposta SQL versionada.
- Consulta direta posterior atestou todos os objetos criados para o ensaio **ausentes** (rollback OK). Nenhuma alteração persistente em staging.
- **G2 = ISOLATED_POSTGRES_GUARD_PASS; AUTH_REAL_C01_E2E_NOT_RUN.** Simular `request.jwt.claim.sub` em transação administrativa não equivale a uma sessão HTTP/JWT assinada.
- Limitação conhecida: snapshots equivalentes e linhas de evidência preenchidas ainda não constituem prova independente da veracidade da fonte comercial; G2 deve convergir com o storage original imutável VS5.3i e G1.

## Próxima decisão/execução
1. Planejar schema C01 em ambiente staging isolado, sem interferir nas fontes imutáveis do VS5.3i; revisar migrações, compatibilidade de RPC e contratos antes de qualquer DDL persistente.
2. Executar G1 com corpus privado adjudicado, sem publicar dados de fornecedores em Git.
3. Executar fluxo verdadeiro C01 com Auth A/B, promover apenas candidato cuja origem foi comprovada, bloquear todos os casos negativos, e executar rollback de ensaio.
4. Somente após isso avaliar G0/G1/G2 PASS integral. Produção: **NO-GO**; preservar PRs draft. Sem GitHub Actions.
