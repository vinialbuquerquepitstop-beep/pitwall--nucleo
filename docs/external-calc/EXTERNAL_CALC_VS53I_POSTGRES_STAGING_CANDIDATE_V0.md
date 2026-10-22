# External Calc — VS5.3i / Proposta executável de fonte PostgreSQL em staging

**Data:** 21/10/2026. **Classificação:** SQL CANDIDATE / UNAPPROVED / NOT A MIGRATION.
**PR base:** #198, que foi comprovado apenas com transporte HTTP simulado. Produção: NO-GO.

## Objetivo
Preparar uma proposta auditável de fonte **ORIGINAL_SUPPLIER_TEXT**, sem promover dados a C01, sem suplantar a revisão humana, sem criar storage real e sem alterar os gates anteriores.

Artefatos:
- ferramentas/external-calc-generalization/v0/VS53I_SOURCE_STORAGE_STAGING_CANDIDATE.sql — espécime SQL **não aplicado**.
- ferramentas/external-calc-generalization/v0/proof-vs53i.mjs — verificador estrutural estático com mutações negativas.
- docs/external-calc/EXTERNAL_CALC_VS53I_POSTGRES_STAGING_CANDIDATE_V0.md — este checkpoint.

**Nada** foi gravado em bancos Supabase. O SQL foi intencionalmente colocado fora de supabase/migrations, não é um plano aprovado e não deve ser colado em nenhum SQL Editor antes do gate humano.

## Topologia proposta para revisão
1. **privado.extcalc_original_source_v0**: linha fonte bruta tenant-scoped, ref opaca, origem ORIGINAL, filename, actor de captura, content_bytes BYTEA e SHA-256 GENERATED ALWAYS sobre os próprios bytes. A restrição inicial de 1 MiB é **proposta não aprovada**, sujeita a benchmark, UX e operação real.
2. **privado.extcalc_original_source_state_event_v0**: eventos append-only QUARANTINED/REVOKED separados do bruto. Sem mutação do conteúdo ao bloquear uma fonte. Um estado rejeitado não volta a AVAILABLE nesta proposta.
3. Trigger BEFORE UPDATE OR DELETE em ambas as tabelas, mais revogação de escrita para anon/authenticated. Isso não impede superuser/DDL, que dependem de governança, backup e privilégios segregados.
4. RLS habilitada e forçada em ambas as tabelas, leitura exclusivamente por authenticated + auth.uid() presente + tenant calculado em privado.fn_tenant_atual() + papel dono de privado.fn_papel_atual(). Essas funções são existentes no modelo, mas **sua execução efetiva em staging ainda precisa ser comprovada**.
5. **public.extcalc_original_source_probe_v0**: view com security_invoker=true e somente metadados esperados pela VS5.3h. Não expõe conteúdo nem filename. Role authenticated lê a view apenas se tiver permissões mínimas de schema/tabelas + cumprir a policy. As tabelas brutas estão em schema privado, que obrigatoriamente deve estar fora da lista de schemas Data API.

## Questões que NÃO estão aprovadas
- PostgreSQL versus Storage privado como tecnologia definitiva (VS5.3e ainda é proposta).
- Convenção de gravação: somente ingestão servidor/autorizada com tenant, ator, hash e ref derivados de identidade real; nenhuma API de inserção foi construída.
- A existência/disponibilidade de pgcrypto extensions.digest(bytea,text) no staging, schema privado não exposto e grants necessários.
- Retenção, exclusão legal, restauração a partir de quarentena, limites de bytes, observabilidade e revogação real.
- Como o resolver VS5.3f consumirá bytes e estado efetivo na mesma leitura server-side sob JWT validado e sem service_role/RLS bypass.
- Grant SELECT aos usuários authenticated nas tabelas privadas é aceitável apenas se schema privado não for exposto pela Data API e políticas reais forem provadas. Acesso raw indevido é bloqueio de gate.

