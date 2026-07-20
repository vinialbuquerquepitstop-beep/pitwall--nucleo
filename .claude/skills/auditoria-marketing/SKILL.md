---
name: auditoria-marketing
description: Time de auditoria de marketing da Pitstop Imports — três frentes (Conteúdo, Social, Comercial) que rodam juntas para produzir um relatório único, semanal automático ou pontual sob pedido. Acione SEMPRE que o usuário pedir para auditar marketing, revisar o Instagram, checar o calendário de conteúdo e a performance junto, ou pedir uma "auditoria" sem especificar só uma frente. Para tocar SÓ o pipeline de conteúdo (cards, sync, Notion→Pit Wall) sem números de Instagram, use pitwall-conteudo direto. Para SÓ estratégia comercial sem os outros dois, use apple-strategist direto. Esta skill existe para juntar as três e registrar o resultado em um único lugar.
---

# Time de Auditoria de Marketing — Pitstop Imports

Não é uma skill de conhecimento novo. É a orquestração de três frentes que já existem
(`pitwall-conteudo`, `socialmedia` + Metricool, `apple-strategist`) rodando juntas, com
um único relatório de saída e um único lugar onde ele fica registrado.

## As três frentes (papéis, não pessoas)

1. **Conteúdo** — usa a metodologia de `references/auditoria.md` da skill
   `pitwall-conteudo` contra o Calendário de Conteúdo real no Notion (data source
   `db8e6c04-275b-4ba2-b5cd-9a7548945cea`). Cobertura por semana na janela de sync
   (hoje-7 a hoje+28), `Tipo`/`Status` limpos, `Data` presente e coerente com o título
   e com `Dia da semana` (achado recorrente: os três às vezes divergem — `Data` é quem
   manda para o sync, mas quem produz costuma seguir o título).

2. **Social** — números reais do Instagram via Metricool, não estimativa. Brand id
   `6523734` (`pitstopimports`). Ver `references/metricool-metricas.md` para os
   `fieldId` já testados e o que cada um mede. Cruza com o ritmo padrão e as metas de
   engajamento da skill `socialmedia` (3 posts de feed/semana, saves > 2% do alcance,
   etc.) — mas sempre com o número medido, nunca "parece que está indo bem".

   A frente Social tem quatro funções fixas, não três — a auditoria da área Social só
   está completa quando as quatro rodaram (processo de b/c/d em
   `references/pesquisa-concorrencia-tendencias.md`):

   a. **Números** — Metricool, como acima. Evidência: número medido.
   b. **Concorrência real** — o que os quatro concorrentes diretos (`@blackapplerj`,
      `@tigraoimports`, `@smart.especializadaapple`, `@voce_deiphone`, lista herdada
      da skill `socialmedia`) publicaram e engajaram na semana. Evidência: pesquisa,
      não número medido.
   c. **Assuntos em alta no nicho** — o que está sendo comentado essa semana no nicho
      de importação/revenda Apple (lançamento, rumor, notícia de câmbio, formato
      dominante). Evidência: pesquisa, com fonte citada.
   d. **Pauta pra semana seguinte** — 2 a 4 sugestões de assunto ou dica, cada uma
      cruzada contra os Vetores de campanha ativos na aba `Vetores`
      (`pitwall-conteudo/references/vetores-estrategia.md`), pra saber se a sugestão
      fala a mesma língua do que a loja já decidiu ou é pauta fora da linha atual.

   (b), (c) e (d) são leitura de pesquisa, não número medido — rotular como tal no
   relatório, sem diluir a disciplina de número real de (a).

3. **Comercial** — o calendário de ativações da skill `apple-strategist` e as 5
   objeções de alto ticket da skill `socialmedia` (Módulo 8: alfândega, autenticidade,
   garantia, prazo, preço vs. loja oficial — a lista vive lá, não na `apple-strategist`;
   corrigido em 20/07/2026 depois de uma rodada citar a skill errada), cruzado com o
   que o Calendário de Conteúdo do Notion está de fato produzindo para o mês corrente
   e o seguinte. O objetivo aqui não é reescrever estratégia, é apontar descolamento:
   a régua diz uma coisa, o conteúdo real faz outra.

