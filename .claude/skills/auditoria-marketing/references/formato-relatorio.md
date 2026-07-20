# Formato do relatorio de auditoria

Estrutura usada na primeira rodada (20/07/2026) e que deve se repetir, para as
auditorias ficarem comparaveis semana a semana. Nao e camisa de forca: no modo
Pontual, usar so as secoes da frente auditada.

## Ordem das secoes

1. **Resumo executivo** — 3 a 6 achados numerados, a maior falha primeiro, cada um
   com o numero real que sustenta a afirmacao. Nao e lista de tarefas, e diagnostico.

2. **Conteudo** (se auditado) — tabela de cobertura por semana (semana, cards ativos
   fora Descartado, situacao), seguida de qualquer inconsistencia de campo encontrada
   (Data vs Dia da semana vs titulo) com o nome exato do card. Fechar com o que veio
   limpo (Tipo/Status), para a aprovacao ter peso.

3. **Social** (se auditado) — tabela com metrica, valor real, leitura. Sempre incluir:
   seguidores (tendencia, nao so numero atual), alcance total e medio no periodo,
   posts publicados vs. agendados no Metricool, maior pico e se ele se repetiu.
   Fechar com leitura central: o gargalo esta no que criar, ou em publicar o que ja
   foi criado?

4. **Comercial** (se auditado) — o que o calendario de ativacoes recomenda para o
   periodo, cruzado com o que o Calendario de Conteudo esta de fato produzindo.
   Objecoes de alto ticket cobertas vs. faltando. Ponto de atencao para o proximo
   lancamento relevante, se a janela auditada ja deveria mostrar rampa e nao mostra.

5. **Achados criticos (ranking)** — lista curta, numerada, so os que entraram no
   resumo executivo. Este numero e o que vai na propriedade `Achados criticos` do
   Notion.

6. **Para a proxima rodada** — o que nao foi verificado desta vez (ex: Vetores da
   planilha, cruzamento manual de posts) e qualquer pergunta em aberto para o dono.

## Regras de escrita

- Numero real sempre, nunca "parece que caiu" ou "esta bom". Se o dado for
  aproximado (ex: soma manual de uma serie diaria), dizer que e aproximado em vez de
  fingir precisao que a fonte nao garante.
- Nome exato de card, campana, metrica ou data — nunca generico.
- Portugues do Brasil, sem emoji dentro do texto do relatorio (o icone da pagina no
  Notion pode ter emoji, o corpo do texto nao).
