# Handoff Financeiro v15 — o bloco de custo exibia custo NEGATIVO

Data: 03/09/2026. Linha: financeiro. Substitui o `handoff_financeiro_pitwall_v14.md`
como topo da linha.

---

## 1. A frase da entrega

**A comissao que o dono RECEBE sai do bloco de custo operacional e aparece na Receita,
do lado pessoal, e o grupo `Operação` para de exibir custo negativo.**

Sujeito visivel na tela: o grupo `Operação` de agosto, que mostrava **-R$ 4.275,00**.

---

## 2. A ordem do dono, na frase dele

> *"comissao e entrada financeira minha, nao operacao como motoboy."*

Ele esta certo, e a base concorda sozinha. Media antes de mexer: existe **exatamente 1
movimento** com `categoria_codigo = 'comissao'` em toda a base:

| Data | Contraparte | Valor | Dominio |
|---|---|---|---|
| 06/08/2026 | `BRABA STUDIOS LTDA` | **+R$ 4.800,00** | `pessoal` |

Uma ENTRADA numa categoria de natureza `saida`, com `dominio = pessoal` numa categoria
que sugeria `empresa`. A categoria estava modelada como custo de operacao, ao lado do
motoboy, e o unico uso real dela e renda pessoal.

---

## 3. O defeito era maior do que "categoria no grupo errado"

Como `comissao` tinha natureza `saida`, o `fin_painel` tratava os R$ 4.800 de entrada
como **abatimento de custo**. Medido com `fin_painel('2026-08-01','2026-08-31','tudo')`
como dono autenticado, antes e depois da migration:

| Numero da tela | antes | depois |
|---|---|---|
| grupo `Operação` (custo) | **-R$ 4.275,00** | **R$ 525,00** |
| linha `Comissão` dentro de Operação | total -4.800 / abatido 4.800 | some do bloco de custo |
| grupo `Receita` | R$ 6.590,96 | R$ 11.390,96, com `Comissão` 4.800 (42,1%) |
| placar `entrou` | R$ 6.590,96 | R$ 11.390,96 |
| placar `saiu` | R$ 15.942,17 | R$ 20.742,17 |
| placar `resultado` | -R$ 9.351,21 | **-R$ 9.351,21** |

**Um bloco de CUSTO exibindo total negativo** e o defeito de verdade: R$ 4.800 de renda
pessoal estavam reduzindo o custo da loja. O `resultado` nao se move, entao o caixa
fecha igual: o que mudou foi onde o dinheiro aparece, nao quanto ha.

---

## 4. A migration

`supabase/migrations/20260903_fin_comissao_vira_receita_pessoal.sql`, aplicada como
`20260903040422_20260903_fin_comissao_vira_receita_pessoal`. Ledger **172 -> 173**, e o
subconjunto `fin_` bate 1:1 com o git (**27 -> 28**, arquivo por arquivo).

| Campo | Antes | Depois |
|---|---|---|
| `codigo` | `comissao` | `comissao` (Inv. 12, imutavel) |
| `rotulo` | `Comissão` | `Comissão` |
| `grupo` | `Operação` | **`Receita`** |
| `natureza_esperada` | `saida` | **`entrada`** |
| `dominio_sugerido` | `empresa` | **`pessoal`** |
| `ordem` | 12 | **28** |

Auditoria de `fin_categoria`: 35 -> 36 linhas, um unico UPDATE append-only, carimbo
igual ao `atualizado_em`. `fin_movimento` intacto: a linha do BRABA STUDIOS nao foi
tocada hoje, ela ja estava `pessoal`.

A migration termina com um bloco `do $$` que **falha inteira** se o estado alvo nao
ficar exato nos 8 campos. Guard-rail dentro do proprio arquivo.

**Nenhuma linha de codigo mudou.** `comissao` nao aparece em `public/app.js` (0
ocorrencias) e o grupo `Receita` ja existia no mapeamento: a categoria e servida por
`fin_config`, entao a tela absorveu sozinha. Isso e o invariante C2 pagando o que
prometeu.

---

## 5. Dois achados que o brief nao previa

**5.1 `ordem` e sequencia GLOBAL, nao por grupo.** O brief presumia 28 livre; 28 ja era
de `outro_pessoal` (grupo `Outros`). Nao ha unique em `(tenant_id, ordem)`, o empate e
legal, e `fin_config` ordena por `(ordem, rotulo)`, o que torna o desempate
deterministico (`Comissão` antes de `Outro (pessoal)`). Como sao grupos diferentes na
tela, o empate nao e visivel. Ficou 28 por decisao consciente: nao ha inteiro livre
entre 28 e 29 e renumerar 34 categorias seria mudanca maior sem ganho.

**5.2 A palavra "comissao" tem dois donos neste negocio.** A que ele RECEBE (esta) e a
que ele PAGA ao consultor, que a `calc/consultor/` calcula com uma `config.comissao`
inteira. Nenhuma comissao paga passou por esta conta (0 movimentos), por isso redefinir
foi seguro. **Consequencia registrada na migration:** o dia em que ele pagar o consultor
por esta conta exige codigo proprio (`comissao_paga`, saida / empresa / `Operação`).
Reaproveitar este seria fazer o mesmo estrago ao contrario.

