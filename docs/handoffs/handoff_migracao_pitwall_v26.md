# Handoff Migracao Pit Wall (Nucleo) v26

Substitui a v25. Data: 16/07/2026.

---

## 1. A v25 estava desatualizada. Comeca por aqui.

A v25 dizia "build NAO EMPURRADO" e listava Deploy como pendencia 1. **Estava errado.**
Verificado nesta sessao:

| v25 dizia | Real |
|---|---|
| Build nao empurrado | **Empurrado.** `585c481` e ancestral de `origin/main`; os 3 arquivos em `public/` batem byte a byte (MD5) com o build do scratchpad. |
| Pendencia 1: Deploy | **Feita.** O Worker vivo serve o redesign. |
| Pendencia 6: `public/index` sem extensao | **Corrigida** por `585c481`. |
| Pendencia 2: emoji, gated em "depois do deploy" | Gate caiu. **Feita nesta sessao.** |
| Pendencia 7: Fase 4, gated em "escrita estavel primeiro" | Gate caiu. **Feita nesta sessao** (falta empurrar). |

**Licao para o proximo handoff: escrever o estado do git DEPOIS de empurrar, nunca antes.**
Um handoff que mente sobre o deploy custa uma sessao inteira de reinvestigacao.

---

## 2. O que esta sessao fez

### Frente A: banco (fechada)
`dicionario_rotulos` limpo: emoji fora dos 27 rotulos, acento em `Indicação`,
`Loja física`, `Prospecção ativa`. Fecha a pendencia 2 da v25.

**Prova de que era seguro, feita ANTES de rodar:** todas as CHECK constraints de `lead`
validam **codigo**, com array chumbado, e nenhuma referencia `dicionario_rotulos`.
`lead.status` guarda `pendente` / `lista_fria`, nunca o rotulo. Logo `rotulo` e display
puro. `codigo` nao mudou. `length` de cada linha confere que nao sobrou emoji nem
seletor de variacao invisivel.

`CLAUDE.md` atualizado no mesmo movimento: ele ainda mandava preservar `🟡 Pendente` e
`❄️ Lista fria` como valores exatos. Se ficasse, a proxima sessao reintroduziria emoji
achando que estava obedecendo.

### Frente B: front, Fase 4 (construida, NAO empurrada)
Branch `fase4-historico`, commit `e95c98e`. So `app.css` e `app.js`; **`index.html` nao
mudou uma linha**, porque o card e gerado pelo JS.

O backend ja existia e ninguem chamava: `historico_lead()` e `registrar_nota()` estao la
desde a Fase 3, security invoker, EXECUTE para `authenticated`. **Zero SQL nesta obra.**

Painel `[data-hist]`, irmao de `[data-scripts]`, mesmo mecanismo. **Fechado por padrao,
por pedido explicito do dono: sem clique nao aparece, e sem clique o banco nem e
consultado.**

---

## 3. Decisoes fechadas nesta sessao

| Decisao | Resultado |
|---|---|
| Dashboard | **Segurado.** 15 leads, 11 dias de historia, 3 convertidos. Taxa em n=15 e teatro: 3/15=20% vira 25% com uma venda. Moldura vazia continua sendo a resposta honesta. Entra quando houver volume. |
| Front constroi | Fase 4, nao dashboard. Valor imediato e independente de amostra. |
| Historico mora | Painel expansivel no card. Historico e por lead, entao vive junto do lead. |
| Ponto da timeline | Codifica QUEM agiu: cheio azul = operador, vazado = regua. Invariante 1 na tela. |
| Regra de data futura | Mora em `registrar_nota()`, num lugar so. O JS so exibe a `msg` do banco. |
| Copia de trabalho | Clonada em `nucleo/`. O repo nao versiona `docs/`, entao nao houve colisao. |

---

## 4. Achados tecnicos

- **`autor` e NULL nos eventos de cadencia**, porque quem agiu foi a regua, nao uma
  pessoa. A tela mostra "Régua". Isso veio do dado real; no chute eu teria posto um vazio.
- **Newest-first e estavel so ate o minuto.** Os dois eventos de cadencia do LEAD-0005
  caem em `11/07 15:12`; `historico_lead()` ordena por `criado_em` e o desempate entre
  eles e arbitrario. Irrelevante no volume de hoje. **Nao resolvido, nao escondido.**
- **Existe runtime JS nesta maquina: o Chrome.** acorn/jsdom nao rodam (sem node), mas
  Chrome headless (`--headless=new --virtual-time-budget --dump-dom`) roda o `app.js` real
  E aplica o CSS, o que jsdom nem faria. Substituto melhor que o previsto.
- **O `app.js` ja tinha ganchos de teste** de sessoes anteriores: `window.__PITWALL_SEM_INIT`
  e `PitWall._setLeads`. Reusados; nao precisou inventar.
