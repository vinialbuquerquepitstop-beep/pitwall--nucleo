# Plano: Fatia 2 do molde, a grade passa a COBRAR

Spec: `docs/superpowers/specs/2026-08-13-molde-conteudo-notion-design.md` (nao muda).
Fatia 1 no ar em `bc1cddc` e `2a2627c`. Executado em 14/08/2026.

---

## 1. Onde parou, e a correcao do enunciado

A Fatia 1 poe a grade oficial na tela: 7 dias, peca prevista, horario, motor,
version, janela declarada, idade da leitura, aviso de staleness. O comentario do
`app.css:2444` ja registrava o que faltava: **urgencia**.

O pedido chegou como frontend. Nao era. Medido pelo MCP antes de escrever
qualquer linha: a `molde_semana()` no banco devolvia so o molde (`dia`, `data`,
`motor`, `feed_previsto`, `horario`). Os campos `existe`, `no_ar` e
`fora_do_molde` desenhados na secao 3.4 da spec **nunca foram implementados**.

Cruzar no JS, a partir do `conteudo_periodo` que o kanban ja carrega,
duplicaria a ponte `feed -> tipo_codigo` (a spec exige "num lugar so") e usaria
a janela do kanban, que nao e a semana do molde. Entao a fatia e RPC + tela.

## 2. Banco: a RPC devolve FATO, nunca veredito

`molde_semana(p_ref date)` recriada. O caminho `tem_molde:false` nao mudou uma
linha: e ele que faz a regra de ouro ser real, e o item 19 da prova cobra que
ele continue sem carregar `dias` nem `stories`.

Novo, por dia:

| campo | definicao |
|---|---|
| `existe` | card vivo, na data, com o tipo que a ponte mapeia, `status_codigo <> 'descartado'` |
| `no_ar` | o mesmo card com `status_codigo = 'publicado'` |
| `fora_do_molde` | `text[]` dos tipos em (`reels`,`carrossel`,`feed`) na data que o molde nao pede |

Novo, no topo: `stories {previstos, existentes, no_ar}`.

**`story` nunca entra no `fora_do_molde`.** Ele tem regua propria (os 7 slots);
entrando ali, marcaria como violacao os 7 stories que o proprio molde manda
existir. Item 15 da prova existe so para isso.

A ponte vive num CTE unico (`reel_topo -> reels`, `reel -> reels`,
`carrossel -> carrossel`). A contagem de "planejado X de Y" **nao** entra na
RPC: deriva no JS a partir da mesma lista de dias que ele desenha, senao existem
duas contagens que podem divergir. `stories` fica na RPC porque o cliente nao
tem o dado.

`CREATE OR REPLACE FUNCTION` reseta ACL: REVOKE/GRANT refeitos e conferidos em
`proacl` (`{postgres=X,authenticated=X,service_role=X}`), com o item 20 da prova
cobrando que `anon` continue de fora.

## 3. Tela: dois canais que nunca se somam

Cada cartao ganha duas leituras SEPARADAS, `.mol-plan` (a peca foi criada) e
`.mol-exec` (ela foi ao ar). Um chip so respondendo as duas perguntas diria
"Reels 3 de 3" numa semana em que zero Reel foi ao ar: e o colapso que os
invariantes 2 e 3 proibem em toque x respondido.

Estado derivado no cliente por `moldeEstado(d, hoje)`, com `l()` (fuso do
Brasil), no precedente de `nivelPeca` (invariante 4).

| situacao | planejamento | execucao |
|---|---|---|
| tem peca, existe | `existe` (`--ok-fg`) | `no ar` / `atrasado` / `programado` |
| nao existe, data passada | `FALTA` (`--quente-fg`) | vazio |
| nao existe, data futura | `a criar` (`--morno-fg` hoje, `--frio-fg` depois) | vazio |
| folga com peca extra | — | `fora do molde` (`--dim`) |

**Dia futuro nao cobra**: sexta que ainda nao chegou nao esta em falta.
**`fora do molde` nao usa cor de urgencia**: peca a mais e divergencia, nao
falha; pintar de laranja poria dois significados no mesmo canal.

Rodape com tres vozes distintas: `.mol-metas` (o que o molde DECLARA),
`.mol-resumo` (o que a semana TEM, com planejado e no ar lado a lado) e
`.mol-cobranca` (falta, atrasado, fora do molde, cada balde com a propria cor).

