# Spec: aba Escopo (frentes, placar e escopo semanal)

Data: 04/08/2026. Estado: aprovada em conversa, nao implementada.

---

## 1. O problema

Nao existe lugar unico onde o dono veja em que pe esta cada frente da operacao.
O sintoma medido nesta sessao: a frente **Pitscare** tem spec escrita e aprovada
(`docs/superpowers/specs/2026-07-21-pitscare-estruturacao.md`, 193 linhas, com 19
scripts prontos para `dicionario_scripts`), parada na branch remota
`claude/pitscare-estruturacao-o04knt` desde 21/07/2026, nunca fundida e nunca
gravada no banco. Trabalho pronto, invisivel por duas semanas.

O que falta nao e mais tarefa registrada. E um lugar que responda **"qual frente eu
abandonei"** sem precisar ler 45 handoffs.

## 2. O que esta aba NAO e

- **Nao e backlog tecnico.** Frente e area de trabalho permanente. Defeito e
  bloqueio entram como acao com status `travado` DENTRO da frente que eles seguram.
  Uma primeira versao deste desenho semeou as frentes com as pendencias do v43/v44/v45
  e foi reprovada pelo dono: era backlog disfarcado de mapa.
- **Nao e sensor.** Nada aqui le o estado real do sistema. Se o painel disser
  "provas verdes" enquanto o `validar.py` esta vermelho, o painel esta repetindo o
  que o dono digitou. Ele registra declaracao, nao medicao. Ligar os dois e trabalho
  futuro, se valer a pena.
- **Nao e a Rotina.** A Rotina lista o que se FAZ (checklist recorrente por dia).
  O escopo semanal declara o que o dia SERVE (intencao, ligada a frente). Especies
  diferentes. Se colapsarem, o app passa a ter dois calendarios que discordam e o
  dia que vale vira o ultimo que o dono abriu.

## 3. As frentes

Oito, todas de operacao. Grupo tecnico foi cortado por decisao do dono: nao compara
com area de negocio na mesma coluna.

| codigo | rotulo |
|---|---|
| `colaboradores` | Colaboradores |
| `producao_marketing` | Producao e marketing |
| `assistencia` | Assistencia tecnica |
| `captacao_organica` | Captacao organica |
| `whatsapp` | Status do WhatsApp |
| `pitscare` | Pitscare (pos-venda) |
| `comercial` | Comercial |
| `calculadoras` | Calculadoras |

`whatsapp` e o Status do WhatsApp como CANAL DE POST (irmao do story do Instagram),
nao saude do numero. Confirmado com o dono em 04/08/2026.

`crm_legado` (planilha no Sheets) foi proposta e cortada: ninguem usa mais.

Mais uma linha, `pendencias`, com `grupo = 'pendencia'` e `ordem = 99`: o backlog
tecnico que nao e frente, renderizado separado no fim da aba. Nao ganha tabela
propria; e uma linha de `escopo_frente` como qualquer outra, o que economiza um
objeto de banco e um caminho de render.

Frente entra e sai pela tela (Fatia 3), igual `captacao_frente`. Frente que nao serve
mais se DESLIGA (`ativo = false`), nunca se apaga.

## 4. Modelo de dados

Todas as tabelas: `tenant_id` not null + policy de RLS usando
`privado.fn_tenant_atual()` (invariantes 7 e 8). Nenhuma recebe TRUNCATE
(invariante 9).

### 4.1 `escopo_frente` (Fatia 1)

`id` · `tenant_id` · `codigo` (unique por tenant, ESTAVEL) · `rotulo` (editavel) ·
`grupo` (`frente` | `pendencia`) · `icone` · `ordem` · `ativo` · `criado_em`

A chave e o `codigo`, nunca o `rotulo` (invariante 12). A cor do trilho sai de hash
deterministico do `codigo`, entao a mesma frente tem a mesma cor em toda sessao.

