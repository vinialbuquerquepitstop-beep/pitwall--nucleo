# CLAUDE.md — Pit Wall 2.0 (Nucleo)

Contexto de arranque para o Claude Code neste repositorio. E lido em toda sessao,
antes de qualquer coisa. Vale acima de qualquer instrucao interna de skill que
aponte para arquivo inexistente.

---

## Arranque de toda sessao (nesta ordem)

1. Ler o handoff de MAIOR versao em `docs/handoffs/`.
   O handoff mais novo substitui todos os anteriores. Hoje o topo e
   `handoff_migracao_pitwall_v37.md`. Conferir a pasta em vez de confiar nesta
   linha: ela ja ficou desatualizada antes (ficou presa no v32 ate 21/07/2026 e
   no v35 ate 23/07/2026).
2. Verificar o estado vivo do banco via MCP do Supabase antes de tocar em qualquer coisa.
3. Se o pedido tocar no visual do frontend, abrir `docs/design/referencia-visual-v3.html`
   ANTES de escrever CSS. Ela e a referencia de record, aprovada pelo dono.
4. So entao abrir a skill do dominio do pedido.

Nota sobre skills: hoje sao SEIS em `.claude/skills/`, todas COMPLETAS. As tres do
nucleo do produto:
- `pitwall-nucleo` (backend e frontend do sistema novo: Supabase, RLS, regua, deploy),
- `pitwall-conteudo` (pipeline Notion -> Pit Wall: cards, sync, Vetores, auditoria),
- `operacao-pitstop` (planilha/CRM legado no Google Sheets, conselho de negocio).

E tres adicionadas depois da v25:
- `auditoria-marketing` (time de auditoria semanal: Conteudo, Social, Comercial +
  braco propositivo Evolucao & Propostas; 4 `references/`),
- `apple-strategist` (estrategia de revenda Apple no varejo local),
- `socialmedia` (planejamento e CRM de Instagram).

Conferido em 16/07/2026: os 8 `references/` que a `pitwall-nucleo/SKILL.md` pede
existem e tem conteudo (`invariantes.md` 126 linhas, `modelo-de-dados.md` 117,
`regua-cadencia.md` 82...), e os 4 da `pitwall-conteudo` tambem. **Abrir esses
arquivos normalmente.**

Ate a v25 este bloco dizia que os `references/` nao existiam e mandava nao abri-los.
Era mentira, e cara: fez varias sessoes pularem o conhecimento acumulado do projeto e
reconstruirem de cabeca o que ja estava escrito.

---

## Postura: conselheiro critico, nao carimbo

O dono pediu explicitamente para NAO validar ideias de forma automatica. Diante de
uma proposta, a primeira pergunta interna e "por que isso vai custar caro ou falhar",
nao "como eu elogio". Nomeie a MAIOR falha primeiro, com clareza. Seja exato sobre o
que cada mudanca entrega, sem inflar. Segure a sequencia quando construir fora de
ordem gera retrabalho. Surface contradicoes entre trilhos de trabalho. Nao execute em
silencio instrucoes conflitantes. Se o dono decidir contra o conselho, registre que
foi decisao consciente dele e siga.

---

## Entregar palpavel

Ordem do dono, 17/07/2026: **"faça sempre palpável."** Dita logo depois de a Fase 6
entregar 9 objetos de banco, 17 RPCs, uma Edge Function e 31 provas, e **nenhuma tela
que ele pudesse abrir**.

Encanamento provado NAO e entrega. O dono nao julga, nao usa e nao corrige o rumo de
uma coisa que nao aparece. Quanto mais fundo se vai sem que ele veja, mais caro fica
descobrir que o desenho estava errado.

- Cortar a obra em fatias onde **cada fase termina em algo abrivel**. Se a fase e grande,
  a tela entra junto, nao depois.
- Em documento (handoff, plano, relatorio): comando exato copiavel, numero real medido,
  caminho de arquivo, nome exato do campo e de onde clicar. Nunca "configurar o token".
- Provar com o sistema rodando ganha de provar no papel.

---

## Invariantes duros (nunca colapsar nem inverter)

1. Sensor x regua: o sensor registra o que aconteceu; a regua le e decide a direcao.
2. Toque enviado x Respondido sao eventos distintos. Toque e acao do operador;
   Respondido e freio permanente. `respondido_freia` e por perfil, nunca global.
3. Nivel x Status: `frio` (nivel, temperatura, LEITURA) nunca se confunde com
   `❄️ Lista fria` (status, decisao da regua).
4. Nivel e DERIVADO na leitura, nunca armazenado. Rota A: 0-2 dias quente, 3-6 morno,
   7+ frio. No banco e expressao na query, nao coluna.
