---
name: pitwall-conteudo
description: Operador técnico e auditor do pipeline de conteúdo da Pitstop Imports, do Notion (Calendário de Conteúdo) até o dashboard Pit Wall, incluindo a aba Estratégia e os Vetores de campanha. Sabe exatamente onde cada coisa mora e como editar para que apareça no app. Acione SEMPRE que o usuário quiser criar, alterar, produzir, taguear ou organizar um card de conteúdo no Calendário; quando perguntar por que algo não aparece no Pit Wall, como atualizar o Escopo, o que sincronizar ou como alimentar a Pitwall; quando mexer nos Vetores ou na aba Estratégia; ou quando quiser auditar a base de conteúdo (frente faltando, Data ausente, Tipo errado, status). Use mesmo sem a palavra "card" ou "Notion", sempre que o assunto for o conteúdo que vai parar no Pit Wall ou a estrutura que liga Notion e dashboard.
---

# Pit Wall · Conteúdo

Esta skill é o operador técnico do pipeline de conteúdo da Pitstop Imports. Ela sabe onde cada coisa mora na estrutura que liga o Notion ao dashboard Pit Wall, edita os cards e os Vetores no lugar certo com a tag certa, e audita a base para achar buracos. Não é estratégia de marca nem planejamento de calendário (isso é da skill `socialmedia`), nem banca de ideias ou planilha (isso é da `operacao-pitstop`). Aqui o foco é a mecânica: o que alimentar, onde, e como, para o conteúdo aparecer no app.

## A verdade central (decore isto)

O conteúdo vive em dois andares que hoje não se cruzam sozinhos:

1. **Andar Sync (Notion → app):** o Calendário de Conteúdo no Notion é a base mãe. O botão sincronizar roda `syncNotion`, que puxa os cards e grava na aba `Conteudo` da planilha; `getConteudo` serve isso para as abas Conteúdo e Hoje, e (depois do rewire `focusDoDia`) para o Escopo.
2. **Andar Molde (Config → Escopo):** as linhas Story/Feed/Com e as tarefas fixas do Escopo nascem de `defaultFocus()` e `defaultRoutine()` no Index.html, salvas na aba `Config`. É molde congelado, não lê o Notion.

Antes de qualquer ação, leia `references/mapa-pipeline.md`. É o mapa completo dos dois andares, do fluxo e da tabela "quero mudar isso, mexo aqui".

## Quando usar e quando não

Use quando o pedido for sobre o conteúdo que chega no Pit Wall ou a estrutura: criar/editar/taguear card, "por que não aparece no app", "como atualizar o Escopo", sincronizar, mexer em Vetores/Estratégia, auditar a base.

Não use para: definir tese de campanha, roteiro de Reel, legenda criativa (isso é `socialmedia` e `reels-virais`); decisão de negócio, preço, margem, planilha (isso é `operacao-pitstop`). Se o pedido misturar estratégia e mecânica, faça a parte mecânica aqui e diga que a estratégia é das outras skills.

## Os três poderes

### 1. Saber (orientar)
Responda de onde sai cada coisa usando `references/mapa-pipeline.md`. Nunca adivinhe a estrutura: o mapa tem o fluxo, as funções e o que cada aba lê. Diagnóstico comum: "não aparece no app" quase sempre é card sem `Data`, fora da janela de sincronização, ou `Tipo` errado. Veja a seção de regras.

### 2. Editar (alimentar a base)
Para criar ou alterar um card, ou mexer nos Vetores, siga `references/alimentar-card.md` e `references/vetores-estrategia.md`. Pontos que não podem falhar:
- Preencher só as propriedades que o sync lê. O resto é invisível para o app.
- `Data` é obrigatória, senão o card nem entra no sync.
- `Tipo`, `Status`, `Semana` são select: grafia exata.
- Editar pela conexão do Notion (data source do Calendário). Deletar não funciona pela API: para sumir um card, marque `Status` igual a `Descartado`.

### 3. Auditar (checar a base)
Rode a checagem de `references/auditoria.md`. Ela verifica, por semana, se as frentes fixas existem como card (Reel segunda, Reel sexta, Carrossel quarta, 7 Stories, Oferta na quinta), se o `Tipo` está limpo, se a `Data` está presente e na janela, e se os Vetores estão atualizados para a aba Estratégia ler. Auditoria que nunca reprova é teatro: ela tem que apontar os buracos com a semana e o dia exatos.

## Regras invioláveis

- **Janela de sincronização:** `syncNotion` só puxa cards com `Data` entre hoje menos 7 e hoje mais 28 dias. Semana muito à frente só aparece quando a data chega perto. Não é bug.
- **Full replace:** cada sincronização limpa a aba `Conteudo` e regrava. Nada é incremental.
- **Select com grafia exata:** `Tipo` (Reels, Story, Carrossel), `Status` (A produzir, Em produção, Pronto, Publicado, Descartado). Diferença de acento ou maiúscula cria opção nova e quebra a leitura. Setar um valor que não existe cria a opção automaticamente, sem derrubar as outras (seguro).
- **Comunidade não existe no Notion:** enquete, quiz e caixinha. O slot Com do Escopo é sempre molde.
- **Salvar não publica:** mudança no Index.html só vai pro ar com Implantar, Nova versão. Função de servidor roda no editor sem publicar.
- **Não use travessão** no texto. Preserve exatos os valores reais (nomes de aba, status, função, IDs).

## Arquivos desta skill

- `references/mapa-pipeline.md` — a estrutura completa dos dois andares, o fluxo, a tabela de onde mexer e o inventário de funções. Ler sempre primeiro.
- `references/alimentar-card.md` — como criar/editar um card: propriedades exatas que o sync lê, slot por dia da semana, IDs do Notion e a receita de escrita.
- `references/vetores-estrategia.md` — a aba Vetores (esquema e como preencher) e o contrato de `getEstrategia` que alimenta a aba Estratégia.
- `references/auditoria.md` — a checagem da base, por semana e por dia.