- **Falso alarme investigado:** o `�` antes do rotulo de condicao no `card-prod` **nao e
  defeito**. Os bytes sao `c2 b7` = U+00B7, o ponto do meio que o CLAUDE.md manda usar.
  Era o terminal renderizando. Zero U+FFFD no arquivo.
- **Ponto cego da suite:** o check de classes so ve `class="literal"`. Classe montada por
  concatenacao (`ator-*`) escapa da regex. Coberto na mao na secao [8]; nao confiar no
  numero de "classes emitidas" como se fosse completo.
- **`core.autocrlf=true` nesta maquina.** A copia de trabalho tem CRLF; o blob do git e o
  que o Worker serve tem LF. Conferir deploy comparando md5 do vivo com a **copia de
  trabalho** da "DIFERE" sempre, mesmo com deploy perfeito. Comparar com
  `git show HEAD:public/app.js`. Perdi tempo cacando esse bug fantasma; o README ja
  registra a receita certa.
- **`/index.html` devolve 307 para `/`.** Para conferir o HTML, baixar a raiz.

---

## 5. Ferramentas (resgatadas do scratchpad, que e temporario)

Viviam so num scratchpad de sessao antiga e teriam sumido. Agora em `ferramentas/`:

| Arquivo | O que e |
|---|---|
| `validar.py` | Suite. **Baseline repontada:** ate a v25 comparava repo (velho) x `build/` (novo); agora compara `app.js.antes` (snapshot) x repo (editado no lugar). Rodar da raiz. |
| `harness.py` | Execucao real em Chrome headless. 31 assercoes. |
| `dados_teste.json` | Linha real do banco (16/07). Nao inventar linha aqui. |
| `mock_historico.py` | Gera o mock da Fase 4 com o `app.css` REAL. |
| `patch_historico.py` | O patch aplicado, com ancoras que falham alto. |
| `fontes.css` | Instrument Sans + Geist Mono em base64. Exemplar unico. |
| `app.js.antes` | Baseline pre-Fase 4. |

---

## 6. Validacao feita

- `esprima`: parseia; statements de topo 1 -> 1 (patch cirurgico).
- Contrato de IDs e classes intacto; `sugerir_mensagem`, trava LGPD e 3 variantes intactas.
- **Harness Chrome, 31/31:** painel nasce vazio e escondido; sem clique `historico_lead`
  NAO e chamada; o clique dispara UMA chamada; newest-first; ano encurtado na tela; ponto
  da regua renderiza `rgb(255,255,255)` vazado x operador `rgb(0,37,204)`; form fechado ate
  o `+ Nota`; nota vazia nao vai ao banco; segundo clique fecha e limpa.
- **`registrar_nota()` provada contra o banco REAL, em transacao revertida** (`raise` no
  fim do bloco `do $$`): 1 nota = **exatamente 1** evento append-only (3 -> 4, delta 1);
  data futura e texto vazio recusados **sem escrever nada**. Rollback conferido depois:
  volta a 3 eventos, zero sujeira.

---

## 7. Pendencias

| # | Item | Nota |
|---|---|---|
| ~~1~~ | ~~Empurrar a Fase 4~~ | **FEITO.** `68aed49..e95c98e` em `main`, autorizado pelo dono. Deploy conferido contra o blob: `app.js` e `app.css` vivos batem com `git show HEAD:...`; a raiz serve o `index.html` do blob. **A Fase 4 esta no ar.** |
| 2 | Dashboard: conteudo | Segurado ate ter volume. Exige definir metrica ANTES de desenhar view. |
| 3 | `pb-pe` dinamico | Estatico hoje. Entra junto com o 2. |
| 4 | Desempate de eventos no mesmo minuto | Ver secao 4. So vale mexer se incomodar de verdade. |
| 5 | Leaked Password Protection | BLOQUEADA: exige plano Pro. |
| 6 | `Desktop/pitwall deploy/` | **Monolito morto de 09/07, sem git, anterior ao redesign.** Nao e copia de trabalho. Candidato a apagar, para ninguem editar um cadaver. |

---

## 8. Invariantes reforcados

- Handoff so declara deploy DEPOIS que o push aconteceu.
- Antes de mudar dado, provar quem consome. Aqui: ler as CHECK constraints provou em
  minutos que rotulo era display puro.
- Antes de dimensionar obra, checar o que o banco JA oferece. A Fase 4 parecia backend +
  frontend; era so frontend, porque as funcoes existiam ha duas fases.
- O dado real ensina o que o chute erra (`autor` NULL viran do "Régua"; dois eventos no
  mesmo minuto). Mock e teste se alimentam do banco, nunca de cabeca.
- Regra de negocio mora num lugar so. A recusa de data futura ficou em `registrar_nota()`;
  a suite trava contra duplicar ela no JS.
- Teste que so le sintaxe nao prova comportamento. Chrome headless roda de verdade; a
  transacao revertida prova o banco sem sujar dado do cliente.
