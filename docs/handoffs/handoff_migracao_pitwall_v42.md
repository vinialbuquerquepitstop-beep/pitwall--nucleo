# Handoff Migracao Pit Wall (Nucleo) v42

Substitui a v41. Data: 27/07/2026.

---

## 1. Headline: o cliente virou entidade de verdade, e nenhuma venda fica sem dono

Pedido do dono: *"adicione as informacoes de rg, cpf e endereco nos clientes. alem
de todo lead que comprar, se tornar venda. e toda venda e cliente estarem
interligados."*

O diagnostico antes de escrever qualquer linha, tirado do banco vivo:

- **LEAD-0018 (Victor Maia Dargains) tinha DUAS vendas no nome e perfil `consulta`**:
  nao aparecia na aba Clientes. O vinculo existia na coluna `venda.lead_id` e
  nenhuma regra ou tela usava.
- **VENDA-0001 estava com `lead_id` nulo**: venda sem dono.
- **`registrar_desfecho('convertido')`** (o botao **Fechou** da Fila) mexia so no
  `status`. Nao criava venda e nem marcava `perfil = comprou`. Era o vazamento:
  funil dizia "convertido", caixa nao tinha linha nenhuma.
- **`lead` nao tinha CPF, RG nem endereco.** O que existia era `venda.comprador_cpf`
  (vazio nas tres vendas) e `venda.endereco_entrega` em texto livre.

Agora: identidade mora no cliente, `venda.lead_id` e **NOT NULL**, e registrar a
venda E o ato que transforma o lead em cliente.

**O que da pra abrir:**
- **Aba Clientes** reescrita, lendo a view nova `v_cliente`. Tres segmentos com
  contagem: **Clientes**, **Falta venda**, **Falta cadastro**.
- **Card do cliente**: CPF, RG e endereco em uma linha cada; a lista das vendas
  daquela pessoa dentro do card; botao **Dados**, botao **Registrar venda**.
- **Painel Dados do cliente**: CPF, RG, CEP, logradouro, complemento, bairro,
  cidade, UF.
- **Card da venda**: codigo do cliente + botao **Ver cliente** (caminho de volta),
  e o aviso `sem CPF nem endereço` quando o cadastro nao fecha NF.
- **Botao Fechou da Fila** abre o formulario de venda com o lead ja vinculado.

---

## 2. Decisoes tomadas (e o que foi recusado)

1. **Identidade no LEAD, nao na venda.** A pessoa e uma so, as vendas sao varias.
   `venda.comprador_*` **nao foi apagada**: continua como FOTOGRAFIA do dia da
   venda (nome e CPF mudam com o tempo), mas o cadastro de record e o do cliente.
2. **Endereco estruturado, nao um campo de texto.** `cep`, `endereco` (logradouro
   e numero), `complemento`, `bairro`, `cidade`, `uf`. Texto unico nao serve pra
   NF nem deixa medir o que falta. Na tela aparece como UMA linha, na ordem do
   envelope: quem digita nao paga o preco da estrutura.
3. **CPF validado no digito verificador, e unico por tenant.** `111.111.111-11`
   fecha a conta mas nao existe: recusado. Dois cadastros com o mesmo CPF sao a
   mesma pessoa em duplicata, entao o banco recusa (indice parcial, lead
   arquivado fica de fora pra nao travar recadastro legitimo). RG e texto livre:
   nao tem formato nem digito verificador padronizado entre os estados.
4. **`venda.lead_id` NOT NULL.** Venda sem cliente e numero sem dono: nao cobra,
   nao entrega, nao emite NF e nao vende de novo pra pessoa. As tres vendas
   existentes foram vinculadas antes de a coluna endurecer.
5. **Fechar = registrar a venda.** Recusada a alternativa de criar uma "venda
   rascunho" no clique do Fechou: linha de valor zero sujaria o R$ vendido e
   ninguem voltaria pra completar. Quem fecha registra a venda, e a RPC promove o
   lead a `comprou` no mesmo ato.
6. **O `perfil = comprou` continua editavel a mao.** Nao foi bloqueado. Quem for
   marcado comprou sem venda cai no segmento **Falta venda**, com o botao de
   registrar no proprio card. Bloquear travaria os tres clientes herdados do CRM
   (LEAD-0001, 0006, 0014), que compraram de verdade antes de existir tabela.
7. **Endereco do cadastro NAO e alimentado pelo `endereco_entrega`.** O caminho e
   o contrario: o cadastro pre-preenche a entrega. `Laranjeiras Mall` e ponto de
   encontro, nao residencia; copiar isso pro cadastro envenenaria a NF.
8. **Lastro e agregado herdado nunca se somam.** `vendas_qtd`/`vendas_total` (da
   tabela `venda`) e `qtd_compras`/`valor_total` (importados do CRM antigo, sem
   lastro) aparecem em chips separados e rotulados. Mesma regra ja valida no
   Dashboard: numeros de confianca diferente nao viram um terceiro numero.
