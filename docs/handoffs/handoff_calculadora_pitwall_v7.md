# Handoff — Calculadora como produto, v7

Data: 10/09/2026. Linha `calculadora`. **Topo da linha.** Substitui o v6.

Escrito para uma sessao comecando **fria**. Tudo abaixo foi medido nesta sessao.

Nota de linguagem: prosa sem acento, sem cedilha, sem travessao. Valores reais do
sistema aparecem exatos.

---

## 0. Leia nesta ordem

1. `CLAUDE.md`.
2. `docs/calculadora/PROCESSO.md`.
3. Este arquivo.
4. O v6 so para o detalhe das decisoes D11, D12 e D13 (resumidas aqui na secao 6).

---

## 1. O que esta sessao fez, em uma linha

**Executou o item 1 da secao 5 do v6 (a prova cobrir o `calc_parse_v2`), e a
prova achou um preco errado que estava no ar sem ninguem ver.**

Commit: `b4c566d`. Dois arquivos:

| Arquivo | O que |
|---|---|
| `ferramentas/prova_calc_parse.sql` | duas fixtures x duas versoes, **71 assercoes, 0 falhas** |
| `supabase/migrations/20260910_calc_parse_cor_pareada.sql` | o conserto, aplicado pelo `base` |

---

## 2. O defeito, que e a parte que importa

O v6 listava "os tres formatos (cor na linha, cor antes do preco, cor depois do
preco)" entre o que a prova tinha que cobrir, **como se os tres funcionassem**.
Ao medir para escrever a assercao, o terceiro reprovou:

```
🟣 Roxo
💵 *R$ 4.480,00*
🟡 Gold
💵 *R$ 4.520,00*

antes:  Roxo = 4480 (certo)   Gold = 4480 (ERRADO)   o 4.520 virava orfa
depois: Roxo = 4480           Gold = 4520
```

**Causa.** `cor_assoc` escolhia o preco nu com
`order by abs(p.ln - cs.cor_ln), p.ln`. Uma cor entre dois precos empata em
distancia com os DOIS, e o `p.ln` desempatava para CIMA, ou seja, para o preco
que ja era da cor anterior.

**Por que passou tanto tempo.** No layout "cor DEPOIS do preco" o mesmo
desempate ACERTA. Metade dos casos dar certo foi o que segurou o defeito no ar, e
a medicao de 98,9% do v5 nao o pegaria nunca: ele nao derruba cobertura.

**Classe.** Pela tabela do v6 secao 4, e **preco errado**: a cobertura nao cai,
nenhuma pendencia nasce, o produto aparece na tela com cara de certo. Nada
denuncia. Foi a segunda vez em duas sessoes que **cobertura alta mascarou
defeito** (a primeira foi o emoji colado, que fechava 100% escondendo produto que
sumia).

### O conserto

Quando o bloco de modelo tem UMA cor solta para cada preco nu, a lista esta
escrita numa direcao so, e o pareamento por ORDEM (n-esima cor com n-esimo preco)
acerta os DOIS layouts. Contagens diferentes seguem no vizinho mais proximo,
byte a byte como antes: **a mudanca nao alarga o alcance**.

Entraram tres CTEs (`cor_rk`, `preco_rk`, `pareavel`) e o `cor_assoc` virou um
`coalesce` de duas estrategias. `dense_rank` e nao `row_number` de proposito: uma
mesma linha de cor pode casar mais de uma cor do catalogo e as duas tem que
receber o mesmo posto.

O formato "cor NA LINHA do preco" nao passa por aqui de jeito nenhum: linha de
preco que ja tem cor nao entra em `precos_nus`.

---

## 3. A prova, e por que ela cobre DUAS versoes

`ferramentas/prova_calc_parse.sql` provava so o v1. Agora roda as duas.

**O v1 NAO saiu da prova, e a razao nao e nostalgia:** ele e quem
`calc_carga_abrir` chama em producao, e as duas funcoes dividem os helpers
(`calc_limpar`, `calc_norm`, `calc_tokens`, `calc_preco`). Mexer num helper mexe
no caminho vivo — foi exatamente o que a mudanca do emoji do v6 fez. Quando o
chamador for trocado, a lista do laco perde o `calc_parse` e o bloco `-- v1` da
secao D some junto. Esta escrito no cabecalho do arquivo.

### Duas fixtures, porque cobrem coisas diferentes

| Fixture | Formato | v1 | v2 |
|---|---|---|---|
| A | linha (modelo, capacidade, cor e preco na MESMA linha) | 11 de 18 | 13 de 18 |
| B | BLOCO (modelo no cabecalho, preco em linha que nao repete o nome) | **0 de 12** | 11 de 12 |

