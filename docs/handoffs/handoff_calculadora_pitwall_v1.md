# Handoff — Calculadora como produto, v1

Data: 07/09/2026. Linha NOVA de dominio: `calculadora`. Este e o topo dela.

Escrito para uma sessao de terminal continuar do zero, sem contexto anterior.
Tudo abaixo foi **medido nesta sessao**, nao herdado de documento.

Nota de linguagem: prosa sem acento, sem cedilha, sem travessao (convencao do
`CLAUDE.md`). Valores reais do sistema aparecem exatos.

---

## 0. Leia nesta ordem, antes de tocar em qualquer coisa

1. `CLAUDE.md` (arranque de toda sessao).
2. `docs/runbook-operacao.md` — **novo, 07/09/2026.** Como nao atropelar outra
   sessao, o remote real, as armadilhas de Git Bash no Windows, EXIT CODE.
3. `docs/superpowers/specs/2026-09-05-calculadora-produto-design.md` — o desenho.
   Se o plano divergir dele, **a spec ganha** e voce avisa.
4. `docs/superpowers/plans/2026-09-05-calculadora-produto.md` — o plano, bloco a
   bloco, com portao por bloco.
5. So entao a skill `calculadoras` e os 4 `references/` dela.

---

## 1. O pedido do dono, e a decisao que ele tomou contra o conselho

Pedido literal: **transformar a calculadora em sistema comercializavel, com outro
lojista usando sem dificuldade**, alimentando a propria tabela com os proprios
fornecedores a partir do export do chat, do mesmo jeito que ele faz hoje.

Isso **rompe o invariante 17** (nao construir superficie de SaaS antes do primeiro
pagamento). Foi apontado, e ele decidiu seguir. Registrado como escolha
consciente, com o custo assumido. Nao reabrir a discussao a cada sessao.

**O que ele NAO assumiu, e isso foi dito explicitamente em 07/09/2026:** *"nao
assumi atualizar nenhum catalogo base. quem vai atualizar e o cliente."*

Nao existe catalogo mantido pelo dono do produto. Existe uma **semente**, copiada
uma vez no nascimento da conta; dali em diante o catalogo e do cliente e quem o
mantem e ele, resolvendo pendencia. Modelo novo (`iPhone 18`) entra em cada tenant
pelo laco de pendencia, sem ninguem publicar nada. E a decisao **D5**.

Custo que ele aceitou junto, e que vale lembrar quando o assunto for preco: zero
aprendizado compartilhado (duzentos clientes ensinam `PURPLE -> Lilás` duzentas
vezes), e a cobranca recorrente passa a se sustentar no **sistema rodando**, nao
em catalogo atualizado. O ganho que sobrevive inteiro e o dia 1: a semente entrega
o lado Apple pronto, e o cliente comeca perto de 80% em vez de 0%.

---

## 2. Decisoes fechadas (nao perguntar de novo)

| # | Pergunta | Resposta |
|---|---|---|
| D1 | Os 341 produtos do tenant `...0004` servem de historico? | **Nao.** Ja apagados |
| D2 | O que e vendido? | **O conjunto** (Pit Wall com a calc). A calc vira produto separado DEPOIS |
| D3 | Descarte configuravel por tenant? | **Sim**, com o padrao do dono pre-marcado |
| D4 | `Acessório` e margem | **Margem propria** (`aav`/`apc`) e **entra no consultor** |
| — | Assentos | **Time completo incluso.** Acesso so por login |
| — | Cota de modelo | **3.000 linhas/mes + 3.000 de abertura** |
| D5 | Quem atualiza o catalogo? | **O CLIENTE.** Nao ha catalogo mantido pelo dono do produto, so semente no nascimento |

**Correcao registrada em D4:** o dono citou "airpods, apple watchs" como
acessorios. `Apple Watch` **e categoria propria**, ja recebe `iav`/`ipc` e ja
aparece no consultor. D4 muda somente `Acessório` (12 itens: AirPods 4, AirPods 4
ANC, AirPods Pro 2, AirPods Pro 3, AirPods Max 2, AirPods Max USB-C, AirTag Pack
4, Apple Pencil 2, Apple Pencil Pro, Apple Pencil USB-C, Cabo Tipo-C Apple, Fonte
Turbo Apple).

### Unica decisao ABERTA

