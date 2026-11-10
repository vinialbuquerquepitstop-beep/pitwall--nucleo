# UP-06N | PostgreSQL replay adapter — gate de segurança
Data: 2026-11-09. PR #202 draft. Código de integração ainda desconectado do Worker.

## Prova executada
- `postgres-replay-adapter.js`: `INSERT ... ON CONFLICT DO NOTHING RETURNING` parametrizado com chave SHA-256 do nonce, `tenant_id` e expiração; pool PG dedicado injetado.
- `postgres-replay-adapter.test.js`: 6 testes novos aprovados localmente com pool simulado.
- Conjunto de identidade+replay+adapter: 27/27 testes locais PASS.
- A concorrência com 48 instâncias foi simulada por store compartilhado. Não é prova de corrida transacional PostgreSQL.
- Nenhum SQL foi aplicado, nenhuma credencial criada, nenhuma rota publicada, nenhum merge.

## Contrato para o banco (DESIGN ONLY)
Tabela em schema privado com `nonce_digest` chave primária global, `tenant_id`, `expires_at` e `inserted_at`. `ON CONFLICT DO NOTHING RETURNING` é a única operação do executor; uma conta PG dedicada só com INSERT e SELECT da coluna de retorno, sem UPDATE/DELETE, sem concessões para `anon`, `authenticated`, `service_role` ou `PUBLIC`. Sem `SECURITY DEFINER` ou RPC pública. Retenção do digest até expiração + margem. DDL detalhada acompanha pacote local, **não está na pasta migrations**.

## Bloqueios
1. PostgreSQL 17 efêmero isolado para teste real de concorrência (2+ sessões/processos), rollback, ACL e limpeza.
2. Provisão protegida da credencial PG dedicada e isolamento de conexão no Worker, sem token humano/browser.
3. Implementar e testar lifecycle de nonce e rotação das chaves em storage real.
4. Integrar `createPostgresReplayConsumer` à `service-identity.js`, publicar apenas via route guard aprovada.
5. Provar isolamento de organizações e reversão de price revision, validar cálculos existentes sem duplicação.
6. Apenas autorização explícita posterior para SQL, deploy ou merge.

## Gate
G0 branch isolada PASS; G1 contrato PG PASS local; G2 testes 27/27 PASS local; G3 DB real BLOCKED; G4 Worker real BLOCKED; G5 production release NOT AUTHORIZED.

**Não fazer merge, não aplicar SQL, não publicar o Worker.**
