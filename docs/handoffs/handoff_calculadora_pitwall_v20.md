# Handoff calculadora Pit Wall v20 — capacidade sem GB e o preco que vem embaixo (sessao interrompida)

14/09/2026, madrugada. Substitui o v19 como topo da linha. **Sessao encerrada a pedido do dono no meio
da aplicacao: conferir o estado do banco antes de qualquer coisa (secao 4).**

Linguagem: prosa sem acento, sem cedilha, sem travessao.

## 1. O pedido

> "a leitura ta se perdendo por nao identificar valor de telefone quando ele vem abaixo"

Medido na carga `6c4d3491` (a lista de 17/08 lida de novo com o v19; rascunho, 804 lidas, casou 395,
73 perguntas, 1 resposta anotada: `🇺🇸 APARELHOS SEMINOVOS🇺🇸` -> Junior).

## 2. Os defeitos e o conserto (`supabase/migrations/20260914_calc_capacidade_sem_gb.sql`)

| # | Defeito medido | Conserto |
|---|---|---|
| 1 | 64 cabecalhos escrevem a capacidade sem GB (`📱*13 128 eSIM...`, `📲IPHONE 16 PRO MAX 512🩶`, `iPad 11 128`): o modelo nao casava e o preco da linha de baixo caia na pergunta `💰` | `calc_capacidade`: 64/128/256/512 logo depois de 11-17(e), air, pro, max, plus, mini, xr, xs, se |
| 2 | o `128`/`512` do cabecalho era lido como PRECO (`abaixo da tabela: ... R$ 512`) | `calc_preco` ignora esse numero |
| 3 | `...CPO 1 ano de garantia Apple` nao ganhava o token iphone (`apple` contava como familia) | `apple` sai da lista de familias; `pencil` entra |
| 4 | com o iPad reconhecido, `⌚️Apple Watch s11 46` (sem mm) nao abria bloco: R$ 2.400 e R$ 1.900 dos relogios entrariam como iPad 11 128GB | linha com palavra de familia (watch, airpods, airtag, ipad, macbook, imac, pencil, garmin, jbl) E numero abre bloco de modelo; o tamanho 38-49 em linha de watch nao e preco |
| 5 | cor entre dois precos desempatava para cima: `rosa/azul/R$2700/Silver/R$2750` dava Silver 2700; `Silver/Azul/R$9350/Laranja/R$9250` dava Laranja 9350 | desempate para o lado em que o bloco poe o preco |
| 6 | `GARMIN FORERUNNER 55` virava R$ 55: o R$ 1.049,99 dele entrava como Apple Watch SE 2 44mm Branco (**ja estava no ar**) | numero depois de forerunner/fenix/vivoactive/venu/instinct/epix nao e preco |

**Pre-prova na lista real, tres pedacos, nada gravado (versao final):**

| Pedaco | casou | perguntas | o que mudou |
|---|---|---|---|
| 1-1052 | 183 -> 222 | 43 -> 11 | Quality 41 -> 99, All imports 11 -> 14; nada saiu nem mudou |
| 1053-1981 | 149 -> 151 | 15 -> 10 | Garmins com preco certo; sai o Apple Watch SE 2 Branco 1.049,99 errado; 5 perguntas falsas somem |
| 1982-fim | 63 -> 101 | 18 -> 33 | Cristiano lacrados +56, iPad 11 128GB (Silver 2750); Laranja 9350 -> 9250 (confere com a lista); relogios viram perguntas proprias |
| **total** | **395 -> 474** | 76 -> 54 | nenhum preco novo abaixo de 70% do menor de outro fornecedor |

Sobram: iPhone 16e e 17e (nao estao no catalogo, o dono cria), Apple Watch SE `3ª geração`/sem mm,
MacBook Neo, relogios do Cristiano sem mm (perguntas de modelo, sem preco errado).

## 3. Provas

Fonte `ferramentas/prova_calc_parse.sql`: secao S ganhou S9 a S12 (capacidade sem GB, cabecalho sem GB com
preco embaixo, relogio sob iPad, Silver 2750 e Garmin 55). Gerados: leitor **77**, laco 39, catalogo 26
escritas = **142**. **NAO rodadas** depois da migration (a sessao parou antes).

## 4. Estado ao encerrar (conferir primeiro)

- **Migration APLICADA pelo `base`** (o relatorio chegou no fechamento): version `20260914040902`
  (`calc_capacidade_sem_gb`). md5 novos: `calc_capacidade` `a11222eebccbab5ccfaef5fe01f75505`,
  `calc_preco` `abeb6971f8aa5c64cd218af901008a69`, `calc_parse_v2` `6c551adcff374a69248e8716c40698ae`.
  ACL `{postgres=X/postgres}` nos tres, sem sobrecarga, fumacas certas (`|128`, 512 nao e preco, 2500,
  Garmin 55 e watch 46 nao sao preco; `📱*13 128 ... lacrado` + `💰3.199,00` -> iPhone 13 128GB Lacrado
  3199). Advisors 11, nenhum novo.
- **Primeira coisa da proxima sessao:** rodar as tres provas geradas (uma chamada cada, enxutas) e esperar
  77/39/29 = 145 em execucao (a contagem escrita e 142; o catalogo executa 29 por causa do laco L).
- Carga `6c4d3491` do dono em rascunho com 1 anotada. Depois de aplicado, o dono clica "Reler a lista com 1
  resposta" (a releitura usa o leitor novo) ou descarta e le de novo.
- Commits: os do v19 ja foram para o GitHub por outra sessao (merge `31dbc17`). Este v20 fica em commit local.
- Preview: `http://localhost:8788/calc/alimentar/` cai por falta de memoria quando roda pelo Claude Code;
  rodar o servidor node num terminal do dono (comando na memoria `preview-local-antes-do-deploy`).
