# External Calc — VS5.3L / C01 funcional no staging (proposta auditável)

**Data:** 22/10/2026  
**Ambiente exclusivo:** Supabase `PitswallV2 / external-calc-staging`, ref `mfsshvckclnmftpaprxk`.  
**Sem GitHub Actions. Sem produção. Sem importação de fornecedores reais.**

## Estado medido

O acesso read-only ao Supabase foi restabelecido nesta sessão. `list_tables` devolveu somente as quatro tabelas VS5.3i do schema `privado`, dois tenants, dois usuários Auth e três fontes originais previamente criadas. Nenhuma tabela C01 foi confirmada.

Uma tentativa anterior de implantar o grafo C01 foi bloqueada pelas configurações de segurança da conexão. A implementação persistente não foi executada nem anunciada como PASS. Não foi utilizada outra conexão para contornar o bloqueio.

## Artefatos deste pacote

1. `VS53L_C01_STAGING_FOUNDATION_CANDIDATE.sql`: tabelas C01 de homologação, RLS/FORCE, grants mínimos, identidade tenant derivada de Auth e membership, ligação de fornecedor à fonte imutável e RPC de candidato validando conteúdo original. Inclui trigger de imutabilidade e bloqueio de promoção quando a origem está quarentenada/revogada. **Ainda não aplicado.**
2. **Dependência externa obrigatória, a ser revisada no mesmo branch:** o arquivo original do PR #179 `ferramentas/external-calc-list-intake/v0/GATE1_DB_AUTO_PROMOTION_GUARD_DRAFT.sql`. O presente pacote não duplica a guarda de promoção. Não aplicar a proposta do PR #179 na produção sem gate separado.
3. `VS53L_C01_STAGING_PROOF_ROLLBACK.sql`: teste sintético com `BEGIN/ROLLBACK`, fornecedor A/B, fontes imutáveis A/B, RPCs, idempotência, falhas de evidência e isolamento; assume **fases 1 e 2 aplicadas**. Manipula apenas dados fictícios e usa UID dos Auth recuperado no próprio staging (nenhum UID pessoal hardcoded no arquivo). Seu SET ROLE e claims de teste **não substituem JWT HTTP assinado**.
4. `proof-vs53l-static.mjs`: prova estática com mutações negativas, executada localmente em Node 22. **PASS estático**, não é PostgreSQL real.

## Sequência de execução controlada, quando houver autorização da ferramenta

1. Conferir o ref do projeto e catálogos `public`, `privado`, migrações, Security Advisors, grants e Auth users antes de aplicar. Nunca executar se as tabelas C01 já estiverem presentes ou se o projeto não for o staging autorizado.
2. Revisar a SQL; executar em transação exclusivamente no staging, auditar catálogo e políticas, depois registrar migração controlada. O arquivo contém `BEGIN ... COMMIT`, portanto não o concatenar a uma transação externa sem inspeção das fronteiras transacionais.
3. Aplicar **somente no staging** a guarda **exata do PR #179**, após revisão de `SECURITY DEFINER`, assinatura, cliente e ciclo de vida. É a fase 2. Confirmar ausência de grants `PUBLIC/anon` e autorização de `authenticated` por Auth membership.
4. Rodar `VS53L_C01_STAGING_PROOF_ROLLBACK.sql` em uma transação, conferir os NOTICEs e confirmar contagem de linhas idêntica após ROLLBACK. Se falhar, NÃO seguir. Os testes A/B por role/claims não são prova de assinatura JWT real.
5. A/B HTTP real: estender verificador V3 com operações C01 sintéticas e JWT reais de conta de QA. Não usar senhas pessoais, tokens ou service_role em logs, repo ou chat.
6. Só com as duas vias (Postgres e Auth/PostgREST) aprovadas, marcar `STAGING_C01_FUNCTIONAL=PASS`. C01 em produção continuará `NO_GO` até resolver PRs #178–#180, incidente de 24 revisões e E2E móvel/desktop.

## Riscos explicitamente abertos

