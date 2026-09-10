# Handoff — Calculadora como produto, v6

Data: 10/09/2026. Linha `calculadora`. **Topo da linha.** Substitui o v5.

Escrito para uma sessao comecando **fria**. Tudo abaixo foi medido nesta sessao.

Nota de linguagem: prosa sem acento, sem cedilha, sem travessao. Valores reais do
sistema aparecem exatos.

---

## 0. Leia nesta ordem

1. `CLAUDE.md`.
2. `docs/calculadora/PROCESSO.md`.
3. Este arquivo.
4. O v5 so para o detalhe das quatro rodadas de conserto do parser (secao 3 de la).

---

## 1. Onde a obra esta, em tres linhas

- **O parser le lista real**: 92 de 93 linhas das duas listas do dono, 98,9%.
- **A tela `Alimentar` continua sem existir.** O portao do Bloco 2 nao foi
  cumprido, e ele nao e tecnico: e o dono rodar a carga do mes sozinho.
- **Nada disto esta no ar**: `calc_carga_abrir` chama o `calc_parse` v1, e o v2
  nao tem consumidor.

---

## 2. O que esta sessao acrescentou ao v5

O v5 fechou a medicao (0% -> 98,9%). Esta sessao respondeu tres decisoes do
dono e achou um defeito ao executar a primeira.

### D11 — JBL Boombox 4 entra (10/09)

Categoria propria `JBL`, nona do CHECK. Precedente: `Garmin` e `Moto Elétrica`
ja fazem marca virar categoria. Em `Acessório` uma caixa de som de R$ 2.200
dividiria regra de margem com cabo de R$ 90, e **a margem e por categoria**.

**A categoria vive em QUATRO lugares.** O banco ja aceita `JBL`; os outros tres
seguem pendentes e sao frontend:

```
public/calc/index.html:1493      const KCATS=[... nove agora ...]
public/calc/index.html:552       const SEMMARGEM=new Set([...])
ferramentas/prova_catalogo.js:84 assere a lista EXATA por regex
```

`prova_catalogo.js` **vai reprovar** quando o HTML mudar sem ela. Isso e o
guard-rail funcionando, nao um defeito.

### D12 — margem alteravel (10/09)

Pedido: *"prefiro que comissao e margem de acessorio sejam alteraveis"*.

Dois achados ao implementar:

**1. A D4 nunca foi implementada.** O v4 registra, em 07/09, margem propria para
`Acessório` (`aav`/`apc`). Os dois identificadores **nao existem no codigo**.
`Acessório` cai no `else` do `mg()` e leva margem de iPhone:

| Item | Custo | Calc sugere | Margem |
|---|---|---|---|
| Fonte turbo | R$ 70 | R$ 620 | 88% |
| Cabo | R$ 90 | R$ 640 | 86% |
| AirPods 4 | R$ 850 | R$ 1.400 | 39% |

Estava listada no handoff como "nao perguntar de novo", o que faria a proxima
sessao assumir pronta. **Licao: decisao registrada nao e decisao implementada.**

**2. As margens ja eram editaveis, mas nunca salvas.** A aba Config tem os
campos (`cfia`, `cfip`, `cfma`, `cfmp`) e `cfSv()` recalcula na hora, mas `CFG`
nao vai para `localStorage` nem para o banco: trocar a margem e recarregar
devolve 550/650/1200/1300. E nao havia como salvar: `calc_dados` tinha UMA
policy, de SELECT.

**Desenho:** `config.margens`, um objeto por categoria, em vez de mais um par
`xav`/`xpc`. Com par fixo, TODA categoria nova exige codigo novo, e foi assim
que `Acessório` ficou esquecido. Agora categoria nova e **dado**.

**`null` = nao configurada, nunca zero.** Zero e margem legitima (as classes de
custo puro usam), entao zero como "nao sei" apagaria a diferenca entre "vende no
custo, de proposito" e "ninguem definiu". Mesmo espirito do invariante 18.

Mais a RPC `public.calc_config_margem_salvar(jsonb)`, no padrao das outras
quatro `calc_*`. Barreira provada: sem papel `dono`, levanta excecao e nao grava.

**O seed preserva os quatro valores de hoje**, e isso foi medido: `pb` = 100 e
17 taxas identicos ao baseline. Nenhum preco mudou.

### D13 — validacao de fornecedor (10/09)

Pedido, sobre a D10: *"considere uma validacao mais apurada... mas, aqui,
dificilmente erra a compreensao de quem e quem"*.

**Nao adivinha, e isso foi medido.** Dos 17 fornecedores, oito sao nome de
pessoa ou palavra comum:

```
All imports | BR10 | Cristiano | Davi/Fábio | DG Jacarepaguá | Five Cell
FMATA | João Telles | Júnior | LBR Importados | M Apple | MP Imports
Quality | Rafael | Raposa | Real Comércio | Revel
```

