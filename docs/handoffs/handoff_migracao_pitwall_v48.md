# Handoff Migracao Pit Wall (Nucleo) v48

Substitui a v47. Data: 08/08/2026.

---

## 1. Headline: o Stitch da Fila estava commitado ha dois dias e nunca tinha aparecido na tela

O dono chegou com um zip (`stitch_pit_wall_crm (1).zip`, 9 telas do Stitch) para
inspirar o frontend. Antes de desenhar qualquer coisa, o baseline foi medido, e o
baseline entregou um achado que valia mais que o zip:

**Tres mudancas foram entregues pela metade, sempre do mesmo jeito: CSS escrito,
assercao escrita, JS nunca.**

| o que | CSS | assercao no harness | JS |
|---|---|---|---|
| `#lista[data-aba="fila"]` — 16 regras, a forma inteira da Fila | entregue | entregue | **nunca setado** |
| `Respondeu` dentro do leque `Desfecho` (pedido do dono, 03/08) | entregue | entregue | **botao seguia na fileira** |
| `ferramentas/patch_lista_data_aba.py` | — | — | **commitado sem nunca ter sido rodado** |

As 16 regras de CSS penduravam num seletor que **nao casava com elemento nenhum**.
O commit `a96ddf8` anuncia, em portugues claro, *"a Fila ganha bandeja tingida com
card branco flutuando, raio maior, sombra e chip em pilula"*. Nada disso jamais
apareceu para o dono.

**O v46 e o v47 leram as 8 vermelhas do harness como "falhas herdadas" e
seguiram.** O v47 chega a escrever: *"Sao de Fila e leque (`data-aba`, bandeja
tingida, raio, sombra, botao Respondeu), nenhuma toca Vendas."* Estava certo sobre
Vendas e errado sobre o que aquilo era: nao era divida velha de outra pessoa, era
obra nao terminada esperando 50 bytes.

---

## 2. O conserto

Dois patches, no formato idempotente que o repo ja usa para o `app.js` minificado:

```
python ferramentas/patch_lista_data_aba.py     # +50 bytes  -> 239/8 vira 244/3
python ferramentas/patch_respondeu_leque.py    # +0 bytes   -> 244/3 vira 247/0
```

- `patch_lista_data_aba.py` **ja existia commitado desde `a96ddf8`**. Bastava
  rodar. Ele enxerta `E("lista")&&E("lista").setAttribute("data-aba",n),` no
  trocador de aba, e com isso as 16 regras de CSS que ja estavam no arquivo
  passam a valer.
- `patch_respondeu_leque.py` **e novo nesta sessao**. Tira o `Respondeu` da
  fileira de escrita e o coloca em PRIMEIRO dentro de `.desfechos`. Primeiro
  porque o CSS de 03/08 ja lhe dava `flex:1 1 100%`: ele ocupa a linha inteira,
  com Conversando, Retomar, Fechou e Sem interesse abaixo. Delta de bytes zero:
  a unica mudanca e `btn-acao` virando `btn-desf`.

`data-acao` e `data-id` ficam intactos nos dois casos. O handler e delegado por
`data-acao`, entao nenhuma ligacao de evento muda.

**O `Respondeu` so mudou de lugar, nao sumiu.** `registrar_resposta` grava
`respondido_em`, que e o unico freio que `fn_regua_varredura` le;
`registrar_conversando` grava `etapa_cadencia`, que a regua nao le. Sumir com o
botao seria tirar o freio da regua sem querer. A assercao no harness existe
exatamente para impedir que uma futura "limpeza da fileira" faca isso.

---

## 3. Estado das provas

Medido em 08/08/2026, nesta maquina, antes e depois.

| prova | antes | depois |
|---|---|---|
| `python ferramentas/harness.py` | 239 passou / **8 falhou** | **247 passou / 0 falhou** — EXIT 0 |
| `python ferramentas/validar.py` | EXIT 0 | EXIT 0 |
| `python ferramentas/prova_trilho.py` | EXIT 0 | EXIT 0 |
| `python ferramentas/diag_mobile.py 360 / 390 / 414` | EXIT 0 | EXIT 0 nos tres |
| `node --check public/app.js` | EXIT 0 | EXIT 0 |

Primeira vez em tres sessoes que o harness fecha em zero.