**D4a — comissao de `Acessório` na escada do consultor.** A escada
`config.comissao` so tem os ramos `lacrado` e `seminovo`, por nivel (Embaixador /
C1 / C2 / C3). Com acessorio entrando no consultor, falta o valor.
**Nao inventar numero: ele paga comissao real ao Brendon.** Trava so o passo 3.3,
dentro do Bloco 3. Nao trava o Bloco 1 nem o 2.

---

## 3. O que foi feito e provado nesta sessao: BLOCO 0, fechado

Publicado em `github/main`. Commits `825fee1`, `25ebc65`, `b496a96`.

| Passo | Feito | Prova |
|---|---|---|
| 0.1 orfa + FK | sim | migration `calc_dados_limpa_orfa_e_fk_tenant`. Tenant fantasma bloqueado em bloco `DO` com rollback |
| 0.2 `.single()` | sim | `maybeSingle()` + `mostrarVazio()` em `public/calc/index.html` |
| 0.3 marca vira variavel | sim | 4 migrations. `Pitstop` fixo: 0. `{loja}`: 48. `{vendedor}`: 53 |
| 0.4 marca sai do HTML | sim | `pwLoja()` no `app.js`, 5 assercoes novas no harness |
| 0.5 ciclo de vida do tenant | sim | migration `tenant_ciclo_de_vida` |

**Seis migrations**, todas registradas:
`calc_dados_limpa_orfa_e_fk_tenant`, `tenant_ciclo_de_vida`,
`sugerir_mensagem_loja_e_vendedor`, `scripts_marca_vira_variavel`,
`scripts_assinatura_sem_marca_vira_vendedor`,
`scripts_artigo_sai_de_antes_do_vendedor`.

### Quatro defeitos que a execucao achou e o plano de 19/08 nao via

1. **Seis formas da marca, nao duas.** O `UPDATE` daquele plano deixaria
   `" Imports"` orfao pendurado em 17 scripts.
2. **Seis scripts assinavam so `Vini`**, sem citar loja: invisiveis a busca por
   `%Pitstop%`, e sao os que fariam o vendedor de outra loja se apresentar com o
   nome do dono.
3. **24 scripts com artigo masculino colado na variavel** (`aqui é o {vendedor}`).
   Com uma vendedora chamada Ana, mandariam **"aqui é o Ana"** ao cliente. Nao
   estava em plano nenhum.
4. **O mock do harness nao tinha `maybeSingle` nem a tabela `tenant`**, entao
   `pwLoja()` estourava calada e a assercao nova nunca rodaria.

### Duas correcoes do proprio plano

- `calc_dados` **ja tinha `PRIMARY KEY (tenant_id)`**: a unique era redundante.
- O `.single()` **nao quebra com 2+ linhas** (impossivel, dada PK + RLS). Quebra
  com **zero**, que e o primeiro segundo de toda loja nova.

### Uma instabilidade conhecida, deixada em paz

`fin: OFX sem lancamento diz o que houve` falhou em 1 de 3 corridas e passou nas
outras duas; contra o `HEAD` passou 1 de 1. O harness ja documenta que ela cai
quando cresce o numero de assercoes antes dela. **Nao alargar o `finAte`**: isso
e calar guard-rail e repontar baseline.

---

## 4. Estado vivo, medido em 07/09/2026

### Banco (projeto `unjzpyexgtbcmjfgcqrx`)

```sql
select
  (select count(*) from public.calc_dados) as calc_linhas,
  (select jsonb_array_length(dados->'produtos') from public.calc_dados
     where tenant_id='00000000-0000-0000-0000-000000000001') as produtos,
  (select count(*) from public.tenant) as tenants,
  (select count(*) from public.dicionario_scripts where texto_template ilike '%Pitstop%') as marca_fixa,
  (select count(*) from public.dicionario_scripts where texto_template like '%{loja}%') as com_loja;
```
Esperado hoje: **1, 494, 1, 0, 48**. Mais 1007 precos no blob.
`tenant` unico: `Pitstop Imports`, `plano='interno'`, `status='ativo'`.

Advisors de seguranca: **3 WARN pre-existentes** (`registrar_venda`, `remover_nf`,
leaked password protection). Achado novo = tratar antes de seguir.

### Frontend

Suite em EXIT 0 nos oito comandos. Harness: **1114 passou, 0 falhou**
(1119 declaradas, 1114 executadas, 5 de ramo alternativo, previstas).

### Git

Sincronizado com `github/main`. **O remote e `github`; o `origin` e proxy morto**
(`127.0.0.1:41729`) e cega push E fetch. Push: `git push github HEAD:main`.

