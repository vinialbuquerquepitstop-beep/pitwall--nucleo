# External Calc VS1 — Proposta de modelo de relações universal

**Estado:** arquitetura candidata, **não schema executável aprovado**. Owner: `INTERPRETER_CORE` + `UNIVERSAL_INPUT` + `LIST_INTAKE` sob Proof Governance; Core V1 permanece FROZEN até avaliação e unfreeze explícito.

## Constatação no código atual (main)
- `ferramentas/interpreter-core/v1/core.js`: `scoreRoles()` pontua papéis por **linha**, `segmentDocument()` os guarda, e `buildContextTrace()` mantém contexto herdável e limites. O motor dispõe de `trace`, mas ainda não possui objeto de **relação explícita** entre um candidato de preço e um conjunto de variantes associadas.
- `ferramentas/external-calc-universal-input/v1/canonical-document.js`: `blocks[]` possui tipos, células e `provenance.source_ref`; não há lista de `edges` nem grupos produto/variante no contrato V1.
- `ferramentas/external-calc-list-intake/v0/list-intake-api.js`: `expandColorVariants()` deduz cores próximas com janela de linha/contexto. Isso resolveu casos conhecidos, mas não garante generalização quando o preço precede cor, o produto muda de posição ou informações de condição aparecem após preços.
- `supplier-device-v0.schema.json` combina extratores baseados em enumerações lexicais; nomes novos não devem obrigar PR por fornecedor.

## Responsabilidade candidata (fora de C01)
```text
CanonicalDocument.blocks[] (com provenance)
  → SpanCandidates (money/model/color/capacity/condition + span)
  → BlockHypotheses (section/product/variant/note/contact)
  → AssociationEdges (from span → to block/variant, reason/score)
  → ConstraintResolver (no cross-product leakage, no contradictory prices)
  → ProposedOffer + Uncertainty + Full Lineage
  → C01 Review Queue / REVIEW_REQUIRED
```

## Contrato de hipótese (apenas representação, não API congelada)
```json
{
  "hypothesis_id": "synthetic-hyp-001",
  "document_ref": "doc:hash",
  "blocks": [{"id": "p1", "role": "product", "source_spans": ["line:12"]}],
  "spans": [
    {"id": "s_model", "type": "model", "raw": "iPhone 16 Pro", "source": "line:12"},
    {"id": "s_price", "type": "money", "minor": 650000, "source": "line:13"}
  ],
  "edges": [{"from": "s_price", "to": "p1", "relation": "unit_price", "source_spans": ["line:12","line:13"], "rule": "same_product_block", "alternatives": []}],
  "proposals": [{"model_span": "s_model", "price_span": "s_price", "decision": "PROPOSED_REVIEW"}]
}
```

## Restrições obrigatórias
1. Nunca associar atributo de um produto ao próximo sem prova de escopo; **nova âncora encerra contexto anterior**, salvo herança categorial explicitamente comprovada.
2. `price_span` com telefone, data, parcelas e valor mínimo de compra é **NON_OFFER**, não oferta C01.
3. Cor isolada sem preço não gera oferta comercial em `READY`; preço compartilhado com 2 cores gera 2 hipóteses com a mesma origem monetária e cores distintas.
4. Modelo/capacidade/display/RAM tratados como atributos separados; proibir inferência de `13"` como 13GB.
5. Incerteza com múltiplas associações materialmente válidas retorna alternativas + `REVIEW_REQUIRED`, não resolução arbitrária.
6. Nenhum campo sem `source_span` pode chegar à oferta revisada como fato, salvo atributos derivados explicitamente documentados.
7. IA pode sugerir edges sob contrato explícito, mas não promover sem validação de spans e Gate humano quando houver conflito.

## Contratos e impacto
- `Core`: proposta de um `resolveAssociations()` puro/determinístico, separado da lista de aliases.
- `CanonicalDocument`: propor extensão versionada só se `blocks + provenance` não forem suficientes para carregar spans/edges sem quebrar o V1; preservar compatibilidade e adapters.
- `C01`: recebe `ProposedOffer/trace` ou abstenção, sem regras de associação replicadas.
- `C02-C05`: **sem mudança** até C01 autoritativo passar; revisão humana invalida downstream pela versão.
- `Frontend`: apresenta a explicação, nunca vincula atributo em JS.

## Prova VS1 / antes de implementar
- Seed DEV conhecida: casos que confundem preço+cor, gênero de produto, contexto categorial e quantidade.
- **Contraexemplo**: 2 produtos, um preço isolado, cor de bloco anterior; o resolvedor deve abster-se, não inventar um vínculo.
- **Contraexemplo**: linha de telefone e valor mínimo de pedido entre produto e preço; nenhum dos valores comerciais incorretos pode gerar proposta.
- **Teste metamórfico**: embaralhar separadores, trocar ordem cor/preço e adicionar avisos não comerciais preserva o multiconjunto de ofertas; trocar preço muda exatamente uma oferta; trocar cabeçalho altera apenas seu bloco.
- Só depois selecionar estratégia de implementação (grafo de vínculos, span resolver, chunker ou combinação) com orçamento de complexidade e sem criar um Contract 06.

## Gate humano estrutural
A implementação que **alterar o Core FROZEN** exige PR próprio com diff de API e plano de compatibilidade; este documento é apenas a proposta, evitando mudança canônica silenciosa.
