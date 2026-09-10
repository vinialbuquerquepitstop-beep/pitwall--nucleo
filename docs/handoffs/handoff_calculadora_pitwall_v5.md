# Handoff — Calculadora como produto, v5

Data: 10/09/2026. Linha `calculadora`. **Topo da linha.** Substitui o v4.

Escrito para uma sessao comecando **fria**. Tudo abaixo foi medido nesta sessao.

Nota de linguagem: prosa sem acento, sem cedilha, sem travessao. Valores reais do
sistema aparecem exatos.

---

## 0. Leia nesta ordem

1. `CLAUDE.md`.
2. `docs/calculadora/PROCESSO.md` — como conduzir um bloco desta linha.
3. Este arquivo.
4. O v4 so se precisar do detalhe das decisoes D1 a D7, resumidas aqui na secao 2.

---

## 1. O que esta sessao fez, em uma linha

**Mediu o parser contra lista real pela primeira vez, achou que ele cobria 0%, e
levou de 0% a 98,9% em cinco migrations.**

A secao 3 do v4 pedia a medicao. Ela reprovou a D7 de forma total, e o conserto
consumiu a sessao inteira. **A tela do Bloco 2 continua sem existir.**

---

## 2. A medicao, que e o que a D7 pedia

93 linhas com preco, duas listas reais de fornecedor de 09/09/2026
(ATACADO BR10 e MP IMPORTS).

| Trecho | Antes | Depois |
|---|---|---|
| BR10, primeira metade | 0 de 29 | **29 de 29 — 100,0%** |
| BR10, segunda metade | 0 de 36 | **35 de 36 — 97,2%** |
| MP IMPORTS | 0 de 28 | **28 de 28 — 100,0%** |
| **Somado** | **0 de 93** | **92 de 93 — 98,9%** |

**D7 paga.** A unica linha que nao casa e a cor `Blush` do MacBook Neo, que nao
existe no catalogo; o parser fez o certo, nao inventou hex e virou pendencia
nomeada.

**A lista NAO entrou no repo nem no banco.** A medicao chamou
`privado.calc_parse_v2` direto, e `calc_carga` / `calc_pendencia` seguem em **0**.
Restricao global 8 respeitada. As copias de trabalho ficaram no scratchpad da
sessao, fora do repo.

### Por que o parser cobria 0%

O v1 exige modelo E capacidade na MESMA linha do preco. As listas reais escrevem
em bloco:

```
🍎 iPhone 13 Pro – 128GB (CPO)     <- modelo aqui, SEM preco
🔒 Lacrado                          <- condicao aqui
⚪️ Branco - 💵 *R$ 3.150,00*        <- preco aqui, SEM modelo
```

Medido: das 136 linhas com preco das duas listas, **zero** traziam nome de
produto e **zero** traziam capacidade. O teto era zero, nao uma amostra ruim.

**As 18 fixtures sinteticas da fatia 1 casavam 11 de 11 porque foram escritas no
formato que o parser ja lia.** Fixture escrita por quem escreveu o parser prova o
parser contra si mesmo. Essa e a licao mais cara da sessao.

---

## 3. As cinco migrations, todas aplicadas e provadas

Todas por subagente `base`, unico com `apply_migration`. Todas versionadas.

| Migration | O que |
|---|---|
| `calc_parse_bloco_e_escala` | heranca de modelo do cabecalho; O(n2) -> linear; data deixa de virar preco |
| `calc_parse_bloco_completo` | `quebra` estreitado; cor ligada ao preco nu mais proximo; descarte herda do bloco |
| `calc_parse_dominio_e_qualificador` | qualificador entre parenteses; papel `modelo_desconhecido`; cor decorada nas cores soltas |
| `calc_parse_fornecedor_ate_o_proximo` | o papel `quebra` deixa de interromper o bloco (decisao do dono) |
| `calc_catalogo_apelidos_das_listas` | 12 apelidos x 2 escopos; `LACRADOS` no plural; o AirPods que sumia |

Commits: `9486f25` e `81554e7`.

### Escala, medida

| | v1 | v2 |
|---|---|---|
| 20 linhas | 6,8 s | 0,27 s |
| 40 linhas | 26,4 s | **0,48 s** |
| razao para o dobro | 3,87 (quadratico) | 1,78 (linear) |
| metade do BR10 | nao terminou em 258 s | 1,2 ms |

Causa do quadratico: `marc` fazia `select max(ln) from cab2` POR LINHA de `base`,
e as CTEs eram inlined pelo planner, entao `base` inteira era reexecutada a cada
linha. `materialized` resolveu. **O casamento de modelo nunca foi o custo**: 60
casamentos contra os 124 modelos levam 2 ms.

---

## 4. Decisoes do dono nesta sessao (nao perguntar de novo)

