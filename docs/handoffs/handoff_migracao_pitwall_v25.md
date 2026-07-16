# Handoff Migracao Pit Wall (Nucleo) v25

Substitui a v24. Data: 16/07/2026.

---

## 1. O que esta sessao fez

Frente nova: **redesign estetico**, escolhido pelo dono no lugar de Fase 4 e Fase 5.

O dono reprovou a estetica atual por inteiro e pediu: sofisticado, clean, predominantemente
branco, secoes na vertical a esquerda para desktop, detalhes azuis, com dashboards.

Tres rodadas de mockup ate aprovar:
- **v1** IBM Plex Sans + Mono. Reprovada: "letras mais sofisticadas".
- **v2** Instrument Serif (display) + Instrument Sans + Geist Mono. Serif reprovado.
- **v3 APROVADA.** Instrument Sans (palavra) + Geist Mono (dado), sem serif.

**Referencia de record: `docs/design/referencia-visual-v3.html`.** Ler antes de escrever CSS.

---

## 2. Decisoes fechadas nesta sessao

| Decisao | Resultado |
|---|---|
| Tese visual | "Timing screen, nao cockpit". Branco, tipografia neutra, numero alinhado, cor SO onde carrega estado. |
| Tipografia | `Instrument Sans` 400/500/600 + `Geist Mono` 400/500. Sem serif (mundo Apple nao tem serif). Sem Inter (default de IA). |
| `--morno` | `#f2a71b` -> `#C48808`. Decisao consciente do dono: o hex antigo marca 2.04 em branco e reprova. O invariante "semantico, nunca unificar com a marca" segue intacto. CLAUDE.md ja atualizado. |
| Emoji nos rotulos | Saem, viram ponto colorido + palavra. |
| Acento na UI | Corrigir (`Condição`, `Não`, `Observação`, `Núcleo`). |
| Dashboard | Moldura vazia de proposito. Sem metrica definida, sem view. Numero inventado em mockup vira expectativa que o banco nao paga. |

---

## 3. Achados tecnicos que valem mais que o design

- **Cores antigas reprovam todas em branco:** morno 2.04, frio 2.17, ok 2.11, erro 2.79
  (minimo legivel 4.5). Foram calibradas para o escuro, onde marcam 8.4 a 9.0.
