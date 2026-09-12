# Processo de execucao de um bloco da linha `calculadora`

Como conduzir do arranque ao fechamento um bloco do plano
`docs/superpowers/plans/2026-09-05-calculadora-produto.md`.

Escrito em 08/09/2026, com o que foi **medido** na execucao do Bloco 1. Vale para
o Bloco 2 em diante.

**Este arquivo nao repete fato de dominio.** Nome de tabela, SQL, contagem e
regra de negocio moram no plano, na spec e na skill `calculadoras`. Aqui esta
so o PROCESSO. Se um fato aparecer nos dois lugares, os dois divergem: foi
exatamente assim que o `CLAUDE.md` ficou 17 versoes desatualizado.

Nota de linguagem: prosa sem acento, sem cedilha, sem travessao (convencao do
`CLAUDE.md`). Valores reais do sistema aparecem exatos.

---

## 1. Arranque: ler nesta ordem, medir antes de tocar

1. `CLAUDE.md`.
2. `docs/runbook-operacao.md` — sessoes concorrentes, o remote real, armadilhas
   de Git Bash no Windows, EXIT CODE.
3. `docs/handoffs/handoff_indice_pitwall.md`, secao **Linha calculadora** — aponta
   o topo vivo. **Nao abrir o maior numero da pasta**: ele e da linha `migracao` e
   nao enxerga este produto.
4. O handoff de maior versao da linha (`handoff_calculadora_pitwall_vN.md`).
5. `docs/superpowers/specs/2026-09-05-calculadora-produto-design.md` — o desenho.
   **Se o plano divergir da spec, a spec ganha e voce avisa.**
6. O plano, so a secao do bloco que voce vai executar.
7. So entao a skill `calculadoras` e os 4 `references/` dela. Lembrar: **invocar a
   skill carrega SO o corpo do `SKILL.md`; os `references/` sao ponteiro.** Quem
   precisa do catalogo abre `references/formato-dados.md` por caminho.

Depois de ler, **medir**, nunca herdar de documento:

```
git remote -v
git fetch github main && git rev-list --left-right --count github/main...HEAD
git status --short
git log -3 --format='%h %ad %s' --date=format:'%d/%m %H:%M'
```

Tree suja ou commit que voce nao fez = **outra sessao viva nesta pasta**, ou o
workflow de backup diario (ele toca so `backups/`). Ler a secao 1 do runbook antes
de qualquer coisa.

E medir o banco por MCP, com a consulta de estado que o handoff da secao "Estado
vivo" traz. Numero que nao bate = o handoff envelheceu, e o handoff que se corrige.

---

## 2. A regra que mais economizou tempo: plano e hipotese datada

O plano `2026-08-19-segundo-lojista-tenant.md` foi escrito com estado medido e,
**18 dias depois, nenhuma das sete tarefas estava feita** e cinco afirmacoes dele
eram falsas. O Bloco 1 repetiu o padrao em escala menor: tres pontos do plano
estavam errados e so a execucao mostrou.

**No inicio de cada bloco, remedir o estado antes de executar o passo escrito. E
quando a execucao contradisser o plano, corrigir o documento NA HORA**, com o
numero medido e a data, em vez de deixar para o fim.

Exemplo do Bloco 1, e ele teria reprovado o portao: o plano mandava carregar
"66 iPhones". O catalogo real sao 124 modelos, porque o blob usa 118. Contar 66
deixaria 52 nomes de fora.

---

## 3. Ordem de trabalho dentro do bloco

```
medir estado  ->  gerar o artefato  ->  PRE-CHECAR contra o dado vivo
              ->  aplicar  ->  provar  ->  tela  ->  suite  ->  commit  ->  push
              ->  curl  ->  corrigir plano  ->  handoff  ->  indice
```

### 3.1 Gerar por script, nunca a mao

Todo seed, toda carga em massa e toda lista longa sai de um script no scratchpad,
nao de SQL digitado. Motivo medido: o catalogo do Bloco 1 tem acentos, cedilha,
travessao `—` e aspas em nome de modelo (`MacBook Air M4 13" 16/256GB`). **Esses
caracteres sao valores reais do sistema**, e um deles trocado a mao vira defeito
que so aparece no portao, quando ja custou a sessao inteira.

O script vira o registro de como o dado foi montado, e regerar e barato.

### 3.2 PRE-CHECAR antes de gravar

Antes de escrever qualquer coisa, rodar uma consulta que compara o artefato com o
dado vivo e devolve **as divergencias, nao um "ok"**. No Bloco 1 foi o catalogo
contra o blob de 494 produtos: voltou zero linha, e so por isso o seed entrou de
primeira.

