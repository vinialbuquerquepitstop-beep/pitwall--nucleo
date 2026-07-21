# Spec: reorganizacao da hierarquia de informacao do frontend

Data: 20/07/2026. Escopo aprovado pelo dono nesta sessao.

Nota de linguagem: este documento segue a convencao do CLAUDE.md (prosa sem acento,
sem cedilha, sem travessao). Valores reais do sistema (rotulos, codigos, nomes de
funcao, nomes de campo) aparecem com seus caracteres exatos e nao sao alterados.

---

## 1. Problema, medido

Pedido do dono: "reorganize e refaca a base do frontend em relacao a hierarquia das
informacoes. conteudos nao estao compreensiveis. rotina, misturada entre os dias da
semana. precisa ser intuitivo, cores que delimitem objetivos."

Estado vivo do banco em 20/07/2026, consultado antes do desenho (nao herdado de handoff):

### 1.1 Conteudo: a tela e um log, a necessidade e um plano

`public.conteudo`, 66 cards vivos (`sumiu_em is null`), de 2026-07-10 a 2026-08-17.

| status_rotulo | Qtd | Janela |
|---|---|---|
| `A produzir` | 45 | 15/07 a 17/08 |
| `Publicado` | 8 | 10/07 a **14/07** |
| `Descartado` | 6 | 13/07 a 27/07 |
| `Em produção` | 4 | 14/07 a 20/07 |
| `Pronto` | 3 | 13/07 a 22/07 |

Por tipo: `Story` 40, `Reels` 20, `Feed` 6.

`renderConteudo` hoje devolve lista cronologica plana, agrupada por dia
(`div.cont-log` por data), cada item com titulo, subtitulo `tipo · semana`, um
`span.chip` e o link do Notion.

Dois fatos que a tela esconde: **68% da base e backlog nao produzido** e a **ultima
publicacao foi 14/07, seis dias atras**. `Publicado` e `A produzir` saem com o mesmo
chip cinza. Nao ha corte entre passado e futuro nem bloco de semana.

### 1.2 Rotina: a queixa e literal, a causa e a forma

`rotina_categoria` 7 categorias, `rotina_tarefa` 17 tarefas ativas.

`renderRotina` agrupa por **categoria** e escreve os dias como texto via `diasTxt`
(`seg · ter · qua · qui · sex`). Para saber como e a quinta-feira, o dono le 17
linhas e cruza de cabeca.

Carga por dia, derivada de `dias_semana` (ISODOW):

```
seg 10 | ter 8 | qua 8 | qui 9 | sex 10 | sáb 3 | dom 0
```

O handoff v32 secao 3.1 nomeou seg e sex com 10 como ponto de risco. Esse numero
**nao aparece em lugar nenhum da tela**. O dono nao consegue ver o desequilibrio
que precisa corrigir.

### 1.3 Hoje: ordem sem justificativa

`renderHoje` empilha `hojePlacar` + `hojeTarefas` + `hojeNota` + `hojeLembretes` +
`hojeConteudo`. A nota do dia no meio da pilha nao tem razao de ser.

---

## 2. Decisoes do dono, e as que foram contra a recomendacao

| # | Decisao | Recomendacao dada | Escolha |
|---|---|---|---|
| D1 | Escopo | Conteúdo + Rotina + Hoje | **Aceita** |
| D2 | Semantica da cor | Cor = urgencia em tudo, categoria sem matiz | **Hibrido (contra a recomendacao)** |
| D3 | Forma da Rotina | Dia-primeiro com acordeao + barra de carga | **Grade de 7 colunas (contra a recomendacao)** |
| D4 | Eixo do Conteudo | Grade da semana, igual a Rotina | **Kanban de funil com a data em vista** |

**D2, custo aceito conscientemente:** ja existem 6 regioes de matiz ocupadas
(`--quente`, `--morno`, `--frio`, `--accent`, `--ok`, `--erro`). Nao sobram 7 matizes
livres para as categorias. A mitigacao esta na secao 3.

**D3, custo aceito conscientemente:** 7 colunas nao cabem em celular. Atenuante real
descoberto na leitura: a aba Rotina ja e `.aba-rara` no `index.html`, ou seja, ja vive
escondida atras do "Mais" no celular. Ela ja e uma aba de desktop. Mitigacao na secao 4.

**D4 e uma correcao boa:** o kanban puro perderia a data de vista, que e o que decide
o que fazer hoje. Manter a data e dar a ela o sinal de urgencia desarma isso.

