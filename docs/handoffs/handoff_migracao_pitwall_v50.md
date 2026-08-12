# Handoff Migracao Pit Wall (Nucleo) v50

Substitui a v49. Data: 11/08/2026.

---

## 1. Headline: a Fila subiu, e a faixa de acao virou uma so

A obra inteira da v49 estava na arvore de trabalho **sem commit desde 09/08** e,
portanto, fora do ar (push e deploy neste projeto). Esta sessao fechou a fatia:
provou, mostrou no preview, ganhou mais uma rodada de forma pedida pelo dono,
commitou e empurrou.

Commit unico: **`87b65f9`**, `d6e00fe..87b65f9`. Confirmado servido pelo Worker.

---

## 2. O pedido novo: "realoque os chips de toque, resposta, sugerir, horizontal talvez"

Depois de conferir o preview, o dono olhou para o card e viu **tres faixas de
pilula empilhadas** embaixo da linha de identidade: os chips de leitura, a
fileira de leitura (`Chamar no WhatsApp` / `Sugerir mensagem` / `Historico`) e a
fileira de escrita (`Toque enviado` / `Desfecho`). O empilhamento nao dizia nada
sobre a diferenca entre elas.

Tres formas foram desenhadas e postas a ele antes de qualquer CSS (metodo que a
v49 ja tinha registrado como o que salvou a obra). **Ele escolheu "uma faixa:
leitura na esquerda, escrita na direita"**, e escolheu manter os chips de
leitura onde estavam.

```
[Chamar no WhatsApp] [Sugerir mensagem] [Historico] ....... [Toque enviado] [Desfecho]
 \___________________ leitura ____________________/          \____ escrita ____/
```

**A separacao leitura x escrita da v49 nao foi derrubada: mudou de eixo.** Era
vertical (duas faixas), virou horizontal (duas pontas da mesma faixa). Continua
sendo do projeto e nao acidente, e continua sendo um GRUPO real no DOM
(`<span class="acoes-escrita">`), nao dois botoes soltos que por acaso caem no
fim da fila. Agrupado, ele quebra junto: nunca sobra um `Desfecho` orfao.

`margin-left:auto` em vez de espacador com `flex:1` porque o `auto` morre sozinho
quando a faixa quebra, e o grupo desce inteiro encostando na esquerda em vez de
ficar pendurado na direita de uma linha vazia.

### 2.1 Por que DOM e nao so CSS

No DOM os dois `.card-acoes` **nunca foram vizinhos**: entre eles moram
`.scripts` (painel do Sugerir) e `.hist` (painel do Historico), que nascem
vazios. Juntar as faixas so com CSS exigiria esconder painel vazio (`:empty`), e
ai o primeiro clique em `Sugerir mensagem` encheria o painel e jogaria
`Toque enviado` para outra linha: a fileira se reorganizaria embaixo do dedo do
operador, todo dia, em todo lead. Por isso a mudanca e de estrutura, num patch
idempotente de **+12 bytes** no `app.js` minificado.

Nenhum `data-acao` mudou de nome, entao **nenhuma ligacao de evento mudou** (o
app usa delegacao por `data-acao`). O leque de desfecho e o `retomar` seguem
abrindo abaixo da faixa, e `Respondeu` continua dentro do leque, como a v46
deixou.

### 2.2 Medido, nao estimado

Chrome headless, mesmos 3 leads, 1280px, o MESMO script rodado contra as duas
versoes (a de antes reconstruida em copia separada, para nao medir uma pagina
contra a lembranca da outra):

| medida | antes | depois |
|---|---|---|
| altura do card | 207 / 210 / 210 px | **169 / 172 / 172 px** |
| containers `.card-acoes` | 2 | **1** |
| linhas visuais de botao | 2 | **1** |
| escrita a direita, mesma linha | nao | **sim** |

~38px por card, 18% mais curto, em cima dos 35% que a v49 ja tinha tirado. A
soma das duas rodadas: **316px -> 170px**, quase metade.

No celular (<=560px) nada disso vale: o grupo volta a ter faixa propria e largura
cheia, que e a briga que a v45 comprou e o v49 preservou.

---

## 3. O guard-rail foi reapontado, nao calado

A classe `escrita` deixou de existir no DOM, e o `harness.py` tinha uma assercao
contando `.card-acoes.escrita .btn-acao === 2`.

Nao se repontou baseline em silencio. O seletor passou a
`.acoes-escrita .btn-acao === 2` (**mesma intencao**: la moram dois botoes, e
`Respondeu` continua fora), e **nasceu uma assercao a mais**:
`.card-acoes > .acoes-escrita` existe, ou seja, o grupo mora DENTRO da faixa de
leitura. Se um dia ele voltar a ser uma segunda faixa, a suite cai.

Por isso o numero do harness sobe de 254 para **255**: e assercao nova, nao
assercao afrouxada.

---

## 4. Duas decisoes que nao estavam no pedido

### 4.1 As fotos de `docs/design/` carregam PII e ficaram fora do commit

`foto_fila_1280.png` e `foto_todos_1280.png` mostram, legivel, **nome e telefone
completo de cliente real** (`Duda nanda +55 (21) 99866-8286`,
`Clara mesquita +55 (21) 99511-0297`). O `foto.py` reusa o HTML montado pelo
`harness.py`, e o fixture do harness usa linha de verdade do banco.

