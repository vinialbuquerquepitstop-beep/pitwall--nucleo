# External Calc — VS5.1 Prova triangular / checkpoint 21-10-2026

**Branch:** `feat/external-calc-vs5-triangular-oracle-readonly-20261021`. **PR:** #189 DRAFT empilhado no #188, dependente do #182–#187. **Produção: NO-GO.**

## Por que esta prova existe

O diff anterior `VS2/VS3 × C01` mostrou diferença (23 propostas novas vs. 20 C01, apenas 1 match), mas diferença entre motores não estabelece verdade. Esta etapa compara **ambos contra um oracle independente**, gerado antes de rodar qualquer motor.

A execução é somente leitura: `buildQueue` legado e `shadowAsC01ReadOnlyPreview` recebem os mesmos bytes e hash `CanonicalDocument`. O novo motor permanece `contract_version=null`, sem oferta autorizada, persistência ou cotação.

## Primeira medição comprovada

CI **[#39632790586](https://github.com/vinialbuquerquepitstop-beep/pitwall--nucleo/actions/runs/39632790586)** — `EXTERNAL_CALC_VS51_TRIANGLE=PASS checks=6`.

| Métrica | Oracle | C01 atual | VS1–VS3 |
|---|---:|---:|---:|
| Ofertas da amostra artificial DEV | 20 | — | — |
| Candidatos observados | — | 10 | 20 |
| Matches exatos de material | — | 1 | 20 |
| Matches exatos também com origem | — | 1 | 20 |
| Ofertas do oracle sem match | — | 19 | 0 |
| Propostas extras sem match | — | 9 | 0 |

`interpretive_conclusion=SHADOW_ONLY_MATCHES_ORACLE`, **exclusivamente nessa amostra**. O dado não avalia tráfego externo nem performance de produção.

O segundo teste usa outra seed DEV e exige `EXACT` no motor shadow. O avaliador reprova (a) oracle com hash alterado, (b) preço modificado com contagem inalterada, (c) proveniência de linha forjada e (d) qualquer saída comercial autorizada.

### Limites críticos

- Esta é uma **amostra DEV já especificada pelo nosso gerador**. Não constitui *holdout* externo independente ou fornecedor natural inédito.
- O oracle é artificial e fornece preço/modelo/condição/cor diretamente. Normalização entre vocabulários é estrita, intencionalmente conservadora. Ausências de match não devem ser chamadas de corrupção de dados reais.
- A prova de origem considera exatamente as linhas do oracle, e cada candidato precisa ter `field_sources` do mesmo campo. A adjudicação manual de listas naturais continua indispensável.
- CI green testa somente esse harness. Não simula login, tenant, RLS, persistência, Fluxo C01–C05, browser mobile, Cloudflare Worker nem estratégia de rollback.
- PRs #178–#180 têm dependências de quarentena/DB não implantadas e PR #92 de UI necessita E2E. Não combinar deployments sem gate.

## Próxima sequência linear proposta (VS5.2→VS5.5)

1. **VS5.2 — contrato versionado do Service:** propostas e incertezas VS2/VS3 → fila de revisão, mantendo C01 autoritativo e zero duplicação. Especificar estados/IDs/proveniência/revisões/idempotência, sem um novo C06. Bloquear por padrão `VALID` e `auto_promote`; tentar forçar autorização deve reprovar.
2. **VS5.3 — integração runtime read-only:** mesmo hash e inputs de `buildQueue` e Service novo, provas sem Supabase, logs por candidato e erros de origem.
3. **VS5.4 — segurança e dados existentes:** PRs #178–#180, reconciliação/quarentena de 24 revisões C01 potencialmente contaminadas, schema/RPC, Auth/RLS/tenant e rollback. Não abrir escrita até isso ficar aprovado.
4. **VS5.5 — navegador real e revisão humana:** visualização desktop/mobile, seleção de fornecedor, revisão, cotação e simulação com o mesmo backend SHA; preferir observabilidade honesta e nunca campo verde genérico.
5. **VS6 — fornecedor externo verdadeiramente não visto:** aguardando fonte natural nova. Nenhum catálogo sintético pode substituir esse gate.

**Decisão VS5.1:** adapter+comparador+prova triangular DEV: `PASS`. Equivalência de verdade no corpus escolhido: `SHADOW_ONLY_MATCHES_ORACLE`. Integração C01 Service/E2E: `NOT_RUN`. Produção: `NO_GO`.