Armadilha que mordeu de novo e que o `CLAUDE.md` avisa: rodar
`python ferramentas/harness.py 2>&1 | tail -40` e ler `EXIT=$?` devolve o exit do
**`tail`**, que e sempre 0. O harness estava em EXIT 1. **Conferir o exit code do
Python, nunca o do fim do pipe.**

---

## 4. O que subiu, e o que subiu junto sem ser desta sessao

Push feito na URL real do GitHub: `e0e2a4e..0ac78a8`. Neste projeto push E deploy.

Commits desta sessao:

- `1a5cebf fix(fila): o Stitch da Fila finalmente chega na tela`
- `0ac78a8 merge: traz os backups diarios do GitHub (06, 07 e 08/08)`

**O push carregou quatro commits de outras sessoes que nunca tinham ido pro
GitHub**: `feat(calc)` da carga de 03/08, `feat(app)` do portao de leitura, o
merge da aba Escopo e o `feat(vendas)` do v47. E o clone atrasado de sempre. O
dono foi avisado.

### 4.1 Deploy conferido no worker, nao no navegador

| arquivo | no ar | no HEAD |
|---|---|---|
| `app.css` | 86.066 | 86.066 |
| `app.js` | 134.664 | 134.664 |
| `index.html` (via `/`) | 27.826 | 27.826 |

`GET /index.html` devolve 307 para `/`. E o `not_found_handling:
single-page-application` funcionando, nao erro.

**Falso alarme registrado para nao custar de novo:** ~30s depois do build, um
`curl` no `app.css` devolveu 76.648 bytes, sem nenhum `data-aba`, terminando em
`.esc-travar` — exatamente a versao anterior ao `a96ddf8`. Parecia deploy velho.
Cinco medicoes seguidas minutos depois deram 86.065, com 16 `data-aba` e o mesmo
ETag. **Era copia de borda apanhada no meio da propagacao.** Conferir deploy
logo apos o build da uma leitura instavel: medir de novo antes de concluir que
falhou.

---

## 5. O zip do Stitch: veredito por item

`Downloads\stitch_pit_wall_crm (1).zip`, 08/08 18:32. Nove telas, cada uma com
`code.html` + `screen.png`, mais um `clean_command/DESIGN.md` com os tokens.

**Decisao do dono nesta sessao: inspiracao por aba.** A
`docs/design/referencia-visual-v3.html` continua sendo o record de tokens (cor,
tipografia, contraste). Do Stitch vem so FORMA. Nao virou `referencia-visual-v4`.

### 5.1 Aproveitar

- faixa de 4 cartoes-numero no topo (o pitboard ja existe, so ganha a forma);
- coluna do kanban como container tingido com chip de contagem;
- titulo grande com acao primaria a direita;
- chip de tipo (`VIDEO` / `REELS` / `STORY`) no card de conteudo;
- elevacao por camada tonal + borda de 1px, em vez de sombra pesada.

### 5.2 Recusar, com o motivo

1. **A paleta.** E azul monocromatica: `Urgente`, `Em Andamento` e `Pendente` sao
   tres tons do mesmo azul. Ja foi recusada em 03/08 (medido: 2.08 entre si).
   Colapsa o invariante 3 e o sistema Trilho x Sinal inteiro.
2. **Numero inventado.** `STATUS DO SISTEMA · NOMINAL`, `Uptime 99.98%`,
   `Latency 24ms`, `SYS_ONLINE LATENCY: 12ms`, `70% da Capacidade Total`. Nada
   disso existe no banco. Mesma familia de defeito da coluna Publicado que
   mostrava 3 de 8.
3. **A barra lateral fixa.** O app e mobile de verdade (a suite mede 360/390/414).
   Trocar as abas por sidebar e obra estrutural, nao inspiracao.
4. **Os nomes das colunas do kanban.** O mockup diz `Ideias / Em Produção /
   Revisão`; o funil real e `A produzir / Em produção / Pronto / Publicado`, e a
   chave e o `codigo`, nunca o rotulo (invariante 12).
5. **A barra de progresso azul** (`65% Concluído`). O guard-rail de
   `var(--accent)` reprova exatamente esse caso, e ja pegou o `.met-barra` uma vez.

---