---

## 3. Principio do sistema de cor: separacao por canal, nao por matiz

Trilho (identidade de categoria) e sinal (urgencia) nunca disputam o mesmo canal visual.

| | Trilho: quem sou | Sinal: quao urgente |
|---|---|---|
| Forma | barra de 3px na borda esquerda + cor do rotulo | chip preenchido, faixa, numero |
| Croma | baixo, le como cinza tingido | alto, grita |
| Reforco | **sempre acompanhado de icone**, matiz e redundante | matiz + palavra |
| Onde aparece | Rotina, Hoje | Conteúdo, Fila, Hoje |

Consequencia: `Loja & Estoque` pode viver perto do laranja de `--quente` sem
ambiguidade, porque um e barra fina de baixo croma com icone e o outro e chip
preenchido. **Nenhuma cor nova entra como preenchimento.**

Invariantes preservados: 3 (nivel x status), 4 (nivel derivado na leitura),
12 (chave e `codigo`, nunca `rotulo`).

### 3.1 Atribuicao do trilho

Mapa fixo por `codigo` de categoria. `rotulo` e editavel e nunca decide cor.

| `codigo` | Rotulo atual | Trilho proposto |
|---|---|---|
| `fila_follow_up` | Fila & Follow-up | `#5B6BA8` |
| `captacao` | Captação | `#3E8C8C` |
| `conteudo` | Conteúdo | `#7A5FA8` |
| `loja_estoque` | Loja & Estoque | `#A87155` |
| `pos_venda` | Pós-venda | `#6B8C5B` |
| `analise` | Análise | `#5F7386` |
| `fechamento` | Fechamento | `#8C5F7A` |

Categoria nova (o molde e editavel) recebe trilho por hash determinstico do `codigo`
sobre o mesmo anel de 7. Nunca fica sem cor, nunca muda de cor entre sessoes.

### 3.2 Medicao: feita, e passou

Os valores acima foram **medidos em 20/07/2026**, nao escolhidos no olho, com
`ferramentas/contraste.py` (mesma funcao `ratio`, WCAG). Alvo: 3:1 contra `--bg`
`#FFFFFF` para uso como cor de rotulo.

| `codigo` | Hex | vs branco | Veredito | Pior colisao com semantico |
|---|---|---|---|---|
| `fila_follow_up` | `#5B6BA8` | 5.11 | OK | `--erro` 1.38 |
| `captacao` | `#3E8C8C` | 3.94 | OK | `--ok` 1.18 |
| `conteudo` | `#7A5FA8` | 5.21 | OK | `--erro` 1.35 |
| `loja_estoque` | `#A87155` | 4.07 | OK | `--ok` 1.22 |
| `pos_venda` | `#6B8C5B` | 3.80 | OK | `--ok` **1.14** |
| `analise` | `#5F7386` | 4.90 | OK | `--erro` 1.44 |
| `fechamento` | `#8C5F7A` | 5.21 | OK | `--erro` 1.35 |

Comando exato, da raiz do repo:

```
python -c "import sys; sys.path.insert(0,'ferramentas'); from contraste import ratio; print(ratio('#5B6BA8','#FFFFFF'))"
```

(`contraste.py` imprime seu proprio relatorio ao ser importado. Isso e esperado.)

**Leitura honesta dos numeros de colisao:** 1.14 a 1.44 sao razoes BAIXAS. Elas dizem
que matiz e luminancia sozinhos **nao** separam trilho de semantico. Isso nao reprova o
desenho, confirma a premissa da secao 3: a separacao e por canal (barra fina de 3px com
icone x chip preenchido), e **o icone nao e enfeite, e o que carrega a distincao**.
Nenhum trilho pode ser renderizado sem seu icone.

**Par a vigiar na revisao visual:** `pos_venda` `#6B8C5B` contra `--ok` `#17A06B`, dois
verdes de luminancia quase igual (1.14). Atenuante: `--ok` so aparece como chip de
`Publicado` na aba Conteúdo, e o trilho `pos_venda` so aparece em Rotina e Hoje. Abas
diferentes, canais diferentes. Se ainda assim confundir na tela real, `pos_venda` e o
primeiro a perder o matiz e ficar so com icone.

---

## 4. Rotina: grade de 7 colunas

A aba Rotina edita o **molde**. Quem executa e a aba Hoje. A grade serve aos dois
papeis: editar e enxergar o que o molde produz por dia.

