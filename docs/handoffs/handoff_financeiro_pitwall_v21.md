# Handoff financeiro v21 — o portao de entrada reprovou, e a entrega da vez virou o conserto

**Data:** 06/09/2026
**Tipo:** CONSERTO DE PORTAO (`P-ABRE` reprovou), nao entrega do plano integral.
**Commit:** `2a51b9e`
**Substitui:** `handoff_financeiro_pitwall_v20.md`.

---

## 0. O que aconteceu, em uma linha

**O `P-ABRE` reprovou o item 1 e a sessao inteira virou o conserto dele, conforme o
CONTRATO 6.1.** A tree carregava 1150 linhas de spec e plano de 05/09/2026, prontas e
nunca commitadas. Nenhuma linha de codigo, migration ou tela foi tocada. A E2 nao
comecou e continua travada pela D-s.

O v20 fechou dizendo "o portao de entrada da proxima sessao deve abrir sem conserto".
**Abriu com conserto.** O que ele mediu como limpo era o estado da sessao dele; entre o
v20 e esta sessao, a sessao de desenho da calculadora deixou dois arquivos para tras.

---

## 1. O portao de entrada, item a item, por EXIT CODE

| # | Item | EXIT | Veredito |
|---|---|---|---|
| 1 | `git status --porcelain` | 0 | **REPROVOU** — 2 arquivos nao rastreados |
| 2 | migrations aplicadas x versionadas (MCP) | — | passa |
| 3 | `python ferramentas/validar.py` | 0 | passa |
| 4 | `python ferramentas/harness.py` | 0 | passa, **1109 passou, 0 falhou**, 1114 declaradas |
| 5 | `python ferramentas/prova_trilho.py` | 0 | passa |
| 6 | `python ferramentas/prova_grafico.py` | 0 | passa |
| 7 | `python ferramentas/prova_atmosfera.py` | 0 | passa |
| 8 | `node --check public/app.js` | 0 | passa |
| 9 | `diag_mobile.py` 360/390/414/1280/1440 | 0/0/0/0/0 | passa |
| extra | `diag_largo.py` 1500/1920/2560 | 0/0/0 | passa |

**Item 2, medido e nao presumido.** As 33 migrations do Financeiro aplicadas no banco,
de `20260826014833 fin_fatia1_schema` ate `20260905022704 20260904_fin_painel_notas`,
tem arquivo em `supabase/migrations/`. Nenhuma aplicada sem versionar, nenhuma
versionada sem aplicar. O diff foi rodado por script comparando o ledger do MCP contra
`git ls-files`, nao conferido no olho.

---

## 2. A reprova e o conserto

Os dois arquivos parados na tree:

```
docs/superpowers/plans/2026-09-05-calculadora-produto.md        730 linhas
docs/superpowers/specs/2026-09-05-calculadora-produto-design.md 420 linhas
```

**Nao eram rascunho.** Carregam as decisoes do dono da sessao de 05/09 (D1 a D4, mais
assentos e cota de modelo) e a nota explicita de que a frente contraria o invariante 17,
por escolha consciente e com o custo assumido. Fora do git, isso morre na sessao
seguinte, que e exatamente o defeito que o arranque do `CLAUDE.md` manda vigiar: tree
suja no arranque nao e ruido, e entrega parada.

Conserto: um commit, dois arquivos, zero linha de codigo.

---

## 3. Portao de saida (CONTRATO 6.2), item a item

| Item | Resposta |
|---|---|
| SQL rodado no banco de verdade | **nao se aplica** — zero SQL nesta sessao |
| RLS testada como dono e como vendedor | **nao se aplica** — zero mudanca de policy, grant ou RPC |
| a tela le todo campo novo do servidor | **nao se aplica** — o servidor nao passou a devolver campo nenhum |
| assercao nova na suite | **nao** — e a resposta honesta. Commit so de documento nao tem comportamento novo para assertar. Assercao inventada aqui provaria a existencia de um arquivo `.md`, nao o produto |
| EXIT 0 nos 7 comandos e nas 5 larguras | **sim** — secao 1. `validar.py` e `node --check` reconferidos DEPOIS do commit, EXIT 0 nos dois |
| commit unico, incluindo spec e plano | **sim** — `2a51b9e`, e a spec e o plano SAO a entrega |
| handoff atualizado | **sim** — este arquivo |
| nenhuma recusa nova fora da secao 4 | **sim** — zero recusa criada |