## Prova técnica exigida antes de aprovação
1. **Escolha e autorização explícita** de projeto staging isolado, identificando ref, organização e conta, sem apontar para produção unjzpyexgtbcmjfgcqrx nem para outro produto.
2. Revisar o SQL contra schema real: confirmar tenant/id/funções, pgcrypto, PostgreSQL >=15, owner, GRANT, FORCE RLS, tipos, triggers, view security_invoker e exposição da Data API; obter revisão de segurança.
3. Executar migration e seed **apenas após autorização de DDL** e plano de reversão em staging; criar dois atores e tenants sintéticos, uma fonte por tenant. Admin seed não conta como prova de RLS.
4. Executar VS5.3g com VS5.3h em GET real: OWN 2/2 FOUND; cross 2/2 deny; anon 2/2 deny; absent 2/2 deny. Conferir 8/8, sem dados brutos na view. Isso sozinho ainda não dá PASS de RLS: comparar metadata instalada e permissões.
5. Verificar raw bytes SHA 256, UTF-8 exato, timeout, tamanho, concorrência, duplicação e rollback; impedir overwrite real, inclusive UPDATE e DELETE em transação autorizada de staging.
6. Validar que não há escrita em C01 nem promoção silenciosa e que o incidente de 20/10 e #178–#180 continuam independentes do produto.

## Evidência atual
Provas prévias: VS5.3d 8/8 stub; VS5.3f 12/12 stub; VS5.3g 12/12 simulado; VS5.3h 15/15 HTTP mock; VS5.3i é **apenas revisão estrutural estática**. Não há PostgreSQL local instalado no runner da sessão e nenhum staging autorizado foi identificado. Listagem de branches Supabase do projeto produtivo foi negada por permissão; não se tratou isso como confirmação de ambiente.

**CI verificado:** PR #199 (DRAFT), commit fb18892ca0b8bc3d5e188aa3725e908e8e22fd4a. GitHub Actions generalization run 39685560505 / job 119518600686: SQL candidate static 6/6 PASS, ownership 30 paths deny=4; demais cinco workflows PASS (seis no total). Prova restrita à estrutura textual do SQL, não à execução de DDL, não à sintaxe efetiva do PostgreSQL, não a JWT/RLS real.

**Estados:** VS53I_SQL_DRAFT=CI_PASS_STATIC_ONLY; REAL_STORAGE=NOT_IMPLEMENTED; REAL_RLS=NOT_RUN; C01_RELEASE=NO_GO.

O próximo passo depois da aprovação **não é nova simulação**: é executar SQL e JWT A/B contra o staging explícito, registrando uma prova externa verificável.

## Checkpoint de homologação — preflight real de 22/10/2026

**Ambiente confirmado:** Supabase PitswallV2 / external-calc-staging / projeto `mfsshvckclnmftpaprxk` / região `ca-central-1`. Project API informou ACTIVE_HEALTHY, PostgreSQL 17.11. Consultas read-only: `public` e `privado` sem tabelas; schema `privado` ausente; `public.tenant` ausente; `privado.fn_tenant_atual` e `privado.fn_papel_atual` ausentes. `pgcrypto` instalado no schema `extensions`; `auth.uid()` e `auth.jwt()` disponíveis; `authenticated` e `anon` sem BYPASSRLS; `service_role` e `postgres` com BYPASSRLS. Security Advisor não retornou lints na leitura inicial. A ausência de alertas em banco vazio **não** valida uma futura política.

**Correção da proposta VS5.3i, sem mudar os contratos produtivos:** a SQL candidata agora cria `privado`, `privado.extcalc_staging_tenant_v0` e `privado.extcalc_staging_membership_v0` como *fixtures de autoridade sintéticas apenas para staging*. Um usuário do Supabase Auth fica vinculado a um tenant sintético e papel `dono` por linha inserida posteriormente por seed administrativa autorizada (nunca claims `user_metadata` nem campo de tenant enviado pelo cliente). RLS da fonte e eventos consulta essa membership sob `auth.uid()`, com comparação explícita e correlacionada de tenant e `active=true`. Isso substitui apenas para a prova os helpers produtivos que não existem neste ambiente; **não é migração da arquitetura do produto**.

**Isolamento:** tabelas originais e membership continuam em `privado`, com FORCE RLS e sem grants de UPDATE/DELETE/INSERT para `authenticated`; a view `public.extcalc_original_source_probe_v0` expõe somente metadados e tem `security_invoker=true`. A prova real precisará confirmar por metadados e pela configuração do Supabase que o schema `privado` não integra a Data API exposta; `grant usage` não equivale à exposição segura. Usuários A/B e fonte A/B continuam **não criados**, sem seed ou JWT reais.

