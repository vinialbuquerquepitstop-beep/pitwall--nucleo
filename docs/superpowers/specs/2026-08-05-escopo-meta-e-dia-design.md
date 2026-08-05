# Spec: Escopo, a meta da frente e o dia que a serve (Fatia 2)

Data: 05/08/2026. Estado: desenho aprovado em conversa, nao implementado.

Continua a `2026-08-04-escopo-frentes-design.md`, que produziu a Fatia 1 (frentes,
acoes, placar, auditoria). **Onde as duas discordarem, esta vale**, e a secao 2
abaixo nomeia cada divergencia.

---

## 1. O problema

A Fatia 1 subiu e a aba abre vazia. Medido no banco em 05/08/2026:

| frente | acoes vivas |
|---|---|
| `colaboradores` | 1 |
| `producao_marketing`, `assistencia`, `captacao_organica`, `whatsapp`, `pitscare`, `comercial`, `calculadoras` | 0 |
| `pendencias` | 0 |

Sete das oito frentes em `sem dado`. A aba responde "qual frente eu abandonei" com
silencio.

Mas o furo maior nao e o vazio, e o seguinte: **`escopo_frente` nao tem onde declarar
para onde a frente vai.** A tabela tem `codigo`, `rotulo`, `grupo`, `icone`, `ordem`,
`ativo`. A frente acumula acoes e nunca diz o destino.

Sem destino declarado, `4/7 feitas` nao e progresso: e a fracao de uma lista que
alguem digitou. Quando as 7 acabarem, a frente marca 100 e ninguem sabe se o
laboratorio existe. **E o mesmo defeito da nota escondida, uma camada acima:** o
numero aparece, a referencia dele nao.

Prova viva de que a aba resolve problema real: a frente `pitscare` tem spec de
193 linhas aprovada em 21/07/2026, com 19 scripts prontos, parada na branch
`claude/pitscare-estruturacao-o04knt` ha 15 dias, nunca gravada em
`dicionario_scripts`. Trabalho pronto e invisivel.

## 2. O que esta spec muda na de 04/08

Quatro reversoes, todas por decisao do dono nesta sessao. Ficam registradas porque
handoff que so guarda estado obriga a proxima sessao a redescobrir o porque.

### 2.1 Escopo mede CONSTRUCAO, nao operacao

Definicao do dono, 05/08/2026, textual:

> *"operacoes dessas nao entram no escopo. isso ja esta no hoje. o escopo e pra
> evidenciar frentes que devem ser medidas por progresso, ex, assistencia tecnica e o
> laboratorio, a pitscare e seus beneficios, marketing e producao"*

Assistencia = montar o laboratorio. Pitscare = definir e entregar os beneficios.
Producao e marketing = estruturar a producao. **O que ja roda todo dia nao entra**:
isso e a Rotina alimentando o Hoje.

Isso afina a secao 2 da spec de 04/08, que dizia so que o Escopo "nao e a Rotina".
Agora diz o criterio positivo: entra o que tem estado final, sai o que se repete.

### 2.2 Rotina e frente NAO se amarram

Durante esta sessao foi recomendado dar a `rotina_categoria` um campo `frente`, para
fechar o descompasso medido entre os dois vocabularios:

| categoria da Rotina | tarefas ativas | ocorrencias/semana |
|---|---|---|
| `fila_follow_up` | 3 | 11 |
| `conteudo` | 5 | 18 |
| `captacao` | 1 | 6 |
| `fechamento` | 1 | 6 |
| `analise` | 3 | 3 |
| `loja_estoque` | 2 | 2 |
| `pos_venda` | 2 | 2 |

`loja_estoque`, `analise` e `fechamento` nao tem frente; `colaboradores`,
`assistencia`, `whatsapp` e `calculadoras` nao tem rotina.