| # | Pergunta | Resposta | Quando |
|---|---|---|---|
| **D8** | Consertar o parser SQL ou antecipar o LLM do Bloco 5? | **Consertar o parser SQL** | 09/09 |
| **D9** | Escopo do conserto | **Os tres itens numa migration so** | 09/09 |
| **D10** | O papel `quebra` derrubou 25, 14 e 28 linhas em tres rodadas | **Trocar a regra**, nao remendar de novo | 09/09 |

D1 a D7 continuam valendo, do v4. Resumo do que mais importa:
`texto_bruto` FICA enquanto a carga e rascunho (D6); o portao de cobertura e
**comparacao pareada** contra o caminho de hoje, e o antigo `>= 89%` caiu porque
o 89% nunca teve medicao de origem (D7).

### D10 tem uma consequencia que e REQUISITO DA TELA, nao observacao

A regra antiga dizia "linha que eu nao reconheco = trocou de fornecedor". Toda
linha real que caia nela derrubava tudo abaixo:

```
'🟠laranja (eSIM)'          ->  25 linhas derrubadas
'🍎 iPhone Air  – 256GB'    ->  14 linhas derrubadas
'* ⁠anatel 🇧🇷'              ->  28 linhas derrubadas
```

Numa lista de WhatsApp, linha nao reconhecida e o caso COMUM. A regra nova: o
fornecedor vale do cabecalho DELE ate o proximo cabecalho de fornecedor
RECONHECIDO.

**A trava que saiu do parser tem que aparecer na tela.** Ela e real e estava
escrita com todas as letras no v1: preco de fornecedor nao identificado nao pode
herdar o fornecedor anterior, porque preco certo no fornecedor errado passa no
validador, passa no diff, e so aparece quando alguem compra pelo custo de outra
loja. O parser ja devolve `cabecalhos` com o que reconheceu. **A tela do Bloco 2
tem que mostrar os fornecedores detectados de forma dificil de ignorar**, senao a
defesa simplesmente nao existe em lugar nenhum.

Quem construir a tela e nao fizer isso reabre o buraco sem perceber.

### A trava que FICA, e nao se mexe

`modelo_desconhecido` ZERA o modelo herdado. Sem isso, os precos abaixo de um
cabecalho que o catalogo nao conhece herdariam o modelo do bloco ANTERIOR, e o
preco de um aparelho seria gravado no nome de outro. Pendencia e barata;
atribuicao errada, nao. Ha prova dedicada para isso (V4/V5 das rodadas 3 e 4).

---

## 5. As duas classes de falha do parser

Vale para todo o resto do plano.

**Cobertura baixa GRITA.** Vira pendencia, aparece na tela, o dono ve e ensina o
apelido ao catalogo. Barata.

**Perda silenciosa NAO faz barulho.** Achada nesta sessao ao revisar o catalogo:

```
'AirPods 4 - Sem cancelamento de ruído'  -> casava `AirPods 4`
'AirPods 4 - COM cancelamento de ruído'  -> casava `AirPods 4`   ERRADO
```

O catalogo tem `AirPods 4` e `AirPods 4 ANC` separados, mas a linha do ANC nao
diz a sigla `anc`, entao o multiconjunto de tokens casava o modelo sem ANC nos
dois casos. Os dois caiam no mesmo produto, sem cor, mesmo fornecedor, e
`min(preco)` ficava com R$ 850,00: **o ANC de R$ 1.250,00 sumia do blob sem virar
pendencia**. Nada na tela indicaria a falta.

**So a segunda classe merece prova dedicada.** Ninguem acha perda silenciosa
olhando a tela.

---

## 6. O proximo passo, e o que trava o que

| # | Item | Trava | Peso |
|---|---|---|---|
| 1 | **`prova_calc_parse.sql` ganhar os casos de bloco** | nada. Faca ANTES do resto | 1 sessao curta |
| 2 | **Promover o v2** (trocar o chamador em `calc_carga_abrir`) | a tela | pequeno |
| 3 | **A tela `Alimentar`** (Bloco 2, fatia 2) | o portao do bloco | o grosso |
| 4 | Modelos que faltam no catalogo | cobertura, nao funcionamento | decisao + insert |
| 5 | **D4a** — comissao de `Acessório` | passo 3.3, no Bloco 3 | decisao do dono |
| 6 | **JBL Boombox 4** entra ou nao | nada | decisao do dono |

### 1 vem primeiro, e o motivo e concreto

`ferramentas/prova_calc_parse.sql` prova o **v1**. Tudo o que esta sessao
construiu esta no v2 e **nao tem prova em suite nenhuma**. Pelo que o CLAUDE.md
ja registra: *"prova que nao esta em suite nenhuma nao roda de novo: provou uma
vez, virou arquivo morto, e a regressao volta calada."*

As 33 verificacoes desta sessao rodaram por prompt de subagente e morrem com ela.
Precisam virar arquivo. No minimo:
- os tres formatos (cor na linha, cor antes do preco, cor depois do preco);
- `caixa aberta` barrado;
- o domino (cabecalho sem apelido nao derruba o resto);
- **o iPhone Air nao herdar o modelo anterior** (a trava cara);
- **os dois AirPods saindo separados** (a perda silenciosa).

