# Handoff v65 — 19/08/2026

Substitui todos os anteriores. Sessao de AUDITORIA seguida de construcao: o CRM foi
medido contra o banco vivo, comparado com pratica de mercado, e a primeira fatia da
correcao foi construida e subida. **Duas migrations entraram** (as duas so mexem em
`v_lead`, que e view: nenhuma coluna nova em tabela).

---

## 0. Para quem chega agora, em oito linhas

1. O dono pediu auditoria do CRM: entender ultimo toque e ausencia de resposta, dizer
   se vale mandar mensagem, tratar repescagem de frio, e comparar com CRM profissional.
2. Oito furos ranqueados por dinheiro perdido, todos medidos, nenhum estimado.
3. **A Fatia 1 foi construida:** a Fila deixou de ser lista ordenada por data e
   desempatada por ordem ALFABETICA, e passou a ordenar por VEREDITO.
4. `v_lead` ganhou 7 colunas derivadas na leitura (invariante 4). O app ja lia
   `select("*")`, entao elas chegaram sozinhas: zero mudanca de fetch.
5. Suite: **713 assercoes, 0 falhas** (era 691), EXIT 0 nos seis comandos e nas cinco
   larguras. As 22 novas foram testadas por MUTACAO.
6. **Dois erros meus, corrigidos dentro da sessao**, ambos documentados abaixo com a
   licao: a regra de `pare` era inalcancavel, e a classe `vd` colidiu com o bloco de
   Detalhes da venda da v61 e deixou o chip INVISIVEL com a suite VERDE.
7. A auditoria completa vive num artifact privado (secao 9).
8. Fatias 2, 3 e 4 estao especificadas e NAO foram construidas.

---

## 1. Os oito furos medidos em 19/08/2026

Ordenados por dinheiro perdido, nao por facilidade de conserto.

| # | Furo | Medicao |
|---|---|---|
| 1 | O primeiro toque leva 5 dias | mediana **118h**, media 187h, **0 leads tocados em menos de 24h** (11 de 11 acima), pior espera 45,2 dias. Benchmark de mercado: 5 minutos |
| 2 | O pos-venda nunca disparou | **0 toques de pos-venda na historia do sistema**. 6 clientes entregues parados em `P1 · D1`, o mais antigo ha 33d |
| 3 | A fila ordenava por data e por NOME | `proximo_contato` e depois `nome.localeCompare()`. Zana (2 respostas, "se comprometeu a comprar") saia em 3o de 7 |
| 4 | Cliente que comprou ontem na fila de prospeccao hoje | `LEAD-0027` (`21969683300`) e `LEAD-0030` (`5521969683300`) sao a mesma pessoa. Dedupe compara o numero CRU |
| 5 | Perfil muda, cadencia nao re-ancora | `LEAD-0027`: `lead.perfil=comprou`, `cadencia_estado.perfil=avaliando`, passo `R2 · D3` |
| 6 | A repescagem promete "chegou remessa nova" sem saber | 6 passos, **100% por calendario**, 0 gatilhos por evento |
| 7 | Lista fria virou lixeira | 4 leads; **2 nunca receberam um unico toque**; 2 sem WhatsApp na base; 1 (`LEAD-0009`) sem linha em `cadencia_estado`, invisivel para a regua |
| 8 | A regua roda e nao move nada | 0 avancos em 8 dos ultimos 12 dias; atrasados subindo de 9 (08/08) para 13 (19/08) |

Contexto: 30 leads, 7 vendas concluidas, R$ 28.678,98 de receita, R$ 3.258,98 de
margem (11,4%), ticket R$ 4.097. 21 toques em 40 dias (0,5/dia), 3 respostas (14%).
Indicacao e o melhor canal: 10 leads, 40% de conversao, R$ 14.170.

**Gabriel Britto e o unico cliente que comprou duas vezes** (R$ 5.599,98 em 9 dias) e
recomprou sem UM toque de pos-venda: recomprou apesar do CRM.

---

## 2. O que a Fatia 1 entregou

### 2.1 Banco: `v_lead` ganhou 7 colunas, todas derivadas

Migrations `fatia1_v_lead_veredito` e `fatia1_veredito_fadiga_nao_reinicia`.

