# Handoff Migracao Pit Wall (Nucleo) v36

Substitui a v35. Data: 23/07/2026.

---

## 1. Headline: Hoje mais pratico (Fila embutida + lembrete com data) e Vendas mais esperto (modelo texto livre + venda ligada ao lead), tudo frontend, provado e no ar

Sessao de retomada apos um crash: o app fechou no meio da obra. O estado
encontrado tinha DUAS frentes meio-feitas e misturadas na arvore, e o backend
das duas JA estava aplicado no Supabase antes do crash. O que faltava era 100%
frontend. Fechadas as duas nesta sessao, provadas e pushadas pra main (deploy
pela Cloudflare).

- **Aba Hoje - Fila embutida (Peca A):** secao "Fila de hoje" logo abaixo do
  placar, ate 5 leads mais urgentes (mesma ordenacao de `montarFila`/`v`), cada
  linha com ponto de nivel + nome + nivel + perfil + tag de atraso e **so o botao
  Sugerir** (read-only, invariante 13). Botao "ver todos (N)" pula pra aba Fila.
  Fila vazia vira "Fila zerada hoje".
- **Aba Hoje - Lembrete com data (Peca B):** "+ Lembrete" ganhou `<input type=date>`
  + atalhos Hoje/Amanha, mandando `p_data` ao `salvar_lembrete`. Vencido carrega
  todo dia com tag "venceu ontem / atrasado N dias" (tint quente); agendado que
  chegou no dia aparece com destaque neutro.
- **Aba Vendas - form mais esperto:** modelo virou texto livre com datalist do
  catalogo (vende iPad/MacBook, manda `modelo_texto`); capacidade com datalist.
  Busca de cliente por nome/WhatsApp filtra a base ja carregada (reusa `g`) e ao
  escolher **liga a venda ao lead** (`lead_id`), preenche nome/WhatsApp e mostra
  "Vinculado a ... desfazer".

Spec da parte Hoje: `docs/superpowers/specs/2026-07-22-hoje-fila-e-lembrete-data-design.md`.

---

## 2. Backend: nada mudou nesta sessao (ja estava aplicado antes do crash)

Conferido via MCP no comeco da sessao, tudo LIVE:

- `venda` ja tem as colunas `modelo_texto` e `lead_id`.
- `registrar_venda(payload jsonb)` ja aceita `modelo_id` OU `modelo_texto`
  ("modelo obrigatorio" so se ambos nulos) e ja grava `lead_id` do payload.
- `salvar_lembrete(p_texto, p_data)` ja aceita `p_data` (default hoje no fuso BR).
- `painel_do_dia` ja seleciona lembrete por
  `data = v_dia OR (data < v_dia AND feito_em IS NULL)` e devolve `data`,
  `vencido` e `agendado`.

Licao: quem retomar apos um corte deve conferir o banco vivo ANTES de assumir o
que falta. Aqui, uma pergunta ao dono sobre "mexer no banco?" quase gerou
retrabalho: o banco ja estava pronto.

---

## 3. Armadilhas reais encontradas e resolvidas (nao repetir)

1. **`n="fila"` NAO troca de aba dentro do dispatcher.** O dispatcher de clique
   `A(a)` esta preso SO ao `#lista` e la dentro `n` e local (`n=e.closest(".card")`),
   enquanto a aba e o `n` GLOBAL. O patch original da Fila trocava aba com
   `n="fila";k()` (setava o local, nao a aba). Corrigido para
   `E("abaFila").click()`, que aciona o handler real (`n="fila",k()`).
2. **Clique dentro do `#painelVenda` nao chega no `A`** (fora do `#lista`). A busca
   de cliente delega por conta propria: `Y("painelVenda","click",fvCliClick)`.
3. **`R3 · D14` da spec nao tem campo por tras.** O lead no cliente nao tem
   `cadencia_rotulo` (0 ocorrencias). Troquei por `perfil`, que e dado real e ja
   aparece no card da Fila.
4. **Guard do azul da marca.** `validar.py` barra uso NOVO de `var(--accent)`.
   "ver todos" e a tag de agendado foram recoloridos pra neutro (`--dim`,
   `--surface`/`--line-forte`), respeitando "nenhum uso novo do azul".
5. **Harness testava o mundo antigo.** O teste de Vendas lia `fvModelo.options`
   (era `<select>`, virou `<input>`) e estourava "reading length of undefined";
   e o mock de `registrar_venda` exigia `modelo_id`. Atualizados os dois para o
   comportamento novo (texto livre), mais a assertion de ordem do Hoje (Fila entra
   no topo) e o payload (`modelo_texto`).

---

## 4. Provas (exit code, reexecutaveis da raiz)

```
python ferramentas/validar.py       # EXIT 0
python ferramentas/prova_trilho.py  # EXIT 0
python ferramentas/harness.py       # EXIT 0 -> 162 passou, 0 falhou
```

Asseroes novas no harness cobrem a Fila do Hoje: renderiza linhas, no maximo 5,
tem `data-acao="hoje-sugerir"`, NAO tem toque/desfecho (so leitura), tem
"ver todos".

Patch scripts registrados (idempotentes, molde de `patch_vendas.py`):
- `ferramentas/patch_hoje_fila_lembrete.py`
- `ferramentas/patch_vendas_cliente_modelo.py`

---

## 5. Nao entra nesta fatia (conscientemente)

- Recorrencia de lembrete por dia da semana (decisao do dono na spec).
- Mapear texto livre de modelo de volta pro id do catalogo: a fonte da verdade
  agora e `modelo_texto`. `modelo_id` fica so pra vendas antigas.
- CPF nao e preenchido pela busca de cliente (o lead nao carrega CPF).

---

## 6. Proxima fase ja decidida (inalterada da v33/v35)

Mover card no kanban = escrita de volta no Notion. BLOQUEADOR do dono, nao de
codigo: a integracao do Notion precisa da capability "Update content", senao o
`PATCH /v1/pages/{page_id}` volta 403. Ver CLAUDE.md secao "Proxima fase".
