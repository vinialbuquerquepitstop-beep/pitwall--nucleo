# External Calc — VS5.3g / Matriz de isolamento pronta para staging

**Data:** 21/10/2026. **Estado:** matriz executável OFFLINE; RLS real NÃO TESTADA; produção NO-GO.
**Base empilhada:** VS5.3f PR #196, VS5.3e PR #195 e VS5.3d PR #194.

## Objetivo
Evitar falso PASS em isolamento de tenants. Uma consulta vazia por erro, por fonte inexistente, por falha de rede, por filtro de tenant no frontend, ou pela ausência da tabela **não é prova** de row-level security.

Implementação: staging-rls-readonly-matrix.cjs + proof-vs53g.mjs. O contrato transport-neutral de probe recebe SOMENTE actor (A/B/ANON) e source_ref. Cada resultado deve ser FOUND com UMA identidade de fonte própria e metadados válidos ou NOT_FOUND/FORBIDDEN SEM record. Não consulta banco sozinho e não autentica JWT.

## Matriz (8 probes; exigem fixtures reais em homologação no futuro)
- A lê sua fonte A: FOUND íntegro.
- B lê sua fonte B: FOUND íntegro.
- A lê B e B lê A: NOT_FOUND ou FORBIDDEN, sem conteúdo.
- ANON lê A/B: NOT_FOUND ou FORBIDDEN, sem conteúdo.
- A/B leem referência inexistente: NOT_FOUND ou FORBIDDEN.
- Erro de transporte, 500, fonte própria ausente, fonte inesperada ou retorno indevido: FAIL CLOSED.

As 12 provas de contrato executadas localmente em CI incluem casos positivos e controles negativos (vazamento cruzado, anônimo, tenant errado, hash inválido, origem ausente, falha de rede, payload indevido e estado mutável/quarentena).

## Gate real que ainda NÃO pode ser satisfeito
1. Registrar autorização humana do projeto de staging exclusivo do External Calc. Os projetos listados não comprovam existência desse staging; ref unjzpyexgtbcmjfgcqrx é conhecida como produção e nunca poderá ser usada para esta prova.
2. Escolher banco/Storage e schema exatos; a VS5.3e ainda é uma proposta. Não presumir tabela pública, exposição de bytes via PostgREST ou interface de rede. Preservar raw bytes fora de respostas a usuários sem autorização.
3. Implementar reader READ ONLY autenticado de homologação que invoque RLS real, sem service_role, sem SECURITY DEFINER, sem bypassrls. Provar JWT A/B/anon com duas fontes sintéticas distintas. Fonte própria FOUND é obrigatória; cross-source não pode vazar. Não passar tenant do cliente.
4. Inspecionar RLS e permissões efetivamente aplicadas, não só SQL versionado: pg_class.relrowsecurity, pg_policies, grants, owner e BYPASSRLS; auditar as funções privado.fn_tenant_atual e privado.fn_papel_atual no ambiente real. Não basta filtrar tenant na aplicação.
5. Testar escrita negada/imutabilidade em transação de staging sob identidade não privilegiada, **somente após autorização expressa para testes de escrita**. A presente etapa não emite comandos de escrita.
6. Atestar integridade byte-a-byte real e SHA desde captura original VS5.3f; RLS A/B isoladamente não prova origem.
7. Separar decisão de deploy: incidente 20/10, #178–#180 e C01 continuam NO-GO.

## Evidência
node ferramentas/external-calc-generalization/v0/proof-vs53g.mjs

O relatório do harness tem real_rls_verified=false e production_gate=NO_GO por desenho, inclusive quando as 8 leituras simuladas passam. O atributo writes_by_harness=0 prova apenas que o harness não tem verbos de escrita; não certifica o transporte injetado.

**Classificação:** VS53G_MATRIX_STATIC=CI_PENDING; VS53G_REAL_RLS=NOT_RUN; VS53E_STORAGE_DECISION=HUMAN_GATE_PENDING; C01_PRODUCTION=NO_GO.
