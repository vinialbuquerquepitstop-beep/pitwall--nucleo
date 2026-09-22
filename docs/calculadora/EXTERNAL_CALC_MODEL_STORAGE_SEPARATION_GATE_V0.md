# EXTERNAL CALC — MODEL / STORAGE SEPARATION GATE V0

Data: 22/09/2026
Status: IMPLEMENTATION CANDIDATE

## Problema observado

Na Screen 03, o modelo aparecia como:

```text
Modelo: iPhone 15 128GB
Armazenamento: 128
```

Isso duplica o mesmo atributo em dois campos materiais diferentes.

## Regra canonica

O produto separa:

```text
model = familia/variante do aparelho
capacity_gb = armazenamento
```

Exemplos:

- iPhone 15 + 128 GB
- iPhone 15 Pro Max + 256 GB
- iPhone 17 Air + 256 GB

Termos como Pro, Pro Max, Plus, Air e e pertencem ao modelo.
128/256/512 GB e demais capacidades pertencem exclusivamente a `capacity_gb`.

## Identidade tecnica

A separacao visual/semantica NAO remove capacidade da identidade tecnica.

Exemplo:

```text
entity id: iphone_15_128gb
technical label: iPhone 15 128GB
display_label: iPhone 15
capacity_gb: 128
```

O resolver continua distinguindo variantes por entity id/alias.
O C01 projeta `display_label` para `interpreted_offer.model.label`.

## Fingerprints

`offer_identity_fingerprint` continua usando `model.id` e `capacity_gb`.

Assim, iPhone 16 128 GB e iPhone 16 256 GB podem ter o mesmo display model `iPhone 16`, mas continuam ofertas tecnicamente distintas.

## Limites

Este gate nao:
- altera precos;
- altera C02-C05;
- remove capacidade do entity id;
- muda aliases de resolucao;
- cria regra no frontend;
- reescreve candidates antigos imutaveis.

## Gate

PASS quando:

1. todo model entity Apple possui `attributes.display_label`;
2. `display_label` nao repete capacidade;
3. `capacity_gb` continua inteiro no entity;
4. C01 usa `display_label` como `model.label`;
5. model.id tecnico permanece inalterado;
6. 128 GB e 256 GB da mesma familia continuam fingerprints distintos;
7. Review Evidence/trace preserva a resolucao tecnica original;
8. nenhuma regra de apresentacao e duplicada no frontend;
9. suites C01/Interpreter permanecem verdes.

## Efeito esperado na Screen 03

```text
Modelo
iPhone 15

Armazenamento
128 GB
```
