# EXTERNAL CALC — PLANO DE FECHAMENTO COM GATES (22/10/2026)

**Objetivo do dia:** entregar uma **V0 operacional controlada e auditável**, que permita ao proprietário executar o fluxo completo, sem perda silenciosa de itens e sem aceitar ofertas erradas automaticamente. **Release externo só se TODOS os gates independentes de segurança, interpretador e E2E forem PASS.** Não confundir V0 controlado com interpretador universal ou produção liberada.

**Janela de referência:** 17:15–23:45 (America/Sao_Paulo), ajustável. Horários são orçamento, **não autorização para pular prova**. PRODUCTION=NO_GO até decisão separada.

## Realidade de entrada — verificada / fatos

- Backend/kernel `vinialbuquerquepitstop-beep/pitwall--nucleo`, frontend Next `vinialbuquerquepitstop-beep/pitstop-calc`. Não confundir repositórios.
- Staging C01 isolado Supabase `mfsshvckclnmftpaprxk`: seis tabelas, guarda de promoção e 3 RPCs instaladas. Usuário enviou prova transacional PostgreSQL `PASS` com rollback e JSON da homologação HTTP/JWT negativa `12/12 PASS`; a última consulta de reconciliação C01 nesta rodada foi bloqueada pela conexão, portanto não afirmar estado atual sem novo SELECT.
- **JWT 12/12 = rejeições de segurança**, não teste positivo completo. Falta Auth A/B com caso positivo autorizado, persistência, recuperação e cleanup.
- PRs backend #178 (autoridade), #179 (guard DB) e #180 (quarentena) continuam **draft/open/não mergeados**. Quarentena da análise comercial com 24 revisões promovidas erroneamente **não está instalada/ativada na produção**; exigiria autorização humana e validação da cobertura de todas as leituras/escritas.
- PR #182 de método da generalização é draft. **Benchmark DEV/READ-ONLY: oracle independente com 33 ofertas, `buildQueue` gerou 25 candidatos, apenas 3 matches estritos. `GENERALIZATION_COMPARE=FAIL`.** Não esconder essa reprovação atrás de testes sintéticos do harness.
- Frontend PR #92 `feat/external-calc-batch-supplier-intake-v0` ainda draft/open. G1 AppShell, G2 Auth, cotação/simulação e design Pitstop já receberam aprovação anterior; só reabrir com regressão.
- Fonte comercial real da produção: incidente WhatsApp em que 25 candidatos / 24 revisões foram promovidos inadequadamente, incluindo confusão modelo/preço/cor. Tratar como **quarentena lógica obrigatória antes de novos fluxos produtivos**.
- Contratos C01→C05 autoritativos no Service; nenhuma regra de preços/taxas, margem, classificação ou autorização no frontend. Taxas por usuário, múltiplos cartões/parcelas e trade-in previamente aprovados.
- No GitHub Actions. Sem Docker obrigatório no Windows, serviços pagos novos, evidência fictícia de mercado ou deploy/SQL produtivo tácitos.

## Definições dos dois resultados do dia

**RESULTADO A: `CONTROLLED_V0_PASS`** — login proprietário, fornecedor, colar/importar **uma lista real autorizada**, conferir **todos os itens monetários** no review e inserir manualmente ausentes, confirmar C01, selecionar oferta, cotar, trade-in, simular parcelas/cartões, visualizar estado e histórico ou status de indisponibilidade honesto; desktop/mobile em staging/preview sem caminhos falsos. **Toda oferta exige confirmação humana; auto-promoção desabilitada/sem endpoint atingível.** Nenhuma liberação pública automática.

**RESULTADO B: `EXTERNAL_BETA_PASS`** — adicional ao A: generalização validada em holdout genuinamente inédito independente, 0 erro crítico silencioso, isolamento A/B positivo e negativo, quarentena/neutralização auditada do incidente real, migrações e rotas de consumo validadas, integração Preview publicada e testada por usuário zero sem assistência, rollback demonstrado e aprovação humana explícita. Dado estado 3/33 e falta de holdout, **B não deve ser tratado como compromisso realizável hoje**.

Se A não passar: `NO_GO_CONTROLLED_V0`, manter staging e demonstrar somente caminho já verificado. Não renomear FAIL como PASS.

