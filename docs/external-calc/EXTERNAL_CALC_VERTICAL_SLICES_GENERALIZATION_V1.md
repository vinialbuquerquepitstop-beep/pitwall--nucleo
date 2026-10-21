# External Calc — Vertical Slices de Generalização V1

**Status:** plano específico do External Calc, aprovado como direção de processo (20/10/2026). Não sobrepõe telas congeladas nem o método global Tree.

## Regra de verticalidade
Uma fatia deve atravessar `texto original → token/estrutura → associação → oferta C01 + proveniência → avaliação read-only` e entregar prova que o dono possa abrir. **Não** é fatia "adicionar regex para uma lista". A fronteira de arquitetura e os testes de aceitação vêm **antes** do patch.

| Slice | Hipótese falsificável | Mudança candidata | Prova independente | Saída permitida |
|---|---|---|---|---|
| VS0 Contrato da avaliação | nosso golden pode esconder erros quando só conta ofertas | gerador + oracle independente + diff por campo e spans | mesmo número com preço trocado deve reprovar; número de telefone não vira oferta | baselines, nunca release |
| VS1 Segmentação | novo layout pode ser dividido sem termos de fornecedor | papéis/limites de bloco e metadados no CanonicalDocument/Interpreter | seções e cabeçalhos inéditos, ordem mista; sem produto fantasma | blocos com evidência |
| VS2 Associação produto-atributo | variantes/preços desordenados mantêm vínculo inequívoco | resolver relações de contexto (não aliases locais) | permutar preço/cor, dividir linhas, preço comum; nenhuma contaminação de bloco | ofertas C01 candidatas |
| VS3 Incertidão e revisão | ambiguidade e omissão são explícitas e auditáveis | classe de erros + `REVIEW_REQUIRED` + candidate trace | preço ausente, preço contraditório, modelo incerto, não inventar | revisão humana |
| VS4 Generalização composicional | correções sobrevivem a formatos combinados e não vistos | refinamento por classes de falha, preservando API | seeds e famílias novas pré-registradas; suite de regressão antiga | `SYNTHETIC_GENERALIZATION_PASSED` somente com provas |
| VS5 Produto E2E | integração preserva C01 no ciclo completo | adapter → revisão → cotação → simulação → histórico | tenant + perfis + mobile; fonte e SHA únicos | candidato a beta isolado |
| VS6 Externo cego | comportamento independe dos exemplos sintéticos | nenhuma regra após congelar sem invalidar holdout | fornecedor natural nunca visto + adjudicação externa | gate de beta controlado |

### Definition of Done por slice
1. Mudança guiada por hipótese estrutural, testável com contraexemplos. `WHY` e `OWNERSHIP` explícitos.
2. Fixture DEV e cenário negativo onde uma associação **plausível porém errada** teria sido aceita.
3. Oracle gerado sem consumir saída do interpretador; candidatos comparados por campos + lineage.
4. Executar regressões de famílias anteriores e pelo menos uma avaliação nova antes de chamar PASS.
5. Comparar precisão, recall, abstinência e gravidade de erros; nunca "58/58" isoladamente.
6. Provas versionadas pelo mesmo SHA, com artefatos, mensagens de falha e critérios.
7. Sem escrita em produção, sem mudança visual ou contrato executável silenciosa.
8. Owner valida execução visível quando o slice toca a interface.

### Orquestração linear e paralelismo
- **Linear estrito:** VS0 → VS1 → VS2 → VS3 → VS4 → VS5 → VS6. Não saltar VS0 para redesenho de parser.
- **Paralelo autorizado:** corpora sintéticos e UI de observação podem avançar sem alterar C01, respeitando congelamento de contratos.
- Não publicar patch de parser baseado em conteúdo do conjunto de avaliação "cego"; o teste deixa de ser cego assim que usado para corrigir.
- Se teste falhar, rotular `FAIL/UNVERIFIED`; não mover alvo, não trocar fornecedor fictício para obter verde.

### Evidência de prova (por slice)
`{ slice_id, sha_core, sha_schema, sha_input, generator_version, seed_commitment, corpus_partition, oracle_sha256, candidates, expected_offers, exact_offers, critical_silent_errors, review_required, lineage_mismatches, output_uri, human_signoff, decision }`.

### Relação com o método Tree
A abordagem Vertical Slice Real (Design Canônico → Fatia → Teste Operacional → Consolidação → Próxima Fatia) é preservada. Propõe-se **refinar o gate de prova do interpretador**, não mudar o canon global Tree automaticamente. Atualização transversal deve seguir proposta e gate humano específicos.
