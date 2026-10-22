# External Calc — VS53P original-source intake and missing-offer recovery (2026-10-22)

## Intenção
Fechar o encadeamento operacional **colar lista → registrar original imutável → vincular fornecedor → interpretar → revisão humana → recuperar linha omitida**, sem auto-promoção ou simulação de persistência. Não realizar mudanças de produção nem GitHub Actions.

## Código produzido
Backend branch `feat/external-calc-f1-controlled-intake-20261022`:
- `list-intake-api.js`: rejeita fora do Supabase **staging `mfsshvckclnmftpaprxk`**, limita original a 1MB, exige fornecedor, registra o original via RPC segura antes de persistir candidatos, verifica recibo e deixa `auto_promoted=0`. Relata linhas monetárias sem cobertura, sem alegar extração universal.
- `staging/VS53P_REGISTER_ORIGINAL_SOURCE_STAGING_ONLY.sql`: registro append-only atômico + vínculo do fornecedor, SHA-256 sobre bytes UTF-8, verificação de colisão e acesso `authenticated/dono`; nenhuma leitura direta concedida.
- `staging/VS53P_RECOVERY_ORIGINAL_READ_RPC_STAGING_ONLY.sql`: leitura do original imutável restrita a dono+tenant e fonte vinculada/não quarentenada; SHA-256 validado, análise única por fonte. O corpo da lista é entregue somente à API autenticada; nunca incluído no recibo público de recuperação.
- **Migração única proposta** `staging/VS53P_ORIGINAL_SOURCE_FOUNDATION_ALL_IN_ONE_STAGING.sql` e ensaio igual com terminal `ROLLBACK`: `VS53P_ORIGINAL_SOURCE_FOUNDATION_DRY_RUN_ROLLBACK.sql`. **Nenhuma das duas foi executada no PostgreSQL** nesta sessão.
- `postgres-manual-recovery-source-v0.js`: somente API do projeto staging, via JWT do usuário, SHA-256 revalidado no servidor; carrega somente modelos documentados no snapshot Apple e identifica que esse catálogo é limitado (não cobre todo o iPhone 17/18).
- `manual-missing-offer-recovery-v0.js`: oferta recuperada vira exclusivamente C01 `REVIEW_REQUIRED`; exige modelo seguido de capacidade, preço exato em reais e cor integral na linha monetária adjacente (limitação real do atual `extcalc_persist_review_candidate_v0`). Rejeita preço/modelo falsificado, linha divergente, origem não autorizada, condições ambíguas. Modelo ainda não catalogado pode ser inserido como *proposta literal presente na fonte*, com `catalog_verified=false`, nunca como validado para cotação.
- `manual-missing-offer-recovery-api-v0.js` + `external-calc-runtime/v0/runtime.js`: rota autenticada `/api/external-calc/v0/manual-recovery`, habilitada no runtime apenas se `EXTCALC_MANUAL_RECOVERY_STAGING=true` e projeto Supabase coincide com staging; sem resolver o original, responde 503; não retorna texto original ao cliente.
- Testes versionados `prova_controlled_intake_flow_v0.js`, `prova_manual_missing_offer_recovery_v0.js`, `prova_manual_missing_offer_recovery_api_v0.js`, `prova_source_price_coverage_v0.js`. Fixtures de recuperação atualizadas para o formato estrito de linhas de modelo/preço.

Frontend existente na branch de convergência `pitstop-calc:feat/external-calc-f1-real-review-pilot-20261022`:
- `external-calc-manual-recovery-client.ts`: cliente de recuperação com origem de homologação obrigatória e `model_label?` apenas para modelo ausente do catálogo, nunca permitida como prova de cotação.
- Intake apresenta interpretação preliminar com linhas monetárias não conciliadas e `UNSAFE_INTAKE_RESPONSE` contra API legado que tente promoção automática.
- Piloto `/revisao-c01-piloto` autenticado exige recibo de decisão `RECORDED_AWAITING_C01_AUTHORITY`. A rota `/revisao` aprovada não foi substituída.
- **Formulário visual de recuperação NÃO está implementado**: criação do componente foi bloqueada pela ferramenta. Não declarar que está funcional ou navegável.

## Evidências desta sessão
- Inventário do staging e função atual `extcalc_persist_review_candidate_v0(jsonb)` confirmaram que a persistência exige linha de modelo e próxima linha de preço, com a cor no mesmo texto do preço, e `model.id` compatível com slug da etiqueta.
- Todas as três fontes originais existentes possuem hash real `sha256:` íntegro (3/3), conferido por função `pg_catalog.sha256(bytea)`.
- Execução isolada do JS real com dependências simuladas: recuperação strict 7/7, modelos não catalogados 5/5, resolver do original 8/8. Não equivale à execução em PostgreSQL ou Worker real.
- Releitura de arquivos via GitHub: 14/14 verificações estruturais estáticas PASS (fonte registrada antes de candidato, nenhuma promoção automática, origem staging, SQL BEGIN/COMMIT único, dry-run equivalente, RLS e RPCs limitadas).
- Reconciliação read-only no Supabase: `extcalc_register_original_source_v0` **não instalada**, `extcalc_resolve_manual_recovery_source_v0` **não instalada**, `extcalc_persist_review_result_v0` instalada; 3 originais, 0 candidatos, 0 decisões de revisão.
- Nenhum deploy, merge, mudança de produção, GitHub Actions nem novo teste manual do usuário.

## Gates ainda bloqueantes
1. Rodar o ensaio SQL **somente no staging**, verificar resultado e instalar a migração VS53P uma única vez após auditoria. Isto NÃO foi executado e não é uma solicitação ao usuário neste ponto.
2. Revisar fidelidade das tabelas do backend comercial em relação ao staging e testar a origem/bind de verdade. A importação ainda usa RPCs sequenciais e não é uma transação atômica de lote; falha intermediária pode deixar alguns candidatos em revisão.
3. Construir/formalizar o formulário visual de recuperação, executar typecheck/Next build e testar mobile. Ferramenta bloqueou a criação anterior, portanto frontend visual ainda P0.
4. Ligar o Worker de homologação e testar fluxo positivo com JWT real numa **única rodada integrada** quando estiver funcional, em vez de repetir testes negativos isolados.
5. Definir autoridade C01 que promove decisão humana auditada para oferta cotável; VS53N atualmente **apenas registra auditoria**. Integração C02–C05/quote/simulação e benchmark holdout permanecem pendentes.
6. Reconciliar instalação manual SQL com migrações versionadas e manter quarentena de 24 revisões históricas antes de qualquer release externo.

## Estado e release
`F1_SOURCE_ARCHIVE_CODE=IMPLEMENTED_STATIC_VERIFIED`;
`F1_SOURCE_READ_CODE=IMPLEMENTED_MOCK_PROVED`;
`F1_VS53P_STAGING_SQL=UNINSTALLED`;
`F1_MISSING_OFFER_RECOVERY_CORE=IMPLEMENTED_MOCK_PROVED`;
`F1_FRONTEND_MANUAL_FORM=BLOCKED`;
`F1_STAGING_POSITIVE_E2E=NOT_RUN`;
`CONTROLLED_V0=NO_GO`;
`PRODUCTION=NO_GO`.
