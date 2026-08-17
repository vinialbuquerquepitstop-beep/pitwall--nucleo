# Aprendizados (memoria evolutiva da skill)

Ler primeiro, em toda sessao. Entrada nova sempre datada, com o que foi MEDIDO. Nao
reescrever entrada antiga: se algo virou mentira, marcar como corrigido e explicar por que.

---

## 17/08/2026 (carga) — Sete armadilhas de parser, e o remote trocou de nome

Rodada de 20 listas / 16 fornecedores, todas do proprio dia 17/08. Banco: **494
produtos, 1.029 precos**, soma 3.948.560,95 (era 501 / 1.043). Consultor: 137
produtos, 413 precos, validade 24/08/2026. Diff contra a carga de 15/08: 11
subiram, 22 cairam, 804 iguais, 163 novos, 206 sairam de linha, e **zero
variacao acima de 15%**.

**O `origin` VOLTOU A SER o remote bom, e o `github` nao existe mais.** Medido em
17/08/2026: `git remote -v` mostra so `origin`, apontando para
`https://github.com/vinialbuquerquepitstop-beep/pitwall--nucleo.git`, e o push
sai por `git push origin HEAD:main`. A skill mandava usar `github` desde 15/08.
Licao que ja aparece pela segunda vez com sinal trocado: **medir o remote na
hora, nunca confiar no que este arquivo diz.**

**Ordem do bloco decide o significado de preco solto.** O erro mais caro da
sessao, pego por conferencia manual e nao por trava: o Davi/Fabio lista **um
preco por unidade** (`AZUL / 2.699 / 2.679 / 2.679`), enquanto a MP lista
**preco e depois as cores** (`R$4.699,99 / azul / branco`). Tratando os dois
igual, o ultimo preco do Azul virava o preco do Verde. Regra implantada: o
PRIMEIRO evento do bloco decide. Comecou com cor -> preco solto e outra unidade
da MESMA cor, fica o menor. Comecou com preco -> o preco vale para as cores que
vierem depois. Sem isso, 15 128GB do Davi saia com Azul 2.699 e Verde 2.679,
os dois errados, cada um para um lado.

**Seis leituras que viravam preco falso, todas achadas por spot-check:**
1. `Poco F8 Ultra 512GB` casava com **Apple Watch Ultra 3** (R$4.550 de Android
   virava relogio). `ultra` sozinho nao basta: exigir `ultra 3`.
2. `anc` sem fronteira de palavra casa dentro de "c**anc**elamento": o AirPods 4
   SEM cancelamento virava o COM cancelamento, e um dos dois sumia.
3. `ª` NAO e acento combinante, entao `sem_acento()` nao transformava `1ª linha`
   em `1a linha`: o fone paralelo de R$69,99 entrava como **AirPods Pro de
   verdade**, e o Cabo Apple herdava os R$69,99 do fone.
4. `caixa branco` das linhas de CPO virava **cor Branco fantasma** em todo
   produto CPO do Cristiano. Remover `caixa \w+` antes de procurar cor.
5. O Cristiano escreve `s11 46` **sem "mm"**: sem isso os relogios dele todos
   colavam no bloco do Ultra 3.
6. A linha comecada por `*` escapava do detector de produto (o teste rodava no
   texto cru, nao no `limpa()`): `*💻MACBOOK AIR M5 512GB*` nao era produto e os
   R$7.899,99 dele caiam no MacBook Neo de cima.

**Casar fornecedor pelo CORPO da mensagem e perigoso.** `lacrados` aparece no
corpo de quase toda lista: a Five Cell inteira virou Junior. Casar so pelo
CABECALHO (primeira linha), e deixar o corpo como excecao nomeada para a unica
lista que abre com URL (a segunda da Quality).

**Produto fora do catalogo tem que FECHAR o bloco.** Nao basta ignorar a linha:
sem o flush, `pack com 1 AirTag` (R$200) e o `poco x8 pro` (R$2.297) jogavam
preco e cor dentro do AirTag Pack 4, que ficou a R$200 em tres cores.

**Decisoes do dono nesta data:** numero malformado se **corrige por coerencia**
(`4,850,00`->4.850,00 · `4.3999,99`->4.399,99 · `7.200,00,00`->7.200,00 ·
`1.1550`->1.550), com tabela explicita token->valor, nunca por regra generica;
**preco com condicao pendurada fica de fora** (caixa aberta, lacre rompido,
unidade aberta para midia, `c/caixa`); **Poco e Xiaomi ficam fora** do catalogo;
entram `iPhone 13 mini 512GB` e `iPhone 16 Pro Max 1TB`; e o `MACBOOK AIR M5
512GB` da MP **entra sem a RAM no nome**, contra a minha recomendacao de deixar
fora (custo zero na pratica: a 7.899,99 ele nunca e o menor, o Real Comercio
esta 7.844,99).

