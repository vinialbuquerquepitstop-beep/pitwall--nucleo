# Guia de Uso dos Prompts do Financeiro

Data: 27/08/2026
Acompanha `claude/plano_mestre_financeiro_v1.md` (revisao 2).

---

## Parte 1: por que uma semana, e nao menos

Voce perguntou e a resposta e: **"semana" era folga minha, nao necessidade.** Vou separar o que e trabalho do que e espera, porque so um dos dois pode ser acelerado.

### O trabalho real, medido em sessoes

| Bloco | Prompts | Sessoes |
|---|---|---|
| Higiene e guardiao | P-R0, P-W1-COBERTURA | 1,5 |
| Repasse e tela do abatimento | P-W1-REPASSE, P-R1, P-R2 | 2,5 |
| **Voce julga a base** | nenhum, e no app | 1 (40 a 60 min) |
| Destravar operacao | P-R3, P-R4, P-R6, P-W2-CONTRAPARTE | 3 |
| Visao Pessoal e Agente 1 | P-W3-PESSOAL, P-W3-AGENTE1 | 2 |
| Metas, provisoes, alertas, Agentes 2 e 3 | P-W4-META, P-W4-AGENTES | 2 |
| Auditorias | P-AUDITA, 2 vezes | 1 |

**Total: 13 sessoes.** Uma sessao aqui e uma entrega fechada com commit, tipicamente 40 a 90 minutos.

Se voce fizer 2 sessoes por dia, isso e **7 dias corridos**, nao 4 semanas. Se fizer 1 por dia, 13 dias. O rotulo "semana" foi arbitrario e nao estava defendido em lugar nenhum. Retirado.

### O que NAO acelera com esforco

Duas coisas do plano dependem de tempo passar, nao de voce trabalhar mais:

1. **"Comparado com a media de 3 meses"** exige 3 meses de extrato.
2. **O agente conselheiro em modo Medio** exige o mesmo.

Voce tem **1 mes** (28/07 a 26/08). Foi por isso que eu espalhei o plano em semanas: eu estava, sem dizer, esperando o calendario andar.

### E aqui esta a saida que eu deveria ter proposto antes

**Baixe os extratos OFX dos ultimos 6 meses e importe todos.** O banco te da isso hoje, nao em marco.

Isso e seguro por desenho: a importacao ja deduplica por `hash_dedupe` e por `fitid`, entao periodo sobreposto nao gera linha repetida, e `fin_importacao` registra quantas foram novas e quantas duplicadas. E o mecanismo que voce ja construiu na Fatia 1 e ainda nao usou para o que ele vale mais.

Com 6 meses de base:

| Item | Com 1 mes | Com 6 meses |
|---|---|---|
| Media de 3 meses | impossivel | pronta |
| Serie de 6 meses | uma barra | grafico de verdade |
| Modo do agente | `PROVISORIO` | `Maduro` |
| Alerta de assinatura nova | nao detecta | detecta |
| Ciclo de contraparte (o erro do BR IPHONES) | janela corta | fecha ou nao fecha, e voce ve |
| Sazonalidade e provisao anual | invisivel | detectavel |

**Custo: um download e uma importacao.** Beneficio: o plano inteiro deixa de ter espera e vira so trabalho.

O unico custo real e que o julgamento cresce: em vez de 131 linhas, serao talvez 700 a 900. Mas o julgamento e por VALOR, nao por linha, e as mesmas 25 contrapartes que cobrem 96,6% de um mes vao cobrir uma fatia parecida de seis. As regras que voce criar de uma vez classificam os seis meses de uma vez.

### O calendario corrigido

```
Dia 1   P-R0 · importar os 6 meses de OFX · P-W1-COBERTURA
Dia 2   P-W1-REPASSE · P-R1 · P-R2
Dia 3   VOCE julga a base (40 a 60 min) · P-AUDITA
Dia 4   P-R3 · P-R4
Dia 5   P-R6 · P-W2-CONTRAPARTE
Dia 6   P-W3-PESSOAL
Dia 7   P-W3-AGENTE1 · P-AUDITA
Dia 8   P-W4-META
Dia 9   P-W4-AGENTES
```

**Nove dias de trabalho**, nao quatro semanas. Espalhe como couber na sua semana de loja; o que nao muda e a ordem.

Uma ressalva honesta: 13 sessoes em 9 dias so acontece se cada sessao fechar limpa. Sessao que reprova no portao vira duas. Conte 9 dias como o piso, nao como promessa.

---

## Parte 2: como usar os prompts

### 2.1 A anatomia de uma sessao

Toda sessao tem tres blocos, nesta ordem, sem excecao:

```
1.  P-ABRE            -> o portao de entrada. Se reprovar, a sessao acaba aqui.
2.  o prompt da vez   -> UM so. Nunca dois.
3.  P-FECHA           -> portao de saida, commit e handoff.
```

Se voce pular o P-ABRE, voce vai construir sobre um estado que nao conferiu. Foi exatamente assim que a migration ficou aplicada no banco e ausente do git.

Se voce pular o P-FECHA, a proxima sessao comeca sem saber o que a anterior fez. Handoff nao e burocracia: e a memoria do projeto.

### 2.2 Onde os prompts moram

Nao guarde os prompts no chat. Salve o arquivo no repo:

```
docs/financeiro/CONTRATO.md     <- os invariantes herdados e F1 a F4, os portoes, a regra de corte
docs/financeiro/PROMPTS.md      <- os prompts, para copiar
docs/handoffs/                  <- um handoff por sessao
```

E em `CLAUDE.md`, tres linhas:

```
Ao tocar em qualquer coisa com prefixo fin_ ou na aba Financeiro:
leia docs/financeiro/CONTRATO.md ANTES de escrever a primeira linha.
Se o contrato conflitar com o prompt, o contrato ganha e voce avisa.
```