**`fixture B, v1 = 0` e assercao, nao curiosidade.** E a medicao que justifica o
v2 existir, e ela vira guarda contra alguem "simplificar" o v2 de volta.

Os tetos (13, 11) sao numeros FIXOS de proposito. Cair significa que alguma trava
virou perda silenciosa; subir significa que uma trava caiu.

### O domino e assertado NOS DOIS SENTIDOS

A D10 inverteu o comportamento: no v1 o cabecalho desconhecido QUEBRA o bloco; no
v2 nao quebra, e a trava mudou de lugar para `fornecedor_conferir`. A prova cobra
cada versao pelo SEU contrato, em vez de escolher um lado.

No v2 ela cobra os dois lados do `suspeita_alta`: aceso em `TABELA XPTO IMPORTS`
(carrega `imports`, palavra de fornecedor cadastrado) e APAGADO em
`📍 RETIRADA: Irajá` (bairro). O segundo e o lado caro da D13.

### O que a fixture B cobre, item a item

Os seis que o v6 pediu, mais o que o conserto trouxe:

- cor **na linha** do preco, com qualificador `(CPO)` entre parenteses;
- cor **antes** do preco, ALTERNADO (o defeito da secao 2), cobrando o PAR
  INTEIRO: so conferir o Roxo passaria verde com o defeito no lugar;
- cor **antes** do preco, par simples;
- cor **depois** do preco;
- `caixa aberta` barrado (fixture A);
- o domino;
- o **iPhone Air** casando por apelido e nao herdando o modelo do bloco anterior
  (o bloco antes dele e o JBL: sem a heranca zerada, R$ 5.900 iriam para o nome
  da caixa de som);
- a trava do `modelo_desconhecido`, com um `iPhone Zeta` inventado;
- **os dois AirPods** saindo separados, e sendo exatamente DOIS produtos;
- **emoji colado** em dois niveis: no helper (`calc_limpar` separa, e o acento de
  `RELÓGIO`/`FÊNIX`, o ordinal `3ª` e a polegada `13"` sobrevivem) e de ponta a
  ponta (o JBL chega ao blob com categoria `JBL`).

**Restricao global 8 respeitada:** as duas fixtures sao sinteticas e os precos
sao inventados. Nenhuma lista de fornecedor entrou no repo.

---

## 4. Estado vivo, medido em 10/09/2026

### Banco (projeto `unjzpyexgtbcmjfgcqrx`)

```sql
select
  (select count(*) from public.calc_modelo where tenant_id is null) as modelos_semente,
  (select count(*) from public.calc_alias  where tenant_id is null) as aliases_semente,
  (select count(*) from public.calc_fornecedor) as fornecedores_tenant,
  (select count(*) from public.calc_carga) as cargas,
  (select jsonb_array_length(jsonb_path_query_array(dados->'config'->'margens','$.keyvalue()'))
     from public.calc_dados where tenant_id='00000000-0000-0000-0000-000000000001') as margens;
```

Esperado: **125, 40, 17, 0, 9**. Sem mudanca desde o v6: esta sessao nao tocou em
dado, so em funcao.

As duas funcoes de parser seguem convivendo:

| Funcao | `length(prosrc)` | Papel |
|---|---|---|
| `privado.calc_parse` | **19746** | o v1, **quem `calc_carga_abrir` chama em producao** |
| `privado.calc_parse_v2` | **27427** (era 25362) | sem consumidor ainda |

O v1 foi medido antes E depois da migration: mesmo tamanho e mesmo md5
(`f74503007e8e373ce2997b54c249c84c`). **Nao foi tocado.**

**Advisors: 8**, sem entrante. Os sete `SECURITY DEFINER` mais o leaked password
protection. Esta migration nao cria funcao nem mexe em grant.

### Repo

Commit desta sessao: `b4c566d`, rebaseado em cima do backup diario `48dc887`.
Anteriores: `bf7a956`, `c515c60`. Remote e `github`; `origin` e proxy morto.

### Suite

Os onze comandos do `CLAUDE.md`, contados nas larguras, dao **20 execucoes**, e
todas em EXIT 0. Nada em `public/` mudou nesta sessao.

`ferramentas/prova_calc_parse.sql`: **PASSOU, 71 assercoes, 0 falhas.** Lembrar
que aqui vale a MENSAGEM, nao o exit code: o bloco termina em `raise exception`
de proposito.

---

## 5. O proximo passo, e o que trava o que

A lista do v6 menos o item 1, que fechou.

