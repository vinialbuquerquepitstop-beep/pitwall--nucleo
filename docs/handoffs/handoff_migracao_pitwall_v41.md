# Handoff Migracao Pit Wall (Nucleo) v41

Substitui a v40. Data: 26/07/2026.

---

## 1. Headline: a NF entrou no sistema (arquivo, nao so numero)

Pedido do dono: "adicionar upload de nf em vendas e abas com as nfs".

Antes desta sessao a venda tinha `nf_numero` (um campo de texto no cadastro) e
`nf_url` (coluna que nunca foi lida nem escrita por ninguem). O ARQUIVO da nota
nao existia em lugar nenhum, e o projeto nao tinha **nenhum bucket de Storage**.

Agora existe: bucket privado, ponteiro auditado no banco, upload em dois lugares
da tela e uma aba propria que mostra as notas E as vendas que ainda estao sem.

Commit: `1604936` (frontend + prova). Banco: 3 migrations aplicadas direto.

**O que da pra abrir:**
- **Aba Vendas**: todo card declara o estado da nota. Com nota:
  `2 notas · nº 1042` + botao **Ver NF**. Sem nota: `SEM NOTA FISCAL` em morno
  + botao **Anexar NF** tingido.
- **Painel Nota fiscal** (abre pelo botao do card): lista as notas ja anexadas,
  cada uma com **Abrir** e **Remover**, e o formulario de anexo (arquivo +
  numero).
- **Cadastro de Nova venda**: campo *Arquivo da NF (PDF ou foto)* no bloco
  Fechamento. Sobe sozinho depois que a venda e salva.
- **Aba Notas fiscais** (`aba-rara`, entra pelo "Mais"): dois segmentos com
  contagem, **Com nota** e **Falta nota**.

---

## 2. Decisoes tomadas (e o que foi recusado)

1. **Bucket privado, nunca publico.** A NF tem CPF, nome, endereco e valor.
   Leitura e por **signed URL de 60 segundos**, pedida no clique. Nao existe
   link permanente para o arquivo em lugar nenhum da tela nem do banco.
2. **Tabela separada (`venda_nf`), nao coluna em `venda`.** Uma venda pode ter
   mais de uma nota (a da venda, a da compra do fornecedor, a do aparelho de
   entrada) e o campo unico obrigaria escolher uma. `venda.nf_url` **nao foi
   apagada**: virou legado com `COMMENT` dizendo onde o arquivo mora agora.
3. **Sem campo `tipo` de nota.** Foi considerado (venda / compra / entrada) e
   recusado pelo argumento que o proprio dono usou na v40: campo que fica vazio
   na maioria das vezes e pior que campo nenhum. Varias notas por venda ja
   resolvem o caso real sem inventar taxonomia. Se um dia a distincao importar,
   ela entra com um caso de uso na mao.
4. **A aba mostra as duas faces.** Listar so as notas anexadas esconderia
   exatamente o trabalho que falta, entao o segmento **Falta nota** conta as
   vendas ativas sem nenhuma NF. Venda `cancelada` nao cobra nota.
5. **Remover e marca, nao apagamento.** `removido_em` + `removido_por`; a linha
   some da tela, a auditoria guarda antes e depois, e o arquivo continua no
   bucket privado. `authenticated` nao tem UPDATE nem DELETE na tabela.

---

## 3. Banco (3 migrations)

### `nf_bucket_privado`
`storage.buckets`: id `nf`, `public = false`, limite **15 MB**, mimes
`application/pdf`, `image/jpeg|png|heic|heif|webp`, `application/xml`, `text/xml`.

Policies em `storage.objects` (so `authenticated`, so SELECT e INSERT):
```
bucket_id = 'nf' AND (storage.foldername(name))[1] = privado.fn_tenant_atual()::text
```
Caminho obrigatorio: **`{tenant_id}/{venda_id}/{uuid}.{ext}`**. O nome original
do arquivo NAO entra no caminho (evita colisao e nome hostil no path).

