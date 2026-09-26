# EXTERNAL CALC — PROOF GOVERNANCE V1

Status: IMPLEMENTATION CANDIDATE — exige CI verde antes de PASS.

## Problema observado
Os gates de escopo antigos protegiam corretamente fatias isoladas, mas parte da delegacao foi codificada por nomes historicos de branch. O PR #45 demonstrou que uma evolucao legitima cross-slice (C01 Review + Runtime) podia manter as provas funcionais verdes e ainda falhar apenas porque a nova branch nao estava em uma allowlist historica.

## Regra V1
Branch name nao constitui autoridade arquitetural. O changeset deve ser classificado por ownership de arquivos. Arquivo sem ownership conhecido falha fechado como STRUCTURAL_REVIEW_REQUIRED.

## Fluxo
CHANGESET -> SCOPE CLASSIFICATION -> OWNERSHIP RESOLUTION -> REQUIRED PROOFS -> GATE ADJUDICATION.

## Invariantes
- nenhuma regra C01-C05 e relaxada;
- nenhum teste funcional e removido para obter verde;
- security boundaries continuam independentes;
- cross-slice exige a uniao das provas acionadas pelas superficies alteradas;
- arquivo desconhecido nao recebe autorizacao implicita;
- canon de dominio nao e alterado por esta correcao.

## Gate
PROOF_GOVERNANCE_V1 so pode ser declarado PASS quando:
1. prova positiva cross-slice passa;
2. prova negativa de arquivo sem ownership bloqueia;
3. workflows afetados deixam de depender do nome da branch para autorizar escopo;
4. regressao funcional permanece verde;
5. PR #45 fica verde sem excecao especifica para o nome da branch.


## Addendum 2026-09-26 — Universal Input

Abertura do Chat B confirmou uma nova superficie estrutural antes de C01: Universal Input.

Decisao humana aprovada:
- owner explicito `UNIVERSAL_INPUT`;
- escopo limitado a `ferramentas/external-calc-universal-input/v1/**` e ao gate documental U0;
- workflow da nova superficie continua sob `WORKFLOW_GOVERNANCE`;
- qualquer path semelhante fora de V1 continua falhando fechado;
- nenhuma regra C01-C05, Interpreter, runtime ou frontend e alterada no U0.

O gate especifico esta em `EXTERNAL_CALC_UNIVERSAL_INPUT_U0_GOVERNANCE_GATE_V0.md`.
