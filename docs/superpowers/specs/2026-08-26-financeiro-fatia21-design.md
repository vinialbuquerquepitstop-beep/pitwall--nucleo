# Fatia 2.1 do Financeiro — o reembolso para de virar receita, e a categoria passa a nascer na tela

Spec de desenho. 26/08/2026. Sucede a Fatia 2 (regras de classificacao), commit `9649124`.

---

## 0. O que disparou

O dono, olhando a tela com as regras dele ja rodando:

> "categorias devem ter subcategorias, opção de criar categoria, tem uma entrada sem
> sentido, não tendo onde corrigir a entrada equivocada vista. crie categorias de
> ifood, obra"

E, ao ser perguntado o que estava errado na entrada:

> "tem uma entrada de transporte, impossivel receber entrada de uber. talvez possa
> existir, mas seria necessário detalhar, tendo alguma opção pra conferir de onde veio"

Estado de partida medido no banco: 181 movimentos reais (28/07 a 26/08), 3 regras
criadas pelo dono (`MUDAVENDING`, `uber` pausada, `UBER DO BRASIL TECNOLOGIA LTDA`),
46 movimentos classificados.

---

## 1. O defeito, medido antes de desenhar

A "entrada sem sentido" sao **5 linhas `Reembolso recebido pelo Pix - UBER DO BRASIL`,
+R$ 131,02**. Corrida cancelada devolvendo dinheiro. Sao reais e estao certas.

O que esta errado e a conta. `fin_painel` monta as secoes de gasto com `and m.valor < 0`
(migration `20260826_fin_fatia1_rpcs_leitura.sql`, bloco `secoes`), entao:

| | Hoje | Verdade |
|---|---|---|
| Secao `Transporte` | R$ 624,95 | R$ 493,93 |
| Bloco `entradas` | +R$ 131,02 sob Transporte | nao e receita |
| `entrou` do mes | inflado em R$ 131,02 | — |
| `resultado` | correto | correto |

**O total bate e as duas metades mentem.** Um reembolso e gasto negativo, nunca receita.
Isso contamina todo mes com estorno, e o extrato ja tem tres pares de ESTORNO alem do
Uber.

Corrigivel **sem schema novo**: `fin_categoria.natureza_esperada` ja esta preenchida
(24 `saida`, 6 `entrada`, 3 `neutro`), entao o abatimento e derivavel na leitura, no
espirito do invariante 4.

---

## 2. As quatro decisoes do dono

| Pergunta | Resposta | Consequencia |
|---|---|---|
| Entrada dentro de categoria de gasto | **abater sozinho** | derivado da `natureza_esperada`, retroativo, zero trabalho mensal |
| Subcategoria (terceiro nivel) | **nao** — irmas | `iFood` fica ao lado de `Alimentação fora`, ambas em `Vida`. Mata a fatia mais cara |
| Criar grupo pela tela | **nao** — so categoria | cor continua vindo dos 9 grupos ja medidos contra os 7 trilhos |
| Obra e da casa ou da loja | **as duas** | nascem DUAS categorias, separadas de proposito (invariante 18) |

---

## 3. Entrega A — entrada em categoria de gasto vira abatimento

Muda **so a leitura** (`fin_painel`). Nenhuma coluna nova, nenhum dado reescrito.

### A regra

| Situacao | Tratamento |
|---|---|
| `valor > 0` em categoria `natureza_esperada = 'saida'` | **abatimento**: sai de `entrou`, abate a secao da propria categoria |
| `valor < 0` em categoria `natureza_esperada = 'entrada'` | simetrico: abate a entrada, **nao** vira gasto |
| `natureza_esperada = 'neutro'` | fora de tudo, como hoje |
| `categoria_codigo` nulo | o sinal decide, como hoje |
| `dominio` nulo | fora de todo total, como hoje (invariante 18) |

### Os casos de borda, decididos

1. **Secao que fica negativa.** Se o reembolso da janela for maior que o gasto da
   janela (devolucao de compra do mes anterior), a secao vai a negativo. O `fin_painel`
   hoje derruba com `filter (where cat.tot > 0)`. **Passa a exibir com sinal**, rotulada
   como devolvido a mais. Tela que omite mente: sumir com a linha esconde dinheiro que
   voltou.
2. **`delta_pct` sem base valida.** Quando a base anterior for zero **ou negativa**,
   `delta_pct` e `null` e a tela escreve `novo`, nunca `0%`. Regra ja vigente na Fatia 1,
   agora estendida ao caso negativo.
3. **Bloco `entradas`.** Deixa de listar positivo que caiu em categoria de saida. Esse
   valor agora vive como abatimento na secao, e listar nos dois lugares seria contar duas
   vezes.