Truque que vale reusar: para nao trafegar 99 KB de blob, o catalogo viaja como
**um literal so**, quebrado em linha com `string_to_array(...,'~')` e
`split_part(...,'^',n)`. A consulta cabe em 5 KB e compara centenas de linhas.

### 3.3 Cada bloco termina em algo que o dono ABRE

Ordem do dono, 17/07/2026: *"faca sempre palpavel."* Encanamento provado sem tela
nao fecha bloco. Se a fase e grande, a tela entra junto, nao depois.

E o portao so esta cumprido quando **ele abre**. Provar por maquina que o dado
esta la e a tela esta publicada e metade; a outra metade e dele, e se diz isso na
entrega em vez de declarar pronto.

---

## 4. Quem faz o que, e o que fazer quando trava

Roteamento (o `CLAUDE.md` tem a tabela completa):

| Assunto | Agente |
|---|---|
| schema, RLS, RPC, migration, grant | `base` (**unico com `apply_migration`**) |
| tela, CSS, `public/`, Worker | `vitrine` |
| caminho de escrita, isolamento, PII | `pit-guard` |
| prova, regressao, criterio de aceite | `bandeira` |

**A Torre nao e subagent.** Ela roteia e cola o resultado de um no prompt do
proximo. Subagent nao fala com subagent.

### 4.1 Como escrever o prompt do subagente

Medido no Bloco 1: o `base` funcionou bem porque o prompt trazia **o SQL pronto em
arquivo, as verificacoes uma por uma, e o valor esperado de cada uma**. Ele aplicou
sem reescrever e reportou a unica divergencia (48 contra 49) **sem tentar
adivinhar** o que faltava. Esse e o comportamento certo, e ele veio de instrucao
explicita: *"nao reescreva, nao melhore, nao corrija acento"*.

Sempre incluir no prompt:
- o caminho do arquivo, para ele nao reconstruir o conteudo de cabeca;
- cada verificacao com o **numero esperado**, e qual resultado e reprovacao grave;
- a baseline de advisors, para "achado novo" ter significado. Medida em
  **11/09/2026: NOVE achados**. SEIS sao RPCs do Bloco 2 (`calc_carga_abrir`,
  `calc_carga_aprovar`, `calc_carga_descartar`, `calc_catalogo_criar`,
  `calc_config_margem_salvar`, `calc_pendencia_resolver`), somadas a
  `registrar_venda`, `remover_nf` e o leaked password protection.
  Ate 11/09/2026 este bloco dizia **sete**, numero de 09/09, e listava so quatro
  `calc_*`. O custo apareceu na mesma tarde: o prompt da D18 saiu com a baseline
  velha e o `base` teve que reportar "9, e nenhum entrante" como divergencia,
  gastando uma ida e volta para descobrir que quem estava errado era o processo.
  **Os seis NAO sao achado, sao consequencia declarada do desenho:**
  `SECURITY DEFINER` mais `grant execute to authenticated`, com a barreira de papel
  no CORPO da funcao (`fn_papel_atual() <> 'dono'` levanta excecao), seguindo o
  precedente que `registrar_venda` e `remover_nf` ja abriram. Quem tratar os seis
  como regressao vai cacar defeito que nao existe, ou pior, "consertar" tirando o
  GRANT e quebrar a tela;
- que ele **nao commita e nao empurra**. Quem commita e a Torre.

### 4.2 Subagente que trava

Em 08/09/2026 o `vitrine` **travou no watchdog** (600s sem progresso) sem escrever
uma linha. A Torre construiu a tela e registrou.

Regra: **uma tentativa; travou, a Torre executa e REGISTRA no handoff.** Reenviar
custa mais que refazer, e a separacao de papeis existe para auditabilidade, nao
como ritual. Registrar e o que impede a excecao de virar habito silencioso.

---

## 5. Prova

A suite completa esta no `CLAUDE.md`, **onze comandos**. Duas coisas que se
esquecem e custam caro:

1. **Conferir o EXIT CODE, nunca o texto.** `validar.py` imprime dezenas de linhas
   verdes e ainda pode terminar em `REPROVOU:`.
2. **`harness.py` mede `public/app.js`, o PAINEL.** Quem mexe em `public/calc/`
   precisa de `prova_catalogo.js`, `prova_cpo.js`, `prova_sem_margem.js` e
   `diag_calc.py`. Antes de 08/09/2026 **nenhuma ferramenta media a calc**, e por
   isso um defeito de layout ficou anos no ar com a suite verde.

Toda mudanca na calc roda tambem:

```
node ferramentas/prova_catalogo.js
for w in 360 390 414; do python ferramentas/diag_calc.py $w; done
```

### 5.1 A prova nova acompanha a construcao

