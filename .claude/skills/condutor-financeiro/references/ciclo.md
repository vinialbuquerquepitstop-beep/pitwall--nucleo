# Ciclo, maquina de estados

## Indice

1. Estados e transicoes
2. Sequencia dos blocos
3. Portoes intermediarios
4. Como ler o que o dono colou
5. Quando o ciclo trava

---

## 1. Estados e transicoes

Estado sempre inferido do que o dono acabou de colar, nunca da sua memoria da conversa.

| Estado atual | Sinal que o identifica | Proximo prompt |
|---|---|---|
| `ABERTURA` | sessao nova, nada colado, ou "vamos seguir" | `P-ABRE` |
| `PORTAO_OK` | tabela do P-ABRE, todos EXIT 0, git limpo, migrations conferidas | prompt da vez pela sequencia |
| `PORTAO_REPROVA` | qualquer item da tabela reprovado | conserto, fase 1 |
| `CONSERTO_F1_RESPONDIDO` | dono colou as respostas das perguntas fechadas da fase 1 | conserto, fase 2 |
| `ENTREGA_EM_CURSO` | executor reportou progresso parcial, sem hash | nada, ou contencao se houver sinal de desvio |
| `ENTREGA_TERMINADA` | executor disse que acabou, com ou sem hash | `P-FECHA` |
| `SAIDA_REPROVA` | P-FECHA apontou item faltando | conserto do item, sem commit |
| `SESSAO_FECHADA` | hash de commit, tabela do portao com sim em tudo, caminho do handoff | fim. Proxima mensagem volta para `ABERTURA` |
| `FIM_DE_BLOCO` | ultimo prompt do bloco fechou | `P-AUDITA`, em sessao separada |
| `DESVIO` | sinal da tabela de contencao do SKILL.md | prompt de contencao correspondente |
| `DECISAO` | o proximo passo depende de item da lista fechada | bloco `DECISAO.`, nao prompt |

Regra de desempate: se `DESVIO` coexistir com qualquer outro estado, `DESVIO` ganha. Nao se avanca sobre execucao que ja saiu do trilho.

Regra de ambiguidade: se dois estados couberem e nenhum for `DESVIO`, emita `P-ABRE`. Portao a mais e barato.

## 2. Sequencia dos blocos

```
Bloco 0   P-ESTRUTURA

Bloco 1   P-R0
          P-W1-COBERTURA
          P-W1-REPASSE
          P-R1
          P-R2
          P-AUDITA

Bloco 2   P-R5b
          DONO julga a base, no app, 40 a 60 min, sem prompt
          P-R3
          P-R4
          P-R6
          P-W2-CONTRAPARTE
          P-R5

Bloco 3   P-W3-PESSOAL
          P-W3-AGENTE1
          P-AUDITA

Bloco 4   P-W4-META
          P-W4-AGENTES
          P-AUDITA
```

`P-W1-CAPITAL` esta **CANCELADO** por D-q: nao existe aporte de investidor. Se aparecer pedido de categoria de aporte, coluna `natureza_capital` ou view de saldo por contraparte, isso e reabertura de decisao fechada, logo `DECISAO`.

Antes do bloco 1, tarefa do dono sem prompt: baixar os OFX dos ultimos seis meses e importar um por vez. O dedupe por `hash_dedupe` e `fitid` torna periodo sobreposto seguro (D-d). E o que tira a espera de calendario dos blocos 3 e 4.

## 3. Portoes intermediarios

**Entre bloco 2 e bloco 3, portao duro.** O bloco 3 nao comeca sem os tres:

- `fin_cobertura` maior ou igual a 95 por cento julgado, em VALOR e nao em linha;
- defeitos visiveis iguais a zero;
- git igual ao banco.

Se qualquer um reprovar, o proximo prompt e o conserto desse item, nao `P-W3-PESSOAL`. O bloco 3 propoe sobre dado; dado incompleto vira proposta errada com aparencia de calculo.

**Depois de cada bloco**, `P-AUDITA` em sessao separada. Auditoria que nunca reprova e teatro: se o dono colar uma auditoria com aprovacao em tudo e nenhuma evidencia por item, o proximo prompt e `P-NAO-INVENTA` apontando a auditoria, nao o proximo do bloco.

## 4. Como ler o que o dono colou

Ele opera no celular, por voz. As mensagens chegam fragmentadas, com palavra trocada e frase cortada. Interprete por intencao, nao por literalidade.

O que conta como medicao valida, e portanto pode virar base de decisao:

- EXIT code, nao texto de saida. "Rodei e passou" nao e prova.
- Saida de consulta com numero, nao afirmacao sobre o banco.
- Hash de commit, nao "commitei".
- Caminho de arquivo, nao "atualizei o handoff".

O que NAO conta, e portanto exige prompt de medicao antes de avancar:

- afirmacao de estado sem consulta;
- "deve estar ok";
- contagem de memoria da conversa;
- numero que voce mesmo derivou de outro numero sem ele ter colado a conta.

Quando o dono colar numeros, **confira a aritmetica interna antes de usar.** Contagem que nao fecha nos dois sentidos e medicao errada, e medicao errada vira conserto errado. Se nao fechar, o proximo prompt e o que remede, e voce diz qual numero nao fecha em uma linha dentro do proprio prompt.

## 5. Quando o ciclo trava

| Situacao | Proximo prompt |
|---|---|
| duas sessoes seguidas reprovaram no portao | `P-AUDITA`. O problema e estado, nao codigo. Nao emita prompt de entrega ate a auditoria fechar |
| o dono mudou de ideia no meio da entrega | prompt que fecha sem commit, e a entrega recomeca com frase nova na sessao seguinte. Nao remende prompt no meio |
| o executor fez metade e disse pronto | `P-FECHA`. A frase da entrega e o criterio: a tela mostra aquilo ou nao |
| o executor quebrou a suite e nao percebeu | `P-FECHA` pega. Se ja commitou, prompt de revert e refazer |
| entrega proposta com escopo maior "ja que estamos aqui" | `P-FREIA`. O extra vira entrega propria com frase propria, na sequencia |
| numero visivel na tela mudou sem explicacao na mesma entrega | portao 6.3 reprova. Prompt de conserto que sobe a explicacao junto, antes de qualquer avanco |