**`git add -A` esta MECANICAMENTE negado** por `.claude/settings.json`
(versionado). Sempre `git add <caminho>`. Motivo e detalhe no runbook.

---

## 5. Proximo passo: BLOCO 1

**Nao ha bloqueador.** D4a nao trava este bloco.

Objetivo: o catalogo sai de
`.claude/skills/calculadoras/references/formato-dados.md` (25 KB, hoje so o
Claude le) e vira tabela em duas camadas. Sem isso, a tela de alimentar do Bloco 2
nao tem contra o que parsear.

| Etapa | Entrega |
|---|---|
| 1.1 | `calc_modelo`, `calc_cor`, `calc_alias`, `calc_fornecedor`, `calc_regra` + RLS. SQL pronto no plano. **`calc_modelo` e `calc_cor` levam `tenant_id`, unique `(tenant_id, codigo)` com `nulls not distinct`** (D5) |
| 1.2 | Seed em DOIS destinos: semente (`tenant_id null`) e tenant `...0001`. 66 iPhones, 32 cores com hex, aliases. Os 17 fornecedores **so** no `...0001` |
| 1.3 | Painel `Catalogo` em `/calc/`, so leitura, **abrivel** |

### Portao do Bloco 1

O dono abre `/calc/`, clica em `Catalogo`, ve 17 fornecedores com praca correta e
a contagem de modelos batendo com o blob. Mais, no banco:

```sql
select count(*) as modelo_sem_catalogo
  from public.calc_dados d, jsonb_array_elements(d.dados->'produtos') p
 where d.tenant_id='00000000-0000-0000-0000-000000000001'
   and not exists (select 1 from public.calc_modelo m where m.nome = p->>'n');
```
Esperado: **0**. Idem para cor.

### Duas travas deste bloco especificamente

1. **Nome de fornecedor e praca NUNCA entram na semente** (`tenant_id is null`).
   Sao ativo do dono. O vazamento de 14 dos 17 fornecedores pela linha orfa do
   tenant `...0004` era exatamente essa falha ja armada.
1b. **Nenhuma policy de catalogo faz `or tenant_id is null`.** Semente e lida so
   por `fn_provisionar_tenant`, no nascimento da conta (D5). Se vazasse para
   execucao, o dono do produto herdaria por acidente a obrigacao de mante-la.
1c. **O lado Apple entra DUAS vezes** no Bloco 1: como semente e no tenant
   `...0001`. Nao e duplicacao: a semente e retrato para contas futuras, o
   `...0001` e catalogo vivo que o proprio dono edita, como qualquer cliente.
2. **A ordem de condicao e `CPO` ANTES de `Lacrado`**, e vira coluna de
   prioridade na regra, nao ordem de insercao. Em 27/07/2026 a ordem errada gerou
   341 produtos com **zero CPO**, com CPO farto nas listas.

### Uma confirmacao a pedir ao dono no meio do 1.2

Por D3 o descarte e configuravel. Mostrar a ele a lista das regras globais
(aparelho com mensagem, paralelo, Android, preco com condicao pendurada) e
confirmar quais nascem ligadas, **antes de gravar**.

---

## 6. Restricao que vale em todo bloco daqui pra frente

**A calc tem que poder sair inteira depois (D2).** Nenhuma tabela `calc_*` ganha
FK para tabela de operacao. Conferir a cada migration:

```sql
select conrelid::regclass as tabela, confrelid::regclass as aponta_para
  from pg_constraint
 where contype='f' and conrelid::regclass::text like 'calc\_%'
   and confrelid::regclass::text not in ('tenant','app_usuario');
```
Esperado: **zero linhas**, sempre.

Acoplamento que ja existe e esta na direcao certa: `public/app.js` (linhas 1151 e
1164) le `calc_dados` para a busca de produto e a tabela de parcelamento da aba
Vendas. O painel depende da calc, **nao o contrario**. Separar a calc depois custa
a busca de produto do painel, e nada mais.

---

## 7. Comandos de arranque, copiaveis

```
cd "C:\Users\jessi\OneDrive\Documentos\pitswall claude"
git log -3 --format='%h %ad %s' --date=format:'%d/%m %H:%M'
git status --short
git remote -v
git fetch github main && git rev-list --left-right --count github/main...HEAD
```

Tree suja ou commit que voce nao fez = **outra sessao viva nesta pasta**. Ler a
secao 1 do `docs/runbook-operacao.md` antes de qualquer coisa.