### 2 nao entrega nada sozinho

`calc_carga_abrir` chama o v1 hoje. Promover o v2 sem a tela nao muda nada para o
dono, porque a RPC nao tem quem a chame. Fazer junto com a fatia 2.

### 4, o que falta de verdade no catalogo

Medido nas duas listas: `iPhone 15 512GB`, `iPhone 15 Pro 1TB`, `iPhone 16
512GB`, `iPhone 16 Pro 512GB`, `Apple Watch Series 3` (40mm e 44mm), a cor
`Blush`, e o `JBL Boombox 4` (item 6). Sao 7 linhas de cobertura, nao defeito.

---

## 7. Estado vivo, medido em 10/09/2026

### Banco (projeto `unjzpyexgtbcmjfgcqrx`)

```sql
select
  (select count(*) from public.calc_modelo where tenant_id is null) as modelos_semente,
  (select count(*) from public.calc_cor    where tenant_id is null) as cores_semente,
  (select count(*) from public.calc_alias  where tenant_id is null) as aliases_semente,
  (select count(*) from public.calc_regra  where tenant_id is null) as regras_semente,
  (select count(*) from public.calc_fornecedor) as fornecedores_tenant,
  (select count(*) from public.calc_carga) as cargas;
```

Esperado: **124, 32, 39, 20, 17, 0**. O `39` de aliases da semente e novo: eram
27, mais os 12 apelidos desta sessao.

Duas funcoes de parser convivem, de proposito:
- `privado.calc_parse` — o v1, **e quem `calc_carga_abrir` chama em producao**;
- `privado.calc_parse_v2` — o desta sessao, sem consumidor ainda.

Advisors de seguranca: **7 achados**, os mesmos declarados no v4, todos
esperados. Os quatro `calc_*` sao `SECURITY DEFINER` com barreira de papel no
CORPO. **Nao sao regressao. Quem "consertar" tirando o GRANT quebra a tela.**

### Repo

Commits desta sessao: `9486f25`, `81554e7`.
**O remote e `github`; o `origin` e proxy morto.** Push: `git push github HEAD:main`.
`git add -A` esta **mecanicamente negado**. Sempre `git add <caminho>`.

---

## 8. Armadilhas medidas nesta sessao

**`_` e curinga no LIKE.** `like '%modelo_desconhecido%'` casou a frase `modelo
desconhecido` (com ESPACO) num comentario antigo, e uma verificacao de
contaminacao deu falso positivo. Para procurar token com underscore:
`position('x_y' in prosrc) > 0`, ou escapar. O subagente `base` pegou isso
sozinho e desfez a suspeita com a checagem literal em vez de parar ou aceitar.

**CTE referenciada varias vezes e reexecutada.** `with p as (select f(...))`
usada em 9 colunas do `select` chamou `f` nove vezes e deu timeout. Ou
`materialized`, ou subquery no `FROM`.

**A conexao MCP entra como `postgres`, sem JWT.** `fn_tenant_atual()` e
`fn_papel_atual()` devolvem null, entao **toda RPC com barreira de papel levanta
excecao por aqui**. O procedimento do v4 mandava chamar `calc_carga_abrir` direto
e nao rodaria. Para medir parser, chame `privado.calc_parse*` direto: e o mesmo
motor, nao grava nada e nao precisa de papel.

**As colunas de `calc_carga` tem prefixo `n_`.** O v4 mandava consultar
`lidas, casou, duvidoso, nao_reconhecido, descarte`; os nomes reais sao
`n_lidas, n_casou, n_duvidoso, n_descarte, n_pendencia`, e `nao_reconhecido` nao
e coluna, so existe no JSON como `n_nao_reconhecido`.

**Linha descartada nao entra no denominador.** `prod` filtra `descarte is null`
antes de contar, entao um bloco de caixa aberta devolve `n_lidas` menor. Isso e
correto e ja mordeu uma expectativa escrita nesta sessao.

---

## 9. O que continua verdade do v4

- Nao construir superficie de SaaS antes do primeiro pagamento (invariante 17).
- Nao commitar export de fornecedor, nem como corpus de teste (restricao 8).
- Nao criar FK de `calc_*` para tabela de operacao.
- Nao deixar linha nao entendida virar preco.
- A migration `calc_catalogo_tenant_pitstop` segue **NAO versionada** de
  proposito: carrega os 17 fornecedores com praca, e a restricao 8 proibe dado
  comercial no repo. Motivo e recuperacao em
  `supabase/migrations/20260908_calc_catalogo_tenant_pitstop.NAO-VERSIONADA.md`.
- **O portao do Bloco 2 nao e tecnico:** o dono roda a carga do mes pela tela,
  sozinho, sem Claude Code. Isso continua sem acontecer, porque a tela nao existe.