Zero token de cor novo.

## 4. Os dois achados

**O terceiro chao.** O cartao de hoje e `--accent-tint`, nao `--panel`
(`app.css`, `.mol-dia.hoje`). Ele existe desde a Fatia 1 e nenhuma prova o
media, porque ate entao so havia texto neutro ali. A Fatia 2 poe chip colorido
dentro dele. `prova_atmosfera.py` ganhou o bloco 5: `--accent-tint` composto
sobre o cartao da `#F1F3FC`, e os cinco tokens de chip sao medidos nos tres
chaos. Pior caso `--morno-fg` sobre o cartao de hoje: **4.60**, alvo 4.5.

**O fixture que apodrecia em 17/08.** `harness.py` fixava a semana em 10 a
16/08. Enquanto a grade so descrevia, era inofensivo. No instante em que o
estado depende de hoje, na segunda 17/08 os sete dias virariam passado, todo dia
sem card viraria FALTA e a suite seguiria verde provando outra coisa. O fixture
passou a ser relativo (`_segISO(off, semanas)`), e as cenas de comportamento
usam semana -4 (tudo no passado) e +4 (tudo no futuro), deterministicas em
qualquer dia em que a suite rodar.

## 5. Uma prova que reprovou por estar errada

O bloco 5 nasceu cobrando `ratio(--quente-fg, --dim) >= 1.5`, como se contraste
baixo entre urgencia e divergencia fosse defeito. Ele reprovou com 1.12.

O numero esta certo e o limiar estava errado: contraste mede LUMINANCIA, nao
matiz. Laranja queimado e cinza azulado sao obviamente diferentes aos olhos e
quase iguais em brilho. O 1.12 nao condena a cor, ele repete a licao dos 7
trilhos (colisoes de 1.14 a 1.44): **matiz sozinho nao separa, entao o icone
carrega a distincao.**

A checagem foi invertida para a forma certa, a mesma da secao 3 do arquivo: a
medida decide se o icone e enfeite ou estrutura. Abaixo de 3:1, ela passa a
COBRAR que os 6 icones existam e que `atrasado` e `fora` desenhem coisas
diferentes. Mutacao 4 confirma que morde.

## 6. Provas, todas com EXIT CODE conferido

| prova | resultado |
|---|---|
| `harness.py` | **443 passou / 0 falhou** — EXIT 0 (eram 426) |
| `validar.py` | EXIT 0 |
| `prova_atmosfera.py` | EXIT 0 |
| `prova_trilho.py` | EXIT 0 |
| `prova_grafico.py` | EXIT 0 |
| `node --check public/app.js` | EXIT 0 |
| `diag_mobile.py` 360/390/414/1280/1440 | EXIT 0 nos cinco, 0 estouros |
| `prova_molde.sql` | **24 ok, 0 falhas**, rollback conferido |

Integridade do minificado: linha 1 (nucleo IIFE, 24625 chars) e linha 9
comparadas byte a byte contra `HEAD`, identicas.

### Prova que morde (copia temporaria, repo real intocado)

| mutacao | resultado |
|---|---|
| 1. colapsar `.mol-plan` e `.mol-exec` num chip so | **EXIT 1**, 4 reprovacoes |
| 2. tirar a comparacao com hoje do `moldeEstado` | **EXIT 1**, 3 reprovacoes na cena FUTURO |
| 3. tirar o `<svg>` dos chips | **EXIT 1**, `chips=11 sem icone=11` |
| 4. `atrasado` e `fora` com o mesmo icone | **EXIT 1** na `prova_atmosfera.py` |

Sem elas, "dois canais" e "o icone nao e enfeite" seriam slogan.

## 7. O que ficou de fora, declarado

- Escrita de volta no Notion (criar o card que falta): bloqueada pela capability
  "Update content". Botao morto e promessa.
- Slots de story dia a dia: a v1 mostra o agregado (49 celulas seriam outra tela).
- `tetos`, `proibicoes`, `garantia` e `caixinha`: lidos e guardados, nao renderizados.
- Historico de aderencia por semana.
- Pendencias 1, 2 e 3 do v56 (referencia orfa na `prova_atmosfera.py`, CSS morto
  em `.cont-card::before`, `.gitattributes` inexistente): seguem abertas.