- O gate de staging não é um espelho completo do C01 de produção e não demonstra compatibilidade de migração produtiva.
- Proposta de persistência de candidato é intencionalmente conservadora: origem deve trazer preço com prefixo `R$` e modelo/preço na mesma linha ou em linhas adjacentes. Casos mais complexos caem em revisão, não em promoção automática.
- Candidato em JSON ainda exige avaliação geral do Interpreter, variantes/cor e corpus privado 14 TXT/18 golden/62 linhas. A linha original cotejada evita falsificação de `source_lines`, mas não prova extração semântica universal.
- O SQL foi verificado estaticamente, **não compilado no PostgreSQL remoto** nesta sessão. Um revisor de banco deve validar sintaxe/roles e aprovação antes de aplicar.
- O PR #179 guard ainda permite acesso a uma fonte que ficou quarentenada após o candidato. Este pacote propõe trigger adicional no INSERT da revisão para bloquear o cenário; precisa teste real.

**Gate ao término desta sessão:** `VS53L_SQL_CANDIDATE=PREPARED`, `VS53L_STATIC_PROOF=PASS`, `VS53L_STAGING_SCHEMA_APPLIED=NOT_VERIFIED_NOT_APPLIED`, `VS53L_REAL_C01_E2E=NOT_RUN`, `PRODUCTION=NO_GO`.

## Repositório e pacote

Branch isolada: `proposal/external-calc-c01-staging-vs53l-20261022`, baseada no head PR #179 `567810fa2e22c0529eb1f39844889e1c2de9b59a`, **sem PR aberto e sem execução/reliance de GitHub Actions**. SQL e provas disponíveis no artefato de conversa `EXTERNAL_CALC_VS53L_C01_STAGING_CANDIDATE.zip` (SHA-256 `ee0fa736b0f3b411d38a7b2cc3672ba57c6d1583032e61cbe31ea6f21acb9bc6`). Os artefatos SQL e prova agora foram materializados nos caminhos da branch; este README sozinho não autoriza aplicação.


## Materialização dos artefatos na branch (checkpoint final 22/10/2026)

Os três artefatos foram efetivamente adicionados à própria branch, em `ferramentas/external-calc-list-intake/v0/vs53l/`: `VS53L_C01_STAGING_FOUNDATION_CANDIDATE.sql`, `VS53L_C01_STAGING_PROOF_ROLLBACK.sql` e `proof-vs53l-static.mjs`. Eles não são migrações produtivas. A versão atual reforça a associação **modelo + capacidade** (impede que 'iPhone 17' seja confundido com 'iPhone 17 Pro') e exige **uma única linha por campo material** em staging. Prova negativa de modelo-prefixo registrada; testes de fornecedor/quarentena, preço, origem, candidato prévio, idempotência e outro tenant continuam no ensaio com ROLLBACK.

**Validação realizada sem Actions:** `node proof-vs53l-static.mjs` diretamente neste executor = PASS; testes PostgreSQL do pacote não foram executados após o bloqueio de escrita do conector. A consulta read-only `list_tables` foi restabelecida e mostrou somente as quatro tabelas da camada VS5.3i. **Não houve aplicação de esquema C01, nova migração ou seed no Supabase nesta etapa.** A versão ZIP do pacote de conversa é `EXTERNAL_CALC_VS53L_C01_STAGING_CANDIDATE_V2.zip` (SHA-256 `55cffa8379cd87544713e5e3fc17ffbfda240f6cc41af3b06dff1eb03f47c5fd`).

**Fases pendentes:** revisar e aplicar exclusivamente no staging esta fundação via caminho autorizado; aplicar a guarda exata de promoção do PR #179 com revisão de SECURITY DEFINER; executar prova reversível SQL; testar Auth/PostgREST verdadeiro A/B. Sem isso `STAGING_C01_FUNCTIONAL=NOT_PROVEN` e `PRODUCTION=NO_GO`. GitHub Actions excluído do método e nenhum PR aberto para a branch.


## Checkpoint de execução direta — 22/10/2026, VS53L hardening

