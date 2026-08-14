# Handoff Migracao Pit Wall (Nucleo) v59

Substitui a v58. Data: 14/08/2026.

---

## 1. Headline: as tres pendencias herdadas fecharam, e a que mais assustava era a menor

Nao houve construcao de tela nesta fatia. Fecharam as tres pendencias que
vinham sendo empurradas desde o v56, cada uma MEDIDA antes de qualquer mudanca.
A terceira reserva a licao da sessao.

---

## 2. Pendencia 1: a referencia orfa

`prova_atmosfera.py` nascia dizendo "Secao 5 do plano". **Aquele plano nunca
existiu em disco**: ele so vivia no contexto da sessao que escreveu o arquivo, e
quem fosse procurar nao acharia nada.

Trocado por ponteiros para o que existe de verdade: `handoff_migracao_pitwall_v56.md`
secao 2 (a atmosfera, e a justificativa que apontava para o elemento errado) e
`docs/superpowers/plans/2026-08-14-molde-fatia2.md` secao 4 (o terceiro chao).
A correcao ficou NOMEADA no proprio comentario, em vez de a linha sumir em
silencio.

Referencia que aponta para lugar nenhum e pior do que referencia nenhuma: ela
promete um documento e faz o leitor duvidar do resto do arquivo.

---

## 3. Pendencia 2: o CSS morto, apagado com prova reforcada ANTES

`.cont-card::before` tinha seis regras de nivel (`quente`, `morno`, `frio`,
`ok`, `nulo`, mais o `--frio` de base). O v56 as nomeou como mortas e nao
apagou, com a razao certa: apagar CSS sem saber quem mais casa com `.cont-card`
fora da aba e como se cria regressao.

Medido agora: **um unico lugar emite `.cont-card`** (`app.js:137`), e ele
SEMPRE define `style="--tp:..."`. Entao o bloco "a barra diz o TIPO", que vem
depois no arquivo, ganha sempre, e as seis regras eram inalcancaveis.

A ordem importou. A prova foi reforcada **antes** da delecao, para ela ficar
protegida em vez de acomodada: o harness media a barra do PRIMEIRO cartao e
passou a medir a de TODOS, com a mensagem listando as cores distintas. Depois,
a delecao foi comparada contra o `HEAD` em copia temporaria:

```
ANTES   n=7 cores=rgb(168, 73, 126) rgb(47, 125, 168) rgb(91, 75, 168)
DEPOIS  n=7 cores=rgb(168, 73, 126) rgb(47, 125, 168) rgb(91, 75, 168)
```

Identico. Sairam junto as tres linhas de override por nivel do bloco do tipo:
sem as regras que elas anulavam, nao anulavam nada. Sobra **uma** regra pintando
a barra do cartao do kanban.

---

## 4. Pendencia 3: a previsao que seis sessoes repetiram sem medir

`.gitattributes` foi adiado seis vezes, sempre com a mesma justificativa
escrita: `* text=auto eol=lf` renormalizaria o repo inteiro e produziria um
"diff gigante", entao merecia fatia propria.

Medido, contando BYTES no index, arquivo por arquivo, com os `.gpg` de fora:

```
arquivos de texto com CRLF no index: 1
  public/calc/index.html   1443
```

**O repo ja estava em LF.** O `core.autocrlf=true` desta maquina vinha
normalizando tudo desde sempre. Um unico arquivo escapou, gravado em 03/08 a
partir de OUTRA maquina (`4320aa1`, autor `Claude`), e ficou divergente do resto.

O "diff gigante" era um arquivo e 1443 linhas. A previsao nunca tinha sido
medida: foi escrita uma vez e copiada de handoff em handoff por seis sessoes,
adiando uma tarefa de dez minutos.

O valor real da regra tambem mudou de nome: nao e limpar bagunca, e o fim de
linha deixar de ser propriedade da MAQUINA e virar propriedade do REPOSITORIO.
Num repo onde o `app.js` tem o nucleo numa linha so, um arquivo reescrito
inteiro por diferenca de config nao e inconveniencia, e a perda da unica forma
de enxergar o que mudou.

`*.gpg` marcado como `binary`: sao os dumps do Postgres com PII, e um `\r`
injetado corromperia o arquivo sem ninguem notar ate a hora de restaurar.

Depois: **zero arquivo de texto com CRLF no index**, arvore limpa.

---

## 5. E a medicao minha que estava errada no meio do caminho

