# Handoff Migracao Pit Wall (Nucleo) v44

Substitui a v43. Data: 31/07/2026.

---

## 1. Headline: venda digitada errada deixava de ter conserto pela tela

Pedido do dono: *"preciso conseguir alterar as vendas feitas"* e, depois,
*"ao arquivar, o faturamento arquiva junto"*.

Ate hoje a venda era registro de mao unica: `renderVendas` montava o card com
**Ver cliente** e o bloco de NF, e nada mais. Nao existia `editar_venda`, nao
existia `arquivar_venda`, e nao existia botao de editar em lugar nenhum. O
passivo ja estava na base: **VENDA-0002 e VENDA-0003 sao a mesma venda** (Victor
Maia Dargains, iPhone 17 Pro Max, R$ 8.400, 16/07/2026), gravadas com **1,2
segundo de diferenca** (`19:27:30.389` e `19:27:31.549`). Duplicata de clique
duplo inflando contagem, faturamento e LTV desde 27/07/2026.

Havia tambem uma brecha **anterior a este trabalho**: `authenticated` tinha
`UPDATE` table-level em `public.venda`, com policy que so checava `tenant_id`.
Qualquer sessao logada podia, pela API, reescrever `data_venda` de uma venda
antiga e mover a ancora do pos-venda sem passar por codigo nenhum. Construir a
edicao em cima disso seria construir em cima do buraco.

O spec de record e `docs/superpowers/specs/2026-07-31-editar-vendas-design.md`.
Esta sessao fechou as duas fatias dele.

---

## 2. Decisoes (e o que ficou de fora)

1. **Escrita so por RPC, e a porta direta fechou.** `editar_venda` e
   `arquivar_venda` novas, mais `revoke update on public.venda from
   authenticated`. A whitelist de campos vive na RPC: ela simplesmente nao
   aceita `lead_id`, `data_venda`, `tenant_id`, `venda_code`, `criado_por`,
   `criado_em`. Recusado o update direto pelo PostgREST: sem validacao central e
   com a porta aberta.
2. **`data_venda` e o cliente ficam FORA do escopo, por decisao do dono.** Sao
   exatamente os dois campos que mexem na regua: desde a v43 `data_venda` e a
   ancora do pos-venda, e trocar `lead_id` move a venda de dono e mexe no
   pos-venda dos dois lados. Deixando os dois fora, **a edicao nao toca a
   cadencia** e a fatia fica pequena e reversivel.
3. **Na tela isso vira leitura, nao campo escondido.** No modo correcao o
   cliente aparece como texto (`Venda de Victor Maia Dargains · LEAD-0018`) e o
   `fvData` fica `disabled` com a razao escrita ao lado. Campo que some sem
   explicacao vira chamado.
4. **Um painel so serve cadastro e correcao.** Com dois formularios, o campo
   novo entraria num e sumiria no outro. O preco e que a limpeza do painel
   precisou virar completa (antes so `fvModelo` e `fvNfArq` eram zerados, e o
   resto ficava do cadastro anterior).
5. **Arquivar nao mora no card.** Tirar dinheiro do faturamento nao pode
   acontecer por polegar torto no meio da lista: mora no rodape do painel, atras
   de confirmacao que diz o que sai e que da pra voltar.
6. **`Cancelada` e `arquivada` sao coisas diferentes, e a tela diz isso.**
   Cancelada = a venda existiu e caiu. Arquivada = isso nunca foi uma venda (o
   caso da duplicata).
7. **O evento de arquivamento nao usa o tipo `fechou`.** O spec (secao 4.4)
   pedia `fechou`; a implementacao usa `arquivado` (e `nota` no caminho de
   volta). Desvio consciente: reusar `fechou` faria a venda arquivada contar
   como um fechamento novo em qualquer leitura por tipo.

---

## 3. Banco (1 migration, aplicada)

`20260731065657_editar_e_arquivar_venda`.

