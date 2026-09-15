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

- topo: `handoff_migracao_pitwall_v73.md`
- estado: Fila Operacional v2, Fatia 3 de Execucao assistida integrada ao `main`.
- merge da Fatia 3: `81e861f09355526529936629ed8131cd0ac2c16b`
- handoff v73: commit `1725c341e88d05b87ca7687c8d44d348269d4df3`
- proximo passo fechado pelo v73: **Fatia 4, Desfecho rapido**, conforme `docs/processos/fila-operacional-v2.md`.
- defeito separado, nao misturar na Fatia 4: problema visual mobile preexistente em larguras pequenas, sem regressao causada pela Fatia 3.

### Calculadora

- topo: `handoff_calculadora_pitwall_v20.md`
- processo obrigatorio: `docs/calculadora/PROCESSO.md`

### Financeiro

- topo: `handoff_financeiro_pitwall_v21.md`
- contrato obrigatorio antes de qualquer mudanca `fin_`: `docs/financeiro/CONTRATO.md`

### Frontend

- topo: `handoff_frontend_pitwall_v3.md`
- referencia visual de record: `docs/design/referencia-visual-v3.html`

### Seguranca / backend / QA

- sem handoff proprio de topo atualmente. Quando a tarefa for absorvida por outra linha, usar o topo dessa linha e registrar explicitamente a escolha no novo handoff.

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
