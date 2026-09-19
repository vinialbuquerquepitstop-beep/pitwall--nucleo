# Handoff calculadora Pit Wall v24 - External Calc Lifecycle Persistence V0 integrado

19/09/2026. Substitui o v23 como topo vivo da linha calculadora.

Linguagem: prosa sem acento, sem cedilha, sem travessao.

## 1. Estado fechado

O Lifecycle / Persistence V0 do External Calc foi integrado ao main.

Merge:

- PR: #25
- merge squash: `6ec053cb1410b04a1a1568c44341630016dfcc45`
- branch de origem: `feat/external-calc-lifecycle-persistence-v0`

Migration aplicada no Supabase:

- version: `20260919202202`
- name: `external_calc_lifecycle_persistence_v0`

Arquivos principais:

- `supabase/migrations/20260919_external_calc_lifecycle_persistence_v0.sql`
- `ferramentas/external-calc-persistence/v0/lifecycle-repository.js`
- `ferramentas/external-calc-persistence/v0/prova_lifecycle_repository.js`
- `ferramentas/external-calc-persistence/v0/prova_lifecycle_schema.sql`
- `.github/workflows/external_calc_lifecycle_persistence_v0.yml`

## 2. Modelo de persistencia

Entidades materializadas:

- `extcalc_analysis`
- `extcalc_offer`
- `extcalc_offer_revision`
- `extcalc_human_review`
- `extcalc_execution`
- `extcalc_run`
- `extcalc_evidence`

C02, C03, C04 e C05 compartilham a tabela `extcalc_run`, diferenciados por
`contract_id`. Isso evita quatro schemas de banco quase identicos sem colapsar
a semantica dos contratos.

## 3. Regra central

O banco preserva:

- request original do Service;
- response original do Service;
- C01 snapshot;
- offer_revision;
- run ids;
- contract versions;
- engine versions;
- input fingerprints;
- output fingerprints;
- provenance refs;
- Evidence[];
- HumanReview;
- timestamps;
- tenant lineage.

O banco NAO:

- calcula preco;
- classifica market signal;
- decide eligibility de evidence;
- agrega regra de negocio;
- reinterpreta C01;
- recalcula C02-C05.

## 4. Gate local e CI

Resultado do workflow:

```text
Preserve Service V0                    PASS
Repository roundtrip checks=9          PASS
Migration boundary                     PASS
No domain changes                      PASS
```

Runs:

- push: `35467138150`
- PR: `35467196820`

A prova do Repository demonstrou:

```text
REQUEST ORIGINAL
=
REQUEST RECONSTRUIDO

SERVICE RESULT ORIGINAL
=
SERVICE RESULT RECONSTRUIDO
```

## 5. Prova de banco real

Antes da migration:

- zero tabelas `extcalc_*`.

Depois da migration:

- sete tabelas criadas;
- RLS habilitada nas sete;
- authenticated com SELECT apenas;
- zero INSERT/UPDATE/DELETE para authenticated;
- FKs apenas para `tenant` ou para o proprio dominio `extcalc_*`.

A prova transacional inseriu:

- 1 Analysis;
- 1 Offer;
- 1 OfferRevision;
- 1 HumanReview;
- 1 Execution;
- 4 Runs C02-C05;
- 1 Evidence.

Ela reconstruiu os snapshots esperados e terminou em ROLLBACK.

Estado medido depois:

```text
extcalc_analysis        0
extcalc_offer           0
extcalc_offer_revision  0
extcalc_human_review    0
extcalc_execution       0
extcalc_run             0
extcalc_evidence        0
```

Nenhum dado de prova ficou em producao.

## 6. Seguranca

Baseline de advisors antes da migration:

- 11 findings conhecidos de SECURITY DEFINER executavel por authenticated;
- leaked password protection desabilitado.

Depois da migration:

- os mesmos 11 findings;
- nenhum finding novo `extcalc_*`;
- nenhuma nova funcao SECURITY DEFINER;
- nenhuma escrita cliente-side aberta.

## 7. O que NAO entrou

- API V0;
- frontend;
- Auth / Organization do produto externo;
- endpoint publico;
- escrita via authenticated;
- mudanca no Interpreter;
- mudanca em C01-C05.

## 8. Estado canonico

```text
Interpreter Core V1              FROZEN
        |
       C01
        |
External Calc Service V0         PASS
        |
Lifecycle / Persistence V0       PASS
        |
Postgres extcalc_*               READY
```

## 9. Proximo passo

`External Calc API V0`.

Objetivo da proxima fatia:

```text
frontend/cliente
      |
     API
      |
Application Service
      |
Lifecycle Repository
      |
Service V0
      |
C02/C03/C04/C05
```

O primeiro gate da API deve provar que o fluxo pode ser executado sem colocar
regra financeira no endpoint e sem permitir que o cliente escolha `tenant_id`.