9. **Identidade so preenche buraco.** `registrar_venda` copia CPF e nascimento do
   formulario pro cadastro apenas quando o campo esta vazio; nunca sobrescreve, e
   nunca grava CPF que ja pertence a outro cliente ativo.

---

## 3. Banco (8 migrations, todas aplicadas)

| migration | o que faz |
|---|---|
| `cliente_identidade_cpf_rg_endereco` | 8 colunas em `lead` (cpf, rg, cep, endereco, complemento, bairro, cidade, uf), CHECKs de formato, indice unico parcial do CPF, `privado.fn_cpf_valido` |
| `salvar_identidade_rpc` | RPC `salvar_identidade(uuid, jsonb)`, SECURITY INVOKER |
| `venda_exige_cliente_backfill` | vincula as vendas orfas (criou LEAD-0019 pro comprador da VENDA-0001) e poe `venda.lead_id` NOT NULL |
| `registrar_venda_v2_cliente_obrigatorio` | RPC reescrita: exige cliente, reaproveita quem tem o mesmo WhatsApp, cria o cadastro quando nao existe, promove a `comprou` e grava evento no historico |
| `v_cliente_e_normalizacao_perfil` | corrige o perfil de quem ja tinha venda (LEAD-0018) e cria a view `v_cliente` |
| `v_venda_traz_o_cliente` | `v_venda` ganha `cliente_code`, `cliente_whatsapp`, `cliente_tem_cpf`, `cliente_tem_endereco` |
| `v_lead_traz_identidade` | `v_lead` passa a carregar a identidade (o formulario de venda pre-preenche dali) |
| `salvar_identidade_fix_array` | correcao de `v_mudou \|\| 'CPF'`, que o Postgres lia como literal de array (a prova pegou antes de ir pra tela) |

Cuidados do CLAUDE.md cumpridos e conferidos: `security_invoker = on` reconferido
em `pg_class.reloptions` nas TRES views depois do `CREATE OR REPLACE`; ACL
refeita (`revoke`/`grant`) depois de cada `CREATE OR REPLACE FUNCTION`.

`privado.fn_brl(numeric)` nasceu aqui: o `lc_numeric` do banco e `en_US.UTF-8`,
entao `to_char` devolvia **`R$ 1,000.00`** no historico. O `translate(...,',.','.,')`
troca os dois separadores de uma vez.

---

## 4. Frontend

- `public/index.html`: painel `#painelCliente` (8 campos + salvar/cancelar/erro);
  o bloco Cliente do formulario de venda deixou de ser *(opcional)*.
- `public/app.js`, bloco legivel novo depois de `salvarVenda`: `cliDig`,
  `cliFmtCpf`, `cliFmtCep`, `cliEndereco`, `cliIdent`, `cliFaixa`, `cliVendas`,
  `cardCliente`, `cliDoSeg`, `filtCliBusca`, `carregarClientes`, `renderClientes`,
  `cliDoBanco`, `abrirPainelCliente`, `fecharPainelCliente`, `salvarCliente`,
  `cliVerCliente`, `fecharComVenda`, `cliAcao`. No bloco de vendas: `vendaCliLinha`.
- **Cinco costuras no nucleo minificado**, cada uma conferida como ocorrencia
  UNICA antes de trocar (o script aborta se achar 0 ou 2):
  1. `"clientes"===n` passa a chamar `renderClientes(e)`;
  2. o botao Fechou chama `fecharComVenda(t)` no lugar de `registrar_desfecho`;
  3. `cliAcao(o,t,e)` entra no delegado `A` antes das demais acoes;
  4. `G(x)` tambem fecha o painel de cliente ao trocar de aba;
  5. `Y("btnSalvarCliente"...)` e `Y("btnCancelarCliente"...)` no init.
- `public/app.css`: bloco `.cli-*` / `.venda-cli-*` / `.cad-nota`. Falta de
  cadastro usa `--morno-fg` (trabalho pendente), nunca `--erro` (falha de
  sistema): o mesmo criterio que a NF ja usava.
- Busca da aba Clientes acha por nome, codigo do lead, telefone, **CPF** (aceita
  digitado com pontuacao) e aparelho comprado.

---

## 5. Provas

| prova | resultado |
|---|---|
| `node ferramentas/prova_cliente.js` (**novo**) | **81 assercoes, 0 falhas, EXIT 0** |
| `node ferramentas/prova_nf.js` | 54 assercoes, 0 falhas, EXIT 0 (sem regressao) |
| `node ferramentas/prova_metricas.js` | 65 assercoes, 0 falhas, EXIT 0 |
| `node ferramentas/prova_sessao.js` | 18 assercoes, 0 falhas, EXIT 0 |
| `node --check public/app.js` | EXIT 0 |
| carga do arquivo inteiro em VM (`__PITWALL_SEM_INIT`) | avalia sem ReferenceError, 22 membros exportados |
| ids do `index.html` | 137 ids, 0 duplicados, 125 `<div>` abertas e fechadas |
| app rodando (`localhost:8788`, Chrome) | carrega, tela de login pinta, **0 mensagens no console** (o helper `Y` avisaria por console.warn se algum listener novo nao achasse seu elemento) |