## Estrutura de execução

| Gate / janela | Owner / arquivos | Execução obrigatória | Evidência de PASS | Falha / contingência |
|---|---|---|---|---|
| **F0 Freeze & Reality Map** 17:15–17:55 | Coordenação; docs read-only, PRs / DB catalog | Registrar SHA main, heads #178/#179/#180/#182 e frontend #92, endpoints/flags, banco/Worker/Preview efetivos, 24 revisões suspeitas e baseline 3/33. Backup/reversão por ref. Proibir deploy produção. | Matriz de ambientes e SHA, evidência presente/ausente, fonte única do teste. | Sem acesso a qualquer sistema essencial: FAIL nesse eixo, não presumir integridade. |
| **F1 Interpreter/Safety V0** 17:55–19:15 | Backend/Interpreter: owner exclusivo de `ferramentas/external-calc-*`; preservar Core FROZEN | Não treinar em lista conhecida nem reescrever C01–C05. Medir 14 TXT/18 golden/62 valores adjudicados quando acessíveis; separar DEV e challenge selado; coletar pelo menos uma lista externa verdadeiramente nova para avaliação independente. Validar modelo/capacidade/cor/condição/preço exatos e scopes/header, centavos, sem perdas silenciosas; documentar itens que parser omite. Implementar/fixar **modo revisão obrigatória** e bloqueio fail-closed de auto-promoção até prova. | Para A: sem aceitação automática, todos os valores monetários da lista piloto contabilizados e corrigíveis na revisão, zero associação crítica silenciosa; report métricas por campo e abstention. Para B: holdout independente PASS, não apenas corpus histórico. | Se UI não permite inserir oferta omitida, abrir P0 obrigatório; NÃO lançar intake automático. |
| **F2 Core C01→C05 E2E** 18:30–20:30 (paralelo após F0/F1 preflight) | Backend/API; não disputar mesmos arquivos de F1 | Staging protegido; fluxo fornecedor→fonte original→revisão humana→C01→quote C02→C03/C04 (incluindo dados insuficientes)→C05; trade-in; taxas do dono, multi-card/parcelas; idempotência, retry, long list paginação `<=12`/chamada e 50-subrequests; source_execution_id autoritativo para Advisor (ou desabilitar insights não verificados). Usar API real, sem mocks para o aceite. | Requests/responses sanitizados + IDs/revisions/fingerprints verificáveis, nenhum cálculo novo no frontend, nenhum sucesso inventado de Advisor. | Sem C01 válido ou source_execution_id: Advisor mostra indisponível; não inventar inteligência. |
| **F3 Frontend Beta Reset + Mobile** 18:15–21:15 (paralelo) | Frontend somente `pitstop-calc` | Congelar design aprovado (branco + azul Pitstop + Manrope). Checar Home insights, picker fornecedor, colar lista, batch ZIP opcional, review com recuperar itens, Calculadora, cotação, simular venda 12x/18x/taxas/cartões, histórico/movimentação, perfil/config. Corrigir apenas P0/P1: CTA, fluxo, vazamento, dados pequenos, responsividade e estados vazios. Usar API real. | Capturas/render e 100% de cliques críticos desktop + viewport mobile; no broken primary CTA; sem regressão visual. | ZIP vira extensão facultativa se não bloquear a jornada essencial; não cortar a capacidade de corrigir itens. |
| **F4 Segurança e integridade** 20:30–22:00 | Core/security com release owner | Reconciliar JWT A/B 12/12 negativas, adicionar **positivo** por conta com isolamento e limpeza, RLS, binds, snapshot; executar testes diretos/cadeia de consumer RPCs quote/home/movement/history/simulator. Separar staging de produção. Para B: fechar PR #178→#179→#180 em ordem e provar quarentena das 24 revisões com rollback e autorização explícita; qualquer gap mantém produção NO_GO. | A: ambiente de teste isolado e usuário único comprovado; B: nenhum dado afetado acessível em consumidores e write barriers todos PASS. | Qualquer vazamento tenant, aceitação errada, direto quote suspeito ou dependência produtiva não verificada = STOP. |
| **F5 Usuário zero e release decision** 22:00–23:30 | QA + dono | Do zero em navegador limpo desktop e telefone: login → cadastrar fornecedor → colar lista real → revisar cada preço/variante/linhagem → aceitar → calcular → simular → Advisor apenas com evidência → histórico → logout/relogin. Medir tempo, falhas e persistência. 2ª conta testa isolamento; screenshot/resultados. | Script E2E reproduzível, 0 P0, sem perda de ofertas, termos de erro compreensíveis, estados de 'sem dados' transparentes, tudo em preview/staging. Decidir A/B/NO_GO explicitamente. | P0 falha = não lançar. Pode entregar beta controlado menor se F1/F2/F3 e isolamento passarem. |
| **F6 Handoff/Freeze** 23:30–23:45 | Coordenação | Consolidar os gates em 1 `release-report`, links e SHAs, versão/ambiente, matriz PASS/FAIL/UNVERIFIED, risco conhecido, backup, rollback, próximo slice. Não confundir CHECKPOINT com deployment. | Documento atualizado e ponto de retomada. | Sem provas: marcar unverified; nenhum 'finalizado' implícito. |