**"Sem selo" nao quer dizer aparelho sem selo.** Eu marquei o iPhone 11 64GB do
Joao Telles a R$750 como suspeito porque a lista dele abre com `SEM SELO / SEM
GARANTIA`. O dono explicou: e instrucao para **nao retirar** o selo que vem no
aparelho, senao a garantia cai. O preco e legitimo e e o menor do 11 64GB.

**A validade nao venceu desta vez.** Estava em 22/08, com 5 dias de folga: a
primeira rodada em que a primeira medicao do arranque nao achou a calc do
consultor travada. Repor cedo funciona.

---

## 15/08/2026 (carga) — O clone atrasado quase custou 25 commits

Rodada de 17 fornecedores (2 novos), **1.043 precos** no blob (era 841), 501 produtos
(era 411). Cobertura: as 501 linhas de produto entraram, com 12 descartes por regra e 7
decisoes levadas ao dono. Zero variacao acima de 15%; o maior movimento real foi +11,3%
(Quality, 14 Pro Max 128GB Roxo seminovo, 3.099 -> 3.450).

**O erro mais caro que quase aconteceu nao foi de preco, foi de git.** O clone local
estava **25 commits atras** do GitHub, e eu commitei em cima de `266f614`, base de tres
dias antes. Um `git push --force` teria apagado o painel de Performance de Vendas, a
Fatia 2 do Escopo, o molde de conteudo e o bloco de Pos-Venda. Pior: um dos 25 commits
(`e95edf4`) renormalizou `public/calc/index.html` de CRLF para LF, 1.443 linhas, junto
com um `.gitattributes` novo, entao um rebase conflitaria no arquivo inteiro.

O que funcionou: branch de seguranca, `git reset --hard github/main`, **reaplicar as
quatro edicoes** sobre o arquivo em LF e regerar o `dados.js`. Resultado identico (134
produtos, 405 precos) e diff final de 3 arquivos e 92 linhas, em vez da reescrita
gigante. Regra: `git fetch github main && git rev-list --left-right --count
github/main...HEAD` ANTES de commitar, nao depois.

**O push sai daqui, pelo remote `github`.** A skill afirmava desde 27/07 que `git push`
sempre falhava e que o dono precisava do prefixo `!`. Isso era verdade so para o
`origin` (proxy morto em `127.0.0.1:41729`). O remote `github` aponta para a URL real e
faz fetch E push normalmente. Corrigido em `mapa-calculadoras.md`.

**Postgres dobra `1/0` em tempo de planejamento.** Montei a trava da gravacao como
`case when contagem_ok then true else (select 1/0)::boolean end`. Estourou `division by
zero` ANTES de olhar o dado, entao a trava reprovava uma carga correta. Guard-rail se
escreve em bloco `DO ... raise exception`, depois do insert, dentro da transacao: e o
mesmo padrao ja usado para provar RPC sem sujar producao.

**Payload grande vai para staging ANTES de transformar.** Quando a trava furada
derrubou a transacao, o payload de 35 KB foi junto e teria que ser reenviado inteiro a
cada tentativa. Passei a gravar em `privado.carga_DDMM` primeiro; dai a transformacao
vira retentavel de graca. Procedimento em `mapa-calculadoras.md`.

**Provar dado que atravessa por CHECKSUM dos dois lados.** Contagem, soma e casos
invalidos calculados no Node e no Postgres: 501 produtos, 1.043 precos, soma
4.176.656,24, iguais. O mesmo para a derivacao do consultor, comparada contra o BANCO e
nao contra o meu proprio calculo: 405 precos, soma pv 1.819.793,99 e pp 1.860.293,99.
Sem isso, "transcrevi certo" e afirmacao, nao prova.

**Categoria nova sem margem exige CODIGO, nao so dado.** O dono mandou passar a incluir
Garmin, moto eletrica e fone paralelo, "sobre valores de lucro, nenhum. apenas o custo".
So carregar no banco nao bastava: `mg()` mandava toda categoria != MacBook para o
`else` e devolvia a margem de iPhone, entao a moto apareceria com preco de venda.
Detalhe completo em `formato-dados.md`.

**`/calc/index.html` mente.** O worker roda com fallback de SPA: essa URL devolve outra
pagina sem erro, e me fez achar por um minuto que o deploy nao tinha subido. Provar em
`/calc/`.