**Cabecalho de carga.** Sete numeros derivados de `dias_semana` no cliente, mais barra
proporcional. E o diagnostico que hoje nao existe. Coluna do dia corrente marcada.

**Corpo.** Sete colunas, `seg` a `dom`. Cada celula e a tarefa com o trilho da sua
categoria (barra de 3px + icone). Uma tarefa com `dias_semana` = `[1,2,3,4,5]` aparece
em cinco colunas: isso e intencional, e o que torna a repeticao visivel.

**Vazio.** `dom` tem 0 tarefas. A coluna aparece vazia e rotulada, nunca some: sumir
esconderia a informacao de que domingo esta livre.

**Refluxo.** Abaixo de 900px a mesma grade vira pilha vertical por dia. **Somente CSS**
(`grid-template-columns` para uma coluna, cabecalhos de dia viram titulos de bloco).
Sem segundo layout em JS, sem DOM alternativo. Custo contido, e o mesmo padrao que o
`index.html` ja usa para a barra lateral virar barra inferior.

**Formularios.** `rot-add-tarefa` e `rot-add-cat` permanecem, com os toggles de dia
`rot-dia-tog` realinhados para espelhar a ordem das colunas da grade.

---

## 5. Conteudo: kanban de funil com a data em vista

**Quatro colunas** por `status_codigo`, na ordem do funil:
`A produzir` (45) · `Em produção` (4) · `Pronto` (3) · `Publicado` (8).
`Descartado` (6) fica colapsado atras de um contador, expansivel: e ruido para a
decisao do dia, mas apagar seria mentir sobre a base.

**Ordenacao dentro da coluna:** data crescente. As vencidas primeiro.

**A data carrega o sinal de urgencia**, pela mesma regra do invariante 4 aplicada a
peca em vez de a lead:

| Condicao | Sinal |
|---|---|
| data < hoje, e nao publicada | `--quente`, marcada como vencida |
| data = hoje | `--quente` |
| 1 a 6 dias | `--morno` |
| 7+ dias | `--frio` |
| status `Publicado` | `--ok`, neutro, nao pede acao |
| status `Descartado` | cinza apagado |

E isso que faz uma peca `A produzir` com data de ontem saltar de dentro de uma coluna
de 45 itens. **Como o nivel na Rota A, este calculo e derivado na leitura, no cliente.
Nao vira coluna no banco.**

**Cabecalho da coluna:** contagem total e quantas vencidas.

**Cabecalho do painel:** a linha que hoje falta, dita na cara, com numero medido:
"ultima publicacao ha N dias". Mais `syncLinha(d.sync)` e o botao Sincronizar, que
ja existem e continuam.

**Janela.** `conteudo_periodo(p_ini date, p_fim date)` ja aceita janela. Navegacao de
periodo usa os dois parametros. Sem mudanca de banco.

---

## 6. Hoje: nova ordem

De `placar + tarefas + nota + lembretes + conteudo` para:

1. `hojePlacar` (inalterado em dados: rotina %, conteúdo, lembretes, sync)
2. `hojeTarefas`, com trilho de categoria em cada linha
3. `hojeConteudo`, herdando o sinal de urgencia da secao 5
4. `hojeLembretes`
5. `hojeNota`

A nota vai para o fim porque a propria tarefa do molde e
`Fechar o dia: nota e pendências`: a nota e o ato de fechamento, nao um campo do meio.

Nenhuma acao muda: `dia-marcar`, `dia-remover`, `dia-add`, `dia-puxar`, `lemb-marcar`,
`lemb-remover`, `lemb-add`, `dia-nota-ok` continuam com os mesmos `data-acao` e ids.

---

## 7. Fronteiras: o que NAO muda

- **A Fila nao e tocada.** Invariantes 13 a 16 (fonte unica `sugerir_mensagem`,
  read-only, tres variantes distintas, assinatura, LGPD em `waHrefFila`) ficam intactos.
  Nenhuma linha de `sugerirMensagem`, `pintarVariante`, `copiarScript` e alterada.
- **Nenhuma mudanca de banco.** `conteudo_periodo`, `rotina_completa` e `painel_do_dia`
  ja devolvem tudo que o desenho precisa. Sem migracao, sem RPC nova, sem Edge Function.
- **Navegacao e pitboard** de leads ficam como estao (fora do escopo D1).
- **Captação, Todos, Indicações, Dashboard** nao mudam.
- Os `data-acao` existentes sao preservados: o delegador de eventos continua valendo.

---

## 8. Arquivos e disciplina de entrega

