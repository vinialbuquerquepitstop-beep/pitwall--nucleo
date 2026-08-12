# Handoff Migracao Pit Wall (Nucleo) v47

Substitui a v46. Data: 08/08/2026.

---

## 1. Headline: a venda passou a despachar sozinha

Pedido do dono, em duas partes na mesma sessao:

1. *"crie em vendas, uma sessao de relatorio de venda pra ser preenchido e
   enviado pra motoboy, com numero do cliente, nome, local de retirada, entrega,
   valor, forma de pagamento"*
2. *"Cadastrar motoboys para enviar relatorio direto, atraves de um botao"*

Entregue: um painel **Relatorio de entrega** por venda, aberto pelo card, que
monta o texto exato que vai pro motoboy e o envia pelo WhatsApp; e um **cadastro
de motoboys** onde cada linha e um botao que despacha num toque.

**O achado que economizou a maior parte do trabalho: os seis campos pedidos JA
EXISTIAM na tabela `venda`** (`comprador_nome`, `comprador_whatsapp`,
`fornecedor_local_retirada`, `endereco_entrega`, `valor_a_cobrar`,
`forma_pagamento`), e a `editar_venda` ja aceitava patch parcial de todos eles.
Isso derrubou a obra de "tabela nova de entrega" para "uma coluna e uma tela".
A unica coisa que faltava era um destino: **nao havia telefone de motoboy em
lugar nenhum** (`venda.motoboy` era o nome, texto livre).

---

## 2. O que a tela faz

### 2.1 A linha de entrega, no card de toda venda

`entrega · Rua das Laranjeiras 100, apto 501 · Hiago      [Relatório]`

Quando falta o destino, a mesma linha diz `sem endereço de entrega` e o botao
ganha a cor de **morno** (`ent-pede`, o mesmo tratamento da NF que falta).
A linha existe **sempre**, com endereco ou sem: venda sem destino se esconderia
justamente de quem tem que despachar.

### 2.2 O painel

Campos, na ordem em que a corrida acontece: cliente (leitura), trajeto (retirada
e entrega), dinheiro (valor a cobrar e forma), motoboy, recado da corrida.
Abaixo, a **previa do texto exato** que sai, e a lista do que ainda falta.

O texto:

```
ENTREGA · VENDA-0001
Aparelho: iPhone 13 128GB Meia-noite
Cliente: Diego Souza
Contato: +55 (21) 99000-0000
Retirar em: Campo Grande
Entregar em: Rua das Laranjeiras 100, apto 501
Cobrar: R$ 90,00 · Pix
Recado: interfone quebrado
```

Tres botoes: **Salvar e enviar** (grava e abre a conversa do motoboy com o texto
pronto), **Salvar e copiar**, **Fechar**. E, acima deles, um botao por motoboy
cadastrado, que faz tudo de uma vez.

### 2.3 A lista de motoboys

Dentro do proprio painel, onde a necessidade aparece. Cada linha mostra **nome e
telefone** (escolher o motoboy errado custa uma corrida) e e um botao que
despacha. Ao lado, `tirar`. Abaixo, os dois campos avulsos e
**Salvar na lista de motoboys**, que promove o avulso digitado a cadastro.

---

## 3. Decisoes

1. **O relatorio nao e uma copia paralela da venda: ele EDITA a venda.** O que o
   dono corrigir ali (endereco, valor, forma, motoboy) grava por `editar_venda`.
   Painel que so montasse texto faria digitar o endereco duas vezes e guardar
   zero. Escolha do dono entre as tres oferecidas.
2. **Telefone do motoboy virou coluna** (`venda.motoboy_whatsapp`), nao campo
   volatil da tela. Escolha do dono: o numero fica salvo para reenviar.
3. **Nome e telefone do cliente sao LEITURA no painel.** A identidade mora no
   lead. Editaveis ali, virariam uma segunda versao da mesma pessoa: a tela
   mostraria uma e o WhatsApp abriria a outra. Quem precisa corrigir vai pelo
   `Ver cliente`.
4. **A linha do dinheiro nunca some do texto.** Sem valor, ela diz
   `Cobrar: nada a cobrar na entrega`. Todos os outros campos vazios saem da
   mensagem; esse nao, porque silencio sobre dinheiro e como nasce cobranca
   errada na porta do cliente. Com valor e sem forma definida, diz
   `forma a combinar` em vez de calar.
5. **Uma venda por vez, nao romaneio do dia.** Escolha do dono. Uma entrega, uma
   mensagem, que e como o motoboy trabalha.
6. **O recado da corrida NAO e gravado**, e a nota do campo diz isso. Grava-lo em
   `venda.observacoes` sobrescreveria observacao interna da venda com um bilhete
   de logistica.
7. **O botao do motoboy cadastrado nao tem caminho proprio de escrita**: ele
   preenche os campos e chama o MESMO `enviarEntrega`. Atalho com validacao
   propria seria a segunda regra que envelhece sozinha.
8. **Motoboy sai por `desligado_em`, nunca por DELETE**, e `authenticated` nao
   recebe DELETE nem TRUNCATE: quem levou a entrega de ontem continua legivel.