**A recomendacao foi derrubada pelo dono e esta CORRETA derrubada.** Pela secao 2.1,
"frente sem rotina" nao e buraco nenhum: rotina e operacao, frente e construcao.
Amarrar as duas ligaria coisas de especies diferentes e faria o placar de construcao
pontuar trabalho repetitivo. `rotina_categoria` fica intocada. O Hoje segue dono
unico do dia a dia.

### 2.3 O ajuste datado sai da Fatia 2

A secao 4.4 da spec de 04/08 desenhou quatro objetos para o escopo semanal: molde,
frentes do molde, ajuste datado, frentes do ajuste, mais a regra de resolucao e o
selo `ajustado` na tela.

**Cortado: ficam so os dois primeiros.** Sem ajuste nao existe duas-fontes-para-o-
mesmo-dia, entao some junto toda a maquinaria de declarar qual vence. Ajuste so faz
sentido depois de existir molde rodando que alguem queira furar. Entra quando a
necessidade aparecer, com a regra de resolucao e o selo intactos como projetados.

### 2.4 Cinco frentes sobem sem meta, de proposito

Ver secao 5. Decisao do dono: zero meta inventada.

---

## 3. Modelo de dados

### 3.1 `escopo_frente.meta` (Fatia 2a)

Uma coluna: `meta text null`. Sem tabela nova.

`null` nao e ausencia acidental, e **estado declarado**: a frente diz "nao sei para
onde estou indo", e a tela mostra isso com o mesmo peso com que mostra a nota.

Teto de **200 caracteres**, com **recusa explicita**. Nunca truncar em silencio
(licao 4.3 do handoff v46: texto cortado sem aviso e pior que texto recusado).

Escrita por `definir_meta_frente(p_frente_id uuid, p_meta text)`. `p_meta` nulo ou
so espaco LIMPA a meta e volta a travar o teto da secao 4, em vez de gravar frase
vazia que a tela leria como meta declarada.

### 3.2 `escopo_frente_evento` (Fatia 2a, append-only)

`id` · `tenant_id` · `frente_id` · `meta_antes` · `meta_depois` · `em` · `por`.

Gravado por **trigger**, nunca por insert manual dentro da RPC. E a decisao 6 do v46
aplicada de novo: auditoria que depende de todo mundo lembrar de chamar a RPC certa
nao e auditoria, e convencao. A Fatia 1 aprendeu isso com `UPDATE` direto em
`escopo_acao` gerando zero eventos.

Justificativa de existir: a meta e a referencia contra a qual a nota e lida. Se ela
mudar em silencio, todo o historico de nota daquela frente perde sentido, sem deixar
rastro de que a regua mudou.

`authenticated` recebe SELECT e INSERT, nunca UPDATE nem DELETE (invariante 6).
Trigger em `privado`, invisivel ao PostgREST (invariante 8).

**Este objeto e o unico item desta spec que o dono nao pediu explicitamente.** Se ele
quiser cortar na revisao, o resto do desenho continua de pe: some so o rastro de
mudanca de meta.

### 3.3 Molde semanal (Fatia 2b)

- `escopo_dia_molde`: `id` · `tenant_id` · `dia_semana` (1 a 7, unique por tenant) ·
  `objetivo text null` · `ativo` · `criado_em` · `atualizado_em`. Sete linhas
  permanentes, semeadas.
- `escopo_dia_molde_frente`: `tenant_id` · `molde_id` · `frente_id`, chave composta
  (`molde_id`, `frente_id`). N frentes por dia, zero e valido.

Todas com `tenant_id not null` e policy usando `privado.fn_tenant_atual()`
(invariantes 7 e 8). Nenhuma recebe TRUNCATE (invariante 9).

---

## 4. A nota, e o teto que a meta impoe

Regra nova, e ela e o coracao desta fatia:

> **Frente com acoes mas sem meta declarada nao pode exibir `a frente`.**
> A nota calcula normal e e exibida com as parcelas de sempre, mas a faixa para em
> `normal` (teto 69) e a linha ganha o selo **`meta nao declarada`**.

