# EXTERNAL CALC — PRODUCT EXECUTION AUTHORITY GATE V0

Data: 19/09/2026
Status: IMPLEMENTATION CANDIDATE
Entrada: G4 verde + BACKEND_INTEGRATION_READY=true + Frontend Integration Gate V0 bloqueado por authority boundary.

## 1. Problema provado

A API V0 aprovada aceita um request completo de Service V0.

Esse formato inclui:

- c01_candidate;
- calculation_profile;
- research_profile;
- indicator_profile;
- Evidence[];
- as_of.

Esse formato e adequado para prova de Service/API, mas nao pode ser o contrato direto do browser.

Se o frontend construir esse bundle, o browser passa a carregar entradas que alteram C01-C04.

Isso viola:

```text
frontend not authority
zero regra C01-C05 no frontend
```

## 2. Objetivo desta fatia

Criar uma camada de autoridade antes do Application Service existente:

```text
browser command
    |
    v
Authority Resolver V0
    |
    +--> C01 persistido
    +--> calculation profile server-side
    +--> research profile server-side
    +--> indicator profile server-side
    +--> Evidence[] trusted source
    +--> as_of server clock
    +--> market context server-side
    |
    v
Application Service V0 existente
    |
    v
Service V0 existente
    |
    v
C02 -> C03 -> C04 -> C05
```

Nenhum contrato C01-C05 e reimplementado.

## 3. Comando permitido ao browser

V0:

```json
{
  "analysis_id": "...",
  "offer_id": "...",
  "offer_revision": 1
}
```

Nada mais e aceito pelo Authority Resolver V0.

## 4. Campos de autoridade proibidos no browser

- tenant_id
- execution_id
- run_ids
- c01_candidate
- calculation_profile
- research_profile
- indicator_profile
- evidence
- as_of
- auth_context
- service_result
- persisted_at

A verificacao e recursiva.

## 5. C01 authority

A fonte Postgres consulta:

`public.extcalc_offer_revision`

por:

- tenant_id derivado da autenticacao;
- analysis_id;
- offer_id;
- offer_revision.

O snapshot C01 precisa corresponder exatamente a referencia pedida e continuar:

- execution_status = SUCCEEDED;
- domain_outcome = VALID;
- freshness_status = CURRENT.

O browser nao cria revision nem fingerprints.

## 6. Profile authority

Os profiles V0 nao entram no repositorio frontend.

A fonte server-side aceita configuracao apenas pelo runtime confiavel:

- EXTCALC_CALCULATION_PROFILE_JSON
- EXTCALC_RESEARCH_PROFILE_JSON
- EXTCALC_INDICATOR_PROFILE_JSON
- EXTCALC_MARKET_CONTEXT_JSON

Esta fatia NAO promove fixtures de teste a configuracao comercial de producao.

Ausencia de profile server-side deve bloquear a execucao, nunca fazer fallback para valores do browser.

## 7. Evidence authority

A fonte V0 le snapshots existentes de:

`public.extcalc_evidence`

sob RLS do tenant autenticado e deduplica por evidence_id.

Essa fonte nao cria elegibilidade, mediana ou price signal.

C03 continua sendo a unica autoridade de elegibilidade.

A ausencia de evidence pode resultar legitimamente em INSUFFICIENT_DATA.

Integracao com provider de pesquisa real continua sendo uma fatia separada.

## 8. Server time

`as_of` vem do clock do servidor.

O browser nao pode retroceder/avancar o relogio para alterar freshness de Evidence.

## 9. Invariantes preservados

- Service V0 inalterado;
- C01-C05 inalterados;
- Persistence V0 inalterada;
- API V0 inalterada nesta fatia;
- Interpreter inalterado;
- Worker/Cloudflare inalterados nesta fatia;
- zero service_role;
- tenant continua derivado de JWT;
- run_ids continuam gerados pelo Application Service;
- snapshots persistidos continuam contendo o request efetivamente executado.

## 10. Prova de equivalencia

O gate compara:

```text
browser refs
-> Authority Resolver
-> Application Service
-> Service V0
```

contra:

```text
trusted full input
-> Service V0 direto
```

Com os mesmos IDs server-side, os outputs C02-C05 devem ser iguais.

## 11. Gate

`PRODUCT_EXECUTION_AUTHORITY_GATE_V0 = PASS` somente quando:

1. Service V0 continua verde;
2. Persistence V0 continua verde;
3. API V0 continua verde;
4. Runtime V0 continua verde;
5. browser command aceita somente analysis_id/offer_id/offer_revision;
6. C01 e carregado por fonte confiavel;
7. profiles nao podem vir do cliente;
8. Evidence[] nao pode vir do cliente;
9. as_of nao pode vir do cliente;
10. resolver + Application Service = Service direto para o mesmo input confiavel;
11. zero reimplementacao C01-C05;
12. scope diff isolado.

## 12. O que esta fatia ainda nao faz

Ela nao ativa automaticamente o novo caminho no Worker publicado.

Antes da ativacao de producao ainda precisam existir:

- configuracao server-side aprovada para os profiles;
- pelo menos um C01 autoritativo persistido para teste real;
- decisao sobre a fonte inicial de Evidence real;
- gate autenticado POST -> GET/reload pelo novo command reduzido.

Isso evita degradar o G4 verde enquanto a nova autoridade ainda nao tem dados reais.

## 13. Proximo gate apos PASS desta fatia

```text
AUTHORITY_RUNTIME_BINDING_GATE_V0
```

Objetivo:

- ligar Authority Resolver ao runtime;
- manter API thin;
- recusar full domain bundle vindo do browser;
- executar refs-only command com JWT real;
- provar POST -> persist -> GET/reload;
- so entao retornar ao Frontend Integration Gate V0.
