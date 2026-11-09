# UP-06K — Handoff / gate de revisão
Data: 2026-11-09
Repo: vinialbuquerquepitstop-beep/pitwall--nucleo
Base main: 922c929fd6ec37dda4ba53d3cebe02036660831b
Branch: feature/up06k-public-upgrade-port

## Estado
**BRANCH ISOLADA / IMPLEMENTAÇÃO PARCIAL / SEM DEPLOY / SEM SQL / SEM ALTERAÇÃO DE ROTAS.**

Implementado: porta `ferramentas/external-calc-public-upgrade/v0/internal-port.js`, desligada por padrão; testes em `internal-port.test.js`.

### Regras
- Somente 3 ações: resolveVariant, estimateTradeIn, simulateSale.
- Credencial obrigatória; função `verifyService` é dependência injetada e ainda não está implementada em produção.
- Exige uma única permissão exata por invocação, tenant válido, janela curta, publicação comercial aprovada e revisão coerente.
- Repositório de contexto tenant-scoped também é dependência injetada, não implementada.
- Output explícito sem dados de fornecedor, margem, taxa ou tabelas internas.
- Sem `service_role` em browser, sem GRANT `anon`, sem troca artificial de `auth.uid()`.
- Não monta rota no Worker; não altera `runtime.js`, banco, `wrangler.jsonc` ou contratos existentes.

## Evidências
- 136/136 testes locais no pacote UP-06K, incluindo regressões herdadas; os testes do GitHub são um subconjunto independente e ainda carecem de execução CI/canônica.
- Auditoria anterior UP-06I: RPCs atuais em produção exigem perfil autenticado e `auth.uid()`; o código da External Calc contém `resolveVariant`, `resolveTradeIn`, `resolveSimulation` e `createSalesProductService`.
- SHA/código do Worker atualmente implantado ainda não foi conciliado com `main`. Sem afirmar paridade.

## Bloqueios críticos
1. Implementar verificação criptográfica real e proteção de replay, armazenamento de nonce/revogação e rotação de chaves.
2. Desenvolver repositório SQL com escopo org+tenant e princípio de mínimo privilégio; provar isolamento no banco ativo sem usar acessos de funcionário.
3. Publicador e mapeador de catálogo aprovado para referências de oferta internas; confirmar o valor público de venda.
4. Adaptar apenas por serviços/resolvers existentes; provar rate profiles e trade-in sem duplicar aritmética.
5. Testar negativa entre organizações, abusos, dados confidenciais, acesso vendedor, concorrência e rollback.
6. Aprovação explícita antes de migration/deploy no Worker existente.

## Gates
G0 base/escopo: PASS
G1 módulo isolado: PASS
G2 teste local do pacote: PASS 136/136; teste GitHub/CI: PENDING
G3 runtime + identidade + banco reais: BLOCKED
G4 E2E autenticado: BLOCKED
G5 deploy: NOT AUTHORIZED

**Não fazer merge nem publicar nesta fase.**
