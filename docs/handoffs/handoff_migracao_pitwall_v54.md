# Handoff Migracao Pit Wall (Nucleo) v54

Substitui a v53. Data: 12/08/2026.

---

## 1. Headline: o card de Insights ganhou memoria de tempo

Pergunta do dono, depois de o v53 subir: *"como vai funcionar o funcionamento da
aba insights?"* e, na sequencia, *"quero entender justamente como fazer esse card
seguir dando insights."*

A resposta honesta nao era "empilhar mais regra". As quatro regras do v53 olham
**so a janela atual**, e por desenho elas **se autodestroem**: preencheu a origem
do lead, o alerta some. Um card que repete a mesma frase todo mes significa que
ninguem agiu, ou que nada novo entrou.

O que entrou: **cinco regras que comparam a janela com a anterior**, que e a unica
fonte que nao seca, porque a cada periodo que fecha existe material novo, com 3
vendas ou com 300. **Zero banco.** Reaproveita o `aAnt` que o `dvPainel` ja
calculava para as setas dos KPIs e nunca tinha passado para os insights.

---

## 2. O card tinha subido SEM PROVA NENHUMA

Medido antes de escrever qualquer linha: `grep -n "\.ins\|dvInsights" ferramentas/`
nao devolvia **nada** no `harness.py`. As "352 assercoes, 0 falhas" do v53 nunca
encostaram no card de Insights. Ele foi para producao com quatro regras de negocio
inteiramente desprotegidas.

Isso e pior que uma regra errada: e uma regra que ninguem percebe quando quebra.
O v53 comemorou "352 passou sem edicao na suite" como sinal de que o formato novo
respeitou as chaves de leitura. Verdade, e ao mesmo tempo o numero estava
escondendo que a logica nova nao tinha guard-rail nenhum.

**Agora sao 14 assercoes so para este card. Harness em 366/0.**

---

## 3. A regra que da o tom: janela em curso NAO se compara pelo total

`dvRitmo(lim)` em `public/app.js`. No dia 12, agosto sempre "cai" contra julho
inteiro. Comparar 12 dias com 31 pelo total bruto e o **calendario falando, nao o
negocio**, e produziria um alarme falso todo comeco de mes.

- **Volume** (faturamento, entrada de leads) com a janela pela metade vira
  **ritmo por dia**, e o texto do insight diz que virou.
- **Taxa** (margem) nao precisa: uma razao nao encolhe so porque o mes esta na
  metade.

Medido no fixture da suite: **bruto -63,4% contra ritmo -5,5%**. Sem a correcao, o
card gritaria "faturamento despencou 63%" quando nao aconteceu nada.

---

## 4. A contradicao que so a FOTO pegou (terceira sessao seguida)

Suite verde, e a foto da janela **Mês** mostrou a faixa de KPI do topo marcando
`↓ −63,4% vs jul/2026` enquanto o card de Insights, corrigido por ritmo, ficava
**calado**.

Duas contas do mesmo numero na mesma tela, sem nenhuma das duas explicar a outra.
E exatamente a familia de defeito que o v53 pegou na conversao (KPI dizendo 0,0%
e rodape dizendo 133,3%).

**Nao mexi na faixa por conta propria**: o formato dela veio da referencia que o
dono aprovou, e trocar o metodo de comparacao dela e decisao dele. O card passou a
**declarar a divergencia** quando ele mesmo silencia o alarme:

> **A queda de 63,4% no topo é calendário**
> A faixa compara 12 dias contra 31. No mesmo ritmo por dia a diferença é de 5,5%,
> não de 63,4%.

A regra so dispara quando o bruto passa do corte E o ritmo nao passa. Quando a
queda e real pelos dois criterios, ela nao aparece e o insight normal de
faturamento entra no lugar.

---

## 5. As regras novas

| regra | corte | correcao de ritmo |
|---|---|---|
| Margem caiu / subiu | **3 p.p.** | nao (e taxa) |
| Faturamento caiu / subiu | **25%** | sim |
| Entrada de leads caiu / subiu | **30%** | sim |
| Canal parou de vender | vendia antes, zero agora, e ainda entra lead | — |
| Canal estreou vendendo | zero antes, vende agora | — |
| *(A queda/alta do topo e calendario)* | bruto >=25% e ritmo <25% | e a propria regra |

