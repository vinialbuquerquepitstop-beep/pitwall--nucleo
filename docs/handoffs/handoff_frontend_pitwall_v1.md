# Handoff frontend (vitrine) v1 — 26/08/2026

Primeiro handoff da linha `frontend`. Ele NAO substitui o
`handoff_migracao_pitwall_v66.md`: complementa, cobrindo so o que a `vitrine`
construiu nesta sessao. O indice fica com a Torre.

---

## 1. Headline

A Fatia 1 do modulo Financeiro virou tela: aba `Financeiro` nova, com Visao
(placar + secoes de gasto por grupo), Movimentos (classificacao na linha e em
lote) e Importar (parser OFX no navegador, com previa obrigatoria antes de
gravar), tudo pendurado no invariante 18, que aparece como faixa fixa no topo.

---

## 2. O que mudou nesta sessao

| Arquivo | Delta | O que entrou |
|---|---|---|
| `public/index.html` | +11 | a aba `abaFinanceiro` (`.aba aba-rara`, grupo `Análise`, abaixo de `abaDash`), com svg de carteira 24x24 |
| `public/app.js` | +553 | bloco legivel `Financeiro` logo depois de `renderDash`, + 6 ancoras na regiao minificada da linha 1 e 2 na segunda regiao |
| `public/app.css` | +259 | secao `FINANCEIRO`, zero token novo no `:root` |
| `ferramentas/harness.py` | +703 | fixture das 6 RPCs, balde `extrato` stubado e **87 assercoes novas** |
| `ferramentas/validar.py` | +31 | duas excecoes NOMEADAS (detalhe na secao 3.6) |
| `ferramentas/diag_mobile.py` | +46 | `abaFinanceiro` na lista medida + varredura das tres sub-views |

### A tela, por sub-view

- **Topo (visivel nas tres):** chips `Visão · Movimentos · Importar`; seletor
  `Empresa | Pessoal | Tudo`; navegador de mes com a janela **DECLARADA**
  (`de 01/08 a 25/08`), que no mes corrente para em HOJE e nao no ultimo dia do
  mes; e a faixa do invariante 18.
- **Faixa do invariante 18:** so aparece com `nao_classificado_n > 0`. Diz o
  valor, a contagem, que os numeros abaixo ignoram aquilo, que o numero e a
  **soma com sinal** e que ele **nao muda com o filtro de dominio**. Botao
  `Classificar agora` cai direto na lista ja filtrada.
- **Visao:** placar de 4 celulas (`entrou`, `saiu`, `resultado`,
  `não classificado`) no padrao `pitboard`; secoes por grupo em `<details>`, com
  barra proporcional, `pct`, `delta_pct` e as categorias dentro; bloco de
  entradas separado abaixo; rodape declarando que categoria `neutro` fica fora
  dos dois blocos.
- **Movimentos:** lista densa newest-first; dois `<select>` por linha que chamam
  `fin_classificar` com UM id; checkbox por linha + barra de lote com N ids numa
  unica chamada; filtro `só não classificados`; `+ lançamento manual`.
- **Importar:** arrastar ou escolher `.ofx`; parser no navegador (~70 linhas
  legiveis); **previa obrigatoria** (quantos, periodo, saldo final, banco e as 8
  primeiras linhas); so entao `Confirmar`. Sobe para o balde privado `extrato`
  em `<tenant_id>/<ts>-<nome>` e so depois chama `fin_importar_extrato`.

---

## 3. Decisoes tomadas, e o que foi RECUSADO

### 3.1 As "4 ancoras" da linha 1 eram SEIS. Recusei entregar so as 4.

O briefing listou 4 ancoras. Duas delas nem estao na linha 1 (o
`Y("abaDash","click",...)` mora na SEGUNDA regiao minificada), e faltavam duas
que sao defeito visivel:

- **`topoTit`**: o ternario termina em `:"Dashboard"`. Aba nova sem entrada
  propria herda o **fallback** e a tela escreve "Dashboard" em cima do
  financeiro. Assercao dedicada trava isso hoje.
- **lista do `pitboard`**: sem incluir `financeiro`, o placar de LEAD (`na
  fila`, `em atraso`, `ativos`, `na base`) ficaria desenhado por cima do placar
  de dinheiro. Sao numeros de outro laco.