A primeira contagem desta sessao usou
`git show HEAD:arquivo | grep -c $'\r'` e devolveu **2243** para o `app.js` e
**2728** para o `harness.py`. Eu quase escrevi esses numeros num commit como
fato, e o texto ja estava redigido.

A contagem de bytes (`conteudo.count(b'\r\n')`) devolve **0** nos dois. A
primeira medida usava a ferramenta errada para a pergunta, e errava na direcao
que confirmava a expectativa que eu ja tinha.

O commit foi reescrito antes de subir. Nao e o mesmo defeito do v57 (numero
certo, limiar errado) nem do v58 (propriedade em vez de resultado): aqui foi
**instrumento errado, resultado convincente**.

---

## 6. Provas, todas com EXIT CODE conferido

| prova | resultado |
|---|---|
| `harness.py` | **459 passou / 0 falhou** — EXIT 0 |
| `validar.py` | EXIT 0 |
| `prova_atmosfera.py` | EXIT 0 |
| `prova_trilho.py` | EXIT 0 |
| `prova_grafico.py` | EXIT 0 |
| `node --check public/app.js` | EXIT 0 |
| `diag_mobile.py` 360/390/414/1280/1440 | EXIT 0 nos cinco |

Rodadas DEPOIS da renormalizacao, nao antes. Banco nao foi tocado nesta fatia.

---

## 7. Onde encostou

| arquivo | o que |
|---|---|
| `public/app.css` | seis regras mortas em `.cont-card::before` e as tres de override apagadas; comentarios reescritos com a razao |
| `ferramentas/harness.py` | a assercao da barra passou a medir TODOS os cartoes e a listar as cores |
| `ferramentas/prova_atmosfera.py` | referencia orfa trocada por ponteiros reais, com a correcao nomeada |
| `.gitattributes` | **novo**: `* text=auto eol=lf` + `*.gpg binary` |
| `public/calc/index.html` | renormalizado (so fim de linha, zero mudanca de conteudo) |
| banco | **nao encostou** |

Tres commits separados de proposito: as duas pendencias de codigo, a regra do
git sozinha, e a renormalizacao sozinha.

---

## 8. Pendencias

1. **As tres herdadas do v56 estao FECHADAS.** A spec do molde (13/08) esta
   inteira executada, Fatias 0 a 3.
2. Herdado do v55 e aberto: a cor nao separa `pendente` de `abandono` no
   grafico do Escopo; `diag_mobile.py` roda uma largura por vez e nao esta na
   suite padrao; os sete cortes numericos dos Insights seguem cravados no JS
   contra o invariante 11; as duas regras de canal do card de Insights seguem
   sem prova; drill-down dos KPIs fora; 2 de 3 vendas reais sem origem; `k()`
   chama `renderVendas` a cada tecla; **Hoje continua sem a forma nova**.
3. Escrita de volta no Notion segue bloqueada pela capability "Update content".
4. Se o dono quiser o teto de humor COBRADO em vez de exibido, o caminho e o
   Calendario do Notion ganhar campo proprio (um tipo `humor`, ou uma marca) e a
   ponte da RPC passar a conhece-lo. Contar pelo titulo seria chute com decimal.
5. **Sugestao para a proxima sessao**: varrer as pendencias do item 2 do mesmo
   jeito que esta fatia varreu as tres de agora, MEDINDO antes de acreditar. A
   do `.gitattributes` custou seis adiamentos por causa de uma frase que ninguem
   conferiu, e pelo menos uma das que sobraram tem cara de ser o mesmo caso.

---

## 9. Licao desta sessao

Tres handoffs seguidos fecharam com uma variacao de "o numero estava certo e
apontava para o lugar errado". Esta fecha com a versao anterior a essa:
**um numero que nunca foi tirado.**

A previsao do diff gigante nao era mentira nem erro de calculo. Era um palpite
razoavel, escrito uma vez, que virou fato por repeticao: seis handoffs o
copiaram, e cada copia o deixou mais solido, sem que ninguem rodasse a contagem
que levava trinta segundos. O custo nao foi um bug, foi seis adiamentos de uma
tarefa de dez minutos.

E a coda, que e o mesmo defeito em escala menor: quando eu FINALMENTE fui medir,
peguei a ferramenta errada e obtive 2243 e 2728, numeros que confirmavam
exatamente o que o handoff dizia. Medicao que concorda com a expectativa merece
a mesma desconfianca que a que discorda, e talvez mais.