5. Lead ID e a chave estavel do vinculo entre tabelas, nunca id de linha volatil.
6. Historico e auditoria sao append-only, newest-first onde exibido.
7. Toda tabela de dado tem `tenant_id` e uma policy de RLS que o usa.
8. Funcoes helper de RLS (`fn_tenant_atual` / `fn_papel_atual`) vivem no schema
   `privado`, nunca em `public`, invisiveis ao PostgREST.
9. `authenticated` nunca recebe TRUNCATE. Privilegio minimo necessario.
10. `CURRENT_DATE` proibido onde se produz data de negocio. Sempre o equivalente no
    fuso do Brasil.
11. Numeros de cadencia vivem na tabela de config `cadencia_regra`, nunca dentro de
    `fn_regua_varredura()`.
12. Chave de busca de script e `perfil` + `passo` (inteiro), nunca o rotulo (rotulos
    sao editaveis).
13. `sugerir_mensagem` e a UNICA fonte de texto de abordagem na Fila, e e estritamente
    read-only. Nada de mensagem fixa no JS. Link WhatsApp so abre conversa, nunca
    registra acao de contato.
14. As 3 variantes (Direto / Consultivo / Leve) cumprem papeis distintos. Se Direto e
    Consultivo dizem a mesma coisa, e regressao.
15. Assinatura formal `Vini, da Pitstop Imports` so em primeiro contato e reativacao
    apos silencio longo.
16. LGPD na Fila: `waHrefFila` so devolve link se `consentimento === true`.
17. Nao construir superficie de SaaS antes do primeiro pagamento. Barato entra agora
    (schema multi-tenant, RLS, auditoria); caro so quando alguem pagar.

Reforcos anotados na v33 (nao sao numero novo, so alcance dos existentes):
- Invariante 4 vale tambem para peca de conteudo, nao so lead: `nivelPeca` calcula no
  cliente a partir do fuso do Brasil, nunca vira coluna.
- Invariante 12 sobe de nivel: a chave e o `codigo`, nunca o `rotulo`, em qualquer
  dominio (categoria nova entra por hash deterministico do codigo).
- Cor semantica se mede (paleta); cor de IDENTIDADE tambem (os 7 trilhos).
- Tela que omite recorte mente: declarar a janela (`de X a Y`) e parte do dado.

---

## IDs de sistema

- Supabase project ID: `unjzpyexgtbcmjfgcqrx`
- Tenant ID: `00000000-0000-0000-0000-000000000001`
- Auth UID (dono): `fb2aad8e-b728-4e59-a198-71da2156449d`
- Repo GitHub: `vinialbuquerquepitstop-beep/pitwall--nucleo` (privado, branch `main`)
- Cloudflare Worker: `flat-resonance-09ba.pitstopimports.workers.dev`
- CRM Sheets (legado): `1lJj4wHjniXhjW_dmFSJ2eKdohN8MCJ4MGvglXyyIrrY`, aba `Pitstop Imports — CRM de Clientes` (em-dash U+2014, casing exato)
- Conteudo/uso Sheets: `1fWhQ78vq1ScvYehvW6jvauS5WNY5kXtuPVhf09Ue7ek`
- Notion calendario DB: `ab0fc93f-d964-4f32-8c81-4be5343687b3`

---

## Estrutura do frontend

```
.                  <- O DIRETORIO DE TRABALHO E O PROPRIO REPO GIT (pitwall--nucleo).
  public/          <- o que a Cloudflare serve
    index.html     (estrutura, aponta pra app.css e app.js; legivel)
    app.css        (legivel, ~900 linhas, tokens da referencia visual v3)
    app.js         (nucleo minificado numa linha so + blocos de dados legiveis)
  supabase/
    functions/
      sincronizar-conteudo/index.ts   <- Edge Function (Fase 6). Notion -> conteudo.
  ferramentas/     <- suite Python de validacao e patch. validar.py, harness.py,
                      prova_trilho.py, patch_*.py, mock_*.py, *.antes (baselines).
  backups/         <- dumps do Postgres criptografados (.gpg), um por dia.
  docs/
    handoffs/      <- handoff de MAIOR versao e o de record.
    design/        <- referencia-visual-v3.html (record aprovado).
    superpowers/   <- specs e plans (ex.: hierarquia do frontend, v33).
    mapa_pitwall_nucleo_v2.html
  .github/workflows/   <- backup_git.yml (backup diario) + restore_drill.yml.
  README.md
  wrangler.jsonc
```

**Nao existe pasta `nucleo/`.** Ate a v28 este bloco dizia que o codigo vivia em
`nucleo/public/`, que o diretorio de trabalho nao era um repo git, e que o repo nao
versionava `docs/` nem `ferramentas/`. **Os tres eram falsos.** O commit `86d95cf`
passou a versionar `docs/` e `ferramentas/`, e o arranque nunca foi atualizado.
Conferido em 17/07/2026 com `git ls-files`.