4. **`resultado` nao se mexe.** Ele soma com sinal e ja estava certo. Se mudar, e bug.

### O que a tela declara

A secao mostra o liquido **e a conta que produziu o liquido**, senao o numero muda
sozinho sem explicacao:

```
Transporte        R$ 493,93
                  624,95 gastos menos 131,02 devolvidos · 27 linhas
```

A nota so aparece quando houve abatimento. Categoria sem devolucao continua com uma
linha so.

Na lista de Movimentos, a linha abatida ganha um selo `devolução`. Cor: `--morno`
(estado), nunca `--erro`.

---

## 4. Entrega B — procedencia e detalhe da linha

### Schema

Nova coluna em `public.fin_movimento`:

```
regra_id uuid null references public.fin_regra(id)
```

- Gravada por `privado.fn_fin_aplicar_regras` quando a regra classifica a linha.
- **Limpa (`null`) por `fin_classificar`** quando o dono classifica na mao. Sem isso, um
  ajuste manual continuaria dizendo que a regra fez, que e mentira de procedencia.
- Regra nunca e apagada (soft delete), entao o id resolve mesmo depois de arquivada.
- Indice de FK, no molde da migration `fin_fatia1_indices_fk`.

### Sem backfill, e isso e proposital

As **46 linhas ja classificadas** ficam com `regra_id` nulo e a tela escreve
`procedencia nao registrada`. As duas regras de UBER casam exatamente as mesmas 27
linhas: escolher uma seria inventar. Admitir ganha de chutar.

### Leitura

`fin_movimentos` ganha o parametro `p_categoria text default null` e passa a devolver,
por linha, `descricao_original` e a procedencia resolvida (`regra_id`, `regra_padrao`).

O `regra_padrao` e resolvido na LEITURA, entao ele mostra o padrao ATUAL da regra. Se o
dono editar o padrao depois, a linha passa a exibir o texto novo. Isso e correto e
proposital: a linha aponta para a regra que a classificou, que continua sendo aquela.
Guardar uma copia do padrao no momento da classificacao seria congelar display, e display
nao e chave (invariante 12).

**Cuidado de deploy:** acrescentar parametro cria funcao nova, nao substitui. A migration
faz `drop function public.fin_movimentos(date,date,text,text)` e cria a versao de 5
parametros com o novo em `default null`, e **refaz REVOKE/GRANT explicitos** (o
`CREATE OR REPLACE FUNCTION` reseta ACL). Com o default, o `app.js` publicado hoje, que
manda 4 parametros nomeados, continua resolvendo enquanto o frontend novo nao sobe.

### Tela

Clicar numa categoria dentro de uma secao da Visao abre as linhas por tras do numero.
Cada linha mostra:

- data, valor
- **o texto cru do banco** (`descricao_original`), completo, sem truncar
- a procedencia: `pela regra <padrao>`, `por voce`, ou `procedencia nao registrada`

---

## 5. Entrega C — criar categoria pela tela

### RPC

`public.fin_categoria_salvar(payload jsonb) -> jsonb`, dono-only, no molde das RPCs de
escrita da Fatia 1 (`{ok:false, erro:...}` na recusa).

Chaves: `id` (ausente cria, presente edita), `rotulo`, `grupo`, `natureza_esperada`,
`ordem`, `ativo`. Convencao da Fatia 1 mantida: **o que manda e a presenca da chave**.

### Codigo

O `codigo` sai do rotulo por slug deterministico na CRIACAO e **nunca muda depois**
(invariante 12: a chave e o codigo, o rotulo e display e editavel).

Slug: `privado.fn_fin_norm` para tirar acento, minuscula, tudo que nao for `[a-z0-9]`
vira `_`, colapsa `_` repetido, apara das pontas. `iFood` vira `ifood`,
`Obra (casa)` vira `obra_casa`.

### Recusas nomeadas

- `Informe o rotulo da categoria.`
- `Grupo invalido: use um dos grupos existentes.` (o payload precisa bater com um
  `grupo` ja presente em `fin_categoria`; criar grupo esta fora de escopo)
- `Natureza invalida: use saida, entrada ou neutro.`
- `Ja existe a categoria "<rotulo>" com esse mesmo codigo.` (colisao de slug, com o
  rotulo do ocupante na mensagem)
- `Categoria nao encontrada.` / `Financeiro e restrito ao dono.`

### Nunca apaga

Nao existe caminho de DELETE. Desativar (`ativo: false`) tira do seletor e **mantem nos
numeros historicos**: o `fin_painel` faz `left join` em `fin_categoria` sem filtrar
`ativo`, entao o rotulo de uma categoria desativada continua resolvendo no mes passado.

### Ordem

