# Handoff calculadora Pit Wall v25 - External Calc API V0 boundary integrada

19/09/2026. Substitui o v24 como topo vivo da linha calculadora.

Linguagem: prosa sem acento, sem cedilha, sem travessao.

## 1. Estado fechado

O primeiro gate da External Calc API V0 foi integrado ao main.

Merge:

- PR: #28
- merge squash: `072706a68e9ba07307951a974d572e8832453a6b`
- branch de origem: `feat/external-calc-api-v0`

Arquivos principais:

- `ferramentas/external-calc-api/v0/api-handler.js`
- `ferramentas/external-calc-api/v0/application-service.js`
- `ferramentas/external-calc-api/v0/prova_api_v0.js`
- `.github/workflows/external_calc_api_v0.yml`

## 2. Fronteira aprovada

A API V0 foi implementada em duas camadas.

### API Handler

Responsabilidades:

- reconhecer rota e metodo;
- autenticar;
- obter tenant do contexto autenticado;
- rejeitar campos de autoridade enviados pelo cliente;
- chamar o Application Service;
- serializar resposta.

O API Handler NAO:

- importa C01-C05;
- importa Service V0;
- importa Persistence V0;
- conhece Supabase/Postgres;
- conhece margem, calculo, price signal ou regra financeira.

### Application Service

Responsabilidades:

- receber tenant ja autenticado;
- gerar `execution_id` server-side;
- gerar run ids server-side;
- montar o request do Service;
- executar External Calc Service V0;
- entregar a execucao ao Lifecycle Repository.

O Application Service NAO:

- importa C01-C05 diretamente;
- conhece frontend;
- conhece Supabase/Postgres;
- reimplementa regra de dominio.

## 3. Autoridade do servidor

Campos reservados ao servidor sao rejeitados quando enviados pelo cliente, inclusive aninhados:

- `tenant_id`;
- `execution_id`;
- `review_id`;
- `persisted_at`;
- `run_ids`;
- `service_result`;
- `auth_context`.

O tenant utilizado na persistencia vem exclusivamente de:

```text
authenticate(request)
        |
        v
auth_context.tenant_id
        |
        v
Application Service
        |
        v
Lifecycle Repository
```

O cliente nao escolhe tenant.

## 4. Gate

Resultado dos runs no mesmo head `031f3e77240eb617838a9527acbd4ad122bc59b4`:

- push: `35467597283`
- pull request: `35467606978`

Ambos PASS.

Checks da API:

```text
Service V0 preservado                    PASS
Persistence V0 preservada                PASS
API V0                                   PASS checks=13
API thin boundary                        PASS
Server authority                         PASS
Scope boundary                           PASS
```

## 5. O que foi provado

O gate demonstrou:

```text
API -> Application Service -> Service V0
=
Service V0 executado diretamente
```

para os mesmos IDs gerados no servidor.

Tambem demonstrou:

- request autenticado executa e devolve C02-C05;
- request sem autenticacao recebe 401;
- usuario sem permissao recebe 403;
- `tenant_id` do cliente recebe 400;
- `tenant_id` aninhado recebe 400;
- run ids e execution id do cliente recebem 400;
- execucao persistida fica isolada por tenant;
- payload original do cliente nao e alterado;
- rota/metodo fora do contrato nao executam o fluxo.

## 6. Estado canonico

```text
Interpreter Core V1               FROZEN
        |
       C01
        |
External Calc Service V0          PASS
        |
Lifecycle / Persistence V0        PASS
        |
API V0 boundary                   PASS
```

A API ainda e transport-agnostic. Nao existe endpoint HTTP publicado nesta entrega.

## 7. O que NAO entrou

- runtime HTTP real;
- deploy de endpoint;
- Postgres adapter server-side;
- segredo/service role no frontend;
- frontend consumindo API;
- Auth/Organization definitivo do produto externo;
- alteracao em Interpreter;
- alteracao em C01-C05.

## 8. Proximo gate

`External Calc Runtime + Postgres Adapter V0`.

Objetivo:

```text
HTTP Runtime autenticado
        |
        v
API V0
        |
        v
Application Service
        |
        v
Lifecycle Repository
        |
        v
Postgres Adapter server-side
        |
        v
extcalc_*
```

Gate obrigatorio:

```text
request HTTP real
-> auth valida
-> tenant derivado no servidor
-> Service V0 executa
-> execucao persiste no Postgres
-> GET/reload reconstrui a mesma execucao
```

E simultaneamente:

```text
zero service role no frontend
zero escrita direta authenticated em extcalc_*
zero tenant_id vindo do body
zero regra C01-C05 no runtime
zero alteracao no Interpreter
```

Somente depois desse gate o frontend deve trocar fixture por chamada real.