| Arquivo | Mudanca |
|---|---|
| `public/app.js` | Reescrita de `renderConteudo`, `renderRotina`, `renderHoje`, `hojeTarefas`, `hojeConteudo`, `contItem`. Helpers novos: nivel de urgencia da peca, carga por dia, trilho por `codigo`, icone de categoria. |
| `public/app.css` | Blocos novos: grade da Rotina, kanban do Conteúdo, trilho, refluxo abaixo de 900px. 793 linhas hoje, legivel. |
| `public/index.html` | Sem mudanca prevista. Todo o corpo e renderizado em `#lista`. |

**Entrega em arquivo completo, nunca fragmento.** Fragmento foi causa raiz de corrupcao
no historico deste projeto. `app.js` esta minificado numa linha so (44527 bytes) e essa
forma e preservada.

Portao de validacao antes de dar por pronto. **Correcao de fato:** o CLAUDE.md pede
acorn + jsdom, mas `ferramentas/LEIA-ME.md` registra que a suite real e Python
(`esprima` para sintaxe, Chrome headless para comportamento). Os comandos abaixo sao
os que existem, rodados da raiz do repo:

```
python ferramentas/validar.py
python ferramentas/harness.py
```

1. `validar.py`: sintaxe via `esprima`, contrato de IDs e classes, invariantes
   (`sugerir_mensagem`, trava LGPD, 3 variantes, paleta), fidelidade a referencia v3.
2. `harness.py`: execucao real em Chrome headless contra Supabase falso, com o CSS
   aplicado. 31 assercoes hoje. Permite afirmar sobre **cor computada**, nao so sobre
   classe presente, que e exatamente o que esta obra precisa provar.
3. Prova com dado real, nao inventado: a grade da Rotina tem que reproduzir
   `seg 10 | ter 8 | qua 8 | qui 9 | sex 10 | sáb 3 | dom 0`, e o kanban do Conteudo
   tem que reproduzir 45 / 4 / 3 / 8 / 6. Numero que nao bate com o banco reprova.
4. Contraste dos trilhos: **ja medido e aprovado**, secao 3.2.

Duas armadilhas de baseline herdadas, a tratar antes de rodar a suite:

- `ferramentas/app.js.antes` e a baseline pre-Fase 4. `validar.py` compara ela contra
  `public/app.js` e responde "o que esta mudanca quebrou?", nao "o app esta certo?".
  **Repontar a baseline antes de comecar** (ja e a pendencia 12 do handoff v32).
- O `LEIA-ME.md` afirma "nao existe node nesta maquina". **Isso esta desatualizado:**
  `node` roda aqui, foi usado nesta sessao para extrair as funcoes do `app.js`
  minificado. Nao muda a escolha de ferramenta (o Chrome headless continua melhor que
  jsdom porque aplica CSS), mas a afirmacao no LEIA-ME merece correcao.

---

## 9. Riscos nomeados

| Risco | Mitigacao |
|---|---|
| Trilho confundido com cor semantica | **Medido, os 7 passaram** (secao 3.2). Risco residual so no par `pos_venda` x `--ok` (1.14), que vive em abas diferentes. Saida acordada: perde matiz, fica so com icone. |
| Grade de 7 colunas em celular | Refluxo so em CSS. Atenuante: Rotina ja e `.aba-rara`, ja e aba de desktop. |
| Coluna `A produzir` com 45 itens continuar ilegivel | Ordenacao por data + vencidas no topo + sinal de urgencia. Se ainda assim pesar, o proximo corte e paginar a coluna, nao voltar a lista plana. |
| Reescrever 3 renderizadores num arquivo minificado | Arquivo completo + `validar.py` + `harness.py` em Chrome headless + provas numericas contra o banco. |
| Perder um `data-acao` na reescrita e quebrar um botao em silencio | Secao 6 lista os 8 `data-acao` da aba Hoje. Conferir a lista literalmente contra o arquivo novo. |

---

## 10. Criterio de pronto

O dono abre o app publicado e, sem ajuda:

1. Ve na aba Rotina qual dia da semana esta sobrecarregado, sem contar nada de cabeca.
2. Ve na aba Conteúdo quantas pecas estao paradas em `A produzir` e quais ja venceram.
3. Ve que a ultima publicacao foi ha N dias, com N na tela.
4. Reconhece uma categoria pela cor e pelo icone, em Rotina e em Hoje, sem ler o rotulo.

Encanamento provado nao e entrega: esta fase termina em tela abrivel.