### 4.2 `escopo_acao` (Fatia 1, campos de gestao na Fatia 3)

`id` · `tenant_id` · `frente_id` · `titulo` · `status` · `motivo_trava` ·
`travado_desde` · `data_alvo` · `prioridade` · `esforco` · `ordem` · `arquivada` ·
`criado_em` · `atualizado_em`

- `status` e CODIGO, nunca rotulo: `a_fazer` | `fazendo` | `travado` | `feito`.
  Os rotulos de tela vao para `dicionario_rotulos` (ja vivo, 29 linhas).
- **CHECK: `status <> 'travado' OR motivo_trava IS NOT NULL`.** E o unico campo
  obrigatorio da tabela. Sem ele, em um mes metade do painel esta travada por
  motivo nenhum e a palavra perde sentido.
- `data_alvo`, `prioridade` (`alta`|`media`|`baixa`) e `esforco` (`p`|`m`|`g`)
  existem no schema desde a Fatia 1 mas so ganham tela na Fatia 3.
- Nunca DELETE, so `arquivada = true`. Mesmo padrao de `venda_nf`.

### 4.3 `escopo_acao_evento` (Fatia 1, append-only)

`id` · `tenant_id` · `acao_id` · `de_status` · `para_status` · `em` · `por`

**Nasce na Fatia 1 mesmo sem tela que a leia.** A tendencia semanal (Fatia 3) le
daqui. Historico nao se constroi depois: se esta tabela so existir na Fatia 3, a
primeira seta de verdade aparece uma semana DEPOIS da Fatia 3 e o intervalo perdido
e irrecuperavel. Custa uma tabela e um trigger agora.

Append-only de verdade: `authenticated` recebe SELECT e INSERT, nunca UPDATE nem
DELETE (invariante 6).

### 4.4 Escopo semanal (Fatia 2)

Molde fixo mais ajuste datado, com N frentes por dia. Quatro objetos:

- `escopo_dia_molde`: `dia_semana` (1 a 7) · `objetivo` · `ativo`. Sete linhas,
  permanentes.
- `escopo_dia_molde_frente`: `molde_id` + `frente_id`, chave composta.
- `escopo_dia_ajuste`: `data` (unique por tenant) · `objetivo`. Sobrescreve UM dia.
- `escopo_dia_ajuste_frente`: `ajuste_id` + `frente_id`.

**Regra de resolucao:** para uma data, se existe `escopo_dia_ajuste` daquele dia,
ele vence INTEIRO (objetivo e frentes). Senao vale o molde do dia da semana.

**A tela e obrigada a declarar qual das duas esta valendo**, com selo `ajustado` e o
objetivo do molde visivel por baixo. Duas fontes para o mesmo dia sem declaracao e
exatamente o defeito apontado na secao 2: o dono deixa de saber qual acreditar.

## 5. O placar (Fatia 1)

Fica no TOPO da propria aba Escopo, nao em aba separada: le os mesmos dados.

```
Pitscare            72  a frente     4/7 feitas · 0 travadas · 3d
Captacao organica   31  em baixa     1/9 feitas · 3 travadas · 21d
Assistencia         --  sem dado     nenhuma acao registrada
```

Nota 0 a 100, **sempre exibida junto das parcelas que a produziram**. Nota unica
escondida vira fe, e ninguem discute com fe. Mostrando as parcelas, "em baixa" ja
diz na mesma linha se foi por parar, por travar ou por nunca ter tido acao.

Parcelas na Fatia 1:

| parcela | peso | conta |
|---|---|---|
| Avanco | 40 | `feitas / total` x 40 |
| Fluidez | 30 | `(1 - travadas / total)` x 30 |
| Movimento | 30 | 30 se houve evento nos ultimos 7 dias; decai linear ate 0 aos 30 dias |

`total` conta acoes NAO arquivadas da frente.

