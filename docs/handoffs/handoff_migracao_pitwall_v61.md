# Handoff Migracao Pit Wall (Nucleo) v61

Data: 16-17/08/2026
Sessao: a aba Vendas ganha profundidade — detalhe, etapa, pagamento e a ponte com a calculadora
Substitui: v60 (que segue valendo para o que nao foi tocado aqui)

---

## 1. Headline: a aba mostrava 17 campos e a venda guardava 39

O dono abriu pedindo "mais informacoes, mais visualizacao, onde acessar todos os
detalhes" na aba Vendas. Medido antes de propor: **22 campos gravados nao
apareciam em tela nenhuma**. Condicao, custo, frete, taxas, margem, fornecedor
inteiro, troca, dados do comprador, rastro — todos existiam so dentro do painel
EDITAR. Ou seja: **para CONSULTAR um dado era preciso entrar no unico modo capaz
de corromper a venda.**

A sessao terminou com cinco entregas encadeadas, todas na aba Vendas.

---

## 2. O que entrou

### 2.1. Detalhes no card (leitura pura)
Botao `Detalhes` abre um bloco com nove grupos. **Zero campo de formulario** — o
harness assere `inputs.length === 0`. Rotulo aparece SEMPRE, cheio ou vazio, e o
vazio vira travessao: `custo` nao informado nao e `R$ 0,00`, e e o vazio que
lembra o dono de preencher.

Mais o **historico de correcoes**, lido da `auditoria` que existia desde a Fase 2
e nunca teve tela. Antes/depois por campo, newest-first (invariante 6),
traduzido pelo dicionario. Zero migration: `authenticated` ja tinha SELECT com
policy `dono`.

### 2.2. Recorte "De onde vem"
Faturamento por fornecedor, modelo, pagamento e condicao, com a MESMA janela e o
MESMO criterio do painel de dinheiro. Agrupa pelo texto exato gravado, e o
rodape declara isso.

### 2.3. Quadro de etapas
`pendente → a_retirar → em_maos → a_caminho → entregue`, quatro colunas (Entregue
saiu do quadro a pedido do dono) na **mesma gramatica do kanban de Conteudo**.

**ETAPA NAO E STATUS**, e as duas nao se colapsam: `status` responde "vale
dinheiro?" (criterio de faturamento, intocado); `etapa` responde "onde esta?" e
nao entra em soma nenhuma. O dominio no dicionario e `etapa_venda`, **nunca**
`etapa`, que ja pertence ao LEAD (sentinelas `conversando` / `negociacao_parada`).

Enviar o relatorio ao motoboy move a venda para `a_caminho` sozinho: despachar JA
e o ato de por a venda a caminho.

### 2.4. Detalhamento de pagamento
Tabela `venda_pagamento`: N formas por venda, e a do credito abre parcelas.
**A soma TEM que fechar com o valor da venda** — conferida ao vivo no rodape E
de novo no banco. Sem isso daria para lancar R$ 200 numa venda de R$ 8.400 e a
tela diria "detalhado".

`venda.forma_pagamento` nao morreu: virou **derivado** do conjunto (uma forma → a
forma; duas ou mais → misto; credito+debito → cartao). O `misto` deixou de ser
promessa vazia: a VENDA-0002, de R$ 8.400, dizia "misto" e nao existia em lugar
nenhum como tinha sido dividida.

### 2.5. A ponte com a calculadora
O catalogo do painel tem **6 itens**; a calculadora tem **501 produtos e 1.043
precos** com fornecedor, praca, cor e custo. Dois caminhos:
- **busca dentro do formulario** de venda (recolhida atras de um link);
- **botao na calc** que leva ao painel com o formulario preenchido.

Os dois convergem em **uma unica funcao de escrita** (`preencherProdutoCalc`):
duplicar a quebra do nome, o mapa de condicao e a politica de sobrescrita faria
os caminhos divergirem em meses sem ninguem notar.

