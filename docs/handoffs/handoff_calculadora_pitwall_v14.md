# Handoff calculadora Pit Wall v14 — a prova partida em tres

12/09/2026. Substitui o `handoff_calculadora_pitwall_v13.md` como topo da linha. O
v13 continua valendo para tudo que nao e o corte da prova: a D18, a D19, a secao 8
(o que nao foi provado) e a tabela de proximos passos da secao 9.

Linguagem: prosa sem acento, sem cedilha, sem travessao (convencao do `CLAUDE.md`).

---

## 1. Arranque: ler nesta ordem

1. `CLAUDE.md` (o bloco "Provas de BANCO" mudou nesta sessao).
2. `docs/calculadora/PROCESSO.md`.
3. O v13, secoes 8 e 9, e a D19 do plano.
4. Este arquivo. **A proxima sessao e a tela `Alimentar`** (secao 7).

---

## 2. O que esta fatia entregou

A prova de banco da calculadora deixou de ser um bloco de 78 KB que o transporte do
MCP trava, e virou TRES blocos gerados por script a partir da mesma fonte.

| Arquivo | Secoes | Fixtures | Assercoes (rodada) | Enxuto |
|---|---|---|---|---|
| `ferramentas/prova_calc_leitor.sql`   | H, A, B, E, F | A, B, C    | **55** | 24805 |
| `ferramentas/prova_calc_laco.sql`     | G, Z, R       | A, B, C, D | **34** | 32144 |
| `ferramentas/prova_calc_catalogo.sql` | K, L          | C, E, F    | **24** | 27502 |
| soma | | | **113** | |

A fonte continua `ferramentas/prova_calc_parse.sql`, agora com a frase "NAO RODAR
POR MCP" no topo e marcadores `-- @@...`. O gerador e
`ferramentas/gera_provas_calc.py`.

```
python ferramentas/gera_provas_calc.py
python ferramentas/enxuga_sql.py ferramentas/prova_calc_laco.sql <saida.sql>
```

A catalogo tem 21 `v_total := v_total + 1` escritos e roda 24, porque a L13 a L17 e
um laco de quatro voltas. O gerador conta o ESCRITO (110 na fonte) e cobra a soma;
o numero que vale e o da mensagem.

---

## 3. Criterio de aceite (10.5 do v13), um por um

1. **EXIT 0 do `enxuga_sql.py` nos tres.** Cumprido: 24,8 / 32,1 / 27,5 KB, contra
   78,4 KB e EXIT 2 da fonte. Folga de ~2x para o limite seguro (66560).
2. **PASSOU nos tres, soma 113, 0 falhas.** Cumprido, uma tentativa cada, nenhuma
   travou no transporte. Mensagens verbatim:
   ```
   PASSOU: 55 assercoes, 0 falhas (prova_calc_leitor)
     fixture A (formato linha), v2: lidas=18 casou=13 duvidoso=4 nao_reconhecido=1 descarte=2 cobertura=72.2%
     fixture B (formato bloco), v2: lidas=12 casou=11 duvidoso=0 nao_reconhecido=1 cobertura=91.7%
     fixture B (formato bloco), v1: casou=0 de 12 (o v1 nao le bloco, por desenho)
     fixture C (dia 1), v2: lidas=4 casou=0 pendencias=condicao "junior", fornecedor "TABELA XPTO IMPORTS"

   PASSOU: 34 assercoes, 0 falhas (prova_calc_laco)
     fixture D (condicao), v2: lidas=16 casou=11 perguntas de condicao=5
     resolver: 6 respostas aceitas (todas ensinaram), 15 recusadas com motivo declarado, 0 aceitas caladas
     respostas de condicao (D14): fixture C casou 0 -> 2 com "junior" = Lacrado; fixture D 11 -> 16 de 16 com as 5 respondidas

   PASSOU: 24 assercoes, 0 falhas (prova_calc_catalogo)
     fixture E (dia 1, criar), v2: lidas=5 casou=0 pendencias=5
     verbo criar (2.4a): XPTO = 1 fornecedor + 3 apelidos num clique; MP Distribuidora recusado por quase-igual ao MP Imports; JBL Flip 7 so entra com a categoria; tudo com origem=aprendizado
     D17 (a): criar o 1o fornecedor da fixture E fica em casou 1 (era 4): ...
     D18: descartar fornecedor tira o BLOCO nas quatro formas de cabecalho ...
   ```
