# Spec: Escopo, o grafico vertical de abandono e a urgencia que faltava

Data: 12/08/2026. Estado: desenho aprovado pelo dono nesta sessao.

Continua a `2026-08-05-escopo-meta-e-dia-design.md` (Fatia 2). Onde as duas
discordarem, esta vale, e a secao 2 nomeia cada divergencia.

---

## 1. O problema

O dono pediu "acompanhamento em grafico vertical das sessoes no escopo". Quando as
quatro leituras possiveis do pedido foram postas na mesa, ele reprovou as quatro e
declarou o alvo real, textual:

> **"deve servir pra ver quais estao em andamento. olhar as urgencias definidas,
> entender quais estao sendo deixadas de lado."**

Sao tres perguntas. Medido no banco em 12/08/2026, **so uma tem dado hoje**:

| pergunta | dado que responde | estado real |
|---|---|---|
| quais estao em andamento | `escopo_acao.status = 'fazendo'` | **1 acao de 12** (Calculadoras) |
| urgencias definidas | `escopo_acao.prioridade` | **null nas 12**. Nunca teve tela |
| quem esta sendo deixada de lado | `dias_parada` do `escopo_completo()` | 2 a 8 dias, com massa real |

Retrato completo: 8 frentes ativas, 12 acoes vivas, **0 feitas**, 5 travadas, 2 frentes
sem acao nenhuma (`captacao_organica`, `comercial`), nenhuma frente com meta declarada.

`prioridade`, `data_alvo` e `esforco` existem em `escopo_acao` desde a Fatia 1 e foram
declaradamente cortados da tela na secao 9 da spec de 05/08. **Um grafico de urgencia
hoje desenharia 12 barras cinzas identicas.** Por isso a urgencia entra nesta obra em
vez de ser lida de um campo vazio: o pedido pressupoe um dado que o sistema nunca
ofereceu onde declarar.

## 2. O que esta spec muda na de 05/08

### 2.1 O placar de texto sai do topo (decisao do dono)

A Fatia 1 estabeleceu: *"A nota nunca aparece sozinha: as tres parcelas vao do lado.
Nota escondida vira fe, e ninguem discute com fe."* O dono escolheu conscientemente
substituir `escPlacar()` pelo grafico.

**A regra continua valendo, mudando de lugar:** nota, faixa e as tres parcelas passam
para o cabecalho de cada bloco de frente (`.esc-frente-cab`), que hoje so mostra
`feitas/total`. Nada e apagado. Fica registrado como decisao consciente do dono, e nao
como esquecimento, porque handoff que so guarda estado obriga a proxima sessao a
redescobrir o porque.

### 2.2 A urgencia sai da Fatia 3 e entra agora

A secao 9 da spec de 05/08 declarou `data_alvo`, `prioridade` e `esforco` sem tela ate
a Fatia 3. **Sobe so `prioridade`**: e a unica das tres que o pedido do dono exige.
`data_alvo` e `esforco` continuam sem tela, e continuam declarados como cortados.

---

## 3. O fato que sustenta o eixo

`privado.fn_escopo_evento()` so insere em `escopo_acao_evento` quando
`new.status is distinct from old.status`. Verificado no banco em 12/08/2026.

Logo, **declarar prioridade nao gera evento e nao zera `dias_parada`**.

Isso nao e detalhe de implementacao, e a condicao de existencia do grafico: se a
escrita de urgencia gerasse evento, declarar urgencia faria a frente abandonada parecer
recem-tocada, e a tela nova falsificaria o proprio eixo. Vira prova (secao 7, item 18),
porque um `CREATE OR REPLACE` futuro na trigger derrubaria a garantia em silencio.

E o mesmo cuidado que o `and not a2.arquivada` do `escopo_completo()` ja documenta:
criar e arquivar acao descartavel zerava o relogio da frente e comprava 30 pontos de
Movimento sem trabalho nenhum.

---

## 4. O desenho

Bloco `.esc-graf` no topo da aba Escopo, no lugar de `.esc-placar`.

```
abandono por frente            8 frentes · 12 acoes vivas · 12/08/2026
                               altura = dias sem movimento

30d ┼- - - - - - - - - - - - - - - - - - - - - - - - -
    │ ░░
 8d ┤ ██   ░░
 7d ┼ ██   ██   ██   ██ - - - - - - - - - - - - - - - -
    │ ██   ██   ██   ██   ▓▓   ▓▓
 0d ┴──────────────────────────────────────────────────
     col  pit  wha  cal  ass  pro
      !!    ·    ·   ●!   ·    ·        ● = tem acao em andamento

sem acao nenhuma: Captacao organica · Comercial
sem urgencia declarada: 6 de 8 frentes
```

### 4.1 Eixo

**Y = `dias_parada`**, que `escopo_completo()` ja calcula no fuso do Brasil. **Zero
conta nova no JS**: duplicar a conta criaria duas verdades para o mesmo numero, que e
exatamente o defeito que o comentario do bloco Escopo no `app.js` ja proibe para a nota.

