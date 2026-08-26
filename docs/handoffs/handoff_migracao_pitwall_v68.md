# Handoff v68 — 26/08/2026

Substitui todos os anteriores da linha migracao. Sessao de RETOMADA e FECHAMENTO,
disparada por uma frase do dono: **"retorne o processo de financas, app caiu"**.

O app caiu no meio da Fatia 2 do modulo Financeiro. Nada foi reconstruido de cabeca:
o estado foi remedido no disco, no git e no banco vivo antes de qualquer decisao.
**Entrou a Fatia 2: regras de classificacao automatica, 6 migrations e a quarta
sub-view da aba.**

---

## 0. Para quem chega agora, em dez linhas

1. A Fatia 1 ja estava no ar. `78be994` esta em `origin/main` (0/0 contra o local),
   entao a Cloudflare publicou. Duas afirmacoes do v67 morreram aqui.
2. **O dono importou um extrato REAL**: 1 importacao, `181 lidas, 181 novas, 0
   duplicadas`, em 26/08/2026 10:14 (BRT). Janela dos lancamentos: 28/07 a 26/08.
3. **Os 181 estavam 100% sem classificar** (181 sem categoria, 180 sem dominio). Pelo
   invariante 18, a tela mostrava o extrato inteiro na faixa de nao classificado e
   todo total abaixo dela em zero.
4. A Fatia 2 nasceu 12 minutos depois dessa importacao. **As regras foram desenhadas
   contra o extrato de verdade**, nao contra fixture imaginado. Secao 3.
5. Banco: 1 tabela (`fin_regra`), 3 helpers privadas, 5 RPCs, 1 motor unico de
   aplicacao, e o `fin_importar_extrato` reescrito para classificar na entrada.
6. Tela: quarto chip `Regras` na aba `Financeiro`, e o formulario abre DENTRO da
   linha do movimento. Regra nasce de um lancamento real, nunca do nada.
7. **885 assercoes, 0 falhas** (piso 829 da v67; +56, todas `fin2:`). Os 6 comandos e
   as 5 larguras em EXIT 0, rodados pela Torre na retomada, nao lidos de relatorio.
8. Isolamento provado na retomada, nao so lido: Brendon (vendedor) ve **0 linhas** em
   `fin_regra` e em `fin_movimento`, e leva `Financeiro e restrito ao dono.` nas 5 RPCs.
9. Commitado e publicado nesta sessao, com autorizacao explicita do dono.
10. **`fin_regra` tem 0 linhas.** O motor esta pronto e nenhuma regra existe ainda:
    a primeira sai da mao do dono, por decisao de desenho. Secao 8.

---

## 1. O que o arranque encontrou, e onde o v67 mentia

O v67 fechou com "Nada foi commitado e nada foi publicado" e "a base financeira tem
ZERO movimentos". As duas linhas estavam vencidas quando esta sessao abriu:

| O que o v67 dizia | O que o git e o banco diziam |
|---|---|
| nada commitado, nada publicado | `78be994` em `origin/main`, Fatia 1 no ar |
| base com ZERO movimentos | **181 movimentos**, soma -R$ 29,06 |
| nenhum OFX real testado | **1 OFX real importado**, 181/181 novas, 0 duplicadas |

**A ressalva numero 1 do v67 foi fechada pelo dono, nao por codigo.** Ele baixou o
extrato, arrastou na aba e confirmou a previa. O parser de OFX e o hash com
ocorrencia sobreviveram ao primeiro contato com arquivo de banco de verdade.

Licao para o proximo que abrir handoff: **conferir git e banco antes de citar
qualquer linha de "estado atual".** Este projeto ja errou isso em todo documento que
tentou fixar uma versao.

---

## 2. A Fatia 2 no banco (6 migrations, todas aplicadas)

