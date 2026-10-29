# TREE WM-03.4c | Isolamento: auditoria live + design review
Data: 2026-10-29 | Owner: Chat B | PR #201

## Auditoria real de staging
Projeto Neon `purple-violet-98259937`, banco separado do External Calc e Pitwall V2.
Consulta ao catálogo PostgreSQL retornou:
- `current_user = neondb_owner`
- `rls_enabled_tables = 0`
- `policy_count = 0`
- `pch_roles = 0`

Portanto NÃO há prova de isolamento A/B, papéis de serviço ou políticas RLS em vigor. Não usar credencial de owner no ingress HTTP.

## Entrega em branch
`ferramentas/external-calc-whatsapp/v0/sql/ingress-tenant-isolation-review-only.sql`
Commit `8584c5bf038fa8fc4f840711957e1676efe0094b`.
Arquivo de discussão que termina em `ROLLBACK`, sem ser migração aplicável. Enumera uma proposta de binding de papéis do banco para tenants e FORCE RLS. Explicitamente identifica dependências de GRANT, SECURITY DEFINER e riscos do PUBLIC policy; exige revisão antes de aplicar. Nenhuma alteração de RLS ou roles foi executada no staging.

## Próximo gate executável
1. Definir autenticador M2M confiável e criar workloads sem BYPASSRLS, sem herança de owner e sem SET ROLE cruzado.
2. Revisar matriz de permissões reais e políticas RLS para inbound e outbox usando identidade DB validada (não claim enviada pelo remetente).
3. Aplicar migração revisada somente no staging isolado.
4. Testar com duas identidades independentes autenticamente provisionadas: leituras e escritas por tenant, negação cruzada, replay, troca de role e owner bypass.
5. Provar rollback/concorrência e driver Node executado contra DB real antes de qualquer webhook.

GATE: DESIGN_REVIEW_ONLY / TENANT_AB_NOT_RUN / META_CALLBACK_OFF / PRODUCTION_NO_GO.
