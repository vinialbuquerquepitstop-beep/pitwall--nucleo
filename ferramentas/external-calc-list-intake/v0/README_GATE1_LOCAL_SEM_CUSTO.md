# External Calc — Gate 1 local, sem infraestrutura paga

**Estado:** ferramentas de homologação local para o PR #179. Não equivale a autorização de produção.

## O que será testado

Usa apenas o Docker Desktop **já instalado no computador** para criar um PostgreSQL 17 descartável e um executor Node 22. Os dois contêineres executam com `--network none` e sem publicação de portas. Não são usadas chaves, endpoints Supabase ou contas de nuvem.

A execução local valida:
1. Compilação da proposta SQL `GATE1_DB_AUTO_PROMOTION_GUARD_DRAFT.sql`.
2. Autenticação e isolamento **simulados**: ausência de usuário, papel indevido, tenant diferente, vinculação de fornecedor, identidade, preço, rastreabilidade e idempotência.
3. Instâncias sintéticas geradas pelos conversores reais TXT e Advisor, persistidas nesse PostgreSQL descartável.
4. Integridade estrutural do rascunho SQL.
5. **Opcional:** análise das listas TXT/CSV privadas de um diretório local, com extração C01 e conferência literal de preço por linha de origem, **sem gravar no banco e sem promover**.

No primeiro uso, o Docker poderá baixar as imagens públicas `postgres:17` e `node:22-alpine`. Não há cobrança adicional de hospedagem; consumo de recursos locais, internet e eventuais condições de licença do Docker dependem do ambiente do usuário.

## Executar no Windows

Abra o **PowerShell** na pasta raiz de uma cópia local do repositório `pitwall--nucleo` que contenha a branch `fix/external-calc-gate1-db-auto-promotion-guard-20261020`.

Para rodar a validação do banco **sem listas privadas**:

```powershell
.\ferramentas\external-calc-list-intake\v0\executar_gate1_local_sem_custo.ps1
```

Quando os 14 arquivos TXT originais estiverem em uma pasta no computador, execute:

```powershell
.\ferramentas\external-calc-list-intake\v0\executar_gate1_local_sem_custo.ps1 -CorpusDirectory "C:\ListasFornecedores"
```

Substitua o caminho por uma pasta que exista no computador. O script só lê diretamente os arquivos `.txt` e `.csv` da pasta, sem entrar em subdiretórios. Ele não cria, aprova nem envia fornecedores.

O relatório privado será criado em `Documentos\ExternalCalcGate1\corpus-local.json`, salvo exclusivamente no computador. Também é possível usar `-ReportPath "C:\pasta\relatorio.json"`.

Se o PowerShell bloquear exclusivamente a execução do script, prefira uma invocação **somente neste processo**, sem alterar a política global:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File ".\ferramentas\external-calc-list-intake\v0\executar_gate1_local_sem_custo.ps1" -CorpusDirectory "C:\ListasFornecedores"
```

## Leitura do resultado

- `EXTERNAL_CALC_GATE1_LOCAL_DB=PASS`: as simulações locais de proteção C01 e persistência passaram; **não é PASS do Gate 1 total**.
- `EXTERNAL_CALC_GATE1_OFFLINE_CORPUS_REPORT=PASS`: a leitura dos arquivos foi concluída. Confira `failed_files`, `total_candidates` e `exact_source_price_count` do JSON.
- `hypothetical_auto_eligible_count`: **simulação diagnóstica** com fornecedor hipoteticamente verificado; não indica fornecedor real verificado, não é promoção ou autorização de venda.
- Linhas `review_reasons` e `price_source_lines` ajudam a comparar com o gabarito privado original; **o gabarito golden não é inventado nem automaticamente validado**.

O relatório inclui nomes de arquivo, valores e modelos extraídos; trate-o como **privado** e não faça commit nem cole listas integrais nos PRs. Os contêineres e o arquivo SQL temporário de simulação são destruídos pelo script ao final, inclusive em falhas.

## Gate ainda pendente

**NO-GO** até confronto das 14 listas com as 18 referências golden / 62 linhas monetárias; validação independente de fornecedor; ensaio de autenticação/RLS completos em ambiente não produtivo; aceite humano. Um PostgreSQL simplificado e isolado não substitui as políticas reais do Supabase. O caminho local elimina o custo de uma branch paga, não reduz as exigências de prova.
