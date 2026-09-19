# Handoff calculadora Pit Wall v23 - External Calc Service V0 integrado

19/09/2026. Substitui o v22 como topo da linha calculadora naquele ponto historico.

Linguagem: prosa sem acento, sem cedilha, sem travessao.

## 1. Estado fechado

O External Calc Service V0 foi integrado ao main como uma fronteira pura sobre o core pipeline canonico.

Merge:

- PR: #24
- merge squash: `57b3fa2d22828992b7cdba1f2dd22298c4568224`
- branch de origem: `feat/external-calc-service-v0`

Arquivos principais:

- `ferramentas/external-calc-service/v0/external-calc-service.js`
- `ferramentas/external-calc-service/v0/prova_external_calc_service_v0.js`
- `.github/workflows/external_calc_service_v0.yml`

## 2. Gate

O gate exigiu:

```text
C01 -> C05 pelo Service
=
C01 -> C05 executados diretamente

zero regra duplicada
zero acesso a banco
zero dependencia do frontend
zero alteracao no Interpreter
```

Resultado medido:

```text
C01 preservado                         PASS
C02 preservado                         PASS
C03 preservado                         PASS
C04 preservado                         PASS
C05 preservado                         PASS
Core Pipeline preservado               PASS
Service parity                         PASS
Service boundary                       PASS
Scope boundary                         PASS
```

O workflow de push e o workflow do PR passaram sobre o mesmo head
`f621f699aae5e8b8b6ad0d1621418acfe8cf6d22`.

## 3. Fronteira congelada

O Service V0:

- recebe C01 ja revisado e VALID;
- delega ao `external-calc-pipeline/v1/core-pipeline`;
- nao importa Interpreter;
- nao importa diretamente C02, C03, C04 ou C05;
- nao acessa banco;
- nao conhece frontend;
- nao cria regra propria de dominio.

## 4. O que NAO entrou

- persistencia;
- API;
- auth/organization;
- frontend;
- provider novo;
- mudanca no Interpreter;
- mudanca nos contratos C01-C05.

## 5. Proximo passo naquele ponto

`Lifecycle / Persistence V0`.

A regra era: persistencia registra fatos e lineage, mas nao decide resultado.