---

## 3. Banco

| migration | o que |
|---|---|
| `venda_etapa_coluna_e_dicionario` | `etapa` + `etapa_em`, backfill declarado, dominio `etapa_venda` |
| `venda_etapa_funcoes` | `mover_etapa_venda`, `etapa_em` como CONSEQUENCIA dentro de `fn_venda_atualizar` |
| `venda_etapa_no_cadastro_e_correcao` | `registrar_venda` e `editar_venda` conhecem a etapa |
| `v_venda_expoe_etapa` | `etapa`, `etapa_em`, `dias_na_etapa` derivado na leitura |
| `venda_pagamento_composicao` | tabela + RLS + dominio `forma_pgto_item` |
| `venda_pagamento_escrita_privada` | `salvar_pagamentos` + `privado.fn_pagamentos_salvar` |
| `v_venda_pagamento` | view com `valor_parcela` derivado |
| `venda_condicao_cpo` + `lead_condicao_cpo` | CPO no dominio das DUAS tabelas |
| `calc_dados_taxas_fonte_unica` | os 17 coeficientes viram DADO |

**`etapa_em` nao e parametro de ninguem**: quem muda a etapa carimba a hora
automaticamente, no unico ponto de UPDATE. Se o carimbo fosse do chamador,
existiriam duas regras (RPC do fluxo e formulario) divergindo no primeiro
esquecimento.

**Escrita de pagamento so pela RPC**: `authenticated` nao tem INSERT/UPDATE/
DELETE em `venda_pagamento`. A funcao privada `security definer` escreve; a RPC
publica roda sob RLS. Mesmo desenho de `editar_venda` + `fn_venda_atualizar`.

---

## 4. A tabela de parcelamento virou dado

Ate 16/08 os 17 coeficientes viviam em **dois arquivos e em nenhum banco**:
`const TX` em `public/calc/index.html` e `config.taxas` no `dados.js` do
consultor. O acrescimo fixo aparecia como `v+100` num e `config.pb` no outro.
**Atualizar um e esquecer o outro muda o que o cliente paga, em silencio.**

Agora a fonte e `calc_dados.dados.config.taxas` + `.pb`. A calc le de la e
**reprova alto** se faltar (`validarDados` nomeia o coeficiente ausente) — sem
fallback chumbado, que seria a terceira copia com outro nome.

Provado que o preco nao mudou: 2x, 5x, 10x, 12x e 18x dao **exatamente** o mesmo
numero de antes. `ferramentas/prova_taxas.py` compara banco x calc x consultor
coeficiente a coeficiente, e `validar.py` ganhou a regra **11.6**, que reprova se
algum coeficiente for copiado para o `app.js` (auto-testada).

O painel de pagamento e o **terceiro consumidor**, nunca a terceira copia. A
conta la e a INVERSA da aba VENDA — `liquido = valor/TX[n] - pb` — porque o campo
`valor` ja e o que o cliente passa no cartao. Confundir com a formula direta erra
exatamente `pb` por transacao.

---

## 5. Provas

| prova | resultado |
|---|---|
| `harness.py` | **617 passou, 0 falhou** (eram 477 no inicio) |
| `prova_etapa_venda.sql` | 27 ok, 0 falhas |
| `prova_pagamento_venda.sql` | 21 ok, 0 falhas |
| `prova_taxas.py` | 15 ok, 0 falhas |
| `validar.py` | TUDO PASSOU |
| `diag_mobile` 360/390/414/1280/1440 | 0 sobreposicoes, 0 estouros |

**`diag_mobile.py` agora ABRE os blocos antes de medir** (detalhes da venda), e
o watchdog do harness subiu de 30s para 50s — ele mede tempo VIRTUAL, e as
esperas novas o estouraram, fazendo a rodada sair como "a suite TRAVOU" com 593
assercoes VERDES. Falso negativo e o pior tipo.

---

