# Design: editar e arquivar venda ja registrada — Pit Wall 2.0

Data: 31/07/2026. Autor: dono + Claude (brainstorming). Status: aprovado no design,
aguardando revisao do spec escrito.

---

## 1. Objetivo e dor

Pedido do dono: *"preciso conseguir alterar as vendas feitas"*.

Hoje a venda e um registro de mao unica. Medido em 31/07/2026, no repo e no banco vivo:

- `renderVendas` monta `cardVenda` com **Ver cliente** e o bloco de NF, e nada mais.
  Nao existe botao de editar em lugar nenhum da aba Vendas.
- O unico painel de venda e o de cadastro (`abrirPainelVenda` -> `salvarVenda` ->
  RPC `registrar_venda`). Ele sempre insere.
- Nao existe `editar_venda` nem `arquivar_venda`. As unicas funcoes do dominio sao
  `registrar_venda`, `anexar_nf`, `remover_nf` e o trigger `fn_venda_code`.
- Nao existe `DELETE` para `authenticated`, e nem deve existir (invariante 6).

Consequencia pratica: **venda digitada errada e permanente pela tela**. E o passivo
ja existe. VENDA-0002 e VENDA-0003 sao a mesma venda (Victor Maia Dargains, iPhone
17 Pro Max, R$ 8.400, 16/07/2026), criadas com **1,2 segundo de diferenca**
(`19:27:30.389` e `19:27:31.549`): duplicata de clique duplo. Ela infla a contagem
de vendas, o faturamento e o LTV do cliente desde 27/07/2026.

## 2. Escopo (decidido pelo dono nesta sessao)

**Entra:**
1. Corrigir os campos da venda (aparelho, valores, fornecedor, trade-in, entrega,
   fechamento, observacao, numero da NF, dados do comprador).
2. Arquivar venda que nao deveria existir, e desarquivar.

**Fica de fora, por decisao consciente do dono:**
3. Editar `data_venda`.
4. Trocar o cliente vinculado (`lead_id`).

O corte nao e arbitrario: 3 e 4 sao exatamente os dois campos que mexem na regua.
Desde a v43 `data_venda` e a **ancora do pos-venda** (`cadencia_regra` com ancora
`data_venda`), entao mudar a data reancora o P1/D30/D180 daquele cliente. Trocar
`lead_id` move a venda de dono, mexe no perfil `comprou` e no pos-venda dos DOIS
lados. Deixando os dois fora, **a edicao nao toca a cadencia** e a fatia fica
pequena, provavel e reversivel.

Consequencia para a tela: no modo edicao, cliente e data aparecem em LEITURA, com
a razao escrita ali, nao escondidos.

## 3. Decisao de arquitetura

**Abordagem escolhida: A — RPC unica de escrita + fechar a porta direta.**

Duas RPCs novas (`editar_venda`, `arquivar_venda`) e `REVOKE UPDATE ON venda FROM
authenticated`. A whitelist de campos vive na RPC: ela simplesmente nao aceita
`lead_id`, `data_venda`, `tenant_id`, `venda_code`, `criado_por`, `criado_em`.

Isso corrige de passagem uma brecha que **ja existe hoje**, e nao foi criada por
este trabalho: `authenticated` tem `UPDATE` table-level em `public.venda`
(conferido em `information_schema.role_table_grants`), com policy `venda_upd` que
so checa `tenant_id`. Ou seja, qualquer sessao logada ja pode, pela API, reescrever
`data_venda` de uma venda antiga e mover a ancora do pos-venda sem passar por
codigo nenhum. Construir a edicao em cima disso seria construir em cima do buraco.

Descartada: **B — update direto do frontend via PostgREST.** Entrega mais rapido e
nao exige SQL, mas nao tem validacao central, deixa a tela capaz de gravar
`data_venda` e `lead_id` por acidente (os dois campos que o proprio dono tirou do
escopo) e mantem a porta aberta.

Padrao de implementacao das RPCs: **o mesmo que a v43 usou em `cadencia_estado`
(decisao 10)**. A RPC e SECURITY INVOKER, entao o RLS isola o tenant e prova o
acesso a linha; a escrita em si sai por helper `privado.fn_venda_atualizar` /
`privado.fn_venda_arquivar` SECURITY DEFINER, invisivel ao PostgREST (invariante 8),
chamado **depois** de o acesso ja ter sido provado. Sem isso, o `REVOKE UPDATE`
quebraria a propria RPC em producao.

## 4. Banco

Uma migration, aplicada pelo agente `base` (unico com `apply_migration`).

### 4.1 `privado.fn_venda_atualizar(p_id uuid, p_campos jsonb)` — SECURITY DEFINER

