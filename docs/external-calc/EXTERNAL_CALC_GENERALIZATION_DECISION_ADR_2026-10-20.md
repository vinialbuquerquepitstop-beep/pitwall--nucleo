# ADR — External Calc / substituir memória de layouts por generalização demonstrável

Data: 2026-10-20. Escopo: External Calc C01 / Universal Input / método de validação.

## Problema reproduzido
No laboratório read-only, Vértice começou com 49 de 58 candidatos e só passou após várias alterações ligadas ao caso. Uma variação Central Mix da **mesma referência de produtos e preços** produziu 40 de 58 candidatos e 3 ambiguidades de campo. O mecanismo "corrigir cada novo catálogo" estava otimizando treino/regressão, não generalização. O usuário declarou que todos os fornecedores de referência já foram vistos; não existe holdout natural disponível hoje.

## Decisão aprovada
1. Parar de usar "a última lista passou" como condição de passagem. Toda nova hipótese terá avaliação fora do conjunto que motivou o patch.
2. Introduzir corpus **sintético de fornecedores fictícios e estruturas combinatórias** independente da saída do parser; truth oracle criado junto com os dados artificiais, sem importação no produto.
3. Separar `TRAIN/DEV`, `REGRESSION`, `SYNTHETIC_EVAL`, `EXTERNAL_UNSEEN`. Uso de um caso para debug o move para regressão. Guardar semente de avaliação fora do repositório até a primeira rodada para reduzir leakage.
4. Auditar limites do Interpreter Core/CanonicalDocument antes de propor unfreeze; não "ensinar" fornecedores ou preços ao core por hardcode.
5. Resolução de vínculo e escopo é um problema de modelo de dados, não um catálogo de expressões.
6. Incerteza material vira `REVIEW_REQUIRED` e não dado presumido.
7. Permanecem C01–C05, autoridade server-side, separação Core/Product/Platform, regra de provenance, freeze visual e rollout seguro.

## Não decisões
- Não adotar LLM como autoridade única.
- Não afirmar que testes sintéticos equivalem a novos fornecedores reais.
- Não alterar `Interpreter Core V1 FROZEN` nesta ADR.
- Não criar banco novo, deploy pago ou mudar Supabase.
- Não invalidar resultados antigos ou ativar a quarentena sem autorização independente.

## Alternativas rejeitadas
- Continuar acrescentando regex até todos os exemplos conhecidos passarem: risco de overfit e regressão.
- Promover cada novo nome de fornecedor a um perfil: acoplamento e manutenção sem fim.
- Tratar 58/58 como sucesso operacional: ignora campos trocados, origem e casos que forçaram as regras.
- Autovalidar o parser pela saída que ele próprio gerou: circularidade.

## Evidência exigida para rever
Teste novo com semente oculta antes do run, erros por campo/associação, zero erro material silencioso no conjunto adjudicado, progresso também em corpus reformatado e validação externa quando existir. Falha mantém NO-GO.
