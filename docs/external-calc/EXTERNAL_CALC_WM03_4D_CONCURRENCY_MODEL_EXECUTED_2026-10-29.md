# TREE | WM-03.4d — Prova executada do modelo de concorrência
Data: 2026-10-29
Owner: Chat B / PR #201

## Fonte e integridade
Arquivos consultados diretamente na branch:
- `ferramentas/external-calc-whatsapp/v0/ingress-transaction-v0.cjs`
  Git blob SHA: `af7486438caf6da8a2011314d9ee07f49829f7a8`
- `ferramentas/external-calc-whatsapp/v0/proof-ingress-concurrency-model-v0.cjs`
  Git blob SHA: `fb330986404bddba5815419fb0cc93ffc6f442d0`

Ambos foram materializados localmente e os hashes `git hash-object` coincidiram com os blobs da branch. Ambos passaram em `node --check` (código de saída 0).

## Execução
Node v22.16.0. Comando `node proof-ingress-concurrency-model-v0.cjs`, código de saída 0.

Saída:
```
PASS 12 overlapping simulated deliveries: one inbox + one outbox
PASS 11 replays acknowledged with stable original inbox id
PASS all calls committed; no duplicate outbox
PASS divergent replay rejected and rolled back
WM034B CONCURRENT MODEL PASS 4/4 (MOCK ONLY)
```

## Interpretação
PASS restrito ao modelo de concorrência simulado com `pg` mock. O mock serializa a decisão de INSERT e NÃO modela de forma fiel semântica de transações PostgreSQL concorrentes, locking real, falhas de rede ou RLS. Não extrapolar o resultado para produção.

## Gates
- Exact-source local mock execution: PASS 4/4
- PostgreSQL real concorrente: NOT_RUN
- Serviço Node contra PostgreSQL real com usuário não-owner: NOT_RUN
- RLS A/B: BLOCKED, políticas não aplicadas e sem papéis autorizados
- Webhook Meta: OFF
- Produção: NO-GO

Próximo: criar executor de matriz de integração PostgreSQL e executar quando houver credencial de staging autorizada com privilégios mínimos e isolamento comprovado. Não contornar bloqueio administrativo anterior.
