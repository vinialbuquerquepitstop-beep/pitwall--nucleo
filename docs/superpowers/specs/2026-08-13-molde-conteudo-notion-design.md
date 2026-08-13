# Spec: o molde de conteudo sai do Notion e entra na aba Conteudo

Data: 13/08/2026. Fatia 0 ja executada e provada (commit `e175c97`).

Regra de ouro do dono, literal: **o app NUNCA declara grade. Ele le. Se o fetch
falhar, usa o ultimo molde em cache e exibe aviso de staleness. Nunca cai para um
default embutido, porque default embutido foi exatamente a causa das 4 grades
conflitantes.**

---

## 1. O problema, e a correcao do enunciado

O pedido chegou como "a aba Conteudo deve parar de ter a grade hardcoded".
Medido antes de escrever qualquer linha:

```
grep -rn -E "PITSTOP_MOLDE|reels_semana|story_slots|pitstop-grade-conteudo" . --exclude-dir=.git
  -> 0 arquivos
```

**A aba Conteudo nao tem grade nenhuma, hardcoded ou nao.** Ela e o kanban de 4
colunas lendo `conteudo_periodo`, sobre `public.conteudo` (104 linhas, cache do
Calendario). Nao existe grade, motor diario, slot de story nem meta de Reels em
`app.js`, `app.css` ou `index.html`.

Isto nao e parar de declarar. **E passar a exibir.** E construcao, nao
refatoracao, e o custo e outro. O enunciado foi corrigido com o dono antes do
desenho.

A grade chumbada existe, so que fora do app. A pagina do Notion enumera quatro
grades vivas em 13/08/2026 (Vetores 29/06, Principios fixos, Rewire 11/07,
Calendario montado). **Ha uma quinta**, e e a que o Claude le toda sessao:

```
.claude/skills/socialmedia/SKILL.md:126  - Segunda: Reel de Descoberta (alcance)
.claude/skills/socialmedia/SKILL.md:127  - Quarta: Carrossel de Autoridade (salvamentos)
```

O molde do Notion poe carrossel na **terca**. A skill diz quarta.

### 1.1 A fonte unica contradiz a si mesma

Na MESMA secao `🧭 GRADE OFICIAL · MOLDE DE CONTEÚDO v3`:

| | tabela em prosa (secao 1) | bloco JSON (secao 5) |
|---|---|---|
| quinta | `Reel TOPO`, 10h-11h | `"feed": null` |
| sabado | `Reel de humor` | `"feed": null` |
| alvo | "5 Reels + 1 carrossel" | `"reels_semana": 3` |
| divergencia | 🔴 "aberta, decisao do dono" | fechada, ja em 3 |

O cabecalho da v3 registra que a meta caiu de 5 para 3 por capacidade real de
gravacao, e o JSON foi atualizado. **As tabelas em prosa ficaram na v2.** A
pagina criada para acabar com quatro grades nasceu com duas dentro dela.

**Decisao do dono: alinhar a prosa ao JSON.** O JSON nao muda. Sai antes de a
tela subir, senao o app fica certo e parecendo errado.

---

## 2. O que a Fatia 0 provou (nao deduziu)

Sondar pelo MCP do Notion nao prova nada: e credencial diferente da que roda na
Edge Function, a mesma armadilha que o CLAUDE.md registra sobre a capability
"Update content". Entao a sonda rodou DENTRO da function, disparada por
`net.http_post` com a chave saindo do Vault, o mesmo caminho do cron das 08h30.

Edge function version 5, 13/08/2026:

| medida | resultado |
|---|---|
| pagina legivel pelo `NOTION_TOKEN` da function | **sim**, status 200 |
| blocos lidos | 75 |
| blocos com `molde: "pitstop-grade-conteudo"` | **exatamente 1** |
| `block_id` | `87a90569-8117-4e35-80db-a47d9fb54e9f` |
| `version` / `vigente_desde` | 3 / 2026-08-13 |
| `semana` / `story_slots` | 7 dias / 7 slots |
| `metas` | `reels_semana 3 · carrossel_semana 1 · stories_semana 49` |
| profundidade | 0 (filho direto da pagina) |
| bytes | 1838 |

