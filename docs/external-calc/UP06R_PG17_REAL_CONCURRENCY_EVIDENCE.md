# TREE | UP-06R — Prova parcial real de concorrência do nonce
Data: 2026-11-09
PR: #202 (draft). Base: feature/up06k-public-upgrade-port.
Ambiente de prova isolado: Neon rapid-pine-50752361 / up06q_proof / PostgreSQL 17.11.

## Evidência efetivamente obtida
1. Consulta read-only inicial: 1 registro, 2 papéis de teste criados.
2. Metadados: RLS ativado, duas políticas; usuário up06q_nonce_writer com USAGE no schema e privilégios SELECT/INSERT somente em colunas específicas. Papel up06q_noaccess sem schema USAGE nem SELECT.
3. Execução real de **8 requisições simultâneas** usando Neon run_sql no papel owner do laboratório:
   - Mesmo digest (prefixo 'e'), INSERT ON CONFLICT DO NOTHING RETURNING digest
   - **1 inserção confirmada e 7 conflitos confirmados; 0 erros**.
4. Rodada adicional tentou 24 requisições, porém o orquestrador atingiu limite antes de devolver a consolidação. Uma consulta de leitura posterior confirmou apenas **um registro para cada digest de prefixos 'f', '1' e '2'**; resultados por requisição não estão disponíveis e não devem ser classificados PASS.
5. Contagem final de leitura: 5 registros totais, 5 digests distintos, 4 digests da série de testes.

## Limites e problemas identificados
- Execução das operações como up06q_nonce_writer **não foi comprovada**. Tentativa de SET LOCAL ROLE retornou `42501 permission denied to set role`. A API Neon não permite SET ROLE + INSERT em uma chamada preparada.
- A rodada validada usou o proprietário do banco de teste, não o principal de mínimo privilégio.
- **32 conexões simultâneas** sob papel restrito **NÃO homologadas**.
- O esquema / dados pertencem exclusivamente ao laboratório; nenhuma alteração em Supabase/Worker de produção.
- Neon de laboratório continua existente e precisa de decisão explícita para descarte posterior; não eliminar autonomamente.

## Gates
G0 PG17 real isolado: PASS.
G1 unicidade e conflito real, 8 simultâneas: PASS.
G2 32 simultâneas: INCONCLUSIVE.
G3 segurança em sessão efetiva com conta restrita: BLOCKED.
G4 integrações JWT / Worker / API pública: NOT WIRED.
G5 merge/deploy: NOT AUTHORIZED.

## Próximo passo operacional
Configurar conexão independente como papel restrito no laboratório (não SET ROLE em Neon run_sql), repetir concorrência 32 e testar negações; depois realizar regressão integrada no runtime canônico. Não criar nova conta/ambiente produtivo neste gate.