Categoria nova entra no fim do grupo: `ordem = max(ordem) do grupo + 1`.

### Auditoria

`fin_categoria` ja tem `trg_auditar_fin_categoria` chamando `fn_auditar`. Criar ou editar
gera **exatamente um** registro append-only com valor antes e depois, sem trabalho novo.

### Tela

Ultima opcao do proprio seletor de categoria: `+ Nova categoria`, abrindo **na linha**,
mesmo padrao da regra que nasce do lancamento. A RPC devolve a config atualizada, entao
a categoria aparece no seletor sem recarregar a pagina e sem deploy.

---

## 6. Entrega D — as tres categorias pedidas

Seed por migration:

| codigo | rotulo | grupo | natureza_esperada |
|---|---|---|---|
| `ifood` | `iFood` | `Vida` | `saida` |
| `obra_casa` | `Obra (casa)` | `Casa` | `saida` |
| `obra_loja` | `Obra (loja)` | `Operação` | `saida` |

Duas Obras porque o dono respondeu "as duas coisas". Juntar seria misturar dinheiro da
loja com dinheiro pessoal, que e o que o invariante 18 existe para impedir.

**Nenhuma regra e criada junto.** Regra e decisao do dono, nasce de um lancamento real.
As 3 linhas de iFood (R$ 319,36) ficam esperando ele.

---

## 7. Fora de escopo, com o motivo

| Nao entra | Por que |
|---|---|
| Terceiro nivel de categoria | decisao do dono: irmas, nao aninhadas |
| Criar grupo pela tela | decisao do dono: os 9 existentes bastam, e cor de grupo e medida a mao |
| Editar valor ou data de linha importada | **nunca.** O caixa vale porque bate com o extrato do banco. Editar por cima transforma `fin_movimento` em opiniao e tira o chao da conciliacao da Fatia 5 |
| Marcar linha como ignorada | nao foi pedido; o abatimento resolve o caso real que apareceu |
| Conferir `LEDGERBAL` contra a soma | segue aberto do v68, e continua sendo o proximo item de banco depois desta fatia |

---

## 8. Criterio de aceite

| Criterio | Numero exato |
|---|---|
| Secao `Transporte` | de R$ 624,95 para **R$ 493,93** |
| A secao declara a conta | texto com `624,95` e `131,02` visiveis |
| `entrou` do mes | cai exatamente **R$ 131,02** |
| `resultado` | **nao muda** |
| Bloco `entradas` | deixa de listar os 5 reembolsos |
| Secao negativa | aparece com sinal, nao some |
| Clicar em `Transporte` | lista **27 linhas** com texto cru e procedencia |
| Linha classificada por regra apos a fatia | mostra `pela regra <padrao>` |
| As 46 antigas | mostram `procedencia nao registrada`, nunca uma regra chutada |
| Classificar na mao por cima | zera o `regra_id` |
| Criar `Padaria` pela tela | aparece no seletor **sem deploy** |
| Codigo imutavel | editar o rotulo de `ifood` nao muda o `codigo` |
| Categoria desativada | some do seletor, **continua** no numero do mes passado |
| Auditoria | exatamente **1** registro por escrita em `fin_categoria` |
| RLS | vendedor ve 0 e leva `Financeiro e restrito ao dono.` na RPC nova |
| Suite | piso **885**, nao pode cair |

---

## 9. Riscos e ressalvas

1. **Numeros que o dono ja viu vao mudar.** `Transporte` cai R$ 131,02 e `entrou` cai o
   mesmo. E correcao, nao regressao, mas a tela precisa declarar a conta, senao parece
   defeito novo.
2. **46 linhas sem procedencia** ate serem reclassificadas. Ressalva assumida.
3. **`drop function fin_movimentos`** e o unico ponto com janela de risco. Mitigado pelo
   `default null` no parametro novo e por refazer os grants na mesma migration.
4. **A regra `uber`** (minuscula, sem dominio, pausada, 27 aplicacoes no historico) e
   entulho que vai confundir. Recomendado arquivar, fora desta fatia.

---

## 10. Ordem de construcao

1. **Banco:** abatimento no `fin_painel` (A) + coluna `regra_id`, motor e
   `fin_classificar` (B), na mesma leva.
2. **Banco:** seed das 3 categorias (D).
3. **Banco:** `fin_categoria_salvar` e o `fin_movimentos` de 5 parametros (C, B).
4. **Tela:** nota do abatimento e selo `devolução` (A).
5. **Tela:** detalhe da categoria com texto cru e procedencia (B).
6. **Tela:** `+ Nova categoria` no seletor (C).

Cada passo de banco fecha com prova sob RLS, desfeita por `raise exception`. Cada passo
de tela fecha com a suite completa nas 5 larguras.
