# External Calc — VS3: Incertidão, proveniência e revisão humana

**Estado:** implementação experimental na branch `feat/external-calc-vs3-uncertainty-review-shadow-20261021`, PR #185, empilhado nos PRs #182–#184. **Não é uma alteração canônica de C01 nem liberação de produção.**

## Hipótese

O sistema não pode considerar uma proposta segura só porque tem preço e cor aparentes. Cada campo material precisa corresponder a uma linha verdadeira dentro do bloco do produto, não pode possuir relações contraditórias, e nenhum resultado passa a `READY` automaticamente.

## Fluxo linear

```text
CanonicalDocument V1 → VS1 Product Blocks → VS2 ProposedOffer+Edges
                                               ↓
                                  VS3 Provenance and Uncertainty
                                               ↓
                      REVIEW_REQUIRED / CRITICAL + motivos e source_refs
                                               ↓
                             Decisão humana fora deste módulo
```

**Restrições:** `authorized_offers=[]`, `auto_approvable_count=0`, `decision=REVIEW_REQUIRED`; não persistir, publicar, precificar, completar dados ausentes ou executar C02–C05.

## Verificações VS3 implementadas
- Envelope VS1/VS2 com hash do CanonicalDocument, IDs únicos, blocos de produto existentes e nenhuma oferta operacional.
- Referências de modelo, preço, cor e condição vinculadas a linhas do **mesmo bloco**.
- Presença das arestas estruturais esperadas: `product`, `variant_color`, `unit_price`.
- Evidência material de valor: preço, cor e condição declarados devem estar presentes no texto de origem, e não só apontar para qualquer linha válida.
- Sinalização de linhas materiais sem bloco, abstenções e conflitos de condição/preço. Falhas críticas permanecem visíveis e exigem revisão.
- Nenhuma decisão `READY` ou autopromoção é permitida; a VS3 não contém mecanismo para aprovar uma oferta.

## Classes de erro avaliadas

| Tipo | Tratamento |
|---|---|
| Campo/valor sem linha correspondente | `CRITICAL` |
| Atributo associado a outro produto | `CRITICAL` |
| Falta de aresta estrutural | `CRITICAL` |
| Tentativa de promoção automática | `CRITICAL`, oferta não autorizada |
| Condição ou preço contraditório | Abstenção material; revisão obrigatória |
| Múltiplas cores com preço não atribuído | Abstenção material |
| Produto/atributo sem bloco | Risco global `UNASSIGNED_MATERIAL_SOURCE` |
| Proposta sem conflitos detectados | `REVIEW_REQUIRED`, não `READY` |

## Limites honestos
A VS3 **não** consegue comprovar `zero erros silenciosos` apenas validando evidências internas. Uma interpretação equivocada também pode estar ancorada em texto existente; é necessária avaliação contra oracle independente, variedade sintética não vista e, no futuro, fornecedores reais inéditos. Uma taxa de abstenção excessiva também pode tornar o produto inutilizável: cobertura e risco devem ser medidos conjuntamente no VS4.

O relatório **não declara** `critical_silent_errors=0`; esse campo só pode ser calculado por avaliação externa independente.

## Gate e próximo movimento
- `VS3_IMPLEMENTED`: sujeito ao CI da branch #185.
- `VS3_PROOF`: testes de falsificação, conflito, abstenção e não promoção.
- `VS4`: medir generalização composicional e calibrar taxa de abstenção versus associações erradas em novas famílias de documentos.
- `C01_OPERATIONAL`: `NO-GO`, sem integração e sem alterações em Supabase, Cloudflare, tenant, Core V1 FROZEN ou frontend.
