# Aprendizados (memoria evolutiva da skill)

Ler primeiro, em toda sessao. Entrada nova sempre datada, com o que foi MEDIDO. Nao
reescrever entrada antiga: se algo virou mentira, marcar como corrigido e explicar por que.

---

## 27/07/2026 (tarde) — Primeiro export real: e WhatsApp, nao Telegram

O dono mandou `Downloads/27_7 WhatsApp Chat - FORNECEDORES PITS.zip`. Conteudo:
`_chat.txt`, 348 KB, export do **WhatsApp** (iOS), nao do Telegram. Extrair sempre para o
scratchpad, **nunca para dentro do repo**: e custo de fornecedor.

Formato de linha: `[dd/mm/aa, hh:mm:ss] Remetente: texto`, ano com DOIS digitos, remetente
com marcas invisiveis (U+202A/U+202C) que precisam ser removidas antes de agrupar.
Mensagem multilinha continua nas linhas seguintes ate o proximo cabecalho.

**O chat tem UM fornecedor, nao onze.** 157 mensagens de 03/06 a 27/07, tres remetentes:
o fornecedor (137 msgs, 258 KB), a propria Pitstop (19) e o aviso do sistema. O
fornecedor se identifica como "ATACADO E REVENDA DA RAPOSA", retirada em Niteroi.
Amarrar ao catalogo de 11 fornecedores antes de gravar qualquer coisa.

Layout da lista dele: secoes `*LACRADO*` e `*SEMINOVOS*`, uma linha por modelo no padrao
`📲 MODELO CAPACIDADE 🎨 COR - 🔋XX% 💰 R$X.XXX,00`, varias cores por preco, as vezes
varias unidades da mesma cor com baterias diferentes e preco unico.

**Cobertura medida** com parser rustico de teste, sem calibrar: lista de 27/07 casou 27
itens com 2 pendencias (93%); 21/07, 76%; 16/07, 72%; listas de junho, 0% (layout
antigo, diferente). Media bruta das 8 listas: 46%. Ou seja: **o formato recente casa bem,
o formato antigo nao casa nada.** Nao vale gastar parser com historico velho.

Tres coisas que o modelo de dados nao absorve e viram decisao, nunca chute:
1. **Bateria por unidade** (`🔋88%`). A calc guarda preco por cor, nao por unidade; o
   array `bateria` do blob esta vazio. Seminovo de 84% e de 100% viram a mesma linha.
2. **Observacao que muda o produto** ("C/ tela nova e mensagem", "PERFEITO", "com caixa").
   Muda o preco e nao tem onde morar. Pendencia por definicao.
3. **Modelo fora do catalogo** (ex.: iPhone 11 Pro Max 512GB apareceu e nao existe no
   banco). Nao e falha de parse: e item novo, decisao do dono.

## 27/07/2026 — Nascimento da skill

Contexto: o dono pediu o passo a passo de atualizacao das calculadoras e, ao ver o
estado, mandou criar esta skill. Ele quer o fluxo mais curto possivel: colar o export do
chat com as listas e nao fazer mais nada ate aprovar e empurrar.

**A validade venceu e ninguem viu.** `config.validade` estava em 18/07/2026, nove dias
atras. Com a data vencida, a calc do consultor acende os banners vermelhos e **bloqueia
as quatro funcoes de copiar pedido**. O Brendon nao estava cotando desde o dia 18 e isso
so apareceu porque alguem foi ler o arquivo. Licao: **validade e um prazo que expira
sozinho, e nada no sistema avisa.** Toda rodada repoe. Se a rodada demorar, a calc do
consultor morre em silencio.

**Os precos estavam certos, so a data estava velha.** Conferidas as 103 combinacoes do
`dados.js` contra o custo do banco: 103 de 103 batendo com custo minimo mais margem.
Por isso a correcao foi so a data, provada byte a byte (arquivo identico apos normalizar
a data). Licao: **medir antes de "corrigir"**. O impulso era regerar tudo.

**A derivacao e determinista.** `pv` = menor custo daquela cor + `iav` (ou `mav`),
`pp` = mesmo custo + `ipc` (ou `mpc`). Isso significa que digitar o `dados.js` a mao e
trabalho que a maquina faz, e cada digitacao e uma chance de divergencia. Volume real
medido: 11 fornecedores, 340 linhas, 690 precos.

**O `dados.js` do consultor e publico.** `curl` sem sessao nenhuma baixou o arquivo
inteiro do worker. O login do `/calc/consultor/` e guarda de tela; arquivo estatico nao
passa por RLS. Vaza preco de venda e a escada de comissao completa. Nao e o custo de
fornecedor (protegido desde a v39), mas e o mesmo furo. Decisao pendente.

**Netlify aposentada.** Decisao do dono nesta data: nao usa mais. Nao alimentar. Fica a
acao de despublicar o site, porque o `dados.js` de la tem CUSTO DE FORNECEDOR aberto e
parar de usar nao apaga a pagina.

**Sobre automatizar via Telegram.** O dono perguntou se da para gerar o `dados.js` a
partir do export do chat sem consumir token. A resposta dada, e que segue valendo: sao
dois problemas de dificuldade muito diferente. A derivacao consultor <- banco e
determinista e barata; a leitura das listas dos fornecedores e parsing de texto humano,
com manutencao eterna (todo setembro sai modelo novo e o dicionario quebra). Recomendado
separar: automatizar a derivacao primeiro, e para a leitura preferir uma tela de colar
com revisao imediata em vez de batch cego. Decisao do dono: skill agora, automacao
depois.

**Ambiente.** `origin` do clone local aponta para proxy morto: `git push` daqui falha
sempre, o dono empurra com `!`. O clone tambem recebe commits sozinho pelo OneDrive:
conferir `git log -1` na hora de commitar, nao so no arranque.
