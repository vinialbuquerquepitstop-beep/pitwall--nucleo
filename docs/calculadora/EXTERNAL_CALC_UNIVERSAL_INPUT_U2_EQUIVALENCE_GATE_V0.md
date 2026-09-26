# EXTERNAL CALC — UNIVERSAL INPUT U2 ADAPTER EQUIVALENCE GATE V0

Data: 2026-09-26  
Status: IMPLEMENTATION / CI PENDING  
Origem: Issue #81

## Objetivo

Provar que a introdução do Universal Input não altera a semântica do caminho já validado do Interpreter Core.

Contrato mestre:

```text
entrada antiga -> Core
vs
entrada -> Universal Input -> CanonicalDocument -> Core
```

P0 obrigatório:

```text
new_silent_wrong_price = 0
```

## Fronteira

O Interpreter Core V1 permanece congelado e continua recebendo `RawDocument v1`.

A convergência acontece fora do Core:

```text
Source
-> Adapter
-> CanonicalDocument V1
-> Canonical Interpreter Bridge V1
-> RawDocument v1
-> Interpreter Core V1
```

## Equivalência certificável nesta fatia

### TXT

`TextAdapter` reconstrói exatamente o conteúdo original.

Status alvo:

```text
LEGACY_EXACT_TEXT
```

### CSV

`CsvAdapter` reconstrói exatamente o conteúdo textual original.

Status alvo:

```text
LEGACY_EXACT_CSV
```

### XLSX

Não existe caminho legado binário XLSX contra o qual comparar semanticamente.

Portanto U2 **não** declara equivalência de XLSX.

O bridge deve falhar fechado para XLSX com:

```text
SEMANTIC_PROJECTION_NOT_EQUIVALENCE_CERTIFIED
```

B5 continua provando parsing/fidelidade XLSX. U3 deverá provar provenance crítica antes de qualquer ativação semântica adicional.

## Provas

### Local

Comparar semantic snapshot integral para casos:

- preço explícito inline;
- herança entre linhas;
- expansão de cores;
- CRLF;
- modelo desconhecido/abstenção;
- CSV textual.

Comparar também price signatures.

### Corpus real read-only

Usar a mesma carga privada congelada do Interpreter Ready Gate.

Comparar:

- records;
- ambiguities;
- invalid;
- learning proposals;
- warnings;
- métricas sem tempo;
- price signatures.

Nenhum conteúdo privado pode ser impresso.

## Gate

U2 somente passa com:

```text
U2_LOCAL_EQUIVALENCE = PASS
U2_REAL_CORPUS_EQUIVALENCE = PASS
new_silent_wrong_price = 0
B1-B5 regressions = PASS
INTERPRETER_LOCAL_GATE = PASS
PROOF_GOVERNANCE = PASS
```

## Não faz

- não altera Interpreter Core;
- não altera C01-C05;
- não ativa Universal Input em runtime/API;
- não escreve banco;
- não declara XLSX semanticamente equivalente;
- não adiciona IA;
- não substitui U3 provenance.