3. **As linhas de sumario, juntas, dizem o que o v13 dizia.** Cumprido, numero por
   numero contra a secao 7 do v13 (incluindo `6 aceitas / 15 recusadas`).
4. **Producao intacta depois de CADA rodada.** Cumprido, medido antes e depois das
   tres: 0 cargas, 0 pendencias, 0 linhas `origem = 'aprendizado'` nas cinco
   tabelas, 0 `so_na_semente_prova`, e 0 dos quatro padroes ancorados que as provas
   gravam.
5. **Gerador deterministico.** Cumprido: duas rodadas seguidas, os tres md5
   identicos.

Nenhuma migration. As rodadas foram feitas pela Torre, nao pela `bandeira`
(PROCESSO 4.2): repassar 85 KB de SQL por um subagente custava mais e dobrava a
exposicao ao transporte instavel.

---

## 4. As duas mudancas na fonte que nao sao marcador

**4.1 A L19 abre a propria carga** (a unica assercao alterada, como a 10.3 previa).
Lia a carga da secao G; agora abre a lista de duas linhas medida em 12/09
(`Junior recreio` / `iPhone 16 128GB Preto Lacrado - 4.100 a vista`) e procura a
pergunta de `preco` nela. Passou na primeira rodada. A guarda do gerador pegou
esse acoplamento ANTES da mudanca (`RECUSADO: prova_calc_catalogo.sql le variavel
que ele nao atribui: v_cargas`), e so ele.

**4.2 O `set_config` da identidade do dono saiu da secao G** para um bloco
`-- @@comum rpc`. **Esta dependencia nao estava na tabela 10.2 do v13**, e nao
podia estar: ela nao e variavel, e o `mede_corte_prova.py` so mede variavel. A K e a
L chamam RPC com `set local role authenticated` e so tinham identidade porque a G
tinha rodado antes. Separado da G, o catalogo rodaria como ninguem. O gerador poe o
bloco em todo arquivo que troca de papel (o leitor nao troca, e nao leva).

Licao: **medida por variavel nao ve estado de sessao** (GUC, `set role`, tabela
temporaria). Ao partir bloco de prova, procurar tambem `set_config` e `set local`.

---

## 5. As guardas do gerador

Recusa (EXIT 1, nada escrito) quando:
- arquivo gerado LE variavel que nao atribui. **O default do `declare` nao conta**,
  fora `v_tenant`, `v_dono`, `v_total`, `v_falhas`, `v_log`: o `v_cargas` nasce
  `'{}'`, e contar isso deixaria a L19 verde lendo cargas que nao existem;
- secao, fixture ou linha de relatorio fica sem arquivo ou em dois;
- a soma das assercoes escritas difere da fonte;
- o enxuto de algum nao sai com EXIT 0.

A leitura de variavel tira comentario E conteudo de string antes do regex (o
`v_cats\s+text` dentro do regex da K10 seria falso positivo). Limite declarado: e
regex, nao parser de plpgsql; a guarda de verdade e rodar e somar.

---

## 6. O que NAO foi provado

- A fonte monolitica nao foi rodada de novo depois das duas mudancas da secao 4.
  Ela nao roda por MCP de proposito; pelo SQL Editor deveria dar os mesmos 113.
- Tudo da secao 8 do v13 segue aberto (isolamento vendedor/tenant, lista real,
  grafia do fornecedor descartado).
- Suite de frontend: nada em `public/` mudou.

---

## 7. O proximo passo

A tabela da secao 9 do v13, com o item 1 fechado. **Proximo: a tela `Alimentar`,
com o "ver o que aprendeu" dentro dela (D19)** e as quatro obrigacoes (as tres da
secao 6 do v12 e a da grafia, secao 9 do v13).

Regra nova para ela: **toda mudanca de `calc_*` roda as TRES provas geradas**, nao
a fonte. Mudou assercao, muda na FONTE e regera; nunca editar um gerado.

Prompt para abrir a sessao:

```
Comecar a tela Alimentar (item 2 da secao 9 do
docs/handoffs/handoff_calculadora_pitwall_v13.md, com a D19 do plano).
Seguir o docs/calculadora/PROCESSO.md. Ler o v14 antes: a prova de banco
agora sao tres arquivos gerados (ferramentas/gera_provas_calc.py), e toda
mudanca de calc_* roda os tres, somando 113.
```