**Alertas ainda não resolvidos:** acesso do role `authenticated` às linhas de origem via consulta SQL direta sob RLS deve ser explicitamente aceito no gate (a view security_invoker exige grants subjacentes); extensão `extensions.digest` no contexto do campo GENERATED deve ser provada em execução; tamanho máximo de 1 MiB, retenção, exclusão legal e semântica de revogação continuam PROPOSAL. Não há provas reais de UPDATE/DELETE negados, nem escrita append-only. O SQL está **fora de supabase/migrations** e não foi aplicado.

**Próxima autorização separada (gate humano):** revisar esta SQL candidata ajustada e autorizar **DDL + seed sintético somente no projeto mfsshvckclnmftpaprxk**. Não inclui merge, deploy, integração com runtime real, migração produtiva ou importação de dados de fornecedores. Após essa decisão, primeiro validar SQL/rollback e permissões reais, depois prover identidades de teste A/B e executar matriz VS5.3g/VS5.3h. Produção NO-GO devido ao incidente 20/10 e PRs #178–#180.

**Evidência de CI:** PR #199 DRAFT, commit bdcaeeb1e256cd210b5b4e2b1e0bf2e8e5f95f7c, GitHub Actions Generalization run 39730587091 / job 119664464093: VS5.3i STATIC PASS (15 verificações; inclui negativas de tenant-tautology e membership sem auth.uid) e ownership PASS. Seis workflows de GitHub Actions terminaram SUCCESS no mesmo commit. **Não** houve execução SQL/DDL nem prova JWT/RLS real.

**Estado:** `STAGING_READONLY_PREFLIGHT=PASS_WITH_SCHEMA_GAPS`; `STAGING_SQL_REVISED=CI_PASS_STATIC_ONLY`; `REAL_DDL=NOT_RUN`; `REAL_JWT_RLS=NOT_RUN`; `PRODUCTION=NO_GO`.


## Execução controlada no staging — 22/10/2026 (substitui estados anteriores apenas para este ambiente)

**Projeto EXCLUSIVO:** Supabase organização PitswallV2, `external-calc-staging`, ref `mfsshvckclnmftpaprxk`. Usuário autorizou aplicar o SQL revisado e utilizar dados fictícios nesta conversa. PR #199 continua DRAFT; **não houve merge, deploy nem alteração de produção**.

**Migração real:** ação Supabase apply_migration retornou `success=true`, nome `external_calc_vs53i_staging_only_source_v0`. A estrutura foi inspecionada diretamente no catálogo PostgreSQL: tabelas `privado.extcalc_staging_tenant_v0`, `privado.extcalc_staging_membership_v0`, `privado.extcalc_original_source_v0` e `privado.extcalc_original_source_state_event_v0`. RLS e FORCE RLS presentes nas quatro tabelas. Policies de leitura efetivas nos objetos originais e membership, ligadas a `auth.uid()`, correlação de tenant, `active=true` e papel `dono`. View `public.extcalc_original_source_probe_v0` com `security_invoker=true`; triggers de anti-update/delete presentes. `authenticated` sem INSERT nas tabelas brutas; `anon` sem SELECT na view.

**Duas fontes fictícias inseridas no PostgreSQL:** `tenant-A` UUID `11111111-1111-4111-8111-111111111111`, source `original-A`; `tenant-B` UUID `22222222-2222-4222-8222-222222222222`, source `original-B`. Conteúdo exclusivamente sintético, cada fonte com 26 bytes. `content_sha256` calculado no banco foi comparado a SHA-256 recalculado dos bytes: **2/2 PASS**.

**Imutabilidade real:** transações e tratamento de SQLSTATE `42501` validaram rejeição de UPDATE/DELETE da fonte original e UPDATE/DELETE do evento; **4/4 bloqueados**. Um evento `QUARANTINED` sintético foi acrescentado a `original-A`. Estado verificado: dois tenants, duas fontes, um evento; view administrativamente consultada exibe **1 QUARANTINED + 1 AVAILABLE**.