**A regex da prova nao casava por causa de CRLF.** `/function mg\(c\)\{.*?\}\n/` falhava
porque o arquivo tinha `\r\n`. Custou uma rodada. Hoje o `.gitattributes` fixou LF no
repositorio, mas a licao vale: em prova que le arquivo por regex, usar `\r?\n`.

**Duas listas iguais no mesmo minuto: usar a segunda.** Real Comércio mandou duas
versoes com precos diferentes (iPad 2.629,45 contra 2.619,45; Watch 1.780 contra 1.778)
e a FMATA repetiu a dela com o 17 Pro 256 Laranja indo de 6.550 para 6.650. Regra
adotada e aprovada: a ultima mensagem vence, e item que so existe na primeira entra
tambem, declarado no diff.

**A validade venceu de novo, e de novo ninguem viu.** Estava em 10/08, vencida havia 5
dias, com as quatro funcoes de copiar pedido travadas: o consultor nao cotava desde
11/08. E a segunda vez (a primeira foi em 27/07, nove dias). Isso nao e descuido de uma
sessao, e um prazo que expira sozinho sem nada avisar. **Enquanto nao existir alerta, a
primeira coisa a medir em toda sessao e a validade.**

---

## 03/08/2026 (carga) — Cinco armadilhas de leitura, todas com preco em cima

Rodada de 17 listas, 12 fornecedores, **841 precos** no blob (era 615). Cobertura 730 de
732 linhas de produto. As cinco abaixo foram medidas nesta sessao; as duas primeiras
foram pegas pela trava de 15%, as tres ultimas so apareceram porque eu fui conferir de
onde vinha cada numero estranho.

1. **`GRADE A` no cabecalho de secao e USADO, nao lacrado.** A M Apple abre com
   `⬇️ IPHONES 🇺🇸 GRADE A 🇺🇸` e so depois vem `⬇️ LACRADOS`. Lido como Lacrado, um
   15 Pro Max usado a 3.900 virava o lacrado mais barato e cortava **25% do preco de
   venda de um aparelho lacrado**. Regra em `formato-dados.md`, item 3.
2. **`pack com 1` nao e `Pack 4`.** O Cristiano lista `pack com 4 AirTag` esgotado (❌) e
   logo abaixo `pack com 1 AirTag R$200`. O 200 colou no Pack 4 e derrubou o custo de
   599,99 para 200 (-67%).
3. **SINGULAR e condicao do produto, PLURAL e cabecalho de secao.** `🔒 Lacrado` (BR10)
   pertence ao bloco corrente; `⬇️ LACRADOS` (M Apple) abre secao nova e reseta. Tratar
   os dois igual quebra um dos dois: ou o BR10 perde o CPO, ou a secao lacrada da M Apple
   inteira vira usada.
4. **Linha de compatibilidade nao e produto.** `📱 iPad 10, 11` logo abaixo de
   `🖊️ caneta Apple Pencil USB-C` diz com quais iPads a caneta funciona. Tratada como
   produto, matava o bloco e os R$750 da caneta sumiam. Criterio que separa os dois:
   **sem preco, sem cor e sem token de tamanho (GB/TB/mm) e nota**; com qualquer um dos
   tres e produto e RESETA o bloco. Sem o reset, os R$4.500 do `⌚️ Ultra 3 – 49mm` do
   BR10 foram parar no S11 46mm.
5. **Preco sem cor nenhuma precisa entrar com `v` direto.** Bloco que termina com preco
   pendente e zero cor estava sendo descartado calado. Custava o `MacBook M4 16/256GB` da
   Five Cell a 6.800, o `Mac Mini M4` a 4.950 e o `iPad Air M4` do Rafael a 5.300.

**O ganho de corrigir 3, 4 e 5 foi grande: 656 linhas -> 730.** As 74 recuperadas incluem
a secao de lacrados inteira da MP Imports (59 precos), que estava evaporando.

Outras leituras que este export exigiu e que agora estao no catalogo: preco tambem vem
sem ponto de milhar quando ancorado em `R$`/`$` (Cristiano escreve `R$2900`); cor por
EMOJI quando o fornecedor nao escreve o nome (M Apple: `⬛️`=Preto, `🟦`=Azul, `🟪`=Roxo,
seguindo o precedente da carga de 27/07); `1 terá` e autocorrecao de `1 tera` = 1TB;
`iPad 11` nao pode casar com o regex de iPhone (`\b11\b`), senao vira `iPhone 11 128GB`.