**15 assercoes no banco**, rodadas com `set local role authenticated` e as claims
do dono, dentro de transacao que **volta atras de proposito** (`raise exception`
no fim, para nao gastar numeracao de `VENDA-`):

| caso | resultado |
|---|---|
| venda sem cliente nenhum | `Toda venda precisa de cliente: escolha alguem da base ou informe o nome do comprador` |
| venda com comprador novo | cria LEAD-0020, `perfil=comprou`, CPF e nascimento propagados, evento `VENDA-0004 registrada: iPhone 12 por R$ 1.000,00` |
| mesmo WhatsApp de novo | reaproveita o cadastro; segue 1 lead com aquele numero |
| lead antigo (LEAD-0004, repescagem) | vira `comprou` / `convertido` ao registrar a venda |
| venda **cancelada** | registra a venda e **nao** promove o lead |
| CPF `111.111.111-11` | `CPF invalido: confira os numeros` |
| CPF valido + endereco | grava; UF normalizada de `rj` pra `RJ`, CEP so digitos, evento `Dados do cliente: CPF, RG, endereco` |
| mesmo CPF em outro cliente | `Esse CPF ja esta em Isac smart (LEAD-0006)` |
| CEP de 3 digitos / UF `Rio` | recusados com mensagem legivel |
| tenant errado | `registrar_venda` e `salvar_identidade` devolvem `Sessao invalida`; `v_cliente` devolve 0 linhas |

Depois do rollback: 19 leads, 3 vendas, 0 CPF gravado. Nada de teste ficou.

**O que NAO foi provado:** o fluxo pela TELA logada (a prova exigiria digitar a
senha do dono, o que nao se faz por aqui) e a suite Python (`validar.py`,
`harness.py`, `prova_trilho.py`), que segue sem rodar nesta maquina por falta de
Python. O contraste dos rotulos novos usa tokens ja medidos (`--morno-fg` 4.61
no tint), mas nao foi remedido em Chrome headless.

---

## 6. Como usar (caminho exato)

**Guardar CPF/RG/endereco:** aba **Clientes** -> no card, botao **Dados** ->
preencher -> **Salvar dados**. CPF errado volta na hora, com o motivo.

**Fechar um lead que comprou:** aba **Fila do dia** -> no card, **Fechou** ->
o formulario de venda abre com o cliente ja vinculado -> preencher e **Salvar
venda**. O lead vira cliente no mesmo ato.

**Ver quem comprou e ainda nao tem venda lancada:** aba **Clientes** -> segmento
**Falta venda** -> botao **Registrar venda** no card.

**Ver quem nao tem cadastro pra NF:** aba **Clientes** -> segmento **Falta
cadastro**.

**Da venda pro cliente:** aba **Vendas** -> no card, **Ver cliente**.

---

## 7. Pendencias

1. **VENDA-0002 e VENDA-0003 sao identicas** (LEAD-0018, 16/07/2026, R$ 8.400,00
   as duas, mesmo modelo): cheiro de duplo clique. **Nao foram apagadas** — e
   decisao de negocio, nao de codigo. Se for duplicata, o caminho e arquivar uma
   (`arquivado_em`), nunca deletar. Enquanto isso ela infla `vendas_total` do
   Victor e o R$ vendido do Dashboard.
2. **Cadastro vazio em todo mundo.** Os 5 clientes estao sem CPF e sem endereco;
   o segmento **Falta cadastro** hoje marca 5 de 5. E trabalho de digitacao, e a
   tela agora diz exatamente quem falta.
3. **Sujeira nos agregados herdados** (v40 item 2, v41 item 3): LEAD-0008,
   LEAD-0014 e LEAD-0003 divergem entre `perfil` e `qtd_compras`. Nao tocada: com
   `v_cliente` separando lastro de herdado, agora da pra decidir com o numero na
   mao.
4. **A gaveta Detalhes do cliente (commit `e6d797b`, v34) NAO esta em `main`.**
   Conferido com `git merge-base --is-ancestor`: perdida em algum rebase. O patch
   esta salvo em `docs/patches/0001-feat-clientes-gaveta-Detalhes...`. Parte do
   que ela mostrava (Troca, Avaliacao, Origem) segue fora do card novo.
5. Arquivo orfao no bucket de NF (v41 item 2) e pendencias da v39 (vazamento do
   `dados.js` da Netlify, custo real exposto na `/calc/`) seguem abertas.

---

## 8. Aviso de ambiente (sem mudanca desde a v40)

`origin` aponta pra um proxy morto: `git push origin` e `git fetch` sem URL nao
valem nada aqui. Push (que E o deploy) sai por
`git push https://github.com/vinialbuquerquepitstop-beep/pitwall--nucleo.git main`.
Conferir `git log -1` antes de commitar: este clone recebe commits de outras
sessoes pelo OneDrive no meio do trabalho.

Preview local: `node ferramentas/servir.js` -> `http://localhost:8788` (arquivo
novo nesta sessao; serve o `public/` real e fala com o Supabase de producao).