Armadilha: `Desktop/pitwall deploy/` e um monolito morto de 09/07, sem git, anterior ao
redesign. Nao e copia de trabalho, nao editar.

Frontend e trio servido direto. **So o `app.js` e minificado: o nucleo IIFE numa linha
so (~25 mil chars), com blocos de dados legiveis colados abaixo. `app.css` (~900 linhas)
e `index.html` (~200 linhas) SAO LEGIVEIS.** Ate a v32 este bloco dizia que `app.css`
tambem estava minificado: falso hoje, medido em 21/07/2026 (maior linha do CSS 257
chars). Em arquivo minificado de uma linha, `git diff` nao prova que algo NAO mudou (o
diff exibe a linha inteira): para isso, extrair o corpo da funcao e comparar byte a byte.

**Referencia visual de record: `docs/design/referencia-visual-v3.html`.** Aprovada em
16/07/2026 apos o dono reprovar a v1 (IBM Plex) e a v2 (serif). Construir ATE ela, nao
ate o denominador comum do que o HTML antigo ja tem. Foi exatamente esse o erro: entregar
uma versao pobre da referencia (sem icone de secao, sem contador na aba, sem rotulo de
grupo, sem avatar, sem terceira linha do pitboard) e chamar de pronto.

Cores (recalibradas para fundo branco em 16/07/2026, por decisao consciente do dono; os
valores antigos eram de fundo escuro e reprovavam em branco):
- `--accent` `#0025cc` (marca, inalterado, 9.83:1)
- `--quente` faixa `#F26B31` / texto `#BC4715` / tint `#FDF0E9` (era `#ff5d45`)
- `--morno` faixa `#C48808` / texto `#946500` / tint `#FBF3E0` (era `#f2a71b`, que
  marcava 2.04 em branco). Continua semantico, nunca unificar com a marca.
- `--frio` faixa `#8395AF` / texto `#5C6F8A` / tint `#F0F3F8` (era `#6db8e8`)
- `--erro` `#B01235` (era `#ff6b5e`, que tinha contraste 1.09 contra `--quente`, ou seja,
  lead quente e falha de sistema pintavam igual)
Alvo: 4.5:1 para texto, 3:1 para faixa. Medir, nao escolher no olho.

Tipografia: `Instrument Sans` (400/500/600) para palavra, `Geist Mono` (400/500) para
dado. Sem serif (reprovado: o mundo Apple nao tem serif). O refino vem de escala e
tracking, nao de familia decorativa.

Cadencia em notacao com ponto do meio: `R3 · D14` (U+00B7).

**As tres abas de operacao (reorganizadas na v33, 21/07/2026, frontend puro, zero
mudanca de banco):**
- **Rotina**: grade de 7 colunas com a carga por dia no topo (`seg 10 · ter 8 ...`),
  nao mais lista agrupada por categoria.
- **Conteudo**: kanban de funil de 4 colunas (`A produzir -> Em producao -> Pronto
  -> Publicado`), ordenado por data, com contagem de vencidas. O cabecalho DECLARA a
  janela (`de X a Y`), senao a coluna Publicado mente por omissao (mostra 3 de 8).
- **Hoje**: placar, tarefas, conteudo, lembretes, e a **nota por ultimo** (a nota e o
  ato de fechamento do dia).
Spec e plano em `docs/superpowers/` (`2026-07-20-hierarquia-frontend-*`).

**Sistema de cor Trilho x Sinal** (v33, hibrido escolhido pelo dono contra a
recomendacao): categoria e URGENCIA nao disputam matiz.
- **Trilho** (quem sou): barra de 3px + cor do rotulo, croma baixo (le como cinza
  tingido), **sempre com icone**. 7 tokens de categoria, MEDIDOS antes de entrar
  (3.80 a 5.21 contra branco, alvo 3:1). Prova: `python ferramentas/prova_trilho.py`.
- **Sinal** (quao urgente): chip preenchido, faixa, matiz + palavra.
As colisoes de luminancia trilho x cor semantica ficam entre 1.14 e 1.44: matiz
sozinho NAO separa, entao **o icone carrega a distincao, nao e enfeite**. Trilho sem
icone e regressao, e o harness assere isso. A chave do trilho e o `codigo` (hash
deterministico: mesma categoria, mesma cor em toda sessao), nunca o `rotulo`.

---

## Pipeline de deploy

- Git e a fonte da verdade. Guarda os arquivos.
- Cloudflare publica sozinha no push, via Workers Builds. Empurrar pro git E o deploy.
- Supabase fica de fora de qualquer tarefa de frontend.
- O `name` no `wrangler.jsonc` (`flat-resonance-09ba`) tem que bater exatamente com o
  Worker no painel, senao o build da integracao falha.