| coluna | o que e |
|---|---|
| `toques` | total de `toque_enviado` |
| `respostas` | total de `respondeu` |
| `toques_sem_resposta` | toques gastos DEPOIS da ultima resposta. E a fadiga real |
| `valor_em_jogo` | `valor_oferta` do lead, ou o total ja comprado pelo cliente |
| `duplicata_de` | `lead_code` de outro lead com os MESMOS 11 digitos finais que ja e cliente |
| `veredito` | `prioridade` / `agora` / `mande` / `espere` / `pare` / `nao_mande` / `fora` |
| `veredito_ordem` | 1 a 6 (9 = fora), a chave de ordenacao |
| `veredito_motivo` | a frase que a tela exibe embaixo da linha |

Regra, em ordem de precedencia:

```
fora        arquivado, lista_fria, cancelado, ou sem cadencia viva
nao_mande   duplicata de cliente, ou consentimento != true
pare        0 respostas E (4+ toques  OU  3+ toques em 30d de tentativa)
espere      o passo ainda nao venceu
prioridade  ja respondeu E no maximo 2 toques desde a resposta
agora       perfil comprou (pos-venda), ou nunca tocado
mande       o resto
```

Ordenacao da fila: **veredito, depois valor em jogo, depois data, depois nome.**

`security_invoker=on` conferido em `pg_class.reloptions` depois do `CREATE OR REPLACE`
(ele derruba em silencio). Grant de `authenticated` intacto. Isolamento provado: como
dono **30 leads**, como usuario desconhecido **0**.

Os 6 rotulos entraram em `dicionario_rotulos` no dominio `veredito` (invariante 12: a
chave e o codigo, o rotulo e editavel).

### 2.2 Tela

- Chip da linha: para de dizer SO quanto atrasou e passa a dizer o que fazer,
  carregando o atraso junto (`Mande · 38d`).
- Linha de motivo (`.card-motivo`) embaixo da linha, **nunca em tooltip**: tooltip nao
  existe no celular, que e onde a fila e trabalhada.
- Legenda da Fila trocada: ensinava `Em andamento / Urgente / Pendente`, chips que
  saíram da linha. Legenda que explica chip inexistente ensina o vocabulario errado.
- Aba Hoje: contador `sem 1o toque · o mais antigo ha Xh`, urgente acima de 24h. O dado
  (`horas_esperando_1o_toque`) **ja existia na `v_lead` desde sempre e nenhuma tela lia**.

Degradacao proposital: lead SEM veredito cai no chip antigo e na ordem antiga. Banco
velho nunca vira chip vazio.

### 2.3 O efeito REAL, medido, sem inflar

O dono perguntou "qual mudanca pratica disso". A resposta honesta:

```
FILA (7 cards)                    POS-VENDA (6 cards)
1 Zana            (era 3)  +2     1 Victor      (era 1)   0
2 Eduardo Costa   (era 7)  +5     2 Gabriel     (era 3)  +1
3 Brenno          (era 1)  -2     3 Lucas       (era 2)  -1
4 Eduarda DUDA    (era 2)  -2     4 Lohran      (era 4)   0
5 Isabella        (era 4)  -1     5 Gabrielle   (era 6)  +1
6 Darinka         (era 6)   0     6 Renata      (era 5)  -1
7 Aretusa         (era 5)  -2
```

**Com 7 cards que cabem na mesma tela, ordenar vale quase nada.** Fila e pos-venda sao
DOIS BLOCOS separados na tela, e a reordenacao acontece dentro de cada um: eu havia
dito "Zana saiu de 7o para 1o" tratando os dois como uma lista so, e estava errado.

O que vale hoje e o **rotulo**, nao a ordem, e sao duas linhas que mudaram de "faca"
para "nao faca":
- **Aretusa** era a tarefa nº5. Trabalhar a fila de cima a baixo mandaria abordagem de
  primeiro contato para quem fechou R$ 4.300 no dia anterior.
- **Clara mesquita** (4 toques, 0 respostas, 36d) apareceria em 24/08 pedindo o 5o toque.

A ordem so comeca a pagar quando a fila passar de ~20 linhas e nao couber na tela.

---

## 3. Os dois erros desta sessao, e a licao de cada um

### 3.1 A regra de `pare` que eu propus era INALCANCAVEL

Propus no relatorio: "3+ toques e 21 dias de silencio". Mas `dias_silencio` **reinicia a
cada toque do operador**: numa cadencia ativa o corte nunca dispara. Clara mesquita
(4 toques, 0 respostas, 36 dias de tentativa) saia como `espere`.