E tres mudancas estruturais no card:

1. **Ordem por gravidade**, nao por ordem de escrita: `ruim` -> `atencao` -> `bom`.
   Com a comparacao ligada a lista dobrou, e o que exige acao nao pode ficar
   embaixo de um elogio. Balde explicito em vez de `sort()`, porque estabilidade
   de sort nao e garantida em todo motor.
2. **Teto de 6 itens**, com o rodape dizendo quantos ficaram de fora.
3. **Rodape que declara a AUSENCIA.** Em `Tudo` nao ha periodo anterior; em
   qualquer janela o anterior pode nao ter tido venda. Antes o card so encolhia
   sem dizer por que, e tela que omite recorte mente.

A comparacao so entra com **base real**: periodo anterior que existe e que teve
venda. Comparar contra zero daria "+100%" em toda janela, que e a mesma mentira da
conversao acima de 100%.

---

## 6. O que aparece com o DADO REAL de hoje

Calculado contra o banco em 12/08/2026 (22 leads, 3 vendas, R$ 16.350).

**Janela Trimestre (a padrao):** as quatro regras antigas disparam, e **nenhuma
regra nova aparece**, porque o trimestre anterior (mar a mai) nao teve venda. O
rodape novo diz isso em vez de deixar a lista curta sem explicacao.

**Janela Mês:** o card sai de 1 para 4 insights.

| tom | insight |
|---|---|
| ruim | **Faturamento caiu 55,6%** (ritmo: R$ 200,00/dia contra R$ 450,00, janela em 12 de 31 dias) |
| ruim | **Entrada de leads caiu 72,8%** (19 leads em jul/2026 contra 2 agora) |
| atencao | **100,0% do faturamento sem canal** |
| bom | **Margem subiu 12,9 p.p.** (4,8% em jul contra 17,8% agora) |

Lido junto, isso diz o que nenhum card sozinho dizia: **agosto vende menos e capta
menos, com margem muito melhor.** Volume trocado por qualidade.

O bruto seria **-82,8%**. A tela mostra -55,6% porque agosto tem 12 dias corridos.

---

## 7. Provas

Todas nesta maquina, **exit code conferido**, depois da ultima mudanca:

| prova | resultado |
|---|---|
| `python ferramentas/harness.py` | **366 passou / 0 falhou** — EXIT 0 (eram 352) |
| `python ferramentas/validar.py` | EXIT 0 |
| `python ferramentas/prova_trilho.py` | EXIT 0 |
| `python ferramentas/prova_grafico.py` | EXIT 0 |
| `python ferramentas/diag_mobile.py` 360/390/414/1280/1440 | EXIT 0 nos cinco |
| `node --check public/app.js` | EXIT 0 |

**As 14 assercoes novas nao cravam nenhum numero de agosto.** A janela do dashboard
depende de `l()`, entao assercao com "agosto" dentro fica vermelha sozinha em
setembro sem nada ter quebrado. Cada expectativa e recalculada a partir do proprio
`VENDAS_STUB` / `LEADS`, por fora do app: e a **segunda conta**, e se ela e a do
app divergirem, uma das duas esta errada.

As tres que carregam a fatia:

- `a regra de margem concorda com a conta feita por fora` — `diferenca=-23.0 p.p.`
- `o alarme falso do calendario nao dispara: bruto passa do corte, ritmo nao` —
  `bruto=-63.4% ritmo=-5.5%`
- `quando o card discorda da faixa do topo, ele EXPLICA a divergencia`

---

## 8. `foto.py` ganhou um 4o argumento (seletor)

O estado que importa nesta fatia so existe **depois de um clique dentro da aba**:
o dashboard abre em Trimestre, e as regras de comparacao so tem base em Mês. Era
literalmente infotografavel.

```
python ferramentas/foto.py dashboard 1440 1500 "[data-acao=dv-janela][data-id=mes]"
```

O seletor entra no nome do arquivo, senao a foto do estado clicado sobrescreve a
do estado base e ficam duas leituras diferentes com um nome so.