- `not_found_handling: single-page-application` protege o hash de recovery de senha.
- Backup do banco: `.github/workflows/backup_git.yml` grava um dump do Postgres
  CRIPTOGRAFADO (AES-256, `.gpg`) em `backups/`, um por dia, sem servico externo.
  Exige os secrets `SUPABASE_DB_URL` (session pooler) e a senha de criptografia.
  O dump tem PII de cliente: nunca commitar em claro. `restore_drill.yml` prova que o
  backup restaura.

---

## Disciplina de validacao e entrega

- Entregar arquivo completo, pronto para aplicar, nunca fragmento. Fragmento foi a
  causa raiz de corrupcao no historico do projeto.
- Frontend: a suite de validacao e PYTHON, da raiz do repo (nao acorn nem jsdom, que a
  v32 afirmava por engano e nao existem aqui). Tres provas reexecutaveis:
  ```
  python ferramentas/validar.py       # sintaxe, via esprima
  python ferramentas/harness.py       # comportamento, Chrome headless (assere cor computada)
  python ferramentas/prova_trilho.py  # contraste dos 7 trilhos de categoria
  ```
  Chrome headless ganha do jsdom aqui porque APLICA CSS, entao da para assertar sobre
  cor computada. Estado atual: 133 assercoes, 0 falhas.
  **Conferir o EXIT CODE, nunca o texto da saida.** `validar.py` imprime dezenas de
  linhas verdes e pode terminar em `REPROVOU:`; ler o texto por cima ja fez commitar
  vermelho. Ao assertar UI, consultar o DOM RENDERIZADO (so `#lista`), nunca
  `document.body.textContent`, que enxerga o proprio `app.js` colado no `<body>`.
  Baseline `.antes` se reponta UMA vez, no inicio da obra, nunca no meio: guard-rail que
  incomoda nao se cala repontando a baseline, ou se abre excecao nomeada ou se derruba
  conscientemente.
- SQL: nao entregar sem rodar. Policy de RLS testada como dono, como vendedor e como
  tenant errado, provando o isolamento. Auditoria: provar que uma escrita gera
  exatamente um registro append-only com valor antes e depois.
- `CREATE OR REPLACE VIEW` derruba `security_invoker = on` em silencio: sempre seguir
  com `ALTER VIEW ... SET (security_invoker = on)` e conferir em `pg_class.reloptions`.
- `CREATE OR REPLACE FUNCTION` reseta ACLs: refazer REVOKE/GRANT explicitos depois.
- MCP Supabase: `execute_sql` so devolve o resultado do ultimo statement do bloco;
  cada verificacao e uma chamada separada. `apply_migration` preferido para schema e
  insert em massa (lida com acento e payload grande, transacional).

---

## Convencao de linguagem

Responder em portugues do Brasil, direto e estruturado, orientado a execucao. Comecar
simples, aprofundar so quando ajuda a decisao. Sem cliche motivacional. Na prosa do
Claude: sem acento, sem cedilha, sem travessao (trocar por virgula, dois-pontos ou
reescrever). EXCECAO obrigatoria: valores reais do sistema carregam seus proprios
caracteres exatos e sao preservados sem alterar. Exemplos que NAO se mexe: aba
`Pitstop Imports — CRM de Clientes`, perfis `Lead — Repescagem` e `Comprou — 1ª vez`,
status `Pendente` e `Lista fria`, sentinelas `Conversando` e
`Negociação parada`, rotulos de toque com o ponto do meio (`R3 · D14`), cabecalhos
de coluna e nomes de funcao.

Emoji NAO faz mais parte de rotulo nenhum. Saiu do `dicionario_rotulos` em 16/07/2026,
por decisao da v25: na tela virou ponto colorido + palavra. Os exemplos acima ja estao
na forma nova, sem emoji. Nao reintroduzir. O que identifica um valor e o `codigo`
(`lista_fria`, `pendente`), nunca o `rotulo`, que e display e editavel.

---

## Proxima fase ja decidida (ver handoff v33, secao 12)

Mover card no kanban = **escrita de volta no Notion** (o Notion segue fonte unica, o
Pit Wall vira controle remoto). BLOQUEADOR do dono, e nao e de codigo: a integracao do
Notion (`NOTION_TOKEN`, env do Deno) precisa da capability **"Update content"** em
notion.so/profile/integrations, senao o `PATCH /v1/pages/{page_id}` volta 403 e nada
funciona. A conexao MCP desta sessao usa credencial DIFERENTE, entao testar por ela nao
prova nada sobre a que importa. Interacao aprovada: arrastar no desktop E botao no
celular (contra a recomendacao de so botao). Ordem de escrita: Notion primeiro, local so
se o PATCH passar.

---

## Handoff no fim da sessao

Registrar decisoes, nao so estado. Criar `docs/handoffs/handoff_migracao_pitwall_vNN.md`
com a versao incrementada. O novo substitui os anteriores.
