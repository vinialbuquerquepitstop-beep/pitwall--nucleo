# Plano: alinhar as rebarbas da fatia 1 do Bloco 2, antes da tela

Data: 09/09/2026. Linha `calculadora`. **Para ser executado em OUTRA sessao**,
comecando frio.

Nasceu ao fim da fatia 1 do Bloco 2 (commits `77f954c` e `5e41485`), quando a
entrega ficou de pe mas deixou nove pontas soltas. Elas nao sao trabalho novo: sao
divergencia entre o que os documentos dizem e o que o sistema faz, mais duas
decisoes do dono ainda abertas. **Alinhar isso antes da tela custa uma sessao
curta; nao alinhar custa a proxima sessao inteira**, porque quem abrir vai medir o
estado errado e trabalhar em cima dele.

Nota de linguagem: prosa sem acento, sem cedilha, sem travessao. Valores reais do
sistema aparecem exatos.

---

## Arranque desta sessao (ler nesta ordem)

1. `CLAUDE.md`.
2. `docs/calculadora/PROCESSO.md`.
3. `docs/handoffs/handoff_calculadora_pitwall_v3.md` — o topo da linha. As secoes
   4 (os seis defeitos), 5 (a prova) e 8 (a divida) sao o contexto deste plano.
4. Este arquivo.

Depois de ler, **medir**, nunca herdar:

```
git remote -v
git fetch github main && git rev-list --left-right --count github/main...HEAD
git status --short
git log -3 --format='%h %ad %s' --date=format:'%d/%m %H:%M'
```

Esperado no arranque, se a T0 abaixo ja tiver sido feita: `0 0` e tree limpa. Se
devolver `0 2`, a T0 **nao** foi feita e ela e a primeira coisa.

---

## EXECUTADO em 09/09/2026 (sessao seguinte, comecando fria)

| # | Estado | O que aconteceu |
|---|---|---|
| **T0** | **BLOQUEADA** | push negado pelo classifier de novo. **Precisa do dono**, com `!` no prompt. E surgiu um fato novo: o clone estava **1 commit ATRAS** (o backup automatico `007ea5d`), nao `0 2`, entao e `pull --rebase` antes do push |
| **T1** | **FECHADA (D6)** | `texto_bruto` **FICA**. Registrada no plano principal |
| **T2** | **FECHADA (D7)**, e o achado foi pior que o previsto | o portao virou **comparacao pareada**. Ver abaixo |
| **T3** | feita | `PROCESSO.md`: 3 WARN -> **7**, com os quatro `calc_*` nomeados e a explicacao de que sao desenho, nao achado |
| **T4** | feita | `CLAUDE.md` ganhou o bloco "provas de BANCO", com as quatro `prova_*.sql` e a regra de que ali vale a MENSAGEM, nao o exit code |
| **T5** | feita | a armadilha `\y` entrou no `CLAUDE.md`, ao lado da do `calc()` com `+` colado |
| **T6** | **PARCIAL, por decisao** | 2 das 3 versionadas. A terceira foi **recusada**: ver abaixo |
| **T7** | feita | `aprendizados.md` ganhou entrada de 09/09: o catalogo JA e tabela, e a skill virou plano B ate a tela existir |
| **T8** | aberta | isolamento das 3 tabelas novas com JWT. Nao bloqueia a tela; bloqueia o Bloco 4 |
| **T9** | aberta | auditoria e `calc_uso` sem decisao registrada |

### T2 foi pior que o plano supunha: o 89% nunca foi medido

O plano perguntava *qual denominador* gerou os 89%. A resposta e que **nao houve
medicao nenhuma**:

- o par `612 de 690` aparece pela primeira vez em
  `.claude/skills/calculadoras/references/procedimento-alimentacao.md:92`, **dentro de
  aspas, como exemplo de FORMATO** ("Fechar com a cobertura real medida: '...'");
- o `612` **nao existe como medicao em nenhum outro ponto do repo**;
- o `690` existe uma vez, em `aprendizados.md`, mas como **"690 precos"**, no contexto
  do volume da derivacao do consultor, nao como linhas lidas de uma carga;
- a spec de 05/09 leu o exemplo como fato e o promoveu a portao.

