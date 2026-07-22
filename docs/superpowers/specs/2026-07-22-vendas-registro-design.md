# Design: aba Vendas (registro de venda) — Pit Wall 2.0

Data: 22/07/2026. Autor: dono + Claude (brainstorming). Status: aprovado no design,
aguardando revisao do spec escrito.

---

## 1. Objetivo e dor

Registrar CADA venda da Pitstop num lugar unico e buscavel, com foco em **registro
geral que hoje se perde** e no **operacional da entrega** (aparelho, IMEI, nota
fiscal, motoboy, fornecedor). Lucro por venda entra, mas nao e o que abre a aba.

Hoje nao existe registro de venda no Nucleo. As colunas `lead.qtd_compras` e
`lead.valor_total` existem mas sao manuais e estao vazias — por isso a faixa da aba
Clientes nunca aparece. Este trabalho cria a fonte que alimenta essa faixa.

## 2. Decisao de arquitetura

**Abordagem escolhida: A — venda autonoma, cliente e agregacao derivada.** Tabela
nova `venda`, uma linha por venda (um aparelho por venda, o caso normal de iPhone).
`lead_id` nullable: cliente e opcional. As colunas agregadas do lead deixam de ser
manuais e passam a ser derivadas da soma das vendas.

Descartadas: **B** (venda + itens; overkill, quase toda venda e 1 aparelho; da pra
evoluir A->B depois sem jogar fora); **C** (guardar venda nos campos do lead; um lead
so teria uma venda, sem historico de recompra nem IMEI/NF por venda).

## 3. Decisoes conscientes do dono (registradas)

- **Cliente e opcional na venda.** Trade-off aceito: venda sem cliente entra no
  registro de Vendas mas nao soma no LTV de ninguem na aba Clientes.
- **NF por upload real** (Supabase Storage), nao link colado. Vira fatia propria
  (Storage tem infra: bucket privado, RLS, URL assinada).
- **Lucro = venda - custo - despesas.** Trade-in tratado como forma de pagamento,
  nao como lucro/custo da venda atual.
- **Lista fechada de iPhones** em tabela-catalogo (padrao do projeto: config em
  dado, nao enum no codigo).
- **Venda amarrada a lead promove o lead a `comprou` e o poe no pos-venda, APOS
  confirmacao explicita no cadastro.** Contra a recomendacao inicial de adiar; o
  dono quis, com o gate de confirmacao pra nao disparar a regua sem querer. Por
  tocar a regua (a parte mais sensivel), isso e fatia PROPRIA (fatia 3), nunca junto
  do registro de venda.

## 4. Invariantes respeitados

- Toda tabela de dado tem `tenant_id` e policy de RLS que o usa (invariante 7).
- Auditoria append-only por trigger em cada escrita de venda (com antes/depois).
- Vinculo por chave estavel: `venda.lead_id` referencia `lead(id)`; `venda_code`
  humano para citacao (`VENDA-0001`), no molde de `lead_code`.
- **Lucro e derivado na leitura, nunca coluna** (mesmo principio do nivel, inv. 4):
  `valor_venda - custo_aparelho - despesa_frete - despesa_taxas`.
- `qtd_compras`/`valor_total` do lead passam a ser derivados (agregacao), matando a
  divergencia de duas verdades.
- Helpers de RLS seguem em `privado.*`.

## 5. Schema

### 5.1 Tabela `venda` (schema public)

Vinculo e identidade:
- `id` uuid PK
- `tenant_id` uuid NOT NULL FK tenant
- `venda_code` text (`VENDA-0001`, chave humana estavel, sequencial por tenant)
- `lead_id` uuid NULL FK lead(id)

Comprador (snapshot; usado principalmente quando nao ha `lead_id`; todos opcionais):
- `comprador_nome` text
- `comprador_whatsapp` text (so digitos quando presente)
- `comprador_cpf` text
- `comprador_nascimento` date
- `comprador_instagram` text

