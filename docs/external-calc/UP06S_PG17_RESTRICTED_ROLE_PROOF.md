# TREE | UP-06S — PG17 real: replay com identidade de privilégio mínimo
Data: 2026-11-09
PR: #202 DRAFT
Ambiente: Neon project rapid-pine-50752361, database up06q_proof, PostgreSQL 17.11 (isolado; não é External Calc produção).

## Execução comprovada
1. Criado papel login do laboratório `up06r_replay_login` (com acesso read_only inicial à schema public), membro do papel sem LOGIN `up06q_nonce_writer` com privilégios restritos em `up06q_private.nonce_ledger`.
2. Consultado no próprio papel login:
   - INSERT/SELECT digest permitido via coluna.
   - SELECT tenant_id não permitido.
   - DELETE não permitido.
3. Enviadas **16 consultas concorrentes reais** pela conexão `role_name=up06r_replay_login` usando `INSERT...ON CONFLICT(digest) DO NOTHING RETURNING digest` e o mesmo digest.
   - **1 sucesso, 15 conflitos, 0 erros de chamada**.
4. Consultado pelo papel administrador do laboratório: precisamente 1 linha com digest da série (prefixo '9').
5. Quatro provas negativas executadas como o papel restrito:
   - SELECT tenant_id -> rejeitada;
   - DELETE -> rejeitada;
   - INSERT com created_at extra -> rejeitada;
   - SELECT * -> rejeitada.

## Limites de escopo
- O papel login foi criado na estrutura de teste com grants `read_only` sobre o schema public. Esses grants precisam ser removidos ou reavaliados para eventual principal produtivo; não afirmar privilégio mínimo global.
- As permissões restritas na tabela de nonce foram comprovadas, mas **32 conexões simultâneas** ainda não foram executadas devido ao limite de chamadas por orquestração.
- Não foi provado o worker em execução, emissão/rotação operacional de JWT, rate limit, isolamento de tenants no restante da External Calc ou cotação real.
- Nenhuma migration, alteração no Supabase ativo, merge, Worker deploy ou credencial de produção.

## Gates
G0 PG17 real isolado: PASS
G1 16 operações simultâneas com login restrito: PASS
G2 bloqueios de SELECT/DELETE/INSERT extra na ledger: PASS
G3 32 conexões simultâneas: PENDING
G4 chave real / DB connector production: BLOCKED
G5 Worker integration/quote: BLOCKED
G6 Deploy: NOT AUTHORIZED

## Próximo avanço focado
1. Contrato entre Worker, identidade verificada e DB connection com acesso restrito. Evitar dar `service_role` ao browser ou `anon` à ledger.
2. Validar 32 conexões reais com cliente de banco fora do limite de chamadas do conector, em ambiente de laboratório.
3. Manter PR em draft até E2E de identidade, publicação e cálculo usando motor canônico.
