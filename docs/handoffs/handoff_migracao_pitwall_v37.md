# Handoff Migracao Pit Wall (Nucleo) v37

Substitui a v36. Data: 23/07/2026.

---

## 1. Headline: fatia 2 no ar, botao Enviar direto na previa da Fila do Hoje

Frontend puro, zero mudanca de banco. A previa "Fila de hoje" (aba Hoje, Peca A
da v36) tinha so o botao Sugerir por linha; o envio de WhatsApp existia um toque
mais fundo (Sugerir -> painel de scripts -> "Enviar no WhatsApp"). Agora cada
linha com consentimento tem, ao lado do Sugerir, um botao **Enviar** que abre o
WhatsApp ja com o texto da variante 1 do `sugerir_mensagem`. Provado no harness
(Chrome headless, DOM computado) e pushado pra main (deploy Cloudflare).

Spec: `docs/superpowers/specs/2026-07-23-hoje-fila-botao-enviar-design.md`.

---

## 2. Decisao do dono que moldou a fatia

Perguntado se o Enviar deveria levar (A) o texto sugerido, (B) uma saudacao
generica, ou (C) abrir a conversa vazia, o dono escolheu **A, texto sugerido
(variante 1)**. Isso mantem o invariante 13 (a fonte do texto na Fila e o
`sugerir_mensagem`, nunca mensagem fixa no JS) e evita por o caminho generico no
ponto mais visivel do app.

---

## 3. Como funciona (e a restricao que forcou o desenho)

O browser bloqueia abrir `wa.me` DEPOIS de uma chamada assincrona (fora do gesto
do usuario). Entao o Enviar tem que ser um `<a>` real com o `href` pronto no
toque. Como o texto vem de RPC, o `href` e montado ANTES de desenhar:

- `renderHoje` chama `await prefetchFilaSug()` antes de montar o HTML.
- `prefetchFilaSug` pega os mesmos ate 5 leads da previa (`v(ativos,l()).slice(0,5)`)
  e, em paralelo (`Promise.all`), chama `sugerir_mensagem` pra cada um.
  - **Porta LGPD (invariante 16):** so segue com `consentimento === true` e
    telefone. Sem isso nem chama a RPC, e o Enviar nao aparece.
  - Cada RPC em `try/catch`: falha de um lead nao derruba o Hoje.
  - Grava `filaSug[id] = https://wa.me/<digitos>?text=<encode(opcoes[0].texto)>`.
- `hojeFilaLin` emite `<a class="btn-wa fila-wa">Enviar</a>` quando `filaSug[a.id]`
  existe. O `<a>` so abre a conversa, nao registra contato (invariante 13).

Custo aceito pelo dono: ate 5 chamadas a `sugerir_mensagem` a cada render do
Hoje (inclui cada Atualizar). O spinner "Lendo o dia..." cobre a latencia, a
Fila ja aparece completa.

CSS: `.fila-wa` reusa o `.btn-wa` (tokens verdes `--ok-*`, ja no design system e
na referencia visual v3), so compacto pra caber inline (`flex:0 0 auto`, padding
e fonte menores). Nenhum uso novo do azul da marca.

---

## 4. Armadilha real resolvida: o guard de contagem do sugerir_mensagem

`validar.py` secao [5] conta as chamadas a `rpc("sugerir_mensagem"` e exigia
igualdade com a baseline, pra pegar adulteracao do invariante 13. O prefetch
soma UMA chamada legitima e o guard reprovou (baseline 1, novo 2). Corrigido com
**excecao nomeada** (nao repontando a baseline no escuro, como manda o CLAUDE.md):
o guard agora exige `baseline + 1`, com comentario explicando que o texto
continua vindo do `sugerir_mensagem`.

Nota pra proxima sessao: a baseline `ferramentas/app.js.antes` continua no estado
pre-fatia-2 (1 chamada). Se voce repontar a baseline pro estado atual (2 chamadas)
no inicio da sua obra, o guard `+1` vai falhar alto (exige 3): isso e proposital
e seguro, so reverta o `+1` pra igualdade simples, ja que a baseline nova passa a
incluir a chamada da Fila.

---

## 5. Provas (exit code, reexecutaveis da raiz)

```
python ferramentas/validar.py       # EXIT 0
python ferramentas/prova_trilho.py  # EXIT 0
python ferramentas/harness.py       # EXIT 0 -> 167 passou, 0 falhou
```

Patch script idempotente: `ferramentas/patch_hoje_fila_enviar.py`.

Asseroes novas no harness (5), com prova real do DOM computado:
- linhas com consentimento tem `<a class="fila-wa">` com href de `wa.me`
  contendo o texto sugerido (medido: `wa.me/5521998668286?text=Texto%20sugerido%20variante%201`);
- `sugerir_mensagem` foi chamado no prefetch;
- **trava LGPD provada:** novo fixture `LEAD-9001` (sem consentimento) entra na
  Fila mas NAO tem Enviar. Adicionado em `ferramentas/dados_teste.json`.
- Mock novo de `sugerir_mensagem` no dispatcher do harness (antes o teste nunca
  clicava Sugerir, entao a RPC nunca era exercida).

---

## 6. Nao entra nesta fatia (conscientemente)

- Nao mexi no Sugerir nem no painel de scripts.
- Nao pre-preenchi `scriptsData` pra evitar o refetch do Sugerir (ganho marginal).
- Sem mudanca de banco: `sugerir_mensagem` ja e read-only e vivo.

---

## 7. Proxima fase ja decidida (inalterada da v33/v35/v36)

Mover card no kanban = escrita de volta no Notion. BLOQUEADOR do dono, nao de
codigo: a integracao do Notion precisa da capability "Update content", senao o
`PATCH /v1/pages/{page_id}` volta 403. Ver CLAUDE.md secao "Proxima fase".