Aparelho vendido:
- `modelo_id` uuid FK `catalogo_iphone(id)` (lista fechada)
- `capacidade` text · `cor` text
- `condicao` text CHECK `lacrado`/`vitrine`/`seminovo`
- `imei` text NULL

Fornecedor:
- `fornecedor_nome` text NULL
- `fornecedor_contato` text NULL
- `fornecedor_local_retirada` text NULL
- `fornecedor_pix_url` text NULL (comprovante do PIX pago ao fornecedor; Storage,
  fatia 4; nasce vazio)

Dinheiro (numeric):
- `valor_venda` — preco total acordado do aparelho (obrigatorio)
- `custo_aparelho`
- `despesa_frete` · `despesa_taxas`
- lucro NAO e coluna (derivado na leitura, ver 5.3)

Trade-in (opcional):
- `tem_trade_in` bool default false
- `entrada_modelo` text · `entrada_imei` text · `entrada_valor` numeric

Nota fiscal:
- `nf_numero` text NULL (o numero)
- `nf_url` text NULL (o arquivo; Storage, fatia 4; nasce vazio)

Operacional e sistema:
- `motoboy` text NULL (nome)
- `forma_pagamento` text CHECK `pix`/`dinheiro`/`cartao`/`misto`
- `data_venda` date
- `observacoes` text NULL
- `criado_por` uuid FK app_usuario
- `criado_em` timestamptz default now() · `atualizado_em` timestamptz
- `arquivado_em` timestamptz NULL (soft delete)

Obrigatorios minimos no cadastro: `modelo_id` + `valor_venda`. Restante opcional.

### 5.2 Tabela `catalogo_iphone` (config)

- `id` uuid PK · `tenant_id` · `rotulo` text (ex `iPhone 13`) · `ativo` bool ·
  `ordem` int. Semeada com os modelos correntes; editavel sem tocar codigo, no molde
  de `cadencia_regra`/`dicionario_rotulos`. Capacidade e cor ficam como campos livres
  da venda na fatia 1 (nao explodir o catalogo por combinacao).

### 5.3 Lucro derivado

Calculado na leitura (view de venda ou no cliente), nunca armazenado:
`lucro = coalesce(valor_venda,0) - coalesce(custo_aparelho,0) -
coalesce(despesa_frete,0) - coalesce(despesa_taxas,0)`.
Trade-in NAO entra: `entrada_valor` e forma de pagamento, nao componente do lucro.

### 5.4 Agregacao no cliente (a ponte Vendas -> Clientes)

`v_lead` passa a computar, por `lead_id`, sobre vendas com `arquivado_em is null`:
- `qtd_compras = count(venda)`
- `valor_total = sum(venda.valor_venda)`

As colunas manuais `lead.qtd_compras`/`lead.valor_total` sao deprecadas (paramos de
escrever nelas). Efeito: registrar uma venda com cliente amarrado acende a faixa
`N compras · R$ total` na aba Clientes automaticamente. Custo de query irrelevante no
volume atual (15 leads). Alternativa de trigger recalculando a coluna foi rejeitada
por reintroduzir risco de divergencia.

## 6. Trade-in

`tem_trade_in` liga o bloco. `entrada_valor` e o credito dado ao cliente, que abate o
pago em dinheiro; nao altera o lucro da venda. O lucro do usado se realiza quando ele
e revendido, o que e simplesmente OUTRA venda com `custo_aparelho = entrada_valor`.
Amarrar a saida a venda de origem e refinamento futuro (fatia 5), nao fatia 1.

## 7. Promocao a `comprou` (fatia 3, toca a regua)

Quando a venda tem `lead_id`, o cadastro oferece um passo de **confirmacao explicita**
("marcar cliente como comprou e iniciar pos-venda"). Ao confirmar:
- `lead.perfil` vira `comprou`
- registra `lead_evento` (`fechou` e a transicao de perfil correspondente)
- o lead entra na cadencia de pos-venda (perfil `comprou`, P1 · D1 pos-venda ... ate
  D365), pelo mecanismo de regua ja existente

