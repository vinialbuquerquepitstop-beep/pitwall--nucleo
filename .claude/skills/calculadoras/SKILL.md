---
name: calculadoras
description: Operador unico da alimentacao de preco das calculadoras da Pitstop Imports — a calc interna do dono (/calc/, custo de fornecedor, le a tabela calc_dados no Supabase) e a calc do consultor (/calc/consultor/, preco de venda e comissao, le o dados.js do repo). Acione SEMPRE que o usuario colar ou anexar export de conversa, print ou lista de preco de fornecedor; falar em atualizar preco, tabela nova, tabela vencida, validade da tabela, alimentar a calculadora, "subir os precos", margem, comissao do consultor, custo de fornecedor, calc_dados ou dados.js; perguntar por que a calc mostra tabela vencida, por que o consultor nao consegue cotar, ou quanto esta custando um modelo. Use tambem para auditar divergencia entre as duas calcs e para criar acesso de colaborador na calc. Nao use para o painel Pit Wall (isso e pitwall-nucleo) nem para conteudo do Notion (isso e pitwall-conteudo).
---

# Calculadoras da Pitstop Imports (alimentacao de preco)

Esta skill existe para uma promessa: **o dono cola o export do chat com as listas dos
fornecedores e nao faz mais nada** ate a hora de aprovar o diff e rodar o push. Todo o
resto (ler, normalizar, calcular, gravar, gerar, validar, provar) e trabalho da skill.

Duas calculadoras ativas. A terceira (Netlify, repo `calculadora-pitstop`) foi
**aposentada pelo dono em 27/07/2026**: nao alimentar, nunca.

| | Calc do dono | Calc do consultor |
|---|---|---|
| URL | `.../calc/` | `.../calc/consultor/` |
| Quem entra | papel `dono` | papel `vendedor` (qualquer papel != dono cai aqui) |
| Mostra | custo por fornecedor, margem, scanner | so preco de venda e comissao |
| Fonte | tabela `public.calc_dados` (Supabase) | `public/calc/consultor/dados.js` (repo) |
| Como sobe | upsert SQL, **sem deploy** | `git push`, Cloudflare publica |

A segunda e **derivada** da primeira por regra determinista (ver
`references/formato-dados.md`). Nunca alimentar as duas de forma independente: e assim
que nasce divergencia entre o que voce ve e o que o consultor cota.

---

## Regra de comportamento

Vale aqui a mesma postura do resto do projeto: conselheiro critico, nao carimbo. Mas
nesta skill ha um agravante especifico, e ele manda em tudo:

**Preco errado nao e bug de tela, e prejuizo na venda.** Um `4150` lido como `4750`
some no meio de 690 precos e volta como margem negativa. Por isso:

1. **Nunca inventar preco.** Linha que o parse nao entendeu com certeza NAO vira preco.
   Vai para a lista de pendencias e o dono decide. Silencio aqui e o pior erro possivel.
2. **Nunca gravar sem diff aprovado.** Sempre mostrar o resumo de variacao antes de
   escrever em `calc_dados`, e esperar o "pode gravar".
3. **Nunca inflar cobertura.** Se casou 71% das linhas, dizer 71%, nao "quase tudo".
4. **Nunca empurrar sem provar, e nunca sobre base velha.** O push sai da skill, por
   `git push github HEAD:main` (corrigido em 15/08/2026: o remote morto e o `origin`,
   nao o `github`). Antes de commitar, medir o atraso do clone contra `github/main`:
   em 15/08 estava 25 commits atras, e um `--force` teria apagado trabalho de tres
   dias. Ver `references/procedimento-alimentacao.md`.

---

## Fluxo padrao (o que fazer quando o dono cola o export)

Detalhe completo, com comandos exatos, em `references/procedimento-alimentacao.md`.
Resumo do trilho:

1. **Ler o estado vivo antes de tudo.** `atualizado_em` e contagem de `calc_dados`,
   validade atual do `dados.js`, ultimo commit. Nunca partir do que o handoff diz.