**Decisoes do dono nesta data**, todas registradas em `formato-dados.md`:
`iPhone Air` sem numero e o **17 Air**; `Series` sempre remete a **Watch** (Series 2 e 3
sao os SE 2 e SE 3, confirmado pelo preco); Mac **entra sem polegada**, com a polegada
omitida do nome; iMac fica de fora; **cores de mesmo sentido se unificam** (38 nomes ->
29, pela forma dominante).

**Historico de preco NAO EXISTE.** Medido em 03/08/2026: `calc_dados` e a unica tabela do
dominio, uma linha por tenant, e toda carga SOBRESCREVE. Nao ha tabela de historico nem
coluna de versao. Consequencia que ninguem tinha notado: o scanner da `/calc/` tem o modo
`hist`, que le o campo `op` do produto, e **zero de 341 produtos tinha `op`** — o modo
existe na tela e nunca teve dado. O blob de 27/07 so sobrevive nos dumps `.gpg` de
`backups/`, que nao sao consultaveis pela calc.

---

## 03/08/2026 — CPO existia nas listas e a carga anterior jogou fora

O dono pediu que aparelho CPO fosse exibido. Medido no banco: 341 produtos, `Lacrado`
161 e `Seminovo` 180, **zero CPO**, enquanto as listas do Cristiano, da MP Imports e do
M Apple traziam CPO em fartura. A carga de 27/07 dobrou CPO dentro de Lacrado porque a
linha do fornecedor traz as duas palavras juntas (`lacrado importado cpo caixa branca`)
e o casamento de `lacrado` vinha primeiro. Regra de ordem agora escrita em
`formato-dados.md`, item 3 da normalizacao. **Zero CPO num diff futuro e sintoma de erro
de ordem, nao de ausencia nas listas.**

**O gancho ja existia no codigo e ninguem tinha alimentado.** `public/calc/index.html`,
linhas 569 e 726, ja faziam `.replace(/\s+CPO/i,'')` para achar o modelo base no motor
de sugestao. Alguem projetou CPO como sufixo do nome e nunca chegou dado. O dono
escolheu em 03/08 o outro caminho: **terceira condicao (`t`), com chip proprio**, nao
sufixo no nome.

**Decisoes do dono, 03/08/2026:** CPO paga **comissao de lacrado**, e vira **terceiro
chip de Tipo**.

**O que quase passou calado.** O `/calc/consultor/` era binario em cinco pontos, sempre
`tp==='Lacrado' ? isso : aquilo`. Uma condicao nova cai no `else` sem erro nenhum:
comissao pela tabela de **seminovo** (dinheiro errado no bolso do consultor) e garantia
de **3 meses** dita ao cliente num aparelho com **1 ano da Apple**. Nenhum dos dois
aparece como falha na tela, os dois so funcionam. Correcao aplicada: os testes foram
invertidos para `tp==='Seminovo' ? seminovo : lacrado`, ou seja, **lacrado virou o
padrao**, e condicao nova nunca mais cai calada na tabela mais barata.

**Prova nova:** `node ferramentas/prova_cpo.js`, 39 assercoes, exit 0. Le as funcoes do
arquivo real em vez de copiar a logica.

**Erro meu na prova, corrigido na mesma rodada:** escrevi a assercao "Seminovo tem que
pagar diferente de Lacrado" e ela reprovou. Nao era bug do codigo, era premissa falsa:
no nivel **Embaixador** iPhone lacrado e seminovo pagam **100 os dois** no `config`
(nos outros niveis o seminovo paga menos: 145/180, 175/220, 200/250). Licao: assercao
que compara dois valores de config prova o config, nao o codigo. A versao boa cobra o
valor exato lido da tabela `seminovo`. Se o 100 igual no Embaixador for descuido da
escada de comissao, segue aberto para o dono decidir.

**Armadilha de ambiente que custou duas rodadas:** o dono apontou tres vezes o mesmo
`Downloads/WhatsApp Chat - FORNECEDORES PITS.zip` acreditando ter exportado de novo.
Era byte a byte identico (`md5 29e86fe57bcb4e2d8813513befbaf574`), com `_chat.txt`
carimbado 22/07 e 22 mensagens todas de `[21/07/26`. O Windows nao sobrescreve download
de nome repetido, salva como `... (1).zip`, e varredura em Downloads, Desktop, Documentos
e OneDrive nao achou variante nenhuma: o export novo nunca chegou no PC. **Conferir
SEMPRE a data da ultima mensagem do `_chat.txt` e o md5 do zip antes de parsear.** Custa
dois comandos e evita carregar preco velho por cima de preco novo. Neste caso teria
revertido a queda medida na Revel entre 21/07 e 27/07 (17 Pro Max 512GB de 8.349,99 de
volta para 8.599,99).