Nenhuma heuristica separa `Cristiano` (loja) de `Irajá` (bairro) sem falso
positivo semanal. **E falso positivo semanal treina a pessoa a clicar "ok" sem
ler, que e pior do que nao avisar.**

Em vez disso, `fornecedor_conferir` EXPOE o que foi ignorado, por fornecedor:
nome, cabecalho que o identificou, quantas linhas levou, e as linhas que o
parser nao entendeu. `suspeita_alta` e o unico alarme e e conservador: acende so
quando a linha ignorada carrega palavra de 4+ letras que aparece em nome de
fornecedor JA cadastrado (`imports`, `cell`) sem o nome inteiro casar.
Provado nos dois sentidos: `XYZ IMPORTS LTDA` acende, `📍 RETIRADA: Irajá` nao.
A lista sai do catalogo do tenant, entao melhora sozinha a cada cadastro.

---

## 3. O defeito que a D11 revelou: emoji colado come o nome

O JBL nao casava **mesmo com o modelo no catalogo**:

```
'*🎼JBL BOOMBOX 4*'  ->  tokens {'🎼jbl', '4', 'boombox'}
'JBL Boombox 4'      ->  tokens {'jbl', 'boombox', '4'}
```

O casamento exige que todo token do canonico apareca na linha. Nao ha `jbl` puro.

**Generalizado**: o MP escreve o emoji SEM espaco, o BR10 COM.

```
'*💻MACBOOK NEO...'    -> '💻macbook'   perde `macbook`
'*🎧AIRPODS 4...'      -> '🎧airpods'   perde `airpods`
'*⌚️RELÓGIO GARMIN...' -> '⌚️relogio'   perde `relogio`
```

**TERCEIRA aparicao da classe PERDA SILENCIOSA nesta linha de trabalho.** O MP
fechava em 100% porque quase todo item dele casava por OUTRO caminho: os
MacBooks tem apelido, e apelido casa por `position()` sobre o texto inteiro,
atravessando o emoji. Onde nao havia apelido, o produto sumia calado.

**Cobertura alta estava mascarando o defeito, nao provando a ausencia dele.**

### Onde foi consertado, e por que ali

Em `calc_limpar`, nao em `calc_tokens`. `calc_limpar` roda SO na linha crua da
lista; `calc_tokens` roda tambem no nome do catalogo e mudaria o casamento de
tudo de uma vez. Risco contido de proposito.

**A armadilha era o acento.** `calc_limpar` roda ANTES de `calc_norm`, com o
texto ainda acentuado: separar "nao-ASCII" quebraria `RELÓGIO` em `REL Ó GIO`.
A classe `[^[:alnum:][:space:][:punct:]]` deixa acento de fora porque no locale
UTF-8 `Ó`, `ê` e `ª` contam como alfanumericos. Medido nos dois sentidos antes
de escrever: emoji separa; `Fênix`, `1ª linha` e `13"` intactos.

### Esta e a UNICA mudanca da sessao que toca o caminho vivo

`privado.calc_parse` (o v1, que `calc_carga_abrir` chama) **tambem usa**
`calc_limpar`. Sem efeito pratico hoje (a RPC nao tem tela e `calc_carga` esta
em 0) e a mudanca so melhora o casamento, mas fica declarado.

---

## 4. As tres classes de falha, e so uma precisa de prova

Vale para todo o resto do plano.

| Classe | Como aparece | Prova dedicada? |
|---|---|---|
| **Cobertura baixa** | vira pendencia, aparece na tela | nao, a tela mostra |
| **Preco errado** | passa por certo, some no `min()` | sim |
| **Perda silenciosa** | o produto simplesmente nao existe | **sim, e so ela** |

Perda silenciosa apareceu tres vezes nesta linha:
1. `caixa aberta` entrando como Lacrado e virando menor custo;
2. `AirPods 4 ANC` de R$ 1.250 sumindo no `min()` contra o de R$ 850;
3. emoji colado comendo o nome do produto.

**Nenhuma das tres gritava.** Nada na tela indicaria a falta.

---

## 5. O proximo passo, e o que trava o que

| # | Item | Trava | Peso |
|---|---|---|---|
| 1 | **`prova_calc_parse.sql` ganhar os casos novos** | nada. Faca ANTES do resto | 1 sessao curta |
| 2 | **Frontend: KCATS, SEMMARGEM, `prova_catalogo.js`** | JBL aparecer na calc | pequeno |
| 3 | **Frontend: aba Config lendo `config.margens`** | margem alteravel de verdade | medio |
| 4 | **A tela `Alimentar`** (Bloco 2, fatia 2) | o portao do bloco | o grosso |
| 5 | Promover o v2 (trocar o chamador) | junto com a fatia 2 | pequeno |
| 6 | Comissao alteravel | **Bloco 3** (tirar o consultor do repo) | decisao ja tomada |
| 7 | Modelos e cor que faltam no catalogo | cobertura | insert |

