# UP-06P — Integração local identidade + replay / bloqueio real PostgreSQL
Data: 2026-11-09. PR #202, DRAFT, no merge.
## Resultado
- Inspecionados recursos locais: SEM postgres, initdb, psql, docker ou servidor PG17; pacote apt indisponível.
- Verificadas conexões Neon somente por listagem: projetos PG17 encontrados pertencem às frentes Pitstop Connect Hub e Commercial AI, não a sandbox isolada do Upgrade. Nenhum recurso ou branch foi criado.
- Regressão Node local: **33/33 PASS**, incluindo **6 testes UP-06P**. O teste de 20 invocações concorrentes usa *double de persistência*; não comprova concorrência PostgreSQL 17.
- Adicionados `service-composition.js` e `service-composition.test.js`: integração do verificador Ed25519, registro de chaves e contrato de replay PostgreSQL; flag desligada por padrão e recusa ativar sem dependências.
- Código na branch, mas sem route wiring, banco, segredo, emissão de credenciais ou Worker.
## Gate
A0 GitHub branch: PASS
A1 Node integration and regression: PASS 33/33
A2 PG17 real, 32 clients: **BLOCKED** (no isolated PG17 resource)
A3 role privileges on PG17: **BLOCKED**
A4 nonce persistence deployment: **BLOCKED**
A5 Worker wiring and E2E: **BLOCKED**
Release: NOT AUTHORIZED
## Decisão de arquitetura
Não usar automaticamente ambientes Neon de outras frentes, não instalar PostgreSQL no sistema do usuário, não acessar Supabase produtivo para INSERT, não emitir novas credenciais. O harness PG17 de UP-06O permanece executável quando houver instância descartável aprovada.
## Próximo passo útil
Obter um runtime isolado PG17 com permissão de ser destruído, rodar `pg17-ephemeral-proof.sh` com evidências da concorrência, depois conectar uma identidade real à porta interna. Sem novos gates documentais enquanto esta prova continuar indisponível.