Sem isso, tres acoes bobas com duas fechadas cravam `a frente` numa frente que nao
tem destino. O painel exibiria desempenho onde existe ausencia de referencia, que e
exatamente a mentira que a faixa `sem dado` existe para evitar.

Declarar a meta destrava o teto na mesma leitura. Limpar a meta volta a travar.

**Precedencia das faixas**, do mais forte para o mais fraco:

1. `sem dado` — zero acao viva na frente. Vence sempre, tenha meta ou nao: o que
   existe ali e ausencia de dado, nao desempenho.
2. teto por `meta nao declarada` — tem acao, nao tem meta. Faixa maxima `normal`.
3. faixas normais — `a frente` >= 70 · `normal` 40 a 69 · `em baixa` < 40.

O selo `meta nao declarada` aparece tambem em frente `sem dado`, porque as duas
lacunas sao independentes e o dono precisa saber se falta acao, falta meta, ou ambas.

Nada disso vira coluna: nota, faixa, teto e selo calculam na LEITURA, no fuso do
Brasil (invariantes 4 e 10).

A quarta parcela (Atraso) e a mudanca de pesos continuam na Fatia 3, e a tela
continua obrigada a declarar o corte quando isso acontecer.

---

## 5. A semeadura: 3 metas fundamentadas, 5 em branco

Das 8 frentes, so 3 tem evidencia no repo ou no banco que sustente uma meta. Escrever
as outras 5 seria inventar, e inventar aqui reproduz o que o dono reprovou em 04/08
(backlog disfarcado de mapa), agora com placar dando nota por cima.

**Decisao do dono, 05/08/2026: as 5 sobem sem meta, e a tela cobra.**

### 5.1 As tres que entram semeadas

Texto exato proposto. **Nada entra no banco antes de o dono aprovar estas frases.**

**`pitscare`**
> meta: `Os 6 passos do perfil comprou falando com voz de cuidado, no ar e provados na Fila.`

Marcos (viram `escopo_acao`):
1. Fundir a branch `claude/pitscare-estruturacao-o04knt` na `main`
2. Gravar os 19 scripts em `dicionario_scripts` (perfil `comprou`, passos 1 a 6)
3. Provar que `sugerir_mensagem` devolve o script novo nos 6 passos
4. Cor de identidade do Pitscare — entra como `travado`, motivo
   `adiado pelo dono em 21/07/2026`

Fonte: `docs/superpowers/specs/2026-07-21-pitscare-estruturacao.md` na branch citada.

**`calculadoras`**
> meta: `O consultor cota sozinho, sem te perguntar preco.`

Marcos:
1. Backend e login do parceiro na calc existente `/calc/consultor/` (vitrine nova ja
   reprovada pelo dono)
2. Tabela de preco dentro da validade
3. Auditoria de divergencia entre `calc_dados` e `public/calc/consultor/dados.js`

Fonte: `.claude/skills/calculadoras/SKILL.md` e a memoria de escopo do parceiro.

**`producao_marketing`**
> meta: `A semana seguinte pronta antes de comecar.`

Marcos:
1. Escrita de volta no Notion: mover card no kanban dispara
   `PATCH /v1/pages/{page_id}` — entra como `travado`, motivo
   `falta a capability "Update content" no NOTION_TOKEN, ato do dono em notion.so/profile/integrations`

Fonte: as tarefas ja vivas em `rotina_tarefa` (`Produzir os cards da semana seguinte`,
quinta; `Agendar as publicacoes da semana`, segunda) e a secao 12 do handoff v33.

### 5.2 As cinco que sobem em branco

`assistencia`, `colaboradores`, `captacao_organica`, `whatsapp`, `comercial`.

Aparecem com o botao `declarar meta` no lugar da frase e com o selo
`meta nao declarada` no placar. O dono preenche pela propria aba.

