# Runbook de operacao: sessoes, git, prova e deploy

Como trabalhar neste repo sem que uma sessao atropele a outra, sem commitar
vermelho e sem achar que subiu quando nao subiu.

Escrito em 07/09/2026, com o que foi **medido** na sessao do Bloco 0 da
calculadora. Nao repetir aqui o que o `CLAUDE.md` ja diz: este arquivo e o
detalhe operacional, o `CLAUDE.md` e a regra.

Nota de linguagem: prosa sem acento, sem cedilha, sem travessao (convencao do
`CLAUDE.md`). Valores reais do sistema aparecem exatos.

---

## 1. Varias sessoes na mesma pasta: a regra que custou caro

Rodam **varias sessoes de Claude Code na MESMA pasta ao mesmo tempo.** Medido em
06/09/2026: 18 sessoes abertas, a maioria ociosa ha dias. Elas compartilham UMA
working tree e UM index do git. O git nao sabe distinguir quem editou o que.

### O que aconteceu

O commit `c4017e4`, cuja mensagem fala de handoff do Financeiro, levou junto
**24 linhas de `public/calc/index.html`** que outra sessao estava editando
naquele minuto. Conteudo intacto, atribuicao errada, e o autor do trabalho so
descobriu depois.

### A trava, e ela e mecanica

`.claude/settings.json` (versionado, lido por toda sessao desta pasta) **nega**:

```
git add -A · git add --all · git add . · git add -u
git commit -a · git commit -am · git commit --all
```

Provado em 07/09/2026: `git add -A` volta `Permission ... has been denied`, na
sessao ja aberta, sem reiniciar. `git add <caminho>` continua funcionando.

**Sempre `git add <caminho explicito>`.** Nunca staging por varredura.

### Antes de commitar, sempre

```
git log -3 --format='%h %ad %s' --date=format:'%d/%m %H:%M'
git status --short
```

Apareceu commit que voce nao fez, ou a tree limpou sozinha? **Outra sessao esta
viva nesta pasta.** Nao refaca o trabalho: ele provavelmente ja esta commitado,
possivelmente sob mensagem de outra frente. Confira com
`git log -1 -- <o arquivo que voce editava>`.

### Achar QUAL sessao

`ListAgents` lista as sessoes vivas da maquina, mas o nome nao diz o assunto. O
jeito deterministico e o transcript:

```
P="C:/Users/jessi/.claude/projects/c--Users-jessi-OneDrive-Documentos-pitswall-claude"
for f in "$P"/*.jsonl; do n=$(grep -c "<hash ou termo do trabalho>" "$f"); \
  [ "$n" -gt 0 ] && echo "$(basename $f .jsonl) | $n"; done
```

Depois, para saber o assunto de cada candidata, a primeira mensagem do usuario:

```
grep -o '"type":"user".\{0,300\}' "$P/<id>.jsonl" | head -1
```

Foi assim que a sessao culpada foi identificada: primeira mensagem `P-ABRE`,
ou seja, uma sessao do condutor do Financeiro.

**Higiene:** feche o que nao esta em uso. Sessao ociosa ha dias e risco puro sem
valor nenhum.

---

## 2. Git: o remote e as armadilhas de Windows

### O remote NAO e o `origin`

```
git remote -v
```

Estado em 07/09/2026: **`origin` e um proxy morto** (`127.0.0.1:41729`) e cega
push E fetch. O remoto real e **`github`**:

```
git push github HEAD:main
```

O nome ja mudou tres vezes (`origin` -> `github` em 15/08, so `origin` em 17/08,
`github` de novo em 07/09). **Medir na hora com `git remote -v` e mais barato que
qualquer correcao depois.**

### Medir o atraso ANTES de commitar

```
git fetch github main
git rev-list --left-right --count github/main...HEAD
```

Saida `25  1` = 25 atras, 1 a frente. Em 15/08/2026 o clone estava 25 commits
atras e um `--force` teria apagado tres dias de trabalho. Se estiver atras num
arquivo grande e renormalizado, **nao rebasear**: mover a base e reaplicar as
edicoes, que sao poucas.

### Sessao sem DNS

Algumas sessoes rodam em sandbox sem resolucao de nome:

```
fatal: unable to access '...': Could not resolve host: github.com
```

**Isso nao e remote quebrado.** E rede. O ref local `github/main` fica velho e
`rev-list` mente enquanto isso.

