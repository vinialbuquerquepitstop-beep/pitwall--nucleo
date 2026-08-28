# Decisao de particularidade, lista fechada

Voce interrompe o fluxo de prompt somente por um item desta lista. Fora dela, decida e siga.

A lista e fechada de proposito. Condutor que pergunta demais devolve o trabalho para quem pediu o prompt justamente para nao ter esse trabalho, e o dono para de ler as perguntas, inclusive as que importavam.

## 1. Os sete casos

### 1.1 Dominio de contraparte
`empresa` ou `pessoal` para qualquer contraparte, movimento ou padrao de regra.

Protege Inv. 18 e F2. Existe uma conta so, com dinheiro da loja e da casa misturados. O extrato nao sabe qual e qual e nenhuma heuristica sabe. So o dono sabe. Nunca sugira o lado, nem como exemplo, nem como default, nem como "provavelmente".

### 1.2 Significado de contraparte indefinida
Contraparte que o dono ainda nao explicou. `BR IPHONES` e o caso vivo: significado nao definido, e portanto nao se classifica, nao se cria regra e nao se chuta. Fica na fila de julgamento.

### 1.3 Mudanca de invariante, de portao ou de recusa
Qualquer alteracao em secao 2, 4, 6 ou 7 do CONTRATO.md. Inclui escopar um item de portao, congelar linha de base, e mover item entre 6.1 e 6.2. Invariante que muda por conveniencia de sessao deixa de ser invariante.

### 1.4 Reabertura de decisao fechada
Secao 5 do CONTRATO.md, D-a a D-q. Reabrir exige decisao explicita registrada no handoff. O caso mais provavel de aparecer sozinho e D-q, aporte de investidor, porque o desenho antigo ainda circula em documento anterior.

### 1.5 Pagar ou adiar divida declarada
Divida com numero e data no CONTRATO ou no handoff. A pergunta e sempre de preco, e o preco quase nunca foi medido. **Antes de virar decisao, emita o prompt que mede o custo.** Decisao sobre preco suposto e a forma mais comum de a divida crescer com aprovacao.

### 1.6 Segunda `security definer`
O modulo tem uma so, `privado.fn_fin_importacao_fechar`. A segunda exige justificativa escrita no handoff, e a justificativa e do dono.

### 1.7 Forcar padrao acima do teto
Padrao de regra que casa mais de 60% da base e recusado por D-e. `forcar: true` passa por cima, e so o dono aciona. A tela nunca forca sozinha.

## 2. O que NAO e decisao de particularidade

Decida e siga, sem perguntar:

- nome de arquivo, de branch, de version de migration;
- ordem das etapas dentro de um prompt de execucao;
- formato de tabela, de saida, de relatorio;
- texto da mensagem de commit;
- quais consultas entram na fase 1 de um conserto;
- quantas perguntas fechadas a fase 1 tem;
- se a entrega vai em uma ou duas fases;
- qual prompt de contencao cabe no desvio observado;
- se emite `P-ABRE` de novo por ambiguidade de estado;
- redacao de qualquer prompt.

## 3. Formato

```
DECISAO.
<pergunta, uma frase>

A) <opcao, uma linha>
B) <opcao, uma linha>

Recomendo <letra>: <um motivo, uma frase>.
```

Duas opcoes, nao tres. Terceira opcao inventada para parecer equilibrado gasta a atencao que a decisao real precisa.

Sem paragrafo de contexto acima. Sem tabela comparativa. Sem ressalva depois.

Se a recomendacao nao couber em uma frase, voce ainda nao mediu o bastante. Emita o prompt de conferencia em vez do bloco de decisao.

## 4. Quando o dono decide contra a recomendacao

Registre a decisao no proximo prompt, no bloco `Contexto DECIDIDO, nao reabrir`, com a data. Nao reargumente, nao insista, nao repita a recomendacao em outra forma.

Reabrir depois exige fato novo medido, nao a mesma opiniao com palavra diferente.
