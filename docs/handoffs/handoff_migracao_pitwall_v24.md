# Handoff Migracao Pit Wall (Nucleo) v24

Substitui a v23. Data: 15/07/2026.

---

## 1. O que mudou nesta sessao

Sessao de fechamento de robustez. Tres itens mexidos, dois fechados, um reclassificado.

**(a) Pendencia #1 fechada de ponta a ponta.** Apos o novo build (pos-split), a Fila
foi reaberta num lead real e os 3 chips (Direto / Consultivo / Leve) apareceram com
os textos reescritos, servidos pelo build novo e nao pelo monolito antigo. Isso
confirma os dois trilhos da v22 de uma vez: o deploy dos 126 scripts E o split do
monolito estao no ar e funcionando pro cliente final.

**(b) Pendencia #2 fechada.** O `wrangler.jsonc` do repo foi conferido linha a linha:
- `name`: `flat-resonance-09ba`, identico ao Worker no ar. Nao quebra a Site URL do Auth.
- `not_found_handling`: `single-page-application` presente. O hash de recovery de
  senha cai no `index.html` (200), nao em 404.
- `assets.directory`: `./public`, alinhado com o split.
Nada a mexer.

**(c) Pendencia #3 reclassificada de "pendente" para "bloqueada por plano".** Ao ligar
o Leaked Password Protection no dashboard, a Supabase retornou erro: o recurso exige
plano Pro. No Free o toggle aparece na UI mas falha ao salvar. Detalhe na secao 5.

Banco, RPC `sugerir_mensagem`, RLS, cadencia: nada tocado nesta sessao.

---

## 2. Estado do frontend (inalterado desde a v23)

Estrutura do repo `pitwall--nucleo` (branch `main`):

```
pitwall--nucleo/
├─ .github/          (backup workflow, intacto)
├─ backups/          (intacto)
├─ public/
│  ├─ index.html     (estrutura, aponta pra app.css e app.js)
│  ├─ app.css
│  └─ app.js
├─ README.md
└─ wrangler.jsonc    (raiz, conferido nesta sessao)
```

Frontend e trio legivel servido direto, sem versao minificada. Split validado na v23
por acorn + harness jsdom + fidelidade byte a byte (MD5). Nada disso mudou aqui.

---

## 3. Pipeline de deploy (inalterado)

- **Git**: fonte da verdade, guarda os arquivos.
- **Cloudflare**: publica sozinha no push, via Workers Builds. Empurrar pro git E o deploy.
- **Supabase**: fora de qualquer tarefa de frontend.

O `name` no `wrangler.jsonc` tem que bater exatamente com o nome do Worker no painel,
senao o build da integracao falha. Conferido nesta sessao: bate.

---

## 4. Decisao registrada: Leaked Password Protection

O que o recurso faz: barra, no cadastro ou troca de senha, qualquer senha que ja
apareca no catalogo publico de vazamentos (HaveIBeenPwned). Nao e um alarme de que a
senha do dono vazou. E um filtro preventivo contra reuso de senha publicamente conhecida.

Por que nao vale assinar Pro so por isso agora: o sistema e single-tenant, 1 dono, 15
leads. A protecao automatica so vira relevante de verdade quando houver multi-tenant
com auto-cadastro de usuarios (fase SaaS). Hoje ela protegeria uma unica conta, a do
dono, que ja e controlada direto.

Mitigacao gratuita no lugar: senha de dono forte e unica, checada uma vez na mao em
`haveibeenpwned.com/Passwords` (o site checa por hash, nao envia a senha em claro).
Se nao aparecer no catalogo, nao precisa trocar nada. So troca se der positivo.

---

## 5. Pendencias

| # | Item | Bloqueio / nota |
|---|---|---|
| 1 | ~~Reconferir a Fila pos-split~~ | **FECHADA.** Fila reaberta em lead real pos-build, 3 chips (Direto / Consultivo / Leve) com texto novo confirmados. Split e deploy fechados de ponta a ponta. |
| 2 | ~~`not_found_handling` no wrangler~~ | **FECHADA.** Linha presente, `name` bate com o Worker, `directory` = `./public`. |
| 3 | Leaked Password Protection | **BLOQUEADA: requer plano Pro.** No Free o toggle aparece mas falha ao salvar ("available on Pro Plans and up"). Nao e acionavel agora. Reavaliar na fase SaaS, quando multi-tenant com auto-cadastro torna a protecao relevante (hoje protege 1 unica conta, a do dono). Mitigacao gratuita no lugar: senha de dono forte e unica, checada na mao em haveibeenpwned.com/Passwords. |
| 4 | Fase 4 (aba historico) | Camada de escrita estavel primeiro. |
| 5 | Fase 5 (dashboards) | Views Postgres. Metricas definidas cedo pra moldar o schema. |
| 6 | Redesign estetico | Adiado. Com o split feito, aplicar mudanca de CSS ficou barato (mexe so no `app.css`). Pode ser especificado agora sem escrever codigo. |

---

## 6. Primeiro movimento do proximo chat
1. Ler este handoff e verificar estado vivo do banco via MCP.
2. As duas pendencias de robustez (#1, #2) estao fechadas e a #3 esta bloqueada por
   plano, nao acionavel. A lista abre limpa pra decidir frente nova.
3. **Decisao a tomar:** especificar o redesign estetico (barato agora, so CSS, sem
   escrever codigo ainda) OU avancar pra Fase 4 (aba historico) OU Fase 5 (dashboards).
   Se for Fase 5, vale definir as metricas cedo pra moldar as views.

---

## 7. Invariantes reforcados
- `sugerir_mensagem` e a UNICA fonte de texto de abordagem na Fila. Nada de mensagem fixa no JS.
- As 3 variantes cumprem papeis distintos (Direto / Consultivo / Leve). Se Direto e Consultivo disserem a mesma coisa, e regressao.
- Assinatura formal so em primeiro contato e reativacao apos silencio longo.
- O link WhatsApp na Fila respeita consentimento (LGPD): `waHrefFila` so devolve link se `consentimento === true`.
- Frontend e trio legivel (`public/index.html` + `app.css` + `app.js`), servido direto, sem minificacao.
- Deploy e por push no git via Workers Builds. Git guarda, Cloudflare publica, Supabase fica de fora do frontend.
- O `name` no `wrangler.jsonc` tem que bater com o Worker no painel, senao o build da integracao falha.
- Qualquer novo split ou extracao passa por: acorn (`sourceType: script`) + harness jsdom + fidelidade byte a byte (MD5 fonte vs arquivo) antes de dar por concluido.
- **Checksum reproduzivel:** quando um checksum MD5 for prova, a receita exata (campos concatenados, separador, ordenacao/collation) tem que ficar ESCRITA no handoff. Sem a receita, o numero nao e reproduzivel numa proxima sessao.
- **Recursos de seguranca podem ser gated por plano.** Antes de tratar um toggle do dashboard como acionavel no Free, considerar que pode exigir Pro (caso do Leaked Password Protection). Quando bloqueado por plano, registrar como bloqueada e nao como pendente de acao.