**A previsao estava errada.** Eu previ 404 por a pagina nao estar compartilhada
com a integracao. Ela esta compartilhada. Nenhuma acao do dono no Notion e
necessaria para o app ler.

Sem regressao no caminho normal, depois do deploy: `fn_conteudo_disparar_sync()`
devolveu `ok:true`, 41 vistos, 41 atualizados, **0 sumidos**, `completo:true`,
zero avisos, 104 cards vivos.

---

## 3. O desenho

### 3.1 Onde a leitura acontece

O navegador nao pode chamar `api.notion.com` (CORS, e o token vazaria no
`app.js`). O andar de servidor ja existe e ja tem `NOTION_TOKEN`:
`supabase/functions/sincronizar-conteudo/index.ts`. O molde entra ali, **sem**
virar segunda integracao e sem segundo botao.

`GET /v1/blocks/{page_id}/children`, paginado, procurando bloco `type:'code'`
que parseie e tenha `molde === "pitstop-grade-conteudo"`.

Duas regras vindas do proprio arquivo:

- **Nao procurar pelo titulo da secao.** `🧭 GRADE OFICIAL · MOLDE DE CONTEÚDO v3`
  e rotulo, e mudou de v2 para v3 no mesmo dia. A chave e o campo `molde` dentro
  do JSON (invariante 12). E o mesmo padrao de `tituloDe()`, que acha o titulo
  pelo `type:'title'` para sobreviver a renomeacao.
- **O page id NAO entra no `index.ts`.** Vai em `conteudo_fonte`, coluna nova
  `notion_molde_page_id`. O cabecalho do arquivo proibe: "Se um numero de janela
  aparecer neste arquivo, trocamos o defaultRoutine() chumbado por janela
  chumbada no index.ts, e nao migramos nada."

A recursao ate profundidade 2 fica, mesmo com a sonda tendo achado o bloco em
profundidade 0: cobre o dono mover o bloco para dentro de um toggle. **Nao desce
em `child_page` nem `child_database`**, senao varre os Pitwalls semanais e o
Calendario aninhados, ou seja, rasteja o workspace atras de um bloco que mora na
raiz.

Mais de um bloco com aquele `molde`: ganha o de maior `version`; empate e ERRO
que recusa a escrita, porque dois moldes vigentes e a doenca original.

**Falha do molde nao derruba o sync do calendario, e o contrario tambem nao.**
Try/catch separados, linhas de log separadas em `conteudo_sync_log`.

### 3.2 A trava que faz a regra de ouro ser real

Molde invalido **nunca** sobrescreve cache bom. E a irma da trava que ja existe
no arquivo ("payload parcial jamais chega no soft delete"). Recusa, mantendo o
cache anterior e gravando a razao, quando:

1. nao parseia como JSON;
2. `molde !== "pitstop-grade-conteudo"`;
3. `version` nao e inteiro positivo;
4. `version` **menor** que a em cache (alguem colou um bloco antigo);
5. `semana` nao traz os 7 dias, com `dia` nos 7 codigos conhecidos;
6. `story_slots` vazio ou `metas` ausente.

### 3.3 Cache: `public.conteudo_molde`

PK `(tenant_id, version)`, append-only. Vigente = maior `version`.

| coluna | por que |
|---|---|
| `tenant_id` | invariante 7, com policy de RLS que o usa |
| `version` | a chave de ordenacao, vinda do JSON |
| `payload jsonb` | o molde inteiro, como veio |
| `vigente_desde date` | do JSON |
| `hash text` | pega quem editou sem subir a `version` |
| `lido_em timestamptz` | base do staleness |
| `notion_block_id` | rastreio ate a origem |

Append-only, e nao uma linha so, de proposito: o cache do Calendario foi
dispensado de auditoria no v29 por ser "fotocopia de sistema de terceiro", mas
**trocar o molde nao e fotocopia, e decisao** que revoga a cadencia da operacao
inteira (invariante 6). Sem isso ninguem responde "desde quando a meta era 5",
que e exatamente a pergunta que originou esta obra. Custa uma tabela.

