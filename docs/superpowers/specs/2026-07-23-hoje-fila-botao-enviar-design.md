# Fatia 2 — botao Enviar na previa da Fila do Hoje

Data: 23/07/2026. Frontend puro, zero mudanca de banco.

## Problema

A previa "Fila de hoje" na aba Hoje (Peca A, v36) lista os ate 5 leads mais
urgentes, mas cada linha tem so o botao **Sugerir**. O envio de WhatsApp ja
existe, porem um toque mais fundo: Sugerir abre o painel de scripts e la dentro
aparece o "Enviar no WhatsApp". O dono quer o envio direto na propria linha da
previa, no ponto mais visivel do app.

## Decisao do dono

O botao Enviar abre o WhatsApp **ja com o texto sugerido (variante 1)** do
`sugerir_mensagem`, nao uma saudacao generica fixa. Isso mantem o invariante 13
(a fonte do texto de abordagem na Fila e o `sugerir_mensagem`, nunca mensagem
fixa no JS) e evita colocar o caminho generico no lugar mais nobre da tela.

## Restricao tecnica que molda a arquitetura

O browser bloqueia `window.open`/navegacao pra `wa.me` disparada DEPOIS de uma
chamada assincrona (fora do gesto do usuario). Logo o botao precisa ser um `<a>`
real com o `href` ja pronto no momento do toque. Como o texto vem de uma RPC, o
`href` tem que ser montado ANTES de desenhar a linha. Solucao: pre-carregar o
`sugerir_mensagem` dos leads da previa no `renderHoje`, antes de montar o HTML.

## Desenho

### 1. Cache de modulo `filaSug`
`var filaSug = {}` no escopo do IIFE. Mapa `lead.id -> href` pronto
(`https://wa.me/<digitos>?text=<encode(opcoes[0].texto)>`). Reset a cada
`renderHoje`.

### 2. `prefetchFilaSug()` (async)
Calcula os mesmos ate 5 leads da previa (`v(ativos, l()).slice(0,5)`) e, em
paralelo (`Promise.all`), pra cada lead:
- **Porta LGPD (invariante 16):** so segue se `consentimento === true` e houver
  `whatsapp_digitos`. Sem isso, nem chama a RPC e nao entra no cache.
- Chama `sugerir_mensagem({p_lead_id})`. Se `ok` e ha `opcoes[0].texto`, grava
  `filaSug[id]` com o href montado a partir do texto da variante 1.
- Cada chamada em `try/catch`: falha de um lead nao derruba o Hoje, aquele lead
  so fica sem Enviar.

### 3. `renderHoje`
Insere `await prefetchFilaSug()` entre a validacao de `d` e a montagem do HTML,
para o cache estar pronto quando `hojeFila` desenhar as linhas.

### 4. `hojeFilaLin`
Depois do botao Sugerir, emite o `<a class="btn-wa fila-wa" target="_blank"
rel="noopener" href="...">Enviar</a>` quando `filaSug[a.id]` existe; caso
contrario nao emite nada (a linha fica so com Sugerir). O `<a>` so abre a
conversa, nunca registra contato (invariante 13).

### 5. CSS `.fila-wa`
Reusa o `.btn-wa` (tokens verdes `--ok-*`, ja no design system e na referencia
visual v3), so compacto pra caber inline ao lado do Sugerir: `flex:0 0 auto`,
padding e fonte menores. Nenhum uso novo de `var(--accent)` (passa no guard do
`validar.py`).

## Fora de escopo (consciente)
- Nao mexer no Sugerir nem no painel de scripts.
- Nao pre-preencher `scriptsData` pra economizar o refetch do Sugerir (ganho
  marginal, fica pra depois).
- Sem mudanca de banco: `sugerir_mensagem` ja esta vivo e e read-only.

## Provas (convencao v36, exit code)
- `python ferramentas/validar.py` -> EXIT 0 (sintaxe + guard do azul).
- `python ferramentas/prova_trilho.py` -> EXIT 0.
- `python ferramentas/harness.py` -> EXIT 0. Asseroes novas:
  - linha com consentimento tem `<a class="fila-wa">` com href de `wa.me`
    contendo o texto sugerido;
  - `sugerir_mensagem` foi chamado no prefetch dos leads da previa;
  - **trava LGPD:** um lead na fila SEM consentimento (novo fixture) nao tem
    Enviar.
- Patch cirurgico idempotente: `ferramentas/patch_hoje_fila_enviar.py`.
