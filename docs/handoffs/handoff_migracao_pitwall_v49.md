# Handoff Migracao Pit Wall (Nucleo) v49

Substitui a v48. Data: 09/08/2026.

---

## 1. Headline: a Fila virou linha de atendimento, e a ORIGEM apareceu pela primeira vez

O dono trouxe uma imagem de referencia (um CRM de fundo claro, com barra
lateral, cartoes-numero com icone, e a fila como LINHA densa: avatar, nome +
LEAD-code, colunas rotuladas PRODUTO e ORIGEM, chip de estado a direita) e disse
para usa-la como **referencia verdade** da Fila do dia.

A entrega pega a FORMA dela e recusa tres coisas, cada uma com motivo medido.
O achado que valia mais que a imagem: **`lead.origem` esta preenchida em 19 dos
21 leads ativos e NUNCA tinha aparecido na Fila.** A imagem nao pediu um campo
novo, pediu que um campo que ja existia parasse de ficar escondido.

---

## 2. A decisao que mudou o trabalho inteiro

A linha da imagem esconde `Sugerir mensagem`, `Chamar no WhatsApp`, `Historico`,
`Toque enviado` e `Desfecho` atras de um raio e um kebab. A Fila nao e lista de
leitura, e a superficie de trabalho: isso transformaria cada atendimento de 1
clique em 3.

Tres formas foram postas ao dono, com desenho de cada uma. **Ele escolheu "linha
+ operacao aberta":** a linha ganha as colunas rotuladas e o chip da imagem, e a
fileira de botoes continua VISIVEL logo abaixo, separada por um filete de 1px.
O filete custa 1px; o raio e o kebab custariam um clique por lead, todo dia.

---

## 3. O chip de estado: a correcao do dono no meio da sessao

A primeira leitura recusou os chips da imagem inteiros. O dono cortou: *"mas o
chip de urgente e em andamento sao interessantes"*. **Ele estava certo, e a
recusa estava mal enderecada:** o problema era a PALETA (tres tons do mesmo
azul, medidos a 2.08 entre si, que colapsam o invariante 3 e o sistema Trilho x
Sinal), nao o CONCEITO. Um chip unico que responde "o que eu faco com este lead
agora" e exatamente o Sinal.

O estado nao inventou regra nenhuma: sai de coluna que a `v_lead` **ja calcula**.

| chip | regra | token | contraste |
|---|---|---|---|
| `Em andamento` | `respondido_em >= ultimo_toque_em` (ou sem toque). Mesma condicao do 1o ramo de `bola_com='voce'`: o cliente respondeu, a bola e sua | `--ok` #0F7A52 | 5.35 |
| `Urgente · Nd` | `proximo_contato` passou da data | `--quente` #BC4715 | 4.65 |
| `Pendente` | vence hoje | `--morno` #946500 | 4.61 |
| `Na fila` | ainda no prazo | `--frio` #5C6F8A | 4.61 |
| `Sem data` | `proximo_contato` nulo | `--frio` | 4.61 |

Quatro MATIZES distintas, todas de token ja medido. Zero cor nova. Zero azul.

O ramo `Sem data` existe porque `p()` devolve 0 quando nao ha data, e sem ele um
lead sem data se disfarcaria de "vence hoje".

**Precedencia: `Em andamento` ganha de `Urgente`.** Um lead que respondeu e o
melhor lead da fila mesmo estando atrasado; carimba-lo de Urgente enterraria a
unica coisa que importa saber antes de escrever a mensagem. O atraso nao se
perde: o numero entra no proprio chip quando ele e o estado.

Classe `sn-`, nao `est-`: `est-` casaria por SUBSTRING com o seletor
`.chip[class*="st-"]` que ja existe no arquivo, e herdaria regra que nao e dele.

---

## 4. O que entrou, o que ficou de fora

### 4.1 Entrou (forma da imagem, dado real)

- avatar com a inicial do nome;
- nome + `LEAD-code · telefone` empilhados na coluna de identidade;
- **PRODUTO e ORIGEM** como colunas com micro-rotulo em mono;
- chip de estado a direita da linha;
- cabecalho `Fila de atendimento` com a **legenda dos tres estados** (o chip e a
  unica coisa nova que o dono nao teria como decifrar sozinho);
- icone em cada cartao-numero do placar;
- a **busca subiu para o topo**. Ela existia desde sempre, mas morava ENTRE o
  placar e a lista, onde ninguem procura por ela. `id` intacto: so mudou de
  lugar no DOM, nenhuma ligacao de evento mudou;