**Mas TENTE DE NOVO antes de concluir que a sessao nao tem rede.** Medido em
07/09/2026: o mesmo host falhou com `Could not resolve host` e, no mesmo turno
minutos depois, `git push github HEAD:main` passou sem nenhuma mudanca de
configuracao. A falha era transitoria. Declarar "esta sessao nao empurra" cedo
demais custou um passo manual ao dono que nao era necessario.

### `git show <rev>:<caminho>` mente no Git Bash

Medido em 07/09/2026. O MSYS converte o argumento e o comando falha com
`ambiguous argument 'github\main;.claude\settings.json'`, o que **parece o
arquivo nao existir no branch**. Nao existe nada de errado com o arquivo.
Usar:

```
git ls-tree <rev> <diretorio>/
git show <rev> -- <caminho>
```

### Here-string de PowerShell no Bash

`git commit -m @'...'@` e sintaxe de **PowerShell**. Passada ao Bash, o `@` entra
literal e o assunto do commit vira `@ feat(...)`. Para mensagem multilinha no
Bash, escrever num arquivo e usar `-F`:

```
printf '%s\n' "linha 1" "" "linha 2" > "$SCRATCH/msg.txt"
git commit -F "$SCRATCH/msg.txt"
```

### CRLF

`warning: in the working copy of 'X', CRLF will be replaced by LF` e **normal**
nesta maquina, nao e erro. Corolario: **md5 de arquivo engana**; para provar que
um deploy subiu, comparar conteudo semantico, nao hash.

---

## 3. Prova: EXIT CODE, nunca o texto

A suite do frontend, da raiz do repo:

```
python ferramentas/validar.py
python ferramentas/harness.py
python ferramentas/prova_trilho.py
python ferramentas/prova_grafico.py
python ferramentas/prova_atmosfera.py
node --check public/app.js
for w in 360 390 414 1280 1440; do python ferramentas/diag_mobile.py $w; done
for w in 1500 1920 2560; do python ferramentas/diag_largo.py $w; done
```

Baseline em 07/09/2026, com o Bloco 0 fechado: **harness 1114 passou, 0 falhou**
(1119 declaradas, 1114 executadas, 5 de ramo alternativo), EXIT 0 nos oito.

- **`validar.py` imprime dezenas de linhas verdes e pode terminar em `REPROVOU:`.**
  Ler o texto por cima ja fez commitar vermelho. Conferir `$?`.
- `diag_mobile.py` roda **uma largura por vez**. Quem nao roda as cinco nao esta
  olhando para o celular.
- Ao assertar UI, consultar o DOM renderizado (`#lista`), nunca
  `document.body.textContent`, que enxerga o proprio `app.js` colado no `<body>`.

### Falhou: e minha ou ja vinha?

Nao chutar. Comparar contra o `HEAD`, com backup fora do repo:

```
cp public/app.js "$SCRATCH/app.js.meu"
git checkout -- public/app.js
python ferramentas/harness.py          # roda contra o HEAD
cp "$SCRATCH/app.js.meu" public/app.js # restaura
```

Foi assim que a falha `fin: OFX sem lancamento` foi isolada como **instabilidade
conhecida** (1 falha em 3 corridas com a mudanca, 0 em 1 contra o HEAD) e nao
como regressao.

**Assercao que incomoda nao se cala alargando o timeout.** O proprio harness
documenta que aquela ja caiu antes quando cresceu o numero de assercoes. Ou se
ataca a causa, ou se registra. Repontar baseline no meio da obra e proibido.

### O mock do harness precisa conhecer o que voce usa

Medido em 07/09/2026: `pwLoja()` chamava `.maybeSingle()` e a tabela `tenant`, e
o mock nao tinha **nenhum dos dois**. A funcao estourava calada dentro do proprio
`try` e a assercao nova nunca teria rodado. Ao usar um metodo novo do
supabase-js ou uma tabela nova, **estender `TABELAS` e a api do mock em
`ferramentas/harness.py`**.

**Stub nunca usa o valor real.** O nome da loja no mock e `Loja de Prova`, nao
`Pitstop Imports`: com o nome real, marca fixa de volta no HTML continuaria
passando verde.

---

## 4. Deploy e prova de que subiu

