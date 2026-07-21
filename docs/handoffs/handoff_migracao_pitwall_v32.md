# Handoff Migracao Pit Wall (Nucleo) v32

Substitui a v31. Data: 20/07/2026.

---

## 1. Headline: o bloqueador #1 era fantasma, e o silencio do cron acabou

Sessao curta, de volta ao Nucleo (a v31 tinha sido trilha de marketing). Duas coisas:

1. **A prova do caminho feliz do Notion JA EXISTIA.** A v30 e a v31 carregaram
   "provar o sync (1 clique do dono)" como bloqueador aberto. Nao estava aberto:
   `conteudo_sync_log` tem `2026-07-17 05:38:28+00`, `origem=manual`, `ok=true`,
   **63 cards inseridos**, conteudo ate 11/08. Alguem clicou em 17/07 e ninguem
   registrou. O bloqueador viajou morto por duas versoes de handoff.
2. **O cron de sync falhava em silencio. Agora falha na tela.**

| Item | Antes | Agora |
|---|---|---|
| Caminho feliz do Notion | "nao provado" | **Provado desde 17/07 (63 cards)** |
| Cron `conteudo-sync` (jobid 3) | Falha so em `cron.job_run_details` | **Registra falha em `conteudo_sync_log`: a aba Conteúdo mostra `--erro` com o conserto escrito** |
| Molde da Rotina | 0 categorias, 0 tarefas | **6 categorias, 10 tarefas. 8 semeadas para hoje** |

---

## 2. O defeito consertado: falha silenciosa do cron

`fn_conteudo_disparar_sync()` fazia `raise exception` quando o Vault nao tinha a
chave. O `raise` morria em `cron.job_run_details`, onde ninguem olha. Na tela, a
aba Conteúdo so envelhecia ("sincronizado há Xh") sem nunca dizer por que.

Migracao `fase6_d_sync_cron_falha_visivel`. O que mudou:

- Vault faltando: a funcao chama `registrar_falha_sync` para **cada fonte ativa**
  e devolve `null`, em vez de estourar.
- **Nao pode ser `raise exception`.** Dentro da transacao do pg_cron o raise
  desfaria os proprios registros de falha. Armadilha nova, vale para qualquer
  log escrito de dentro de job de cron.
- `raise warning` mantem o rastro no log do Postgres sem derrubar a transacao.
- A mensagem carrega o conserto exato, nao um codigo de erro.

Provado rodando a funcao na mao:

```
retorno = null
conteudo_sync_log topo: 2026-07-21 01:26:52+00 | cron | ok=false |
"Sync automatico nao rodou: Vault sem service_role_key. Conserto: no SQL editor,
 select vault.create_secret('<SERVICE_ROLE_KEY>', 'service_role_key');"
```

ACL conferida DEPOIS do `CREATE OR REPLACE` (que reseta ACL, armadilha ja conhecida):
`{postgres=X/postgres,service_role=X/postgres}`, byte a byte igual a de antes.
`authenticated` e `anon` continuam sem EXECUTE.

---

## 3. Molde da Rotina semeado

Migracao `fase6_e_semear_molde_rotina`. Conteudo escolhido pelo dono.

**Decisao consciente do dono, contra a recomendacao:** foram oferecidas tres
opcoes; a recomendada era a enxuta (4 categorias, 6 tarefas), pelo argumento de
que rotina curta e cumprida bate rotina longa e ignorada, e de que um % que nasce
baixo faz o dono parar de olhar o tile. O dono escolheu a completa. Se o tile de
% viver abaixo de 60% por duas semanas, o problema e o tamanho do molde, nao a
disciplina, e a correcao e cortar tarefa, nao insistir.

| Categoria (`codigo`) | Tarefas |
|---|---|
| `fila_follow_up` Fila & Follow-up | Rodar a Fila do dia até zerar (seg-sex); Atualizar quem respondeu (seg-sex); Revisar lista fria (sex) |
| `captacao` Captação | Registrar as abordagens do dia (seg-sáb) |
| `conteudo` Conteúdo | Conferir o card de hoje (seg-sex); Publicar a peça do dia (seg-sex); Responder DM e comentário (seg-sáb) |
| `loja_estoque` Loja & Estoque | Conferir estoque e preço (seg) |
| `pos_venda` Pós-venda | Checar quem comprou na semana (qui) |
| `fechamento` Fechamento | Fechar o dia: nota e pendências (seg-sáb) |

Provas:
- `fn_rotina_semear()` rodada na mao (o cron jobid 2 das 08:10 UTC ja tinha passado
  hoje com o molde vazio): `{"ok":true,"data":"2026-07-20","isodow":1,"novas":8,"usuarios":1}`.
  **8 e o numero certo**: das 10 tarefas, `Revisar lista fria` (sex) e
  `Checar quem comprou na semana` (qui) nao caem numa segunda. A derivacao por
  ISODOW esta correta contra dado real, nao so no harness.
- Auditoria por trigger disparou: 6 INSERT em `rotina_categoria` + 10 em
  `rotina_tarefa`, append-only.
- `usuario_id` **null** nos 16, de proposito: veio de migracao, nao de sessao de
  usuario. Atribuir ao UID do dono seria mentir na auditoria.

O molde e rascunho. A aba Rotina edita e remove; o `codigo` de cada categoria e
slug estavel gerado uma vez, o `rotulo` fica editavel (invariante 12).

### 3.1 Incremento: analise e frentes (mesma sessao)

Pedido do dono logo depois: "pode incrementar mais coisas observadas na minha
necessidade, analises, frentes". Migracao `fase6_f_molde_rotina_analise_e_frentes`.
Categoria nova `analise` (Análise, ordem 6; `fechamento` foi para 7).

