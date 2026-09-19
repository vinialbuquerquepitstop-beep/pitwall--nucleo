# EXTERNAL CALC - G4 CLOUDFLARE DEPLOY RUNBOOK

Data: 19/09/2026

## Objetivo

Publicar a ultima infraestrutura do External Calc no Worker existente
`flat-resonance-09ba` sem criar Worker paralelo.

## Pre-condicoes

G1, G2 e G3 devem estar PASS no main.

O ambiente GitHub `external-calc-production` deve possuir:

- `CLOUDFLARE_API_TOKEN`
- `CLOUDFLARE_ACCOUNT_ID`

O token deve ter somente as permissoes necessarias para atualizar o Worker existente.

## Execucao

Usar o workflow manual:

`.github/workflows/external_calc_cloudflare_g4.yml`

Executar em `main` e informar exatamente:

`flat-resonance-09ba`

no campo de confirmacao.

O workflow:

1. confirma branch e nome do Worker;
2. reroda Service, Persistence, API e Runtime gates;
3. exige credenciais;
4. roda Wrangler dry-run;
5. publica pelo Wrangler;
6. prova API sem JWT = JSON 401;
7. prova `/calc/` = 200;
8. emite `BACKEND_INTEGRATION_READY=true`.

## Rollback

Se o deploy falhar antes da publicacao, nada muda no Worker.

Se a publicacao ocorrer mas o smoke reprovar:

1. nao ligar frontend a API;
2. reaplicar a ultima versao conhecida do Worker pelo mesmo canal;
3. se necessario, reverter `wrangler.jsonc` para assets-only e publicar;
4. a RPC e o schema podem permanecer, porque nao interferem no frontend enquanto a API nao e usada.

## Regra

O workflow e manual de proposito.

Merge em main NAO publica automaticamente a ultima infra.
A publicacao exige confirmacao explicita do alvo e credenciais do ambiente.
