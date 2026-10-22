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