---

## 4. Portao de confianca (CONTRATO 6.3)

**Algum numero visivel na tela mudou de valor nesta entrega? NAO.**

Nenhum arquivo de `public/` foi tocado. Nenhuma RPC, migration ou dado de config foi
alterado. A tela de 06/09 e byte a byte a de 05/09. O 6.3 nao e acionado, e a excecao
6.3.1 nao precisa ser invocada.

**Alguma recusa nova foi criada? NAO.** A secao 4 do CONTRATO nao mudou.

---

## 5. O que NAO foi provado

- **A suite nao foi rodada inteira apos o commit.** Rodei `validar.py` e `node --check`
  (EXIT 0), nao os outros seis nem as oito larguras. Justificativa: o commit toca dois
  `.md` em `docs/superpowers/`, e nenhuma ferramenta da suite le essa pasta. E uma
  omissao declarada, nao um esquecimento.
- **O commit nao foi empurrado para o remoto.** Push e o deploy na Cloudflare; como e
  commit so de documento nao ha o que publicar, mas o estado local e o do GitHub
  divergem em um commit ate alguem empurrar.

---

## 6. Pendencias, herdadas e intactas

Nada nesta sessao pagou divida do Financeiro. As tres pendencias do v20 seguem abertas,
palavra por palavra:

1. **A unidade da nota.** `pct_julgado` desenha porcentagem com cifrao, porque `finNota`
   formata tudo com `brlV`. Nenhum numero da tela esta errado hoje (as 3 notas sao em
   dinheiro), mas a E2 leva marco para 91,77% e e ali que a nota de cobertura passa a
   fazer sentido. Conserto desenhado no v20, secao 3. **Entra de carona na E2.**
2. **A linha que falta na secao 4 do CONTRATO.**
   `Dominio invalido: use empresa, pessoal ou tudo.` esta viva na `fin_painel` desde
   `78be994` e nunca foi listada. **Entra de carona na E2.**
3. **Isolamento cross-tenant estrutural, nao empirico.** Um tenant so na
   `app_usuario`. So vira empirico quando existir um segundo, o que pelo invariante 17
   nao se constroi antes do primeiro pagamento.

---

## 7. Primeiro movimento do proximo chat

**Abrir a decisao D-s**, a regra `Compra no débito`, secao 1 do
`docs/financeiro/plano_solucao_integral_20260904.md`. Sem ela a E2 nao comeca, e a E2 e
a proxima das oito entregas que faltam.

Frase da E2, ja escrita: *nenhuma regra grava dominio para contraparte que o dono nunca
julgou, e a tela mostra quantas linhas voltaram para a fila.*

**A E2 e de raio grande** porque altera `docs/financeiro/CONTRATO.md`: sai em duas
fases, com parada entre elas. Ela carrega, declarado no escopo e nunca descoberto no
meio: a saida da D-s, o conserto da unidade da nota e a linha que falta na secao 4.

**Custo declarado e esperado da E2:** marco cai para 91,77% e apaga numero economico ate
o dono julgar. Isso e a entrega funcionando, nao defeito dela.

---

## 8. Invariantes reforcados

- **CONTRATO 6.1, literal.** Portao que reprova nao se negocia por pressa: a entrega da
  vez passou a ser o conserto, e a E2 nao foi adiantada em nenhuma linha.
- **CONTRATO 6.3.** A pergunta do portao de confianca foi respondida explicitamente com
  NAO, e a resposta foi medida (zero arquivo de `public/` tocado), nao presumida.
- **Arranque do `CLAUDE.md`.** Tree suja no arranque e entrega parada, nao ruido. Foi
  a terceira vez que o projeto encontra trabalho pronto fora do git.
- **Invariante 17, nomeado e nao violado.** A frente da calculadora como produto vai
  contra ele por escolha consciente do dono, registrada na spec. Commitar o DESENHO nao
  constroi superficie de SaaS: constroi so o registro da decisao.