| objeto | o que faz |
|---|---|
| `privado.fn_venda_atualizar(uuid, jsonb)` | DEFINER, aplica os campos ja validados |
| `privado.fn_venda_arquivar(uuid, boolean)` | DEFINER, grava/limpa `arquivado_em` |
| `public.editar_venda(payload jsonb)` | INVOKER: o RLS prova o acesso, a whitelist filtra, o helper escreve |
| `public.arquivar_venda(p_id, p_arquivar)` | INVOKER, devolve `cliente_ficou_sem_venda` e grava o evento no cliente |
| privilegios | `revoke update on venda from authenticated`; execute das duas RPCs so para `authenticated` |

**Nada de view foi tocado, de proposito.** `v_venda`, `v_cliente`,
`painel_metricas` e `v_venda_nf` **ja** filtram `arquivado_em`, entao o dinheiro
sai sozinho. `CREATE OR REPLACE VIEW` derrubaria `security_invoker` em silencio,
e nao vale correr esse risco por um contador. A auditoria tambem sai de graca:
`trg_auditar_venda` ja estava na tabela.

---

## 4. Frontend

`public/index.html`, `public/app.css`, `public/app.js`:

- `cardVenda` ganha **Editar**. A linha do cliente passa a existir SEMPRE (antes
  sumia quando a venda nao tinha dono), porque e ela que carrega o botao.
- `abrirPainelVenda(leadId, venda)`: com `venda`, titulo vira `Editar
  VENDA-0002`, botao vira `Salvar correção`, painel ganha a classe
  `modo-edicao`.
- CSS **so esconde**, nunca redeclara `display`: `#painelVenda:not(.modo-edicao)
  .so-edicao{display:none}` e o par inverso. Assim `.cad-acoes` segue `flex` nos
  dois modos.
- Contador vira `3 vendas · 1 arquivada`, com `1 arquivada` clicavel. A lista
  das arquivadas le a **tabela** `venda` (`.not("arquivado_em","is",null)`), nao
  a `v_venda`, que as filtra.
- Card arquivado usa a familia `--frio`, nunca `--erro`: arquivada nao e falha
  de sistema. **Nenhum token de cor novo entrou.**

---

## 5. Provas

| prova | resultado |
|---|---|
| `node ferramentas/prova_venda_editar.js` (**nova**) | **89 assercoes, 0 falhas, EXIT 0** |
| `ferramentas/prova_venda_editar.sql` (**nova**) | **34 assercoes, 0 falhas** |
| `node ferramentas/prova_cliente.js` | 111 assercoes, EXIT 0 |
| `node ferramentas/prova_nf.js` | 54, EXIT 0 |
| `node ferramentas/prova_metricas.js` | 65, EXIT 0 |
| `node ferramentas/prova_regua.js` | 27, EXIT 0 |
| `node ferramentas/prova_sessao.js` | 18, EXIT 0 |
| `node --check public/app.js` | EXIT 0 |

**A prova nova foi testada contra si mesma.** Prova que passa de primeira nao
prova nada, entao o `app.js` foi mutado tres vezes e ela reprovou as tres, com
nome: tirando o filtro de campos do payload (2 falhas), tirando o
`window.confirm` do arquivar (12 falhas), tirando o `disabled` do `fvData` (1
falha). Ela tambem foi endurecida para REPROVAR em vez de estourar quando o
build esta quebrado.

**A prova de banco mede dinheiro em numero, nao em "mudou":** arquivando
VENDA-0003 dentro da transacao, o LEAD-0018 vai de `2 vendas / R$ 16.800` para
`1 / R$ 8.400`, e desarquivar restaura. Arquivar VENDA-0002 tira a NF da
`v_venda_nf` e desarquivar devolve. O bloco termina em `raise exception`:
conferido depois que **nada vazou** (0 tenants de prova, VENDA-0002 de volta em
8400, 0 vendas arquivadas, LTV do Victor de novo em 2 / 16.800).

Advisors de seguranca: **3 warnings, todos herdados** (`registrar_venda` e
`remover_nf` DEFINER expostos, leaked password protection). Nenhum novo.

### 5.1 Duas coisas que a prova pegou no SPEC, nao no codigo

