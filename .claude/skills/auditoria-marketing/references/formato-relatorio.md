# Formato do relatorio de auditoria

Estrutura usada na primeira rodada (20/07/2026) e que deve se repetir, para as
auditorias ficarem comparaveis semana a semana. Nao e camisa de forca: no modo
Pontual, usar so as secoes da frente auditada.

A auditoria tem dois deveres: diagnostico (secoes 1-4) e proposta de evolucao
(secoes 5-6). As duas entram na mesma rodada, nunca so a primeira — ver
`evolucao-e-propostas.md`.

## Ordem das secoes

1. **Resumo executivo** — 3 a 6 achados numerados, a maior falha primeiro, cada um
   com o numero real que sustenta a afirmacao. Nao e lista de tarefas, e diagnostico.
   Fechar com uma linha so: a aposta de evolucao mais forte da rodada (o detalhe vai
   na secao 5), pra quem le so o resumo ja sair com a proxima jogada.

2. **Conteudo** (se auditado) — tabela de cobertura por semana (semana, cards ativos
   fora Descartado, situacao), seguida de qualquer inconsistencia de campo encontrada
   (Data vs Dia da semana vs titulo) com o nome exato do card. Fechar com o que veio
   limpo (Tipo/Status), para a aprovacao ter peso.

3. **Social** (se auditado) — quatro sub-secoes, nesta ordem (processo de 3b/3c/3d em
   `references/pesquisa-concorrencia-tendencias.md`):

   3a. **Numeros** (Metricool, numero medido) — tabela com metrica, valor real,
   leitura. Sempre incluir: seguidores (tendencia, nao so numero atual), alcance
   total e medio no periodo, posts publicados vs. agendados no Metricool, maior
   pico e se ele se repetiu. Fechar com leitura central: o gargalo esta no que
   criar, ou em publicar o que ja foi criado?

   3b. **Concorrencia** (pesquisa, nao numero medido) — o que os quatro concorrentes
   diretos publicaram ou engajaram na semana, com fonte, ou "nada indexado essa
   semana" quando a busca nao trouxer nada especifico do perfil.

   3c. **Tendencias do nicho** (pesquisa, com fonte) — assuntos mais comentados essa
   semana: lancamento, rumor, cambio, formato dominante.

   3d. **Pauta pra semana seguinte** — 2 a 4 sugestoes de assunto ou dica, cada uma
   com o gatilho (concorrente / tendencia / calendario Apple) e o Vetor ativo que ela
   reforca, ou marcada "fora dos Vetores atuais" quando nao houver Vetor
   correspondente.

   Rotular 3b/3c/3d como leitura de pesquisa, nunca como se fosse numero medido —
   e o que evita que a disciplina de numero real de 3a se dilua.

4. **Comercial** (se auditado) — o que o calendario de ativacoes recomenda para o
   periodo, cruzado com o que o Calendario de Conteudo esta de fato produzindo.
   Objecoes de alto ticket cobertas vs. faltando. Ponto de atencao para o proximo
   lancamento relevante, se a janela auditada ja deveria mostrar rampa e nao mostra.

5. **Evolucao & Propostas** (sempre, e o segundo dever da auditoria) — processo em
   `evolucao-e-propostas.md`. Abrir com a checagem de capacidade (executado vs.
   planejado) e a linha de base de junho (pico de 24/06, ritmo junho vs. mes atual).
   Depois, os blocos de proposta dos cinco agentes, cada um curto:

   5a. **Linha de base (junho)** — o pico de 24/06 (2.344) foi identificado? Formato
   replicavel? Ritmo e seguidores junho vs. mes corrente, com os dois numeros.

   5b. **Formas de evoluir engajamento** (Posicionamento social) — distribuicao real
   de pilares vs. meta, saves vs. 2% do alcance, e as producoes concretas propostas
   pra mover o engajamento. Numero medido onde houver, pesquisa rotulada onde nao.

   5c. **Formas de evoluir alcance local** (Campo) — sinais de demanda local no Rio,
   concorrencia local, e as jogadas de alcance local propostas (geo, bairro, prova
   social do Rio, parceria).

   5d. **Novas producoes e estrategias** (Sazonal + Estrategia de mercado) — no maximo
   3 propostas de producao, cada uma com gatilho (data comercial, lancamento Apple,
   cambio, oportunidade de mercado) e o Vetor ativo que reforca, ou "fora dos Vetores
   atuais".

   5e. **Branding** — ajustes de comunicacao consistente (bio, destaques, tom,
   identidade) que sustentam a marca profissional.

   Regra da secao 5 inteira: poucas propostas, priorizadas, com recomendacao (qual e a
   aposta mais forte e por que), nunca no vacuo, sempre com a ressalva de capacidade
   quando a execucao real esta abaixo do plano.

6. **Opcoes de Vetor** (sempre que houver proposta de linha nova) — 2 a 3 opcoes no
   esquema exato da aba (`Semana` · `Periodo` · `Gancho` · `Ancora` · `Peças` ·
   `Trava` · `Status`, com `Status` = proposto), formato de cada opcao em
   `evolucao-e-propostas.md`. Dizer qual e a recomendada. Ressalva de capacidade em
   cada uma se os Vetores ativos nao estao sendo executados. A auditoria propoe, o
   dono abre — nenhuma escrita automatica na planilha.

7. **Achados criticos (ranking)** — lista curta, numerada, so os que entraram no
   resumo executivo. Este numero e o que vai na propriedade `Achados criticos` do
   Notion. Proposta de evolucao nao conta como achado critico — achado e problema
   diagnosticado, nao sugestao.

8. **Para a proxima rodada** — o que nao foi verificado desta vez (ex: Vetores da
   planilha, cruzamento manual de posts) e qualquer pergunta em aberto para o dono,
   incluindo quais opcoes de Vetor ele decidiu abrir ou descartar.

## Regras de escrita

- Numero real sempre, nunca "parece que caiu" ou "esta bom". Se o dado for
  aproximado (ex: soma manual de uma serie diaria), dizer que e aproximado em vez de
  fingir precisao que a fonte nao garante.
- Nome exato de card, campana, metrica ou data — nunca generico.
- Portugues do Brasil, sem emoji dentro do texto do relatorio (o icone da pagina no
  Notion pode ter emoji, o corpo do texto nao).
