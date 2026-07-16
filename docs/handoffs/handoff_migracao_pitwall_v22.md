# Handoff Migracao Pit Wall (Nucleo) v22

Substitui a v21. Data: 15/07/2026.

---

## 1. O que mudou nesta sessao

Reescrita completa e humanizada dos **126 scripts** de abordagem WhatsApp
(`public.dicionario_scripts`), motivada pelo diagnostico de que as opcoes
"subiam, mas eram fracas". Aplicada por migration transacional e conferida
byte a byte por checksum. RPC `sugerir_mensagem` testada em lead real com os
textos novos.

O banco de scripts continua com a mesma forma (126 registros, 42 chaves
perfil+passo x 3 variantes, numeracao de variante intacta). So o
`texto_template` mudou. Compatibilidade backward preservada: `texto`/`script_id`
da RPC seguem apontando para a variante 1.

---

## 2. Diagnostico critico (o problema real que motivou a reescrita)

A maior falha nao era "texto ruim", era **as 3 variantes nao se diferenciarem**.
Direto e Consultivo mudavam uma ou duas palavras e diziam a mesma coisa. Isso
tornava os 3 chips (Direto / Consultivo / Leve) decorativos: o operador nao
ganhava nada em escolher.

Outros defeitos corrigidos:
- Assinatura formal "da Pitstop Imports" vazava para passos do meio, quando a
  regra e que ela so aparece em **primeiro contato** e em **reativacao apos
  silencio longo**. Nos passos intermediarios ela soa template.
- Clichês de vendedor ("sem compromisso", "te ajudo a decidir") que baixam a
  confianca.
- `{produto}` repetido 3x na mesma frase em varios passos.
- Interrogatorio de multipla escolha que aumentava o custo de resposta do cliente.

### 2.1 Papel de cada variante (invariante de conteudo, para nao regredir)
- **Direto (v1):** eficiente, no maximo uma pergunta, afirma e conduz ao proximo passo.
- **Consultivo (v2):** conselheiro que entende o contexto antes de vender, investiga o porque.
- **Leve (v3):** curto, sem energia de venda, baixa friccao.

Exemplo do ganho, `avaliando · R4 · D14` (prova social), antes as duas primeiras
eram quase iguais; agora:
- Direto: "{nome}, já passou por aqui bastante cliente com a mesma dúvida que você tem sobre o {produto}. Quer que eu te conte como foi pra eles antes de decidir?"
- Consultivo: "{nome}, sua dúvida sobre o {produto} é a mesma de muita gente que comprou aqui e saiu satisfeita. Se ajudar, te mostro alguns relatos antes de você bater o martelo."

---

## 3. Estado do banco

- `public.dicionario_scripts`: 126 registros, todos com `texto_template` reescrito
  e `atualizado_em` atualizado. Chave `UNIQUE (tenant_id, perfil, passo, variante)`.
- Placeholders preservados e resolvendo: `{nome}` (primeiro nome), `{produto}`,
  `{data_combinada}` (perfil `em_espera`).
- Assinatura "Vini, da Pitstop Imports" presente em 17 registros: passos 0/1 de
  cada perfil (primeiro contato) mais as reaberturas de silencio longo. Confirmado
  que nao vaza para passos do meio.
- RPC `sugerir_mensagem` inalterada: devolve `opcoes[]` e mantem `texto`/`script_id`
  = variante 1.
- Security advisor: limpo, exceto `auth_leaked_password_protection` (toggle de dashboard).

---

## 4. Verificacao feita

1. **Checksum canonico.** Fonte ordenada por `perfil|passo|variante` (codepoint),
   MD5 = `b28656bb467c9b5a0aa4d8023cf36ef8`. Depois da migration, mesma query no
   banco (ORDER BY COLLATE "C" para casar com o sort) retornou **126 linhas e o
   MESMO MD5**. Zero corrupcao de acento, zero erro de transcricao.
2. **RPC autenticada em lead real.** `sugerir_mensagem` no LEAD-0005 (perfil
   `consulta`, passo `R2 · D2`) via `set_config request.jwt.claims` + `set role
   authenticated`. Retornou os 3 angulos ja diferenciados, `{nome}` -> "Duda",
   `{produto}` -> "17 Pro 256GB", `texto` = variante 1. `reset role` em call
   separada. Estrutura intacta.

Raio de impacto baixo e reversivel: a RPC e read-only e o operador revisa/edita
cada mensagem antes de enviar. Reverter e re-rodar a migration.

---

## 5. Pendencias

| # | Item | Bloqueio / nota |
|---|---|---|
| 1 | Deploy do `index_deploy.min.html` no Worker | **Reportado como feito pelo dono nesta sessao, ainda nao confirmado visualmente.** Validar abrindo a Fila num lead real e vendo os 3 chips com o texto novo. Ate esse build estar no ar, a Fila usa a frase generica antiga e nenhum dos 126 chega ao cliente. |
| 2 | Split do monolito (index.html + app.css + app.js) | Muda pipeline do Worker (servir css/js como assets). Fazer isolado, com confirmacao. Requer upload de `index_brand.html` no chat (repo privado, raw 404). |
| 3 | Leaked Password Protection | Toggle no dashboard Supabase, depois trocar a senha. |
| 4 | Fase 4 (aba historico) | Camada de escrita estavel. |
| 5 | Fase 5 (dashboards) | Views Postgres. |
| 6 | Redesign estetico | Adiado. |

---

## 6. Primeiro movimento do proximo chat
1. Ler este handoff e verificar estado vivo do banco via MCP.
2. **Confirmar a pendencia #1:** abrir a Fila num lead real e conferir que os 3
   chips aparecem com os textos novos (Direto / Consultivo / Leve). Se ainda usar
   a frase generica, o deploy do Worker nao subiu, e ele volta a ser o gargalo.
3. Se #1 confirmada, decidir o split do monolito (item 2) como tarefa isolada.

---

## 7. Invariantes reforcados
- `sugerir_mensagem` e a UNICA fonte de texto de abordagem na Fila. Nada de mensagem fixa no JS.
- Chave de busca de script e `perfil` + `passo` (inteiro), nunca o rotulo (rotulos sao editaveis).
- As 3 variantes devem cumprir papeis distintos (secao 2.1). Se Direto e Consultivo
  disserem a mesma coisa, e regressao.
- Assinatura formal so em primeiro contato e reativacao apos silencio longo.
- Qualquer reescrita de script passa por checksum MD5 (fonte vs banco) antes de dar por concluida.
- O link WhatsApp na Fila respeita consentimento (LGPD).
