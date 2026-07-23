# Spec — Hoje mais pratico: Fila embutida + lembrete com data

Data: 2026-07-22. Aprovado pelo dono na sessao.

## Problema
A aba Hoje nao mostra a fila de leads (obriga trocar de aba), e lembrete so nasce
no dia de hoje. O dono quer o dia a dia mais pratico: ver a fila no Hoje e agendar
lembrete para um dia futuro, que apareca com destaque no dia certo.

## Escopo (2 pecas, um push)
Recorrencia por dia da semana foi CONSCIENTEMENTE deixada de fora (decisao do dono).

### Peca A — Fila no Hoje (frontend puro)
- Nova secao no topo do Hoje, logo apos o placar: "Fila de hoje".
- Mostra os **5 leads mais urgentes** de `montarFila` (mesma ordenacao ja usada no placar).
- Cada linha: nome, ponto de nivel (quente/morno/frio) + palavra, notacao do toque (`R3 · D14`).
- Unica acao por lead: **sugerir mensagem** (reusa `sugerirMensagem`, read-only, invariante 13).
  Sem toque, sem desfecho, sem editar aqui.
- Cabecalho com botao "ver todos (N)" que troca para a aba Fila.
- Fila vazia: secao some (ou linha "fila zerada hoje").
- Dado ja esta no cliente (`i` = v_lead, `montarFila`/`v`, `hojeLocalISO`/`l`). Zero banco.

### Peca B — Lembrete com data (1 edit de RPC + frontend)
- UI "+ Lembrete" ganha seletor **quando**: atalhos `Hoje` / `Amanha` + `<input type=date>`.
  Passa `p_data` ao RPC `salvar_lembrete(p_texto, p_data)` que JA existe.
- `painel_do_dia`: trocar o SELECT de lembretes de `data = v_dia` para
  `data = v_dia OR (data < v_dia AND feito_em IS NULL)`. Devolver por lembrete:
  `data`, `vencido` (data < hoje e nao feito) e `agendado` (`criado_em` no fuso BR < `data`).
  `CREATE OR REPLACE FUNCTION` reseta ACL: refazer REVOKE/GRANT de `authenticated`.
- Render dos lembretes no Hoje ganha dois estados:
  - **vencido**: sinal de alerta + "venceu ontem"/"atrasado N dias"; carrega todo dia ate feito.
  - **agendado que chegou no dia**: destaque (icone + tint) para lembrar de verdade.
  - lembrete escrito hoje mesmo: normal.

## Invariantes tocados
- 13: sugerir_mensagem read-only, unica fonte de texto — respeitado (so leitura na Fila do Hoje).
- 6: lembrete vencido carrega newest-first onde exibido.
- 10: data de negocio no fuso do Brasil (RPC ja usa `America/Sao_Paulo`).
- CLAUDE.md: `CREATE OR REPLACE FUNCTION` reseta ACL -> re-grant.

## Provas (conferir EXIT CODE)
- `python ferramentas/validar.py` — sintaxe, exit 0.
- `python ferramentas/harness.py` — comportamento. Asserções novas:
  - secao Fila no Hoje com ate 5 linhas e botao "ver todos".
  - cada linha da Fila tem botao sugerir (data-acao="sugerir").
  - lembrete com `data` futura nao aparece no Hoje de hoje.
  - lembrete vencido aparece com tag de atraso.
- `python ferramentas/prova_trilho.py` — inalterado.
- Backend via MCP: inserir lembrete para ontem e amanha; conferir o que `painel_do_dia`
  devolve hoje (ve o de ontem como vencido, nao ve o de amanha).

## Entrega
As duas pecas juntas, um push. Ordem: A depois B. Cloudflare publica no push.