---

## 6. O portao 6.3, e por que ele fica em aberto

> **6.3:** nenhum numero da tela pode mudar de valor sem que a MESMA entrega traga a
> explicacao na tela.

**Dois numeros do placar mudaram R$ 4.800 e nenhuma nota subiu na tela.** Isso esta
declarado aqui em vez de escondido.

Argumentos de cada lado, para a decisao ser dele e nao minha:

- **A favor de dispensar a nota:** o calculo nao mudou, mudou um DADO de config que
  estava errado; o valor antigo era demonstravelmente absurdo (custo negativo); o
  `resultado` nao se moveu; e a tela nunca afirmou que o lugar antigo estava certo, ela
  so renderizou a config. Alem disso o dono ainda **nao abriu a aba nenhuma vez** depois
  de a base ir de 18,55% a 99,86%, entao nao existe um "antes" na tela dele para
  surpreender.
- **A favor de exigir a nota:** o 6.3 nao abre excecao para correcao de config, e o
  dano que ele previne e exatamente este: alguem olhar o historico no mes que vem e ver
  `saiu` pulando R$ 4.800 sem causa.

### DECIDIDO pelo dono em 03/09/2026: dispensada

> *"dispensa a nota, foi correcao de config"*

**Decisao consciente, tomada depois de os dois lados serem postos.** Nenhuma nota sobe
na tela por causa desta entrega.

**Virou regra escrita, com fronteira.** A decisao nao ficou solta neste handoff, que
sera superado: entrou no CONTRATO como **excecao 6.3.1** e como decisao **D-r**, e o
contrato subiu para a **revisao 3**. A excecao exige QUATRO condicoes cumulativas:

1. o calculo nao mudou (mudou linha de config, nao funcao nem formula);
2. o valor antigo era demonstravelmente ERRADO, nao so diferente;
3. o `resultado` nao se moveu;
4. os numeros antes e depois ficam no handoff, medidos pela RPC de producao.

Este caso cumpre os quatro. **A fronteira e o ponto:** "era so config" e a desculpa mais
facil de dar e a mais dificil de contestar depois, entao a excecao tem que ser PROVADA,
nao alegada. Excecao que qualquer um invoca nao e excecao, e a revogacao da regra.

---

## 7. Provas

Suite completa, rodada depois da migration, **EXIT 0 nos 14 comandos**:
`validar.py`, `harness.py`, `prova_trilho.py`, `prova_grafico.py`,
`prova_atmosfera.py`, `node --check public/app.js`, `diag_mobile.py` em 360 / 390 /
414 / 1280 / 1440, `diag_largo.py` em 1500 / 1920 / 2560.

Nenhuma assercao fixava o grupo ou a natureza de `comissao`, entao nada vermelhou.

Cobertura MEDIDA depois (o subagente so havia raciocinado sobre ela, nao medido):
**agosto/2026 100,00%**, ano **99,86%**, 2 linhas pendentes. Nao se moveu, como
esperado: a linha tem `dominio` nao nulo e a categoria nao e `neutro` nem antes nem
depois.

Advisors: 3 WARN, todos pre-existentes (`registrar_venda` e `remover_nf` como SECURITY
DEFINER executaveis por `authenticated`, e Leaked Password Protection, bloqueio de
plano). Nenhum novo.

**Susto de transporte sem estrago:** o primeiro `apply_migration` voltou 520 da
Cloudflare (falha de borda, nao do Postgres). O estado foi conferido antes de repetir,
nada tinha sido aplicado, ledger limpo. Sem aplicacao dupla.

---

## 8. O que continua aberto

| # | Item | Nota |
|---|---|---|
| 1 | ~~A nota do 6.3~~ | **FECHADO.** Dispensada pelo dono, e virou a excecao 6.3.1 / D-r do CONTRATO, revisao 3 |
| 2 | Os R$ 630 do Rodrigo e o `forcar` no repasse | v14 secao 4. Decidido: ficam pendentes ate o mecanismo existir |
| 3 | `comissao_paga` | Secao 5.2. So quando ele pagar o consultor por esta conta |
| 4 | O dono ainda NAO ABRIU A ABA | Segue sendo o primeiro movimento. Agora com mais um motivo: o grupo `Operação` de agosto mudou de -4.275,00 para 525,00 |
| 5 | 3 linhas `Aplicação RDB` rotuladas `resgate` | Cosmetico, herdado |
| 6 | Escrita de volta no Notion | Bloqueio antigo do v33, capability "Update content" |

---

## 9. Primeiro movimento do proximo chat

**Abrir a aba Financeiro e olhar**, agora pela terceira vez que este handoff pede.
Este trabalho nao deixou nada pendurado: a nota do 6.3 foi decidida e virou regra
escrita. O que sobra e da linha anterior, o `forcar` no repasse (v14, secao 4).
