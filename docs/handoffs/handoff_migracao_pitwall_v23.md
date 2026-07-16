# Handoff Migracao Pit Wall (Nucleo) v23

Substitui a v22. Data: 15/07/2026.

---

## 1. O que mudou nesta sessao

Duas coisas.

**(a) Deploy dos 126 scripts confirmado no ar.** A pendencia #1 da v22 (build novo
no Worker) foi fechada: abrindo a Fila num lead real, os 3 chips (Direto /
Consultivo / Leve) aparecem com os textos reescritos. Os 126 scripts agora chegam
ao cliente.

**(b) Split do monolito frontend feito** (pendencia #2 da v22). O
`index_brand.html` foi quebrado em tres arquivos legiveis: `index.html`,
`app.css`, `app.js`. Objetivo cumprido: editar frontend agora e barato, sem etapa
de build, sem mexer no monolito inteiro.

O split e 100% frontend. Banco, RPC `sugerir_mensagem`, RLS, cadencia, nada foi
tocado.

---

## 2. Estado do frontend

Estrutura do repo `pitwall--nucleo` (branch `main`) depois desta sessao:

```
pitwall--nucleo/
├─ .github/          (backup workflow, intacto)
├─ backups/          (intacto)
├─ public/
│  ├─ index.html     (substituido: so estrutura, aponta pra app.css e app.js)
│  ├─ app.css        (novo)
│  └─ app.js         (novo)
├─ README.md         (intacto)
└─ wrangler.jsonc    (raiz)
```

- `public/` ja era a pasta de assets servida pelo Worker (arquitetura assets-only).
  Por isso o split coube inteiro dentro dela: o antigo `public/index` (monolito
  minificado) foi substituido pelo novo `index.html`, e `app.css`/`app.js` entraram
  ao lado.
- `index.html` carrega o CDN do Supabase antes do `app.js` (ordem preservada, o
  `app.js` depende de `window.supabase`).
- A Cloudflare serve `app.css` como `text/css` e `app.js` como `text/javascript`
  automaticamente pela extensao. Nao precisa configurar content-type.

### 2.1 Padrao de artefatos mudou
O padrao antigo era dois artefatos: `index_brand.html` (legivel) e
`index_deploy.min.html` (minificado, servido pelo Worker). **Agora sao tres
arquivos legiveis servidos direto**, sem versao minificada. Decisao consciente:
servir legivel mantem o proposito do split (edicao barata) e preserva o debug no
mobile (o capturador de erro aponta a funcao certa, nao "linha 1"). Minificar
ficou como opcao futura, so se tamanho virar problema (nao e, nesse porte).

---

## 3. Pipeline de deploy (esclarecido nesta sessao)

Ponto importante pro dono, que opera no celular sem terminal.

O Worker-com-assets sobe por Wrangler (terminal), o que nao encaixa com operacao
mobile. A saida e a **integracao Git da Cloudflare (Workers Builds)**: o repo fica
conectado ao Worker no painel, e **todo push no GitHub dispara build e deploy
automatico**. Depois de conectado, empurrar pro git E o deploy. Nao se abre a
Cloudflare de novo, so se acompanha o build passar.

Regra pratica desta operacao:
- **Git**: fonte da verdade, guarda os arquivos.
- **Cloudflare**: publica sozinha no push (via Workers Builds).
- **Supabase**: fora de qualquer tarefa de frontend.

O nome do Worker no painel (`flat-resonance-09ba`) tem que bater exatamente com o
`name` no `wrangler.jsonc`, senao o build da integracao falha.

---

## 4. Verificacao feita nesta sessao

Sobre o split, antes de entregar os arquivos:

1. **Fidelidade byte a byte.** CSS e JS extraidos do monolito por regex (sem
   transcricao manual) batem 100% com a fonte. MD5 do `app.css` =
   `42c5af96dfae8a2cb21d74eb61481fc5`; MD5 do `app.js` =
   `b7a7b7b99dc2400cb3c39d977f145d28`. Caracteres especiais intactos
   (middle-dot ·, em-dash —, emoji 🔥).
2. **Acorn.** `app.js` parseia limpo como `sourceType: script`.
3. **Harness jsdom.** Carregado o `index.html` real, `init()` pulado pelo guard
   `window.__PITWALL_SEM_INIT`, `app.js` injetado via vm no contexto da janela.
   9 asserts verdes: `renderLista` pinta cards, botao "Sugerir mensagem" e
   container de scripts presentes na Fila, gate LGPD confirmado no ponto certo
   (`waHrefFila` devolve link so com consentimento, nao devolve sem), aba Todos
   usa `waHrefLimpo` (abrir conversa, independe de consent, exige telefone),
   `esc()` escapa HTML, `fmtTel()` formata celular BR.

Aprendizado do harness: na Fila, o card mostra "Sugerir mensagem", nao o link
direto do WhatsApp. O link com consentimento vive dentro do painel de scripts
(`pintarVariante`). Teste que verificar link direto no card da Fila esta errado.

---

## 5. Pendencias

| # | Item | Bloqueio / nota |
|---|---|---|
| 1 | **Reconferir a Fila pos-split** | Dono reportou deploy do split como feito. Falta a confirmacao visual APOS o novo build: abrir a Fila num lead real (Miguel, LEAD-0013) e ver os 3 chips com o texto novo. Se a tela vier em branco ou quebrada, foi a troca de pipeline, nao o script, e olha-se o log do build. **Primeiro movimento do proximo chat.** |
| 2 | `not_found_handling: single-page-application` no wrangler | Confirmar que a linha existe no `wrangler.jsonc` do repo. Protege o hash de recuperacao de senha (rota desconhecida cai no index em vez de 404). |
| 3 | Leaked Password Protection | Toggle no dashboard Supabase, depois trocar a senha. |
| 4 | Fase 4 (aba historico) | Camada de escrita estavel. |
| 5 | Fase 5 (dashboards) | Views Postgres. |
| 6 | Redesign estetico | Adiado. Pode ser especificado barato agora, sem escrever codigo. Com o split feito, aplicar mudanca de CSS ficou barato. |

---

## 6. Primeiro movimento do proximo chat
1. Ler este handoff e verificar estado vivo do banco via MCP.
2. **Confirmar pendencia #1:** abrir a Fila num lead real e conferir que os 3 chips
   aparecem com os textos novos, servidos pelo build pos-split (nao pelo monolito
   antigo). Se ok, split e deploy fechados de ponta a ponta.
3. Confirmar pendencia #2 (linha `single-page-application` no wrangler).
4. Se tudo ok, decidir a proxima frente: especificar o redesign estetico (barato
   agora, so CSS) ou avancar pra Fase 4/5.

---

## 7. Invariantes reforcados
- `sugerir_mensagem` e a UNICA fonte de texto de abordagem na Fila. Nada de mensagem fixa no JS.
- As 3 variantes cumprem papeis distintos (Direto / Consultivo / Leve). Se Direto e Consultivo disserem a mesma coisa, e regressao.
- Assinatura formal so em primeiro contato e reativacao apos silencio longo.
- O link WhatsApp na Fila respeita consentimento (LGPD): `waHrefFila` so devolve link se `consentimento === true`.
- **Frontend agora e trio legivel** (`public/index.html` + `app.css` + `app.js`), servido direto, sem minificacao. Qualquer edicao mexe no arquivo certo, nao num monolito.
- **Deploy e por push no git** via Workers Builds. Git guarda, Cloudflare publica, Supabase fica de fora do frontend.
- Qualquer novo split ou extracao passa por: acorn (`sourceType: script`) + harness jsdom + fidelidade byte a byte (MD5 fonte vs arquivo) antes de dar por concluido.
- **Checksum reproduzivel:** quando um checksum MD5 for usado como prova (ex.: reescrita de scripts), a receita exata (campos concatenados, separador, ordenacao/collation) tem que ficar ESCRITA no handoff. Sem a receita, o numero nao e reproduzivel numa proxima sessao. Isso mordeu nesta sessao: o MD5 dos scripts da v22 nao bateu porque a receita nao ficou registrada, so contagem/chaves/RPC puderam ser reconferidas.
