# External Calc — C01 staging functional: execução controlada 22/10/2026

## Resultado
**NOT_APPLIED / NOT_VERIFIED.** Usuário pediu continuar até staging C01 funcional. Alvo exclusivo proposto: PitswallV2 Supabase external-calc-staging `mfsshvckclnmftpaprxk`, PG17. Produção `unjzpyexgtbcmjfgcqrx` fora de escopo. Sem GitHub Actions.

## Baseline antes de tentativa
Read-only staging confirmou 2 membros ativos, 2 usuários Auth, 3 fontes imutáveis, 1 evento, e **nenhuma** tabela C01 comercial (`extcalc_analysis`, `extcalc_review_candidate`, `extcalc_offer_revision`) ou RPC de promoção. Migrações prévias no staging: `external_calc_vs53i_staging_only_source_v0`, `external_calc_vs53i_staging_column_privileges_v0`.

## Proposta de migração C01
Fronteira de dados: `supplier → source_supplier → analysis → offer → review_candidate → offer_revision`, correlacionada por tenant. Schema público com RLS + FORCE, sem GRANT INSERT/UPDATE/DELETE a authenticated; escrita apenas em RPC com identidade `auth.uid()` e membership de staging. `privado.fn_tenant_atual()` e `privado.fn_papel_atual()` seriam derivados de membership, nunca tenant do payload. Binding RPC exigiria fonte disponível e fornecedor existente. Guarda de promoção **reutiliza SQL candidato do PR #179** (não reescrever isoladamente) e deve confirmar source/supplier, snapshot do candidate, fingerprint, field_sources e idempotência. Revisão de risco necessária para SECURITY DEFINER e cadeia de confiança de conteúdo original; o SQL do PR #179 valida linha não vazia, não a verdade independente da origem.

## Bloqueio efetivo
A tentativa de `execute_sql` com SQL grande em transação, seguida de apply_migration, **retornou bloqueio de segurança da ferramenta** sem confirmação de execução. Consulta read-only subsequente de presença de objetos também foi bloqueada. **Nenhuma implantação pode ser afirmada.** Não houve tentativa de burlar o bloqueio via rede, credenciais, GitHub Actions ou produção.

## Próximo gate técnico
1. Recuperar acesso permitido de consulta read-only; reconciliar catálogo e histórico de migrations antes de qualquer retry.
2. Revisar SQL funcional em artefato versionado, com transaction boundary explícita, triggers de imutabilidade e policy RLS correta; usar autorização aprovada apenas no staging.
3. Aplicar via Supabase autorizado ou operador, obter nome/version da migration e confirmar objetos/grants/advisors.
4. Seed de fornecedor, fonte e candidato **sintéticos**, promoção via chamada autenticada; negativas: anon, identidade B em A, fonte inexistente/quarentenada, supplier divergente, preço/modelo divergentes, proveniência falsa, candidate inexistente, retry e row-level leaks.
5. Verificar rollback/cleanup; concluir como STAGING_C01_FUNCTIONAL_PASS somente após evidência real. Produção NO_GO; PRs #178–#180 permanecem draft.

## Estado do bloco
G0 inventário PASS parcial; G1 candidato código auditado, operacional pendente; G2 prova SQL isolada PASS prévia; **C01 STAGING FUNCIONAL = BLOCKED**, não é PASS. GitHub Actions expressamente excluído.