**Escala fixa de 0 a 30 dias, nunca relativa ao maximo.** 7 e 30 sao os cortes que a
nota ja usa (`<=7` vale 30 pontos de Movimento, `>=30` vale 0). Reusar o corte existente
e obrigatorio: numero de regra novo aqui seria uma terceira regua para a mesma pergunta.
Escala relativa faria a frente menos parada parecer alta num dia bom.

Acima de 30 a coluna satura em 100% e leva a marca `30+`. **Saturar sem dizer que
saturou e mentir por omissao**, entao a marca nao e enfeite.

Linhas de corte desenhadas em 7d e 30d.

### 4.2 Cor: sinal de abandono, tres degraus

| dias parada | familia | por que |
|---|---|---|
| 0 a 7 | `--dim` | dentro do normal, nao merece alarme |
| 8 a 29 | `--morno` | trabalho pendente, a mesma familia do frete e da falta de NF |
| 30 ou mais | `--quente` | urgencia real |

**Nunca `--erro`.** Frente parada nao e falha de sistema, e a mesma razao pela qual o
painel de vendas pinta frete e taxas em `--morno`: margem sendo comida nao e falha.

Os tres valores entram MEDIDOS por `prova_grafico.py`, nunca escolhidos no olho. A
licao da 3a passada do painel de vendas vale inteira aqui: contraste WCAG responde "da
para ler texto sobre isso"; a pergunta de um grafico e "estas duas cores sao a mesma?",
e essa se responde com ΔE em OKLab.

### 4.3 Em andamento e o SEGUNDO CANAL, nao a cor

Frente com ao menos uma acao `fazendo` desenha a coluna **solida** e ganha o ponto `●`
sob o rotulo. Frente sem nenhuma vem **hachurada**.

A cor ja carrega abandono. Empilhar "em andamento" tambem na cor faria dois significados
disputarem o mesmo canal, que e o erro que o sistema Trilho x Sinal existe para evitar.
Quando a luminancia colide, o segundo canal NAO e enfeite, e a prova reprova se ele
sumir (item 16).

### 4.4 Urgencia

Derivada na leitura: a **maior prioridade entre as acoes vivas nao-feitas** da frente.
Nunca coluna (invariante 4).

Marca sob o rotulo: `!!` alta, `!` media, nada para baixa. Baixa nao ganha marca de
proposito: marca em tudo e marca em nada.

O rodape declara quantas frentes estao sem urgencia declarada. A tela cobra o dono,
que e a mesma escolha da Fatia 2 com as cinco metas em branco: o branco fica visivel na
tela que ele abre.

### 4.5 Frente sem acao nenhuma NAO desenha coluna

Vai na linha nomeada abaixo do eixo (`sem acao nenhuma: ...`).

Barra de altura 0 leria "parada ha 0 dias", ou seja, ativa. E a mentira que a faixa
`sem dado` existe para evitar. Hoje sao 2 de 8.

### 4.6 Interacao e recorte

Tocar a coluna rola ate o bloco daquela frente. O `aria-label` carrega o resumo inteiro
(nota, faixa, parcelas, dias, urgencia), como `.vg-mes` ja faz.

Ordem das colunas: **do mais parado para o menos**. O eixo e o abandono; a urgencia e
marca. Coluna alta com `!!` e o crime, e ele fica no canto de leitura primeiro.

Recorte no cabecalho, nunca em rodape que ninguem le: tela que omite recorte mente.

---

## 5. Contrato de dados

`escopo_completo()` ganha, **por frente**:

- `urgencia`: `'alta' | 'media' | 'baixa' | null` — maior prioridade entre acoes vivas
  nao-feitas
- `fazendo`: inteiro — quantas acoes vivas estao em `fazendo`

E **por acao**:

- `prioridade`: `'alta' | 'media' | 'baixa' | null`

Escrita por `definir_prioridade_acao(p_id uuid, p_prioridade text)`, espelhando a forma
de `mudar_status_acao_escopo(p_id, p_status, p_motivo)`. Aceita os tres valores e
nulo/vazio, que **LIMPA**. Valor fora do dominio volta como `{ok:false, msg:...}`
explicito, **nunca deixando o CHECK estourar cru** na tela.

O dominio ja existe no banco: `escopo_acao_prioridade_ck` permite
`alta | media | baixa | null`.

---

## 6. O que fica cortado, e declarado

- **Mudanca de prioridade nao e auditada.** `escopo_acao_evento` e tabela de transicao
  de status (`de_status` / `para_status`) e nao comporta o campo; auditar exigiria
  objeto novo. Prioridade e reversivel e nao e a regua da nota, ao contrario da meta,
  que ganhou trigger propria na Fatia 2a. Se o dono quiser o rastro, e fatia separada.
- **`data_alvo` e `esforco` seguem sem tela** (secao 2.2).
- **O trilho da frente segue cinza**, herdado da Fatia 2, secao 9.

---

## 7. Criterio de aceite

**Regra dura herdada: nenhuma prova de caminho de escrita por `SRC.indexOf`.** O v46
registrou 69 assercoes verdes convivendo com quatro botoes que so lancavam TypeError,
porque string-matching casa igual com o codigo quebrado.

