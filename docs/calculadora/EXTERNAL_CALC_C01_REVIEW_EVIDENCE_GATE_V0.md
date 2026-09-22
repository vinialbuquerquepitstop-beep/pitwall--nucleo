# EXTERNAL CALC — C01 REVIEW EVIDENCE GATE V0

Data: 22/09/2026
Status: IMPLEMENTATION CANDIDATE

## Problema observado

No primeiro roundtrip com entrada real, a Screen 03 recebeu o C01 candidate, mas o revisor humano nao conseguia ver as linhas originais usadas pelo Interpreter.

O candidate carregava `trace.sources`, porem apenas como numeros de linha. O texto bruto correspondente permanecia somente no `InterpretationBundle.segments`.

Revisao humana sem a evidencia original enfraquece a funcao de confirmar/corrigir C01.

## Decisao

Adicionar ao C01 candidate uma projecao somente de evidencia:

```json
{
  "review_evidence": {
    "record_id": "record-line-N",
    "source_lines": [
      { "line_number": 1, "raw": "..." }
    ],
    "field_sources": {
      "model": [2],
      "capacity_gb": [2],
      "condition": [1],
      "price": [3]
    }
  }
}
```

A fonte continua sendo o Interpreter:
- `InterpretationBundle.segments[].raw`;
- `record.trace[].sources`.

O C01 apenas projeta os trechos necessarios para review. Nao reinterpreta o texto.

## Limites

Este gate nao:
- altera regra C01-C05;
- altera Interpreter Core;
- recalcula campos;
- altera fingerprints;
- cria nova migration;
- cria nova API publica de input;
- decide Design System da Screen 03.

## Persistencia e lineage

`review_evidence` viaja dentro do mesmo snapshot imutavel do candidate.

Ao aplicar HumanReview:
- a evidencia permanece no C01 final;
- o candidate original permanece imutavel;
- a evidencia nao e autoridade para recalculo;
- ela e somente suporte auditavel para decisao humana.

## Gate

PASS quando:

1. Interpreter Core permanece inalterado;
2. candidate recebe linhas raw reais correspondentes a `trace.sources`;
3. linhas sao deduplicadas e ordenadas;
4. `field_sources` preserva a ligacao campo -> linhas;
5. ACCEPT/EDIT preserva `review_evidence`;
6. fingerprints e materialidade continuam iguais as regras atuais;
7. Candidate Persistence aceita o campo aditivo sem regra nova;
8. Review Result Persistence preserva o campo;
9. API continua apenas transportando o candidate;
10. Screen 03 passa a mostrar a evidencia antes da confirmacao humana.

## Evidencia que originou o gate

Entrada real usada no smoke:
- iPhone 15 128GB;
- contexto Lacrado;
- preco R$ 3.790;
- a linha do aparelho continha ainda o emoji de cor preta.

O Interpreter resolveu modelo/capacidade/condicao/preco e deixou cor sem resolucao. Isso demonstrou por que o revisor precisa enxergar a fonte original.
