# Handoff Financeiro v17 — o caixa nunca foi negativo, e a categoria tinha uma fabrica

Data: 03-04/09/2026. Linha: financeiro. Substitui o `handoff_financeiro_pitwall_v16.md`
como topo da linha.

Fecha a sessao mais longa da linha. O dono derrubou conclusao minha **quatro vezes**, e
nas quatro ele estava certo. Este documento existe principalmente para registrar COMO
ele estava certo, porque o padrao se repete.

---

## 1. A frase da entrega

**O caixa da loja nunca foi negativo em mes nenhum, e o que fazia parecer negativo era
R$ 56.287 de receita marcada como categoria neutra ou sem categoria.**

---

## 2. O estado, medido em 04/09/2026

| Mes | Entrou | Saiu | Saldo | Lucro | Cobertura |
|---|---|---|---|---|---|
| jun | 10.847,00 | 8.157,30 | **+2.689,70** | 550,00 | 100,00% |
| jul | 16.125,00 | 13.920,00 | **+2.205,00** | 670,00 | 98,54% |
| ago | 18.479,00 | 16.054,00 | **+2.425,00** | 2.925,98 | 100,00% |

Fevereiro a maio tambem positivos: +1.999,09 · +1.864,20 · +1.238,68 · +1.235,02.

| | 02/09 | agora |
|---|---|---|
| Cobertura de dominio | 18,55% | **99,86%** |
| Sem categoria | R$ 207.810,29 (nao medido) | **R$ 15.597,31** |
| Vendas registradas | 9 | **10** |
| Regras ativas | ~40 | **58** |

---

## 3. As quatro derrubadas, e o que cada uma ensinou

### 3.1 "fechei o mes com 9 mil de despesa?"

Nao. Agosto deu **lucro de R$ 2.925,98**. O -R$ 9.351,21 era CAIXA sob a palavra
`resultado`. **Licao: a palavra era o defeito, nao a conta.**

### 3.2 "nada virou estoque, apenas um 14 pro max"

Eu tinha assumido que `compra_aparelho` virava estoque e escrevi isso na tela. Medido
depois: os cinco pagamentos de agosto casam com venda de agosto, mesmo valor, 0 a 2
dias. **Ele compra POR VENDA.** Compra de aparelho e custo da mercadoria.

**Licao dura: eu escrevi a frase falsa na tela E escrevi uma assercao defendendo a
frase.** Prova que fixa uma mentira e pior que prova nenhuma. A assercao foi invertida.

### 3.3 "o saldo esta errado" — e a causa nao era a que ele apontou

Ele disse que compra nao devia contar como saldo negativo. **Discordei e continuo
discordando**: compra e o maior custo do negocio (R$ 20.069 contra R$ 23.628,98 de
receita em agosto) e tira-la do saldo mostraria +R$ 5.825 num mes de R$ 2.925 de lucro.

Mas a leitura dele de que o numero estava errado era certa, e o erro estava do outro
lado: **R$ 12.000 de receita marcados como `transferencia_interna`**, categoria NEUTRA,
fora de todos os totais.

**Licao: quando o dono diz que o numero esta errado, ele quase sempre esta certo sobre
o NUMERO e errado sobre a CAUSA. Medir a causa, nao aceitar nem recusar a explicacao.**

### 3.4 O mecanismo do BR, que so ele podia contar

> *"eu passo valores de maquininha na maquininha de outro lojista e recebo como pix por
> vezes, o br"*

Depois: *"nao devo nada, e venda minha"*.

Medido antes de aceitar: **R$ 60.166 entrando do BR contra R$ 14.530 saindo em sete
meses**. Se fosse emprestimo, ele deveria R$ 45.636. Nao devia. Sao **60 mil de receita
propria** que chegavam com o nome do lojista, nao do cliente.

E o mecanismo se auto-separa nos dados: quando o aparelho e do estoque do BR, o dinheiro
entra e sai no mesmo dia e vira par de repasse (+3.400 / -3.400 em 24/08); quando o
aparelho e comprado de outro fornecedor, o que entra e receita e fica.

---

## 4. A fabrica da cauda "Sem categoria"

**A regra `Compra no débito`, prioridade 100, `categoria_codigo` NULL, ja havia pego 267
lancamentos.** Menor prioridade ganha, entao ela vencia toda regra especifica e entregava
`dominio` sem categoria.

**Nao era divida do passado, era fabrica ativa:** todo extrato novo alimentava a cauda,
com regra ativa e portao F3 verde. Rebaixada para prioridade 9000.

O mesmo defeito estava em **outras 18 regras**. 17 foram completadas.

> **Regra que sai daqui: regra que grava `dominio` sem `categoria` e meia regra.** Ela
> fecha o portao F3 e deixa a tela cega sobre para onde o dinheiro foi.

Resultado: sem categoria caiu de R$ 207.810,29 para **R$ 15.597,31**, e a empresa de
51 linhas para **3**.

---

## 5. O portao que nao viu nada disso