"Evento" no Movimento e o registro mais recente em `escopo_acao_evento` de QUALQUER
acao daquela frente, arquivada ou nao. Criar acao tambem grava evento
(`de_status` nulo), senao uma frente recem-povoada nasce com Movimento zero.

Faixas: `a frente` >= 70 · `normal` 40 a 69 · `em baixa` < 40.

**`sem dado` e faixa propria**, para frente com zero acao. Frente vazia nao entra no
ranking. Dependendo da conta ela apareceria como 100 ou como 0, e nos dois casos o
painel mentiria: o que existe ali e ausencia de dado, nao desempenho.

**Nada disso e coluna.** Nota, faixa, dias parados e progresso calculam na LEITURA,
no fuso do Brasil, nunca `CURRENT_DATE` (invariantes 4 e 10).

### 5.1 A regua muda na Fatia 3, e a tela declara

Quando `data_alvo` ganhar tela, entra a quarta parcela (Atraso) e os pesos viram
Avanco 35 / Fluidez 25 / Movimento 20 / Atraso 20. **Nota da Fatia 1 nao e
comparavel com nota da Fatia 3.** A tela precisa marcar o corte, senao a tendencia
mistura duas reguas diferentes no mesmo grafico. Tela que omite recorte mente.

### 5.2 Tendencia (Fatia 3)

Cada frente ganha seta de subiu/caiu contra as semanas anteriores, recalculando a
nota a partir de `escopo_acao_evento`. O cabecalho declara a janela (`de X a Y`).

## 6. Cor

**Nao reusar `--quente` / `--morno` / `--frio`.** Naquela paleta quente e BOM (lead
novo) e aqui seria ruim. Inverter o significado de um token existente cria bug de
leitura em quem ja aprendeu a paleta.

Somente a faixa `em baixa` ganha cor de alerta; `a frente` e `normal` ficam neutros e
`sem dado` fica cinza. Cada frente carrega barra de trilho de 3px + **icone**, pelo
sistema Trilho x Sinal do v33: as colisoes de luminancia entre trilhos ficam entre
1.14 e 1.44, entao matiz sozinho nao separa e o icone carrega a distincao.

O valor exato do alerta entra MEDIDO (alvo 4.5:1 texto, 3:1 faixa), nunca escolhido
no olho. Prova: extensao de `ferramentas/prova_trilho.py`.

## 7. Tela

Aba **Escopo**, marcada **`.aba-rara`**: nasce na gaveta "Mais" e nao encosta na
barra de 6 lugares. E a decisao 2 do handoff v45: aba fora do mapa da barra foi
exatamente o que fez a barra cobrir 33px de conteudo no celular.

Tres blocos, nesta ordem:

1. **Placar** das 8 frentes, ordenado da melhor para a pior.
2. **Escopo semanal** (Fatia 2): 7 dias, objetivo e frentes de cada um, com selo
   `ajustado` onde couber.
3. **Frentes e acoes**: um bloco por frente, e a secao **Pendencias** separada no fim.

## 8. Fatias

Cada uma termina em algo que o dono abre.

**Fatia 1, abre e usa.**
`escopo_frente` + `escopo_acao` + `escopo_acao_evento`, com RLS e seed das 8 frentes
mais a linha `pendencias`. Tela: placar com ranking e parcelas, lista das frentes,
**adicionar acao**, **mudar status no toque**, motivo de trava obrigatorio, arquivar.

Adicionar acao entra AQUI, nao depois: o seed nasce sem acao nenhuma, e painel de
8 frentes vazias nao e palpavel.

**Fatia 2, o escopo semanal.**
Os quatro objetos do molde e do ajuste, a tela dos 7 dias com selo `ajustado`, e o
placar ganha quantos dias de semana cada frente recebe. Isso amarra as duas metades:
frente em baixa que tambem nao tem dia na semana fica obvia.

