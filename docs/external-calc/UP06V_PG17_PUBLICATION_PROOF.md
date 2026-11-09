# TREE | UP-06V — Publicações comerciais em PostgreSQL 17 isolado
Data: 2026-11-09
GitHub: PR #202 DRAFT. Nenhuma alteração no Worker, Supabase ou produção.

## Banco usado
Projeto Neon **rapid-pine-50752361** / database `up06q_proof`, PostgreSQL **17.11**. Ambiente criado exclusivamente para os ensaios do Pitstop Upgrade; não contém dados comerciais reais.

## Implementação e prova no banco
- Criado schema privado `privado`, tabela `extcalc_upgrade_publications_v0` com PK (tenant_id, public_id, price_revision), status draft/published/revoked, price BIGINT e revisão de oferta.
- Constraints impedem publicação sem `approved_at` e `approved_by`, e exigem `revoked_at` quando revogada.
- RLS ativada; `PUBLIC` sem GRANT na tabela e schema. Papel `up06v_publications_reader` possui SELECT restrito a colunas explícitas e política RLS **limitada ao tenant sintético A deste laboratório**.
- Login `up06v_publications_login` testado em sua própria sessão. SELECT sem filtro retornou **somente published_ok** (aprovado, não expirado, tenant A).
- Consulta exata aprovada revisada (mesmo predicado de WHERE da aplicação):
  - `published_ok`: 1 linha visível
  - `draft`: 0 linhas
  - `expired`: 0 linhas
  - `revoked`: 0 linhas
  - `other_tenant`: 0 linhas
- Tentativas como login restrito de leitura de `created_at`, UPDATE e INSERT foram rejeitadas; SELECT de tenant B retornou zero linhas.
- Inserção de `published` sem metadata de aprovação foi negada pela constraint `published_requires_approval` (SQLSTATE 23514).
- Atenção: login foi criado pela integração Neon com `read_only` no schema `public` antes de aderir ao papel restrito; NÃO é prova de privilégio mínimo global, apenas na tabela privada alvo.

## Código
- Corrigido `published-offer-repository.js`: exige approved_at/approved_by, no revoked_at, não expirado, e valida tenant/id/revisão; normaliza BIGINT decimal de driver PostgreSQL em inteiro seguro, falhando fechado em valores inválidos.
- `published-offer-repository.test.js`: acrescentados dois testes de BIGINT. Suíte específica local: **10/10 PASS**.
- Não executada suíte completa remota do repositório. Não foi testado um `pg` Node client real com variáveis de produção; SQL equivalente foi executado diretamente via conector Neon.

## Limites / antes de ativar
1. Publicação neste laboratório é **sintética** e `approved_by` é dado inserido manualmente pelo proprietário; não comprova fluxo real de aprovação humana auditável.
2. Política RLS de tenant A é **somente de laboratório**; desenho escalável de identidade de tenant precisa de implementação final.
3. Implementar `loadTenantScopedContext` com prova de isolamento de ofertas reais.
4. Provisionar credenciais privadas e emissão/chaves de serviço, executar regressões e E2E no runtime existente.
5. Realizar homologação visual e funcional do link Instagram antes de publicar.
6. PR permanece em draft; nenhuma migration, merge ou deploy autorizado.

## Gate
A0 laboratório PostgreSQL 17: PASS
A1 schema privado + RLS + constraints: PASS LAB
A2 consulta com login restrito: PASS LAB
A3 status, expiração, revogação, cross-tenant: PASS LAB
A4 10 testes Node específicos: PASS LOCAL
A5 fluxo real de aprovação + contexto financeiro + runtime: BLOCKED
A6 produção: NOT AUTHORIZED