- `Editar` so aparece no hover, e volta pro fluxo em tela sem hover.

### 4.2 Ficou de fora, com o motivo

1. **A paleta azul monocromatica.** Ja recusada em 03/08 e de novo no v48. Ver
   secao 3: o que entrou foi o conceito, com matiz de verdade.
2. **`SYS_ONLINE`, `LATENCY: 12ms`, `LIVE_SYNC: ACTIVE`, `Urgencia: Critica`,
   `Limpeza: 100% ok`, a barra de progresso azul.** Nada existe no banco. Mesma
   familia da coluna Publicado que mostrava 3 de 8. A barra em `var(--accent)`
   ja e reprovada pelo guard-rail. O pe real de cada cartao (`vencendo hoje`,
   `passaram da data`, `leads pendentes`, `no total`) continua no lugar.
3. **`NA FILA - 10MIN`, `EM ANDAMENTO`, `AGUARDANDO BASE`, `FINALIZADO`.** Os
   status reais sao `pendente` (11), `convertido` (6), `lista_fria` (3),
   `cancelado` (1).
4. **O menu de 6 itens.** O real tem 13. Seguir a imagem ao pe da letra apagaria
   Notas fiscais, Clientes, Indicacoes, Captacao, Conteudo, Rotina e Escopo.
5. **O raio e o kebab.** Ver secao 2.

### 4.3 Saiu de proposito

O chip `Nd de atraso` some da fileira de chips **na Fila**: o chip de estado
passou a carregar o mesmo numero, e dizer duas vezes e ruido. A condicao ja era
`"fila"===e`, entao nenhuma outra aba muda.

---

## 4.4 Densidade: segunda rodada, depois do "ficou bom, mas..."

O dono aprovou a linha e pediu **"uma visualizacao mais estreita, pra conter
mais leads"**. A gordura nao estava na linha nova: estava na fileira de botoes,
que ninguem tinha medido.

`.btn-acao` nasce com `flex:1` para preencher a faixa. Num card de ~940px isso
dava um **`Historico` de 460px**, e como `.card-wa-linha` toma `flex:1 1 100%`,
o WhatsApp ainda comia uma terceira faixa sozinho. Eram tres faixas de botao,
~130px, em todo card.

Na Fila os botoes voltam a ter a largura do proprio texto. **Nao e so
densidade:** um `Desfecho` de 460px lia como acao principal do card sendo
secundaria.

| medida (1280px, mesmos 3 leads) | antes | depois |
|---|---|---|
| altura do card | ~316px | **~206px** |
| faixas de botao | 3 | 2 |

35% mais curto, ~1,5x mais lead por tela. As outras mudancas (chips e
`Nd sem resposta` dividindo faixa, padding 14 -> 11, gap da bandeja 10 -> 7)
somam menos que a fileira de botoes sozinha.

Duas coisas NAO foram colapsadas:

1. **A fileira de escrita continua separada da de leitura.** Sao dois
   `.card-acoes` por projeto: `Chamar no WhatsApp` / `Sugerir` / `Historico` sao
   leitura, `Toque enviado` / `Desfecho` sao escrita. Elas encostam (o filete de
   separacao ficou so no primeiro grupo), nao viram uma.
2. **Nada foi escondido.** A observacao do lead, os chips, o `Nd sem resposta` e
   os cinco botoes seguem todos visiveis.

**Escopo: `#lista[data-aba="fila"]` e so isso.** O `flex:1` global continua
valendo em Todos, Clientes, Vendas, Hoje e NF, que nao foram pedidos nem
medidos, e a foto de Todos prova que nao mudaram. O breakpoint de 560px devolve
o comportamento antigo: a 390px sobram ~114px por botao e com largura de
conteudo a fileira quebraria desalinhada, que e a briga que a v45 ja comprou.

---

## 5. Onde encostou

| arquivo | o que |
|---|---|
| `ferramentas/patch_fila_linha.py` | **novo.** Patch idempotente do `app.js` minificado: `fxSinal`, `fxCol`, `fxFila`, o cabecalho do card virando ternario por aba, o chip de atraso saindo da Fila e o telefone entrando na identidade. +1.235 bytes |
| `public/app.css` | `.card-linha`, `.card-av`, `.card-col`, `.col-rot`, `.col-val`, `.chip.est` + os 4 `sn-*`, `.sec-lista`, `.pb-topo`/`.pb-ico`, a busca no topo, e o breakpoint de 560px |
| `public/index.html` | busca movida pro `.topo`, icone nos 4 cartoes, cabecalho de secao com legenda |

