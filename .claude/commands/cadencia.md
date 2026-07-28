---
description: Roda a rotina de seguranca e confiabilidade do periodo informado (semana | mes | trimestre | deploy).
---

Rode a cadencia do periodo: $ARGUMENTS.

Se `$ARGUMENTS` vier vazio, pergunte qual periodo antes de rodar qualquer coisa.
Periodos validos: `semana`, `mes`, `trimestre`, `deploy`.

## SEMANA

- Log de falha de login e erro 5xx no periodo (modo Painel da Torre).
- O cron diario rodou todos os dias? (subagent `base`).
- O backup do periodo existe de verdade em `backups/`? (modo Box da Torre).
  Existir arquivo nao e o mesmo que restaurar: aqui so se confere existencia e
  data, o restore de verdade e mensal.

## MES

- Drill de restore DE VERDADE, nao inspecao de arquivo (modo Box).
- Revisao de acesso a contas, tokens e servidores MCP (subagent `pit-guard`).
- Scan de dependencia (modo Box).
- Checar a senha do dono em haveibeenpwned.com/Passwords (subagent `pit-guard`).

## TRIMESTRE

- Rotacionar segredos (subagent `pit-guard`).
- Simular incidente no papel, do conter ate a causa raiz (subagent `pit-guard`).
- Revisar retencao e expurgo de dado (modo Estrategista da Torre).
- Drill de bypass de tenant (subagent `pit-guard`).

## DEPLOY

- Cada mudanca rastreavel ao commit (modo Box).
- Teste de isolamento no CI, quando entrar a fase SaaS (subagent `bandeira`).
- Rollback conhecido em UM movimento, escrito antes de subir (modo Box).

## Como executar

Para cada item, nesta ordem:

1. Verifique no VIVO. Nao marque nada com base em handoff, em documento ou no que
   "deveria" estar rodando.
2. Marque `feito` ou `pendente`, sempre com a EVIDENCIA colada: o comando exato, a
   query exata, o resultado medido, a data real do arquivo.
3. Item que nao pode ser verificado nesta sessao vira `pendente` com o motivo
   nomeado, nunca `feito` por presuncao e nunca omitido da lista.

Voce e a Torre: chame o subagent dono de cada item em vez de fazer no lugar dele.
Subagents nao falam entre si, entao voce cola o resultado de um no prompt do
proximo quando houver dependencia.

Ao final, escreva um handoff curto do que a cadencia encontrou, com a tabela de
itens (item, dono, resultado, evidencia), e atualize
`docs/handoffs/handoff_indice_pitwall.md`.

Nao feche a cadencia dizendo que esta tudo certo se algum item ficou pendente. A
cadencia existe justamente para pegar a falha silenciosa antes de virar
incidente: o backup que nao rodou, o cron que parou, o pico de falha de login.
