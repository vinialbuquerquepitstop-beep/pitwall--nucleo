# Mapa do pipeline de conteudo

A estrutura completa que liga o Notion ao dashboard Pit Wall. Ler sempre antes de mexer.
Este pipeline e LEGADO (Apps Script + Sheets), fora da migracao do Nucleo. Nada aqui
toca o Postgres.

## Os dois andares (nao se cruzam sozinhos)

### Andar Sync (Notion -> app)
O Calendario de Conteudo no Notion e a base mae.
DB do Notion: `ab0fc93f-d964-4f32-8c81-4be5343687b3`.

Fluxo: o botao sincronizar roda `syncNotion` -> puxa os cards do Calendario -> grava na
aba `Conteudo` da planilha de conteudo (`1fWhQ78vq1ScvYehvW6jvauS5WNY5kXtuPVhf09Ue7ek`).
`getConteudo` serve isso para as abas Conteudo e Hoje, e (depois do rewire `focusDoDia`)
para o Escopo.

Caracteristica: full replace. Cada sync limpa a aba `Conteudo` e regrava do zero. Nada
e incremental.

### Andar Molde (Config -> Escopo)
As linhas Story/Feed/Com e as tarefas fixas do Escopo nascem de `defaultFocus()` e
`defaultRoutine()` no Index.html, salvas na aba `Config`. E molde congelado: NAO le o
Notion. Por isso o slot Com (Comunidade: enquete, quiz, caixinha) e sempre molde, nao
existe como card no Notion.

## Quero mudar isso, mexo aqui

| Quero mudar | Mexo em | Efeito |
|---|---|---|
| Um post que aparece no app | Card no Calendario do Notion, depois sincronizar | Entra na aba Conteudo |
| Por que um card nao aparece | Card sem `Data`, fora da janela, ou `Tipo` errado | Ver regras |
| As tarefas fixas do Escopo | `defaultFocus`/`defaultRoutine` no Index.html | So apos Implantar |
| Os Vetores / aba Estrategia | Aba Vetores da planilha, lida por `getEstrategia` | Ver vetores-estrategia.md |
| Fazer um card sumir | `Status` = `Descartado` no Notion | Deletar pela API nao funciona |

## Regras que explicam quase todo problema

- Janela de sincronizacao: `syncNotion` so puxa cards com `Data` entre hoje menos 7 e
  hoje mais 28 dias. Semana muito a frente so aparece quando a data chega perto. Nao e
  bug.
- Full replace: sync limpa e regrava a aba Conteudo inteira.
- `Data` obrigatoria: card sem Data nem entra no sync.
- Select com grafia exata: diferenca de acento ou maiuscula cria opcao nova e quebra a
  leitura. Setar valor inexistente cria a opcao automaticamente, sem derrubar as outras
  (seguro, mas polui).
- Salvar nao publica: mudanca no Index.html so vai pro ar com Implantar, Nova versao.
  Funcao de servidor roda no editor sem publicar.

## Inventario de funcoes (andar Sync)

- `syncNotion`: puxa o Calendario e faz o full replace na aba Conteudo. Disparo manual.
- `getConteudo`: serve a aba Conteudo para Conteudo, Hoje e (pos rewire) Escopo.
- `focusDoDia`: rewire que fez o Escopo passar a ler do Conteudo.
- `getEstrategia`: contrato que alimenta a aba Estrategia a partir dos Vetores.
- `defaultFocus` / `defaultRoutine`: moldes do Escopo no Index.html, gravam na Config.

Nomes exatos de propriedade do Notem alem de `Data`, `Tipo`, `Status`, `Semana`, e os
IDs internos de cada propriedade: `[a confirmar]` no banco do Notion antes de escrever.