**Caminho crítico:** F0 → F1 (origem/intake) → F2 (C01 válido) → F5 → F6. F3 pode ocorrer paralelamente e F4 avança em paralelo só após verificar baseline. Sem liberar F5 se F1/F2 ainda reprovaram.

## Matriz de aceite prioritário (P0, todos obrigatórios para A)

1. Lista real + fornecedor certo, contexto da IA não sobrepõe texto original; toda linha monetária listada ou explicitamente em `REVIEW_REQUIRED` — nunca some sem contagem.
2. Modelo, capacidade, condição, cor e preço **incluindo centavos** têm evidência correspondente. Ambiguidade mostra motivo; corrigir manualmente não muda a fonte original.
3. Revisão humana permite corrigir **e incluir** itens faltantes, persistência segura e deduplicação; caso essa função não exista, não alegar V0 de importação finalizada.
4. C01 confirmado é a única fonte da cotação; C02 aplica taxas variáveis por usuário, cartões, parcelas e trade-in sem regra UI; C03/C04 declaram falta de comparáveis e C05 estado honesto.
5. Rotas protegidas, tenant A/B isolado, simulação HTTP autenticada em Preview, leitura por ID bloqueada quando inválida/suspeita, sem C01 contaminado em produção.
6. Visual mobile/desktop aprovado sem clique quebrado; deploy/URL verificado e rollback fácil.
7. Um usuário executa o fluxo sem engenharia ao lado e entende correções/erros.

## Donos e disciplina de paralelismo

- **A / Core e Interpreter:** arquivo backend, contratos, parser/lineage, C01, Service C01→C05, APIs; não altera CSS/JSX frontend.
- **B / Frontend:** repo `pitstop-calc`, telas, adapter, interação, responsividade, acessibilidade; não reimplementa cálculo/regra C01.
- **C / QA e release:** evidências, baseline, execução real, deploy controlado somente com aprovação e rollback; não mexe código sem handoff.
- SYNC obrigatório ao final de F0, F2, F4 e F5; cada handoff traz SHA + endpoint + migrations + pass/fail + repro steps + quem pode avançar.
- Apenas uma mudança funcional por branch; evitar merge e deploy de frentes concorrentes sem revisão de paridade de contratos; backups sempre antes de qualquer mudança persistente.
- Todos os testes por scripts locais/queries/browser + logs, **sem GitHub Actions**.

## Decisão final (exatamente uma)

- `CONTROLLED_V0_PASS`: produto operacional utilizável restritamente, **sem importação automátizada irrestrita**, com confirmação humana e provas acima; compartilhar link só com proprietário/teste autorizado.
- `EXTERNAL_BETA_PASS`: permitido somente com todos os gates B e autorização humana; holdout real, segurança produção e quarentena comprovados.
- `NO_GO`: não há fluxo fechado ou erro de autoridade/safety; registrar bloqueio exato, último ambiente íntegro e próxima prova. Não liberar por prazo.

**Observação:** a ordem da migração para produção, se em algum momento for aprovada, exige reconciliar a instalação manual staging VS5.3L à história de migrations antes de aplicar DDL; nunca copiar SQL de staging para projeto produtivo sem revisão específica. Staging C01 não é clone fiel do produto comercial vigente.
