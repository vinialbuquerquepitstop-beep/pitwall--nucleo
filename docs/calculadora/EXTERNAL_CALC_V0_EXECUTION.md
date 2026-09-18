# EXTERNAL CALC V0 — EXECUTION BASELINE

Status: INICIADO
Data: 2026-09-17

## Objetivo

Transformar a calculadora da Pitwall em um produto externo utilizável o quanto antes, preservando o motor atual e evoluindo por gates.

Fluxo-alvo da primeira beta externa:

```text
lista do fornecedor
→ interpretação
→ cálculo
→ pesquisa
→ indicador de preço
→ evidências
→ histórico
```

A meta operacional é chegar ao ponto em que um usuário externo receba um link, entre, cole sua lista e consiga concluir o fluxo sozinho.

## Baseline oficial

Repository:
`vinialbuquerquepitstop-beep/pitwall--nucleo`

Baseline commit R2:
`d7692302778510bc80c95ce490579371fedc3782`

Branch de preservação oficial R2:
`backup/external-calc-baseline-2026-09-17-r2`

Backup histórico R1:
`backup/external-calc-baseline-2026-09-17`

Branch de execução:
`feat/external-calc-v0`

Origem do baseline:
`feat/calculadora-interpretador-real-shadow-v0`

Observação:
A linha `real-shadow-v0` estava 16 commits à frente de `feat/calculadora-interpretador-offer-expansion-v1` na abertura do processo e avançou mais 1 commit durante a preparação do baseline. O External Calc foi sincronizado com o R2 para não perder essa correção posterior.

## Regras de segurança da execução

1. Não alterar `main` diretamente.
2. Não aplicar migration, escrita em produção ou alteração Supabase como parte do baseline.
3. Não expor secrets no frontend, Git, logs ou documentação.
4. Mudanças externas de autenticação, autorização, tenant isolation, storage e dados só passam com testes de segurança.
5. Toda mudança relevante deve registrar:
   - MUDANÇA PROPOSTA
   - MUDANÇA APLICADA
   - branch
   - arquivos
   - objetos de banco afetados
   - testes
   - deploy
   - risco residual
   - rollback
6. Erro encontrado por usuário externo deve virar fixture + benchmark + teste permanente.
7. Nenhum deploy externo é autorizado sem gate positivo.

## Pipeline oficial

```text
01  BACKUP / BASELINE
        ↓
02  INTERPRETER V1
        ↓
03  GATE — Interpreter Ready
        ↓
04  CALC SERVICE / fronteira do Core
        ↓
05  GATE — Core consumível
        ↓
06  RESEARCH ENGINE V0
        ↓
07  PRICE INDICATOR V0
        ↓
08  GATE — Research + Price Ready
        ↓
09  FRONTEND BETA RESET
        ↓
10  GATE — Usabilidade
        ↓
11  AUTH + ORGANIZATION + HISTÓRICO
        ↓
12  SEGURANÇA / ISOLAMENTO
        ↓
13  GATE — External Data Safety
        ↓
14  TESTE DO USUÁRIO ZERO
        ↓
15  GATE — External Beta
        ↓
16  STAGING
        ↓
17  EXTERNAL BETA CONTROLADO
```

## Gate 01 — Backup / Baseline

Critérios:

- [x] identificar a ponta mais avançada do interpretador
- [x] registrar SHA exato e reconciliar avanço concorrente da branch-base
- [x] criar branch de backup
- [x] criar branch exclusiva do External Calc
- [x] manter `main` sem alteração
- [x] manter produção/Supabase sem alteração
- [ ] registrar prova automatizada do baseline na branch do External Calc

Status: **EM EXECUÇÃO**

O Gate 01 só será fechado após existir prova automatizada reproduzível do baseline.

## Próximo passo imediato

Executar a suíte existente do interpretador no próprio GitHub Actions a partir de `feat/external-calc-v0`, sem tocar em produção.

Suite mínima esperada:

- `prova_core.js`
- `prova_apple_domain.js`
- `prova_shadow_comparator.js`
- `prova_divergence_analyzer.js`
- `prova_offer_expansion_v1.js`
- `prova_real_shadow_semantic.js`
- benchmark real quando a fixture/carga necessária estiver disponível de forma segura

Resultado necessário para fechar Gate 01:

```text
baseline preservado
+
testes automatizados verdes
+
nenhuma escrita operacional
+
rollback explícito
```

## Rollback

Rollback estrutural oficial:
`backup/external-calc-baseline-2026-09-17-r2`

Rollback SHA oficial:
`d7692302778510bc80c95ce490579371fedc3782`

Rollback histórico R1:
`backup/external-calc-baseline-2026-09-17` / `fca19fe5c6281a03ae98401da00589b1b6c60683`

## Registro de mudança

### MUDANÇA PROPOSTA

Criar a trilha isolada do External Calc a partir do estado mais avançado do interpretador, sem modificar a operação atual.

Agent: ChatGPT
Change-Scope: Git branches + documentação de execução
Human-Approval: pedido explícito para iniciar o processo External Calc

### MUDANÇA APLICADA

- criada `backup/external-calc-baseline-2026-09-17`
- criada `feat/external-calc-v0`
- R1 preservado em `fca19fe5c6281a03ae98401da00589b1b6c60683`
- detectado avanço concorrente de 1 commit em `real-shadow-v0`
- criado baseline R2 em `d7692302778510bc80c95ce490579371fedc3782`
- `benchmark_real_load.js` sincronizado com o R2
- `main` não alterada
- banco/produção não alterados
- próximo gate: prova automatizada do baseline