| Versao | Nome | O que faz |
|---|---|---|
| `20260826132629` | `fin_fatia2_regra_schema` | `fn_fin_norm`, `fn_fin_esc`, `fn_fin_casa`, tabela `fin_regra`, 1 indice unico + 2 de leitura, 3 policies dono-only, grants minimos |
| `20260826132648` | `fin_fatia2_aplicar_helper` | `privado.fn_fin_aplicar_regras`, o motor unico |
| `20260826132815` | `fin_fatia2_rpcs_regra` | `fin_regra_prever`, `fin_regra_salvar` |
| `20260826132924` | `fin_fatia2_rpcs_aplicar_sugerir_listar` | `fin_regra_aplicar`, `fin_regra_sugerir`, `fin_regras` |
| `20260826133005` | `fin_fatia2_importar_aplica_regras` | `fin_importar_extrato` aplica as regras na entrada |
| `20260826133336` | `fin_fatia2_helpers_search_path` | fecha o `function_search_path_mutable` das 3 helpers |

Versionadas em `supabase/migrations/20260826_fin_fatia2_*.sql`.

### A tabela

`fin_regra`: `padrao` (nao vazio), `tipo_match` em `contem` / `comeca` / `exato`,
`categoria_codigo`, `dominio` em `empresa` / `pessoal`, `prioridade`, `origem` em
`manual` / `aprendida`, `ativo`, `aplicada_n`, `arquivado_em`.

Duas travas que valem registro:

- `constraint fin_regra_classifica_algo check (categoria_codigo is not null or dominio
  is not null)`. **Regra que nao classifica nada nao existe**: o banco recusa.
- `create unique index fin_regra_padrao_uniq` sobre a forma NORMALIZADA do padrao.
  Duas regras para o mesmo texto com acento diferente nao coexistem.

### Sem `unaccent`, de proposito

A extensao `unaccent` **nao esta instalada** neste projeto (`installed_version` nulo),
e a instrucao permanente e nao instalar extensao sem avisar. `fn_fin_norm` faz o
servico com `upper(translate(...))`, e `IMMUTABLE` (por isso serve dentro do indice
unico) e nao depende de extensao nenhuma.

Reverter para casamento sensivel a acento = trocar o corpo por `upper(t)`. Uma linha.

### As 5 RPCs

- `fin_regras()` — lista com `casaria_hoje` por regra e o contador de quantos ela ja
  classificou. **Nao filtra por `ativo`**: filtrar esconderia a regra pausada e ela
  ficaria orfa na tela, viva e invisivel.
- `fin_regra_prever(payload)` — o efeito ANTES de gravar. Aceita `{id}` sozinho e
  herda da regra existente tudo que a chave nao trouxer.
- `fin_regra_salvar(payload)` — cria (sem id) ou edita (com id). Convencao da Fatia 1
  mantida: **o que manda e a PRESENCA da chave**; chave ausente nao mexe, chave com
  `null` LIMPA. `arquivar: true` faz soft delete, **nunca DELETE**.
- `fin_regra_sugerir(payload)` — `{movimento_id}`. Extrai o nome da contraparte.
- `fin_regra_aplicar(payload)` — `{ids}` ausente = todas as ativas; `alcance` default
  `nao_classificados`, e `todos` sobrescreve.

### As recusas nomeadas (o que o dono vai ler na tela)

`Informe o padrao a casar.` · `Tipo de casamento invalido: use contem, comeca ou
exato.` · `Dominio invalido: use empresa ou pessoal.` · `Categoria inexistente ou
desativada: <codigo>` · `Prioridade fora da faixa: use de 0 a 9999.` · `Regra
arquivada: crie uma nova em vez de editar esta.` · `Financeiro e restrito ao dono.`

E a que importa mais:

> `Padrao generico demais: "UBER" casa 4 de 12 lancamentos (33.3%). Uma regra assim
> classifica quase tudo igual...`

**Padrao que casa mais de 60% da base e recusado com o numero na cara**, e o dono
pode passar por cima com `forcar: true`. A tela nunca forca sozinha.

### Convencao de chave de erro (nao e bug, e mapa)

Leitura devolve `{ok:false, msg:...}`; escrita devolve `{ok:false, erro:...}`. Vale
tambem na Fatia 1 (11 `msg` na leitura, 39 `erro` na escrita). `fin_regras` segue
`msg`, `fin_regra_prever` segue `erro` mesmo sendo `stable`. A tela le a chave certa
em cada caso. Quem for mexer, conferir antes de assumir.

---

## 3. As decisoes de desenho que valem mais que o codigo

1. **A regra nasce de um lancamento real, nunca de um formulario vazio.** A sub-view
   `Regras` vazia nao mostra "criar regra": ela ENSINA que se comeca pela linha do
   movimento. O caminho manual existe para quando o servidor nao consegue extrair o
   nome, e e a excecao.
