# EXTERNAL CALC — UNIVERSAL INPUT U0 GOVERNANCE GATE V0

Data: 2026-09-26  
Status: HUMAN APPROVED / CI PENDING  
Issue: #81

## Objetivo

Autorizar estruturalmente a futura camada Universal Input sem implementar comportamento funcional nesta fatia.

A fronteira aprovada permanece:

```text
Source
-> Universal Input
-> CanonicalDocument
-> Interpreter Core V1 FROZEN
-> C01
-> C02 / C03
-> C04
-> C05
```

## Escopo deste gate

Permitido:

- registrar ownership `UNIVERSAL_INPUT`;
- limitar o owner a `ferramentas/external-calc-universal-input/v1/**`;
- governar este documento;
- adicionar prova positiva e negativa do ownership;
- adicionar workflow dedicado ao U0;
- fazer o Proof Governance central observar futuras mudancas do Universal Input.

Proibido nesta fatia:

- implementar `CanonicalDocument`;
- implementar `FormatRouter`;
- implementar adapters;
- alterar Interpreter Core;
- alterar C01-C05;
- alterar Service, Persistence, API ou Runtime;
- alterar frontend;
- adicionar Docling;
- adicionar LLM.

## Invariantes

1. Arquivo fora de ownership continua falhando fechado.
2. O novo owner nao cobre paths semelhantes fora de `v1`.
3. Workflow do Universal Input permanece sob `WORKFLOW_GOVERNANCE`.
4. Nenhuma regra de produto, preco, condicao, variante ou oportunidade nasce nesta camada de governance.
5. O Interpreter Core continua congelado e independente.
6. P0 de preco permanece inalterado.

## Gate

`UNIVERSAL_INPUT_U0_GOVERNANCE = PASS` somente quando:

1. prova `prova_proof_governance_v1.js` continua verde;
2. prova `prova_universal_input_u0_ownership.js` retorna PASS;
3. mudanca em `ferramentas/external-calc-universal-input/v1/**` resolve para `UNIVERSAL_INPUT`;
4. path parecido, mas nao autorizado, continua em `STRUCTURAL_REVIEW_REQUIRED`;
5. workflow dedicado e o Proof Governance central ficam verdes;
6. diff permanece restrito ao governance.

## Proximo gate

Depois do merge deste U0:

```text
B1/B2/B3
CanonicalDocument schema
+ FormatRouter interface
+ TextAdapter
+ fixtures
+ tests
```

Sem CSV/XLSX no primeiro commit funcional e sem Docling/LLM.
