# External Calc — VS5.3e / Proposta de source storage + RLS em staging

**Data:** 21/10/2026. **Status:** PROPOSAL ONLY / HUMAN GATE PENDING.  
**Base:** VS5.3d, PR #194 — CI estático/stub PASS; armazenamento real NÃO IMPLEMENTADO.

## Problema demonstrado
O `trusted-original-source.cjs` é um adapter `repository.loadTenantOriginalSource` sem repository persistido. Seus 8 testes usam dados em memória e não provam armazenamento de bytes originais nem RLS real. Os artefatos existentes `extcalc_source_supplier`, `extcalc_execution`, `calc_carga` e `extcalc_review_candidate` não garantem conteúdo original imutável. Foi feita uma listagem read-only dos projetos Supabase conectados; nenhum está identificado como **staging do External Calc**. O projeto `unjzpyexgtbcmjfgcqrx` é o ambiente produtivo conhecido e não será usado.

## Arquitetura proposta (NÃO aprovada)
**Opção inicial preferida para homologação:** uma fonte exclusiva de bytes originais em tabela PostgreSQL tenant-scoped, com RLS, registros insert-only, fingerprint calculado sobre bytes de ingestão e acesso `authenticated` com tenant/actor server-side. Testar limites de tamanho/latência antes de escolher definitivamente. **Alternativa:** Supabase Storage privado com row de metadados; exige proteção adicional do objeto, path e uploads/upserts. Nenhuma opção foi implementada ou congelada.

### Propriedades obrigatórias
- `source_ref` opaco, gerado pelo servidor, único no tenant; `tenant_id` e `created_by` derivados de Auth, nunca aceitos como autoridade do cliente.
- `content_bytes` preservados exatamente no ponto de ingestão; para texto colado, definir conversão única para UTF-8 sem normalização silenciosa. `content_sha256` calculado/verificado **sobre os bytes**, não sobre snapshot C01.
- `source_type=ORIGINAL_SUPPLIER_TEXT`; versão `external-calc-original-supplier-source/v0`; nome/MIME/encoding controlados; rejeição de arquivo inválido.
- Limites de bytes/tempo/subrequests definidos por medição; prevenção de ingestão parcial, truncamento, upsert divergente, excesso de tamanho e substituição de conteúdo.
- RLS efetiva + grants mínimos para `authenticated`; leitura escopada por tenant e papel; proibição de UPDATE/DELETE/UPSERT sobre bruto por usuário comum.
- `service_role` e `SECURITY DEFINER` **não são** evidência de RLS; funções privilegiadas e owners devem ser auditados.
- Registro bruto imutável; estados `AVAILABLE / QUARANTINED / REVOKED / DELETED` modelados por **eventos append-only** separados (ou equivalente comprovado), evitando UPDATE do conteúdo. Resolver nega todo estado diferente de `AVAILABLE`.
- Retenção, exclusão legal, auditoria e rollback precisam de política antes da implementação; fonte não pode carregar uma regra comercial escondida.

## Matriz de homologação real — somente staging identificado e autorizado

| Prova | Esperado |
|---|---|
| JWT real A / fonte A | leitura íntegra, bytes e SHA iguais |
| JWT real B / fonte A; A / fonte B | negação sem vazamento |
| JWT ausente, inválido ou expirado | 401/negação |
| papel não permitido / ator revogado | negação |
| tentativa UPDATE / DELETE / overwrite por usuário comum | negação e fonte original intacta |
| origem derivada, hash alterado, fonte revogada/quarentenada | fail closed |
| ingestão repetida idêntica; ref igual com bytes diferentes | idempotência explícita; conflito sem substituição |
| tamanho/encoding inválidos | rejeição íntegra, sem truncamento |
| preview após leitura | `REVIEW_REQUIRED`, `persisted_count=0`, sem accept/persist/quote/publish |

Usar exclusivamente 2 usuários fictícios em tenants distintos, papel real `authenticated` e policy metadata instalada no staging (`pg_policies`, `relrowsecurity`, grants, owners, bypasses). Registrar resultados sem tokens, PII ou bytes comerciais. Testes em `service_role` não contam como prova de isolamento.

## Ordem e gates
1. **VS5.3d:** PASS estático/stub, PR #194 ainda DRAFT; produção NO-GO.
2. **VS5.3e:** este documento é uma **proposta**: sem DDL, sem migration, sem credenciais e sem deploy.
3. **Gate humano:** confirmar tecnologia de armazenamento, limite, retenção, projeto staging exclusivo e autorização explícita antes de qualquer DDL.
4. **Gate real:** implementar sob PR separado no staging autorizado; provar JWT A/B, RLS instalada, proteção de escrita e rollback; não substituir gatilhos humanos.
5. **Segurança produtiva:** reconciliar incidente de 20/10 e PRs #178–#180 antes de qualquer integração C01 ou novas listas reais.
6. **Integração:** preservar Core C01–C05 congelado, service preview read-only e gates de UI/browser já aprovados.

**Estado:** `VS53E_STORAGE_PROPOSAL=READY_FOR_HUMAN_GATE`; `REAL_SOURCE_RLS=BLOCKED/NOT_RUN`; `C01_PRODUCTION=NO_GO`.