Assim o prompt fica curto e o contrato fica versionado. Mudar uma regra vira um commit, nao uma correcao em doze prompts.

### 2.3 Uma sessao completa, do inicio ao fim

Exemplo real com o P-R0.

**Voce cola:**

```
Portao de entrada do Financeiro. Leia docs/financeiro/CONTRATO.md.
[resto do P-ABRE]
```

**O que voce espera ver:** uma tabela com item, EXIT e veredito. Nada alem disso.

**O que fazer com o resultado:**

| Resultado | Acao |
|---|---|
| tudo EXIT 0, git limpo, migrations iguais | siga para o prompt da vez |
| git sujo | a entrega da vez passa a ser P-R0, mesmo que voce quisesse outra |
| migration no banco e nao no git | idem |
| suite vermelha | conserte antes. Nao construa sobre suite quebrada |
| ele comeca a propor a entrega antes de terminar a checagem | cole `P-FREIA` |

**Voce cola o P-R0.** Ele trabalha.

**Durante, o que voce olha:**

- ele **rodou** o SQL ou so **descreveu** o SQL? Se descreveu, cole `P-NAO-INVENTA`.
- ele esta mexendo em arquivo que a frase da entrega nao mencionou? Cole `P-FREIA`.
- ele propos um desenho e voce nao tem certeza? Cole `P-DECIDE` antes de aprovar.

**Voce cola o P-FECHA.** Ele confere o portao item a item, commita e escreve o handoff.

**Voce so aceita "pronto" quando ver:** o hash do commit, a tabela do portao com sim em tudo, e o caminho do handoff.

### 2.4 Os quatro prompts de contencao, e quando cada um

| Sinal | Prompt | O que resolve |
|---|---|---|
| A resposta ficou longa e comecou a listar melhorias | `P-FREIA` | traz de volta para a frase da entrega |
| Ele afirmou estado do sistema sem mostrar consulta | `P-NAO-INVENTA` | forca marcar MEDIDO ou SUPOSTO |
| Ele propos um desenho e soou bom demais | `P-DECIDE` | obriga a apontar a maior falha da propria proposta |
| Voce quer conferir uma entrega ja fechada | `P-AUDITA` | **em sessao separada.** Auditor que audita o proprio trabalho e carimbo |

O `P-DECIDE` e o mais util e o menos usado. Toda vez que uma proposta soar limpa demais, cole. Proposta que sobrevive ao P-DECIDE e proposta.

### 2.5 As sete regras de ouro

1. **Um prompt por sessao.** Duas frentes abertas produziram a divergencia git x banco.
2. **A frase da entrega manda.** Se o trabalho nao muda nada visivel na tela, nao e entrega, e preparacao, e preparacao nao vai sozinha para producao.
3. **Servidor e tela no mesmo commit.** O defeito do abatimento nasceu de separar os dois.
4. **EXIT code, nao texto de saida.** "Rodei os testes e passou" nao e prova. `EXIT 0` e.
5. **Nunca aceite dominio inferido.** Se ele propuser lado para contraparte nova, recuse e cole o F2.
6. **Nunca aceite numero sobre base incompleta.** F3. Se aparecer receita com base abaixo de 95% julgada, e regressao.
7. **Se reprovar no portao, a entrega da vez muda.** O portao nao e sugestao.

### 2.6 O que fazer quando algo da errado

| Situacao | O que fazer |
|---|---|
| Ele quebrou a suite e nao percebeu | `P-FECHA` pega. Se ele commitar assim, o `P-AUDITA` da sessao seguinte pega. Reverta o commit e refaca |
| Ele fez metade da entrega e disse pronto | a frase da entrega e o criterio. Releia a frase em voz alta: a tela mostra aquilo? Se nao, nao acabou |
| Ele propos escopo maior "ja que estamos aqui" | `P-FREIA`, e o extra vira entrega propria com frase propria |
| Voce mudou de ideia no meio | pare, feche sem commit, e recomece com a frase nova. Nao remende prompt no meio da sessao |
| Duas sessoes seguidas reprovaram no portao | pare de construir. O problema e estado, nao codigo. Rode `P-AUDITA` e conserte a base |

### 2.7 O seu trabalho, que nao tem prompt

Duas coisas so voce faz, e sao as que mais valem:

**O julgamento da base (dia 3).** No app, ordenado por valor decrescente, filtro `sem dominio`, selecao em lote. Voce nao esta classificando 131 ou 900 linhas: esta decidindo sobre 25 contrapartes que carregam quase todo o valor. Comece pela maior e va descendo ate as linhas ficarem pequenas o suficiente para nao importarem.

**A aprovacao dos lotes do Agente 1 (dia 7 em diante).** O lote vem ordenado por valor. **Leia as cinco primeiras linhas de verdade.** Elas concentram quase tudo. Se voce aprovar no automatico, o invariante 18 morre na pratica mesmo intacto no codigo, e o sistema volta a mentir, agora com a sua assinatura em cima.

---

## Parte 3: primeiro movimento, hoje

1. Baixar os OFX dos ultimos 6 meses do banco. Guardar na pasta.
2. Conferir que o `CONTRATO.md` esta em `docs/financeiro/`.
3. `P-ABRE` · `P-R0` · `P-FECHA`. 30 minutos.
4. Importar os 6 meses pelo app, um arquivo por vez, conferindo linhas novas e duplicadas em cada um.
5. `P-ABRE` · `P-W1-COBERTURA` · `P-FECHA`.

Os passos 1 e 4 sao os que apagam quatro semanas do calendario. Se voce fizer so um item desta lista hoje, faca o 1.
