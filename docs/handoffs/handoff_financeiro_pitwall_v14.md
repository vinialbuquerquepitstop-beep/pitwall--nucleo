# Handoff Financeiro v14 — a cauda acabou: 99,86%, e todo mes passa no F3

Data: 03/09/2026. Linha: financeiro. Substitui o `handoff_financeiro_pitwall_v13.md`
como topo da linha.

---

## 1. A frase da entrega

**O dono julgou a cauda inteira em bloco, e o gargalo de nao classificado acabou:
99,86% do valor julgado, 2 linhas pendentes, e os NOVE meses passam no portao F3.**

Nao houve tela nova, migration nova nem linha de codigo. A entrega e o DADO,
aplicado pela RPC de producao (`fin_classificar`), com os guard-rails ligados.

| | 03/09 (v13) | 03/09 (agora) |
|---|---|---|
| Cobertura julgada | 95,51% | **99,86%** |
| Valor julgado | R$ 424.857,79 | **R$ 444.190,68** |
| Valor pendente | R$ 19.962,89 | **R$ 630,00** |
| Linhas pendentes | 199 | **2** |
| Meses reprovados no F3 | 4 de 7 | **0 de 9** |

---

## 2. A ordem do dono, na frase dele

> *"valores ainda em abertos sao pequenezas do cotidiano, rodrigo alves de 300 e 330
> foi repasse. coloque tudo que ainda nao foi julgado, em outros (pessoal) e acabe com
> o gargalo de valores nao classificados."*

**A leitura dele estava certa, e foi medida antes de aplicar:** das 198 linhas
pendentes, a mediana era **R$ 50,00**, a media **R$ 95,87** e a MAIOR de todas
**R$ 800,00**. Nao havia nenhum valor grande escondido na cauda.

---

## 3. O que foi aplicado

Duas chamadas de `fin_classificar`, impersonando o dono (`set_config` de
`request.jwt.claims` + `role = authenticated`), ou seja pela mesma porta da tela, com
RLS e validacao de servidor ligadas. Nenhum `UPDATE` direto na tabela.

| Chamada | Linhas | Categoria | Dominio |
|---|---|---|---|
| Saidas (`valor < 0`) | **162** | `outro_pessoal` (Outro (pessoal)) | `pessoal` |
| Entradas (`valor > 0`) | **34** | `outro_pessoal_entrada` (Outra entrada pessoal) | `pessoal` |

**Por que DUAS categorias e nao uma.** O dono disse "outros (pessoal)", que e o
`outro_pessoal`, de natureza `saida`. Por-lo numa entrada faria o proprio
`fin_classificar` devolver o aviso de sinal contrario e faria a Visao somar entrada
dentro de um grupo de gasto. As 34 entradas foram para o gemeo de entrada, mesmo
dominio, mesmo grupo de intencao. As duas chamadas voltaram `aviso: null`.

**As 196 linhas levam carimbo.** Todas gravaram a mesma `observacao`:

```
Varredura de 03/09/2026: cauda miuda julgada em bloco pelo dono como pessoal.
```

Nenhuma delas tinha `observacao` antes (conferido: 0 de 198), entao nada foi
sobrescrito. O carimbo e o que torna esta decisao em bloco auditavel e reversivel
numa consulta so. Sem ele, daqui a tres meses ninguem sabe distinguir o que foi
julgado linha a linha do que entrou na varredura.

**NENHUMA REGRA FOI CRIADA.** Deliberado. Uma regra de varredura classificaria as
importacoes FUTURAS como `pessoal` sozinha, e isso e exatamente o default silencioso
que o Inv. 18 proibe. O julgamento vale para as 196 linhas que existiam hoje; o
extrato de outubro volta a perguntar.

---

## 4. O Rodrigo NAO virou repasse, e o mecanismo esta certo

O dono disse que os R$ 300 e os R$ 330 do `RODRIGO ALVES RODRIGUES` foram repasse.
`fin_repasse_marcar` foi chamada com o par e **recusou**:

```
Par desigual: a diferenca e de 9.09%, acima dos 5% permitidos.
```

Entrada +R$ 300,00 em 10/07/2026 contra saida -R$ 330,00 em 30/07/2026. R$ 30 de
diferenca em 20 dias nao e tarifa nem arredondamento, que e para o que a folga de 5%
existe (esta escrito no comentario da propria funcao).

E o mesmo padrao ja anotado no v13 e na memoria do projeto: **repasse e RELACAO na
cabeca do dono e PAR de transacao no sistema.** O par anterior dele (R$ 5.000 contra
R$ 5.070, 1,38%) passou; este nao passa.

**Consequencia:** as 2 linhas ficaram pendentes de proposito, R$ 630,00. Nao foram
varridas para `pessoal` porque isso contrariaria a instrucao explicita dele, e nao
foram forcadas para `repasse` porque isso seria fabricar par. Elas sao 100% do
pendente que resta.

**Decisao que so o dono toma**, tres saidas possiveis:
1. deixar como esta (R$ 630 de 444 mil, nenhum mes reprova por causa disso);
2. dizer o lado (`empresa` ou `pessoal`) e fechar em 100%;
3. pedir um `forcar: true` em `fin_repasse_marcar`, nos moldes do que a decisao D-e
   ja faz para padrao generico. Isso e mudanca de contrato e entrega propria, com
   frase, migration, tela e assercao.