1. **`criado_em >= clock_timestamp()` nunca casa dentro de uma transacao.**
   `now()` e o instante em que a transacao comecou, entao a linha de auditoria
   nasce com timestamp ANTERIOR ao marco. A primeira versao da prova acusou "0
   linhas de auditoria" com a auditoria funcionando perfeitamente. Contagem
   antes/depois resolve. Vale para qualquer prova futura neste banco.
2. **O item 8 do spec pedia o impossivel.** Ele exigia que
   `privado.fn_venda_atualizar` NAO fosse executavel por `authenticated`. Mas a
   RPC e SECURITY INVOKER (decisao 10 da v43, que existe para o RLS seguir
   isolando o tenant), entao ela roda com o privilegio de quem chamou: revogar
   esse EXECUTE **quebraria `editar_venda` em producao**. O que protege o helper
   nao e o grant, e o SCHEMA: `privado` esta fora dos schemas que o PostgREST
   expoe, e `anon` nao tem nem USAGE. Foi isso que a prova passou a assertar,
   incluindo uma assercao que REPROVA se alguem "endurecer" revogando o grant.
   Os helpers de cadencia da v43 tem exatamente o mesmo desenho.

**O que NAO foi provado:** o fluxo pela TELA logada (exigiria a senha do dono) e
a suite Python (`validar.py`, `harness.py`, `prova_trilho.py`), que segue sem
rodar nesta maquina por falta de Python. O CSS novo reusa tokens ja medidos, mas
nao foi remedido em Chrome headless.

---

## 6. Como usar (caminho exato)

**Corrigir uma venda:** aba **Vendas** -> no card, botao **Editar** (ao lado de
Ver cliente) -> ajuste os campos -> **Salvar correção**. Toast: `Venda
VENDA-0002 corrigida`.

**O que nao da pra mudar ali:** a data da venda (fica cinza, com a nota *"A data
ancora o pós-venda deste cliente, então não muda na correção"*) e o cliente
vinculado. Os campos do comprador seguem editaveis: eles sao a fotografia do dia
da venda, nao o cadastro do cliente.

**Arquivar a duplicata:** **Editar** na VENDA-0003 -> rolar ate o rodape ->
**Arquivar esta venda** -> ler a confirmacao -> OK. Ela sai da lista, do
faturamento e do total do cliente. Auditoria e historico ficam.

**Ver e desfazer:** no topo da aba Vendas, `1 arquivada` e um botao. Clicando,
abre a lista das arquivadas (visual apagado, codigo riscado, `fora do
faturamento`), cada uma com **Desarquivar**.

---

## 7. Pendencias

1. **A duplicata VENDA-0003 continua viva no banco.** A ferramenta para
   resolve-la existe e esta provada, mas o ato e do dono: e ele quem decide qual
   das duas e a boa. Enquanto nao arquivar, o faturamento segue inflado em
   R$ 8.400 e o LTV do Victor em 2 vendas.
2. Tudo o que a v43 deixou aberto segue aberto: a Fila ordenada por
   `proximo_contato` em vez de `bola_com`; speed-to-lead (238,4h de media) sem
   tile no Dashboard; `permite_esfriar` inalcancavel em 4 dos 6 perfis;
   `etapa_cadencia` decorativa.
3. Fora de escopo nomeado, para nao voltar como surpresa: editar `data_venda`,
   trocar o cliente da venda, historico de correcoes na tela e merge de vendas
   duplicadas.

---

## 8. Aviso de ambiente (corrige a v43)

**`origin` NAO aponta mais para proxy morto.** Medido em 31/07/2026: ele aponta
para `https://github.com/vinialbuquerquepitstop-beep/pitwall--nucleo.git`, o
repo real, e `git fetch origin main` funciona. A receita da v43 (push pela URL
completa) continua valida, so nao e mais necessaria.

Este clone recebe commits de outras sessoes pelo OneDrive: conferir `git log -1`
e comparar com `origin/main` antes de afirmar o que o app tem.

A Cloudflare serve as duas versoes durante o rollout: medir o tamanho uma vez so
mente. Repetir ate estabilizar (receita na v42 secao 9). `/index.html` responde
0 byte no worker; medir pela raiz com `curl -sL`.
