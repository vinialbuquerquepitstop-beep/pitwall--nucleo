# EXTERNAL CALC - LAST INFRA V0

Data: 19/09/2026
Status: PROCESSO DE FECHAMENTO DA ULTIMA INFRA

## 1. Objetivo

Fechar a infraestrutura que falta entre a API V0 ja aprovada e os frontends ja
construidos.

O frontend NAO espera esta fatia para evoluir visualmente, mas NAO troca fixtures
por backend real antes do Gate G4.

## 2. Arquitetura alvo

```text
Frontend
   |
   v
Cloudflare Worker
   |
   v
External Calc API V0
   |
   v
Application Service
   |
   +----> Service V0 -> C02/C03/C04/C05
   |
   v
Postgres Lifecycle Adapter
   |
   v
RPC transacional autenticada
   |
   v
extcalc_*
```

## 3. Invariantes

- zero regra C01-C05 no Worker;
- zero calculo financeiro no endpoint;
- tenant_id nunca vem do body como autoridade;
- execution_id e run_ids sao gerados no servidor;
- zero service_role no frontend;
- V0 tambem nao exige service_role no Worker;
- authenticated continua sem INSERT/UPDATE/DELETE direto em extcalc_*;
- escrita ocorre somente pela RPC controlada;
- RPC deriva tenant e papel do JWT no banco;
- Interpreter permanece congelado;
- frontend aprovado nao e redesenhado por esta fatia.

## 4. Gate G1 - Postgres Adapter / RPC

Entregas:

- PostgresLifecycleRepository;
- RPC atomica extcalc_persist_execution_v0;
- validacao de tenant, papel e lineage no banco;
- idempotencia por execution_id + core_output_fingerprint;
- leitura por RLS da extcalc_execution.

PASS quando:

```text
bundle Service V0
-> RPC
-> Analysis + Offer + Revision + Execution + Runs + Evidence
```

sem permitir escrita direta nas tabelas.

## 5. Gate G2 - Runtime / Auth

Entregas:

- Worker atende somente /api/external-calc/*;
- assets atuais continuam no caminho existente;
- JWT e validado no Supabase Auth;
- tenant/papel sao lidos de app_usuario sob JWT;
- papel V0 autorizado: dono;
- API recebe apenas auth_context derivado no servidor.

PASS quando:

```text
sem JWT -> 401
JWT sem permissao -> 403
tenant_id no body -> 400
JWT dono -> fluxo executa
```

## 6. Gate G3 - Round-trip real

Prova em banco real, com fixture sintetica controlada:

```text
POST real
-> Service V0
-> RPC
-> Postgres
-> GET/reload
-> request original + service_result original
```

A prova deve conferir:

- 1 Analysis;
- 1 Offer;
- 1 OfferRevision;
- 1 Execution;
- 4 Runs;
- Evidence esperada;
- fingerprints preservados;
- tenant correto;
- nenhuma linha cruzada para outro tenant.

A fixture de prova deve ser removida ao final ou executada dentro de estrategia
de rollback controlada.

## 7. Gate G4 - Deploy / Endpoint

- Wrangler dry-run verde;
- merge somente com CI verde;
- deploy do Worker atual, sem Worker paralelo;
- rota publica /api/external-calc/v0/execute deixa de cair no SPA;
- request sem auth responde JSON 401;
- static frontend continua 200;
- nenhuma regressao no caminho de recovery.

## 8. Gate final - INTEGRATION READY

Somente depois de G1 + G2 + G3 + G4:

```text
BACKEND_INTEGRATION_READY = true
```

A partir daqui entra a fatia separada:

```text
Frontend Adapter
-> substituir fixture
-> API real
-> comparar fixture vs resposta real
-> Integration Gate V0
```

## 9. Rollback

Se o runtime falhar:

1. reverter wrangler.jsonc para assets-only;
2. remover main/run_worker_first;
3. manter schema extcalc_*;
4. revogar EXECUTE da RPC nova se necessario;
5. frontend continua operando por fixture, sem quebra de produto.

Nenhuma regra de dominio depende da existencia do runtime.
