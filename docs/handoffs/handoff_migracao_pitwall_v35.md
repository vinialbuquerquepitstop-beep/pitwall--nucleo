# Handoff Migracao Pit Wall (Nucleo) v35

Substitui a v34. Data: 22/07/2026.

---

## 1. Headline: a aba Vendas (fatia 1) esta no ar, backend e frontend, provada ponta a ponta

Nasceu a frente **Vendas**: registro de venda com aparelho, IMEI, valores,
lucro derivado, trade-in, fornecedor e ciclo de pre-venda. Fatia 1 (registro +
lista + form que salva) entregue, provada e **pushada pra main** (deploy pela
Cloudflare). O backend ja esta aplicado no Supabase.

Fluxo completo desta sessao, na ordem do processo: brainstorming -> spec ->
plano -> execucao task a task com prova. Spec em
`docs/superpowers/specs/2026-07-22-vendas-registro-design.md`, plano em
`docs/superpowers/plans/2026-07-22-vendas-fatia1.md`.

**Antes disso**, a sessao tapou um buraco herdado: a aba **Clientes** e a
**Calculadora** tinham entrado por outra maquina sem handoff. Ver v34 (a aba
Clientes le `v_lead` filtrando `perfil=comprou`; a faixa nao aparecia porque
`qtd_compras`/`valor_total` do lead estavam vazias, nao por falta de coluna).

---

## 2. O que a aba Vendas E (modelo mental)

- **Venda e entidade autonoma**, uma linha por venda (um aparelho, o caso normal).
  Tabela nova `public.venda`. Cliente e OPCIONAL (`lead_id` nullable) — decisao
  consciente do dono: venda sem cliente entra no registro mas nao soma no LTV.
- **Vendas primeiro, Clientes depois.** A venda e a FONTE; a aba Clientes vai
  AGREGAR (soma das vendas por `lead_id`). Isso mata a divergencia de duas
  verdades. A agregacao em si e a fatia 2 (ainda nao feita).
- **Lucro e derivado, nunca coluna** (mesmo principio do nivel): `valor_venda -
  custo_aparelho - despesa_frete - despesa_taxas`, calculado na view `v_venda`.
- **Trade-in e forma de pagamento, nao lucro.** O usado vira lucro quando
  revendido, que e simplesmente OUTRA venda com `custo_aparelho = entrada_valor`.
- **Pre-venda e a mesma venda mudando de `status`** (`pre_venda`/`concluida`/
  `cancelada`), nao entidade separada.

---

## 3. Backend (aplicado no Supabase `unjzpyexgtbcmjfgcqrx`, tudo provado via MCP)

Migrations em `supabase/migrations/` (versionadas E aplicadas):

| Arquivo | O que criou | Prova |
|---|---|---|
| `20260722_catalogo_iphone.sql` | tabela-catalogo (6 modelos), RLS | isolamento pelo sub: fora=0, dono=6 |
| `20260722_venda_tabela.sql` | `venda` (39 colunas), RLS, indices | 3 policies; isolamento fora=0, dono=1 |
| `20260722_venda_code_auditoria.sql` | `venda_code` (VENDA-0001) + auditoria | 2 inserts -> codes em sequencia + 2 auditorias |
| `20260722_registrar_venda_rpc.sql` | RPC `registrar_venda(payload jsonb)` | venda valida ok; sem valor/modelo -> erro |
| `20260722_v_venda.sql` | view com lucro derivado | security_invoker=on; lucro 540 |

Detalhes que o proximo que mexer precisa saber:
- **Auditoria reusa `public.fn_auditar()`** (funcao generica ja existente; le
  `tenant_id`/`id` de qualquer tabela via `to_jsonb`). NAO ha funcao de auditoria
  por tabela.
- **`venda_code`** vem do trigger `privado.fn_venda_code()` (max+1 por tenant).
  O `lead_code`, por comparacao, NAO tem trigger: veio do ETL.
- **RLS**: `privado.fn_tenant_atual()` resolve `select tenant_id from app_usuario
  where id = auth.uid()`. Ver secao 6 (armadilha de teste).
- **RPC** e SECURITY DEFINER, resolve tenant por `fn_tenant_atual()` e
  `criado_por` por `auth.uid()`. EXECUTE so para `authenticated`.

---

## 4. Frontend (no ar apos o push; `public/`)

- **Aba Vendas** e principal (`class="aba"`, nao rara), depois de Todos.
- **Lista** le `v_venda` (`carregarVendas` -> `renderVendas`): card com
  `venda_code`, modelo+capacidade+cor, cliente/`sem cliente`, data, IMEI, status,
  `valor_venda` e **lucro** (verde/vermelho). Botao `+ Nova venda`. Busca por
  code/modelo/cliente/IMEI. Estado vazio proprio.