**Decisao do dono (D7):** o portao vira **comparacao pareada** — na MESMA entrada, a
tela nova nao pode cobrir menos que o caminho de hoje (esta skill). Formula e detalhe
na **secao 2.6b da spec**. Corrigido em spec, plano, `PROCESSO.md` e handoff v3.

### T6 recusada em 1 de 3, e a recusa esta documentada

`calc_catalogo_duas_camadas` (schema) e `calc_catalogo_semente` (lado Apple generico)
foram versionadas e **provadas byte a byte** contra o banco por md5.

`calc_catalogo_tenant_pitstop` **nao entrou**: 15% dela sao os **17 fornecedores do
dono com praca exata**, e a **restricao global 8** do plano principal proibe dado
comercial no repo. O repo so guarda sensivel criptografado (`.gpg`). Motivo completo,
e como recuperar pelo backup, em
`supabase/migrations/20260908_calc_catalogo_tenant_pitstop.NAO-VERSIONADA.md`.
**Se o dono discordar, e decisao dele: o SQL esta no banco e o arquivo se cria em um
comando.**

---

## Mapa das tarefas

| # | Rebarba | Bloqueia a tela? | Peso |
|---|---|---|---|
| **T0** | 2 commits locais nao empurrados | sim, na pratica | 1 comando |
| **T1** | D6 (`texto_bruto`) sem resposta do dono | **sim** | decisao |
| **T2** | O denominador da cobertura nao esta declarado | **sim** | decisao + 1 linha |
| **T3** | `PROCESSO.md` diz 3 WARN; sao 7 | nao | 2 linhas |
| **T4** | A prova SQL nova nao esta em suite nenhuma | nao | doc |
| **T5** | A armadilha `\y` nao esta no arranque | nao | doc |
| **T6** | As 3 migrations do Bloco 1 nao estao no repo | nao | 43 KB |
| **T7** | Skill `calculadoras` desatualizada | nao | doc |
| **T8** | Isolamento das 3 tabelas novas nao provado com JWT | nao (mas antes do Bloco 4) | prova |
| **T9** | Auditoria e `calc_uso` sem decisao registrada | nao | decisao |

**T1 e T2 sao decisao do dono e as duas travam a tela.** Fazer T0 e perguntar T1 e
T2 no comeco, para o resto correr em paralelo enquanto ele responde (licao da
secao 6 do `PROCESSO.md`: perguntar no ponto exato, com o EFEITO na mesa).

---

## T0 — Empurrar os dois commits

O push foi **negado pelo classifier** na sessao de 09/09, exatamente como no
Bloco 1. Nao e erro de git: o remote esta certo (`github`; o `origin` e proxy
morto) e a tree esta limpa.

```
git push github HEAD:main
```

Se negar de novo, pedir ao dono para rodar com o prefixo `!` no prompt.

Conferir depois:
```
git fetch github main && git rev-list --left-right --count github/main...HEAD
```
Esperado: **`0 0`**.

Enquanto isso nao acontece, **o banco esta a frente do repo publicado**: as cinco
migrations estao aplicadas em `unjzpyexgtbcmjfgcqrx` e o codigo delas so existe na
maquina local.

---

## T1 — D6: a coluna `calc_carga.texto_bruto` fica ou sai?

**Decisao do dono. Nao decidir por ele.**

A coluna guarda a lista colada **enquanto a carga esta em rascunho**, e e apagada
no instante em que a carga e aprovada ou descartada. So o papel `dono` do proprio
tenant enxerga.

O EFEITO de cada opcao, que e o que ele precisa para decidir:

| Opcao | O que acontece |
|---|---|
| **Fica** | Resolver pendencia reprocessa na hora, e a cobertura sobe na tela enquanto ele decide. O passo 3 do wizard tem retorno imediato |
| **Sai** | Resolver pendencia so ensina o catalogo. A cobertura daquela carga **nao muda**: ele resolve 12 pendencias, ve o mesmo numero, e o ganho so aparece na carga do mes seguinte |

A tensao e real e esta declarada: a spec (secao 2.3 do plano) diz *"o texto e
processado e o bruto e descartado; se um dia for guardado, bucket privado com
retencao declarada"*. A implementacao adotou a segunda metade da frase.