- **`--quente` (#ff5d45) e `--erro` (#ff6b5e) tem contraste 1.09 ENTRE SI:** sao a mesma
  cor. Lead quente (oportunidade) e falha de sistema pintam igual ha meses. Defeito real.
- **Emoji nao esta so no banco.** O `app.js` tem um mapa chumbado com os mesmos emoji
  (semente) e a funcao `d()` sobrescreve com o que vem de `dicionario_rotulos`. O banco
  ganha em runtime; se a leitura falhar, o emoji volta pela semente. **Mexer nos dois.**
  O `UPDATE` so pode entrar DEPOIS do deploy do front, nunca antes, senao o app fica sem
  pista visual de status nenhuma.
- **A barra lateral e quase de graca no JS.** O `app.js` so pega a moldura da pagina por
  `getElementById`; as unicas buscas estruturais (`closest(".card")`, `[data-scripts]`,
  `.retomar`, `.var-chip`) sao dentro do card, que o proprio JS gera. Barra lateral =
  os MESMOS `abaFila`/`abaTodos`/`abaIndicacoes` num layout diferente.
- **O app tem 3 abas, nao 4:** `Fila do dia`, `Todos`, `Indicacoes`. Nao existe aba
  `Pos-venda`: a skill descreve como planejado e isso foi confundido com construido.
- **`public/index` esta commitado sem extensao `.html`.** O Worker serve certo (200,
  text/html), mas o repo diverge do handoff e do comentario do `wrangler.jsonc`. Risco
  baixo, nao corrigido.
- **Nao existe node nesta maquina.** acorn e jsdom, que o CLAUDE.md exige, NAO RODAM.
  Substituto usado: `esprima` (pip, parser ES2017 puro Python) + contrato de IDs.

---

## 4. Estado do build (NAO EMPURRADO)

Em `scratchpad/build/`: `app.css` (reescrito), `index` (reorganizado), `app.js` (6 patches).
Validado: esprima parseia, 55 IDs que o JS busca existem no HTML, 34 classes emitidas tem
regra no CSS, `sugerir_mensagem` / trava LGPD / 3 variantes intactas.

Primeira versao do build foi **reprovada pelo dono na revisao visual**: entregou o
denominador comum do HTML antigo em vez de construir ate o mockup. **Gap fechado depois**,
com a aba Dashboard aprovada pelo dono ("pode construir a aba dash e posteriormente
completo").

**Gap fechado (build -> referencia v3):**

| Item | Como |
|---|---|
| Icone SVG em cada aba | HTML. O JS so mexe em `aria-selected`, nunca no innerHTML da aba. |
| Rotulos de grupo `Operação` / `Análise` | HTML. Escondidos no celular (`.nav-rot{display:none}`): rotulo de grupo nao faz sentido numa barra de 4 icones. |
| Avatar "V" + "Vini" / "Dono" | HTML. `.side-pe-txt` some no celular. |
| Icone em `Atualizar` / `Novo lead` / `Sair` | HTML. |
| Contador na aba Fila | JS: `E("badgeFila")` escrito na MESMA linha do `pbFila`, reusando `o.length`. Nunca uma segunda contagem. Escreve `""` quando zera, e `.nav-badge:empty{display:none}` esconde. |
| Terceira linha do pitboard (`pb-pe`) | HTML estatico ("vencendo hoje", "passaram da data", "leads pendentes", "no total"). A referencia tinha "2 passaram de 7 dias", que e dinamico: **ficou de fora de proposito**, entra quando o dono completar. |
| Data no cabecalho | JS: `topoSub` via `toLocaleDateString("pt-BR")`. E chrome de cabecalho, nao data de negocio: o invariante 10 (nada de `CURRENT_DATE` onde se produz data de negocio) nao e violado. |
| Icone do WhatsApp no `.btn-wa` | JS: o botao e gerado dentro do card. |
| **Aba `Dashboard`** | **CONSTRUIDA.** 4a aba: `Y("abaDash","click",...)`, `aria-selected`, titulo, e render de moldura vazia ("As métricas ainda não foram definidas") + 3 slots `a definir`. Sem numero inventado. |

Validacao do build final: esprima parseia, **58 IDs** que o JS busca existem no HTML,
nenhum ID perdido, **38 classes** emitidas tem regra no CSS, `sugerir_mensagem` / trava
LGPD / 3 variantes intactas, `#f2a71b` proibido como valor. A suite tambem trava a
fidelidade a referencia (aba Dashboard, >=7 icones, contador, avatar, rotulos de grupo,
`pb-pe` x4, `topoSub`), para o erro da rodada anterior nao voltar em silencio.

---

## 5. Pendencias

| # | Item | Nota |
|---|---|---|
| 1 | **Deploy** | Push = deploy, sem staging. Combinar horario: tela quebrada nao pode pegar o dono no meio de atendimento. Os 3 arquivos vao JUNTOS: CSS sozinho quebra o app. |
| 2 | `UPDATE dicionario_rotulos` (tirar emoji, por acento em origem) | **Depois do deploy do front, nunca antes.** A semente do `app.js` ja esta sem emoji; falta o banco concordar. |
| 3 | Dashboard: conteudo | O dono disse que completa depois. Hoje e moldura honesta. Exige definir metrica ANTES de desenhar view. |
| 4 | `pb-pe` dinamico ("2 passaram de 7 dias") | Hoje estatico. Entra junto com o item 3. |
| 5 | Leaked Password Protection | BLOQUEADA: exige plano Pro. Reavaliar na fase SaaS. |
| 6 | `public/index` sem extensao | Risco baixo. |
| 7 | Fase 4 (aba historico) | Camada de escrita estavel primeiro. |

---

## 6. Primeiro movimento do proximo chat
1. Ler este handoff, verificar o banco via MCP.
2. **Abrir `docs/design/referencia-visual-v3.html` antes de tocar em CSS.**
3. Fechar o gap da secao 4, comecando pelo que e HTML puro.
4. Nao empurrar sem combinar horario com o dono.

---

## 7. Invariantes reforcados
- Construir ATE a referencia visual, nao ate o denominador comum do que ja existe.
  Entregar versao pobre da referencia e o erro desta sessao.
- Cor semantica se MEDE (4.5:1 texto, 3:1 faixa), nao se escolhe no olho. Contraste WCAG
  mede luminancia, nao matiz: para "da pra diferenciar um do outro" usar CIEDE2000 e
  simular daltonismo.
- Antes de propor mudanca de dado, provar quem consome aquele dado. "Emoji e so um UPDATE"
  estava errado porque existia uma semente chumbada no JS.
- Antes de dimensionar obra de frontend, checar se o JS depende da ESTRUTURA do DOM ou so
  de `getElementById`. Isso mudou a estimativa da barra lateral de "reescrever navegacao"
  para "zero mudanca de navegacao".
- Nao inventar feature que nao existe (aconteceu com a aba `Pos-venda`). Conferir no codigo
  o que esta construido antes de desenhar.
- O texto e a logica do mock vem do banco e do `app.js`, nunca de cabeca. O JS so cria chip
  para `morno` e `frio`: quente nao tem chip, so a faixa. O atraso diz `9d de atraso`.
- acorn/jsdom nao rodam sem node. `esprima` via pip e o substituto para sintaxe; o contrato
  de IDs (todo `E("id")` do JS existe no HTML) ataca melhor o risco de mover elemento.