## Os dois modos

### Semanal (automático, toda segunda de manhã)
Varre as três frentes por completo, sempre a mesma janela (Conteúdo: hoje-7 a
hoje+28; Social: últimos 30 dias corridos; Comercial: mês corrente + próximo).
Produz um relatório completo nas mesmas seções do modelo em
`references/formato-relatorio.md`.

### Pontual (sob pedido, a qualquer momento)
O usuário pede uma checagem específica ("por que o alcance caiu essa semana", "audita
só o Instagram", "sumiu algum card de agosto"). Não precisa cobrir as três frentes —
cobre a que foi pedida, com a mesma disciplina de número real e achado nomeado. Ainda
assim registra no mesmo lugar (ver Entrega), com `Tipo` = Pontual e `Áreas` só com o
que foi de fato auditado.

## Regra de ouro: nunca reprovar sem ter olhado

Auditoria que sempre devolve "está tudo bem" é teatro (regra herdada de
`pitwall-conteudo/references/auditoria.md`, vale para as três frentes aqui). Todo
achado tem que vir com número, card ou data exata. Se nada de errado for encontrado
numa frente, declarar explicitamente o que foi checado (quantos cards, qual janela,
quais métricas) para a aprovação ter peso — não só "sem problemas".

Nomear a maior falha primeiro no resumo executivo, não a lista inteira sem hierarquia
(consistente com a postura de conselheiro crítico do projeto, não carimbo).

## Entrega

Todo relatório — semanal ou pontual — vira uma página na base do Notion
**🔍 Auditorias de Marketing**, data source `fd3f83d4-6f26-49f1-9fab-30a1a08f12cf`,
dentro da página "Crescimento & Marketing" (`36a80e29017e815e825ff1e62e33678a`).
Propriedades: `Auditoria` (título, ex. "Auditoria semanal — DD/MM/AAAA"), `Data`,
`Tipo` (Semanal/Pontual), `Áreas` (multi-select Conteúdo/Social/Comercial),
`Achados críticos` (contagem, só os que entraram no ranking final), `Status`
(Aberta até alguém tratar, Resolvida depois). Usar `notion-create-pages` com
`parent.data_source_id`.

Formato do corpo da página: `references/formato-relatorio.md`.

Esta é a página que "depois vai pra Pit Wall": o conteúdo entra aqui primeiro, versionado
e datado. Refletir um achado no Pit Wall em si (Vetor, card, Escopo) é decisão do dono,
não automática — esta skill audita e registra, não edita o Calendário nem os Vetores
por conta própria.

## Rotina semanal automática

Configurada via cloud routine, toda segunda-feira às 8h10 horário America/Sao_Paulo
(cron `10 11 * * 1` em UTC). Trigger id `trig_01SF9wXiFN89NDe8VrPoRqt7`, criado em
20/07/2026. Roda com checkout do repo (branch `main`) e le este SKILL.md e as
references na hora — se o processo aqui mudar, a rotina acompanha sem precisar
recriar o trigger. Conectores anexados: Notion e Metricool (MCP). Consultar ou
editar: `RemoteTrigger` com `action: "get"` ou `"update"` e esse trigger_id, ou
https://claude.ai/code/routines/trig_01SF9wXiFN89NDe8VrPoRqt7.

## Arquivos desta skill

- `references/formato-relatorio.md` — estrutura exata do relatório (seções, ordem,
  o que cada uma cobre).
- `references/metricool-metricas.md` — `fieldId` do Metricool já testados para a
  conta `pitstopimports`, o que cada um mede, e as armadilhas de leitura (colunas por
  ordem dos metrics pedidos, não por nome).
- `references/pesquisa-concorrencia-tendencias.md` — o processo das três funções da
  frente Social que não vêm do Metricool: concorrência real, tendências do nicho e
  pauta pra semana seguinte cruzada com os Vetores ativos.
