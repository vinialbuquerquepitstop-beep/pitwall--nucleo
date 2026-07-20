# Metricas do Metricool — conta pitstopimports

Brand id: `6523734` (label `pitstopimports`, Instagram `pitstopimports`, timezone da
conta `America/Sao_Paulo`). Obtido via `getBrandSettings`, sem parametro.

## fieldId testados (network=instagram, connector=evolution)

| fieldId | Metrica | Uso na auditoria |
|---|---|---|
| IGEV01 | followers | Seguidores atuais (LAST) — olhar a serie inteira, nao so o ultimo dia, para ver tendencia |
| IGEV03 | follows | Saldo diario de seguidores ganhos/perdidos (SUM) |
| IGEV06 | reach | Alcance total do periodo, organico+pago (SUM) — pedir sozinho numa chamada, ver armadilha abaixo |
| IGEV22 | reels | Numero de reels publicados no periodo (SUM) |
| IGEV37 | postsCount | Total de publicacoes, posts+reels somados (SUM) — pedir sozinho numa chamada |
| IGEV30 | aggregatedIgReelsReach | Alcance medio por reel (SINGLE) |
| IGEV31 | aggregatedReelsEngagement | Engajamento agregado dos reels (SINGLE) |
| IGEV15 | postsSaved | Saves de posts (SUM) |
| IGEV29 | reelsSaved | Saves de reels (SUM) |
| IGEV42 | accountsEngaged | Contas unicas que interagiram (SUM) |
| IGEV16 | stories | Numero de stories publicados (SUM) |
| IGEV18 | storiesReach | Alcance de stories (SUM) |
| IGEV9999 | totalEngagement | Engajamento medio (AVG) |

Lista completa: `getAnalyticsAvailableMetrics(network=instagram, connector=evolution)`.
Varios campos aparecem como "Deprecated" na resposta (profileViews, websiteClicks,
emailClicks, directionsClicks, phoneClicks, textMessageClicks) — nao usar.

## Armadilha: ordem de coluna, nao nome

`getAnalyticsDataByMetrics` devolve `rows` como array posicional: um valor por
metrica pedida, na MESMA ORDEM da lista `metrics` enviada, seguido da data
(`YYYYMMDD`) por ultimo. Nao ha nome de coluna na resposta.

Pedir muitas metricas numa chamada so e seguro se voce confia na propria contagem de
posicao. Na pratica, para numeros que vao virar afirmacao no relatorio (ex: "alcance
total de X"), **pedir a metrica sozinha numa chamada dedicada** e mais lento mas
elimina erro de alinhamento. Foi o que gerou os numeros da rodada de 20/07/2026
(IGEV06 e IGEV37 pedidos cada um em chamada propria; o resto veio de uma chamada
combinada usada so para leitura direcional, nao para os numeros citados no relatorio).

## Agendamento

`getScheduledPosts(brandId, fromDate, toDate, timezone)` devolve só o que está na
fila de agendamento automático do Metricool — não inclui o que é postado manualmente
direto no Instagram. Zero resultado aqui NÃO prova que nada vai ser publicado, prova
só que nada está agendado por essa via. Citar essa ressalva sempre que o numero for
zero, para nao virar alarme falso.