- **Form** (`#painelVenda`, molde do editor de lead): Aparelho (modelo do
  catalogo, capacidade, cor, condicao, IMEI), Dinheiro (valor/custo/frete/taxas +
  **lucro ao vivo**), Cliente opcional (nome, whatsapp, CPF, aniversario,
  Instagram), Fornecedor (nome, contato, local de retirada), Trade-in, Entrega
  (status, endereco, valor a cobrar, motoboy), Fechamento (pagamento, data, NF,
  obs). Obrigatorios: modelo + valor. Salva pela RPC, toast, fecha e re-renderiza.
- **Como entrou**: `ferramentas/patch_vendas.py` (7 ancoras, todas unicas), no
  molde de `patch_hierarquia.py`. Funcoes legiveis inseridas na ancora
  `var scriptsData={};` (dentro do IIFE).
- **Provas**: `python ferramentas/validar.py` EXIT 0; `python ferramentas/harness.py`
  **157 passou, 0 falhou** (12 novas de Vendas: aba abre, card com lucro 540, form
  abre, lucro ao vivo 540, salvar chama a RPC e fecha).

Campos que a fatia 1 NAO expoe na UI ainda (existem no banco/RPC): vinculo a lead
existente (`lead_id` — nao ha busca de lead no form; a venda nasce com cliente
avulso ou sem cliente), e os anexos (NF/PIX, fatia 4).

---

## 5. As fatias, e onde paramos

| Fatia | Estado |
|---|---|
| 1 — Registro (tabela, RPC, view, aba, form, lista) | **FEITA, no ar** |
| 2 — `v_lead` agrega vendas (acende a faixa da aba Clientes) | a fazer |
| 3 — Promover lead a `comprou` + pos-venda, apos confirmacao no cadastro | a fazer (toca a regua) |
| 4 — Anexos NF + comprovante PIX (Supabase Storage, bucket privado, URL assinada) | a fazer |
| 4.5 — Pre-venda operavel + relatorio do motoboy (folha de rota read-only) | a fazer |
| 5 — Renomear "Clientes", trade-in ligando saida a origem, despesas discriminadas, placar de faturamento/lucro | a fazer |

**Decisao consciente do dono na fatia 3** (contra a recomendacao de adiar):
venda amarrada a lead, APOS confirmacao explicita no cadastro, promove a `comprou`
e entra no pos-venda. Por tocar a regua, e fatia propria, nunca junto do registro.

---

## 6. Armadilha nova (ja em aprendizados.md)

**Simular outro tenant no MCP e pelo `sub`, nunca pelo `app_metadata`.**
`fn_tenant_atual()` resolve por `auth.uid()` -> `app_usuario`. Forjar
`app_metadata.tenant_id` nao muda nada. Para provar isolamento: `sub` inexistente
(helper retorna null, ve 0) ou `sub` de outro tenant. Um teste com o `sub` do dono
"vendo tudo" nao prova vazamento, prova teste errado. Custou uma prova refeita na
Task 1 desta sessao.

Tambem: `validar.py` esperava 5 abas raras e ja estava vermelho na main desde que a
aba Clientes entrou (Clientes e rara, virou 6). Corrigido para 6. Mesmo tipo de
guard desatualizado que o harness teve na Calculadora. Licao repetida: quando uma
aba entra, atualizar A CONTAGEM nos DOIS (validar.py e harness.py).

---

## 7. Pendencias

Novas desta sessao:

| # | Item | Nota |
|---|---|---|
| 21 | Fatia 2: `v_lead` agregar vendas | acende a faixa da aba Clientes; so leitura |
| 22 | Form de venda nao vincula a lead existente | so cliente avulso/sem cliente na fatia 1; busca de lead fica pra depois |
| 23 | Form nao limpa os campos apos salvar | reabrir mostra valores antigos; meldevelloria |
| 24 | Modelos do catalogo: so 6 semeados (iPhone 11..16) | dono estende em `catalogo_iphone` sem tocar codigo |

Herdadas ainda abertas (ver v34): duas branches remotas (`claude/claude-md-docs-*`,
`claude/pitscare-estruturacao-*`), auditar RLS/gate dos precos da Calculadora, e a
fase do kanban de Conteudo escrever de volta no Notion (bloqueador do dono:
capability "Update content").

---

## 8. Estado do repo

`main` local == `origin/main` == `dfb22f0`. Working tree limpo. 9 commits desta
sessao empurrados (docs + 5 backend + 1 frontend). Banco com `venda` e
`catalogo_iphone` vazias de dado real (estado vazio, por decisao do dono: sem
venda de teste em producao).
