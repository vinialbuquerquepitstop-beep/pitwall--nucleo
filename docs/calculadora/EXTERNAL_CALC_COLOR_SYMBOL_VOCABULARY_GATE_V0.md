# EXTERNAL CALC — COLOR SYMBOL VOCABULARY GATE V0

Data: 22/09/2026
Status: IMPLEMENTATION CANDIDATE

## Problema real observado

Em listas reais, fornecedores usam simbolos/emoji de cor como parte do dado da oferta.

Exemplo observado no roundtrip live:

```text
🔥 IPHONES SEMINOVOS 🔥
📲IPHONE 15 128GB ⚫️
R$2.550/ BATERIA 🔋 🟰100%
```

O Interpreter resolveu modelo, capacidade, condicao e preco, mas deixou `color = null`.

## Decisao

O Core recebe uma capacidade generica de mapeamento literal por schema:

`literal_value_map`

O Core NAO conhece iPhone, cores ou emojis especificos.

O schema Apple/iPhone define o vocabulario de simbolos de cor:

- ⚫ -> Preto
- ⚪ -> Branco
- 🔵 -> Azul
- 🟢 -> Verde
- 🟣 -> Roxo
- 🔴 -> Vermelho
- 🟡 -> Amarelo
- 🟠 -> Laranja

O variation selector visual de emoji e ignorado na comparacao literal.

## Limites de seguranca

Nao sao tratados como cor:
- 🔥
- 📲
- 🔋
- 💰
- 💵

O vocabulario global nao promove silenciosamente semantica especifica de fornecedor.

Exemplo:
- 🟡 globalmente significa Amarelo;
- se um fornecedor usa 🟡 para representar Gold, isso exige aprendizado revisado e promocao especifica, nao alteracao global automatica.

## Comportamento esperado

Uma linha:

```text
📲 iPhone 17 256GB Lacrado ⚫️ ⚪️ 🔵
R$ 5.299
```

deve produzir as cores disponiveis:
- Preto
- Branco
- Azul

mantendo o mesmo modelo/preco.

## Gate

PASS quando:

1. Core continua sem regra Apple/iPhone hardcoded;
2. `literal_value_map` funciona genericamente por schema;
3. ⚫️ na lista real resulta em Preto;
4. multiplos simbolos expandem multiplas cores;
5. emojis decorativos/status nao viram cor;
6. 🟡 nao vira Gold silenciosamente;
7. suite local completa do Interpreter permanece verde;
8. real-corpus promotion gate permanece verde;
9. zero regressao de silent wrong price;
10. Knowledge/Schema versioning permanece explicito.

## Relacao com aprendizado humano

Este gate apenas ensina o vocabulario ja conhecido e comprovado.

Correcoes humanas futuras devem gerar Learning Candidates. Elas NAO alteram o Interpreter automaticamente.