**Se ele vetar:** tirar a coluna, tirar o trecho de reprocesso de
`calc_pendencia_resolver` (a funcao passa a so ensinar o catalogo e marcar a
decisao), e o passo 3 da tela passa a dizer com todas as letras que o efeito e na
proxima carga. Migration nova, pelo `base`.

**Registrar a resposta no handoff v4 como D6**, decidida, com a data.

---

## T2 — Declarar o denominador da cobertura ANTES de medir o portao

**Isto e o mais perigoso da lista**, porque nao parece um problema.

O portao do Bloco 2 e `cobertura >= 89%`. Hoje o parse calcula:

```
cobertura = n_casou / n_lidas
n_lidas   = linhas com preco legivel, MENOS as descartadas por regra ativa
```

Ou seja, **linha descartada nao entra no denominador**. A escolha e defensavel
(descarte nao e falha de leitura, e decisao de negocio do dono), mas ela **muda o
numero do portao**: com os descartes dentro, a mesma carga mede menos.

O historico de onde vem o 89% (`references/aprendizados.md`, carga de 27/07/2026)
**nao diz qual dos dois denominadores foi usado**. Comparar 89% medido de um jeito
com 89% medido de outro e comparar coisas diferentes, e o portao passa ou reprova
por acidente de definicao.

O que fazer:
1. Abrir `references/aprendizados.md` e o handoff da carga de 27/07 e verificar se
   da para recuperar como os 690 e os 612 foram contados.
2. Se der: alinhar o parse aquela definicao.
3. Se nao der: **o dono decide qual conta vale**, e a decisao vira texto no
   `CONTRATO`/plano, com a formula escrita.
4. Em qualquer caso, a tela do 2.3 tem que **mostrar as duas linhas**, nunca so a
   porcentagem:
   ```
   casaram 612 de 690 linhas (89%)
   + 25 linhas descartadas por regra (nao entram na conta)
   ```
   Cobertura sem o denominador visivel mente por omissao, igual a aba Conteudo que
   mostrava 3 de 8 sem declarar a janela (v33).

---

## T3 — A baseline de advisors subiu de 3 para 7

`docs/calculadora/PROCESSO.md` diz **3 WARN** em dois pontos, e os dois estao
desatualizados desde 09/09/2026:

- linha ~135: *"a baseline de advisors (hoje **3 WARN**: `registrar_venda`,
  `remover_nf`, leaked password protection)"*
- linha ~224 (checklist de fechamento): *"`get_advisors(security)` sem achado novo
  alem dos 3 WARN"*

Sao **7**. Os 4 novos sao as RPCs do Bloco 2 caindo no lint
`0029_authenticated_security_definer_function_executable`: `calc_carga_abrir`,
`calc_carga_aprovar`, `calc_carga_descartar`, `calc_pendencia_resolver`.

**Nao e achado, e consequencia declarada do desenho:** `SECURITY DEFINER` +
`grant execute to authenticated`, com a barreira de papel no CORPO da funcao
(`fn_papel_atual() <> 'dono'` levanta excecao), seguindo o precedente que
`registrar_venda` e `remover_nf` ja estabeleceram no projeto.

Atualizar os dois pontos para **7 WARN**, listando os sete. Sem isso a proxima
sessao trata os 4 como regressao e vai cacar defeito que nao existe, ou pior,
"conserta" tirando o GRANT e quebra a tela.

---

## T4 — A prova nova nao esta em suite nenhuma

Medido em 09/09/2026: as provas SQL do repo (`ferramentas/prova_*.sql`) **nao
aparecem no `CLAUDE.md`**. A suite documentada sao onze comandos, todos `python` e
`node`; `prova_entrega.sql`, `prova_escopo.sql`, `prova_molde.sql` e agora
`prova_calc_parse.sql` so sao citadas dentro de handoffs.

Consequencia: **uma prova que nao esta em suite nenhuma nao roda de novo.** Ela
provou o parser uma vez e depois vira arquivo morto, e a regressao volta calada.
E exatamente a falha que o `diag_calc.py` corrigiu para a geometria da calc.