Mais a lista do `abaMais` (a aba e `.aba-rara`, entao vive na gaveta do celular
e precisa acender o proprio `Mais`). Total: **6 ancoras na linha 1, 2 na segunda
regiao**.

### 3.2 UM ponto de entrada no delegado, em vez de uma dezena de `if`

Na segunda regiao minificada entrou UMA linha dentro de `A()`:

```js
if(0===String(o).indexOf("fin-"))return void finAcao(o,t,e);
```

Toda a logica dos 16 `data-acao` da aba mora em `finAcao()`, no bloco legivel.
Recusei espalhar `if("fin-x"===o){...}` no minificado: cada um seria uma ancora
a mais para provar e um pedaco de logica ilegivel.

### 3.3 Cor: nenhum token novo, e a colisao foi ASSUMIDA e nomeada

Sao **9 grupos financeiros** e **7 tokens de trilho medidos**. `trilhoDe()`
faria `hash % 7` e colidiria em lugar imprevisivel. Recusei inventar token sem
medir. O que entrou:

- mapa EXPLICITO grupo -> token, com **uma** colisao escolhida a dedo:
  **Marketing e Vida** dividem `--tr-conteudo`. Sao os dois icones mais
  distantes entre si (megafone x xicara) e vivem em lados opostos do dominio.
  Grupo desconhecido cai no anel do `trilhoDe` com icone generico: nunca vira
  buraco.
- **`Sem categoria` NAO e trilho, e ESTADO**: usa `--morno`, o mesmo token de
  `nf-falta` / `btn-acao.nf-pede`. Isso libera um dos 7 e diz a verdade: falta
  de categoria e trabalho pendente.
- **barra de secao em UM tom so** (`--dim`, 5.43 contra `--surface`). Barra
  colorida por categoria ja foi reprovada duas vezes neste projeto.
- **gasto NAO e vermelho.** `--erro` fica so em dois lugares: a faixa de nao
  classificado (integridade do dado) e o `resultado` NEGATIVO (`--erro-fg`,
  espelhando o `.vg-num.neg` da aba Vendas). Assercao com cor computada trava
  que `saiu` e a linha de saida **nao** saem em vermelho.
- **`delta_pct` neutro.** Recusei pintar variacao de verde/vermelho: gasto que
  sobe nao e necessariamente ruim (comprar estoque sobe Mercadoria), e a tela
  nao tem como saber. `delta_pct === null` desenha **`novo`**, nunca `0%`.

### 3.4 O sinal do lancamento manual e SELETOR, nao um menos digitado

`fin_lancar` recebe `valor` com sinal. Recusei um campo de texto onde o dono
precisa lembrar do tracinho justamente no campo que decide se o mes fechou no
azul. Entrou `Tipo: Saída | Entrada` + valor positivo; o JS monta `-40.00`.

### 3.5 Upload que falha NAO aborta a importacao

`arquivo` e opcional na RPC. Se o upload cair, a importacao segue **sem** o
campo e a tela **AVISA** que o extrato nao ficou guardado. Perder o extrato e
ruim; perder a importacao que o dono acabou de conferir na previa e pior.

### 3.6 As duas excecoes NOMEADAS em `validar.py` (nao repontei baseline)

Dois guard-rails bateram, e **os dois eram reais**:

**a) `_esperadas` das abas raras.** Reprovou com
`entraram sem registro: ['abaFinanceiro']`. Real: o proprio arquivo diz que aba
nova e decisao de navegacao e "passa por este arquivo de proposito", porque a
barra do celular so tem 6 lugares. Excecao: `abaFinanceiro` entrou no conjunto,
com comentario dizendo por que e rara.

**b) Regra 11.1, contador do azul.** Acusou tres seletores novos com
`var(--accent)`: `.fin-lote-n`, `.fin-chk` e `.fin-solta.alvo`. Julguei um a um:

- `.fin-lote-n` (contador da barra de lote): **a regra estava certa**. Um
  contador nao age, ele conta; azul ali e pintura de dado. **Corrigi o CSS** para
  `var(--text)`. Nao virou excecao.
- `.fin-chk` (`accent-color` da caixa de selecao nativa) e `.fin-solta.alvo`
  (area de soltar enquanto o arquivo esta em cima): sao **affordance de
  controle**, irmaos de `:hover` e do anel de foco. No caso do checkbox o
  navegador ia usar UM azul de qualquer jeito; a regra so decide qual.

