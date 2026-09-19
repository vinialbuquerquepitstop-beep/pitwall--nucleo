# Indice mestre de handoffs do Pit Wall

Este arquivo e a fonte canonica de NAVEGACAO de arranque para qualquer agente que trabalhe neste repositorio, incluindo Claude Code e ChatGPT/Codex.

Ele NAO substitui o handoff. O indice apenas diz qual handoff precisa ser lido. O estado operacional e as decisoes da ultima entrega vivem no handoff de topo de cada linha; o Git prova o que esta realmente versionado; contratos, processos e invariantes continuam sendo regras permanentes.

## Protocolo obrigatorio de arranque

1. Sincronizar e conferir o `main` atual.
2. Ler ESTE indice.
3. Identificar a linha de dominio que a tarefa toca.
4. Abrir obrigatoriamente o handoff de topo dessa linha e le-lo por inteiro antes de alterar codigo, banco ou documentacao.
5. Conferir o handoff contra o Git atual: commits citados, arquivos alterados e branch/merge quando houver.
6. Ler os documentos permanentes que o handoff ou o dominio exigirem (`CLAUDE.md`, processo, contrato, invariantes, referencia visual etc.).
7. Se a tarefa tocar banco, conferir o estado vivo no Supabase antes de escrever.
8. Trabalho ainda em branch sem merge e sem novo handoff e WIP; nao substitui o ultimo estado fechado/validado apontado aqui.

A ordem mental e: **indice -> ultimo handoff -> Git real -> regras/processo do dominio -> banco vivo, quando aplicavel**.

## Topos vivos

### Migracao / CRM / Fila Operacional

- topo: `handoff_migracao_pitwall_v77.md`
- estado: Fila Operacional v2 com as Fatias 0 a 7 integradas ao `main`; Fatia 7 fecha alertas e degradacao operacional na aba Hoje.
- merge da Fatia 7: `96b30d6da6e7e4e9573760c96c8f08a92fd723c1`
- handoff v77: commit `e33dc6380fa28d42e8dea707ef88d27c5d1f8366`
- proximo passo: **estabilizacao operacional da Fila v2**, observando os limiares em uso real e corrigindo separadamente a divida do harness; nao existe Fatia 8 definida no processo atual.
- dependencia de prontidao separada: revisar o modelo de consentimento antes de declarar uso mais amplo/multioperador.
- divida separada: o harness historico ainda contem expectativas anteriores ao Modo Proximo e apresentou interrupcao posterior em prova financeira; nao alterar o comportamento aprovado da Fila para satisfazer teste antigo.
- defeitos/temas fora do fechamento: problema visual mobile historico, venda sem WhatsApp e repescagem por evento.

### Calculadora

- topo: `handoff_calculadora_pitwall_v24.md`
- estado: Interpreter Core V1 permanece FROZEN; External Calc Service V0 e Lifecycle / Persistence V0 integrados no `main`; schema `extcalc_*` aplicado no Supabase com RLS e escrita cliente-side fechada.
- merges: Service V0 PR #24, squash `57b3fa2d22828992b7cdba1f2dd22298c4568224`; Persistence V0 PR #25, squash `6ec053cb1410b04a1a1568c44341630016dfcc45`; correcao de indices PR #27, squash `4bef4e5aa98ffe7bc018cf5dc48e8bbdf015f34b`.
- migrations vivas: `20260919202202_external_calc_lifecycle_persistence_v0` e `20260919202604_external_calc_persistence_fk_indexes_v0`.
- proximo passo: `External Calc API V0`, consumindo Service + Lifecycle Repository sem duplicar regra de dominio e sem aceitar `tenant_id` como autoridade do cliente.
- substituicao do leitor legado continua NAO autorizada.
- processo obrigatorio: `docs/calculadora/PROCESSO.md`

### Financeiro

- topo: `handoff_financeiro_pitwall_v21.md`
- contrato obrigatorio antes de qualquer mudanca `fin_`: `docs/financeiro/CONTRATO.md`

### Frontend

- topo: `handoff_frontend_pitwall_v4.md`
- estado: fila de leads da aba Hoje remodelada com hierarquia progressiva; uma acao principal, registros secundarios e desfechos recolhidos por padrao.
- merge da correcao: `e3865a5983730b5de97388320fcd2f90a2f08b3c`
- handoff v4: commit `ab0e2f7615126f3b631d24b1d9000d31e24f5528`
- referencia visual de record: `docs/design/referencia-visual-v3.html`

### Seguranca / backend / QA

- topo: `handoff_seguranca_pitwall_v3.md`
- porta de entrada obrigatoria: `docs/seguranca/DOCUMENTO_MESTRE_SEGURANCA.md`
- fonte canonica do processo: `docs/seguranca/SECURITY_HARDENING_PITWALL_V1.md`
- estado: SECURITY FATIA 0 em andamento; caminho automatico do Claude para `apply_migration` em producao bloqueado e integrado no `main`.
- merge da contencao do agente: `7ada26781357032da2edc571c18dc950142ecb34`
- ainda aberto: backup continua sendo commitado no proprio repo; repo continua publico; outras operacoes mutaveis do MCP ainda precisam de revisao para fechar read-only por padrao.
- proximo passo: criar/provar destino privado separado para backup antes de desligar o workflow atual.
- regra especial: nenhuma mudanca silenciosa; avisar antes/depois e assinar procedencia no commit + handoff.

## Regras de sincronizacao entre agentes

- Claude Code e ChatGPT/Codex trabalham sobre o MESMO repositorio e devem convergir por Git + handoff, nunca por memoria de conversa.
- O ultimo handoff fechado e a principal leitura de continuidade, mas nao e a unica fonte: sempre conferir o Git e os documentos permanentes aplicaveis.
- `CLAUDE.md` e porta de entrada automatica do Claude Code e deve encaminhar para este indice; ele nao deve competir com o indice mantendo outro "topo atual" independente.
- Para ChatGPT/Codex, este indice deve ser consultado explicitamente no inicio de qualquer retomada do Pitwall.
- Handoff commitado e imutavel. Mudanca de estado gera um NOVO handoff; o indice passa a apontar para ele.
- Nunca atualizar referencias historicas antigas apenas para "parecer atual". Atualizar somente ponteiros vivos de arranque.
- Antes de merge ou escrita em producao, conferir se outra sessao/branch alterou o mesmo dominio desde o handoff lido.

## Regra de fechamento

Ao concluir uma fatia ou mudanca que altere o estado operacional do projeto:

1. validar;
2. integrar/publicar conforme o processo da linha;
3. criar novo handoff imutavel;
4. atualizar ESTE indice para o novo topo;
5. manter `CLAUDE.md` apenas como protocolo/porta de entrada, sem duplicar o estado detalhado que pertence aos handoffs.
