# External Calc — Synthetic generalization harness V0

**Objetivo:** criar documentos de fornecedores `LAB-` fictícios, com preços e modelos artificiais, junto a **um oracle montado antes de invocar C01**. Este pacote não corrige interpretação nem escreve no banco.

## Runbook DEV

```bash
node ferramentas/external-calc-generalization/v0/generate.mjs --seed dev-demo-north-0001 --profile dev --count 20 --output /tmp/extcalc-dev-001
node ferramentas/external-calc-generalization/v0/verify.mjs /tmp/extcalc-dev-001
node ferramentas/external-calc-generalization/v0/run-parser.mjs --source /tmp/extcalc-dev-001/supplier.txt --actual /tmp/extcalc-dev-001/actual.json
node ferramentas/external-calc-generalization/v0/compare.mjs --oracle /tmp/extcalc-dev-001/oracle.json --actual /tmp/extcalc-dev-001/actual.json --report /tmp/extcalc-dev-001/report.json
```

**Atenção:** `run-parser` executa o código real `buildQueue` de forma local read-only. CI gera a lista DEV e captura o baseline; falhas de fidelidade devem ser relatadas, não corrigidas com exceções da seed. `compare` verifica multiconjuntos de campos de oferta e proveniência de modelo e preço, emitindo `FAIL` se houver erro. Não confundir `compare` com uma avaliação semântica de linguagem natural completa.

## Protocolo challenge / avaliação

1. Congelar commit de Core + schema + list-intake e generator, junto com o plano, **antes** de conhecer a seed de avaliação.
2. Escolher seed de avaliação pós-freeze, sem reutilizar `dev-demo-`. Guardar seed fora de Git/issues/PR/log. O `manifest.json` mostra compromisso hash, não a seed.
3. `node generate.mjs --seed <seed_privada> --profile challenge --count 60 --output <pasta_local_privada>`.
4. `node verify.mjs <pasta>`; revisor independente inspeciona o oracle e corrige a **especificação/gerador**, não a saída do parser, quando encontra expectativa inválida.
5. Executar parser congelado **uma vez**, rodar compare, arquivar o primeiro relatório e hashes. O arquivo de desafio passa então a ser `KNOWN/REGRESSION`; a próxima avaliação requer seed nova.
6. Separar meta `SYNTHETIC_GENERALIZATION` de `EXTERNAL_UNSEEN`. Seeds novas do **mesmo gerador** testam recombinação, não equivalem a fornecedor real desconhecido ou domínio novo.
7. Não armazenar texto de fornecedores reais, chaves, tokens, dados pessoais ou catálogos comercialmente sensíveis em artefatos de CI.

## Evidências
- `supplier.txt`: texto bruto artificial (com formatação variada, cabeçalho, cores, preços compartilhados e distratores);
- `oracle.json`: `offer_count`, lista de ofertas construídas pelo gerador e `lineage` original;
- `manifest.json`: hashes SHA-256 e compromisso da seed;
- `actual.json`: somente se rodar `run-parser`;
- `report.json`: `exact`, `missing`, `unexpected`, `lineage_mismatches`, precisão, recall, decisão;
- `proof.mjs`: garante determinismo do gerador, integridade dos hashes e **negação** de preço adulterado.

## Limites
- O gerador V0 **não cobre** imagens, PDF, listas em tabelas complexas, unidades de caixa, contratos multimoeda, áudio nem variantes de atributos completamente desconhecidos. Criar planos de capacidade antes de incluir essas classes.
- O conjunto de produtos é artificial mas usa formas de modelos reconhecíveis. Uma seed nova não torna a família linguística verdadeiramente desconhecida: documentar isso explicitamente.
- Zero erro material silencioso no corpus sintético é necessário, mas não suficiente para liberar operação externa.
- `--output` não deve apontar para caminho versionado; os arquivos são derivados.


## VS1 — segmentação estrutural read-only

A etapa VS1 **não calcula ofertas**; ela devolve hipóteses de blocos e os papéis de cada linha a partir de `CanonicalDocument V1`.

```bash
node ferramentas/external-calc-generalization/v0/proof-vs1.mjs
node ferramentas/external-calc-generalization/v0/run-segmentation-shadow.mjs \
  --source /tmp/extcalc-dev-001/supplier.txt \
  --report /tmp/extcalc-dev-001/structural.json
```

O `structural.json` contém `sections`, `product_blocks`, `members`, `unassigned`, `source_ref`, `summary` e `offers: []`. Ele pode ser auditado por humanos **sem risco de alterar preços operacionais**. Contagem de blocos `PASS` não implica fidelidade de atributos ou aprovação do C01.

Este módulo é experimental e usa apenas indicadores estruturais de texto, **não um léxico privado de fornecedores**. Para outras tipologias, a ausência de âncora suficiente resulta em linha não atribuída, não em produto inventado. A integração ao C01 aguarda VS2 e gate humano sobre o Core V1 congelado.


## VS2 — resolver de atributos experimental

**Somente leitura, nunca C01 operacional.** A saída \`associations.json\` é \`SHADOW_READ_ONLY\`, com \`proposals[]\` sempre marcadas \`PROPOSED_REVIEW\`, \`edges[]\`, \`abstentions[]\` e \`offers: []\`. Nenhum fornecedor real, credencial ou dado de preço é gravado.

### Executar local/CI com fonte DEV sintética

\`\`\`bash
node ferramentas/external-calc-generalization/v0/generate.mjs --seed dev-demo-north-0001 --profile dev --count 20 --output /tmp/extcalc-dev
node ferramentas/external-calc-generalization/v0/verify.mjs /tmp/extcalc-dev
node ferramentas/external-calc-generalization/v0/run-association-shadow.mjs --source /tmp/extcalc-dev/supplier.txt --report /tmp/extcalc-dev/associations.json
node ferramentas/external-calc-generalization/v0/compare-vs2.mjs --oracle /tmp/extcalc-dev/oracle.json --shadow /tmp/extcalc-dev/associations.json --report /tmp/extcalc-dev/strict-vs2.json
node ferramentas/external-calc-generalization/v0/proof-vs2.mjs
\`\`\`

A comparação é restrita a modelo/capacidade/cor/condição/preço e linhas fonte. Ela reprova quantidade coincidente com campos divergentes, linhas de origem falsas e decisões de aprovação. **Não é resultado de um modelo de IA**: são provas sobre dados artificiais e regras determinísticas.

### Challenging sem memorização

O workflow \`external_calc_vs2_challenge_v0.yml\` congela o SHA no checkout e **só então** gera uma semente nova para o perfil \`challenge\`, em runner temporário. O primeiro resultado e os arquivos completos são preservados como artifacts por 14 dias, incluindo semente revelada após execução para replay. Um corpus revelado nunca será reutilizado como blind. Alterar o código aciona outra semente; não usar o novo PASS para esconder um FAIL anterior.

Os resultados da VS2 estão documentados em \`docs/external-calc/EXTERNAL_CALC_VERTICAL_SLICES_GENERALIZATION_V1.md\`: 1º desafio FAIL; duas amostras novas posteriores PASS. Isso **não** autoriza alterar Core V1 FROZEN, banco, C01, frontend ou release. O próximo gate é VS3 (uncertainty/review).