**Escopo confirmado:** `mfsshvckclnmftpaprxk` (PitswallV2). Conexão Supabase read-only e migrações conferidas diretamente via MCP, **sem GitHub Actions**. `list_tables` retorna só as 4 tabelas privadas VS5.3i (tenants=2, memberships=2, sources=3, events=1). Histórico possui somente `20261022060654 external_calc_vs53i_staging_only_source_v0` e `20261022061751 external_calc_vs53i_staging_column_privileges_v0`. **Não existe implantação C01 persistente**; não inventar migration nem PASS de endpoint.

**Revisão de risco fechada em código, ainda não no banco:** o candidato anteriormente aceitava uma `model.id` arbitrária mesmo quando a `model.label` encontrada no texto original era correta; também podia aceitar capacidade ausente em condição SQL com `NULL`. A fundação de staging agora exige capacidade explícita positiva e, para a fixture conservadora, um slug determinístico derivado da label. Rejeita `C01_STAGING_MODEL_IDENTITY_UNVERIFIED` e `C01_STAGING_OFFER_INVALID`. Esta heurística de slug **não é regra de produto**, não substitui o catálogo canônico nem altera Interpreter Core/C01–C05; qualquer modelo real cujo ID não seja equivalente ao slug deve ficar sob revisão até o catálogo ser reconciliado. A prova de rollback adicionou `NEGATIVE_MODEL_ID_SPOOF_NOT_BLOCKED` e `NEGATIVE_MISSING_CAPACITY_NOT_BLOCKED`.

**Prova realizada:** `node --check proof-vs53l-static.mjs` e `node proof-vs53l-static.mjs` executados localmente: `VS53L_STATIC=PASS`, com mutações negativas que rejeitam a supressão do controle de identidade e do rollback. Isto é prova **estática, não SQL/Postgres**. Nenhum DDL foi aplicado: a chamada SQL de escrita anterior recebeu bloqueio de segurança da conexão. Não contornar via outra ferramenta, usuário, rede, ou GitHub Actions.

**Security Advisor staging:** `rls_enabled_no_policy` INFO em tabela privada de tenants, coerente com falta deliberada de privilégios externos; `auth_leaked_password_protection` WARN por proteção contra senhas comprometidas desligada. Decidir configuração de Auth antes de promover staging a referência de hardening, sem afetar contas reais ou produção.

**Requisito para continuar gate de implantação:** acesso de escrita explicitamente permitido para execução controlada no projeto específico e revisão de schema SQL com Postgres real. Só então aplicar a fundação fase 1, SQL **exato** da guarda #179 fase 2, executar prova rollback, auditar RLS/grants/advisors e por fim HTTP Auth A/B. Não misturar essa prova com VS5.3k, que foi de fonte original read-only. `STAGING_C01_FUNCTIONAL=BLOCKED_NOT_APPLIED`; `PRODUCTION=NO_GO`.


## VS53L V4 — hardening de proveniência e implantação atômica (22/10/2026)

**Estado sem superestimar:** `STAGING_C01_FUNCTIONAL=NOT_APPLIED`; nenhum PostgreSQL de C01 implantado, sem prova real JWT C01; produção `NO_GO`. A execução nesta rodada ficou em revisão, código e testes estáticos locais **sem GitHub Actions**.

**Falhas descobertas e corrigidas na proposta:**
1. A RPC de `review_candidate` conferia modelo e preço, mas não a **cor**. Agora exige `interpreted_offer.color` explícita, `field_sources.color` com exatamente uma linha rastreada à mesma linha do preço, token de cor com limites de palavra no texto imutável e recusa linhas com separadores de opções ambíguas. Razões `C01_STAGING_COLOR_MISSING`, `C01_STAGING_COLOR_PROVENANCE_UNVERIFIED`, `C01_STAGING_COLOR_SCOPE_AMBIGUOUS`, `C01_STAGING_COLOR_UNVERIFIED`. Critério conservador restrito a staging, não resolver universal de variantes.
2. Condição antiga `(capacity_gb) !~ REGEX` falhava em rejeitar capacidade `NULL` por semântica SQL de três valores. Substituída por `coalesce((capacity_gb ~ REGEX),false) is false`, bloqueando ausência.
3. Teste negativo `iPhone 17` vs `iPhone 17 Pro` agora corrige em conjunto label e ID no estímulo, para verificar a regra de modelo de origem — não terminar prematuramente no bloqueio da identidade.
4. Prova de rollback inclui dois cenários inéditos: cor forjada e `field_sources.color` ausente; fixture positiva inclui linha explícita de cor. A suíte local `proof-vs53l-static.mjs` executada com Node 22 retornou `VS53L_STATIC=PASS`, com seis mutações negativas e verificação de montagem atômica. **Não equivale à execução da RPC em Postgres.**