**Seletor que nao casa pinta uma faixa vermelha na propria foto** (`FOTO INVALIDA:
seletor nao encontrado`). Falhar calado devolveria a imagem do estado base com
cara de estado clicado, que e a mesma familia de mentira da montagem velha que
este script ja aborta desde o v53.

---

## 9. Onde encostou

| arquivo | o que |
|---|---|
| `public/app.js` | `dvDias`, `dvRitmo`, `dvCompara` novos (linhas 1267-1333). `dvInsights` passou a receber `aAnt`, `ant` e `lim`; ganhou ordem por gravidade, teto de 6 e rodape de ausencia. `dvPainel` passa os tres argumentos novos. **Linha 1 minificada intacta** |
| `ferramentas/harness.py` | bloco novo no fim do `rodar()`: 14 assercoes sobre `.c-ins`, todas com a conta refeita por fora |
| `ferramentas/foto.py` | 4o argumento (seletor clicado apos a aba), sufixo no nome do arquivo, faixa vermelha quando o seletor nao casa |
| `public/app.css` | **nao encostou.** O rodape reusa `.cd-pe`, que ja existia |
| banco | **nao encostou** |

---

## 10. Pendencias

1. **As duas regras de canal (`parou de vender` / `estreou vendendo`) NAO tem
   prova.** No fixture do harness os `lead_id` das vendas (`l5`, `l6`, `l8`, `l9`)
   nao batem com os UUIDs dos 3 leads de `dados_teste.json`, entao toda venda cai
   em `sem origem` e as duas regras nunca chegam a rodar. Consertar exige mexer no
   fixture compartilhado que sustenta as outras 352 assercoes. **Decisao consciente
   de nao mexer**, e nao esquecimento: risco desproporcional ao ganho.
2. **A faixa de KPI do topo continua comparando total contra total.** Hoje o card
   explica a divergencia; o certo seria a faixa tambem virar ritmo quando a janela
   esta em curso, e ai o aviso some sozinho. **E decisao do dono**, porque mexe no
   formato que ele aprovou a partir da referencia.
3. **Os quatro cortes das regras antigas continuam cravados no JS** (`>=5`, `>=3`,
   `>=5 p.p.`, `>=20%`), e os tres novos tambem (`3 p.p.`, `25%`, `30%`). Foram
   calibrados para 22 leads. Com 300 leads, "canal com 5 leads e nenhuma venda"
   dispara para todo canal e vira ruido. Pelo espirito do **invariante 11**, numero
   de regra deveria viver em tabela de config, nao dentro da funcao. Passa hoje
   porque o custo de errar e baixo.
4. **O drill-down dos KPIs continua fora** (pendencia 1 do v53): o dono pediu
   "clicar em faturamento e lucro e ver detalhes" e os cards de KPI nao clicam.
5. **2 de 3 vendas reais seguem sem origem** (R$ 7.950, 48,6% do faturamento). O
   painel de canal fica cego e o proprio insight acusa. Correcao e do dono.
6. Herdado e ainda aberto: `k()` chama `renderVendas` a cada tecla da busca;
   `.gitattributes` com `* text=auto eol=lf`; relatorio de entrega sem
   `despachado_em`; `privado.fn_venda_atualizar` com EXECUTE para `authenticated`
   e SECURITY DEFINER; **Conteudo e Hoje continuam sem a forma nova** (setima vez
   atropelados).
7. Escrita de volta no Notion segue bloqueada pela capability "Update content".

---

## 11. A armadilha de fim de linha, pela TERCEIRA vez

`ferramentas/harness.py` saiu da edicao em **CRLF** (2.071 linhas), com o indice em
LF. Pego com `git ls-files --eol` **antes do commit** e convertido de volta.

E a mesma armadilha da secao 11 do v52 e da secao 12 do v53. Tres sessoes seguidas.
O comando que responde continua sendo `git ls-files --eol`, nunca `grep` por `\r`,
e a correcao definitiva e a pendencia 6 (`.gitattributes`), que ninguem parou para
fazer ainda porque cada sessao a trata como ruido de fim de obra.