**Fatia 3, gestao e tendencia.**
`data_alvo` com vencida derivada, `prioridade`, `esforco`, editar titulo, criar e
desligar frente pela tela, a quarta parcela da nota com o corte de regua declarado, e
a seta de tendencia lendo o log que existe desde a Fatia 1.

## 9. Provas

| prova | o que assere |
|---|---|
| `node ferramentas/prova_escopo.js` (novo) | nota e faixas nos limites (39/40/69/70), `sem dado` com zero acao, CHECK do `motivo_trava` recusando, resolucao molde x ajuste |
| RLS | como dono, como vendedor e como tenant errado, provando isolamento nas 7 tabelas |
| auditoria | uma mudanca de status gera exatamente um `escopo_acao_evento`, e UPDATE/DELETE nele sao negados a `authenticated` |
| `python ferramentas/diag_mobile.py 360 / 390 / 414` | exit 0: a aba nova nao pode voltar a fazer a barra cobrir conteudo |
| `python ferramentas/harness.py` | baseline atual 158 passou / 4 falhou |
| `python ferramentas/prova_trilho.py` | contraste do alerta de `em baixa` e dos icones de frente |
| `python ferramentas/validar.py` | comparado contra o HEAD pelo metodo do v45 |

**Metodo obrigatorio do `validar.py`** (v45, secao 5): ele ja chega VERMELHO, com 5
reprovacoes herdadas. Rodar tambem contra os arquivos do HEAD
(`git checkout -- public/app.css public/app.js`, roda, restaura) para separar falha
herdada de regressao propria. Sem isso as 5 antigas sao lidas como estrago desta obra.

**Conferir EXIT CODE, nunca o texto da saida.**

### 9.1 Uma assercao que esta obra e obrigada a atualizar

`validar.py` tem hoje a reprovacao **`esperava 6 abas raras, achei 7`**. A aba Escopo
faz virar 8. Se o numero esperado nao subir junto, esta obra aprofunda o vermelho e o
guard-rail morre de vez.

Sobe o numero pelo real (8), **item unico e nomeado**. Nao repontar a baseline `.antes`
em bloco: isso calaria as outras 4 reprovacoes de carona, que e como um guard-rail
morre calado.

### 9.2 O `app.js` e minificado

`git diff` NAO prova que o resto do arquivo nao mudou (ele exibe a linha inteira).
A prova certa e byte a byte:

```
git show HEAD:public/app.js > /tmp/antes.js
cmp -l /tmp/antes.js public/app.js
```

## 10. Fora de escopo, nomeado

- **Criterio de aceite por acao** (campo de prova: comando, tela, numero). Proposto e
  recusado pelo dono em 04/08/2026: ele pediu status + trava, data e esforco, sem o
  campo de prova. **Consequencia aceita: o painel aceita "feito" declarado sem prova
  anexada.**
- Ligar o painel ao estado real do sistema (ver secao 2).
- Escrita de volta no Notion. Segue travada pela capability "Update content".
- Notificacao, lembrete e cobranca automatica de frente parada.

## 11. Decisoes registradas nesta sessao (04/08/2026)

1. A aba vive dentro do Pit Wall, com tabela no Supabase, e nao como Artifact, Notion
   ou markdown. Escolha do dono ciente de que e a das quatro opcoes a mais cara, por
   custar migration, tela e provas.
2. Frente e area permanente; pendencia e secao separada. Primeira versao do desenho
   errou isso e foi refeita.
3. Grupo tecnico (banco, tela, provas, infra, seguranca) cortado.
4. `crm_legado` cortada, morta.
5. `whatsapp` e canal de post, nao saude do numero.
6. `calculadoras` volta como frente propria; conteudo e social viram acao dentro de
   `producao_marketing`.
7. Escopo semanal: molde fixo mais ajuste datado, com N frentes por dia.
8. Nota calculada das acoes, nunca marcada a mao, e sempre exibida com as parcelas.
9. Ranking na Fatia 1, tendencia na Fatia 3, mas o log de evento nasce na Fatia 1.
