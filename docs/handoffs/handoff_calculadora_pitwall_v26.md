# Handoff calculadora Pit Wall v26 - External Calc Runtime/Postgres V0 integrado

19/09/2026. Substitui o v25 como topo vivo da linha calculadora.

Linguagem: prosa sem acento, sem cedilha, sem travessao.

## 1. Estado fechado

G1 a G3 da ultima infraestrutura do External Calc foram integrados no main.

Merge:

- PR: #30
- merge squash: `80956fe164746971df93a66c748d85eb5d2f294d`
- branch: `feat/external-calc-runtime-postgres-v0`

Migration aplicada:

- `20260919211347_external_calc_runtime_persist_rpc_v0`

Processo permanente desta fatia:

- `docs/calculadora/EXTERNAL_CALC_LAST_INFRA_V0.md`

## 2. Arquitetura integrada

```text
Cloudflare Worker
        |
        v
External Calc API V0
        |
        v
Application Service
        |
        +--> Service V0 -> C02/C03/C04/C05
        |
        v
Postgres Lifecycle Adapter
        |
        v
extcalc_persist_execution_v0
        |
        v
extcalc_*
```

O frontend ainda NAO consome esta rota em producao.

## 3. G1 - Postgres Adapter / RPC = PASS

A RPC `extcalc_persist_execution_v0(jsonb)`:

- exige JWT autenticado;
- deriva tenant via `privado.fn_tenant_atual()`;
- deriva papel via `privado.fn_papel_atual()`;
- V0 permite escrita apenas para papel `dono`;
- valida tenant e lineage do bundle;
- persiste Analysis, Offer, OfferRevision, HumanReview, Execution, Runs e Evidence;
- e idempotente por execution_id quando o output fingerprint coincide;
- nao contem regra de preco, calculo, eligibility ou decision output.

As tabelas `extcalc_*` continuam com SELECT apenas para authenticated.

Anon nao possui EXECUTE na RPC.

## 4. G2 - Runtime / Auth = PASS

O runtime usa o Worker existente `flat-resonance-09ba`.

`wrangler.jsonc` agora:

- preserva `public/` como static assets;
- preserva SPA fallback;
- adiciona `ASSETS` binding;
- executa Worker primeiro somente em `/api/external-calc/*`;
- usa `nodejs_compat`;
- contem apenas SUPABASE_URL e a chave publica anon ja usada pelo frontend;
- nao possui service role.

O runtime:

- valida o bearer token via Supabase Auth;
- le `app_usuario` com o JWT do proprio usuario;
- deriva tenant e papel;
- passa somente auth_context derivado para API V0;
- envia rotas nao API diretamente aos assets.

## 5. Gates de CI

Head final do PR antes do merge:

`750ce7ca3215a004b694a986019db8bcf939fe1a`

Resultados no mesmo SHA:

- Runtime push `35469306078`: PASS
- Runtime PR `35469308349`: PASS
- API PR `35469308368`: PASS

Provas preservadas:

- Service V0: 7 checks
- Persistence V0: 9 checks
- API V0: 13 checks
- Runtime V0: 11 checks
- Wrangler 4.135.0 dry-run: PASS
- API-only routing: PASS
- no service role: PASS
- scope/diff: PASS

O dry-run do Wrangler leu 10 assets e produziu bundle de aproximadamente 99 KiB,
com bindings apenas para ASSETS, SUPABASE_URL e SUPABASE_ANON_KEY.

## 6. G3 - round-trip real = PASS

Prova autenticada no banco real:

- usuario dono autenticado;
- bundle sintetico completo;
- 1 Analysis;
- 1 Offer;
- 1 OfferRevision;
- 1 Execution;
- 4 Runs C02-C05;
- 1 Evidence;
- snapshots request/response relidos sob RLS;
- ROLLBACK ao final.

Depois do rollback:

```text
analyses   0
offers     0
revisions  0
executions 0
runs       0
evidence   0
```

Provas negativas reais:

- vendedor autenticado -> DENY;
- dono autenticado + bundle de outro tenant -> DENY;
- anon -> sem EXECUTE na RPC;
- authenticated -> nenhuma escrita direta nas tabelas extcalc_*.

## 7. Seguranca

A RPC adicionou deliberadamente 1 novo finding do Security Advisor:

```text
authenticated_security_definer_function_executable
11 -> 12
```

O finding novo e `extcalc_persist_execution_v0`.

Ele e uma excecao controlada e registrada porque a RPC e a fronteira unica de escrita.
Remover o EXECUTE quebraria o runtime; abrir INSERT/UPDATE direto nas tabelas seria pior.

Controles compensatorios:

- anon sem EXECUTE;
- papel dono verificado no corpo;
- tenant derivado do JWT;
- tenant mismatch rejeitado;
- lineage validado;
- search_path vazio;
- tabelas continuam SELECT-only;
- zero service_role no runtime.

## 8. Gate ainda aberto

`G4 - Deploy / Endpoint` permanece PENDENTE.

O canal de deploy agora esta versionado e validado:

- PR #32;
- merge squash: `8aba3e5831096e910a155def105c12953eb5c7f5`;
- workflow: `.github/workflows/external_calc_cloudflare_g4.yml`;
- runbook: `docs/calculadora/EXTERNAL_CALC_G4_CLOUDFLARE_RUNBOOK.md`;
- validacao do pacote no PR: PASS.

O workflow e manual e NAO publica no merge. Em `main`, ele exige:

- confirmacao exata do alvo `flat-resonance-09ba`;
- ambiente GitHub `external-calc-production`;
- `CLOUDFLARE_API_TOKEN`;
- `CLOUDFLARE_ACCOUNT_ID`.

Portanto:

```text
G1 PASS
G2 PASS
G3 PASS
G4 READY_TO_DEPLOY / PENDING_CREDENTIALS_AND_DISPATCH

BACKEND_INTEGRATION_READY = false
```

O frontend continua com fixtures ate o smoke de G4.

## 9. Proximo passo

Executar o workflow manual `External Calc - Cloudflare G4 Deploy` em `main`.

O proprio workflow:

- reroda Service, Persistence, API e Runtime gates;
- roda Wrangler dry-run;
- publica no Worker existente;
- prova `/api/external-calc/v0/execute` sem JWT = JSON 401;
- prova `/calc/` = 200;
- emite `BACKEND_INTEGRATION_READY=true`.

Depois desse PASS abre `Frontend Integration Gate V0`.
