# Handoff Financeiro v18 — a auditoria voltou depois de sete versoes, e o portao que a cobrava reprovou por conta propria

Data: 04/09/2026. Linha: financeiro. Substitui o `handoff_financeiro_pitwall_v17.md`
como topo da linha.

Sessao de **auditoria e plano**, nao de produto. Nenhuma linha de `public/` mudou,
nenhuma migration foi aplicada, nenhum numero da tela mudou de valor.

---

## 1. A frase da entrega

**A suite diz quando ela mesma nao terminou, em vez de parecer regressao.**

---

## 2. O que aconteceu, em ordem

1. `P-AUDITA` completo, em sessao que nao tinha construido nada. O primeiro desde o v10:
   fatia 3, fatia 4 e as tres entregas de 03/09 nunca tinham sido auditadas por ninguem
   alem de quem as construiu.
2. A auditoria reprovou o fechamento do bloco 2 do `PLANO.md` e devolveu **nove defeitos
   visiveis**, tres deles novos.
3. Plano de solucao integral escrito e commitado (`e4e6ff5`): nove entregas mais a
   revisao final.
4. O dono respondeu as duas decisoes que travavam o inicio: **D-s = A** e **D-t = A**.
5. `P-ABRE` da E1 **reprovou**: `harness.py` saiu 1. Pelo CONTRATO 6.1, a entrega da vez
   virou fechar esse item, e a E1 nao comecou.
6. E0 construida e provada: e o conteudo desta sessao.

---

## 3. O que a auditoria mediu

Todo numero abaixo saiu de consulta rodada ou de arquivo aberto, nunca de memoria.

### Passou limpo

| Item | Medicao |
|---|---|
| git x banco | **30 = 30** migrations desde 26/08, casadas por md5 do corpo. Comparando o arquivo inteiro 27 divergem, mas so pelo cabecalho `-- migration aplicada:` que ganharam ao serem versionadas depois de aplicadas |
| RLS | dono le tudo; vendedor `130353b1…`: **0 linhas** nas 5 tabelas e `Financeiro e restrito ao dono.`; uid desconhecido: **0 linhas** e `Sessao invalida.` |
| Inv. 9 | `authenticated` tem **zero** DELETE, TRUNCATE, REFERENCES e TRIGGER nas 5 tabelas |
| Inv. 10 | **zero** funcoes `fin_*` / `fn_fin*` com `current_date` |
| `security definer` | **uma so**, `privado.fn_fin_importacao_fechar` |
| F3 | por mes: fev a jun e ago **100%**, jul **98,54%** |
| C5 | zero token de cor novo. O unico `--dim:` no diff esta dentro de um comentario |
| Rastro | **nada sem rastro**: toda escrita com `usuario_id` nulo mapeia numa migration versionada; toda mudanca de dado de 03/09 veio pela RPC da tela, 0 de 100 sem usuario |

### Reprovou

**Inferencia de `dominio` numa regra.** A regra `Compra no débito` (`comeca`, `dominio
pessoal`, `categoria NULL`, prioridade 9000) alcanca **175 contrapartes distintas** e
deixa **214 linhas** com lado definido e sem categoria. O v17 a tratou como fabrica de
CATEGORIA e baixou a prioridade; **o lado do `dominio` nunca foi questionado**.
Prioridade 9000 nao remove um default: faz dele o ultimo a falar, que e a definicao de
default. Viola o Inv. 18 e o F2. Criada em 02/09 23:16:53 pela sessao, com a credencial
do dono, nao digitada por ele.

**Campo orfao.** `ini_anterior` e `fim_anterior` saem do `fin_painel` e tem **0
ocorrencias** em `public/app.js`. Divida desde a fatia 1 (26/08), carregada por 9
migrations. Consequencia visivel: todo `delta_pct` da tela compara contra uma janela que
a tela nunca declara.

### O portao 6.3, julgado condicao por condicao

Medido pela `fin_painel` de producao, dono autenticado: fev **1.999,09** · mar
**1.864,20** · mai **1.235,02**, contra 3.872,09 · 3.864,20 · 5.635,02 registrados
antes. Delta **−8.273,00**, que e exatamente o liquido das 8 linhas da Thay que a
`auditoria` mostra indo de `empresa` para `pessoal` em 03/09 22:56:46.