### `venda_nf_tabela`
```
id, tenant_id (default fn_tenant_atual()), venda_id -> venda(id) on delete restrict,
numero, arquivo, nome_original, mime, tamanho, enviado_em, enviado_por,
removido_em, removido_por
```
- `UNIQUE (tenant_id, arquivo)` e `CHECK (arquivo like tenant_id || '/%')`: o
  caminho e conferido tambem no banco, nao so na policy do Storage.
- RLS por `privado.fn_tenant_atual()`; a policy de INSERT exige ainda que a
  venda exista **no mesmo tenant**.
- Grants: `authenticated` so tem **SELECT e INSERT** (append-only).
- Trigger `trg_auditar_venda_nf` -> `fn_auditar()`.

### `venda_nf_view_e_rpcs`
- **`v_venda_nf`**: NF + contexto da venda (codigo, cliente, modelo, valor,
  data). `security_invoker = on` conferido em `pg_class.reloptions` depois do
  `CREATE OR REPLACE`.
- **`anexar_nf(payload jsonb)`**, SECURITY INVOKER. Recusas provadas, todas com
  mensagem legivel: sessao invalida, sem venda/arquivo, caminho fora da pasta da
  venda, venda inexistente, arquivo repetido. Se `numero` vier e a venda ainda
  estiver sem `nf_numero`, preenche; **nunca sobrescreve numero ja registrado**.
- **`remover_nf(p_id)`**, SECURITY DEFINER: e o unico caminho de UPDATE na
  tabela, ja que `authenticated` nao tem esse privilegio.

---

## 4. Frontend

Bloco legivel novo em `public/app.js`, logo depois de `salvarVenda`:
`nfTenant` / `nfExt` / `nfTam` / `nfQuando` / `subirNf` / `carregarNfs` /
`nfsDaVenda` / `nfLinhaVenda` / `nfItem` / `abrirArquivoNf` / `removerNf` /
`abrirPainelNf` / `pintarPainelNf` / `salvarNfPainel` / `nfListaClick` /
`nfSemNota` / `filtNfBusca` / `cardNf` / `renderNfs`.

Detalhes que custaram decisao:
- **Sobe primeiro, registra depois.** O ponteiro so existe se o arquivo existir.
  Se a RPC recusar, o objeto fica orfao no bucket privado (invisivel na tela) e
  o operador ve o erro. O contrario deixaria linha apontando para o nada.
- **A janela do pop-up abre no clique**, sincrona, e so depois recebe a signed
  URL: aberta depois do `await`, o navegador bloqueia.
- `nf-pede` usa a semantica de **morno**, nao de erro: falta de nota e trabalho
  pendente, nao falha do sistema.
- `.btn-acao` nasce com `flex:1` (para preencher a linha em `.card-acoes`);
  em `.nf-linha` isso esticava o botao pela linha inteira. Corrigido com
  `flex:0 0 auto` so nos dois contextos novos.
- CSS: bloco `.nf-*` + `.campo-nota` + estilo de `input[type=file]` no fim de
  `public/app.css`.
- `index.html`: aba `abaNfs`, painel `#painelNf`, campo `#fvNfArq`.
- Roteador: `"nfs"` entrou em aria-selected, titulo do topo, lista do "Mais",
  ocultacao do pitboard (contador de leads nao diz nada sobre nota) e barra de
  busca (busca por codigo da venda, numero, cliente, modelo ou nome do arquivo).

---

## 5. Provas

| prova | resultado |
|---|---|
| `node --check public/app.js` | EXIT 0 |
| `node ferramentas/prova_nf.js` (**novo**) | 54 assercoes, 0 falhas, EXIT 0 |
| `node ferramentas/prova_metricas.js` | EXIT 0, sem regressao |
| RLS como dono | anexa, le, remove |
| RLS como vendedor (Brendon) | le a NF do tenant pela view |
| RLS como tenant errado | 0 linhas, `anexar_nf` e `remover_nf` devolvem "Sessao invalida" |
| append-only | UPDATE, DELETE e TRUNCATE negados (`42501`) para `authenticated` |
| auditoria | INSERT com `antes` nulo; soft delete com `antes` e `depois` |
| Storage policy | dono grava e le na pasta do tenant; gravar em pasta de outro tenant e negado pela RLS; tenant errado enxerga 0 objetos |
| contraste (Chrome, cor computada) | `SEM NOTA FISCAL` 5.10:1, botao Anexar NF 4.61:1, `2 notas` 5.81:1, segmento marcado 8.88:1 |
| layout 390px | conferido em iframe; conteudo 373px, **sem estouro horizontal** |
| app rodando (localhost servindo o `public/` real, sessao do dono, banco de producao) | aba Notas fiscais abre, dois segmentos em 0, estado vazio ensina o caminho |