Excecao exata aberta, nomeada uma a uma:

```python
CONTROLE_NATIVO = ['fin-chk', 'fin-solta.alvo']
```

com o papel `'controle nativo ou alvo de soltar'`. **Os auto-testes antigos
continuam intactos** (a regra ainda REPROVA `.met-barra i` e `.cap-barra i`) e
entraram quatro novos, dois deles provando que a excecao **nao vaza**:

```python
assert papel_do_azul('.fin-lin') is None
assert papel_do_azul('.fin-barra i') is None
```

**A baseline `.antes` NAO foi repontada em nenhum momento.** Repontar calaria de
carona todas as outras reprovacoes herdadas.

### 3.7 O que o `diag_mobile` NAO estava medindo (achado desta sessao)

As cinco larguras deram EXIT 0 **antes** de eu tocar no `diag_mobile.py`. Era
verde vazio: a lista `abasIds` e chumbada e nao continha `abaFinanceiro`, entao
a tela nova nunca foi desenhada na medicao. Corrigido, e mais que isso:

- as **tres sub-views** sao medidas separadamente (`abaFinanceiro/visao`,
  `/movimentos`, `/importar`), porque a que aperta o layout (linha com checkbox +
  descricao + valor + DOIS seletores) NAO e a que abre por padrao;
- a **barra de lote** nasce `display:none` e elemento invisivel nao entra na
  medicao: o diagnostico marca dois lancamentos para abri-la;
- o **formulario manual** nasce recolhido: e aberto antes de medir;
- quatro guardas REPROVAM se `.fin-lin`, `#finLancConta`, `#finSolta` ou
  `.fin-alerta` nao estiverem no DOM na hora da medida. Injecao que nao rende
  elemento e pior que injecao nenhuma.

### 3.8 Uma flake real, encontrada e morta

A primeira rodada teve uma assercao do parser passando e falhando entre duas
execucoes com o MESMO codigo. Causa: `file.arrayBuffer()` nao anda junto com o
`--virtual-time-budget` do headless, entao `espera(420)` fixa e loteria. Trocado
por espera por CONDICAO (`finAte`), e o resultado da leitura anterior sai do DOM
antes do disparo seguinte, senao a espera acha o bloco velho e a assercao mede a
leitura passada.

---

## 4. Provas

| O que foi testado | Comando exato | Resultado | Exit |
|---|---|---|---|
| sintaxe, contrato de ID/classe, regra 11.1 do azul | `python ferramentas/validar.py` | `TUDO PASSOU` | **0** |
| comportamento em Chrome headless (cor computada) | `python ferramentas/harness.py` | `829 passou, 0 falhou` | **0** |
| contraste dos 7 trilhos | `python ferramentas/prova_trilho.py` | ok | **0** |
| degraus do grafico do Escopo | `python ferramentas/prova_grafico.py` | ok | **0** |
| contraste da aba Conteudo | `python ferramentas/prova_atmosfera.py` | `ATMOSFERA OK` | **0** |
| parse do bundle | `node --check public/app.js` | silencioso | **0** |
| geometria a 360px | `python ferramentas/diag_mobile.py 360` | `0 sobreposicoes, 0 estouros` | **0** |
| geometria a 390px | `python ferramentas/diag_mobile.py 390` | `0 sobreposicoes, 0 estouros` | **0** |
| geometria a 414px | `python ferramentas/diag_mobile.py 414` | `0 sobreposicoes, 0 estouros` | **0** |
| geometria a 1280px | `python ferramentas/diag_mobile.py 1280` | `0 sobreposicoes, 0 estouros` | **0** |
| geometria a 1440px | `python ferramentas/diag_mobile.py 1440` | `0 sobreposicoes, 0 estouros` | **0** |
| cirurgia nas 2 regioes minificadas (fatia por ancora) | script da secao 4.1 | `PROVADO` | **0** |
| cirurgia por CORPO DE FUNCAO (md5 nome a nome) | script da secao 4.1 | `PROVADO` | **0** |

