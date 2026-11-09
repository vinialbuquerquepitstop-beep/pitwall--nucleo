# TREE | UP-06T — Ponte canônica de cálculo público (sem ativação)
Data: 2026-11-09
PR: #202 DRAFT / branch: feature/up06k-public-upgrade-port

## Implementado em código
- canonical-domain-adapter.js: reutiliza `resolveVariant`, `resolveTradeIn`, `resolveSimulation` do serviço canônico External Calc. A referência de oferta e seu fingerprint precisam coincidir com a publicação previamente aprovada. Não devolve preço de origem, fornecedor, margem, taxa ou identificadores internos.
- canonical-domain-adapter.test.js: cenários sintéticos de preço aprovado vs. preço do fornecedor, troca, parcelamento, fingerprint stale e cruzamento de organização.
- internal-upgrade-application.js: composição de autenticação Ed25519, nonce PostgreSQL, publicação aprovada, contexto tenant-scoped e resolvers canônicos. Desligada por padrão; não registra rotas.
- internal-upgrade-application.test.js: falha fechada sem dependências reais.

## Observação crítica
Os campos de `resolveVariant` incluem **preço do fornecedor**; esse valor NÃO é exibível. A bridge expõe apenas `publication.sale_price_minor` previamente aprovada. As simulações usam esse preço comercial, e os resultados públicos são projeções estritas.
A projeção de trade-in é uma estimativa do motor interno; não é promessa final de oferta.
Os testes adicionados ao GitHub **não foram executados na CI ou em checkout canônico nesta sessão**; não afirmar PASS de regressão do novo código.

## Bloqueios restantes
1. `loadApprovedPublication`: fonte real de publicações assinadas, com revisão e expiração, ainda não existe no backend.
2. `loadTenantScopedContext`: acesso confiável com isolamento por tenant e apenas dados permitidos; ainda não implementado.
3. JWT issuer, lifecycle de chaves, DB nonce writer e rotação não provisionados na infra ativa.
4. Rota privada no Worker e teste E2E não configurados. Sem alteração de `worker/external-calc-worker.mjs`, `runtime.js`, `wrangler.jsonc`, SQL ou grants.
5. O frontend público e captura CRM ainda não foram reconciliados com esta ponte.

## Gates
G0 contrato e código canônico identificados: PASS.
G1 ponte financeira escrita e commitada: PASS de entrega, TEST EXECUTION PENDING.
G2 isolamento das respostas por projeção explícita: IMPLEMENTADO, teste não executado neste branch.
G3 repositórios reais / runtime / secrets: BLOCKED.
G4 CI/regressão/E2E/autorização release: BLOCKED.
**Sem merge, migration ou deploy.**

Próxima ação recomendada: executar testes do próprio PR em checkout real, corrigir o resultado, implementar fontes de publicação e contexto tenant-scoped. Evitar novos gates sobre peças simuladas sem ligação operacional.