9. **Nenhum token de cor novo.** `ent-pede` reusa a familia `--morno`, ja
   existente, pelo mesmo criterio da NF que falta: nao e falha de sistema, e
   cadastro que falta.
10. **Enviar exige endereco e numero do motoboy; copiar nao exige nada.** O
    relatorio sem destino nao e relatorio; o texto parcial ainda serve para
    colar em outro lugar.

---

## 4. O defeito da sessao: a suite travou calada

Depois de escrever as 43 assercoes novas, o harness parou de terminar. A saida
era so `o teste nao chegou ao fim. DOM: 332864 chars` — sem uma linha de log,
sem apontar onde parou.

Causa: o bloco de teste do `harness.py` e uma **string Python comum**, e eu
escrevi `replace(/\n/g, ' | ')` dentro dela. O Python transformou `\n` em quebra
de linha REAL, o JS virou `/` + newline + `/g`, e o `<script>` inteiro morreu com
erro de sintaxe. **Nada do teste rodava** — nem as assercoes antigas, nem o
handler que grava o resultado.

Dois consertos, e o segundo importa mais:

- os escapes viraram `\\n` e `\\D` (o `\D` funcionava por acidente: e escape
  invalido em Python, entao era preservado);
- entrou um **watchdog** no harness: se em 30s o `<pre id=RESULTADO>` nao
  existir, ele grava o log parcial com a linha
  `FALHOU a suite TRAVOU: rodar() nao terminou nem estourou`. Sem ele, o proximo
  travamento vai custar as mesmas idas e vindas.

Junto, o `--virtual-time-budget` subiu de 25000 para 60000: as ~25 esperas novas
estouravam o orcamento e o DOM saia antes do resultado, o que o lado Python le
como "nao chegou ao fim" e nao como falha de assercao. Orcamento e tempo
**virtual**: subir nao deixa a suite mais lenta.

**Licao: uma suite que trava calada e pior que uma suite vermelha.** Vermelha diz
o que quebrou; travada faz duvidar do codigo que esta certo.

---

## 5. Estado das provas

Medido em 08/08/2026, nesta maquina.

| prova | antes | depois |
|---|---|---|
| `python ferramentas/harness.py` | 196 passou / 8 falhou | **239 passou / 8 falhou** |
| `python ferramentas/validar.py` | EXIT 0 | **EXIT 0** |
| `python ferramentas/prova_trilho.py` | EXIT 0 | EXIT 0 |
| `python ferramentas/diag_mobile.py 360 / 390 / 414` | EXIT 0 | **EXIT 0 nos tres, 0 sobreposicoes** |
| `node --check public/app.js` | EXIT 0 | EXIT 0 |
| `node ferramentas/prova_{cliente,nf,metricas,regua,sessao,venda_editar,escopo,cpo,leitura}.js` | EXIT 0 | **EXIT 0 nos nove** |
| `ferramentas/prova_entrega.sql` bloco 1 (entrega) | — | **16 ok / 0 falhas** |
| `ferramentas/prova_entrega.sql` bloco 2 (motoboy) | — | **12 ok / 0 falhas** |

**As 8 falhas do harness sao herdadas e foram MEDIDAS como tal**: o `app.js` do
`HEAD` foi restaurado, a suite rodou, deu as mesmas 8, e so entao o trabalho
seguiu. Sao de Fila e leque (`data-aba`, bandeja tingida, raio, sombra, botao
Respondeu), nenhuma toca Vendas.

Correcao de registro em relacao ao v46: ele declarava `harness 172/3` e
`validar.py EXIT 1 com 4 reprovacoes herdadas`. Hoje o HEAD mede **196/8 e
EXIT 0**. Os numeros do v46 envelheceram nos commits seguintes; conferir rodando,
nunca copiando do handoff anterior.

### 5.1 As 43 assercoes novas CLICAM

A licao mais cara do v46 foi que prova de escrita por string sobre a fonte casa
igual com o codigo quebrado. Nenhuma das 43 le o fonte. Elas abrem a aba, clicam
no botao do card, conferem os campos preenchidos, mexem na previa, clicam em
enviar e afirmam sobre a **chamada de RPC que saiu dali**. Entre elas:

- os dois guards do enviar provados ANTES do caminho feliz (sem endereco e sem
  numero do motoboy: `rpc=0` nos dois, com a mensagem certa);
- o payload de `editar_venda` conferido campo a campo, **e a ausencia** de
  `comprador_nome` e `comprador_whatsapp` nele;
- a URL do `wa.me` e o texto decodificado (destino, dinheiro e recado);
- o botao do motoboy cadastrado despachando sozinho, e o motoboy **sem numero**
  nao despachando nem abrindo janela;
- `nenhum TypeError em todo o caminho de escrita` — a assercao que o v46 nao
  tinha e que teria pego o defeito que foi para producao.

---

## 6. Objetos novos e alterados no banco

