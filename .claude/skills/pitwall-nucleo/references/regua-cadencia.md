# Regua de cadencia

A regua e o motor que decide, todo dia, qual lead precisa de toque e empurra o passo
seguinte. Roda nativa em pg_cron, sem Google Agenda. Tudo que e numero mora em config
(`cadencia_perfil` + `cadencia_regra`), nada dentro da funcao. Os valores abaixo sao os
reais do banco, conferidos.

## O job

`regua_pitwall_diaria`: pg_cron 08:00 UTC = 05:00 BRT, chama `fn_regua_varredura()`. A
varredura le `cadencia_estado`, compara `passo_vence_em` com hoje (fuso Brasil), e para
cada lead vencido: marca o passo como devido, ou avanca para o proximo passo, ou, se
esgotou os passos, transiciona o perfil. Cada acao emite `lead_evento`
(`cadencia_avancou`, `perfil_transicionado`, `cadencia_encerrada`,
`abandonado_sem_toque`).

Ordem interna da varredura (v43): **higiene** (encerra cadencia de lead arquivado,
`lista_fria` ou `cancelado`, que as RPCs deixavam vivo) -> **REGRA 0** (inicializa quem
tem perfil e nao tem estado) -> **loop principal**, ja filtrando o freio relativo.

**A pegadinha da REGRA 1** (a falha mais cara ja encontrada aqui, corrigida em
31/07/2026): "sem toque confirmado, nao avanca" e certo, mas ate a v42 o `continue`
ficava ANTES de todo o resto da maquina. Esfriamento, transicao e encerramento eram
inalcancaveis para quem nao tinha sido tocado, entao a regua so agia sobre o lead que
o operador ja tinha trabalhado. Resultado medido: 16 de 16 cadencias vencidas travadas,
0 esfriamentos e 0 encerramentos na historia inteira do sistema. Hoje o `continue` so
vale DENTRO da tolerancia de `dias_ate_abandono`; passando dela, a regua decide.

**Log de execucao**: cada rodada grava uma linha POR TENANT em `regua_execucao`
(`tenant_id` NOT NULL, RLS estrita, contadores derivados dos eventos append-only da
propria rodada). O `painel_do_dia` devolve isso no bloco `regua` e a aba Hoje pinta
`régua rodou há Xh · N leads atrasados`. Sem esse log a regua ficou semanas parada sem
nenhuma tela avisar.

## Config por perfil (cadencia_perfil)

| perfil | limite_silencio_dias | dias_ate_abandono | permite_esfriar | respondido_freia | perfil_seguinte |
|---|---|---|---|---|---|
| compra_imediata | 15 | 7 | sim | sim | repescagem |
| avaliando | 15 | 10 | sim | sim | repescagem |
| consulta | 15 | 10 | sim | sim | repescagem |
| em_espera | 10 | 7 | sim | nao | repescagem |
| repescagem | 30 | 21 | sim | sim | (nenhum, encerra) |
| comprou | (nulo) | (nulo) | nao | nao | (nenhum) |

Leitura das colunas:
- `limite_silencio_dias`: quanto tempo o lead aguenta apos ESGOTAR os passos, contado
  do ultimo toque. Mede o silencio do CLIENTE.
- `dias_ate_abandono` (v43): quanto tempo um passo aguenta VENCIDO SEM TOQUE antes de a
  regua decidir sozinha. Mede o silencio do OPERADOR. NULL = nunca abandona (o
  pos-venda fica cobrando ate voce fazer). Sem essa coluna a regua so agia sobre o lead
  que voce ja tinha trabalhado, e o lead esquecido ficava preso para sempre.
- `respondido_freia`: se o cliente responde, a cadencia para naquele perfil. `em_espera`
  e `comprou` NAO freiam por resposta, de proposito: em_espera esta esperando uma data
  combinada, comprou e pos-venda ritmado. **O freio e RELATIVO desde a v43**: segura
  enquanto a ultima palavra for do cliente (`respondido_em >= ultimo_toque_em`). Voce
  tocar de novo sem ele voltar recomeca o silencio e a regua retoma. Antes o freio era
  permanente (`encerrada = true`) e o lead que engajou saia da maquina para sempre.