| # | Item | Trava | Peso |
|---|---|---|---|
| 1 | **Frontend: `KCATS`, `SEMMARGEM`, `prova_catalogo.js`** | JBL aparecer na calc | pequeno |
| 2 | **Frontend: aba Config lendo `config.margens`** | margem alteravel de verdade | medio |
| 3 | **A tela `Alimentar`** (Bloco 2, fatia 2) | o portao do bloco | o grosso |
| 4 | Promover o v2 (trocar o chamador) | junto com a fatia 2 | pequeno |
| 5 | Comissao alteravel | **Bloco 3** (tirar o consultor do repo) | decisao ja tomada |
| 6 | Modelos e cor que faltam no catalogo | cobertura | insert |

O 1 e o 2 sao os unicos frutos baixos. **O 3 continua sendo o que importa**, e o
portao dele nao e tecnico: o dono roda a carga do mes pela tela, sozinho, sem
Claude Code, com cobertura nao menor que a do caminho de hoje na MESMA entrada
(D7).

Ao fazer o 4, lembrar de tirar o `calc_parse` do laco da prova.

### O que muda no 3 por causa desta sessao

Nada de requisito, mas ganhou rede: as seis travas do parser agora tem assercao
em arquivo. **Antes elas so existiam em prompt de subagente e morriam com a
sessao.**

O requisito da D10 continua valendo e nao se mexe: a tela tem que por
`fornecedor_conferir` na frente do dono ANTES do botao de aprovar, com
`suspeita_alta` merecendo parada real e nao aviso cinza no rodape.

---

## 6. O aviso que o `base` levantou, e que NAO e defeito

`privado.calc_parse_v2` esta com `proacl` = `{postgres=X/postgres}` e
`prosecdef` = false. O `create or replace` reseta a ACL e o
`revoke all ... from public` do proprio arquivo fecha o resto, entao
`authenticated` **nao executa a funcao direto**.

**Isso e o desenho, nao regressao**, e e coerente com o v2 nao ter consumidor.
Quando a promocao acontecer (item 4 da secao 5), quem chama e a RPC
`SECURITY DEFINER` em `public`, que roda como owner e ja tem a barreira de papel
no CORPO. Quem tentar chamar `privado.calc_parse_v2` por PostgREST leva
permission denied, e e para levar.

**Quem "consertar" isso dando `grant execute to authenticated` na funcao de
`privado` abre um buraco de graca**: passaria a existir um caminho de execucao
que nao passa pela barreira de papel da RPC. Mesma familia do aviso do v6 sobre
nao tirar o GRANT das cinco `calc_*`, so que na direcao oposta.

Ver tambem a memoria `parse-v2-sem-grant-e-desenho`.

---

## 7. Armadilhas medidas (soma as do v6)

**Prova condensada nao prova o arquivo.** Na primeira rodada desta sessao eu
colei no MCP uma versao SEM os comentarios para economizar espaco. Ela passou, e
nao valia: o que a suite roda amanha e o arquivo, nao a copia. A rodada que conta
foi a segunda, com o bloco `do $prova$` byte a byte do disco. Mesma familia do
"prova que copia a logica prova a si mesma" do PROCESSO 5.1.

**Handoff que afirma cobertura sem prova em arquivo envelhece para MENTIRA, nao
para desatualizado.** O v6 dava os tres formatos de cor como cobertos porque as
verificacoes tinham rodado em prompt de subagente. Um deles estava quebrado. A
frase do `CLAUDE.md` — "prova que nao esta em suite nenhuma nao roda de novo" —
tem um corolario mais duro: **ela tambem nao provou o que voce lembra que ela
provou.**

**`git rev-list --left-right` antes de empurrar, sempre.** O remote estava 1 a
frente com o backup diario (`48dc887`, so `backups/`). Sem cruzar arquivo, o
rebase e seguro; conferir o diff DEPOIS do rebase (1204 insercoes, igual antes de
rebasear) e o que prova que nada se perdeu.

**Migration de funcao grande se gera por script, nao a mao.** O corpo do
`calc_parse_v2` tem 27 KB. O arquivo novo saiu de um script que le a migration
ANTERIOR, troca so a CTE alvo e aborta se o trecho nao aparecer exatamente uma
vez. O `base` conferiu os dois arquivos linha a linha e achou so as duas
diferencas esperadas (cabecalho e a CTE), com alinhamento constante de +39 linhas
dali ate o fim.

---

## 8. O que continua verdade

- Invariante 17: nao construir superficie de SaaS antes do primeiro pagamento.
- Restricao 8: nao commitar export de fornecedor, nem como fixture.
- Nao criar FK de `calc_*` para tabela de operacao. Medido nesta sessao: **0**.
- Nao deixar linha nao entendida virar preco.
- `calc_catalogo_tenant_pitstop` segue NAO versionada, de proposito.
- A trava do `modelo_desconhecido` zerando o modelo herdado nao se mexe, e agora
  tem assercao (`B8` e `B9` da prova).