2. **Parsear o export** contra o catalogo canonico de `references/formato-dados.md`
   (modelos, cores, fornecedores, condicoes). Produzir tres pilhas: casou / duvidoso /
   nao reconhecido. Duvidoso e nao reconhecido nao entram.
3. **Montar o blob novo** preservando `config` (as margens vivem la, nunca no codigo) e
   os arrays `bateria` e `tela`.
4. **Apresentar o diff** ao dono: quantos precos subiram, quantos cairam, as maiores
   variacoes, fornecedores sem lista nova nesta rodada, e a pilha de pendencias.
   Variacao acima de 15% contra o custo anterior e destacada uma a uma.
5. **Gravar** em `calc_dados` (upsert por MCP `apply_migration` ou pelo SQL Editor) so
   apos o OK. Conferir com SELECT depois.
6. **Gerar o `dados.js` do consultor** a partir do MESMO blob, com validade nova.
   A validade e obrigatoria em toda rodada: sem ela a calc do consultor trava.
7. **Validar** (`node --check` mais a conferencia de contagem e formato de data) e
   **commitar**, depois de conferir que o clone nao esta atras do `github/main`.
   Empurrar com `git push github HEAD:main`.
8. **Provar que subiu** com `curl` no worker, nunca pelo navegador do dono (cache).
   Para codigo da calc do dono a URL e `/calc/`, nao `/calc/index.html`.
9. **Atualizar a skill** conforme a secao abaixo.

---

## Auto-atualizacao (obrigatorio, foi o pedido explicito do dono)

Esta skill tem que envelhecer bem. O caminho das calculadoras muda: fornecedor entra e
sai, modelo novo aparece todo setembro, margem e comissao mudam, o deploy pode mudar.
Uma skill que descreve o mundo de 27/07/2026 para sempre vira armadilha, exatamente como
o CLAUDE.md que passou seis versoes afirmando que `nucleo/` existia.

Ao fim de QUALQUER sessao que toque nas calculadoras, antes do handoff:

- Mudou preco apenas? Nada a fazer aqui. Preco nao mora na skill.
- **Entrou ou saiu fornecedor, modelo, cor ou categoria?** Atualizar o catalogo em
  `references/formato-dados.md`. Ele e o dicionario do parser; catalogo velho e o que
  faz uma lista nova casar 60% em vez de 90%.
- **Mudou margem, comissao, taxa de cartao, `pb` ou regra de derivacao?** Atualizar
  `references/formato-dados.md` e conferir se o texto ainda bate com o `config` do banco.
  A regra e sempre: ler do `config`, nunca fixar numero no codigo.
- **Mudou onde algo vive** (URL, arquivo, guard de login, RLS, deploy)? Atualizar
  `references/mapa-calculadoras.md`.
- **Aprendeu algo que custou caro** (formato de fornecedor que engana o parser, armadilha
  de cache, decisao do dono contra a recomendacao)? Entrada datada em
  `references/aprendizados.md`. Esse arquivo e lido primeiro em toda sessao.

Escrever o que foi MEDIDO na sessao, com data. Nao repetir o que o arquivo ja dizia.

---

## Primeiro movimento de toda sessao

1. `references/aprendizados.md` — memoria evolutiva, armadilhas ja pagas.
2. `references/mapa-calculadoras.md` — onde cada coisa vive hoje.
3. Estado vivo: banco e arquivo, medidos, nunca lembrados.
4. So entao `references/formato-dados.md` (catalogo e regra) e
   `references/procedimento-alimentacao.md` (o passo a passo com comandos).

## Indice de references

- `references/mapa-calculadoras.md` — as duas superficies, arquivos, login, RLS, deploy,
  e o que ja foi aposentado.
- `references/formato-dados.md` — formato exato do blob e do `dados.js`, o que os
  validadores exigem, a regra de derivacao provada, e o catalogo canonico de modelos,
  cores, fornecedores e condicoes.
- `references/procedimento-alimentacao.md` — o passo a passo operacional com os comandos
  copiaveis, as travas e o checklist de fechamento.
- `references/aprendizados.md` — decisoes fechadas e armadilhas, com data.