A regra ja existia escrita no repo: o `.gitignore` exclui `ferramentas/fotos/`
com esse motivo textual. O `foto.py` grava em `docs/design/`, que **escapava do
padrao**. Repo privado nao desfaz historico de git, e o dump do banco ja e
criptografado justamente por causa de PII.

`docs/design/foto_*.png` entrou no `.gitignore`, com o motivo escrito e o comando
de regenerar. O gerador vai versionado; a saida nao.

### 4.2 A copia local CRLF-iza tudo, e o commit quase levou isso pro repo

`core.autocrlf=false`, sem `.gitattributes`, e os patches em Python usam
`Path.write_text()`, que **no Windows converte `\n` em `\r\n`**. O historico do
repo e LF; o primeiro commit desta sessao saiu com `app.css`, `app.js`,
`index.html`, `.gitignore` e `harness.py` em CRLF, e apareceu como
**5.313 insercoes / 4.485 delecoes** de puro ruido.

Normalizado para LF antes do push (a suite reprovada depois disso: 255/0). O
commit final e **849 insercoes / 21 delecoes**, que e o tamanho real da obra.

**Pendencia aberta:** isso volta a acontecer no proximo `patch_*.py`. O conserto
duravel e um `.gitattributes` com `* text=auto eol=lf`, que normaliza no commit e
faz o `git diff` parar de mentir. Nao foi feito nesta sessao por estar fora do
pedido, e porque muda o checkout de todo mundo: **decisao do dono**.

---

## 5. Onde encostou

| arquivo | o que |
|---|---|
| `ferramentas/patch_fila_acoes.py` | **novo.** Patch idempotente: `ve` ao lado de `v`, a fileira de escrita vira `.acoes-escrita` dentro do `.card-acoes` de leitura. +12 bytes |
| `public/app.css` | `.acoes-escrita` (base, Fila e o breakpoint de 560px) no lugar das duas regras de `.card-acoes.escrita`, que ficaram mortas |
| `ferramentas/harness.py` | a assercao reapontada + uma nova (secao 3) |
| `.gitignore` | `docs/design/foto_*.png` (secao 4.1) |
| tudo da v49 | `patch_fila_linha.py`, `foto.py`, a linha, o chip de estado, a busca no topo, os icones do placar |

---

## 6. Provas

Todas nesta maquina, **exit code conferido**, depois da ultima mudanca (inclusive
depois da normalizacao de LF):

| prova | resultado |
|---|---|
| `python ferramentas/harness.py` | **255 passou / 0 falhou** — EXIT 0 |
| `python ferramentas/validar.py` | EXIT 0 |
| `python ferramentas/prova_trilho.py` | EXIT 0 |
| `python ferramentas/diag_mobile.py` 360 / 390 / 414 | EXIT 0 nos tres |
| `node --check public/app.js` | EXIT 0 |
| `patch_fila_linha.py` e `patch_fila_acoes.py`, 2a vez | `ja aplicado, nada a fazer` |

Deploy conferido no Worker, nao no navegador:

| prova | resultado |
|---|---|
| `git ls-remote` refs/heads/main | `87b65f9`, igual ao HEAD local |
| md5 `public/app.js` vs servido | `f141fc0ac3a187c05c727e36a0c11706` nos dois |
| `app.css` servido vs local | identico |
| `acoes-escrita` no servido | 1x no `app.js`, 3x no `app.css` |

Nota: o md5 do CSS **passou a bater** porque o arquivo agora e LF dos dois lados.
A armadilha registrada na memoria (comparar CSS com `tr -d '\r'`) valia enquanto
a copia local era CRLF; se um `patch_*.py` rodar de novo, ela volta a valer.

---

## 7. Decisoes

1. **Uma faixa, duas pontas.** A separacao leitura x escrita vale a pena, o
   empilhamento nao era a unica forma de expressa-la. Posicao carrega a mesma
   informacao por 38px a menos de card.
2. **Grupo, nao botoes soltos.** O `<span>` existe para o par nunca se separar na
   quebra e para o guard-rail ter em que se pendurar.
3. **Saida gerada com PII nao entra no repo**, mesmo privado, mesmo util como
   prova. O gerador entra.
4. **Diff que mente e diff que nao se le.** Normalizar antes do push foi mais
   barato que descobrir na proxima sessao por que `app.css` "mudou inteiro".

---

## 8. Pendencias

1. **`.gitattributes` com `* text=auto eol=lf`** (secao 4.2). Sem isso o proximo
   patch em Python recria o ruido de CRLF.
2. **Hoje e Conteudo continuam sem a forma nova.** O v48 recomendava Conteudo
   antes de Hoje; a Fila passou na frente duas vezes, por pedido direto. A
   recomendacao segue de pe.
3. Herdado do v47/v49, tudo ainda aberto:
   - o relatorio de entrega nao registra que foi enviado (sem `despachado_em`);
   - o texto do relatorio nao e configuravel (formato no JS);
   - `privado.fn_venda_atualizar` tem EXECUTE para `authenticated` e e SECURITY
     DEFINER, nomeado para o `pit-guard` decidir;
   - **VENDA-0003 duplicada** (faturamento inflado em R$ 8.400).
4. Escrita de volta no Notion (mover card no kanban) segue bloqueada pela
   capability "Update content" na integracao, que so o dono pode ligar.