2. **O extrator pega o segmento imediatamente ANTES do CPF/CNPJ.** Foi o extrato real
   que ditou isso. Em `Estorno - Transferencia enviada pelo Pix - NOME - CNPJ`, pegar
   o segundo segmento devolveria `Transferencia enviada pelo Pix` e **a regra casaria
   metade do extrato**. Sem CPF/CNPJ cai no segundo segmento (`Compra no debito -
   MUDAVENDING`); sem ` - ` nenhum, na descricao sem digitos.
3. **`fin_regra_sugerir` NAO sugere categoria nem dominio.** Ele entrega o padrao e
   para. Inferir dominio seria adivinhar se o Uber foi da loja ou pessoal, e e
   exatamente isso que o invariante 18 proibe.
4. **Alcance default e `nao_classificados`.** Sobrescrever trabalho manual exige
   confirmacao explicita, e a confirmacao **diz o numero**: `Reaplicar por cima muda 1
   lançamento que você já classificou.` O botao carrega o numero (`Sobrescrever os 1`),
   nunca um sim generico. Depois de rodar, a tela DECLARA que sobrescreveu.
5. **Previa obrigatoria, e ela expira.** O botao de gravar nasce trancado; destranca
   com previa fresca; **mexer na regra depois da previa tranca de novo.** Mesmo
   principio da previa da importacao.
6. **Motor unico.** `privado.fn_fin_aplicar_regras` serve `fin_regra_aplicar` E
   `fin_importar_extrato`. Duas implementacoes divergiriam, e o dia em que divergissem
   a importacao classificaria diferente do botao.
7. **Empate e resolvido e contado.** Menor prioridade ganha; depois padrao mais LONGO;
   depois `criado_em` mais recente. O numero de linhas que casaram mais de uma regra
   volta como `conflitos` e **aparece na tela**, em `--morno`, nunca em `--erro`:
   conflito e estado a resolver, nao falha de sistema.
8. **Nunca DELETE.** Pausar (`ativo: false`) deixa a regra visivel e marcada; arquivar
   e soft delete. Regra pausada nao oferece aplicar nem reaplicar.

---

## 4. A tela

Quarto chip na aba `Financeiro`: `Visão · Movimentos · Importar · Regras`.

- Toda linha de movimento oferece criar regra, e o formulario **abre dentro da linha**,
  sem tirar o dono do contexto.
- O achado mostra o padrao extraido e **quantos outros lancamentos ele pega**.
- O formulario nasce sem categoria e sem dominio escolhidos (invariante 18 de novo).
- A previa diz quantos pega, quantos classifica, quantos MUDAM de destino, **declara a
  base contra a qual mediu** e mostra as descricoes REAIS que casam.
- Depois de gravar, a tela oferece aplicar agora com o numero. `casaria_hoje` zera
  depois da aplicacao, e o contador de classificados vem do servidor.
- Aplicar todas manda payload VAZIO. **Em momento nenhum a tela envia uma lista de ids
  vazia**, que o servidor leria como "nenhuma regra" e viraria no-op silencioso.
- Toda linha de regra carrega ICONE (trilho sem icone e regressao).
- A importacao passa a dizer quantos lancamentos ja nasceram classificados e **por qual
  regra**.

Zero token de cor novo. `--morno` para estado (pausada, conflito, sinal contrario),
`--erro` so para falha de verdade.

---

## 5. Estado da suite (rodado na retomada, EXIT CODE conferido)

```
validar.py 0 · harness.py 0 (885 passou, 0 falhou) · prova_trilho 0
prova_grafico 0 · prova_atmosfera 0 · node --check 0
diag_mobile 360 0 · 390 0 · 414 0 · 1280 0 · 1440 0
```

885 contra o piso 829 da v67: **+56 assercoes, todas do bloco `fin2:`**.

---

## 6. Prova de banco na retomada