| # | Condicao da excecao 6.3.1 | Cumpre? |
|---|---|---|
| 1 | mudou linha de config, nao funcao nem formula | **NAO.** Mudou `fin_movimento` |
| 2 | o valor antigo era demonstravelmente ERRADO | **NAO.** A `auditoria` mostra as mesmas 8 linhas indo de `null` -> `empresa` em 02/09 e de `empresa` -> `pessoal` em 03/09, **as duas por decisao do dono**. `empresa` era defensavel. Aqui divirjo da nota gravada no `plano_categorias_20260903.md`, que marcou esta condicao como cumprida |
| 3 | o caixa nao se moveu | **NAO.** Tres saldos, −R$ 8.273,00 |
| 4 | numeros antes e depois no handoff, medidos pela RPC | **PARCIAL.** Os "antes" so aparecem no plano, escritos em 04/09, depois do fato |

Tres das quatro falham e as quatro sao cumulativas. **O 6.3 vale inteiro.**

### Inventario do CONTRATO, desatualizado em quatro linhas

| Secao 1 diz | Hoje |
|---|---|
| 11 RPCs publicas | **14** (+`fin_cobertura`, `fin_repasse_marcar`, `fin_repasse_desmarcar`) |
| 33 categorias ativas | **34** |
| 223 assercoes do Financeiro | **301** (87 `fin:` + 56 `fin2:` + 80 `fin3:` + 40 `fin4:` + 38 `fin5:`) |
| 5 helpers privadas | **8** (+`fn_fin_cobertura`, `fn_fin_contraparte`, `fn_fin_cp_norm`) |

O `CLAUDE.md` diz 1037/1042 e a suite mede **1087/1092**. Nao corrigi nenhum dos dois:
e trabalho da revisao final, com os numeros ja medidos aqui.

---

## 4. A E0, que e o produto desta sessao

### Por que ela existiu

O `P-ABRE` da E1 saiu 1. Medido depois: **8 corridas do `harness.py` no dia, 1
vermelha**, e as 7 verdes com 1087/1087 e contagem cheia. Nada no repo mudou entre elas.

O mecanismo estava no proprio codigo, em `harness.py:7570-7591`: se o Chrome devolvia um
DOM sem `<pre id="RESULTADO">`, o Python imprimia uma frase e saia **1, sem uma unica
linha `FALHOU`**. O estouro do teto de 300s era pior: subia como traceback e tambem
terminava em 1.

**O `CLAUDE.md` manda conferir o EXIT CODE e nunca o texto da saida. Com regressao e
corrida abortada saindo o mesmo 1, o exit code era exatamente o que nao separava as
duas.** O historico do arquivo registra a mesma classe duas vezes antes: 08/08 (o
orcamento de tempo virtual em 25000) e 01/09 (assercao que media antes da leitura
terminar, caindo em 1 de cada 3 corridas).

### O que mudou

| Arquivo | O que |
|---|---|
| `ferramentas/suite_veredito.py` | **novo.** `veredito_corrida(dom, estourou_tempo)` e os tres codigos. Funcao pura, fora do harness porque o harness roda tudo no nivel do modulo e importa-lo executaria a suite inteira |
| `ferramentas/harness.py` | usa a funcao, **repete a corrida uma vez** antes de desistir e diz que repetiu, captura `TimeoutExpired`, e sai **2** em todo caminho inconclusivo, incluindo `sem Chrome/Edge` |
| `ferramentas/prova_suite.py` | **novo.** 17 assercoes `suite:`, sem Chrome, em milissegundos |

Codigos de saida, que agora sao contrato com quem le o portao:

```
0  tudo verde
1  REGRESSAO: assercao vermelha, ou rotulo declarado que nao executou
2  INCONCLUSIVO: a suite nao chegou ao fim; nada foi medido
```

Repetir a corrida nao mascara defeito: corrida que nao chega ao fim nao mediu nada, e
assercao vermelha continua vermelha na segunda. O que a repeticao remove e o vermelho
FALSO.

### O que foi PROVADO, com EXIT code

