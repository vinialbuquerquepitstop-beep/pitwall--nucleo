---
name: auditoria-marketing
description: Time de auditoria de marketing da Pitstop Imports — três frentes de diagnóstico (Conteúdo, Social, Comercial) que rodam juntas e alimentam um quarto braço, propositivo (Evolução & Propostas), para produzir um relatório único que ao mesmo tempo aponta o que está errado E propõe como crescer engajamento e alcance local, novas produções, novas estratégias e novos Vetores como opções. Semanal automático ou pontual sob pedido. Acione SEMPRE que o usuário pedir para auditar marketing, revisar o Instagram, checar o calendário de conteúdo e a performance junto, pedir uma "auditoria" sem especificar só uma frente, ou pedir ideias de como evoluir/crescer o Instagram, novos formatos, novos vetores. Para tocar SÓ o pipeline de conteúdo (cards, sync, Notion→Pit Wall) sem números de Instagram, use pitwall-conteudo direto. Para SÓ estratégia comercial sem os outros dois, use apple-strategist direto. Esta skill existe para juntar as frentes, propor evolução e registrar o resultado em um único lugar.
---

# Time de Auditoria de Marketing — Pitstop Imports

Não é uma skill de conhecimento novo. É a orquestração de frentes que já existem
(`pitwall-conteudo`, `socialmedia` + Metricool, `apple-strategist`) rodando juntas, com
um único relatório de saída e um único lugar onde ele fica registrado.

## Dois deveres, não um: diagnóstico E proposta

A auditoria tem duas entregas obrigatórias na mesma rodada, nunca só a primeira:

1. **Diagnóstico** — o que está acontecendo, medido: o que a loja produziu, o que
   publicou de verdade, como performou, onde o plano descolou da execução. Esta é a
   parte que já existia.
2. **Proposta de evolução** — como crescer o engajamento e o alcance **local** (Rio de
   Janeiro), quais novas produções fazer, quais novas estratégias abrir, e quais
   **novos Vetores** valem como opção. Ordem do dono (20/07/2026): a auditoria do
   Instagram tem que ter a premissa de sugerir formas de evolução, não só carimbar o
   passado.

A intenção declarada da loja é **crescer e evoluir** — engajamento, alcance local,
ticket. Toda rodada mantém esse norte: não basta dizer "o alcance caiu", tem que dizer
"e a jogada pra reverter é esta".

### A trava que impede a proposta de virar lixo

O achado #1 da primeira rodada (20/07/2026) foi que **o plano é rico e a execução é
magra** (11 posts publicados em 30 dias contra 15-20 planejados por semana no Notion, 0
agendados). Uma auditoria que passa a propor novas produções e novos Vetores toda
semana pode piorar exatamente esse buraco: mais ideia no papel, mesma execução fina.

Por isso a proposta é **disciplinada, não um jato**:

- **Poucas por rodada.** No máximo 3 propostas de produção e 2 a 3 opções de Vetor.
  Priorizar, não listar tudo que passou pela cabeça.
- **Amarrada à capacidade real.** Antes de propor produção nova, olhar quantos cards
  do plano atual foram de fato publicados. Se a execução está abaixo do já planejado,
  a proposta #1 é *executar o que já existe*, e propor Vetor novo vem com a ressalva
  explícita "não abrir enquanto os ativos não estiverem saindo".