**Preflight privilegiado (read-only contra Supabase verdadeiro):** `current_user=postgres`; `pg_roles.postgres.rolbypassrls=true`, `authenticator.rolbypassrls=false`. Assim a execução sob `SECURITY DEFINER` com proprietário postgres é compatível com `FORCE RLS` sem abrir INSERT de tabelas para authenticated. Conferido diretamente no staging; autorização comercial real ainda não foi executada.

**Fase 2 segura:** criado `ferramentas/external-calc-list-intake/v0/vs53l/assemble-vs53l-phase2-atomic.mjs`. Lê exclusivamente `../GATE1_DB_AUTO_PROMOTION_GUARD_DRAFT.sql` do PR #179 e verifica hash Git blob `bddff79482488ef548ccb2c5c7b43491c57ec805`; se mudar, falha fechada. Emite **uma transação** `BEGIN → pré-condições do staging/postgres → guarda exata → REVOKE PUBLIC/anon → GRANT authenticated → valida grants → COMMIT`. Evita que a função SECURITY DEFINER passe a ficar publicamente executável entre dois commits. Para preparar o SQL em checkout autorizado: `node ferramentas/external-calc-list-intake/v0/vs53l/assemble-vs53l-phase2-atomic.mjs --check` e depois `node .../assemble-vs53l-phase2-atomic.mjs --emit > VS53L_PHASE2_ATOMIC.sql`. Não executar no Supabase até DDL compilado, autorização de escrita permitida e gate de implantação revisado.

**Inventário persistente até última consulta:** `list_tables` de staging revelou somente as quatro tabelas VS5.3i de fontes originais, nenhuma tabela C01. Security Advisor mantém `auth_leaked_password_protection=WARN` no staging e info de RLS sem policy na tabela privada de tenants. Não alterar Auth nem schema produtivo sem outro gate.

**Próxima prova bloqueadora:** validar a montagem da fase 2 contra a guarda pinada em um checkout, compilar SQL fase 1/2 no PostgreSQL 17 autorizado, executar prova transacional de fontes sintéticas, comparar resultados e rollback, e validar HTTP com as sessões QA A/B. Até isso, o staging não está funcional para C01.


### Correção de integridade do artefato SQL (VS53L V4.1)

Na revisão cruzada entre a cópia local e a branch, detectou-se **duplicação e truncamento** da expressão de capacidade no arquivo SQL remoto. Causa identificada: substituição JavaScript com string de reposição contendo `$'` (token interpretado como sufixo do texto original), durante edição automatizada. Esse arquivo não foi aplicado ao banco. Restaurou-se a versão íntegra do commit `3a3f7d2e` e reaplicou-se a proteção `NULL` por `String.replace(needle, () => replacement)`, sem expansão especial, no commit `28ff357d`.

Validação posterior pela API do GitHub: fundação possui **20.486 caracteres, exatamente 6 `CREATE FUNCTION`, 2 triggers, 1 `COMMIT`** e regex intacta `~ '^[1-9][0-9]{0,3}$',false) is false`. O verificador estático ganhou mutação adicional de regex truncada e contagem exata de funções, triggers e COMMIT; teste Node local `VS53L_STATIC=PASS` com sete mutações negativas. A discrepância era apenas na branch, não no Supabase.

Catálogo e histórico de migrações de `mfsshvckclnmftpaprxk` foram novamente confirmados sem nenhuma tabela ou migration C01 adicionada. **Nenhum PostgreSQL funcional C01 aprovado; sem escrita de banco, sem GitHub Actions, sem produção.** Evitar aprovar a fundação unicamente pelo teste estático; falta execução PostgreSQL 17 e Auth A/B C01.