- `permite_esfriar`: se o perfil pode ir para frio/lista_fria por silencio. `comprou`
  nao esfria (cliente nao vira lead frio). **ATENCAO**: hoje e inalcancavel em 4 dos 6
  perfis, porque a transicao tem precedencia e todos tem `perfil_seguinte`. So
  `repescagem` chega a esfriar. E config que documenta comportamento que nao existe:
  pendencia declarada no handoff v43.
- `perfil_seguinte`: para onde o lead vai quando esgota os passos. Quase tudo cai em
  `repescagem`; `repescagem` esgotada encerra; `comprou` nunca transiciona.

## Os passos por perfil (cadencia_regra)

`dias_offset` e relativo a `ancora`. `toque_anterior`: conta a partir do ultimo toque.
`data_combinada`: conta a partir da data que o cliente marcou (usada so em `em_espera`).
`data_venda` (v43): conta a partir da ultima venda nao cancelada do lead, usada nos 6
passos do `comprou`. Offsets sao INCREMENTAIS entre passos consecutivos, nao dias
absolutos desde o inicio (o rotulo mostra o dia acumulado para leitura humana).

compra_imediata (8 passos, ritmo agressivo): R1 · D0 (0), R2 · D1 (1), R3 · D3 (2),
R4 · D7 (4), R5 · D14 (7), R6 · D30 (16), R7 · D60 (30), R8 · D90 (30).

avaliando (6 passos): R1 · D0 (0), R2 · D3 (3), R3 · D7 (4), R4 · D14 (7), R5 · D30
(16), R6 · D60 (30).

consulta (7 passos): R1 · D0 (0), R2 · D2 (2), R3 · D5 (3), R4 · D10 (5), R5 · D20 (10),
R6 · D35 (15), R7 · D60 (25).

em_espera (3 passos, ancorados na data combinada): R1 · 2 dias antes (offset -2,
ancora data_combinada), R2 · Data combinada (0, data_combinada), R3 · D5 (5,
toque_anterior).

repescagem (6 passos, ritmo lento): R1 · D0 (0), R2 · D7 (7), R3 · D14 (7), R4 · D30
(16), R5 · D60 (30), R6 · D90 (30).

comprou (6 passos, pos-venda): P1 · D1 pos-venda (1), P2 · D7 tudo certo? (6), P3 · D30
(23), P4 · D90 (60), P5 · D180 upgrade? (90), P6 · D365 upgrade (185).

## Pos-venda (perfil comprou)

E uma cadencia de relacionamento, nao de venda imediata. Nao freia por resposta, nao
esfria, nao transiciona, e nao abandona (`dias_ate_abandono` NULL: fica cobrando ate
voce fazer). O objetivo dos passos longos (D180, D365) e o gancho de upgrade, que casa
com `upgrade_entrada` e `aparelho_entrada` no lead. A aba `pos-venda` no front expoe
esse fluxo.

**A ancora do pos-venda e a VENDA, nunca um toque anterior.** Ate a v42 os 6 passos
usavam `toque_anterior`, e no pos-venda nao existe toque anterior: o marco e a compra.
Efeito medido: 5 clientes travados no `P1 · D1` e o pos-venda inteiro nunca disparou uma
unica vez. Cliente `comprou` **sem venda registrada** na tabela `venda` (os herdados do
CRM antigo) nao tem ancora confiavel: a cadencia dele e encerrada com evento explicando,
e ele aparece no segmento **Falta venda** da aba Clientes. Inventar uma data ali
envenenaria o D180/D365, que e justamente onde mora a margem da revenda.

## Sentinelas de conversa

`lead.etapa_cadencia` marca 💬 Conversando ou ⏰ Negociação parada. Sao estados de uma
conversa ja aberta, distintos do perfil e do status. Nao confundir com nivel nem com
status de encerramento.

## Ao mexer na cadencia

Editar `cadencia_regra` (passos/offsets) e `cadencia_perfil` (silencio/freio/transicao)
e alterar DADO de config, nunca a funcao. Depois de mudar, conferir que `fn_regua_
varredura()` nao tem nenhum numero chumbado no corpo (invariante 11). Testar a regua em
simulacao: `set role authenticated` com o claim do dono, chamar a varredura contra um
lead de teste, e provar que o passo avancou e que exatamente um `lead_evento` foi
gravado.