**Assercoes: 829, 0 falhas.** Piso da v65 era 713; subiu 116, das quais **87 sao
`fin:`** (as outras 29 sao o mesmo conjunto de sempre, que passou a rodar com o
fixture do Financeiro carregado). Duas assercoes antigas foram ATUALIZADAS, nao
silenciadas: `9 abas raras` -> `10 abas raras`, e o mesmo numero em `validar.py`.
Nenhuma foi removida.

### 4.1 Como provei que a linha 1 mudou SO nas ancoras

`git diff` exibe a linha inteira num arquivo de uma linha so: ele nao distingue
"trocou uma ancora" de "reescreveu tudo". Duas provas independentes, ambas com
controle negativo.

**Prova A, fatia por ancora.** A linha do `HEAD` e a do disco sao cortadas nas
MESMAS ancoras nomeadas e os trechos INTERMEDIARIOS sao comparados byte a byte:

```
== linha 1 (HEAD) / 1 (disco) ==   md5 63cbc7f2 -> c2cd848d   27371 -> 27621 chars
   [ok]  12428 chars intactos antes de  E("abaDash")&&E("abaDash").setAttribute(...
   [ok]    508 chars intactos antes de  ["indicacoes","captacao","dashboard",...
   [ok]    390 chars intactos antes de  "pitscare"===n?"Pitscare":"rotina"===n?...
   [ok]    347 chars intactos antes de  ["captacao","hoje","conteudo","rotina",...
   [ok]    404 chars intactos antes de  else if("dashboard"===n)renderDash();
   [ok]   1447 chars intactos antes de  if("dashboard"===n)return renderDash(sil);
   [ok]  11398 chars intactos depois da ultima ancora
   6 ancoras trocadas, 7 trechos intermediarios identicos byte a byte

== linha 3652 (HEAD) / 4201 (disco) ==  md5 ea11e66b -> 64afdd4a  23895 -> 24010
   [ok]   5499 chars intactos antes de  var o=e.getAttribute("data-acao"),...
   [ok]  16831 chars intactos antes de  Y("abaDash","click",function(){G("dashboard")}),
   [ok]   1434 chars intactos depois da ultima ancora

controle negativo (mudanca fora da ancora e detectada): SIM
```

Somando: 27.371 e 23.895 caracteres cobertos, sem sobra.

**Prova B, por corpo de funcao.** Varredura de chaves balanceadas (tratando
string E literal de regex, senao o `/'/g` do `c()` abre uma aspa que nunca fecha)
extrai o corpo de 30 funcoes nomeadas das duas regioes e compara md5:

```
   c() 978572cb -> 978572cb identico        x() b3555718 -> b3555718 identico
   k() a58f628c -> 42dc4ec7 MUDOU (esperado)   3277->3478 chars
   reRenderAba() 69d77687 -> eecfa7a2 MUDOU (esperado)   434->483 chars
   G() 98bb9fe7 -> 98bb9fe7 identico
   A() 6d154944 -> 705609ce MUDOU (esperado)   8188->8248 chars
   contDragOver / contDrop / copiarFallback / moverConteudo: identicos
PROVADO: so k(), reRenderAba() e A() mudaram; o resto e byte a byte identico.
```

O script REPROVA nos dois sentidos: funcao fora da lista que mudou, e funcao da
lista que NAO mudou (ancora nao aplicada).

---

## 5. Ressalvas (o que NAO foi provado)

1. **Nada rodou contra o banco vivo.** Toda prova e contra o Supabase FALSO do
   harness. O contrato das 6 RPCs veio do briefing e das migrations em
   `supabase/migrations/20260826_fin_fatia1_*.sql`, lidas do repo. **Vetor a
   provar:** abrir a aba logado como dono e conferir que `fin_config`,
   `fin_painel` e `fin_movimentos` respondem `ok:true`.
2. **O balde `extrato` nunca foi tocado de verdade.** O `t.storage` e stub.
   **Vetor:** importar um OFX real e conferir o objeto em `<tenant_id>/` no
   Storage, e que a policy recusa caminho fora da pasta.
3. **A recusa por papel nao foi exercida.** As 6 RPCs devolvem
   `Financeiro e restrito ao dono`, e a tela trata (`d.msg` num `.estado erro`),
   mas isso nao foi rodado com um JWT de vendedor. **Vetor:** logar como vendedor,
   abrir a aba e conferir que aparece o recado, nao uma tela quebrada.