### Upload de verdade, pela API HTTP do Storage
Feito no navegador com a sessao real do dono (nao em SQL), com um PDF de 12
bytes, e depois apagado:

| o que | resultado |
|---|---|
| upload em `{tenant}/{pasta}/prova-http.pdf` | passou |
| upload em pasta de outro tenant | `new row violates row-level security policy` |
| upload de `text/plain` | `mime type text/plain is not supported` (limite do bucket) |
| signed URL de 60s | gerada; `fetch` leu os 12 bytes de volta |
| **URL publica do mesmo arquivo** | **HTTP 400** — bucket privado nao serve |
| `anexar_nf` com venda que nao existe | `{"ok":false,"erro":"Venda nao encontrada"}` |

Toda linha de teste foi apagada: `venda`, `venda_nf` e `storage.objects` do
bucket `nf` estao com **0 linhas**. A auditoria guardou o rastro.

**O que NAO foi provado:** o limite de 15 MB (nao foi gerado arquivo grande) e o
fluxo completo pela TELA (anexar pelo painel exige uma venda registrada, e
`venda` esta com 0 linhas; registrar uma venda de teste em producao sujaria a
numeracao `VENDA-0001`). A suite Python (`validar.py`, `harness.py`,
`prova_trilho.py`) segue sem rodar nesta maquina: nao ha Python, so o stub da
Microsoft Store.

---

## 6. Como usar (caminho exato)

**Venda nova, com a nota na mao:** aba Vendas -> `+ Nova venda` -> no fim do
formulario, bloco *Fechamento*, campo **Arquivo da NF** -> Salvar venda. O
arquivo sobe logo depois do registro e o toast diz "registrada com NF".

**Venda que ja existe:** aba Vendas -> no card, **Anexar NF** -> escolher o
arquivo, opcionalmente o numero -> **Anexar NF**.

**Ver o que falta:** aba **Notas fiscais** (dentro de "Mais") -> segmento
**Falta nota**. Cada venda ali tem o botao de anexar no proprio card.

**Abrir uma nota:** botao **Abrir** (gera link de 60s e abre em outra aba). Se o
navegador bloquear pop-up, a tela avisa.

---

## 7. Pendencias

1. **`venda` continua com 0 linhas.** Herdado da v40 e nao resolvido aqui: sem
   venda registrada, a aba Notas fiscais abre vazia e o "R$ vendido" do
   Dashboard segue R$ 0,00. A primeira venda de verdade e o que liga as duas
   telas.
2. **Arquivo orfao no bucket** se o upload passar e a RPC recusar. Hoje nao ha
   varredura; e um arquivo privado sem ponteiro, invisivel na tela. Se virar
   volume, cabe uma limpeza por `storage.objects` sem linha em `venda_nf`.
3. **Sujeira nos agregados herdados** (v40, item 2): `LEAD-0008`, `LEAD-0014` e
   `LEAD-0003` continuam divergindo entre `perfil` e `qtd_compras`.
4. Pendencias da v39 nao tocadas: vazamento do `dados.js` da Netlify e custo
   real exposto na `/calc/`.

---

## 8. Aviso de ambiente (sem mudanca desde a v40)

O clone local tem `origin` apontando para um proxy morto: `git push origin` e
`git fetch` sem URL nao valem nada aqui. Push (que E o deploy) sai por
`git push https://github.com/vinialbuquerquepitstop-beep/pitwall--nucleo.git main`.
Conferir `git log -1` antes de commitar: este clone recebe commits de outras
sessoes pelo OneDrive no meio do trabalho.