Frontend (`ferramentas/harness.py`, Chrome headless):

1. Contagem de colunas = frentes com acao; as `sem_dado` **nao** viram coluna e
   aparecem na linha nomeada.
2. Altura da coluna bate com `dias_parada` na escala 0-30.
3. Frente com 35 dias satura em 100% e mostra `30+`.
4. Frente com `fazendo` tem a marca e a coluna solida; sem `fazendo`, hachurada.
5. Clicar em declarar prioridade assere a RPC chamada **com os argumentos**.
6. Cancelar nao chama RPC nenhuma.
7. `r.error` da RPC renderiza erro visivel, nao silencio.
8. `pode_editar = false`: o seletor de prioridade nao existe no DOM.
9. Nenhum TypeError no console durante os casos acima.
10. Nota, faixa e as tres parcelas continuam legiveis no cabecalho da frente depois de
    o placar sair do topo.
11. Frente com urgencia `alta` mostra a marca; com `baixa`, nao mostra.

Cor (`ferramentas/prova_grafico.py`):

12. Os tres degraus medidos contra `--surface`, alvo 3:1 de faixa.
13. ΔE em OKLab entre os tres vizinhos (skill `dataviz`,
    `node scripts/validate_palette.js --mode light`).
14. A hachura da coluna sem `fazendo` existe no CSS: se sumir, reprova.

SQL (`ferramentas/prova_escopo_prioridade.sql`):

15. `alta`, `media` e `baixa` aceitas.
16. `urgente` recusada com `msg`, nao com erro cru de CHECK.
17. Nulo e string vazia LIMPAM a prioridade.
18. **Declarar prioridade NAO insere linha em `escopo_acao_evento`.** E a prova que
    protege o eixo do grafico (secao 3).
19. `authenticated` de outro tenant nao le nem escreve prioridade.

Integridade e regressao:

20. `validar.py` sem reprovacao NOVA (as 4 herdadas seguem abertas por decisao do dono
    na v45; **nao repontar `.antes`**).
21. `harness.py` (hoje 366/0), `prova_trilho.py`, `prova_grafico.py`,
    `node --check public/app.js`, todos com **EXIT CODE conferido**, nunca o texto.
22. `diag_mobile.py` em 360 / 390 / 414 / 1280 / 1440.
23. Integridade do `app.js` minificado provada por **reaplicar o patch sobre o baseline
    e exigir igualdade total**, com CRLF normalizado. Comparacao de prefixo e sufixo nao
    vale (v46, secao 6.2).
24. `git ls-files --eol` antes do commit. A armadilha de CRLF pegou o `harness.py` em
    tres sessoes seguidas (v52, v53, v54).

---

## 8. Onde encosta

| arquivo | o que |
|---|---|
| `public/app.js`, bloco legivel (~269-307) | `escGrafico`, `escPlacar` sai do topo, `.esc-frente-cab` ganha nota e parcelas, seletor de prioridade na acao |
| `public/app.js`, **linha 1984 minificada** | roteador `A()`: `data-acao` novos, junto dos `esc-*` que ja vivem la. Via `ferramentas/patch_*.py` |
| `public/app.css` | bloco `.esc-graf*` no FIM do arquivo, reusando a familia `.vg-*`, sem partir a familia `.esc-*` |
| banco | `definir_prioridade_acao`, `escopo_completo()` estendida. So o agente `base` aplica |
| `ferramentas/harness.py` | assercoes 1-11 |
| `ferramentas/prova_grafico.py` | assercoes 12-14 |
| `ferramentas/prova_escopo_prioridade.sql` | novo, assercoes 15-19 |

---

## 9. O que o dono abre no fim

A aba Escopo com **6 colunas** ordenadas do mais parado para o menos, Colaboradores no
topo com 8 dias sem movimento, uma unica coluna solida (Calculadoras, a que tem acao em
andamento), duas frentes nomeadas abaixo do eixo como sem acao nenhuma, e um seletor de
urgencia em cada acao para o retrato parar de ser cinza.

**Aviso honesto sobre a primeira leitura:** com 0 feitas e 12 acoes vivas, o grafico vai
mostrar um escopo parado. Ele nao vai ficar bonito. Esse e o ponto: o dono pediu para
ver o que esta sendo deixado de lado.

---

## 10. Decisoes desta sessao, em uma lista

1. O alvo do grafico e abandono, com em-andamento e urgencia como marcas (dono).
2. O grafico substitui o placar de texto; nota e parcelas migram para o cabecalho da
   frente (dono).
3. A urgencia entra nesta obra em vez de esperar a Fatia 3 (dono).
4. Eixo em `dias_parada`, escala fixa 0-30, cortes reusados da nota.
5. Cor so carrega abandono; em-andamento vai no segundo canal.
6. Frente sem acao nao desenha coluna de altura 0.
7. Mudanca de prioridade nao e auditada, corte declarado.
8. `data_alvo` e `esforco` seguem sem tela.