## 6. Cinco defeitos que so apareceram porque a prova falhou

1. **`diag_mobile` media o bloco de detalhes FECHADO** e passaria verde para
   sempre. Aberto, acusou 3 sobreposicoes reais em 360px (historico em texto
   corrido). Virou uma linha por campo.
2. **`now()` e constante dentro da transacao.** A prova de banco comparava dois
   valores iguais: a assercao do "recarimbou" REPROVOU e a do "nao zerou" PASSOU,
   as duas pelo motivo errado. Onde o carimbo importa, o teste agora empurra
   `etapa_em` para o passado e mede se voltou.
3. **A regra 11.1 pegou o botao do relatorio pintado de azul** sem papel
   aprovado. Virou destaque estrutural: acao primaria e decisao do dono.
4. **CPO no dicionario quebrou o cadastro de LEAD.** `lead.condicao` tem o mesmo
   dominio, e os selects dele sao montados do dicionario em runtime: o dropdown
   passou a oferecer um valor que o banco recusava. Dominio compartilhado alcanca
   toda tela que monta select a partir dele.
5. **A regex de capacidade perdia os 14 MacBooks.** Os nomes reais sao
   `MacBook Neo 13" 8/256GB` (RAM/disco). Medido contra os 501 produtos: com
   `(?:\/\d+)?`, 90 nomes separam e o round-trip fecha em 100%.

---

## 7. Correcoes de fato

- **`MP ` e `MP Imports` sao a mesma pessoa** (dono, 16/08). Corrigido no banco
  com auditoria. `venda.fornecedor_nome` e texto livre sem chave: grafia nova
  parecida se leva ao dono, nunca se unifica sozinho.
- **A taxa de maquininha e REPASSADA.** Eu havia apontado como defeito que 2 das
  3 vendas de cartao estavam com `despesa_taxas` = 0, dizendo que inflava a
  margem. **Errado**: ele repassa ao cliente e tira o numero da calculadora.
  Taxa zero ali e o registro certo. `taxa_repassada` nasce `true`.
- **O push SAI daqui** (ja corrigido na v60) e o clone estava em dia.

---

## 8. Pendencias

1. **A Fatia 3 esta pronta mas o botao da calc nunca foi exercitado com login
   real** — a calc tem sessao propria (`storageKey: 'sb-calc-auth'`) e o teste
   rodou pelo lado do painel, com o rascunho plantado a mao.
2. **`dados.js` do consultor ainda declara `config.taxas`.** E artefato gerado,
   e agora tem alarme (`prova_taxas.py`), mas continua sendo uma copia.
3. **`calc_dados` tem a linha orfa** do tenant `...0004` (pendencia do v60). A
   calc usa `.single()` e quebraria se alguem enxergasse as duas; o painel usa
   `.select("dados")` e pega `data[0]`, entao e imune.
4. **Branch `claude/pitscare-estruturacao-o04knt`** segue orfa no GitHub, com 2
   commits de documentacao de 21/07.
5. **A validade da tabela continua sem alerta** (pendencia 3 do v60).
6. O botao do relatorio no quadro esta em destaque estrutural. Se o dono quiser
   o azul, e nomear em `ACAO_PRIMARIA` no `validar.py` — decisao dele.

---

## 9. Licao desta sessao

**O defeito mais caro nao estava no codigo novo: estava na prova que passava.**

Tres vezes a suite ficou verde por motivo errado — o `diag_mobile` medindo bloco
fechado, o `now()` comparado consigo mesmo, e as assercoes de busca clicando num
campo que nem estava aberto. Nenhuma delas apareceria num code review; todas
apareceram quando alguem perguntou "isso esta provando o que diz que prova?".

E o corolario: **guard-rail que nao reprova o caso que existe para pegar e
decoracao**. A regra 11.6 so entrou depois de ser testada colando um coeficiente
no `app.js` e vendo a suite ficar vermelha.