Nao e opcional e nao vem depois. Ela le o **arquivo real** (`fs.readFileSync`),
nunca uma copia da logica: prova que copia a logica prova a si mesma.

E o stub **nunca usa o valor real**. O nome da loja no mock e `Loja de Prova`, nao
`Pitstop Imports`: com o nome real, marca fixa de volta no HTML passaria verde.

### 5.2 Falhou: e minha ou ja vinha?

Nao chutar. Isolar contra o `HEAD` (receita na secao 3 do runbook). Ha uma
instabilidade **conhecida e documentada** (`fin: OFX sem lancamento diz o que
houve`, cai em cerca de 1 de 3 corridas). Se for so ela, registrar. **Nao alargar
o `finAte` para calar**, e nao repontar baseline no meio da obra.

### 5.3 Prova de banco sem sujar producao

Bloco `DO` que testa e termina em `raise exception`: a transacao inteira volta.
Isolamento se prova com JWT de cada papel, nao lendo a policy.

### 5.4 Mudanca no LEITOR se mede antes e se pre-prova antes de aplicar

Duas regras que nasceram medidas, nas duas pontas do mesmo dia (11/09/2026).

**Medir o defeito no codigo VIVO antes de consertar.** Na D18 a fixture obvia
(cabecalho descartado sem fornecedor conhecido acima) **nao reproduzia o defeito**:
a guarda G3 pegava sozinha e devolvia "esta resposta nao ensina nada". O preco
errado so aparece quando existe um fornecedor RECONHECIDO acima para absorver o
bloco. Quem escreve a assercao sem medir antes escreve uma assercao que passa
com o defeito no ar, que foi exatamente o que aconteceu com a R14.

**Pre-provar dentro de bloco revertido ANTES de aplicar.** A primeira correcao da
D17 foi aplicada sem isso, nao funcionou, e custou uma migration a mais e a
sessao inteira de credito do documento (o cabecalho dela afirma um conserto que
nao aconteceu). A receita que funcionou na D18, em UMA chamada de `execute_sql`:

```
migration sem o cabecalho e sem o `commit;`
  + guarda de md5 dos corpos gravados (pega erro de transcricao)
  + o bloco de prova
  + `raise exception`
```

Tudo volta, e a mensagem diz se o conserto conserta. Duas coisas que o tamanho
cobra: o payload tem que caber em UMA chamada (quebrar em duas aplica a primeira
metade e mata o rollback), e para caber vale tirar comentario **fora de string**
por script, nunca a mao.

---

## 6. Perguntar ao dono: quando, e como

O plano marca os pontos onde a decisao e dele. Duas regras aprendidas:

**Perguntar no ponto exato, nao no comeco nem no fim.** No Bloco 1 a pergunta
sobre descarte travava so o insert das regras: o schema foi aplicado em paralelo e
a sessao nao parou.

**Levar o EFEITO junto, nao so a opcao.** Ele desligou as quatro regras de
descarte na primeira passada. Voltar com *"tres sao inofensivas, mas esta gera
preco errado porque `caixa aberta` nao impede o modelo de casar, e o aparelho vira
o menor custo"* mudou a decisao. Pergunta sem consequencia na mesa e formulario;
com consequencia, e conselho.

**Nao inventar numero que custa dinheiro dele.** A D4a (comissao de `Acessório`)
segue aberta porque ele paga comissao real ao Brendon. Sugerir estrutura, sim;
arbitrar valor, nao.

E quando ele decide contra o conselho: **registrar como decisao consciente e
seguir**, sem reabrir a cada sessao.

---

## 7. Fechamento

Checklist da secao 7 do runbook, mais o que e desta linha:

- [ ] `git log -3` e `git status` conferidos (outra sessao viva?)
- [ ] estado do banco medido, nao herdado
- [ ] suite completa, **EXIT CODE** nos onze comandos
- [ ] `diag_calc.py` nas tres larguras, se tocou `public/calc/`
- [ ] falha nova isolada contra o `HEAD` antes de culpar a propria mudanca
- [ ] prova nova cobrindo o que foi construido, com stub que **nao** usa valor real
- [ ] `get_advisors(security)` sem achado novo alem dos **9** de 11/09/2026 (os 6
      `calc_*` do Bloco 2, `registrar_venda`, `remover_nf`, leaked password)
- [ ] a query da restricao global 10 devolvendo **zero** (nenhuma FK de `calc_*`
      para tabela de operacao: a calc tem que poder sair inteira depois)
- [ ] `git add <caminho>` explicito (`git add -A` esta **mecanicamente negado**)
- [ ] mensagem de commit por arquivo (`git commit -F`), nunca here-string de
      PowerShell no Bash
