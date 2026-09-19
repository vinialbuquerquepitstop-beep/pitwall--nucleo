# EXTERNAL CALC — INTERPRETER GENERALIZATION GATE V1

Data: 2026-09-19
Status: EM VALIDACAO
Branch: `audit/interpreter-generalization-v1`

## Objetivo

Provar que o Interpreter Core V1 congelado generaliza para cargas reais que nao participaram do refinamento do corpus de promocao.

Este gate nao reabre o Core, nao altera regras semanticas e nao autoriza escrita operacional.

## Corpus

Corpus de promocao excluido:
`6c4d3491-f85b-4015-8393-9798ab1ce758`

O gate seleciona ate 3 outras cargas reais do mesmo tenant com `texto_bruto`, em modo somente leitura.

Se nenhuma carga heldout estiver disponivel, o gate deve ficar BLOCKED, nunca PASS por ausencia de dados.

## Regras

Para cada carga heldout:

1. executar o Interpreter Core V1 sem alteracao;
2. gerar o benchmark legado apenas como comparador;
3. aplicar os perfis de fornecedor externos ao Core;
4. exigir `PROMOTION_READY=true`;
5. executar a ponte C01 read-only;
6. exigir `C01_REAL_READONLY_GATE=PASS`;
7. exigir que todo candidato C01 tenha `supplier_id`;
8. nao imprimir o texto bruto da lista;
9. nao gravar no banco.

## Gate

```text
HELDOUT_LOADS >= 1
HELDOUT_FAIL = 0
GENERALIZATION_REAL_GATE = PASS
```

A seguranca de preco continua sendo P0. Uma lista pode produzir abstinencia/revisao; nao pode promover preco incorreto silenciosamente.

## Regra de refinamento

Se uma carga heldout falhar:

```text
falha real
  -> classificar causa
  -> criar fixture minima reproduzivel
  -> provar que a correcao e generica
  -> rodar regressao completa
  -> rodar corpus de promocao
  -> rodar heldout novamente
```

Nenhuma regra nova entra diretamente no Core apenas para fazer uma lista especifica passar.

## Saida esperada

O gate responde apenas se o Core congelado generaliza com seguranca para dados reais novos. Ele nao mede qualidade de UX, C02, Research, Price Signal ou Decision Output.