Corrigido: a fadiga passou a contar pelo **primeiro toque**, que nao reinicia, e `pare`
passou a ser avaliado ANTES de `espere` (lead queimado nao esta aguardando vencimento).

**Licao: relogio que o proprio operador zera nao mede o silencio do cliente.**

### 3.2 A classe `vd` colidiu, o chip sumiu, e a suite ficou VERDE

Usei o prefixo `vd-` no chip. **`.vd` ja existia desde a v61** (bloco de Detalhes da
venda, `display:none` ate abrir). O chip sumiu da tela inteira.

E as 691 assercoes continuaram passando, incluindo as que eu tinha acabado de escrever
para medir COR do chip: **`getComputedStyle` devolve a cor certa de um elemento
`display:none`**. Quem pegou foi a FOTO (`ferramentas/foto_fila.py`), nao a suite.

Corrigido: prefixo `vrd-`, mais duas assercoes novas que medem a CAIXA
(`display !== 'none'`, `getBoundingClientRect().width > 20`) e o icone dentro dela.
Provado por mutacao: reintroduzir `display:none` derruba as duas.

**Licao: cor provada nao e pixel na tela. Ao assertar visual, medir a CAIXA, e medir
dentro do CONTEXTO real (a primeira versao media num `<div>` solto no `#lista`, fora do
`.card-linha`, e por isso nao via a colisao).**

---

## 4. Cor: nenhum token novo, nenhum azul novo

Seis vereditos dividem CINCO familias de token semantico, e a v64 ja tinha medido que
quente x morno x frio ficam entre **1.00 e 1.01** de luminancia entre si. Foi essa
medicao que obrigou icone nos 7 trilhos, e vale igual aqui.

- `prioridade` -> `--ok` &nbsp; `agora` -> `--quente` &nbsp; `mande` -> `--morno`
- `espere` -> `--frio` &nbsp; `pare` -> `--frio` &nbsp; `nao_mande` -> `--erro`

`espere` e `pare` dividem a MESMA familia. A distincao e o **icone** mais a **borda
tracejada**, que le como "fora do fluxo" sem depender de cor nenhuma. O harness assere
que os dois tem a mesma cor computada (`rgb(92,111,138)` nos dois) justamente para
provar que o icone e obrigatorio, nao enfeite.

**Veredito nunca veste azul.** Decisao nao e navegacao, e a regra 11.1 so aprova azul
para hover, foco, estado ativo de navegacao e acao primaria nomeada.

---

## 5. Provas

```
node --check public/app.js                 EXIT 0
python ferramentas/validar.py              EXIT 0   TUDO PASSOU
python ferramentas/harness.py              EXIT 0   713 passou, 0 falhou
python ferramentas/prova_trilho.py         EXIT 0
python ferramentas/prova_grafico.py        EXIT 0
python ferramentas/prova_atmosfera.py      EXIT 0
python ferramentas/diag_mobile.py 360/390/414/1280/1440   EXIT 0 nas cinco
```

**Teste de mutacao das 22 assercoes novas** (guarda que nunca reprova e teatro):
- `ordVer()` sempre 4 (o veredito para de mandar na ordem) -> **5 vermelhas**
- borda tracejada do `pare` removida -> **1 vermelha**
- `display:none` no chip (o bug original) -> **2 vermelhas**

`ferramentas/patch_veredito.py` reaplica a mudanca inteira a partir da baseline e
REPROVA se qualquer ancora aparecer numero de vezes diferente de 1.

O fixture `ferramentas/dados_teste.json` recebeu as colunas novas nos 3 leads, com os
valores que a `v_lead` devolve hoje: fixture que nao acompanha a view para de testar a
tela e passa a testar a si mesmo.

---

## 6. Comparacao com CRM profissional (pesquisado em 19/08/2026)

| Pratica de mercado | Pit Wall | Vale copiar? |
|---|---|---|
| Resposta ao lead em minutos, com alerta em tempo real | mediana medida 118h | sim, barato |
| Lead score com decaimento por recencia | `nivel` e leitura, nao priorizacao | versao simples: FEITO na Fatia 1 |
| Priorizacao por valor em jogo | nenhuma; `valor_oferta` em 3 de 30 | sim: FEITO na Fatia 1 |
| Sequencia por EVENTO, nao por calendario | 100% calendario nos 6 perfis | sim, e o caro (Fatia 4) |
| Pontuacao negativa / desqualificacao | so `sem_interesse` manual (2 usos) | sim: FEITO (`pare`) |
| Win-back por RFM (12-20% de reativacao) | repescagem por tempo | depois do resto |
| Pos-venda e recompra | motor pronto, **0 execucoes** | ja esta pronto (Fatia 3) |
| Dedupe por identidade normalizada | compara numero cru | sim, barato (Fatia 2) |
| Multicanal (email + telefone + social) | so WhatsApp | **NAO** |

