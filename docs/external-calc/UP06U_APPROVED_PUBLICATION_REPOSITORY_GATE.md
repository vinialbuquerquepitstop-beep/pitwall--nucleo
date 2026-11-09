# TREE | UP-06U — Publicação comercial vinculada à identidade (sem ativação)
Data: 2026-11-09
PR: #202 draft
## Entrega concreta
- Adicionado `ferramentas/external-calc-public-upgrade/v0/published-offer-repository.js` e teste.
- Lookup SQL parametrizado exige `tenant_id`, `public_id`, `price_revision` e `status='published'`; retorna no máximo dois registros para detectar duplicidade.
- Verifica exatidão do tenant e revisão; validade, preço autorizado, fingerprint de origem, referência e prazo. Retorno é allowlist sem custo/fornecedor.
- `internal-upgrade-application.js` agora aceita `publicationQuery`, cria `createPublishedOfferRepository` e injeta no `internal-port`, que exige identidade verificada + contexto tenant-scoped.
- Estado de ativação: `enabled=false` por padrão; sem rota pública, sem alteração em `worker/external-calc-worker.mjs`, sem acesso à DB ativa, sem migrations.

## Provas executadas nesta sessão
- Repositório de publicações (8 testes com query sintética) PASS 8/8 via `node --test` em runtime local.
- Suíte local de identidade/replay UP-06P PASS 33/33 via `node --test`; é conjunto anterior, não checkout completo do PR.
- Checkout remoto do repositório não está disponível nesta sessão; **testes novos na branch canônica / CI não executados**.
- Tabela `privado.extcalc_upgrade_publications_v0` **ainda NÃO criada**; query é contrato de leitura, não query operacional homologada.

## Bloqueios de segurança
1. Implementar e aprovar publicação humana/assinada + revogação, e tabela privada tenant-scoped com papel exclusivo; `status='published'` sozinho não prova aprovação.
2. Tipos PostgreSQL de valores monetários/expiração e normalização driver Node ainda devem ser reconciliados com o DDL definitivo (BIGINT pode retornar string). Requer teste integrado.
3. Implementar `loadTenantScopedContext` sem ler ofertas de outros tenants nem expor custo/fornecedor.
4. Configurar emissor real de identidade, nonce storage e chaves, conectar Worker com autenticação e limitar chamadas.
5. Provar regressão dos vendedores e fluxo E2E, 32 sessões simultâneas, rollback.
6. Nenhum release autorizado. PR deve permanecer draft.

## Próximo avanço prático
Reconciliar DDL com a base canônica, construir tabela privada de publicação **em banco isolado autorizado**, testar tipo/índice/RLS e política de revogação; não aplicar migration em produção sem autorização explícita.
