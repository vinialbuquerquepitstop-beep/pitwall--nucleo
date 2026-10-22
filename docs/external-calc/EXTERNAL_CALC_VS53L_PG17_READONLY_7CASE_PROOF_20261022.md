# External Calc VS5.3L — PostgreSQL 17 read-only semantic expression proof

Date: 2026-10-22. Exact target: Supabase PitswallV2 `external-calc-staging` / `mfsshvckclnmftpaprxk`.

## Execution
Executed via connected Supabase `execute_sql` as one read-only `WITH test_case (...) VALUES (...) ... SELECT ...` query against live PG17. No DDL, DML, stored function calls, GitHub Actions, user credentials, production access, or new paid resources. All data were synthetic iPhone 17 Pro 256GB / Azul / R$ 6.900,00 examples.

The query reproduced the candidate's **SQL expressions** (model prefix and capacity boundary regex, canonical staging ID slug, nullable capacity guard, word-delimited color check, BRL regex amount parsing, cents comparison). This proof is limited to expression behavior and **does not compile the full C01 foundation SQL or execute C01 RPCs**.

| Case | Expected aggregate eligibility | Observed | PASS |
| --- | --- | --- | --- |
| VALID: iPhone 17 Pro 256GB, Azul, R$ 6.900,00 | true | true | yes |
| MODEL_PREFIX: iPhone 17 claim on iPhone 17 Pro line | false | false | yes |
| MODEL_ID_SPOOF: iPhone 18 canonical ID on 17 Pro label | false | false | yes |
| CAPACITY_ABSENT: NULL storage | false | false | yes |
| COLOR_WRONG: Preto claimed on Azul line | false | false | yes |
| PRICE_CHANGED: claimed 700000 cents, source 690000 cents | false | false | yes |
| PRICE_CENTS: source 690050 cents, claimed 690000 cents | false | false | yes |

Overall: **7/7 PASS as real PG17 read-only scalar-expressions checks**. This is separate from the earlier VS5.3k Auth/JWT 9/9 test for the immutable-source metadata view. The latter does NOT validate the C01 write path.

## Atomic all-in-one package
Versioned staging-only SQL: `ferramentas/external-calc-list-intake/v0/vs53l/VS53L_C01_STAGING_ALL_IN_ONE_ATOMIC_CANDIDATE.sql`, produced by concatenating **reviewed exact** SQL blobs:
- Foundation: `e9b379e438ba163538dad3b8265fdd0ff7a8840c`.
- DB authority guard from PR #179: `bddff79482488ef548ccb2c5c7b43491c57ec805`.

Contains: one `BEGIN;` and one `COMMIT;`, mandatory staging-only preflight (postgres role + bypassrls, 2 tenants/owners, expected original A/B sources and 3 source rows), 6 tables, 7 functions, 2 immutability/quarantine triggers, postflight RLS/FORCE, column grants and anonymous RPC exposure checks, and **in-transaction** revoke PUBLIC/anon + grant authenticated of guard. Dollar-quoted delimiter matching and structure inspected; **does not substitute actual PostgreSQL function compilation**.

The previously proposed phase 1/phase 2 separate transaction sequence is superseded **for staging rollout** by this all-or-nothing candidate, to prevent partially deployed write/RPC surfaces.

## Status and blocked conditions
- `VS53L_SQL_ATOMIC_CANDIDATE=PREPARED_STATIC_CHECK`.
- `VS53L_PG17_SCALAR_EXPR_7_CASES=PASS`.
- `VS53L_REAL_SCHEMA_APPLIED=NO`; no C01 staging commercial tables have been demonstrated.
- `VS53L_C01_REAL_RPC_AB=NOT_RUN`; do not interpret the read-only expression query as C01 integration.
- `PRODUCTION=NO_GO`; PRs #178–#180 remain draft.

**Next step requiring permitted database change authorization**: apply/review only on exact staging, then execute `VS53L_C01_STAGING_PROOF_ROLLBACK.sql` (real SQL function integration) and real HTTP/JWT A/B C01 matrix, verifying final object grants/migrations. Prior Supabase SQL write invocation was blocked by the connection's security settings. Do not switch tool/credential/path to bypass the restriction.