A recusa do multicanal e deliberada e vale ficar registrada: o WhatsApp tem 98% de
abertura, e o gargalo medido nao e canal, e os cinco dias ate a primeira mensagem.
Adicionar email agora so espalha o mesmo atraso por mais superficies.

---

## 7. As fatias que NAO foram construidas

### Fatia 2 — parar de queimar cliente (barata, correcao de bug)
- Normalizar `whatsapp_digitos` para formato unico com DDI + indice unico por tenant.
- Re-ancorar `cadencia_estado` quando `lead.perfil` muda, dentro de `editar_lead` E de
  `registrar_venda`.
- Mesclar `LEAD-0030` em `LEAD-0027`; dar estado de cadencia ao `LEAD-0009`.

### Fatia 3 — pos-venda que sai do lugar (a de maior efeito imediato)
- Botao de um clique no Pitscare abrindo o WhatsApp com o passo ja escrito, no padrao
  do `sugerir_mensagem` da Fila.
- Passo de **indicacao** explicito no P2 ou P3. Indicacao e 40% de conversao e
  R$ 14.170 da receita, e nao existe nada sistematizado pedindo.

### Fatia 4 — repescagem por evento (cara, maior teto)
- Normalizar `lead.produto` para modelo + capacidade. Hoje e texto livre sujo
  (`"13 128GB 14 128GB"`, `"IPad e 17 Pro Max"`). Sem isso nenhum gatilho casa.
- Casar com `catalogo_iphone` / `calc_dados`: entrou o modelo, ou o preco mudou, o lead
  entra na fila COM O MOTIVO ESCRITO, fora da cadencia de calendario.
- `data_nascimento` vira campo do cadastro (1 de 30 hoje).

---

## 8. A ressalva que vale mais que o roteiro

**Nao ha amostra para calibrar score nenhum.** A base inteira tem 21 toques, 3 respostas
e 7 vendas. Os cortes do veredito (4 toques, 3 toques em 30d, 2 toques apos resposta)
sao **hipotese de benchmark externo, nao regra medida aqui**, e isso esta escrito no
`comment on view` da propria `v_lead`.

A consequencia pratica para a proxima sessao: quando houver 60 a 90 toques, comparar o
veredito exibido com o desfecho real e TROCAR o palpite pelo numero. Score sofisticado
construido agora seria opiniao com cara de matematica, e nesse volume nem da para
reprovar.

---

## 9. Onde esta a auditoria completa

Artifact privado do dono, com os 8 furos, a fila resolvida lead a lead e o roteiro:
`https://claude.ai/code/artifact/07ffc6d0-38b6-4bef-a93a-3de9cd46cb95`

Republicar pelo mesmo caminho de arquivo mantem a URL.

---

## 10. O que ficou aberto

1. **A lista compacta "Fila de hoje" na aba Hoje** ja segue a nova ordem, mas continua
   mostrando `38d de atraso` em vez do chip de veredito. Inconsistencia conhecida,
   deixada de fora de proposito para nao expandir escopo sem ordem do dono.
2. **`permite_esfriar` continua config morta em 4 dos 6 perfis** (pendencia declarada
   desde a v43 e ainda nao resolvida): a transicao tem precedencia e todos tem
   `perfil_seguinte`, entao so `repescagem` chega a esfriar.
3. **Dois leads empurrados para vencimento distante somem de toda tela**: Jackson Bispo
   (marcado "conversando" em 05/08, nunca respondeu, vence 09/09) e Duda nanda (vence
   20/09, 26d sem toque). Conferir se foi reagendamento consciente ou ancora errada.
4. **`LEAD-0019` e `LEAD-0028` seguem com `origem` nula** (furo de cadastro herdado da
   v64, R$ 8.700 em venda concluida).
5. Herdados da v64 e ainda validos: a insatisfacao do dono com o grafico de leads sem
   direcao registrada; a troca dos tokens globais quente/morno/frio oferecida e nao
   escolhida; e a escrita de volta no Notion bloqueada pela capability
   **"Update content"** em notion.so/profile/integrations.