## 6. Decisoes

1. **Medir o baseline antes de encostar no pedido.** O dono pediu tela nova; o
   baseline mostrou que a tela anterior nunca tinha existido. Construir por cima
   teria empilhado forma nova sobre CSS morto, e ninguem descobriria a diferenca.
2. **Vermelha herdada e para ser LIDA, nao herdada.** Duas sessoes carimbaram "8
   falhas herdadas, nenhuma toca o meu escopo". As oito eram um item de trabalho
   inteiro, a 50 bytes de fechar.
3. **Patch idempotente em vez de edicao direta no minificado.** Segue a convencao
   do repo: o script documenta o porque, aborta se a ancora mudou de forma, e
   assere o delta de bytes.
4. **Merge, nao rebase.** O rebase sobre `FETCH_HEAD` bateu conflito em `a96ddf8`
   porque o historico local tem um merge commit (`129f209`). Abortado e trocado
   por merge. O `git rebase --abort` devolveu erro do Windows ao remover
   `.git/rebase-merge` (lock do OneDrive), mas o HEAD voltou certo e o diretorio
   orfao foi apagado a mao.
5. **Nenhum token de cor novo. Nenhum uso novo de `var(--accent)`.** A obra desta
   sessao e forma, nao cor.

---

## 7. Sujeira de historico que fica registrada

1. **`b43d07f feat(vendas): relatorio de entrega e cadastro de motoboy` levou o
   patch do `data-aba` de carona.** Ele apareceu sozinho neste clone no meio da
   sessao, via sincronizacao do OneDrive, e foi feito com a copia de trabalho ja
   corrigida. Quem for procurar o conserto do `data-aba` pelo historico nao vai
   achar onde espera: esta num commit cuja mensagem fala so de vendas.
2. **Dois commits tem `@` como primeira linha da mensagem** (`84ab8fc` e o
   antecessor). E sintaxe de here-string do PowerShell (`@'...'@`) usada dentro da
   ferramenta Bash, que a interpreta como texto literal. **O mesmo erro foi
   repetido nesta sessao** e corrigido com `--amend` antes do push. Em Bash usar
   heredoc (`git commit -F - <<'MSG'`), nunca `@'...'@`.

---

## 8. Pendencias

1. **Hoje e Conteudo continuam intactos.** O dono escolheu as tres abas de
   operacao para receber a forma do Stitch; so a Fila foi entregue. Recomendacao
   registrada: **Conteudo antes de Hoje** — a coluna do kanban virando container
   tingido com chip de contagem e transplante direto do que acabou de dar certo
   na Fila, enquanto Hoje exige decidir antes o que substitui os numeros
   inventados do mockup.
2. Tudo o que a v47 deixou aberto segue aberto:
   - o relatorio de entrega **nao registra que foi enviado** (sem `despachado_em`,
     sem evento no historico; reenviar e indistinguivel de enviar);
   - o texto do relatorio **nao e configuravel** (formato no JS);
   - `privado.fn_venda_atualizar` tem EXECUTE para `authenticated` e e SECURITY
     DEFINER — nomeado para o `pit-guard` decidir, nao mexido;
   - **VENDA-0003 duplicada** (faturamento inflado em R$ 8.400; a ferramenta
     existe e esta provada, o ato e do dono).

---

## 9. O que esta sessao ensina

1. **Commit que anuncia uma tela nao prova que a tela existe.** `a96ddf8`
   descreve com precisao uma Fila que nunca renderizou. A unica coisa que provava
   era a suite, e ela estava vermelha dizendo exatamente isso.
2. **CSS escopado num seletor que nunca casa e codigo morto silencioso.** Nao da
   erro, nao aparece em `validar.py`, nao muda o `git diff`. So o harness, que
   mede cor COMPUTADA no Chrome, viu.
3. **Exit code do Python, nunca do fim do pipe.** `| tail -40` transforma
   qualquer reprovacao em `EXIT=0`.
4. **Deploy conferido cedo demais mente.** Medir de novo antes de concluir que a
   Cloudflare falhou.
5. **O achado mais caro da sessao nao estava no pedido do dono.** Ele veio pedir
   um front end novo; o que estava faltando era rodar um script de 50 bytes que
   ja estava versionado no repo ha dois dias.
