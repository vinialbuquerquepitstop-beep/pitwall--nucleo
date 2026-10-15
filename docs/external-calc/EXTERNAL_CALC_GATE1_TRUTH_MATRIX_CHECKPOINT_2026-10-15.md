# External Calc — Gate 1 — matriz de verdade / checkpoint 2026-10-15

Status: **IN_PROGRESS / NO-GO**. Baseline: código funcional `683999c31a2e3bb49ce3fd254dc8cc29d9f63d9e`. Matriz privada de revisão gerada fora do repositório.

## Escopo materializado
- **86 verificações**: 18 casos golden preexistentes e 68 linhas source-only.
- **68/68** linhas e arquivos TXT conferidos por SHA-256 com os anexos originais.
- Classes da auditoria source-only:
  - 38 `DEVICE_VARIANT_PRICE_UNREFERENCED`
  - 10 `PRODUCT_OR_ACCESSORY_PRICE_NONSTANDARD_LAYOUT`
  - 9 `ACCESSORY_VARIANT_OR_PACK_PRICE_SUPPLIER_UNRESOLVED`
  - 4 `ACCESSORY_PRODUCT_INLINE_PRICE_REPEATED_BLOCK`
  - 1 `ACCESSORY_PRICE_SEPARATE_LINE`
  - 6 `FALSE_MONETARY_MARKER_NO_AMOUNT`
- 18 golden herdados de `CALC_LISTAS_SP_GOLDEN_CASES_V1.json`, marcados como **referência existente; adjudicação independente e backend replay ainda pendentes**.

## Prova e limitações
- Os arquivos privados foram lidos **localmente** para criar uma matriz CSV de verificação com contexto; esse CSV **NÃO** deve ser enviado ao repositório, issues ou logs públicos.
- 62 linhas com valores comerciais **não equivalem a 62 ofertas distintas**. Sem adjudicação independente não se pode afirmar recall ou precisão por campo.
- A lista golden não equivale a verdade humana aprovada, e os casos ainda não foram reexecutados no backend main.
- Não houve escrita em C01, integração frontend, deploy, promoção shadow ou alteração de parser.

## Próxima ação estritamente dentro do Gate 1
1. Adjudicar campos essenciais (fornecedor, modelo, capacidade, cor, condição, preço, source anchor) dos 18 golden e 68 casos por contexto, assinando resultado `VALIDATED`, `REVIEW_REQUIRED`, ou `NON_OFFER`. Abster-se em vez de inventar fornecedor.
2. Executar backend read-only no mesmo SHA com essa referência *externa ao parser* e contabilizar erros de campo, silêncio, duplicação e omissão.
3. Gerar regressões **sintéticas e genéricas**, incluindo negativos, para classes que de fato falharem.
4. Provar novo resultado do parser na matriz antes de avançar ao Gate 2.

Gate 1: **não aprovado**, até evidência de zero erro comercial silencioso nos casos adjudicados e medição de cobertura real. Plano diretor: `EXTERNAL_CALC_PLANO_DE_CONVERGENCIA_V2.md`.
