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
(`cadencia_avancou`, `perfil_transicionado`, `cadencia_encerrada`).

## Config por perfil (cadencia_perfil)

| perfil | limite_silencio_dias | permite_esfriar | respondido_freia | perfil_seguinte |
|---|---|---|---|---|
| compra_imediata | 15 | sim | sim | repescagem |
| avaliando | 15 | sim | sim | repescagem |
| consulta | 15 | sim | sim | repescagem |
| em_espera | 10 | sim | nao | repescagem |
| repescagem | 30 | sim | sim | (nenhum, encerra) |
| comprou | (nulo) | nao | nao | (nenhum) |

Leitura das colunas:
- `respondido_freia`: se o cliente responde, a cadencia para naquele perfil. `em_espera`
  e `comprou` NAO freiam por resposta, de proposito: em_espera esta esperando uma data
  combinada, comprou e pos-venda ritmado.
- `permite_esfriar`: se o perfil pode ir para frio/lista_fria por silencio. `comprou`
  nao esfria (cliente nao vira lead frio).
- `perfil_seguinte`: para onde o lead vai quando esgota os passos. Quase tudo cai em
  `repescagem`; `repescagem` esgotada encerra; `comprou` nunca transiciona.

## Os passos por perfil (cadencia_regra)

`dias_offset` e relativo a `ancora`. `toque_anterior`: conta a partir do ultimo toque.
`data_combinada`: conta a partir da data que o cliente marcou (usada so em `em_espera`).
Offsets sao INCREMENTAIS entre passos consecutivos, nao dias absolutos desde o inicio (o
rotulo mostra o dia acumulado para leitura humana).

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
esfria, nao transiciona. O objetivo dos passos longos (D180, D365) e o gancho de
upgrade, que casa com `upgrade_entrada` e `aparelho_entrada` no lead. A aba `pos-venda`
no front expoe esse fluxo.

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