## Checkpoint — pacote atômico e prova SQL read-only no PostgreSQL 17 (22/10/2026)

**Ação:** o usuário pediu prosseguir. Sem GitHub Actions, alterações produtivas, nova infraestrutura ou bypass de bloqueio de escrita Supabase.

- **Privilégio efetivo:** na sessão atual não há `postgres`, `psql` ou `initdb` instalados localmente; o executável `pg_config` não comprova um servidor local. Não apresentar testes locais sintáticos como se fossem compilação PostgreSQL.
- **Arquivo para implantação futura controlada:** `ferramentas/external-calc-list-intake/v0/vs53l/VS53L_C01_STAGING_ALL_IN_ONE_ATOMIC_CANDIDATE.sql`. Fundação e guarda #179 numa **única transação** com preflight forte de staging, RLS, grants e proprietário SECURITY DEFINER verificados antes do COMMIT. É uma proposta, não uma migration aplicada; não rodar em produção.
- **Evidência PostgreSQL 17 real, exclusivamente SELECT:** sete casos com `VALUES` sintéticos e operadores PG de modelo, capacidade, cor e preço: VALID, MODEL_PREFIX, MODEL_ID_SPOOF, CAPACITY_ABSENT, COLOR_WRONG, PRICE_CHANGED, PRICE_CENTS; **7/7 PASS**. Registro em `docs/external-calc/EXTERNAL_CALC_VS53L_PG17_READONLY_7CASE_PROOF_20261022.md`. Isso NÃO compila funções nem prova autenticação C01.
- **Erro novo reproduzido em PG17 real:** expressão de token anterior aceitava `Azul` na fonte `Azul Claro R$ 6.900,00` (falso positivo). Consulta SELECT demonstrou `existing_accepts=true` e `strict_accepts=false`. Correção proposta agora compara todo o prefixo de cor anterior ao token BRL `R$`; teste original `Azul` permanece elegível, `Azul Claro` deixa de ser interpretado como `Azul`. Quando o formato não permite atribuição única, revisão humana.
- O SQL `VS53L_C01_STAGING_PROOF_ROLLBACK.sql` inclui agora uma segunda fonte original sintética `vs53l-a-color-prefix`, binding e teste negativo `NEGATIVE_COLOR_PREFIX_NOT_BLOCKED` da RPC. **Ainda não executado como SQL DML real**.
- O `proof-vs53l-static.mjs` foi atualizado para checar que o SQL all-in-one corresponde integralmente à fundação atual, seu hash Git blob, assinatura do guard #179 e contagem de transações. Uma tentativa de edição havia sofrido expansão de caracteres `$'`; arquivo recuperado do commit anterior e corrigido com callback literal antes de uso. Revisão estrutural pela API GitHub final: `foundation_sha_pinned=true`, `reviewed_guard_sha_pinned=true`, `foundation_embedded_exact=true`, `1 BEGIN / 1 COMMIT / 6 tabelas / 7 funções / 2 triggers`, novo caso color-prefix presente. **Não declarar execução Node do verificador pós-correção sem executá-lo em checkout real**.

**Estado:** `VS53L_POSTGRES_SCALAR_EXPR=PASS_7_OF_7`; `COLOR_PREFIX_BUG=FIXED_IN_PROPOSAL`; `ATOMIC_SQL=PREPARED_STATIC_REVIEW`; `STAGING_C01_SCHEMA_APPLIED=NO`; `STAGING_C01_FUNCTIONAL=NOT_PROVEN`; `JWT_HTTP_AB_C01=NOT_RUN`; `PRODUCTION=NO_GO`.

**Ação mínima necessária para sair do bloqueio:** execução explicitamente autorizada do arquivo SQL all-in-one **somente em** `mfsshvckclnmftpaprxk` após revisão no Supabase SQL Editor ou restabelecimento da permissão apropriada de escrita do conector. O conector anterior bloqueou operações de escrita por segurança; não tentar outra ferramenta para contornar o bloqueio. Quando executada: confirmar migração e grants, rodar prova rollback, então validar Auth/JWT A/B real sobre endpoints C01 e revisar uma hipótese de fonte-verdade para todas as variantes antes de liberar beta.
