# TREE | UP-06W — Contexto financeiro restrito por organização
Data: 2026-11-09
PR #202 DRAFT | sem merge, sem deploy.

## Escopo e implementação
- `tenant-context-repository.js`: fonte SQL parametrizada com `tenant_id`, `public_id`, `offer_revision`; valida oferta selecionada, fingerprints, contexto financeiro e pertencimento dos registros.
- `tenant-context-repository.test.js`: **9/9 PASS** executados localmente em Node 22, usando query double; bloqueio de dados estrangeiros, dados ausentes, revision stale e falhas de banco.
- `internal-upgrade-application.js`: aceita `contextQuery` e injeta leitor em `createInternalUpgradePort`; ativação segue `enabled=false` por padrão. **Não há rota no Worker.**

## Prova real limitada em laboratório
Banco Neon isolado: `rapid-pine-50752361`, `up06q_proof`, PostgreSQL 17.11.
- Criada tabela de teste `privado.extcalc_upgrade_context_v0` com RLS e política limitada ao tenant sintético A.
- Inseridos 2 contextos exclusivamente sintéticos, tenants A e B, mesmo `public_id` e revisão.
- Consulta com login de teste `up06v_publications_login`: SELECT sem filtro retornou somente tenant A (1 linha).
- Consulta própria A: 1 linha.
- Consulta estrangeira B: 0 linhas.
- Revisão não coincidente: 0 linhas.
- UPDATE pelo login restrito: acesso negado.
- Nenhuma carga de dados reais de fornecedores; não foi usado Supabase produtivo.

## Segurança e incompatibilidades ainda abertas
1. **A fonte de produção não existe.** A tabela isolada é protótipo de teste; o contrato SQL não está instalado na External Calc.
2. O `postgres-sales-product-source.js` canônico usa RPCs com `auth.uid()` e perfil vendedor. A identidade de serviço UP-06W não deve falsificar usuário. Precisamos de serviço interno dedicado e plano de autorização tenant-scoped.
3. Os objetos de ofertas de produção ainda não possuem prova de carimbo `tenant_id` por linha. O repositório rejeita o que não tem esse campo: falha fechada, mas não é integração real.
4. A política RLS do laboratório fixa tenant A, não resolve tenancy dinâmica; `up06v_publications_login` também possui grant READ ONLY do schema `public`, portanto não alegar mínimo privilégio global.
5. O armazenamento contém contexto financeiro privado para processamento server-side; jamais retornar esse objeto ao navegador; só retornar projeção do port canônico.
6. Não foram rodadas as suites completas do repo / smoke E2E / 32 conexões com o app. **Não homologado para produção.**

## Gates
G0 base/branch: PASS
G1 código de leitura com contratos restritos: PASS de entrega
G2 testes Node locais: PASS 9/9
G3 RLS laboratório com 2 tenants: PASS LAB
G4 fonte canônica em runtime, aprovação real e end-to-end: BLOCKED
G5 release: NOT AUTHORIZED

## Direção prática
Próximo slice: reconciliar o contexto das RPCs e construir adaptador server-side restrito verificável por token de serviço; executar E2E sobre ambiente controlado e dados sintéticos. Não criar mais interfaces ou gates documentais sem completar o caminho funcional.