**Regra de desenho aplicada: toda tarefa nova e SEMANAL, um dia so.** O molde ja
pesava na carga diaria e a sessao acabara de alertar para isso; analise por
natureza nao e tarefa de todo dia. Assim a cobertura cresce sem inflar o
denominador do tile de % em cinco dias.

| Tarefa | Dia | Por que existe |
|---|---|---|
| Ler a auditoria da semana e escolher 1 ação | seg | A rotina em nuvem publica a auditoria toda segunda 8h10. Sem humano decidindo, o relatorio apodrece no Notion. |
| Agendar as publicações da semana | seg | Achado #1 da auditoria de 20/07: 0 agendados no Metricool. |
| Pedir depoimento de quem comprou | ter | Pos-venda so tinha 1 tarefa e nenhuma produzia prova social. |
| Revisar preço vs concorrência | qua | Frente de precificacao sem nenhum gatilho recorrente no sistema. |
| Produzir os cards da semana seguinte | qui | Achado #2: agosto nasceu com 3-4 cards contra 15-20 em julho. |
| Revisar o funil: leads entrados vs convertidos | sex | Pendencia 5 (captacao -> lead) sem ninguem olhando o buraco. |
| Fechar a semana: o que funcionou, o que corta | sex | Fecha o laco de calibragem do proprio molde. |

Carga resultante, **medida no banco**, nao estimada:

```
seg 10 | ter 8 | qua 8 | qui 9 | sex 10 | sáb 3 | dom 0
```

`fn_rotina_semear()` rodada de novo hoje: `{"novas":2}` (so as duas de segunda,
sem duplicar as 8 ja semeadas). Idempotencia provada com dado real.

**Ponto de risco nomeado: segunda e sexta com 10 itens.** Sao os dois dias que vao
puxar o % para baixo. Se acontecer, a primeira coisa a cortar e uma das tres de
sexta, nao a Fila.

---

## 4. O que sobrou, e de quem e

**Do dono, 1 linha, nada mais bloqueia:**

```sql
select vault.create_secret('COLE_AQUI_A_SERVICE_ROLE_KEY', 'service_role_key');
```

(chave em Project Settings -> API Keys -> `service_role`; nao passa pelo chat)

Enquanto nao rodar, o sync automatico nao acontece e o conteudo do app fica no
snapshot de 17/07. A diferenca da v31 e que **agora isso aparece na aba Conteúdo**
em vez de sumir. O botao Sincronizar continua funcionando na mao.

Custo consciente aceito na v29 e mantido: a chave-mestra do banco passa a viver
dentro do proprio banco (Vault). Alternativa avaliada nesta sessao e **nao**
adotada: trocar o portao da Edge Function por segredo compartilhado (anon key no
Bearer + header proprio), o que tiraria a chave-mestra do banco mas custaria
redeploy da function, reprova dos tres portoes e o mesmo esforco do dono. Nao
vale re-litigar decisao consciente da v29 por paridade de esforco.

---

## 5. Pendencias

Trilha Nucleo (a #1 e a #2 da v31 saem: uma era fantasma, a outra e a linha acima):

| # | Item | Nota |
|---|---|---|
| 1 | service_role key no Vault | 1 linha do dono. Unico bloqueador real. |
| 2 | Molde: usar e calibrar | Semeado hoje. Cortar tarefa se o % viver baixo (secao 3). |
| 3 | Calibrar meta de captacao | 10/dia segue chute. |
| 4 | Ligar captacao -> lead | `captacao.virou_lead_id` sem preenchimento. |
| 5 | Dashboard: metrica antes da view | Segurado. |
| 6 | `registrar_nota` sem uso real | Continua. |
| 7 | Aba padrao: Fila ou Hoje? | Decisao do dono, custo 1 linha. Agora que Hoje tem conteudo, vale reabrir. |
| 8 | Leaked Password Protection | Bloqueada, plano Pro. |
| 9 | `Desktop/pitwall deploy/` | Monolito morto, candidato a apagar. |
| 10 | Token do GitHub em texto puro | Revogar se ainda valer. |
| 11 | Legado: Estrategia, Metricas, Evolucao | Fase 7+. |
| 12 | Baselines `.antes` | Repontar ao comecar a proxima obra. |

Trilha Marketing (inalterada, ver v31 secao 6 itens 14 a 18): publicacao real
abaixo do plano, agosto sem conteudo, cards com `Data` divergente, Vetores nao
auditados, pico de 24/06 nao investigado. **Mais a pendencia da v31 secao 8bis:
rodar uma vez no formato novo (com o braco propositivo).**

---

## 6. Armadilhas novas

- **`raise exception` dentro de job de pg_cron apaga o proprio log de falha.**
  Se a funcao registra a falha numa tabela, ela tem que RETORNAR, nao estourar.
  `raise warning` para o rastro no log do Postgres.
- **Bloqueador em handoff sem prova de estado apodrece.** "Falta 1 clique do dono"
  ficou duas versoes depois de o clique ter acontecido. Antes de repetir um
  bloqueador herdado, **consultar o banco**. O arranque do CLAUDE.md ja manda
  ("verificar o estado vivo do banco antes de tocar em qualquer coisa"); a v31
  copiou a lista da v30 sem rodar um select.

---

## 7. Invariantes reforcados

- **O estado vivo ganha do handoff.** Handoff e memoria de decisao, nao fonte da
  verdade sobre o estado. O banco e.
- **Falha tem que ser visivel onde o dono olha.** "Faça sempre palpável" vale
  tambem para o erro: log que so existe em `cron.job_run_details` e silencio.
- **Auditoria nao mente sobre autoria.** Escrita por migracao entra com
  `usuario_id` null.
