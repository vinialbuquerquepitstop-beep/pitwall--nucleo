# Vetores e aba Estrategia

A aba Estrategia do Pit Wall e alimentada pelos Vetores de campanha, servidos por
`getEstrategia`. Diferente do Calendario (que vem do Notion), os Vetores vivem na
planilha de conteudo. Este arquivo cobre onde ficam e como preencher para a leitura nao
quebrar.

## Onde mora

- Aba `Vetores` na planilha de conteudo (`1fWhQ78vq1ScvYehvW6jvauS5WNY5kXtuPVhf09Ue7ek`).
- Servida pela funcao `getEstrategia`, que le os Vetores e monta o que a aba Estrategia
  do app exibe.

## Esquema dos Vetores

Cada Vetor e uma linha da aba. O contrato exato de colunas que `getEstrategia` espera:
`[a confirmar]` lendo o cabecalho real da aba Vetores e o corpo de `getEstrategia` antes
de escrever. Nao adivinhar nomes de coluna: um cabecalho errado quebra a leitura em
silencio.

Estrutura tipica de um Vetor de campanha (confirmar contra a aba):
- Nome do vetor / tema da campanha.
- Descricao ou tese.
- Periodo ou status (ativo / inativo).
- Ordem de exibicao.

## Como preencher sem quebrar

1. Respeitar o cabecalho exato da aba. `getEstrategia` le por posicao/nome de coluna; um
   header renomeado ou deslocado derruba a leitura.
2. Preencher as linhas de Vetor na aba `Vetores`, nao em outra aba.
3. A aba Estrategia do app so reflete a mudanca quando `getEstrategia` roda (verificar se
   e no carregamento da aba ou se depende de sync). `[a confirmar]` o gatilho exato.

## Contrato de getEstrategia

`getEstrategia` e a ponte Vetores -> Estrategia. Antes de qualquer edicao que dependa
dela, abrir o corpo da funcao no Apps Script e confirmar:
- Quais colunas da aba Vetores ela le.
- Como ela ordena e filtra (ativo x inativo).
- O formato que ela devolve para o front.

Sem essa conferencia, editar Vetores e apostar. Com ela, e mecanica segura.

## Auditar

Na checagem semanal (`auditoria.md`), verificar se os Vetores estao atualizados para a
aba Estrategia ler. Vetor de campanha vencida ainda ativo, ou campanha nova sem Vetor,
sao os buracos mais comuns.