O cabecalho do card virou `"fila"===e?fxFila(a,i):<ramo antigo byte a byte>`.
**Nenhuma outra aba muda de forma**, e as fotos de Todos e Clientes provam.

---

## 6. Provas

Medido nesta maquina, 09/08/2026, com o baseline tirado ANTES de encostar.

| prova | baseline | depois |
|---|---|---|
| `python ferramentas/harness.py` | 254 passou / 0 falhou | **254 / 0** — EXIT 0 |
| `python ferramentas/validar.py` | EXIT 0 | EXIT 0 |
| `python ferramentas/prova_trilho.py` | EXIT 0 | EXIT 0 |
| `python ferramentas/diag_mobile.py 360/390/414` | EXIT 0 | EXIT 0 nos tres |
| `node --check public/app.js` | EXIT 0 | EXIT 0 |
| `python ferramentas/patch_fila_linha.py` (2a vez) | — | `ja aplicado, nada a fazer` |

Fotos da tela renderizada em `docs/design/`: `foto_fila_1280.png`,
`foto_todos_1280.png`, `foto_clientes_1280.png`.

---

## 7. Duas armadilhas de ferramenta que custaram tempo (registrar)

1. **`foto.py` REUSA `%TEMP%/pitwall_harness.html` e so o `harness.py` remonta
   esse arquivo.** Uma tentativa de fotografar o HEAD (fazendo `git checkout --`
   e rodando `foto.py`) devolveu uma foto **byte a byte identica** a da versao
   modificada: era o HTML montado antigo. Para comparar antes/depois de verdade
   e obrigatorio **rodar `harness.py` entre as duas fotos**. Foi so depois disso
   que ficou provado que os botoes esticados da fileira ja eram do HEAD
   (`.btn-acao{flex:1}`) e nao regressao desta sessao.
2. **`foto.py` MENTE em largura de celular.** A `foto_fila_390.png` saiu com o
   chip, os botoes e a barra inferior cortados no lado direito. Nao era estouro:
   o `diag_mobile.py 390` confirma `innerWidth=390` com a barra inferior em
   x=6..384, enquanto na foto ela passa muito de 390. O Chrome renderiza a
   pagina mais larga que a janela e o screenshot corta. **Em mobile vale o
   `diag_mobile.py`, nunca a foto.** A foto enganosa foi apagada para nao virar
   prova falsa depois.

Junto com a lição do v48 (`| tail` devolve o exit do `tail`, nunca o do Python),
sao tres jeitos diferentes de a ferramenta dizer "passou" sem ter passado.

---

## 8. Decisoes

1. **A imagem entra como FORMA, nao como paleta nem como dado.** Segue a decisao
   do v48 sobre o zip do Stitch: `referencia-visual-v3.html` continua o record
   de cor, tipografia e contraste.
2. **Recusa mal enderecada e pior que recusa nenhuma.** A primeira leitura jogou
   fora o chip de estado junto com o azul. O dono separou os dois em uma linha.
   Da proxima, separar CONCEITO de EXECUCAO antes de recusar.
3. **Perguntar antes de construir, quando a resposta muda o trabalho inteiro.**
   As tres formas de linha foram desenhadas e postas ao dono antes de uma linha
   de CSS. Construir a densa e descobrir depois custaria a obra inteira.
4. **Campo vazio nao some.** `origem` esta vazia em 2 dos 21: o rotulo continua
   na tela e o valor diz `sem origem`. Tela que so renderiza o que tem dado
   desaparece na base zerada.
5. **Nenhum token de cor novo. Nenhum uso novo de `var(--accent)`.**

---

## 9. Pendencias

1. **Nao foi para o ar.** O dono confere no preview local antes do push (push E
   deploy neste projeto). Commit e push seguem abertos.
2. **Hoje e Conteudo continuam sem a forma nova.** O v48 recomendava Conteudo
   antes de Hoje; a Fila passou na frente por pedido direto. A recomendacao
   segue de pe.
3. Tudo o que o v47 e o v48 deixaram aberto segue aberto:
   - o relatorio de entrega nao registra que foi enviado (sem `despachado_em`);
   - o texto do relatorio nao e configuravel (formato no JS);
   - `privado.fn_venda_atualizar` tem EXECUTE para `authenticated` e e SECURITY
     DEFINER, nomeado para o `pit-guard` decidir;
   - **VENDA-0003 duplicada** (faturamento inflado em R$ 8.400).
