# Handoff de Seguranca Pitwall v4

Data: 19/09/2026
Linha: Seguranca / Backend / QA
Estado: excecao controlada do External Calc registrada; SECURITY FATIA 0 continua em andamento.
Assinado por: ChatGPT (GPT-5.6 Sol)

## 1. Mudanca de estado

A entrega Runtime/Postgres V0 do External Calc adicionou uma nova RPC de escrita:

`public.extcalc_persist_execution_v0(jsonb)`

Migration:

`20260919211347_external_calc_runtime_persist_rpc_v0`

Merge de codigo:

`80956fe164746971df93a66c748d85eb5d2f294d`

## 2. Advisor

Baseline anterior:

- 11 findings `authenticated_security_definer_function_executable`.

Estado atual:

- 12 findings.

O novo finding e exclusivamente:

`extcalc_persist_execution_v0(p_bundle jsonb)`.

Leaked password protection continua desabilitado e permanece divida anterior.

## 3. Decisao registrada

O novo finding e aceito nesta fatia como excecao controlada, nao como warning ignorado.

Motivo:

- as tabelas `extcalc_*` permanecem SELECT-only para authenticated;
- a escrita precisa ser atomica para Analysis/Offer/Revision/Execution/Runs/Evidence;
- a RPC centraliza a unica fronteira de escrita sem expor service role no runtime.

Controles medidos:

- anon EXECUTE = false;
- authenticated EXECUTE = true;
- usuario vendedor = DENY;
- usuario dono = permitido;
- tenant e derivado por `fn_tenant_atual()`;
- papel e derivado por `fn_papel_atual()`;
- bundle com tenant diferente do JWT = DENY;
- search_path da RPC vazio;
- nenhuma tabela extcalc ganhou INSERT, UPDATE ou DELETE para authenticated;
- round-trip de prova terminou em ROLLBACK e deixou zero fixture.

## 4. Risco residual

A RPC e SECURITY DEFINER e fica exposta via PostgREST para authenticated.
O risco residual deve continuar visivel no baseline de seguranca.

Qualquer ampliacao de papel, payload ou capacidade da RPC exige nova reauditoria negativa.

## 5. Estado da SECURITY FATIA 0

Permanece inalterado:

- backup privado ainda aberto;
- visibilidade do repo ainda deve ser tratada;
- demais operacoes mutaveis do MCP ainda precisam de revisao;
- leaked password protection continua aberta.

Esta entrega nao fecha nem substitui a SECURITY FATIA 0.

## 6. Proximo passo da linha de seguranca

Continua sendo o bloco de backup privado definido no processo canonico.

A excecao External Calc deve permanecer no baseline como 12 findings ate que exista
uma alternativa com menor privilegio e mesmo comportamento transacional.