Risco aceito e nomeado: podem ficar em branco por semanas, como a Pitscare ficou.
A diferenca e que agora o branco esta visivel na tela que ele abre.

---

## 6. Tela

### 6.1 No Escopo

Ordem dos blocos (a de 04/08, com o mapa entrando no lugar previsto):

1. **Placar** das 8 frentes, com o selo `meta nao declarada` onde couber.
2. **Mapa dos 7 dias** (Fatia 2b): objetivo do dia e as frentes que ele serve.
3. **Frentes e acoes**: o bloco de cada frente **abre pela meta**. Sem meta, no lugar
   da frase vai o botao `declarar meta`.
4. **Pendencias**, separada no fim.

Editar a meta segue o padrao de criar acao, com o teto de 200 e recusa explicita.

### 6.2 No Hoje

Uma linha, no topo:

```
Hoje serve: Pitscare · proximo marco: gravar os 19 scripts em dicionario_scripts
```

Regras da linha, todas de honestidade:

- **Dia sem frente no molde:** a linha aparece assim mesmo, dizendo
  `Hoje nao serve nenhuma frente`. Calar aqui seria o Hoje escondendo que a semana
  esta sem construcao.
- **Dia com exatamente uma frente:** mostra o proximo marco dela. Proximo marco e a
  acao nao arquivada em `fazendo` de `criado_em` mais antigo; sem nenhuma, a de menor
  `ordem` em `a_fazer` (empate desempatado por `criado_em`); sem nenhuma, a linha diz
  `sem marco aberto`. Acao `travado` nunca e proposta como proximo marco: ela esta
  parada por motivo declarado.
- **Dia com duas ou mais frentes:** nomeia todas e NAO escolhe marco
  (`3 frentes hoje, ver Escopo`). Escolher uma pela ordem seria arbitrario e a linha
  passaria a sugerir prioridade que ninguem declarou.
- Linha, nunca bloco: o Hoje ja tem queixa registrada de altura no celular.

A linha le uma RPC propria e leve (`escopo_dia_hoje()`), nao `escopo_completo()`: o
Hoje nao paga a leitura da aba inteira para exibir uma linha.

---

## 7. Fatias

Cada uma termina em algo que o dono abre.

**Fatia 2a** — a frente declara destino.
Coluna `meta`, `escopo_frente_evento` com trigger, RPC de definir e limpar meta, teto
em `normal` no `escopo_completo()`, tela do Escopo com meta / botao / selo, e a
semeadura das 3 metas aprovadas com seus marcos.
Abre e ve: 3 frentes com destino e marcos reais, 5 cobrando meta.

**Fatia 2b** — o dia serve uma frente.
`escopo_dia_molde` e `escopo_dia_molde_frente` semeadas, grade editavel no Escopo,
`escopo_dia_hoje()` e a linha no Hoje.
Abre e ve: a semana dizendo o que constroi em cada dia, e o Hoje cobrando.

---

## 8. Criterio de aceite

Nao e boa intencao, e a lista do que precisa estar verde. O handoff v46 registrou
**69 assercoes verdes convivendo com quatro botoes que so lancavam TypeError**,
porque a prova de escrita era string-matching sobre a fonte, que casa igual com o
codigo quebrado.

**Regra dura desta obra: nenhuma prova de caminho de escrita por `SRC.indexOf`.**

Frontend (`ferramentas/harness.py`, Chrome headless):
1. Clicar em `declarar meta` e assertar a RPC chamada, com os argumentos.
2. Clicar e cancelar: nenhuma RPC chamada.
3. Caminho de erro: RPC devolvendo `r.error` renderiza erro visivel, nao silencio.
   (Buraco nomeado na pendencia 3 do v46.)
