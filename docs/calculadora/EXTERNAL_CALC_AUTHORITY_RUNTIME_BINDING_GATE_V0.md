# EXTERNAL CALC — AUTHORITY RUNTIME BINDING GATE V0

Data: 19/09/2026
Status: IMPLEMENTATION CANDIDATE
Predecessor: PRODUCT_EXECUTION_AUTHORITY_GATE_V0 = PASS

## Objetivo

Ligar o Authority Resolver V0 ao runtime real sem alterar C01-C05, Service V0,
Persistence V0, API V0 ou Interpreter.

## Runtime alvo

```text
JWT
 |
 v
resolveIdentity
 |
 v
PostgresLifecycleRepository
 |
 +--> base Application Service V0
 |
 +--> PostgresAuthoritySource
        +-- C01: extcalc_offer_revision
        +-- Evidence: extcalc_evidence
        +-- profiles: server runtime config
        +-- market context: server runtime config
 |
 v
Authority Resolver V0
 |
 v
Authority-bound Application Service
 |
 v
API V0
```

## Browser command

A rota publicada continua:

`POST /api/external-calc/v0/execute`

Mas no runtime bound o body aceito pelo produto passa a ser somente:

```json
{
  "analysis_id": "...",
  "offer_id": "...",
  "offer_revision": 1
}
```

## Authority source

C01:
- carregado de public.extcalc_offer_revision;
- filtrado por tenant derivado do JWT + lineage;
- RLS de dono permanece ativa.

Evidence:
- carregada de public.extcalc_evidence;
- filtrada pela mesma lineage;
- deduplicada por evidence_id;
- C03 continua decidindo elegibilidade.

Profiles:
- EXTCALC_CALCULATION_PROFILE_JSON
- EXTCALC_RESEARCH_PROFILE_JSON
- EXTCALC_INDICATOR_PROFILE_JSON

Market context:
- EXTCALC_MARKET_CONTEXT_JSON

Nenhum desses valores vem do browser.

## Fail closed

Se profile server-side estiver ausente/invalido:

```text
request -> 400
zero fallback para valores do browser
zero persistencia
```

Se C01 nao existir ou nao estiver VALID/CURRENT/SUCCEEDED:

```text
request -> 400
zero Service execution
zero persistencia
```

## Preservado

- sem JWT -> 401;
- papel sem permissao -> 403;
- tenant_id do body -> 400;
- execution_id e run_ids continuam server-owned;
- service_role continua proibido;
- static assets continuam fora do API path;
- GET/reload continua devolvendo o request efetivamente executado;
- request persistido e o bundle server-resolved, nao o command do browser.

## Deploy

Este gate NAO dispara deploy.

O workflow Cloudflare G4 continua exigindo workflow_dispatch manual para deploy.
Portanto o Worker publicado nao muda apenas com merge desta fatia.

## PASS

AUTHORITY_RUNTIME_BINDING_GATE_V0 = PASS quando:

1. Service V0 PASS;
2. Persistence V0 PASS;
3. API V0 PASS;
4. Product Execution Authority V0 PASS;
5. Runtime V0 continua com 11 checks PASS;
6. refs-only command executa e persiste;
7. full domain bundle do browser e rejeitado;
8. C01/Evidence sao consultados por fonte autenticada;
9. round-trip GET devolve bundle resolvido;
10. zero service_role;
11. Wrangler dry-run PASS;
12. scope diff isolado.

## Apos o merge

Ainda nao fazer deploy ate resolver:

1. profiles server-side de producao aprovados;
2. C01 real persistido para prova autenticada;
3. criterio da fonte inicial de Evidence real.

Proximo gate:

`AUTHORITY_PRODUCTION_CONFIG_GATE_V0`

Depois:

`AUTHORITY_LIVE_ROUNDTRIP_GATE_V0`

Somente entao o Frontend Integration Gate V0 pode voltar de BLOCKED para live proof.
