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

---

## Checkpoint executado — VS1 estrutural em Shadow (21/10/2026)

**PR de implementação isolada:** #183, empilhado no PR metodológico #182. **Status: SHADOW IMPLEMENTED / CI PASS / C01 INTEGRATION NOT AUTHORIZED.**

O protótipo `ferramentas/external-calc-generalization/v0/segment-shadow.cjs` consome o `CanonicalDocument V1` existente (inclusive `provenance.source_ref`), sem modificar o contrato V1 nem o `Interpreter Core V1 FROZEN`. Retorna `sections`, `product_blocks`, `members` com papéis por linha e `unassigned`. Deliberadamente retorna `offers: []`; ele **não é um interpretador universal nem um resolvedor de preços**.

### Testes do slice (CI)
- DEV-A: **20/20 blocos** da referência independente de 20 blocos e 38 ofertas artificiais; associa as linhas de modelo, preço, cor e condição ao bloco correto, sem prometer extração de ofertas.
- DEV-B: **35/35 blocos** da referência independente de 35 blocos e 59 ofertas artificiais.
- Variações verificadas: categoria fictícia, nomes de modelo inéditos sem cadastro no motor, linhas com e sem emoji, marcação `Modelo:`, ordem preço/cor, preços mutados, telefones e avisos comerciais, duas âncoras adjacentes e abstenção quando não há evidência suficiente.
- 8 testes positivos/negativos; não há escrita em Supabase/Cloudflare, importação ao C01 nem alteração nas telas congeladas.
- A amostra de 20 blocos do baseline ainda reproduz a falha do interpretador produtivo em read-only: **33 ofertas esperadas, 25 candidatos, 3 matches estritos**. `CI do VS1 verde` não elimina essa falha.
- Testes usam **sementes DEV conhecidas**, portanto não constituem holdout sintético cego nem fornecedores naturais inéditos.

### Limites observados
- Modelos sem marcadores e sem atributos tipados podem virar `unassigned`: comportamento conservador, não prova de cobertura universal.
- Sem `AssociationEdges` não sabemos se a cor imediatamente seguinte e um preço pertencem à mesma variante, embora estejam no mesmo produto. Isso é assunto da VS2.
- Linhas incertas e contatos dentro de um bloco recebem papéis, mas nenhuma saída vira automaticamente oferta.
- A segmentação não substitui a validação do Core congelado nem o trabalho de isolamento de tenant, revisão e autorização.

### Próximo gate / VS2
Construir **resolver de vínculos como experimento separado e puro**, consumindo blocos e source spans da VS1, comparando com oracle independente e preservando abstenções. Só propor alteração da API do Core ou C01 após testes de regressão, prova de falso positivo e aprovação de unfreeze, nunca por simples contagem de ofertas.