### 1 vem primeiro, e o motivo nao mudou desde o v5

`ferramentas/prova_calc_parse.sql` prova o **v1**. Tudo o que as duas sessoes
construiram esta no v2 e **nao tem prova em suite nenhuma**. As verificacoes
rodaram por prompt de subagente e morrem com a sessao.

Minimo que a prova precisa cobrir, e os tres ultimos sao os que nao gritam:
- os tres formatos (cor na linha, cor antes do preco, cor depois do preco);
- `caixa aberta` barrado;
- o domino (cabecalho sem apelido nao derruba o resto);
- **o iPhone Air nao herdar o modelo anterior**;
- **os dois AirPods saindo separados**;
- **emoji colado nao comer o nome** (`*🎼JBL BOOMBOX 4*` tem que casar).

### 6 depende do Bloco 3, e nao e teimosia

A comissao vive em `config.comissao` do `dados.js`, ARQUIVO ESTATICO do repo que
a calc do consultor le. Torna-la alteravel exige tirar o consultor do repo, que
e o Bloco 3. A estrutura de `config.margens` desta sessao e o molde pronto para
ela quando aquele bloco chegar.

O comportamento atual e SEGURO e nao precisa de conserto urgente: categoria sem
comissao cadastrada mostra **`Consultar loja`** (`com()` devolve null), nunca
calcula zero escondido. `Acessório` e `JBL` caem nisso hoje.

### 7, o que falta de catalogo

`iPhone 15 512GB`, `iPhone 15 Pro 1TB`, `iPhone 16 512GB`, `iPhone 16 Pro
512GB`, `Apple Watch Series 3` (40mm e 44mm) e a cor `Blush` do MacBook Neo.
Sao 7 linhas de cobertura, nao defeito: o parser as trata certo, virando
pendencia nomeada.

---

## 6. Estado vivo, medido em 10/09/2026

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

Esperado: **125, 40, 17, 0, 9**. O `125` inclui o JBL; o `40`, o apelido dele.

Duas funcoes de parser convivem:
- `privado.calc_parse` — o v1, **quem `calc_carga_abrir` chama em producao**;
- `privado.calc_parse_v2` — sem consumidor ainda.

**Advisors: 8** (era 7 no v5). O entrante e `calc_config_margem_salvar`,
`SECURITY DEFINER` com barreira de papel no CORPO, igual as outras quatro.
**Nao e regressao. Quem "consertar" tirando o GRANT quebra a tela.**

### Repo

Commits desta sessao: `c515c60`. Da anterior: `9486f25`, `81554e7`, `1470202`.
Remote e `github`; `origin` e proxy morto. `git add -A` mecanicamente negado.

---

## 7. Armadilhas medidas (soma as do v5)

**`categoria` e CHECK, nao texto livre.** Insert com valor novo devolve 23514.
Exige `drop constraint` + `add constraint`.

**`calc_limpar` roda ANTES de `calc_norm`.** Qualquer regex ali ve o texto ainda
acentuado e com maiuscula. Separar "nao-ASCII" quebra acento.

**Casamento por apelido atravessa lixo; por token, nao.** O apelido usa
`position()` sobre o texto inteiro, entao passa por emoji colado; o token exige
a palavra limpa. Por isso um item com apelido mascarava o defeito e outro sem
apelido sumia.

**Valor esperado errado no prompt do subagente e caro.** Nesta sessao pedi "16
linhas e 100% E a pendencia da Blush", o que e incompativel: com a Blush em
pendencia a cobertura nao pode ser 100. O subagente mediu, provou que a migration
nao alterou nenhuma das 40 linhas, e apontou a incoerencia em vez de acomodar o
numero. **Esse e o comportamento certo, e ele veio de instrucao explicita para
reportar valor exato sem adivinhar causa.**

---

## 8. O que continua verdade

- Invariante 17: nao construir superficie de SaaS antes do primeiro pagamento.
- Restricao 8: nao commitar export de fornecedor, nem como fixture. As listas
  desta sessao e da anterior **nao entraram no repo nem no banco**.
- Nao criar FK de `calc_*` para tabela de operacao.
- Nao deixar linha nao entendida virar preco.
- `calc_catalogo_tenant_pitstop` segue NAO versionada, de proposito.
- **O requisito da D10 continua valendo e agora tem campo pronto:** a tela do
  Bloco 2 tem que por `fornecedor_conferir` na frente do dono ANTES do botao de
  aprovar, com `suspeita_alta` merecendo parada real e nao aviso cinza no rodape.
  Sem isso, a defesa que saiu do parser na D10 nao existe em lugar nenhum.
