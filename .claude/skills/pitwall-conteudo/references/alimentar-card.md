# Alimentar um card

Como criar ou editar um card do Calendario para ele aparecer certo no Pit Wall. Preencher
so o que o sync le; o resto e invisivel para o app.

DB do Calendario (Notion): `ab0fc93f-d964-4f32-8c81-4be5343687b3`.

## Propriedades que o sync le (as unicas que importam)

- `Data` (obrigatoria). Sem ela o card nem entra no sync. Tem que cair na janela de hoje
  menos 7 a hoje mais 28 dias para aparecer.
- `Tipo` (select, grafia exata): `Reels`, `Story`, `Carrossel`.
- `Status` (select, grafia exata): `A produzir`, `Em produção`, `Pronto`, `Publicado`,
  `Descartado`.
- `Semana` (select): grafia exata conforme as opcoes ja existentes na base.
- Titulo / conteudo do card: o texto que vai ser exibido. `[a confirmar]` o nome exato
  da propriedade de titulo e das demais que o `syncNotion` copia.

Qualquer propriedade fora dessa lista e ignorada pelo app.

## Slot por dia da semana (frentes fixas)

- Segunda: Reel
- Quarta: Carrossel
- Sexta: Reel
- Quinta: Oferta
- Stories: 7 na semana (um por dia)
- Comunidade (enquete, quiz, caixinha): NAO existe no Notion. O slot Com do Escopo e
  sempre molde, vem de `defaultRoutine`.

## Receita de escrita (pela conexao do Notion)

1. Editar sempre pela conexao/data source do Calendario, nao por copia solta.
2. `Data` primeiro. Sem Data, nao adianta o resto.
3. `Tipo`, `Status`, `Semana` com a grafia EXATA das opcoes existentes. Setar um valor
   que nao existe cria uma opcao nova (polui o select e some da leitura esperada).
4. Salvar. Depois disso, o card so aparece no app apos rodar `syncNotion` (botao
   sincronizar). O sync nao e automatico.

## Fazer um card sumir

Deletar pela API nao funciona. Para tirar um card do app, setar `Status` = `Descartado`.
Ele sai da leitura util na proxima sincronizacao (full replace).

## Depois de alimentar

Rodar a checagem de `auditoria.md`: as frentes fixas da semana existem como card? `Tipo`
limpo? `Data` presente e na janela? Se faltar frente, apontar a semana e o dia exatos.
