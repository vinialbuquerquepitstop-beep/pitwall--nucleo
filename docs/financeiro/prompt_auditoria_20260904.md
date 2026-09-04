# P-AUDITA do Financeiro — prompt para SESSAO NOVA

Gerado em 04/09/2026 pelo subagente `condutor`, a pedido do dono, depois de a sessao de
03-04/09 fechar.

**Como usar:** abrir uma sessao NOVA do Claude Code na raiz do repo e colar o bloco da
secao 2 inteiro. Nao usar a sessao que construiu.

---

## 1. Por que esta auditoria existe

O CONTRATO, secao 7, manda a auditoria de entrega rodar em **sessao separada da que
construiu**: *"Auditor que audita o proprio trabalho e carimbo."*

**Isso nao acontece desde o handoff v10.** Um grep em `docs/handoffs/` nao encontra
nenhum registro de `P-AUDITA` nos handoffs v11 a v17. Ficaram sem auditoria
independente:

- a fatia 3 (cobertura e repasse),
- a fatia 4 (contraparte),
- e as **tres entregas de 03/09/2026**, que foram construidas E conferidas pela mesma
  sessao.

Estado do `PLANO.md` medido nos arquivos, nao no que foi afirmado:

| Bloco | Estado | Evidencia |
|---|---|---|
| 1 | completo | `20260831_fin_fatia3_cobertura.sql`, 4 migrations de repasse, `abatido` e `pct_julgado` lidos em `public/app.js` |
| 2 | **incompleto** | feitos P-R5b, P-R5, P-W2-CONTRAPARTE e o julgamento da base. **Faltam P-R3, P-R4 e P-R6** |
| 3 e 4 | **zero** | `fin_meta`, `fin_provisao`, `fin_alerta`, `fin_proposta`, `fin_pessoal`, `fin_movimento_arquivar`, `fin_categoria_salvar`, `fin_conferir_saldo`: 0 ocorrencias em `supabase/` |

**O portao de entrada do bloco 3 e a lista de DEFEITOS VISIVEIS = 0.** Hoje essa lista
tem itens abertos (v17 secao 8), e a auditoria pode acrescentar mais. Por isso o bloco 3
nao comeca antes dela.

## 2. O prompt