Aplica os campos ja validados. `search_path` fixo (`public`, `privado`). Grava
`atualizado_em = now()`. Nao e executavel por `authenticated` (schema `privado`).

### 4.2 `privado.fn_venda_arquivar(p_id uuid, p_arquivar boolean)` — SECURITY DEFINER

Grava `arquivado_em = now()` ou `null`, e `atualizado_em = now()`.

### 4.3 `public.editar_venda(payload jsonb)` — SECURITY INVOKER

- Le `payload->>'id'`. Confere pelo RLS que a venda existe e e do tenant
  (`select ... from public.venda where id = ...`); se nao achar, devolve
  `{ok:false, erro:'Venda nao encontrada.'}` sem vazar se existe em outro tenant.
- Recusa venda ja arquivada (corrigir arquivada e ruido; desarquiva primeiro).
- Normaliza igual ao `registrar_venda`: string vazia vira NULL, numerico aceita
  virgula, `modelo_texto` resolve `modelo_id` no `catalogo_iphone` quando casa.
- **Whitelist de campos editaveis (28):** `modelo_texto`, `capacidade`, `cor`,
  `condicao`, `imei`, `valor_venda`, `custo_aparelho`, `despesa_frete`,
  `despesa_taxas`, `comprador_nome`, `comprador_whatsapp`, `comprador_cpf`,
  `comprador_nascimento`, `comprador_instagram`, `fornecedor_nome`,
  `fornecedor_contato`, `fornecedor_local_retirada`, `tem_trade_in`,
  `entrada_modelo`, `entrada_imei`, `entrada_valor`, `status`, `endereco_entrega`,
  `valor_a_cobrar`, `motoboy`, `forma_pagamento`, `nf_numero`, `observacoes`.
  Qualquer chave fora dessa lista e **ignorada em silencio pela escrita**, nunca
  aplicada.
- Mesmas validacoes minimas do cadastro: `valor_venda > 0` e `modelo_texto` nao
  vazio.
- Chama `privado.fn_venda_atualizar`. Devolve `{ok:true, venda_code, id}`.

### 4.4 `public.arquivar_venda(p_id uuid, p_arquivar boolean default true)` — SECURITY INVOKER

Mesma prova de acesso pelo RLS, chama `privado.fn_venda_arquivar`, devolve
`{ok:true, venda_code, arquivada:boolean}`.

### 4.5 Privilegios

- `revoke update on public.venda from authenticated;` (a escrita passa a ser so
  pelas RPCs). `select` e `insert` continuam: `registrar_venda` e o fluxo de leitura
  dependem deles.
- `grant execute` das duas RPCs novas so para `authenticated`; `revoke ... from
  public, anon`.
- Refazer REVOKE/GRANT explicitos depois de cada `CREATE OR REPLACE FUNCTION`
  (a regra do CLAUDE.md: `CREATE OR REPLACE` reseta ACL).

### 4.6 O que NAO muda no banco

- **`v_venda` nao e tocada.** Ela ja filtra `arquivado_em is null`, entao arquivar
  ja some da lista sozinho. `CREATE OR REPLACE VIEW` derrubaria `security_invoker`
  em silencio, e nao vale correr esse risco por um contador.
- **Auditoria: nada a fazer.** `trg_auditar_venda` (`fn_auditar`) ja esta na tabela.
  Toda correcao e todo arquivamento viram linha append-only com antes e depois, de
  graca.
- **`painel_metricas` nao muda.** Ja ignora `arquivado_em is not null` e
  `status = 'cancelada'` na soma por origem.
- Nenhum numero de cadencia entra em funcao (invariante 11); nada aqui toca cadencia.

## 5. Frontend

Patch `ferramentas/patch_vendas_editar.py`, no padrao dos patches existentes
(aborta se achar 0 ou 2 ocorrencias do ancora). Arquivos: `public/app.js`,
`public/index.html`, `public/app.css`.

### 5.1 Card

`cardVenda` ganha **Editar** ao lado de Ver cliente, com `data-acao="venda-editar"`
e `data-id`. Arquivar **nao** entra no card: e acao destrutiva e mora dentro do
painel, atras de uma confirmacao.

### 5.2 Painel em modo edicao

`abrirPainelVenda(leadId)` passa a `abrirPainelVenda(leadId, venda)`. Com `venda`:

- titulo vira `Editar VENDA-0002` (o `<h2>` do `#painelVenda` ganha id).
- todos os campos ja preenchidos com o valor atual.
- bloco **Cliente**: busca, resultados e o `desfazer` ficam ocultos; entra uma linha
  de leitura `Cliente: LEAD-0018 · Victor Maia Dargains`. Os campos `comprador_*`
  seguem editaveis: sao a fotografia do dia da venda, nao o cadastro do cliente.
