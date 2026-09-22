# EXTERNAL CALC — COLOR SYMBOL CANONICAL VOCABULARY V1

Data: 22/09/2026
Status: IMPLEMENTATION CANDIDATE

## Regra aprovada

Em listas de fornecedores, referencias de cor na mesma linha de um modelo reconhecido sao dado operacional de disponibilidade.

Exemplo real:

```text
📲IPHONE 16 PRO MAX 256 ⚪️ (gold) ⚫️
R$4.999/BATERIA🔋🟰92%
```

representa o mesmo modelo/armazenamento/preco com tres cores disponiveis:

- Silver
- Gold
- Preto

## Canonicos V1

```text
⚪ / White / Branco / Silver / Prateado -> Silver
⚫ / Black / Preto -> Preto
🟡 / Gold / Dourado / Amarelo -> Gold
🔵 / Blue / Azul -> Azul
🟢 / Green / Verde -> Verde
🔴 / Vermelho -> Vermelho
🟠 / Orange / Laranja -> Laranja
🩷 / Rosa -> Rosa
```

## Escopo de emoji

Emoji/simbolo de cor so e extraido quando a mesma linha contem um candidato de modelo reconhecido.

Isso evita interpretar como cor:
- 🔥
- 🔋
- 📲
- emojis soltos fora de um anchor de produto.

## Multiplas cores

Se uma linha de modelo contem N cores distintas e o preco pertence ao mesmo bloco, o Interpreter pode emitir N disponibilidades mantendo:

- mesmo model.id;
- mesmo capacity_gb;
- mesmo preco;
- mesma condicao;
- uma cor canonica por record.

## Uma cor

Se a linha do modelo contem uma unica cor e o preco vem imediatamente depois, a cor pode ser pareada ao preco somente quando o schema permite o anchor `model`.

## Aprendizado

Simbolos/aliases ainda desconhecidos nao sao promovidos automaticamente.

Fluxo:

```text
Review EDIT
→ Learning Candidate PROPOSED
→ Promotion Gate
→ Schema/Knowledge versionado
```

## Gate

PASS quando:

1. Core permanece agnostico de Apple/cores;
2. literal_value_map e generico por schema;
3. extractor de emoji exige model na mesma linha;
4. ⚪ + gold + ⚫ gera exatamente Silver, Gold e Preto;
5. um 🔵 no model anchor chega ao preco adjacente;
6. White/Branco/Silver/Prateado convergem para Silver;
7. Gold/Dourado/Amarelo/🟡 convergem para Gold;
8. emojis decorativos nao viram cor;
9. no_silent_wrong_price permanece verde;
10. corpus real permanece auditado antes de promocao.