```
Voce e auditor, nao construtor. NAO edite arquivo, NAO commite, NAO aplique migration,
NAO rode nenhuma escrita no banco. Leia docs/financeiro/CONTRATO.md (revisao 3) e
docs/handoffs/handoff_financeiro_pitwall_v17.md e confirme que leu os dois.

ESCOPO: a linha do Financeiro de 31/08/2026 ate hoje. O ultimo P-AUDITA registrado
esta no handoff v10; os handoffs v11 a v17 nao registram nenhum. Nao auditou-se ainda:
a fatia 3 (cobertura e repasse), a fatia 4 (contraparte) e as TRES entregas de 03/09.

ETAPA 1, delimitar. Rode e devolva:
1. git log --oneline --since=2026-08-30, com data e arquivos por commit.
2. git status --porcelain.
3. Via Supabase MCP: migrations aplicadas vs supabase/migrations/, casamento por md5
   do corpo, nunca por nome. Liste a diferenca nos dois sentidos.

ETAPA 2, o checklist da secao 7 do CONTRATO, pergunta por pergunta, veredito binario,
com a evidencia (arquivo e linha, ou consulta rodada e saida). Sem evidencia, o item
reprova. Cheque em especial:
- campo devolvido por RPC sem leitor em public/app.js
- inferencia de dominio em codigo, em REGRA ou em agente (Inv. 18 e F2). Liste as 58
  regras ativas e diga se alguma grava dominio para contraparte que o dono nunca julgou
- numero economico exibido com base abaixo de 95% julgada, medido por mes (F3)
- current_date ou CURRENT_DATE novo (Inv. 10)
- grant de DELETE, TRUNCATE, REFERENCES ou TRIGGER para authenticated (Inv. 9)
- security definer nova alem de privado.fn_fin_importacao_fechar
- token de cor novo (C5) e frase de erro fora da secao 4 (C3)
- migration aplicada no banco e ausente do git

ETAPA 3, os quatro pontos que esta auditoria existe para medir:

A. PORTAO 6.3 na sessao de categorias de 03/09. O handoff v17 e o
   docs/financeiro/plano_categorias_20260903.md registram que tres saldos mensais da
   empresa mudaram quando THAY DE OLIVEIRA passou a ser conta do Caique
   (fev 3.872,09 -> 1.999,09 · mar 3.864,20 -> 1.864,20 · mai 5.635,02 -> 1.235,02).
   Meça pela fin_painel de producao, como dono autenticado, quanto cada mes vale HOJE.
   Depois julgue a excecao 6.3.1 CONDICAO POR CONDICAO, com sim/nao para cada uma das
   quatro, e diga se ela cobre ou nao cobre este caso. Se nao cobrir, o 6.3 vale inteiro
   e a nota na tela e divida aberta: diga isso com essas palavras.

B. PORTAO 6.2 no v17. O handoff de topo nao traz EXIT code, nao traz hash de commit e
   nao traz a conferencia item a item do portao de saida. Rode a suite AGORA e devolva
   EXIT CODE, nunca texto de saida, em tabela:
     python ferramentas/validar.py
     python ferramentas/harness.py
     python ferramentas/prova_trilho.py
     python ferramentas/prova_grafico.py
     python ferramentas/prova_atmosfera.py
     node --check public/app.js
     python ferramentas/diag_mobile.py em 360, 390, 414, 1280 e 1440
     python ferramentas/diag_largo.py em 1500, 1920 e 2560
   Devolva tambem o numero de assercoes que EXECUTARAM e o de rotulos DECLARADOS, os
   dois, e compare com os 1087 registrados no v16.

C. DUAS AFIRMACOES A CONFERIR no plano_categorias_20260903.md, que a proxima sessao vai
   ler como estado. Meça no banco e diga VERDADE ou FALSO para cada uma:
   - secao 8: "Nao mexe em nenhum saldo. Nenhum numero do placar muda por causa deste
     plano" (a secao EXECUCAO do mesmo arquivo diz que mudou tres saldos)
   - EXECUCAO: "nada aqui mexeu em dominio, so em categoria" (a Thay saiu de empresa
     para pessoal)

D. RASTRO DE MUDANCA DE ESTADO. A sessao de 03/09 rebaixou a prioridade da regra
   `Compra no débito` de 100 para 9000, completou 17 regras com categoria e criou 9.
   Diga, para cada tipo de mudanca: entrou pela RPC da tela (fin_regra_salvar,
   fin_classificar, fin_repasse_marcar), por migration versionada, ou por SQL direto sem
   rastro no git? Liste o que nao tem rastro.

ETAPA 4, o inventario do proprio CONTRATO. A secao 1 diz 11 RPCs publicas, 33
categorias ativas e 223 assercoes do Financeiro em 997 linhas, medido em 01/09. Meça os
tres hoje e devolva a diferenca. NAO corrija o arquivo: so reporte.

Feche com:
- a lista de DEFEITOS VISIVEIS ABERTOS, numerada, cada um com o numero da tela que ele
  erra. Essa lista e o portao do bloco 3 do PLANO.md, entao ela precisa estar completa.
- veredito unico: o bloco 2 do PLANO.md pode ser dado por fechado, sim ou nao.

Auditoria que nunca reprova e teatro. Se reprovar, diga o que esta errado e qual e o
conserto, sem executa-lo. Nao proponha entrega nova, nao comece o bloco 3 e nao toque no
defeito de datas entre Dashboard e Financeiro.
```

---

## 3. Nota sobre o item C

**As duas afirmacoes ja foram corrigidas** no `plano_categorias_20260903.md` em
04/09/2026, commit `9a5a494`: ficaram **riscadas e explicadas**, nao apagadas. A
auditoria deve medir o BANCO e confirmar o veredito de forma independente, nao aceitar a
correcao pela palavra dela.

## 4. O que a auditoria NAO deve fazer

- nao propor entrega nova;
- nao comecar o bloco 3;
- nao tocar no defeito de datas entre Dashboard e Financeiro (v17, secao 8, item 1), que
  e a proxima entrega e nao objeto de auditoria;
- nao corrigir o `CONTRATO.md` nem o `PLANO.md`, mesmo achando erro: **so reportar**. O
  inventario desatualizado esta na etapa 4 justamente para virar decisao do dono.