4. **Um unico OFX sintetico foi parseado.** Cobre tag sem fechamento,
   ISO-8859-1, `MEMO` ganhando de `NAME`, `TRNAMT` com sinal e `LEDGERBAL`.
   **Nao** foi testado contra um arquivo real do banco do dono. **Vetor:** baixar
   o extrato de verdade e conferir a previa antes de confirmar (a previa existe
   exatamente para isso).
5. **`truncado` foi provado por interruptor, nao por volume.** Nunca houve 500+
   linhas. O que esta provado e que a tela DIZ quando o servidor avisa.
6. **`fin_painel` no harness devolve `secoes`/`entradas` como fixture
   constante.** Prova a TELA (barra, delta, icone, grupo), nao a agregacao.
7. **Nenhum deploy, nenhum commit.** A working tree esta suja de proposito, com
   os 6 arquivos modificados.
8. **A colisao Marketing/Vida nao foi medida com os dois grupos grandes lado a
   lado**, porque o fixture nao tem os dois. O que esta provado e que TODA secao
   carrega icone.

---

## 6. Pendencias

| # | Pendencia | Bloqueio / nota |
|---|---|---|
| 1 | Rodar a aba contra o banco vivo | nao bloqueado; depende do dono abrir logado |
| 2 | Importar o primeiro extrato real | nao bloqueado; e o unico jeito de fechar a Ressalva 4 |
| 3 | `pit-guard` revisar OWASP de cliente | nao bloqueado. Pontos a olhar: todo valor interpolado passa por `c()`; nenhuma escrita direta na tabela (validar.py 11.5 confirma); o balde e privado; o `tenant_id` do caminho vem de `app_usuario`, nunca de argumento montado no cliente |
| 4 | Fatia 2 (regras que classificam sozinhas) | **de proposito** so depois da primeira importacao real: as regras tem de nascer das descricoes que se repetiram, nao de palpite |
| 5 | `abaFinanceiro` na gaveta do `Mais` no celular | funciona (auto-posiciona por `.aba-rara`), mas a gaveta ja tem 10 itens. Quando passar de 12, vira decisao de navegacao do dono |
| 6 | `CLAUDE.md` cita `handoff_migracao_pitwall_v63` como topo | ja esta em v66; a Torre atualiza |

---

## 7. Primeiro movimento do proximo chat

Abrir a aba **Financeiro** logado como dono e olhar a tela vazia. Ela e o estado
real de hoje (`fin_movimento` tem 0 linhas) e foi construida para esse momento:
diz `Importe o extrato do seu banco em OFX para começar` e leva direto para a
sub-view Importar. Se ela aparecer, o contrato das 3 RPCs de leitura esta de pe e
as Ressalvas 1 e 3 caem juntas.

Depois: importar UM extrato real e **conferir a previa antes de confirmar**. E o
unico ponto do fluxo onde um parser errado ainda pode ser barrado sem custo.

---

## 8. Invariantes reforcados

- **18 (novo).** Movimento sem `dominio` nao entra em total nenhum. Na tela:
  faixa obrigatoria no topo, com valor visivel, nas tres sub-views, declarando o
  que os numeros ignoram e que ela nao respeita o filtro de dominio.
- **4.** Estado derivado na leitura. Nada de `natureza` calculada no cliente: a
  tela le `natureza_esperada` da config e o `aviso` do servidor, nunca recalcula.
- **11 e 12.** Conta, categoria e grupo vem de `fin_config()`. Zero `conta_id`,
  zero lista de categoria e zero rotulo chumbado no JS. A chave e o `codigo`.
- **Tela que omite recorte MENTE.** Janela declarada (`de X a Y`), mes corrente
  parando em hoje, `truncado` dito em voz alta, `delta_pct` null virando `novo` e
  nunca `0%`, e a previa declarando quantas linhas de quantas esta mostrando.
- **Trilho x Sinal.** Categoria e urgencia nao disputam matiz; toda secao carrega
  ICONE, e o harness assere isso. `--erro` e falha de SISTEMA: gasto nunca.
- **Nada sobe sem prova.** 829 assercoes, 0 falhas, 11 exit codes zero, e a
  cirurgia no minificado provada por duas vias com controle negativo.
- **Guard-rail nao se cala repontando baseline.** As duas excecoes sao NOMEADAS,
  com rationale, e os auto-testes que as mantem honestas entraram junto.