**Isolamento negativo parcial:** com role PostgreSQL `authenticated` e `request.jwt.claim.sub` aleatório *não cadastrado*, consulta à view retornou zero linhas; sessão finalizada em ROLLBACK. `anon` não recebeu SELECT na view. Este é um teste de negação sem identidade própria, **não prova JWT real, servidor Auth, nem isolamento A_OWN/B_OWN**. `auth.users` contém **0 contas** no staging; membership Auth A/B ainda não foi criada, sem tentativa de escrever diretamente em `auth.users`. O harness VS5.3g exige A e B realmente autenticados via Supabase, cada um lendo sua própria fonte, e isso permanece PENDENTE.

**Supabase Security Advisor:** após DDL retornou apenas o aviso informativo `rls_enabled_no_policy` para `privado.extcalc_staging_tenant_v0`. É deliberado: tabela administrativa sem grants de SELECT para `anon` e `authenticated` e com RLS/FORCE; o risco precisa ser revisado, não convertido automaticamente em abertura de policy. A configuração do schema privado na Data API, revogação/rotatividade de tokens, políticas reais via API e comportamento cross-tenant autenticado ainda precisam de validação.

**Gate após execução:** `STAGING_DDL=APPLIED`; `STAGING_BYTES_SHA=PASS_2_OF_2`; `STAGING_IMMUTABILITY=PASS_4_OF_4`; `STAGING_QUARANTINE=PASS`; `STAGING_ANON_GRANT=DENIED`; `STAGING_AUTH_NO_USER_DENY=PASS_PARTIAL`; `STAGING_REAL_JWT_AB=NOT_RUN`; `STAGING_RELEASE=NO_GO`; `PRODUCTION=NO_GO`.

**Próximo passo factual:** criar **duas contas de teste via Supabase Auth API/Admin**, nunca inserindo diretamente em `auth.users`; associar os IDs de Auth a tenants distintos via seed administrativa controlada; executar o transporte GET VS5.3h com JWT assinados A/B na mesma instância e inspecionar respostas cruzadas, anônimas, ausentes, assinatura real e configuração Data API. Registrar matriz completa e concluir security review antes de mudança de release gate.


## VS5.3i — privilege hardening de staging, 22/10/2026

**Ambiente único:** PitswallV2 `mfsshvckclnmftpaprxk`, EXCLUSIVAMENTE staging. Após conferir o ambiente, foi aplicada a migração Supabase `external_calc_vs53i_staging_column_privileges_v0` com sucesso. Corrige um excesso de privilégio: `authenticated` tinha SELECT integral na tabela privada dos bytes brutos. Foi substituído por GRANT SELECT de colunas estritamente necessárias ao read-only view (tenant_id, source_ref, source_contract_version, source_type, immutability, content_sha256). A tabela privada de eventos permite apenas tenant_id, source_ref, event_type. Uma transação prévia `ROLLBACK` validou que a view com authenticated sem usuário continua zero linhas; não confundir com A/B real.

**Prova em pg_catalog/has_column_privilege após migração:** `authenticated` em `content_bytes` = FALSE; `content_sha256` = TRUE; `tenant_id` = TRUE; em `reason_ref` de eventos = FALSE; SELECT na view pública = TRUE. A coluna `filename` também não é concedida como fonte da view. O schema privado não deve integrar Data API.

**Escopo de prova:** permissão efetiva foi inspecionada no PostgreSQL real. Supabase Auth continua sem usuários; ainda NÃO foram emitidos JWTs reais A/B nem provados OWN/CROSS sob endpoints externos. Nenhuma conta foi criada diretamente em `auth.users`; este conector não tem operação Admin Auth de criação e a rede de execução não alcançou o host externo. A parte de identidade real permanece NO-GO. A migração original e os dados fictícios permanecem no staging; não houve merge/deploy/produção.

**Estado:** `STAGING_COLUMN_PRIVILEGE_HARDENING=APPLIED_PROVEN`; `AUTH_AB_ACCOUNTS=NOT_CREATED`; `REAL_SIGNED_JWT_AB_RLS=NOT_RUN`; `PRODUCTION=NO_GO`.

