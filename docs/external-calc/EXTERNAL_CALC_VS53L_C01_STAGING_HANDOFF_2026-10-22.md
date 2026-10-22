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