**`fin_cobertura` mede `dominio`, nao `categoria`.** Por isso 99,86% de cobertura
conviveu com R$ 207 mil sem categoria, e antes disso com R$ 12.000 de receita em
categoria neutra.

**Proposta registrada e NAO aplicada** (decisao do dono): a tela exibir DUAS coberturas
lado a lado. Dominio trava pelo F3; categoria **cobra, nao bloqueia**, porque saldo,
lucro e caixa nao dependem dela.

Detalhe em `docs/financeiro/plano_categorias_20260903.md`.

---

## 6. A venda do Isac, e o estoque invisivel

**VENDA-0015** registrada tres meses depois do fato: 16 Pro Max 256GB, R$ 3.950, custo
R$ 3.400, **lucro R$ 550**, com trade-in de um **iPhone 14 Pro Max por R$ 3.450**.

E o **unico trade-in registrado das 10 vendas**. Antes dela, o unico estoque real do
negocio nao existia em lugar nenhum: trade-in nao move dinheiro, entao o extrato nao
pode ve-lo, e a venda nunca tinha sido lancada.

Tres campos foram DERIVADOS e estao marcados como tal na observacao da venda:
`entrada_valor` 3.450 (3.950 menos os 500 que entraram por Pix), `data_venda` 06/06 e
`forma_pagamento` misto. Nenhum deles afeta o lucro.

---

## 7. Erros meus desta sessao, sem maquiagem

1. **Assumi que compra virava estoque** sem cruzar com a tabela `venda`, escrevi na tela
   e escrevi prova defendendo. Duas correcoes no mesmo dia.
2. **Removi a chave `resultado` do payload com o banco de producao ja atualizado e a
   tela antiga no ar.** O placar do dono ficou em R$ 0,00 por uma janela. Regra que sai:
   migration destrutiva de payload so vai ao banco depois da tela pronta.
3. **A varredura em bloco de 196 linhas para `pessoal`** pos pelo menos um recebimento
   de venda (Isac, R$ 500) no lado errado. Corrigido.
4. **Nao percebi que havia outra sessao do Claude Code na mesma pasta** ate meu `vitrine`
   travar. A tela veio commitada por ela (`3b6b3bb`), conferida por fora e nao assumida
   como minha.

O padrao comum aos quatro: **afirmei sobre o negocio a partir do extrato, sem cruzar com
a tabela `venda`, que era onde a resposta estava.**

---

## 8. O que continua aberto

| # | Item | Nota |
|---|---|---|
| 1 | **Dashboard e Financeiro filtram por datas diferentes** | Dashboard por `data_contato` do LEAD, Financeiro por `data_venda`. Hoje batem porque TODAS as 10 vendas tem contato e venda no mesmo mes. **O primeiro lead contatado em um mes que comprar no outro faz as duas telas discordarem, sem erro e sem aviso.** Provavelmente conserto de ROTULO, nao de conta |
| 2 | `MF COMPANY` R$ 6.100 (17/04) | Entrada, sem saida para o CNPJ em 7 meses. Hipotese do dono: renda de imagem pessoal. **Se for pessoal, abril vai de +1.238,68 para -4.861,32**, o unico mes negativo. Mandou desconsiderar; a hipotese e a consequencia estao na observacao da linha |
| 3 | Os R$ 630 do Rodrigo Alves e o `forcar` no repasse | v14 secao 4 |
| 4 | Cauda pessoal, 218 linhas, R$ 9.227,31, media R$ 42 | Declarada como coisa que NAO se julga |
| 5 | `BRUNO` R$ 270 em 2 entradas | Fornecedor com dinheiro entrando |
| 6 | Duas coberturas na tela (secao 5) | Proposta, nao aplicada |
| 7 | Controle de estoque | Nao existe. "Tenho um aparelho parado" segue sem resposta |
| 8 | Escrita de volta no Notion | Bloqueio antigo do v33 |

---

## 9. Primeiro movimento do proximo chat

**ANTES DE QUALQUER COISA: rodar o `P-AUDITA`.** Prompt pronto em
`docs/financeiro/prompt_auditoria_20260904.md`, gerado pelo `condutor` em 04/09/2026.

Motivo, medido: **o `P-AUDITA` nao roda desde o v10.** Ficaram sem auditoria
independente a fatia 3, a fatia 4 e as TRES entregas de 03/09, que foram construidas E
conferidas pela mesma sessao, contra o que a secao 7 do CONTRATO manda. O bloco 3 do
`PLANO.md` tem como portao a lista de DEFEITOS VISIVEIS = 0, e a auditoria pode
acrescentar itens a essa lista: construir antes dela e construir sobre estado nao
conferido.

**Abrir SESSAO NOVA.** Esta sessao construiu; ela nao pode auditar.

Depois da auditoria, e so depois:

**O item 1 da secao 8.** E o unico defeito conhecido que ainda vai produzir numero
divergente na tela sem avisar, e ele vai aparecer sozinho no primeiro mes em que um
lead atravessar a virada.

Depois, decidir a proposta das duas coberturas (secao 5), que e o que impede o proximo
buraco de crescer em silencio.