---

## 5. O portao F3 abriu em TODOS os meses

Medido pela `fin_cobertura` de producao, mes a mes, teto 95:

| Mes | Julgado | Pendentes |
|---|---|---|
| 01/2026 | 100% | 0 |
| 02/2026 | 100,00% | 0 |
| 03/2026 | 100,00% | 0 |
| 04/2026 | 100,00% | 0 |
| 05/2026 | 100,00% | 0 |
| 06/2026 | 100,00% | 0 |
| **07/2026** | **98,54%** | 2 (o Rodrigo) |
| 08/2026 | 100,00% | 0 |
| 09/2026 | 100% | 0 |

O v13 fechou com 4 dos 7 meses reprovando o F3. Agora **zero reprova**. A tela pode
exibir numero economico em qualquer janela.

Base inteira depois da varredura, por lado:

| Lado | Linhas | Valor bruto |
|---|---|---|
| empresa | 130 | R$ 262.250,33 |
| pessoal | 951 | R$ 120.913,35 |
| neutro | 88 | R$ 95.445,00 |
| **pendente** | **2** | **R$ 630,00** |

(Soma de valor absoluto, sem netting, pelo F4.)

---

## 6. O unico bloco que eu inverteria, com o comando pronto

Dentro das 34 entradas varridas ha **11 linhas de gateway de pagamento**, e o proprio
`mapa_pendentes_20260903.md` ja tinha registrado a leitura: *"EBANX e DLOCAL sao
gateways de pagamento internacional: entrada deles e recebimento de venda, nao receita
nova."*

| Contraparte | Linhas | Valor |
|---|---|---|
| `DLOCAL` | 8 | R$ 1.268,71 |
| `ADYEN LATIN AMERICA` | 3 | R$ 31,96 |
| **total** | **11** | **R$ 1.300,67** |

Recebimento de venda e `empresa`. Marcado como `pessoal`, sai da receita da loja.
**Sao R$ 1.300,67 de 444 mil (0,29%): nao muda o F3 de mes nenhum e nao trava nada**,
por isso a varredura foi aplicada inteira como o dono mandou e nao parou aqui. Mas o
numero fica anotado, e a inversao e uma chamada:

```sql
-- inverte SO os gateways de volta para empresa
with cfg as (
  select set_config('request.jwt.claims',
    '{"sub":"fb2aad8e-b728-4e59-a198-71da2156449d","role":"authenticated"}', true) as a,
         set_config('role','authenticated', true) as b
), ids as (
  select jsonb_agg(m.id::text) as arr
    from fin_movimento m, cfg
   where m.arquivado_em is null and m.valor > 0
     and m.contraparte in ('DLOCAL','ADYEN LATIN AMERICA')
     and m.observacao = 'Varredura de 03/09/2026: cauda miuda julgada em bloco pelo dono como pessoal.'
)
select public.fin_classificar(jsonb_build_object(
  'ids', arr, 'categoria_codigo','venda_aparelho', 'dominio','empresa')) from ids;
```

O resto das 34 entradas e genuinamente pessoa fisica miuda: `FELIPE NUNES` R$ 1.555 em
6 linhas (sobra sem par, ja anotada no v13), `JOAO VICTOR` R$ 750, `GABRIELA` R$ 581,
`ISAAC` R$ 500 e onze linhas de R$ 150 para baixo.

---

## 7. Como desfazer tudo, se der errado

A varredura inteira e uma consulta:

```sql
select * from fin_movimento
 where observacao = 'Varredura de 03/09/2026: cauda miuda julgada em bloco pelo dono como pessoal.';
```

196 linhas. Trocar o `select *` pela chamada de `fin_classificar` com
`"dominio": null` devolve a base ao estado de antes. Foi para isso que o carimbo
existe.

---

## 8. O que continua aberto

| # | Item | Nota |
|---|---|---|
| 1 | Os R$ 630 do Rodrigo | Secao 4. Uma palavra do dono resolve |
| 2 | Os R$ 1.300,67 de gateway em `pessoal` | Secao 6. Comando pronto |
| 3 | O dono NUNCA ABRIU A ABA depois disso tudo | A base foi de 18,55% a 99,86% em um dia, e ele nao viu a tela uma vez. Continua sendo o primeiro movimento |
| 4 | 4 linhas `ESTRELA MAR` / `MAR ESTRELA` com `moradia` e sem dominio | Herdado do v13. **Nota: agora foram varridas para `pessoal`**, entao a duvida deixou de travar cobertura mas continua sendo grafia dupla da mesma loja |
| 5 | 3 linhas `Aplicação RDB` rotuladas `resgate` | Cosmetico, herdado do v13 |
| 6 | Escrita de volta no Notion | Bloqueio antigo do v33, capability "Update content" |

---

## 9. Primeiro movimento do proximo chat

**Abrir a aba Financeiro e olhar.** Nao ha mais desculpa de base incompleta: os nove
meses passam no F3, entao a tela finalmente mostra NUMERO em vez da faixa de recusa.
Isso nunca foi visto por ninguem.

Depois, decidir os dois itens da secao 8 (Rodrigo e gateways), que juntos valem
R$ 1.930,67 e nenhum ponto de portao.

**So entao a semana 3 do `PLANO.md`** (Visao Pessoal, graficos, Agente 1).