## VS5.3j — checkpoint Auth A/B (22/10/2026)

**Destino:** PitswallV2/external-calc-staging, projeto mfsshvckclnmftpaprxk. O conector Supabase disponível não possui ação de criação de usuários Auth; teste de conexão HTTP externa não resolveu o hostname. Nenhuma conta foi inserida diretamente em auth.users e nenhum JWT foi inventado. Consulta real confirma zero usuários Auth e zero memberships. Assim, JWT A/B REAL = NOT_RUN.

**Fixture de OWN corrigida:** original-A está QUARANTINED, portanto não poderia provar o resultado esperado AVAILABLE. Foi adicionada fonte sintética original-A-rls ao tenant A (11111111-1111-4111-8111-111111111111), com 32 bytes sintéticos e SHA-256: 23ba58d194284cc6fec90615b1ba08805e28d2b53a5c5a2416313c998338f0a0. A fonte original-B permanece AVAILABLE no tenant B (22222222-2222-4222-8222-222222222222), sem reescrita; original-A permanece em quarentena. Usar source_a=original-A-rls, source_b=original-B e absent_ref independente na futura prova JWT.

**Pendência de execução real:** criar duas contas sintéticas pelo Supabase Auth oficial, confirmar seus IDs, fazer seed administrativo de membership A/B e obter JWT assinados pela API oficial sem registrar tokens/senhas em GitHub. Executar matriz VS5.3g/h com dois usuários autenticados e casos cruzados, anônimos e ausentes. Não usar service_role na prova de leitura. Verificar também exposição do schema privado na Data API. Status: STAGING_SOURCE_FIXTURES=PASS; AUTH_AB_USERS=0; REAL_JWT_AB=NOT_RUN; PRODUCTION=NO_GO.

## VS5.3j — duas identidades reais vinculadas; RLS SQL sob role autenticada (22/10/2026)

**Ambiente:** PitswallV2 external-calc-staging, ref mfsshvckclnmftpaprxk. Screenshot de Authentication/Users fornecido pelo operador; consulta administrativa read-only em auth.users confirmou dois UUIDs de Auth reais, e-mails confirmados, não anônimos, sem banimento ou exclusão.

**Seed controlado de membership:** A (UID e457a263-1b4f-43bc-8833-3cbd7dc974ac) foi vinculado ao tenant A (11111111-1111-4111-8111-111111111111). B (UID f275c35d-a5f8-4907-9abe-aa9dc8f54f13) ao tenant B (22222222-2222-4222-8222-222222222222). Ambas as memberships são `dono`, `active=true`. SQL INSERT ... ON CONFLICT DO NOTHING retornou duas linhas; contagem final de memberships = 2.

**Prova no PostgreSQL real, não via HTTP/JWT:** Usando transações BEGIN; SET LOCAL ROLE authenticated; set_config('request.jwt.claim.sub', UID, true); consultas pela view security_invoker, com ROLLBACK. Para A: original-A-rls AVAILABLE visível; original-B não visível; missing-source não visível. Para B: original-B AVAILABLE visível; original-A-rls não visível; missing-source não visível. Duas execuções DO PL/pgSQL declararam contadores e lançariam EXCEPTION se OWN != 1, FOREIGN != 0 ou ABSENT != 0; ambas foram bem-sucedidas. Provas visuais SQL anteriormente retornaram as linhas somente dos respectivos tenants. `anon` não possui SELECT da view; role `authenticated` não tem SELECT na coluna content_bytes, conferido via has_column_privilege.

**LIMITAÇÃO DA PROVA:** SET LOCAL ROLE e set_config injetam contexto de identidade administrativamente no banco. Isto testa a execução física de RLS e a semântica de tenant, mas NÃO verifica assinatura/autenticidade de JWT, propagação da API Auth/PostgREST, URL/API settings do schema, expiração nem proteção contra spoofing do lado da aplicação. Não classificar como JWT_AB_PASS. Ausência de senha/JWT nos logs é intencional. A fonte original-A permanece QUARANTINED e só original-A-rls foi usada como OWN AVAILABLE.