4. `pode_editar = false`: o botao `declarar meta` nao existe no DOM.
5. Nenhum TypeError no console durante os quatro casos acima.
6. Frente sem meta exibe o selo; com meta, nao exibe.
7. (2b) Editar o molde de um dia e assertar a RPC; a linha do Hoje muda junto.
8. (2b) Dia vazio renderiza `Hoje nao serve nenhuma frente`; dia com 2+ frentes
   renderiza a contagem e nao renderiza marco.

SQL (`ferramentas/prova_escopo.sql`):
9. Meta de 5000 chars recusada E meta de 200 exatos aceita. Duas assercoes, nao uma:
   com so a primeira, o teto poderia estar em qualquer lugar entre 1 e 5000.
10. As **quatro fronteiras de faixa: 39, 40, 69, 70**, incluindo a faixa `normal`,
    que nunca foi assertada. Deixa de ser opcional: o teto sem meta mexe exatamente
    na fronteira dos 70.
11. Frente com nota calculada >= 70 e `meta is null` le `normal` com selo; declarada
    a meta, a MESMA frente le `a frente`, sem outra mudanca.
12. `sem dado` vence o teto: frente sem acao e sem meta le `sem dado`, nao `normal`.
13. Trigger de `escopo_frente_evento`: um `UPDATE` direto na coluna `meta` gera
    exatamente um evento, com `meta_antes` e `meta_depois` corretos.
14. `authenticated` nao tem UPDATE nem DELETE em `escopo_frente_evento`; vendedor
    nao le a meta de outro tenant.

Integridade e regressao:
15. `node --check public/app.js` EXIT 0; `python ferramentas/validar.py` sem
    reprovacao NOVA (as 4 herdadas seguem abertas por decisao do dono na v45; nao
    repontar `.antes`);
16. `prova_trilho.py` e `diag_mobile.py 360 / 390 / 414` EXIT 0;
17. Integridade do `app.js` minificado provada por **reaplicar o patch sobre o
    baseline e exigir igualdade total**, com CRLF normalizado. Comparacao de prefixo
    e sufixo nao vale (v46 secao 6.2).

Entra junto, ja escopada na pendencia 5 do v46:
18. Trocar `q()` por `qF()` no Escopo, para cada toque parar de recarregar `v_lead`
    inteiro. Assertar que uma escrita no Escopo nao dispara a leitura da base de leads.

---

## 9. O que continua cortado, e declarado

- **O trilho da frente segue cinza.** A spec de 04/08 (secoes 4.1 e 6) prometia cor
  por hash deterministico do `codigo`; o que subiu e
  `border-left:3px solid var(--line-forte)` fixo, medido `rgb(211,216,226)` em todas.
  `prova_trilho.py` nao foi estendida. Nao e ilegivel: o icone carrega a distincao,
  que era o papel dele no sistema Trilho x Sinal. Fica para a Fatia 3.
- **Ajuste datado do escopo semanal**, ver secao 2.3.
- **Criterio de aceite por acao**, cortado pelo dono na Fatia 1: o painel aceita
  "feito" declarado sem prova anexada.
- **`data_alvo`, prioridade e esforco** existem no schema desde a Fatia 1 e seguem
  sem tela ate a Fatia 3.

---

## 10. Decisoes desta sessao, em uma lista

1. Escopo mede construcao; operacao recorrente fica no Hoje (dono).
2. Rotina e frente nao se amarram; recomendacao contraria derrubada (dono).
3. `meta` e coluna em `escopo_frente`, texto livre, teto 200 com recusa.
4. Frente sem meta tem teto de faixa em `normal`, com selo.
5. `sem dado` vence o teto.
6. 3 frentes semeadas com meta fundamentada, 5 em branco cobrando (dono).
7. Ajuste datado cortado desta fatia.
8. Diretriz diaria e uma linha no Hoje, nunca bloco (dono).
9. Dia com 2+ frentes nao escolhe marco.
10. Mudanca de meta e auditada por trigger — unico item nao pedido pelo dono,
    cortavel na revisao.