O que fazer, na ordem barata:
1. Acrescentar ao `CLAUDE.md`, no bloco da suite, uma secao curta **"provas de
   banco"**, listando as quatro `ferramentas/prova_*.sql` e dizendo que rodam por
   MCP ou SQL Editor, que terminam em `raise exception` de proposito, e que o
   resultado e a MENSAGEM (`PASSOU:` / `REPROVOU:`), nunca o exit code.
2. Acrescentar ao checklist de fechamento do `PROCESSO.md`: *"prova de banco do
   dominio tocado, rodada e com a mensagem colada no handoff"*.

Nao tentar embrulhar SQL na suite python agora: isso e obra, nao rebarba. Listar
ja resolve o esquecimento.

---

## T5 — A armadilha `\y` precisa estar no arranque

Em Postgres, `\b` e o caractere **BACKSPACE**; fronteira de palavra e **`\y`**.
Escrever `\b` nao da erro: o regex nunca casa e a funcao devolve NULL em silencio.

```
regexp_match('macbook air m4 13   ', '\b(11|13|14|15|16)\b')  ->  NULL
regexp_match('macbook air m4 13   ', '\y(11|13|14|15|16)\y')  ->  13
```

Hoje isso esta registrado no cabecalho de
`supabase/migrations/20260909_calc_parse_helpers.sql` e na secao 4.1 do handoff v3.
**Quem nao abrir esses dois arquivos repete o erro.**

Levar para o `CLAUDE.md`, ao lado da regra do `calc()` com `+` colado, que e da
mesma familia (sintaxe que falha em silencio):

> `\b` em regex de Postgres e BACKSPACE, nao fronteira de palavra. Fronteira e
> `\y`. Nao da erro: o regex simplesmente nunca casa. Medido em 09/09/2026, valia
> para 8 regex do parser da calculadora.

---

## T6 — Versionar as 3 migrations do Bloco 1

`calc_catalogo_duas_camadas`, `calc_catalogo_semente` e
`calc_catalogo_tenant_pitstop` (08/09/2026) foram aplicadas no banco e **nunca
entraram no repo**. Conferido:

```
git ls-files supabase/migrations/ | grep calc
```
devolve so `20260721_calc_dados.sql`.

O handoff v2 declarou o Bloco 1 fechado com o SQL fora do git. Recuperar (43 KB):

```sql
select name, array_to_string(statements, E';\n') as sql
  from supabase_migrations.schema_migrations
 where name in ('calc_catalogo_duas_camadas','calc_catalogo_semente',
                'calc_catalogo_tenant_pitstop')
 order by version;
```

Gravar como `supabase/migrations/20260908_calc_catalogo_duas_camadas.sql`,
`..._semente.sql` e `..._tenant_pitstop.sql`.

**Delegar a extracao a um subagente** (`base` tem `Write`), para os 43 KB nao
passarem pelo contexto da sessao principal.

Prioridade: fazer **antes do Bloco 4** (nascimento de tenant), que le a semente.
Sem o SQL versionado, o retrato que toda conta nova herda nao tem fonte no repo.

---

## T7 — A skill `calculadoras` ficou para tras

O `CLAUDE.md` diz que essa skill *"tem regra propria de auto-atualizacao a cada
mudanca de caminho"*. O caminho mudou duas vezes e ela nao acompanhou:

- **Bloco 1** tirou o catalogo de
  `.claude/skills/calculadoras/references/formato-dados.md` e botou em cinco
  tabelas. O arquivo ainda se apresenta como *"o dicionario do parser"*, e nao e
  mais: quem manda agora sao `calc_modelo`, `calc_cor`, `calc_alias`, `calc_regra`
  e `calc_fornecedor`.
- **Bloco 2, fatia 1** tirou o parse do Claude e botou em `privado.calc_parse`. O
  `references/procedimento-alimentacao.md` descreve o passo a passo manual (parsear
  no chat, montar o blob, gravar por MCP) que a RPC substitui.

O que fazer, sem apagar historia:
1. No topo de `formato-dados.md`, um aviso: o catalogo canonico agora vive nas
   tabelas; este arquivo passa a ser **retrato historico e explicacao das REGRAS
   de leitura**, nao a fonte.
2. Em `procedimento-alimentacao.md`, marcar o caminho manual como **rota de
   contingencia** e apontar o caminho novo (as RPCs, e a tela quando existir).
3. Nao reescrever a skill inteira agora. Ela volta a valer a pena depois da tela,
   quando o caminho novo estiver fechado.

