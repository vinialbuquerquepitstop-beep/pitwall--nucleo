# Handoff Migracao Pit Wall (Nucleo) v38

Substitui a v37. Data: 23/07/2026.

---

## 1. Headline: fluidez das abas + kanban de Conteudo virou ESCRITA de volta no Notion

Duas frentes num push so (decisao do dono, "subir tudo junto"):

- **Fluidez** (frontend puro): troca de aba deixou de sobrepor painel, deixou de
  saltar no carregamento, e rola pro topo.
- **Kanban interativo**: mover card na aba Conteudo agora escreve o Status de
  volta no Notion. O Notion segue fonte unica; o Pit Wall virou controle remoto.
  Era a "proxima fase ja decidida" desde a v33.

Provas (exit code, da raiz): `validar.py` EXIT 0, `prova_trilho.py` EXIT 0,
`harness.py` EXIT 0 -> **177 passou, 0 falhou** (eram 167 na v37).

---

## 2. Fluidez (o primeiro pedido do dono nesta sessao)

Tres defeitos corrigidos, so em `app.js`/`app.css`:

1. **Painel sobrepondo e permanecendo.** A troca de aba `k()` nunca fechava
   `painelCadastro`/`painelEdicao`/`painelVenda`. Novo helper `G(x)` fecha os tres
   (`M();R();fecharPainelVenda()`), reseta o scroll (`scrollTo(0,0)`) e so entao
   troca. Os 11 handlers de aba passaram a chamar `G("...")`. Provado no harness:
   abrir Nova venda + clicar Todos -> painel fica `oculto`.
2. **Push de carregamento.** Os 6 spinners `Lendo...` ganharam a classe
   `carregando`: `.estado.carregando` reserva 48vh (nao colapsa a pagina) e tem
   fade com atraso de 120ms (load rapido troca o conteudo antes do fade entrar,
   entao nao pisca). Vazio/erro seguem compactos.
3. **Abas rolando.** `.abas` ganhou `overflow-y:auto;min-height:0;scroll-behavior:smooth`
   (nao corta com viewport baixo).

---

## 3. Kanban write-back: como funciona

- **Edge Function nova `mover-conteudo`** (deployada, version 1, ACTIVE,
  verify_jwt=true). Contrato: `POST {id, para}` onde `id` e o uuid local do card
  e `para` e o codigo da coluna (`a_produzir`/`em_producao`/`pronto`/`publicado`).
  - Auth: so `authenticated` (mover e acao de operador, nunca cron nem anon).
  - Le o card COM O TOKEN DO USUARIO (RLS `tenant_id = fn_tenant_atual`): um
    tenant nunca move card de outro so mandando o id.
  - **Notion PRIMEIRO** (invariante): `PATCH /v1/pages/{notion_page_id}` com
    `{properties:{Status:{select:{name:"Pronto"}}}}`. Local so muda se o PATCH
    passar. 403/404/401 -> `ok:false` com msg exata, nada toca o local.
  - Espelho local via service key (escopo tenant+id ja conferido).
- **Frontend** (`renderConteudo`/`contCard`/`contColuna` + `moverConteudo`):
  - Desktop: **arrastar** card entre colunas (HTML5 DnD, `contDragStart/Over/Drop/End`).
  - Celular/fallback: botao **Mover** por card, menu com as outras 3 colunas.
    (interacao aprovada pelo dono na v33: arrastar no desktop E botao no celular.)
  - **Move otimista**: o card pula pra coluna nova na hora (`.movendo`, apagado),
    o PATCH confirma em 2o plano; sucesso -> `renderConteudo(true)` SILENCIOSO
    (sem spinner, sem blank); falha -> re-render silencioso devolve o card + toast.
  - **Colunas de altura igual** (`.cont-kanban{align-items:stretch}`): a coluna
    inteira e area de drop. Antes (`align-items:start`) coluna curta so aceitava
    drop no topo, forcando rolar pra cima pra mirar num card.

Schema conferido no Notion em 23/07: propriedade **Status e `select`** (nao
`status`), opcoes exatas `A produzir / Em produção / Pronto / Publicado /
Descartado`. O mapa codigo->nome exato vive na Edge Function, pinado como a
NOTION_VERSION. `Descartado` NAO e alvo de arrasto (coluna colapsada de leitura).

---

## 4. O QUE FALTA PROVAR (a divida honesta desta fatia)

O dono mandou subir com a capability **"Update content" do Notion ainda NAO
verificada ao vivo** por ele. Decisao consciente dele, registrada. A degradacao
e segura: se o token do app nao tiver a capability, o PATCH volta 403, o card
volta pra coluna de origem e o toast diz "Notion recusou a escrita (403). Falta
a capability Update content na integracao." Zero corrupcao.

**Proxima sessao / dono:** o teste vivo e mover UM card e conferir se o Status
mudou no Notion. Se der 403, ligar "Update content" na integracao DONA do
`NOTION_TOKEN` (secret da Edge Function no Supabase), nao pelo nome da integracao:
identificar cruzando (a) o secret `NOTION_TOKEN` no Supabase com o "Internal
Integration Secret" de cada integracao, e (b) qual integracao esta em Connections
da database do Calendario (`ab0fc93f-d964-4f32-8c81-4be5343687b3`). Ha 3
integracoes "pitwall*" com acesso; least-privilege pede deixar so a que o app usa.

A conexao MCP desta sessao le a database mas usa credencial DIFERENTE do app,
entao NAO prova nada sobre a capability de escrita do token que importa.

---

## 5. Arquivos tocados

- `public/app.js` — helper `G` + handlers de aba; classe `carregando` nos 6
  spinners; kanban: `contMoverCtl`, `contCard(x,mover)`, `moverConteudo` otimista,
  `contDragStart/Over/Drop/End`, `renderConteudo(silencioso)`, handlers
  `cont-mover`/`cont-mover-para` no `A()`, wiring de drag no `init`.
- `public/app.css` — `.estado.carregando`, `.abas` scroll, kanban DnD
  (`.cont-card[draggable]`, `.arrastando`, `.movendo`, `.cont-col.alvo`,
  `.cont-mover*`), `.cont-kanban{align-items:stretch}`.
- `supabase/functions/mover-conteudo/index.ts` — Edge Function nova (deployada).
- `ferramentas/harness.py` — +10 asseroes (fecha painel na troca de aba; kanban
  move via botao Mover chama `mover-conteudo` com id+para, card troca de coluna;
  `align-items:stretch` aplicado).

Zero mudanca de SQL nesta fatia: o mover chaveia pelo `id` local que a tela ja
tem, e a Edge Function resolve o `notion_page_id` lendo `conteudo` por RLS.

---

## 6. Proxima fase

Destravar/confirmar a capability "Update content" (secao 4). Depois disso o
kanban write-back esta 100% de ponta a ponta. Nada mais pendente de codigo aqui.