**Estado:** STAGING_REAL_AUTH_USERS=2; STAGING_MEMBERSHIPS=2; STAGING_SQL_ROLE_RLS_AB=PASS; STAGING_HTTP_SIGNED_JWT_RLS_AB=NOT_RUN; STAGING_RAW_BYTES_AUTH_SELECT=DENIED; RELEASE_PRODUCTION=NO_GO. Próximo gate: executar HTTP GET com JWTs REALMENTE emitidos pelo Supabase Auth em operador seguro e completar matriz VS5.3g/h, sem armazenar JWT em chat/PR ou usar service_role para leitura.

## VS5.3k — navegador do operador para HTTP/JWT A/B (22/10/2026)

**Gap que esta frente resolve:** todas as provas físicas SQL A/B de VS5.3j ocorreram com `SET LOCAL ROLE authenticated` + `set_config('request.jwt.claim.sub', ...)`. Isso NÃO autentica a assinatura de um JWT Supabase nem prova o caminho Auth -> PostgREST -> RLS. O conector Supabase desta sessão não oferece a operação Admin Auth para login desses usuários; a verificação de DNS no executor local não conseguiu alcançar o domínio `mfsshvckclnmftpaprxk.supabase.co`. Não são fornecidas senhas nem tokens nesta sessão.

**Artefato entregue na conversa:** `EXTERNAL_CALC_VS53K_TESTE_JWT_A_B_STAGING.html`, página local independente (arquivo binário da conversa; *não está versionado neste PR*). A página tem endereço HTTPS de staging e publishable key pública fixos, CSP `connect-src` restrito ao staging, sem bibliotecas externas, telemetria, cookies ou persistência. O operador digita credenciais do Auth localmente; o navegador chama `/auth/v1/token?grant_type=password`, valida A/B pelos UUIDs esperados em `/auth/v1/user` (servidor Auth), e faz GET sobre `/rest/v1/extcalc_original_source_probe_v0` com JWTs individuais. Não usa `service_role` e não expõe conteúdo bruto. Credenciais/JWTs nunca integram os relatórios. O arquivo pode ser auditado localmente antes de usado.

**Matriz HTTP:** oito cenários VS5.3g `A_OWN`, `B_OWN`, `A_FOREIGN`, `B_FOREIGN`, `ANON_A`, `ANON_B`, `A_ABSENT`, `B_ABSENT`; mais `A_QUARANTINED` para garantir que `original-A` retorne `QUARANTINED` e a fonte `original-A-rls` siga como OWN/AVAILABLE. A/B são usuários já vinculados no staging e possuem e-mails pessoais; não presumir que são identidades exclusivamente de teste. Para longevidade, substituir por contas de QA sem acesso comercial.

**Prova técnica executada no artefato HTML:** JavaScript `node --check` PASS. No Chromium com rotas HTTP interceptadas no próprio runner de teste: resposta nominal = 9/9 PASS; UID inesperado em `/auth/v1/user` = `FAIL_CLOSED`; fonte B erroneamente visível para A = 8/9 e `FAIL_CLOSED`. Os testes usaram credenciais e JWTs *FICTÍCIOS*, não alcançaram Supabase, não provam RLS real. O mock não grava senhas ou tokens no relatório. Falha de API, CORS, Auth, JSON malformado ou UID inesperado não deve virar PASS.

**Gate verdadeiro pendente:** operador abre o HTML local em seu navegador, autentica ambas as contas Auth de staging com credenciais que não compartilha no chat, clica para executar, e entrega apenas o JSON sem credenciais gerado pela ferramenta. Os resultados devem passar por conferência humana/auditoria das policies, do projeto destino, da autenticação e do isolamento real. O arquivo HTML de staging não é parte do produto; não publicar como página operacional nem com senha inserida. Não há autorização de produção, merge ou deploy.

**Estado:** `STAGING_SQL_ROLE_RLS_AB=PASS`; `VS53K_BROWSER_MOCK_POSITIVE=PASS_9_OF_9`; `VS53K_BROWSER_MOCK_NEGATIVE_UID=FAIL_CLOSED`; `VS53K_BROWSER_MOCK_NEGATIVE_TENANT=FAIL_CLOSED`; `STAGING_REAL_HTTP_SIGNED_JWT_RLS_AB=NOT_RUN`; `PRODUCTION=NO_GO`.