- `fvData` fica `disabled`, com nota: *"a data ancora o pos-venda; para mudar,
  fale comigo"*.
- `fvNfArq` (upload) fica oculto no modo edicao: anexar NF ja tem caminho proprio
  no card, e o `subirNf` do salvar depende de venda recem-criada.
- botao salva por `editar_venda`; toast `Venda VENDA-0002 corrigida`.
- rodape do painel: **Arquivar esta venda**, com confirmacao que diz o que vai
  acontecer (some da lista e dos numeros, o registro e a auditoria ficam).

Sair do painel volta ele ao modo cadastro (o mesmo painel serve os dois; nao ha
segundo formulario para divergir do primeiro).

### 5.3 Topo da aba e arquivadas

- contador vira `3 vendas · 1 arquivada`. O trecho `1 arquivada` e um botao.
- clicando, abre a lista das arquivadas: card com visual apagado, etiqueta
  `arquivada` e botao **Desarquivar**. Clicando de novo, fecha.
- as arquivadas sao lidas da tabela `venda` direto
  (`t.from("venda").select(...).not("arquivado_em","is",null)`), nao da `v_venda`
  (que as filtra). Campos disponiveis ali bastam para a lista: `venda_code`,
  `modelo_texto`, `comprador_nome`, `valor_venda`, `data_venda`, `arquivado_em`.
- a busca (`filtVendaBusca`) nao mexe: ela filtra a lista ativa.

### 5.4 A distincao que a tela precisa dizer

`status = Cancelada` e **"a venda existiu e caiu"** (conta na historia, ja sai da
soma por origem). **Arquivar** e **"isso nunca foi uma venda"**, o caso da
duplicata. Sao coisas diferentes e a confirmacao de arquivar diz isso em uma linha,
para o operador nao escolher errado.

### 5.5 CSS

Reuso dos tokens ja medidos. Card arquivado usa a familia neutra (`--frio` tint /
texto), nunca `--erro`: arquivada nao e falha de sistema. **Nenhum token de cor
novo entra.**

## 6. Provas

Agente `bandeira`. Nada sobe sem exit code 0.

**Banco**, em transacao que termina em `raise exception` (rollback de proposito),
com `set local role authenticated` e claims do dono:

1. `editar_venda` corrige `valor_venda` e o valor novo aparece na `v_venda`.
2. A correcao gera **exatamente 1** linha em `auditoria`, com antes e depois.
3. Campo fora da whitelist no payload (`data_venda`, `lead_id`) **nao e aplicado**.
4. `valor_venda = 0` e recusado com `{ok:false}`.
5. `arquivar_venda` some da `v_venda`; desarquivar traz de volta.
6. Tenant errado nao edita, nao arquiva e ve 0 vendas.
7. `authenticated` **nao** tem mais UPDATE direto em `venda` (o update cru falha).
8. `privado.fn_venda_atualizar` nao e executavel por `authenticated`.
9. `editar_venda` em venda arquivada e recusado.

**Frontend:**

- `ferramentas/prova_venda_editar.js` (novo): abrir em modo edicao preenche os
  campos; `fvData` fica disabled; bloco de busca de cliente oculto; o payload
  montado nao carrega `data_venda` nem `lead_id`; o contador mostra as arquivadas.
- Sem regressao: `prova_nf.js`, `prova_cliente.js`, `prova_metricas.js`,
  `prova_regua.js`, `prova_sessao.js`.
- `node --check public/app.js` e carga do arquivo inteiro em VM sem ReferenceError.
- Suite Python (`validar.py`, `harness.py`, `prova_trilho.py`) segue sem rodar nesta
  maquina por falta de Python — declarar isso no handoff, como a v43 declarou, e
  nao fingir que rodou.

## 7. Sequencia (cada fatia termina em algo abrivel)

1. **Fatia 1 — corrigir.** Migration (helpers + `editar_venda` + revoke) e o botao
   Editar com o painel em modo edicao. Ao fim: o dono abre uma venda e corrige.
2. **Fatia 2 — arquivar.** `arquivar_venda`, o rodape do painel, o contador e a
   lista de arquivadas. Ao fim: o dono arquiva a VENDA-0003 e a duplicata some da
   contagem e do faturamento.

Fatia 1 sozinha ja e util. Fatia 2 depende do painel da 1 existir.

## 8. Fora de escopo (nomeado, para nao voltar como surpresa)

- Editar `data_venda` e trocar cliente vinculado (secao 2). Quando entrarem, entram
  com reancoragem de cadencia e evento proprio, como fatia separada.
- Historico de correcoes na tela. A auditoria ja guarda tudo; exibir e outra obra.
- Merge de vendas duplicadas (juntar duas em uma). Arquivar resolve o caso real de
  hoje; merge e complexidade sem demanda (invariante 17).