| Prova | EXIT |
|---|---|
| `python ferramentas/validar.py` | **0** |
| `python ferramentas/harness.py` | **0**, 1087 passou / 0 falhou / 1092 declaradas / 1087 executadas |
| `python ferramentas/prova_trilho.py` | **0** |
| `python ferramentas/prova_grafico.py` | **0** |
| `python ferramentas/prova_atmosfera.py` | **0** |
| `python ferramentas/prova_suite.py` | **0**, 17 passou / 0 falhou |
| `node --check public/app.js` | **0** |
| `diag_mobile.py` 360 / 390 / 414 / 1280 / 1440 | **0** nas cinco |
| `diag_largo.py` 1500 / 1920 / 2560 | **0** nas tres |

**Prova de ponta a ponta do caminho novo**, com Chrome de verdade: uma copia do harness
com `--dump-dom` trocado por `--version` (o Chrome responde, mas nao devolve DOM)
imprimiu `A SUITE NAO TERMINOU` nas duas tentativas e saiu **EXIT 2**. A copia foi
apagada; `git status` limpo.

Portao de confianca (6.3): **nenhum numero da tela mudou de valor.** Zero mudanca em
`public/`.

### O que NAO foi provado

- O caminho `sem Chrome/Edge` foi provado por leitura de codigo (`prova_suite.py` afere
  que `sys.exit(INCONCLUSIVO)` esta la), **nao** desinstalando o Chrome.
- A taxa real da corrida falsa continua desconhecida: 1 em 8 e o que se observou num
  dia, nao uma medicao de frequencia.
- `harness.py` emite dois `SyntaxWarning` de escape em string (linhas 208 e 1602),
  **anteriores a esta sessao** e nao tocados aqui.

---

## 5. Pendencias

### Decisoes do dono, ainda abertas

| | O que | Tamanho |
|---|---|---|
| **D-u** | `MF COMPANY LTDA` R$ 6.100,00, 17/04: empresa ou pessoal | 1 linha. **Se pessoal, abril vai de +1.238,68 para −4.861,32**, o unico mes negativo |
| **D-v** | `BRUNO DA COSTA AZEVEDO` R$ 270,00 em 2 entradas | 2 linhas |
| **D-w** | Rodrigo Alves R$ 630,00: forcar o par ou deixar | trava a E8 |

Nenhuma das tres trava a E1.

### Defeitos visiveis abertos: 9

Lista completa em `docs/financeiro/plano_solucao_integral_20260904.md` secao 0. Ela e o
portao do bloco 3 do `PLANO.md`, que exige **DEFEITOS VISIVEIS = 0**.

Um decimo, achado nesta sessao e **fechado por ela**: a suite tinha um modo de falha
indistinguivel de regressao.

### Registro que ficou de fora, de proposito

`prova_suite.py` **nao** foi acrescentada a lista de comandos do `CLAUDE.md` nem ao
`P-ABRE` do `PROMPTS.md`. Os dois sao arquivos de raio grande e mudam em duas fases, e a
revisao final do plano ja carrega esse trabalho junto com o inventario. **Enquanto isso
nao acontecer, a prova nova existe e ninguem a roda pelo prompt.** Fica anotado aqui
para nao virar esquecimento silencioso.

---

## 6. Primeiro movimento do proximo chat

**`P-ABRE` · E1 · `P-FECHA`.**

E1: *a tela diz por que fevereiro, marco e maio encolheram.* Detalhe em
`docs/financeiro/plano_solucao_integral_20260904.md` secao 3.

Ela constroi o mecanismo de nota de mudanca de numero que a **E2** vai reusar, e a E2 e
a unica da lista que fecha uma **fabrica ativa**: enquanto ela nao subir, todo extrato
importado carimba `dominio` sozinho em contraparte que o dono nunca julgou.

---

## 7. Invariantes reforcados

- **Inv. 18 e F2** sao o assunto do maior defeito aberto. Regra que grava `dominio` por
  padrao generico e default silencioso, e prioridade alta nao a redime.
- **CONTRATO 6.1** funcionou: o portao reprovou, a entrega da vez virou fechar o portao,
  e a E1 nao comecou. Custou uma sessao curta e comprou um portao que volta a significar
  uma coisa so.
- **Excecao 6.3.1**: mantida como esta. Ela pegou quem a escreveu, no mesmo dia. Isso e
  argumento para nao afrouxa-la.
- **Auditoria em sessao separada** (CONTRATO 7) deixou de rodar por sete versoes e o
  custo apareceu de uma vez: tres defeitos novos, um deles uma fabrica ativa.
