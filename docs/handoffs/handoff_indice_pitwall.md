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

- topo: `handoff_calculadora_pitwall_v26.md`
- estado: Interpreter Core V1 permanece FROZEN; Service V0, Persistence V0, API V0 e Runtime/Postgres G1-G3 integrados no `main`. RPC autenticada persiste atomicamente sem service role no runtime; round-trip real e provas negativas passaram.
- merge Runtime/Postgres: PR #30, squash `80956fe164746971df93a66c748d85eb5d2f294d`.
- migrations vivas: `20260919202202_external_calc_lifecycle_persistence_v0`, `20260919202604_external_calc_persistence_fk_indexes_v0` e `20260919211347_external_calc_runtime_persist_rpc_v0`.
- proximo passo: fechar `G4 - Deploy / Endpoint` no Worker existente `flat-resonance-09ba`; o repo nao registra hoje um canal de deploy Cloudflare utilizavel por esta sessao.
- `BACKEND_INTEGRATION_READY = false` ate G4; frontend continua em paralelo, mas ainda nao troca fixture pela API real.
- substituicao do leitor legado continua NAO autorizada.
- processo obrigatorio: `docs/calculadora/PROCESSO.md` e `docs/calculadora/EXTERNAL_CALC_LAST_INFRA_V0.md`

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

- topo: `handoff_seguranca_pitwall_v4.md`
- porta de entrada obrigatoria: `docs/seguranca/DOCUMENTO_MESTRE_SEGURANCA.md`
- fonte canonica do processo: `docs/seguranca/SECURITY_HARDENING_PITWALL_V1.md`
- estado: SECURITY FATIA 0 continua em andamento; Runtime/Postgres do External Calc adicionou uma excecao controlada de writer RPC SECURITY DEFINER, elevando o baseline desse advisor de 11 para 12 findings.
- excecao registrada: `extcalc_persist_execution_v0(jsonb)`; anon sem EXECUTE, authenticated sem escrita direta nas tabelas, papel/tenant derivados do JWT, vendedor e tenant mismatch provados como DENY.
- merge relacionado: External Calc Runtime/Postgres PR #30, squash `80956fe164746971df93a66c748d85eb5d2f294d`.
- ainda aberto: backup continua sendo commitado no proprio repo; repo continua publico; outras operacoes mutaveis do MCP ainda precisam de revisao; leaked password protection continua desabilitado.
- proximo passo da linha de seguranca continua: criar/provar destino privado separado para backup antes de desligar o workflow atual.
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
