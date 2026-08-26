# Financeiro do Pit Wall - design

Data: 25/08/2026. Autor: sessao Torre + agentes `base`, `vitrine`, `pit-guard`, `bandeira`.

## 1. O pedido

O dono pediu, em duas mensagens: parte financeira com controle total, dashboard,
provisao, metas, sistema financeiro completo, dominio pessoal alem do empresarial,
forma de enviar extrato de banco para alimentar direto na Pit Wall, alertas de gasto,
e secoes mostrando onde esta sendo gasto.

Isso e cinco subsistemas, nao um. O corte em fatias esta na secao 6.

## 2. O que ja existia (medido em 25/08/2026)

- Receita: `venda` (valor_venda, custo_aparelho, despesa_frete, despesa_taxas,
  entrada_valor) e `venda_pagamento` (forma, parcelas, bandeira, taxa).
- Molde de arquivo seguro: bucket privado `nf` + ponteiro `venda_nf` + `anexar_nf`.
- Molde de tabela so-do-dono: policy `calc_dados_sel`.
- Nada de conta bancaria, categoria de gasto, despesa fora de venda, meta, teto,
  alerta ou dominio pessoal.

## 3. Respostas do dono que fecharam o desenho

| Pergunta | Resposta |
|---|---|
| Pessoal x PJ | uma conta so, tudo misturado |
| Formato de extrato | OFX |
| Dor mais cara | "nao sei onde o dinheiro vai" |
| Volume | 50 a 150 lancamentos/mes |
| Metas | lucro, objetivos da empresa, reserva de seguranca |
| Pessoal | espelho do empresarial |

## 4. As cinco decisoes de arquitetura

**4.1 Caixa e Resultado sao verdades separadas e nunca se somam.**
`venda` = resultado por competencia. `fin_movimento` = caixa. O placar de resultado le
`venda`; o de caixa le `fin_movimento`. Somar os dois dobra o faturamento no dia em que
o PIX do cliente virar lancamento. A conciliacao (`fin_movimento.venda_id`) liga os dois
sem fundi-los, e revela o numero que hoje ninguem tem: venda concluida que nunca entrou
no banco.

**4.2 Dominio e coluna dura, e nasce NULL.**
Uma conta bancaria misturada com default silencioso produz um lucro de loja que parece
certo e esta errado, e o erro so aparece meses depois.

**4.3 Valor com sinal, natureza derivada.**
Negativo = saida, que e o que o OFX entrega. `natureza` calculada na leitura (invariante 4).

**4.4 Categoria de natureza `neutro` fica fora de todo total de gasto.**
Sem isso, aplicar R$ 5.000 no CDB aparece como o maior gasto do mes.

**4.5 Categoria e config em tabela, chave `codigo`** (invariante 12). Categoria nova
entra sem tocar em codigo. Cor por hash deterministico do `codigo`, no sistema Trilho
ja provado por `prova_trilho.py`, sempre com icone.

## 5. Invariante novo (18)

> Movimento financeiro sem `dominio` classificado nao entra em nenhum total de
> resultado, de gasto ou de meta. Aparece somente como "nao classificado", com valor
> visivel, cobrando o trabalho. Dominio nunca tem default silencioso.

Corolario na tela: a faixa de nao classificado e obrigatoria e declara o que os numeros
abaixo estao ignorando. Tela que omite recorte mente, mesma licao da aba Conteudo.

## 6. As fatias

| # | Entrega | Abre em |
|---|---|---|
| 1 | O extrato entra e a tela mostra para onde o dinheiro foi | aba Financeiro |
| 2 | Regras que classificam sozinhas, aprendidas do que foi classificado na mao | mesma aba |
| 3 | Teto de gasto e alerta por dentro | Hoje + Financeiro |
| 4 | Metas (lucro, objetivo, reserva), provisao e projecao de fechamento | Financeiro |
| 5 | Conciliacao venda x caixa | Financeiro + Vendas |
| 6 | Canal externo de alerta (decisao em aberto) | fora do app |

A Fatia 1 traz a importacao JUNTO com a tela, de proposito. Tela financeira que so
aceita digitacao manual nasce vazia e morre em duas semanas com 50 a 150 lancamentos
por mes.

As regras automaticas ficam para a Fatia 2, tambem de proposito: elas devem nascer das
descricoes que se repetiram de verdade na primeira importacao, nao de palpite sobre o
que o extrato do dono traz.

## 7. Modelo de dados da Fatia 1

Config: `fin_conta`, `fin_categoria`.
Dado: `fin_movimento`, `fin_importacao`.
Bucket privado `extrato`, no molde do `nf`.

Todas com `tenant_id`, RLS dono-only (molde `calc_dados_sel`), trigger `fn_auditar()`,
e soft delete por `arquivado_em`.

Duas travas de dedupe, ambas parciais em `arquivado_em is null`: `fitid` (o ID do OFX) e
`hash_dedupe` (md5 de conta + data + valor + memo). Duas porque banco que reaproveita
FITID existe, e a licao do `lead_tenant_whats_uniq` foi que trava cobrindo so o caso
conhecido reabre pela porta que ninguem olhou.

Fatias seguintes: `fin_regra` (2), `fin_teto` (3), `fin_meta` + `fin_meta_aporte` +
`fin_previsto` (4). Schema so quando a fatia chegar.

## 8. Onde o OFX e lido

Parser no CLIENTE (~60 linhas de JS legivel no bloco legivel do `app.js`), arquivo
original guardado no bucket `extrato` para permitir reprocessar. Evita deploy de Edge
Function nova e mantem a fatia palpavel no mesmo dia.

Descartado: parser em plpgsql (ilegivel, impossivel de testar).

## 9. Seguranca

Todo o modulo e DONO-ONLY. Ja existia decisao registrada de que vendedor nunca ve custo
(commit `693050e`); o financeiro e a versao forte disso. O extrato carrega PII pesada de
terceiros (nome de quem pagou PIX), entao o bucket e privado e o dump diario, que ja e
AES-256, fica ainda mais sensivel.

## 10. Decisoes deixadas em aberto

1. Canal externo de alerta (Fatia 6). O dono pediu WhatsApp; foi avisado de que a Cloud
   API exige numero dedicado que SAI do WhatsApp do celular, e nao pode ser o numero de
   venda dele. Recomendacao: PWA push. Nao respondido. Fatias 1 a 3 alertam so por dentro.
2. Teto de gasto nao foi marcado como meta, mas o alerta pedido precisa de um limite.
   Desenho: `fin_teto` e limite (seguranca), `fin_meta` e alvo. Confirmar na Fatia 3.
3. "Objetivo da empresa" e "reserva de seguranca" sao o mesmo mecanismo (alvo + acumulado
   + prazo): viram um tipo so, `acumulo`, com rotulo livre.