| objeto | o que e |
|---|---|
| `venda.motoboy_whatsapp` | coluna nova, com CHECK `^[0-9]{10,15}$` |
| `motoboy` | tabela nova: nome, whatsapp, observacoes, `desligado_em`. RLS por tenant nas 3 policies; `authenticated` tem SELECT/INSERT/UPDATE, nunca DELETE |
| `motoboy_tel_unico` | indice unico parcial: telefone nao repete entre motoboys VIVOS (desligado libera o numero) |
| `salvar_motoboy(payload)` | cria e edita; normaliza telefone, teto de 80 no nome com recusa |
| `desligar_motoboy(p_id, p_desligar)` | soft delete, reversivel |
| `privado.fn_venda_atualizar` | ganhou `motoboy_whatsapp` na whitelist |
| `editar_venda` / `registrar_venda` | normalizam o telefone do motoboy igual ao do comprador |
| `v_venda` | expoe `motoboy_whatsapp` (no fim, e `security_invoker` reposto) |

Migrations, em ordem: `venda_motoboy_whatsapp`, `venda_motoboy_whatsapp_rpcs`,
`venda_motoboy_whatsapp_registrar`, `venda_motoboy_whatsapp_view`,
`motoboy_cadastro`, `motoboy_rpcs`.

Armadilha que o `CLAUDE.md` avisa e que valeu de novo: `create or replace view`
derruba `security_invoker` em silencio, e `create or replace function` reseta
ACL. Os dois foram repostos no mesmo bloco, e a prova confere `reloptions`.

---

## 7. Como conferir (caminho exato)

O app **NAO foi publicado**: nenhum commit foi feito e `git push` nao rodou.
Neste projeto push E deploy.

Local, ja no ar nesta sessao:

```
node ferramentas/servir.js       # http://localhost:8788
```

No app: aba **Vendas**. Cada card ganhou a linha `entrega`. Tocar em
**Relatório**:

1. O painel abre com tudo preenchido da venda (as tres vendas reais ja tem
   endereco, retirada `Campo Grande`, `R$ 90,00`, forma e `Hiago Araújo`).
2. A lista de motoboys comeca **vazia** (nenhum cadastrado no banco ainda):
   digitar `Hiago Araújo` e o WhatsApp dele nos dois campos e tocar em
   **Salvar na lista de motoboys**. Ele vira botao.
3. Tocar no botao dele despacha: grava a venda e abre a conversa com o texto.

Provas do banco: colar `ferramentas/prova_entrega.sql` no `execute_sql` do MCP
(os dois blocos rodam separados). ERRO terminando em `0 falhas` = APROVOU; a
transacao inteira volta atras.

Para subir:

```
git add -A && git commit && git push
```

---

## 8. Pendencias

1. **Nada foi commitado.** A obra inteira esta na copia de trabalho.
2. **As 8 falhas herdadas do harness** seguem abertas (Fila e leque). Nenhuma e
   desta sessao e nenhuma toca Vendas.
3. **`privado.fn_venda_atualizar` tem EXECUTE para `authenticated`** e e SECURITY
   DEFINER, escrevendo qualquer coluna da whitelist sem checar tenant (quem checa
   e a `editar_venda`, que le a venda pelo RLS antes). Vive em `privado`, entao o
   PostgREST nao a expoe, e nao ha caminho conhecido de chamada direta pelo
   cliente. **Nao e desta sessao e nao foi mexido** — mudar ACL sem pedido seria
   escopo alheio. Fica nomeado para o `pit-guard` decidir.
4. **O relatorio nao registra que foi enviado.** Nao existe `despachado_em` nem
   evento no historico: a tela nao sabe dizer se aquela venda ja foi despachada
   nem quando, e reenviar e indistinguivel de enviar. Foi corte consciente de
   escopo, nao esquecimento, e e o candidato obvio da proxima fatia.
5. **O texto do relatorio nao e configuravel.** O formato esta no JS. Se o dono
   quiser outro layout, hoje isso e mudanca de codigo.
6. Tudo o que a v43 a v46 deixaram aberto segue aberto, inclusive a
   **VENDA-0003 duplicada** (faturamento inflado em R$ 8.400; a ferramenta existe
   e esta provada, o ato e do dono).

---

## 9. O que esta sessao ensina

1. **Ler o banco antes de desenhar corta obra pela metade.** O pedido parecia
   pedir uma entidade nova; a tabela `venda` ja tinha os seis campos e a RPC ja
   aceitava patch parcial. O que faltava mesmo era uma coluna.
2. **Suite que trava calada e pior que suite vermelha.** Um `\n` mal escapado
   matou o `<script>` inteiro e a unica pista era o tamanho do DOM. O watchdog
   entrou junto com a correcao para que a proxima vez custe uma rodada.
3. **Medir o baseline ANTES de mexer.** Restaurar o `HEAD`, rodar e anotar 196/8
   foi o que permitiu afirmar, sem duvida, que as 8 falhas nao eram minhas — e
   descobrir de passagem que os numeros do v46 tinham envelhecido.
4. **Onde existe uma fonte da verdade, a segunda tela e leitura.** O cliente
   aparece no relatorio, mas nao se edita ali: identidade mora no lead.
5. **Campo vazio que precisa de acao tem que aparecer**, e o vazio vira o proprio
   convite: `sem endereço de entrega` com o botao em morno diz mais que uma linha
   omitida.
