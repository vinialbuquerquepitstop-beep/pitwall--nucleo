# EXTERNAL CALC — GATE 1 SEM DOCKER (fluxo preferencial)

**Decisão operacional:** o usuário optou por **não usar Docker** e **não aprovar custo de branch Supabase**. Portanto, não solicitar habilitação de virtualização na BIOS, instalação do Docker Desktop ou contratação de staging.

## Etapa 1 — Banco / código: evidência remota já existente

O GitHub Actions deste PR possui o job `postgres-integration`, com PostgreSQL 17 efêmero no runner do GitHub, além do job `structural`. O uso de um contêiner pelo runner remoto **não requer Docker nem virtualização no computador do usuário**.

Evidência anterior: workflow `External Calc Gate 1 - DB Guard Draft Structural`, run `39493195437`, `structural=PASS`, `postgres-integration=PASS` no commit `e605e92e023a18a6d423efec265faddba9c740fd`; e `External Calc - Batch Supplier Intake V0`, run `39493195230`, PASS. São testes sintéticos, não prova de autoria ou veracidade da lista original. A disponibilidade/limites de minutos do GitHub Actions dependem da conta; **não iniciar novas execuções sem necessidade**.

**Nenhuma execução de produção**: não fazer merge dos PRs #178/#179, não executar migrations no Supabase e não usar `Deploy existing Worker`. Jobs de empacotamento Cloudflare podem ter PASS com etapa real de deploy SKIPPED; não interpretar como implantação.

## Etapa 2 — Corpus privado: conferência assistida nesta conversa

A próxima evidência exigida é comparar as **14 listas TXT originais**, **18 casos golden** e **62 linhas monetárias adjudicadas**, sem fixtures sintéticas.

O usuário pode **anexar os TXT ou um ZIP diretamente à conversa com ChatGPT**, caso aceite que o conteúdo seja enviado para a conversa. Não precisa ter `pitwall--nucleo` instalado no PC, executar Git/PowerShell/Node ou abrir Docker. NÃO copiar dados privados em issues, PRs, commits ou artefatos públicos do GitHub.

A conferência assistida deve:
1. Manter cada lista original inalterada; identificar arquivo, hash, proveniência e numeração de linhas.
2. Identificar modelo, capacidade, cor, condição, preço e origem por item; distinguir **extraído** de **interpretação proposta**.
3. Confrontar cada linha monetária com seu gabarito golden se este tiver sido fornecido; sem gabarito, estado obrigatório `SEM_VERDADE_ADJUDICADA`.
4. Marcar ambiguidade, múltiplos preços e linhas sem atribuição segura para **revisão humana**, não promoção.
5. Consolidar divergências por lista e por oferta, preparar casos de regressão **sintéticos ou autorizados** sem enviar o corpus privado ao GitHub.
6. Somente depois de verificados o corpus e o comportamento do código: avaliar o gate Auth/RLS real, ainda pendente. Não tratá-lo como provado pelo PostgreSQL simplificado.

**Observação sobre privacidade:** anexar arquivos ao ChatGPT implica compartilhar esse conteúdo com o serviço. Se essa opção não for desejada, usar o script `auditar_corpus_local_v0.js` com Node.js instalado no Windows, ou realizar revisão manual offline. O leitor local de TXT/CSV **não requer Docker nem banco**, porém requer uma cópia local da branch e Node.js. O relatório de saída permanece no computador e deve ser tratado como privado.

## Etapa 3 — critérios de conclusão

| Frente | Estado |
|---|---|
| SQL C01 executado contra PostgreSQL efêmero no GitHub Actions | PASS sintético |
| Conversores TXT/Advisor com fixtures sintéticas | PASS |
| Corpus original confrontado com golden | PENDENTE |
| Autenticação/RLS reais em ambiente isolado | PENDENTE |
| PR #178 e #179 / banco de produção | DRAFT, sem deploy |
| Gate 1 operacional | **NO-GO** |

Nenhuma despesa adicional de staging foi autorizada. Usar as provas já realizadas para evitar execução repetitiva de CI, que pode consumir cota da conta.