Sem confirmacao, a venda fica como registro puro e a faixa ja acende pela agregacao.
Detalhe do gatilho de regua (RPC vs atualizacao de `cadencia_estado`) fica pro plano
da fatia 3.

## 8. Fatias de entrega

| Fatia | Entrega | Abrivel | Toca banco/regua |
|---|---|---|---|
| 1 — Registro | `venda` + `catalogo_iphone` semeado + RLS + auditoria; aba Vendas (form + lista); anexos nascem vazios; sem promover perfil | cadastra e ve a venda na lista | cria tabela, escrita de venda |
| 2 — Faixa | `v_lead` soma vendas por `lead_id`; `qtd_compras · valor_total` na aba Clientes | faixa do cliente acende | so leitura (view) |
| 3 — Comprou | confirmacao no cadastro promove lead a `comprou` + pos-venda | cliente vira comprou e cai no pos-venda | mexe na regua |
| 4 — Anexos | NF + comprovante PIX: Storage, bucket privado, RLS, upload, URL assinada | anexa e reabre o PDF | Storage + policy |
| 5 — Futuro | renomear "Clientes", trade-in ligando saida a origem, despesas discriminadas, aba Clientes rica, placar de faturamento/lucro | varia | varia |

Fatia 1 e o alvo imediato. 2 e 3 sao pequenas e vem na sequencia; 4 e a mais pesada.

## 9. Telas (fatia 1)

### 9.1 Lista (abre ao clicar em Vendas)
- Cabecalho: titulo Vendas, subtitulo com data e contagem; botao `+ Nova venda`.
- Card por venda (reusa o padrao existente): `venda_code`, modelo + capacidade + cor,
  chip de `condicao`, cliente (nome do lead/comprador ou "sem cliente"), data, IMEI,
  `valor_venda` e `lucro` (destaque; verde se positivo), chip `[trade-in]` quando
  houver. Na fatia 4, chip `NF` quando houver anexo.
- Busca reusa `blocoBusca` (modelo / IMEI / cliente / venda_code).
- Estado vazio proprio: "Nenhuma venda ainda. Toque em Nova venda."

### 9.2 Form Nova venda (molde do editor de lead da Fase 2)
Painel em blocos: 1) Cliente (buscar lead OU avulso: nome, whatsapp, CPF, nascimento,
Instagram); 2) Aparelho (modelo do catalogo, capacidade, cor, condicao, IMEI);
3) Fornecedor (nome, contato, local de retirada); 4) Dinheiro (valor, custo, frete,
taxas -> lucro calculado ao vivo); 5) Trade-in (toggle -> modelo/IMEI/valor);
6) Fechamento (motoboy, forma de pagamento, data, numero NF, observacoes); 7) Anexos
desabilitados com "em breve" (ativam na fatia 4). Salvar gera venda + auditoria.
O passo de confirmacao "marcar como comprou" so aparece na fatia 3 e so com cliente.

### 9.3 Navegacao
Vendas entra como aba principal no grupo Operacao (e trabalho diario). "Clientes"
segue como `.aba-rara`. Posicao exata na barra (desktop e mobile "Mais") fica pro
plano.

## 10. Fora de escopo (agora)

Multiplos aparelhos por venda (abordagem B), estoque, ligacao automatica saida<->origem
do trade-in, placar de faturamento/lucro, renomear "Clientes", aba Clientes rica.
Todos revisitados na fatia 5+.

## 11. Riscos e pontos a validar no banco

- Confirmar via Supabase (MCP) que `v_lead` expoe hoje `qtd_compras`/`valor_total` e
  onde substitui-los pela agregacao sem quebrar consumidores.
- Sequencia de `venda_code` por tenant: gerar sem corrida (mesmo cuidado do
  `lead_code`).
- RLS de `venda` testada como dono, vendedor e tenant errado antes de dar por pronta.
- CPF e dado pessoal (LGPD): fica sob RLS/tenant como o resto; sem exposicao no
  cliente alem do necessario.
