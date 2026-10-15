# External Calc — Gate 1 / Reconciliação source-to-parser — 2026-10-15

**Status: IN_PROGRESS / NO-GO.** Continuação direta do plano V2.

## Evidência executada
- 68 linhas de origem anteriormente identificadas como sem referências nos dois parsers foram reorganizadas em uma matriz **privada** com arquivo, linha, texto, preço observado e sugestão de cabeçalho-pai por contexto. **62** têm valores numéricos e **6** somente marcador monetário sem valor.
- 18 casos golden continuam com referência existente, mas sem replay de saída real do backend main nesta etapa.
- O mapeamento automático de cabeçalho-pai é **hipótese**, não adjudicação humana. Nenhuma contagem de ofertas corretas, cobertura de produto ou precisão é autorizada.
- Geradas **10 propostas de regressão sintéticas** (filho cor-preço, preço→cor, troca de cabeçalho, blocos repetidos, acessórios, dinheiro sem quantia, fornecedor desconhecido, pontuação monetária, condição CPO e outlier). Ainda **NÃO executadas** contra o parser main.
- Os CSV de casos com textos/preços reais ficaram apenas como artefatos privados; não há textos/preços dos fornecedores neste repositório.

## Resultado honesto
**Linha comercial sem menção em provenance ≠ oferta certamente omitida.** Pode existir interpretação sem vínculo da linha correta. É necessário comparar a resposta real do backend e ground truth independente para medir erros silenciosos. Também não declarar 68/68 hashes de match se normalização de EOL não for controlada.

## Próxima atividade obrigatória
1. Adjudicar as 62 linhas (incluindo cabeçalho, preço, cor, região/condição) e os 18 golden com fonte real por bloco, classificando `VALIDATED`, `REVIEW_REQUIRED` ou `NON_OFFER`.
2. Reexecutar as duas vias do parser no mesmo SHA e montar diff por campo **e** por source lineage.
3. Transformar somente divergências reproduzidas em testes executáveis negativos/positivos; fazer correções genéricas sem hardcode de fornecedor.
4. Registrar métricas reais de falsos positivos, omissões e erros materiais antes de qualquer PASS.

**Sem mudança de parser/C01/frontend/deploy.**