- **Com recomendação, não só opções soltas.** Definir opções (o dono pediu "defina
  opções"), mas dizer qual é a aposta mais forte e por quê. Conselheiro crítico, não
  cardápio.
- **Cada proposta cruzada com um Vetor.** Reforça um Vetor ativo (citar o nome exato)
  ou é pauta fora da linha atual? Se fora, marcar como tal — quem decide abrir é o dono.

## As três frentes de diagnóstico (papéis, não pessoas)

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
      cruzada contra os Vetores de campanha ativos. Fonte preferencial: a página
      Notion 🎯 Vetores de Campanha · Conteúdo IG (id `38e80e29017e819aa860c0cf3b651082`),
      que espelha a aba `Vetores` da planilha e é acessível pelo conector Notion que
      a rotina já tem — não depende de Google Drive/Sheets. Pra saber se a sugestão
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

## O time de agentes de pesquisa e proposta

Ordem do dono (20/07/2026): a auditoria precisa de um time completo de agentes, não só
os três olhares de diagnóstico. Cinco agentes de pesquisa e proposta alimentam o braço
de Evolução & Propostas. São papéis, não pessoas — e as três funções de pesquisa
pesada (Campo, Sazonal, Mercado) podem ser despachadas como subagents em paralelo, cada
um com o recorte abaixo, porque são buscas independentes (ver processo em
`references/evolucao-e-propostas.md`).

Cada agente entrega **dois blocos**: o que existe hoje (com evidência) e a proposta de
como evoluir. A regra herdada continua valendo em todos: número medido nunca se
disfarça de pesquisa e pesquisa nunca se disfarça de número medido.

| Agente | Recorte | De onde vem a metodologia | Alimenta |
|---|---|---|---|
| **Campo (local)** | Demanda e concorrência no Rio de Janeiro; sinais de alcance local; o que engaja no público local. Foco no "sem sair do Rio" que já está na bio. | `socialmedia` (concorrentes) + pesquisa local | Social 3b/3c + Evolução (alcance local) |
| **Sazonal** | Calendário Apple da janela, datas comerciais do período, câmbio dólar/importação, o que a estação pede agora. | `socialmedia` Módulo 7 + Módulo 6 (áudio) | Comercial + Evolução (novas produções sazonais) |
| **Estratégia de mercado** | Posicionamento frente aos concorrentes, ticket, oportunidade de upsell/cross-sell, ângulo de campanha. | `apple-strategist` | Comercial + Evolução (novas estratégias, novos Vetores) |
| **Posicionamento social** | Pilares e distribuição, formato dominante, sinais do algoritmo, o que muda no engajamento. | `socialmedia` Módulos 1-3 | Social + Evolução (formas de evoluir engajamento, novas produções) |
| **Branding** | Consistência da comunicação: bio, destaques, tom, identidade visual, coerência entre os posts. Comunicação profissional que se sustenta. | `socialmedia` Módulo 5 + `docs/design/referencia-visual-v3.html` | Evolução (branding profissional) |

## Junho como linha de base

O dono pediu para considerar o histórico de junho. Junho é o primeiro mês com número
real medido no Metricool e serve de **baseline a bater**, não de nostalgia. Ler:

- O pico de alcance de **24/06 (2.344)**, muito acima da média de ~250/dia. Identificar
  qual post foi, qual formato/gancho, e se é replicável (pendência #18 do handoff v31).
- O ritmo de junho vs. o de julho: publicação subiu, caiu, manteve? A base de
  seguidores em junho vs. a leve queda de julho (11.995 → 11.981 em 19/07).

A proposta de evolução usa junho como referência concreta: "o formato que fez 2.344 em
24/06 não voltou a rodar; replicar é a aposta de alcance mais barata que existe".

## Novos Vetores como opções (nunca escrita automática)

O dono pediu para propor novos Vetores e definir opções. A auditoria **propõe, não
edita** — invariante duro do projeto, preservado: quem abre Vetor novo, altera card ou
mexe no Escopo é o dono, não a skill. Nenhuma escrita automática na aba `Vetores` nem
no Calendário.

Cada opção de Vetor proposto vem no **esquema exato da aba** (colunas confirmadas em
20/07/2026 via a página Notion espelho: `Semana`, `Período`, `Gancho`, `Âncora`,
`Peças`, `Trava`, `Status`), com `Status` = **proposto** (nunca `ativo` — ativar é ato
do dono). Processo completo em `references/evolucao-e-propostas.md`. Formato de saída no
relatório em `references/formato-relatorio.md`, seção 5.

## Os dois modos

### Semanal (automático, toda segunda de manhã)
Varre as três frentes de diagnóstico por completo, sempre a mesma janela (Conteúdo:
hoje-7 a hoje+28; Social: últimos 30 dias corridos; Comercial: mês corrente + próximo),
E roda o braço de Evolução & Propostas com os cinco agentes. Produz um relatório
completo nas mesmas seções do modelo em `references/formato-relatorio.md`.

### Pontual (sob pedido, a qualquer momento)
O usuário pede uma checagem específica ("por que o alcance caiu essa semana", "audita
só o Instagram", "me dá ideias de como crescer", "propõe vetores novos"). Não precisa
cobrir tudo — cobre o que foi pedido, com a mesma disciplina de número real, achado
nomeado e proposta priorizada. Se o pedido for propositivo ("como evoluir", "novos
vetores"), o braço de Evolução & Propostas é o centro da rodada, mas ainda ancorado em
pelo menos os números reais do Metricool para não propor no vácuo. Registra no mesmo
lugar (ver Entrega), com `Tipo` = Pontual e `Áreas` só com o que foi de fato tocado.

## Regra de ouro: nunca reprovar nem elogiar sem ter olhado

Auditoria que sempre devolve "está tudo bem" é teatro (regra herdada de
`pitwall-conteudo/references/auditoria.md`, vale para todas as frentes aqui). Todo
achado tem que vir com número, card ou data exata. Se nada de errado for encontrado
numa frente, declarar explicitamente o que foi checado (quantos cards, qual janela,
quais métricas) para a aprovação ter peso — não só "sem problemas".

O mesmo vale para a proposta: nunca propor no vácuo. Cada sugestão de evolução tem que
apontar o número, o concorrente, a data comercial ou o Vetor que a justifica. Ideia sem
gancho medido é chute, e chute não entra no relatório.

Nomear a maior falha primeiro no resumo executivo, não a lista inteira sem hierarquia
(consistente com a postura de conselheiro crítico do projeto, não carimbo). No braço
propositivo, nomear a **aposta mais forte** primeiro, com a recomendação clara.

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
e datado. Refletir um achado ou uma proposta no Pit Wall em si (Vetor, card, Escopo) é
decisão do dono, não automática — esta skill audita, propõe e registra, não edita o
Calendário nem os Vetores por conta própria.

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
  o que cada uma cobre), incluindo o braço de Evolução & Propostas e os Novos Vetores.
- `references/metricool-metricas.md` — `fieldId` do Metricool já testados para a
  conta `pitstopimports`, o que cada um mede, e as armadilhas de leitura (colunas por
  ordem dos metrics pedidos, não por nome).
- `references/pesquisa-concorrencia-tendencias.md` — o processo das três funções da
  frente Social que não vêm do Metricool: concorrência real, tendências do nicho e
  pauta pra semana seguinte cruzada com os Vetores ativos.
- `references/evolucao-e-propostas.md` — o processo do braço propositivo: os cinco
  agentes de pesquisa e proposta, junho como linha de base, como propor evolução de
  engajamento e alcance local sem virar jato de ideias, e como montar as opções de
  Vetor novo no esquema exato da aba.