- [ ] `git push github HEAD:main` (o `origin` e proxy morto)
- [ ] `curl` no worker provando o que subiu, **em `/calc/`, nunca `/calc/index.html`**
- [ ] plano atualizado com a secao `BLOCO N FECHADO` e o que a execucao contradisse
- [ ] handoff `vN+1` criado e `handoff_indice_pitwall.md` apontando para ele
- [ ] `CLAUDE.md` conferido se a suite, a arvore ou o arranque mudaram

### 7.1 Push rejeitado

Se voltar non-fast-forward, **medir antes de reagir**:

```
git fetch github main
git log --oneline HEAD..github/main       # o que veio de la
git diff --name-only HEAD...github/main   # quais arquivos
```

Se os arquivos nao cruzam com os seus (o caso comum e o backup diario, que toca so
`backups/`), rebasear e seguro e **conferir o conteudo depois do rebase** antes de
empurrar. Se cruzam, ler a secao 2 do runbook: **nao rebasear em arquivo grande
renormalizado**, mover a base e reaplicar as edicoes.

**Nunca `--force`.** Em 15/08/2026 o clone estava 25 commits atras e um force teria
apagado tres dias de trabalho.

---

## 8. O que NAO fazer

- Nao commitar export de fornecedor, nem como corpus de teste. Dado comercial de
  terceiro vive em `privado` ou e sintetico.
- Nao criar FK de `calc_*` para tabela de operacao (`lead`, `venda`, `conteudo`,
  `fin_*`). So `tenant`, `app_usuario` e os helpers de `privado`.
- Nao adicionar `or tenant_id is null` em policy de catalogo. A semente e
  invisivel em execucao **de proposito** (D5).
- Nao aceitar `tenant_id` vindo do payload do cliente. Sempre
  `privado.fn_tenant_atual()` dentro da RPC.
- Nao deixar linha nao entendida virar preco. Duvidoso e nao reconhecido nao
  entram no blob, em circunstancia nenhuma.
- Nao gravar carga sem diff aprovado por gente.
- Nao contar com o `begin;` / `commit;` do corpo da migration para proteger o que
  vem DEPOIS dele. Os arquivos desta linha abrem com `begin;` e fecham com
  `commit;` para poderem ser colados no SQL Editor, e isso fica; mas o
  `apply_migration` ja e transacional, e o `commit;` do corpo fecha a transacao
  externa antes do fim da chamada. Statement que venha depois do `commit;` nao e
  coberto por rollback nenhum. Medido pelo `base` em 11/09/2026, sem efeito
  porque nao havia nada depois: entao **nao ha nada depois do `commit;`**.
- Nao usar `calc()` com `+` ou `-` colado: e CSS invalido, o Chrome descarta a
  declaracao **em silencio**, e foi assim que as duas calcs ficaram sem respiro
  embaixo. Sempre `calc(a + b)`, com espaco.
- Nao reabrir o invariante 17 (SaaS antes do primeiro pagamento). Ja foi apontado
  e o dono decidiu seguir, conscientemente.

---

## 9. O proximo bloco

**Bloco 2, a tela `Alimentar`.** Detalhe tecnico na secao correspondente do plano.
Nao ha bloqueador: a D4a trava so o passo 3.3, dentro do Bloco 3.

O que o Bloco 1 ja entregou para ele, e evita retrabalho:

- o parse ja tem contra o que casar (`calc_modelo`, `calc_cor`, `calc_alias`,
  `calc_regra`, `calc_fornecedor`, todos populados no tenant);
- a RLS filtra sozinha: **nao se passa `tenant_id` no cliente**;
- a ordem de condicao ja e **dado** (`calc_regra.prioridade`, CPO 10 antes de
  Lacrado 20), entao o parser le a regra em vez de carregar a ordem no codigo;
- **nao ha resolucao de sobreposicao a implementar.** O plano previa regra do
  tenant sobrepondo uma global de mesmo `padrao`; com a D5 nao existe global viva.
  Isso simplifica o 2.2;
- o painel `Catalogo` ja e a superficie onde os interruptores de regra entram,
  junto com `calc_pendencia_resolver`. Ele nasceu **so leitura** de proposito.

O portao do Bloco 2 e o mais importante do plano inteiro, e ele nao e tecnico: **o
dono roda a carga do mes pela tela, sozinho, sem Claude Code**, com
cobertura **nao menor que a do caminho atual da skill, na MESMA entrada** (D7,
09/09/2026). A mesma lista passa pelos dois caminhos e se comparam `casou / lidas /
descartadas`. O antigo `>= 89%` caiu porque **o 89% nao tem medicao de origem**: o par
`612 de 690` era exemplo de FORMATO em `procedimento-alimentacao.md:92`, promovido a
fato pela spec de 05/09. Detalhe na secao 2.6b da spec.