- Cloudflare publica sozinha no push (Workers Builds). **Empurrar E o deploy.**
  Do push ate servir o arquivo novo: **~30 segundos**, medido.
- "Nao esta no ar" quase sempre e **cache do navegador**. Provar com `curl` no
  worker, nunca com F5:

```
curl -s https://flat-resonance-09ba.pitstopimports.workers.dev/ | grep -c "<termo>"
```

- Para codigo da calc do dono a URL e **`/calc/`**, nunca `/calc/index.html`: o
  worker roda com `not_found_handling: single-page-application` e a segunda cai
  no fallback devolvendo OUTRA pagina, sem erro nenhum.

---

## 5. Banco

- `execute_sql` do MCP devolve **so o resultado do ultimo statement**. Cada
  verificacao e uma chamada separada.
- Schema e carga grande vao por `apply_migration` (transacional, aguenta acento e
  payload grande).
- **`CREATE OR REPLACE FUNCTION` reseta a ACL.** Refazer `REVOKE`/`GRANT` no
  mesmo migration, e conferir depois:

```sql
select proname, prosecdef,
       has_function_privilege('authenticated', oid, 'execute') as auth_pode,
       has_function_privilege('anon', oid, 'execute') as anon_pode
  from pg_proc where proname = '<funcao>' and pronamespace='public'::regnamespace;
```

  Conferir tambem `prosecdef`: reescrever uma funcao e deixar escapar um
  `SECURITY DEFINER` que ela nao tinha cria escalacao de privilegio numa RPC que
  `authenticated` chama.
- **Provar sem sujar producao**: bloco `DO` que testa e termina em
  `raise exception`, para a transacao inteira voltar.

```sql
do $$
begin
  begin
    <a coisa que deve falhar>;
    raise exception 'FALHOU: nao bloqueou';
  exception when foreign_key_violation then
    raise notice 'OK: bloqueou';
  end;
  raise exception 'rollback proposital, nada foi gravado';
end $$;
```

- Depois de DDL, rodar `get_advisors(type: 'security')` e comparar com a
  baseline. Em 07/09/2026 sao **3 WARN pre-existentes** (`registrar_venda`,
  `remover_nf`, leaked password protection). Achado novo = tratar antes de seguir.

---

## 6. Plano escrito nao e plano verdadeiro

O plano `2026-08-19-segundo-lojista-tenant.md` foi escrito com estado medido e,
**18 dias depois, nenhuma das sete tarefas estava feita** e o proprio plano tinha
erros que so a execucao revelou:

| O que o plano dizia | O que a execucao mediu |
|---|---|
| criar unique em `calc_dados.tenant_id` | ja existia `PRIMARY KEY (tenant_id)`. Redundante |
| `.single()` quebra com 2+ linhas | impossivel (PK + RLS). Quebra com **zero**, que e toda loja nova |
| duas formas da marca nos scripts | **seis**. O `UPDATE` dele deixaria `" Imports"` orfao em 17 |
| buscar marca por `ilike '%Pitstop%'` | seis scripts assinavam so `Vini`, invisiveis a essa busca |
| (nao mencionava) | **24 scripts com artigo masculino colado**: `aqui e o {vendedor}` mandaria "aqui e o Ana" ao cliente |

**Regra:** no inicio de cada bloco, remedir o estado antes de executar o passo
escrito. Plano e hipotese datada, nao verdade. E quando a execucao contradisser o
plano, **corrigir o documento na hora**, com o numero medido e a data.

---

## 7. Checklist de fechamento de qualquer obra

- [ ] `git log -3` e `git status` conferidos (outra sessao viva?)
- [ ] estado do banco medido, nao herdado de handoff
- [ ] suite completa, **EXIT CODE** nos oito comandos
- [ ] falha nova isolada contra o `HEAD` antes de culpar a propria mudanca
- [ ] assercao nova cobrindo o que foi construido, com stub que **nao** usa o valor real
- [ ] `get_advisors(security)` sem achado novo
- [ ] `git add <caminho>` explicito, nunca varredura
- [ ] mensagem de commit por arquivo (`-F`), nunca here-string de PowerShell
- [ ] `git remote -v` medido, push por `github`
- [ ] `curl` no worker provando o que subiu
- [ ] documento de plano atualizado com o que a execucao contradisse
- [ ] handoff e `docs/handoffs/handoff_indice_pitwall.md` atualizados
