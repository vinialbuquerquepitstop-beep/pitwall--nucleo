# External Calc — VS5.3c / Homologação de RLS — Pré-flight

**Data:** 21/10/2026. **Estado:** PRECHECK ESTÁTICO; TESTE REAL **BLOQUEADO**, não executado.

## Diagnóstico apoiado nos arquivos
- `supabase/migrations/20260919231000_external_calc_c01_review_candidate_v0.sql`: tabela `public.extcalc_review_candidate` tem RLS ativada na migração e política SELECT com `tenant_id = privado.fn_tenant_atual()` **e** `privado.fn_papel_atual() = 'dono'`. Isso é regra declarada no código-fonte, **não uma verificação da migração efetiva no banco**.
- `postgres-review-candidate-repository.js`: leitura da revisão C01 filtra explicitamente pelo tenant, analysis_id, offer_id e revisão. Filtro de aplicação é defesa adicional, não substitui RLS.
- `external-calc-runtime/v0/runtime.js`: `resolveIdentity` real é exportada e reutilizada no experimento VS5.3b. Os 9 testes de VS5.3b usam HTTP simulado, não identidades reais do Supabase.
- `preview-api-shadow.cjs` aceita só `trusted_input_ref`; `service-preview-contract.cjs` exige referência e tenant equivalentes na resposta do resolver.
- **Fonte original da lista:** não há contrato comprovado de fonte persistida, imutável, escopada por tenant, que resolva `trusted_input_ref` com RLS real. `extcalc_review_candidate` guarda snapshots de revisão; **não assumir que ele guarda o texto bruto original completo**.

## Bloqueios antes de testes reais
1. Definir a fonte e identidade da lista original do fornecedor, ACL, imutabilidade, retenção, e campo de referência. Não inventar tabela ou reutilizar snapshot C01 como texto bruto.
2. Confirmar projeto Supabase de homologação **separado** de produção; escopo autorizado, migrations e URLs mascaradas.
3. Preparar duas contas de teste válidas de **tenants distintos**; nenhuma conta de produção. Testar acesso ao próprio recurso e negar acesso cruzado; sem leitura de dados reais.
4. Conferir na homologação as políticas RLS aplicadas no banco e o papel `authenticated`, sem usar `service_role` nas provas de isolamento.
5. Confirmar que a rota preview não está registrada no Worker de produção e que não há verbos de escrita/PostgREST RPCs de persistência no teste.
6. Antes de qualquer proposta de rollout, resolver quarentena/reconciliação das revisões potencialmente contaminadas com gates separados (#178–#180).

## Procedimento planejado quando autorizado
- Verificar metadados do projeto staging; **não conectar automaticamente** a produção.
- Ler policy metadata e `pg_class.relrowsecurity` do schema staging, sem executar DDL.
- Sob JWT A e JWT B de contas artificiais, executar **somente GET/SELECT**, para a mesma fonte A/B e candidatos artificiais; comparar status e conteúdo. Consultar a fonte do tenant alheio deve retornar 0 registros, nunca retornar um registro só porque o filtro de URL foi omitido.
- Negar usuário inativo, vendedor ou JWT inválido de acordo com política aplicável à fonte; registrar 401/403/404 sem vazamento. Não presumir que papel beta valida acesso C01: a tabela de revisão declara dono.
- Auditar leitura de texto bruto versus leitura de snapshot, e capturar logs sem JWT, PII ou conteúdo comercial.
- Bloquear deploy se faltar qualquer policy, se o tenant for derivado do cliente, ou se a origem do texto for ambígua.

## Estado e saída
`preflight-vs53c.mjs`: prova automatizada **somente do repositório**: RLS declarada, escopo tenant, bridge existente e rota preview não registrada. PASS estático **não implica PASS do RLS**.

`VS53C_STATIC_PREFLIGHT`: sujeito ao CI.

`VS53C_REAL_AUTH_AND_RLS`: BLOCKED / NOT_RUN.

`C01_OPERATIONAL`: NO-GO.

Próximo movimento válido: obter ambiente de homologação seguro e definir o contrato de origem da lista. Não executar testes reais usando o projeto de produção.
