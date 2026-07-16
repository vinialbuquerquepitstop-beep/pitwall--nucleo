# Auditoria da base de conteudo

Checagem da base, por semana e por dia. Auditoria que nunca reprova e teatro: esta tem
que apontar os buracos com a semana e o dia exatos. Rodar quando o pedido for auditar a
base ou depois de alimentar cards.

## O que checar (por semana)

### 1. Frentes fixas existem como card
Para cada semana na janela (hoje menos 7 a hoje mais 28), conferir se existem os cards:
- Reel na segunda
- Carrossel na quarta
- Reel na sexta
- Oferta na quinta
- 7 Stories (um por dia)

Comunidade (enquete/quiz/caixinha) NAO conta como card do Notion: e molde do Escopo,
nao entra nesta checagem.

Saida esperada: lista do que falta, com semana e dia. Ex "Semana X: falta Reel de sexta;
faltam 2 Stories (quinta, sabado)".

### 2. Tipo limpo
Todo card com `Tipo` preenchido e com grafia exata (`Reels`, `Story`, `Carrossel`).
Apontar cards com Tipo vazio ou com opcao criada por engano (acento/maiuscula errados).

### 3. Data presente e na janela
Card sem `Data` nem entra no sync: apontar. Card com Data fora da janela nao aparece
ainda: nao e erro, mas registrar se o operador esperava ver.

### 4. Status coerente
`Status` dentro do conjunto valido (`A produzir`, `Em produção`, `Pronto`, `Publicado`,
`Descartado`). Apontar Status fora do conjunto ou card publicado com data futura.

### 5. Vetores atualizados
Conferir se os Vetores da aba estao atualizados para a aba Estrategia ler: campanha
vencida ainda ativa, ou campanha nova sem Vetor. Ver `vetores-estrategia.md`.

## Formato do relatorio de auditoria

Nao devolver "esta tudo ok" sem ter olhado card a card. Devolver:
- Buracos por semana e dia (o que falta).
- Cards com Tipo/Status/Data problematicos (qual card, qual campo).
- Vetores desatualizados (qual vetor).
- Se nao houver buraco, dizer explicitamente o que foi verificado (janela coberta,
  numero de cards, frentes conferidas), para a aprovacao ter peso.

## Lembrete

Diagnostico mais comum de "nao aparece no app": card sem `Data`, fora da janela de
sincronizacao, ou `Tipo` errado. Comecar por ai.