| Cenario | Medido |
|---|---|
| RLS, vendedor Brendon | `fin_regra` = **0 linhas**, `fin_movimento` = **0 linhas** |
| As 5 RPCs como vendedor | as 5 recusam: `Financeiro e restrito ao dono.` |
| Grants | zero para `anon`, zero para `PUBLIC`, zero DELETE/TRUNCATE em `authenticated` |
| EXECUTE publico nas RPCs de regra | **nenhum** |
| `search_path` | fixo em todas; as 3 helpers de casamento com `search_path` VAZIO |
| RLS na `fin_regra` | ligada, 3 policies (`sel`, `ins`, `upd`), todas com `papel = 'dono'` |

O `get_advisors` tinha acusado `function_search_path_mutable` nas 3 helpers durante a
construcao, e foi fechado na migration `20260826133336`. O `REPLACE` preservou a
assinatura de `fn_fin_norm` de proposito: o indice unico depende dela.

---

## 7. O que ficou aberto

**Novo desta fatia:**

1. **`fin_regra` tem 0 linhas.** O motor foi provado contra fixture e contra o formato
   real das descricoes, mas **nenhuma regra existe no banco do dono**. Ate ele criar a
   primeira, a Fatia 2 e capacidade, nao resultado.
2. **A aplicacao em massa nunca rodou sobre os 181 reais.** Rodou sobre fixture. O
   primeiro `fin_regra_aplicar` de verdade e o do dono.

**Herdado do v67 e ainda valido:**

3. **O saldo do extrato e guardado e nunca conferido.** `LEDGERBAL` vira
   `saldo_final_informado` e nenhuma RPC compara com a soma dos movimentos. **E a
   conferencia que pega importacao incompleta.** Agora que existe extrato real, isso
   deixou de ser hipotetico. Barato de fechar, e deveria ser o proximo item de banco.
4. **Categoria que zerou some da secao.** Parar de gastar tambem e um fato.
5. **Upload no bucket `extrato` nao foi exercido ponta a ponta.**
6. **Canal externo de alerta sem decisao** (Fatia 6). A Cloud API do WhatsApp exige
   numero dedicado que sai do celular, e nao pode ser o numero de venda. Recomendacao
   segue sendo PWA push.
7. **Fatias 3 a 6 nao comecaram**: teto e alerta, metas e provisao, conciliacao venda x
   caixa, canal externo.
8. `docs/superpowers/plans/2026-08-19-segundo-lojista-tenant.md` segue **sem commit**
   (38 tarefas, nenhuma executada); `permite_esfriar` e config morta em 4 dos 6
   perfis; `LEAD-0019` e `LEAD-0028` com `origem` nula; `LEAD-0007` e `LEAD-0008` sem
   telefone; a escrita de volta no Notion segue bloqueada pela capability
   "Update content".

---

## 8. A proxima acao do dono, com o caminho exato

Abrir o Pit Wall, aba `Financeiro`, chip `Movimentos`. Achar uma linha de UBER DO
BRASIL e clicar em criar regra. O extrator devolve o nome da contraparte, a previa diz
quantos pega, e ai vem a decisao que so ele toma: **esse Uber e da loja ou e pessoal.**

Os agrupamentos que o extrato real oferece hoje, os seis maiores:

| Padrao | n | Soma |
|---|---|---|
| UBER DO BRASIL (Pix enviado) | 22 | -R$ 624,95 |
| COMPRA NO DEBITO - MUDAVENDING | 19 | -R$ 518,08 |
| UBER (reembolso recebido) | 5 | +R$ 131,02 |
| RESGATE RDB | 4 | +R$ 4.550,00 |
| APLICACAO RDB | 3 | -R$ 4.558,00 |
| BR IPHONES IMPORTACAO (recebido) | 3 | +R$ 7.775,00 |

Uber e MUDAVENDING sozinhos sao **41 dos 181**. RDB entra em `Neutro` e sai de todo
total de gasto, senao aplicar R$ 4.558 vira o maior "gasto" do mes. BR IPHONES e a
unica linha claramente da loja no topo.

---

## 9. A ressalva de sempre, atualizada

O v67 dizia que todo numero da tela era estado vazio. **Nao e mais.** Ha um mes de
extrato real la dentro, com 181 lancamentos e uma soma liquida de -R$ 29,06.

O que ainda nao existe e **julgamento**: 181 lancamentos sem uma unica classificacao.
A Fatia 2 nao resolve isso sozinha, ela so faz o trabalho render. Classificar o
primeiro Uber classifica 22.
