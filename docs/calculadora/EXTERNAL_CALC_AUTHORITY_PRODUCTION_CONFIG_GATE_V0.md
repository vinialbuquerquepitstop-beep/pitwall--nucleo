# EXTERNAL CALC — AUTHORITY PRODUCTION CONFIG GATE V0

Data: 19/09/2026
Status: PARTIAL — C02 READY / C03-C04 POLICY PENDING
Predecessor: AUTHORITY_RUNTIME_BINDING_GATE_V0 = PASS

## 1. Objetivo

Substituir configuracao de teste por fontes server-side de producao sem duplicar regra
no frontend, no Worker ou na API.

Este gate trata separadamente:

- C02 Calculation Profile;
- C03 Research Profile;
- C04 Indicator Profile;
- market context;
- Evidence source.

Nenhum valor de fixture vira regra de producao por conveniencia.

## 2. C02 — fonte de producao encontrada

A calculadora viva ja possui fonte unica server-side:

`public.calc_dados.dados.config`

A tela viva documenta explicitamente que:

- `config.margens` e a fonte de margem;
- `config.taxas` e a fonte unica dos coeficientes de parcelamento;
- `config.pb` e o acrescimo fixo da base parcelada;
- nao deve existir fallback chumbado quando a configuracao esta invalida.

Snapshot auditado em 19/09/2026:

```text
calc_dados.atualizado_em = 2026-08-17 23:20:02.384365+00
categoria = iPhone
margem av = R$ 550
margem pc = R$ 650
pb = R$ 100
taxas = 17 coeficientes, 2x ate 18x
```

## 3. Mapping C02

```text
calc_dados.config.margens[iPhone].av
  -> cash_margin_minor

calc_dados.config.margens[iPhone].pc
  -> installment_margin_minor

calc_dados.config.pb
  -> installment_base_addon_minor

calc_dados.config.taxas
  -> installment_coefficients
```

Conversao monetaria:

```text
major BRL * 100 -> integer minor units
```

O profile usa:

```text
profile_id = pitwall-calc-dados:iPhone
profile_version = calc_dados.atualizado_em
currency = BRL
```

## 4. Frete e entrada

O `calc_dados` nao e a fonte de frete transacional nem de entrada do cliente.

Para o C02 base autoritativo desta fase:

```text
freight_minor = 0
freight_mode = STORE
entry_minor = 0
```

Isso representa a execucao base sem modificadores transacionais.

Nao autoriza o frontend a transformar simulacoes locais de frete/entrada em verdade C02.
Caso esses fatos precisem entrar no C02 autoritativo, devem ganhar um contrato de input
operacional separado em fatia futura.

## 5. Prova de paridade

A prova compara o C02 contra a matematica viva:

```text
cash = custo + margem.av
installment_base = custo + margem.pc
charged_base = installment_base + pb
total_n = round2(charged_base * taxas[n])
parcela_n = round2(total_n / n)
```

Casos de custo cobertos:

- R$ 1.900
- R$ 2.550
- R$ 4.000
- R$ 5.400
- R$ 6.500

E todos os prazos 2x-18x sao verificados.

## 6. Fail closed

O adapter C02 reprova quando:

- categoria nao existe em `config.margens`;
- margem av ou pc esta ausente;
- `config.pb` esta ausente/invalido;
- `config.taxas` esta ausente/vazia/invalida;
- `atualizado_em` esta ausente/invalido.

Nao existe fallback financeiro silencioso.

## 7. Runtime

O runtime deixa de aceitar:

`EXTCALC_CALCULATION_PROFILE_JSON`

como fonte C02.

Passa a usar apenas:

`EXTCALC_CALCULATION_CATEGORY=iPhone`

e a carregar `calc_dados` sob o JWT/tenant atual.

## 8. C03 — POLICY PENDING

Os testes atuais usam valores de fixture como:

- required_match_fields = model_id, capacity_gb, condition;
- min_evidence_confidence = 0.7;
- max_age_seconds = 30 dias.

Esses valores provam o contrato, mas nesta auditoria nao foi localizada decisao canônica
que os declare politica de producao.

Portanto:

```text
C03_PRODUCTION_PROFILE = POLICY_PENDING
```

Eles nao sao promovidos silenciosamente.

## 9. C04 — POLICY PENDING

E canonico que:

- C04 usa mediana V0;
- evaluated_price vem de C01 reviewed_offer.price;
- sinais possiveis incluem CHEAP / MARKET / EXPENSIVE / INSUFFICIENT_DATA.

Os testes atuais usam:

- min_evidence_count = 3;
- cheap_at_or_below_percent = -5;
- expensive_at_or_above_percent = +5.

Nesta auditoria nao foi localizada decisao canônica que transforme esses tres numeros
em politica de producao.

Portanto:

```text
C04_PRODUCTION_PROFILE = POLICY_PENDING
```

## 10. Estado do gate

```text
C02_PRODUCTION_CONFIG_GATE_V0 = PASS candidate
C03_PRODUCTION_PROFILE         = POLICY_PENDING
C04_PRODUCTION_PROFILE         = POLICY_PENDING
AUTHORITY_PRODUCTION_CONFIG_GATE_V0 = PARTIAL
```

## 11. Deploy

Nao fazer deploy enquanto o gate integral estiver PARTIAL.

Mesmo com C02 verde, o runtime falha fechado sem C03/C04 profiles server-side.

## 12. Proximo trabalho permitido sem decisao humana

Enquanto C03/C04 aguardam politica:

1. consolidar C02 em CI;
2. preservar todos os gates anteriores;
3. auditar a ausencia de C01 real persistido;
4. preparar o gate de C01 Review Authority sem ativar producao.

Nao e permitido inventar thresholds para destravar deploy.