Payload mudou sem subir a `version`: o `hash` difere, a linha daquela `version` e
atualizada, e o sync grava aviso. A propria pagina manda subir a version ("Não
editar à mão sem subir a `version`"); o hash e quem cobra.

**Esta e a UNICA escrita que nao e append**, e ela precisa estar nomeada para o
"append-only" acima nao virar meia-verdade. Uma `version` nunca some e nunca vira
outra `version`; o que pode ser reescrito e o corpo de uma `version` que o dono
editou sem renumerar, que e uma violacao da regra da propria pagina. A alternativa
(recusar a edicao) deixaria o app mostrando um molde que nao existe mais no Notion,
e mentir sobre a fonte e pior do que reescrever uma linha com aviso.

Cache em Supabase, nao em `localStorage`: o dono roda o Pit Wall em mais de uma
maquina, e staleness por dispositivo mentiria em uma delas.

### 3.4 Leitura pelo app: RPC `molde_semana(p_ref date default null)`

Devolve:

- `molde` (payload), `version`, `vigente_desde`;
- `lido_em`, `dias_desde_leitura`, `stale` (bool);
- `semana_ini`, `semana_fim`: **segunda a domingo no fuso do Brasil**
  (invariante 10, `CURRENT_DATE` proibido);
- `dias[7]`: `dia`, `data`, `motor`, `feed_previsto`, `horario`, `existe`,
  `no_ar`, `fora_do_molde`;
- `stories`: previstos (`metas.stories_semana`) x existentes na semana;
- `resumo`: planejado X de Y, no ar X de Y;
- `avisos[]`.

Definicoes, sem colapsar:

- `existe` = ha card em `public.conteudo` com `sumiu_em is null`, `data` = a do
  dia, tipo mapeado igual ao previsto, e `status_codigo <> 'descartado'`.
- `no_ar` = o mesmo card com `status_codigo = 'publicado'`.
- `fora_do_molde` = card com `tipo_codigo` em (`reels`, `carrossel`, `feed`)
  naquela data, quando o molde nao pede nada no dia ou pede tipo diferente.
  `story` NUNCA entra aqui: story tem regua propria (os 7 slots) e contaria
  errado, marcando fora do molde os 7 stories que o molde manda existir.

**A armadilha de vocabulario, nomeada para nunca colapsar:** o campo do molde se
chama `feed` (a peca de feed do dia), e o Calendario tem um TIPO chamado `feed`
(post estatico). Sao coisas diferentes com o mesmo nome. A ponte:

| molde (`feed`) | `conteudo.tipo_codigo` |
|---|---|
| `reel_topo` | `reels` |
| `reel` | `reels` |
| `carrossel` | `carrossel` |
| `null` | nada previsto |

A ponte mora na RPC, num lugar so. **Valor desconhecido vira aviso visivel**
("tipo `X` do molde nao reconhecido"), nunca ausencia silenciosa: silencio aqui
reproduziria o bug do titulo nulo com `ok:true` que o `tituloDe()` existe para
evitar.

O limiar de staleness vai em `conteudo_fonte`, **nao no JS**: a pendencia 4 do
v55 ja registra sete cortes numericos cravados no JS contra o invariante 11, e
esta obra nao abre o oitavo. Valor inicial 24h, porque o cron roda diario.

### 3.5 Tela

Secao nova no topo da aba Conteudo, acima do kanban. Tres linhas por dia, que e
a forma escolhida pelo dono contra as duas alternativas mais simples:

```
MOLDE v3 · vigente desde 13/08          [lido do Notion 09:12]

         seg   ter   qua   qui   sex   sab   dom
 molde   reel  carr  reel   -    reel   -     -
 existe   ok   FALTA  ok    -     ok    -     -
 no ar    --    --    --    -     --    -     -

 planejado 3 de 4 pecas · no ar 0 de 4
 falta: carrossel de terca · atrasado: reel seg, reel qua
 stories 8 de 49 · fora do molde: feed de sabado
```

**Previsto x existe (planejamento) e previsto x no ar (execucao) NUNCA se somam
num chip so.** E a mesma regra que o painel ja aplica em "publicadas x
afericoes", que o grafico do Escopo aplica em cor x hachura, e que os
invariantes 2 e 3 aplicam em toque x respondido e nivel x status: dois canais,
duas perguntas, sem disputa. Colapsar diria "Reels 3 de 3" numa semana em que
zero Reel foi ao ar.

Estados:

- **Cache vazio nao renderiza grade.** Renderiza "Nunca consegui ler o molde do
  Notion" e o botao Sincronizar. Esse e o unico jeito de a regra de ouro nao ser
  slogan.
- **Stale renderiza a grade com a idade DECLARADA**, no padrao que a aba ja usa
  ao declarar a janela: tela que omite recorte mente.
- Molde com aviso: a faixa de aviso aparece acima da grade, nunca no lugar dela.

**Zero token de cor novo.** Reuso de `--quente` / `--morno` / `--frio` ja
calibrados, e a distincao a carregam icone e palavra, pela licao do trilho (as
colisoes de luminancia entre 1.14 e 1.44 provam que matiz sozinho nao separa).
Se algum token novo virar inevitavel, passa por `validate_palette.js` antes de
entrar, nunca pelo olho: e a licao da secao 4 do v55.

A grade de 7 colunas reusa a **escala** da Rotina, nao a classe, seguindo o
precedente ja escrito em `app.css:1670`.

---

## 4. Contrato de dados: a semana corrente, medida

Dado real de 10 a 16/08/2026, 12 cards vivos, cruzado com o molde v3:

| dia | molde v3 pede | calendario tem | leitura |
|---|---|---|---|
| seg 10 | `reel_topo` | reels, `a_produzir` | existe, nao foi ao ar |
| ter 11 | `carrossel` | so story (publicado) | **FALTA** |
| qua 12 | `reel` | reels, `a_produzir` | existe, nao foi ao ar |
| qui 13 | nada | 2 stories | ok |
| sex 14 | `reel` | reels, `a_produzir` | existe |
| sab 15 | nada | **feed**, `a_produzir` | **fora do molde** |
| dom 16 | nada | story | ok |

Resumo que a tela vai mostrar: **planejado 3 de 4 · no ar 0 de 4 · stories 8 de
49 · carrossel 0 de 1**.

Onze dos doze cards estao em `a_produzir`. O numero de stories (8 contra 49
previstos) e o achado mais duro desta leitura, e ele nasce da tela, nao de
analise.

---

## 5. O que fica cortado, e declarado

- **Escrita de volta no Notion a partir do molde** (criar o card que falta).
  Bloqueada pela capability "Update content", pendencia 9 do v55. O botao nao
  entra nem desabilitado: botao morto e promessa.
- **Historico de aderencia ao molde** (aderencia por semana ao longo do tempo).
  A tabela append-only ja guarda o lastro; a tela fica para depois.
- **Slots de story dia a dia.** A v1 mostra o agregado da semana (8 de 49). Sete
  slots x sete dias e uma segunda grade de 49 celulas, e ela nao cabe junto da
  primeira sem virar outra tela.
- **Os `tetos`, `proibicoes`, `garantia` e `caixinha` do JSON.** Sao lidos e
  guardados no payload, e nao sao renderizados nesta fatia.

---

## 6. Criterio de aceite

Cada item e reexecutavel, e **o que vale e o EXIT CODE, nunca o texto verde da
saida**.

### Cano e banco (`prova_molde.sql`, via MCP)

1. Molde valido grava uma linha em `conteudo_molde` com `version`, `hash`,
   `lido_em` e `notion_block_id` preenchidos.
2. Segunda leitura do mesmo molde nao cria linha nova; atualiza `lido_em`.
3. Payload alterado sem subir `version`: `hash` muda, linha e atualizada, e
   nasce aviso em `conteudo_sync_log`.
4. `version` menor que a vigente e RECUSADA, e o cache anterior permanece byte a
   byte igual.
5. JSON que nao parseia: recusa, cache intacto, razao gravada.
6. `molde` diferente de `pitstop-grade-conteudo`: recusa.
7. `semana` com 6 dias: recusa.
8. Falha do molde NAO impede o sync do calendario na mesma execucao (e o
   inverso), provado com as duas linhas de log separadas.
9. RLS: tenant errado le zero linhas de `conteudo_molde`.
10. `authenticated` nao tem INSERT, UPDATE nem DELETE em `conteudo_molde`; so a
    RPC do sync escreve.

### Tela (`harness.py`, Chrome headless)

11. Com cache preenchido, a grade renderiza **7 colunas**.
12. Linha `molde` mostra `reel · carr · reel · - · reel · - · -` para o v3.
13. Terca sem carrossel marca **FALTA**; segunda e quarta marcam existe.
14. Nenhum dia marca `no ar` quando nenhum card esta `publicado`.
15. `existe` e `no ar` sao elementos DISTINTOS no DOM; nao ha chip unico que
    some os dois.
16. Sabado com card de tipo `feed` aparece em **fora do molde**.
17. Rodape declara stories `8 de 49`.
18. **Cache vazio NAO renderiza grade nenhuma**; renderiza o estado "nunca li o
    molde" mais o botao Sincronizar.
19. `lido_em` velho renderiza a grade MAIS o aviso de staleness com a idade
    declarada.
20. Tipo desconhecido no molde vira aviso visivel, e o dia nao some da grade.
21. Zero TypeError no console.
22. Assercoes leem o DOM RENDERIZADO (so `#lista`), nunca
    `document.body.textContent`.

### Prova que morde (a licao das 69 assercoes verdes do v46)

23. Em copia temporaria, **injetar um default embutido no JS** (uma grade
    literal usada quando o cache esta vazio) e provar que a suite **REPROVA**
    com EXIT 1. Sem este item, "nunca cai para default embutido" e fachada.
24. Em copia temporaria, apagar o aviso de staleness e provar que a suite
    reprova.

### Regressao e integridade

25. `diag_mobile.py` em 360, 390, 414, 1280 e 1440: **EXIT 0 nos cinco**. Grade
    de 7 colunas em 360px e candidata obvia ao mesmo estouro que deixou o `×`
    fora da tela no v55, e o harness roda numa largura so.
26. `validar.py`, `prova_trilho.py`, `prova_grafico.py` e `node --check
    public/app.js`: EXIT 0.
27. Integridade do minificado: comparar byte a byte **a linha que o patch
    altera** (o roteador, hoje em 2058), nao a linha 1. Comparacao de prefixo e
    sufixo nao vale.
28. O sync do calendario continua devolvendo `completo:true` e `0 sumidos`
    depois da mudanca.

---

## 7. Onde encosta

| arquivo | o que |
|---|---|
| `supabase/functions/sincronizar-conteudo/index.ts` | leitura do molde vira caminho de verdade; **a sonda da Fatia 0 SAI**; page id passa a vir de `conteudo_fonte` |
| banco | coluna `notion_molde_page_id` e limiar de staleness em `conteudo_fonte`; tabela `conteudo_molde` + RLS; RPC de escrita do molde; RPC `molde_semana()` |
| `public/app.js` | `moldeGrade`, `moldeDia`, `moldeRodape`, `moldeAviso`; `renderConteudo` passa a montar a secao acima do kanban |
| `public/app.css` | grade de 7 colunas reusando a escala da Rotina; faixa de aviso |
| `ferramentas/harness.py` | itens 11 a 22 |
| `ferramentas/prova_molde.sql` | itens 1 a 10 |
| Notion | prosa da secao v3 alinhada ao JSON (decisao do dono) |

Toda escrita de schema passa pelo subagent `base`, unico com `apply_migration`.

---

## 8. O que o dono abre no fim

A aba Conteudo, com a grade oficial no topo, lida do Notion, dizendo que a terca
esta sem carrossel, que nenhum dos tres Reels da semana foi ao ar, que ha 8
stories contra 49 previstos, e que o sabado tem uma peca que o molde nao pede.

Nenhuma dessas quatro frases existe hoje em lugar nenhum do sistema.

---

## 9. Decisoes desta sessao, em uma lista

1. O enunciado estava errado: nao ha grade no app para "parar de declarar". E
   construcao. Corrigido com o dono antes do desenho.
2. Espelho **mais** cobranca, contra as opcoes so-espelho e criar-no-Notion.
3. Planejamento e execucao aparecem em duas leituras separadas, nunca somadas.
4. Prosa do Notion se alinha ao JSON; o JSON nao muda.
5. Cache em Supabase, append-only por `version`, nao em `localStorage`.
6. Limiar de staleness em config, nao no JS (invariante 11).
7. Molde invalido nunca sobrescreve cache bom.
8. Zero token de cor novo sem medicao.
9. A sonda da Fatia 0 e temporaria e sai nesta fatia.
