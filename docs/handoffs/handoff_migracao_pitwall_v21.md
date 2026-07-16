# Handoff Migracao Pit Wall (Nucleo) v21

Substitui a v20. Data: 14/07/2026.

---

## 1. O que mudou nesta sessao

### 1.1 Descoberta critica
O frontend **nunca chamava `sugerir_mensagem`**. O botao "Chamar no WhatsApp" da Fila
usava uma frase generica fixa no codigo (funcao `b()` / `waHrefFila`):

> "Oi {nome}! Vi seu interesse no {produto}, posso te passar as condicoes?"

Consequencia: os 126 scripts e a RPC com `opcoes[]` estavam completamente
desligados da tela. Nenhum script chegava ao cliente.

### 1.2 Correcao aplicada (frontend)
Cards da **Fila** agora lideram com o botao **Sugerir mensagem**, que:
1. Chama a RPC `sugerir_mensagem(p_lead_id)`.
2. Renderiza os 3 angulos como chips selecionaveis: **Direto / Consultivo / Leve**.
3. Mostra o `passo_rotulo` (ex.: `R2 · D2`) e o texto da variante escolhida.
4. Oferece **Enviar no WhatsApp** (numero + texto ja preenchido) e **Copiar**.

Regras respeitadas:
- **Consentimento LGPD:** se o lead nao tem consentimento, o link WhatsApp nao aparece
  (mostra "Sem consentimento"); Copiar continua disponivel. Mesma postura do codigo antigo.
- Aba **Todos** e **Indicacoes** seguem inalteradas ("Abrir conversa").
- Deep link de WhatsApp so abre a conversa; **nao registra toque** (registro segue manual
  pelos botoes Toque enviado / Respondeu). RPC segue read-only.
- Escrita (toque, desfechos, retomar) intacta.

### 1.3 Validacao
- `acorn.parse` (ecmaVersion 2020, sourceType script): passa no brand e no deploy.
- Harness jsdom com clique real e RPC mockada: 16 checagens, todas verdes
  (3 chips, troca de variante, link WhatsApp com texto, gate de consentimento).

---

## 2. Arquivos entregues
- `index_brand.html` — fonte legivel, ligada aos scripts. Vai para o GitHub.
- `index_deploy.min.html` — minificado (html-minifier-terser, `mangle` + 2 passes),
  validado no acorn. Vai para o Cloudflare Worker via Wrangler.

Padrao dois-artefatos mantido: **arquivo unico**, sem split ainda.

---

## 3. Estado do banco (inalterado desde v20)
- 126 scripts (42 chaves perfil+passo x 3 variantes). Cobertura 36/36 passos.
- Chave unica: `UNIQUE (tenant_id, perfil, passo, variante)`.
- RPC `sugerir_mensagem` devolve `opcoes[]` e mantem `texto`/`script_id` = variante 1
  (compatibilidade). Assinatura "Vini" so em primeiro contato e reativacao longa.
- Security advisor: limpo, exceto `auth_leaked_password_protection` (toggle de dashboard).

---

## 4. Pendencias

| # | Item | Bloqueio / nota |
|---|---|---|
| 1 | Deploy do `index_deploy.min.html` no Worker | Wrangler. Testar Sugerir mensagem em lead real apos subir. |
| 2 | **Split do monolito** (index.html + app.css + app.js) | Muda pipeline do Worker (servir css/js como assets). Fazer isolado, com confirmacao. |
| 3 | Leaked Password Protection | Toggle no dashboard Supabase, depois trocar a senha. |
| 4 | Fase 4 (aba historico) | Camada de escrita estavel. |
| 5 | Fase 5 (dashboards) | Views Postgres. |
| 6 | Redesign estetico | Adiado. |

---

## 5. Primeiro movimento do proximo chat
1. Ler este handoff e verificar estado vivo do banco via MCP.
2. Confirmar se o deploy do Worker ja subiu e se Sugerir mensagem funciona em lead real.
3. Decidir split do monolito (item 2) como tarefa isolada, com ajuste de assets no Worker.

---

## 6. Invariantes de frontend (novos/reforcados)
- `sugerir_mensagem` e a UNICA fonte de texto de abordagem na Fila. Nada de mensagem fixa no JS.
- O link WhatsApp na Fila respeita consentimento (LGPD).
- Validacao antes de qualquer entrega: `acorn.parse` (sourceType script) + harness jsdom
  com clique real; `renderLista` chamado direto (init pulado quando `window.__PITWALL_SEM_INIT`).
- Minificacao: `html-minifier-terser` com `--minify-js '{"compress":{"passes":2},"mangle":true}'`.
- Funcao `b()`/`waHrefFila` ficou orfa (nao usada na Fila). Remover so no split, para nao mexer em mais nada agora.