---

## T8 — Provar o isolamento das 3 tabelas novas com JWT

Hoje `calc_carga`, `calc_pendencia` e `calc_uso` tem a policy **lida**, nao
**exercitada**. Com as tabelas vazias o teste devolveria 0 para todo mundo e nao
provaria nada, entao ele depende de existir uma carga gravada — ou seja, roda
**durante ou logo depois da fatia 2**.

Vetor exato, na forma que o projeto ja usa (forjar tenant e pelo `sub`, nunca pelo
`app_metadata`), e sempre em bloco que termina desfazendo:

| Quem | Consulta | Esperado |
|---|---|---|
| `dono` do `...0001` | `count(*) from calc_carga` | **1** |
| `vendedor` do mesmo tenant | `count(*) from calc_carga` | **0** |
| uid fora de `app_usuario` | `count(*) from calc_carga` | **0** |
| `vendedor` | `perform calc_carga_abrir('x')` | **raise exception** |
| uid fora de `app_usuario` | `perform calc_carga_abrir('x')` | **raise exception** |

As duas ultimas linhas sao as que o lint `0029` **nao mede**: ele so diz que a
funcao e chamavel por `authenticated`, nao que a barreira interna funciona.

Quem roda: `bandeira`. Quem constroi nao prova.

---

## T9 — Duas decisoes de desenho sem registro

Levantadas pelo `base` na aplicacao e ainda nao decididas por gente:

**T9a — Auditoria.** Nenhuma das tres tabelas novas tem trigger de auditoria. Hoje
isso e coerente (escrita so por RPC, e `calc_carga` ja carrega `aprovado_por` e
`aprovado_em`), mas **nunca foi decidido explicitamente**. Aprovar carga muda preco
de venda: e decisao de gente, nao fotocopia de sistema de terceiro. Levar ao dono
com a pergunta estreita: *"quer saber quem aprovou e quando (ja tem), ou quer o
antes e depois do blob a cada aprovacao (nao tem, e o blob e grande)?"*

**T9b — `calc_uso` esta criada e vazia, de proposito.** Ela existe para a cota de
3.000 linhas/mes da spec (secao 2.6), mas **nenhuma RPC a incrementa**, porque o
passo de LLM sobre a pilha nao reconhecida nao foi construido. Declarar isso no
handoff em vez de deixar a tabela sugerindo uma funcionalidade que nao existe. A
cota entra quando o modelo entrar.

---

## Portao deste plano

Nao ha portao tecnico: e trabalho de alinhamento. Considera-se cumprido quando:

- [ ] `git rev-list --left-right --count github/main...HEAD` devolve **`0 0`**
- [ ] D6 respondida pelo dono e registrada, com data
- [ ] o denominador da cobertura escrito por extenso, com a formula
- [ ] `PROCESSO.md` dizendo **7 WARN** nos dois pontos, com os sete listados
- [ ] `CLAUDE.md` com a secao de provas de banco e com a armadilha `\y`
- [ ] `git ls-files supabase/migrations/ | grep calc` devolvendo **6** arquivos
      (`20260721_calc_dados` + as 3 do Bloco 1 + ... na verdade **9**, contando as
      5 do Bloco 2: conferir a contagem no dia em vez de confiar nesta linha)
- [ ] os dois `references/` da skill `calculadoras` com o aviso de topo
- [ ] T8 e T9 **registrados como pendentes** no handoff v4, com o vetor de prova
      escrito (eles nao se resolvem nesta sessao, e tentar antecipar T8 sem carga
      gravada e desperdicio)

Depois disso, e so depois, **a fatia 2: a tela `/calc/alimentar`.**

---

## O que NAO fazer nesta sessao

- Nao comecar a tela. Ela e a fatia 2 e depende de T1 e T2.
- Nao reescrever a skill `calculadoras` inteira (T7 e um aviso de topo, nao obra).
- Nao "consertar" o lint `0029` tirando o GRANT das RPCs: a tela quebra e o
  precedente do projeto e esse. Ver T3.
- Nao repontar a baseline de nenhuma prova para calar guard-rail.
- Nao rodar T8 antes de existir carga gravada: devolve 0 para todos e nao prova nada.