---

## 27/07/2026 (carga) — Duas armadilhas de parse que viraram preco falso

Ambas foram pegas pela trava de variacao acima de 15%, antes de gravar. Sem ela, teriam
entrado em silencio. **A trava nao e burocracia: e o unico ponto onde erro de leitura
aparece.**

1. **Numero dentro de URL vira preco.** O link `chat.whatsapp.com/FJVlVp2TEI3434LI9aYqpL`
   entregou `3434` para o bloco aberto acima dele: iPhone 17 Pro Max 512GB registrado a
   R$ 3.434, queda falsa de 60% sobre 8.600. Regra: **linha com `http`, `wa.me` ou `.com`
   nao tem preco.** Idem para telefone no padrao `(21) 9xxxx-xxxx`.

2. **Modelo + capacidade colados viram preco.** `🍎13 256 eSIM lacrado` (iPhone 13, 256GB)
   virou **R$ 13.256** nas listas do Cristiano e da Quality, porque o regex aceitava espaco
   como separador de milhar. Regra: **separador de milhar so por PONTO** (`3.250,00`),
   nunca por espaco. Sintoma: preco de iPhone acima de 9 mil quando o teto real do
   catalogo e ~10.300 no 17 Pro Max 1TB.

Verificacao barata que pega os dois: conferir a **faixa de preco** do que foi parseado.
Se o minimo cair abaixo de ~900 ou o maximo passar de ~10.500 em iPhone, tem erro de
leitura, nao promocao.

---

## 27/07/2026 (tarde) — Primeiro export real: e WhatsApp, nao Telegram

O dono mandou `Downloads/27_7 WhatsApp Chat - FORNECEDORES PITS.zip`. Conteudo:
`_chat.txt`, 348 KB, export do **WhatsApp** (iOS), nao do Telegram. Extrair sempre para o
scratchpad, **nunca para dentro do repo**: e custo de fornecedor.

Formato de linha: `[dd/mm/aa, hh:mm:ss] Remetente: texto`, ano com DOIS digitos, remetente
com marcas invisiveis (U+202A/U+202C) que precisam ser removidas antes de agrupar.
Mensagem multilinha continua nas linhas seguintes ate o proximo cabecalho.

**ERRO QUE EU COMETI, corrigido no mesmo dia: agrupei por remetente e concluí "um
fornecedor so".** Falso. O chat e um AGREGADOR de listas encaminhadas: o remetente do
WhatsApp e quase sempre o mesmo numero, e quem identifica o fornecedor e o **cabecalho**
da mensagem. Medido depois da correcao: **104 listas** no periodo, **13 no dia 27/07**,
de pelo menos 13 fornecedores distintos. Licao: neste export, agrupar por remetente e
uma leitura sem sentido. Sempre agrupar pelo cabecalho, e conferir o link de grupo no
rodape para juntar listas partidas em duas mensagens.

Layout tipico (exemplo da Raposa): secoes `*LACRADO*` e `*SEMINOVOS*`, uma linha por
modelo no padrao
`📲 MODELO CAPACIDADE 🎨 COR - 🔋XX% 💰 R$X.XXX,00`, varias cores por preco, as vezes
varias unidades da mesma cor com baterias diferentes e preco unico.

**Cobertura medida** com parser rustico de teste, sem calibrar: lista de 27/07 casou 27
itens com 2 pendencias (93%); 21/07, 76%; 16/07, 72%; listas de junho, 0% (layout
antigo, diferente). Media bruta das 8 listas: 46%. Ou seja: **o formato recente casa bem,
o formato antigo nao casa nada.** Nao vale gastar parser com historico velho.

**Duas decisoes do dono, mesma data:**

- **Bateria por unidade: adiar.** "Vale adicionar depois a opcao de colocar tambem as
  baterias, nao agora." Entao a carga de hoje ignora o `🔋XX%` e o array `bateria` do
  blob segue vazio. Quando entrar, e feature de tela e de modelo de dados (preco por
  faixa de bateria), nao ajuste de parser.
- **Aparelho com "mensagem": nao entra.** "Nao adicione modelos com mensagem." Aparelho
  com peca trocada que faz o iOS avisar nao e revendido. Vira descarte, nao pendencia, e
  o descarte acontece ANTES do calculo do menor custo, senao o item barato que a loja nao
  vende puxa o preco de venda para baixo. Regra completa em `formato-dados.md`, item 5 da
  normalizacao.

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
