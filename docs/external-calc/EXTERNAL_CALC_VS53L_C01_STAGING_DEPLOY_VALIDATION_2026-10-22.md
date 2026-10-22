# VS5.3L — PostgreSQL C01 staging deployed and read-only verification (22/10/2026)

## Objective and environment
User ran `VS53L_C01_STAGING_ALL_IN_ONE_ATOMIC_CANDIDATE.sql` from the Supabase SQL Editor, reported `Success. No rows returned`. Independently verified on `mfsshvckclnmftpaprxk` (PitswallV2 `external-calc-staging`, PostgreSQL 17), no production writes, no GitHub Actions.

## Deployed database — verified
- 6 public C01 tables PRESENT, with `RLS=true`, `FORCE RLS=true`, each with one owner-only SELECT policy: `extcalc_supplier`, `extcalc_source_supplier`, `extcalc_analysis`, `extcalc_offer`, `extcalc_review_candidate`, `extcalc_offer_revision`.
- No `anon` direct SELECT on the 6 tables, no `authenticated` direct SELECT or INSERT on these tables. Direct read of `candidate_snapshot` / `c01_snapshot` by `authenticated` denied.
- 3 staging C01 RPCs PRESENT, `SECURITY DEFINER=true` and owner `postgres` with `BYPASSRLS`. `anon EXECUTE=false`; `authenticated EXECUTE=true`: `extcalc_bind_source_supplier_v0`, `extcalc_persist_review_candidate_v0`, `extcalc_persist_auto_promoted_c01_v0`. Two private auth helpers likewise owned by postgres. 2 C01 immutability/quarantine triggers installed.
- All 6 commercial tables EMPTY (0 rows). Original supplier source rows still 3; two staging active memberships; original-A has `QUARANTINED` event as expected.
- Supabase migration list remains only `20261022060654` and `20261022061751`: the C01 install through SQL Editor has not been recorded in migration history. Reconcile into a reviewed migration file before future automated/promoted rollout. **Do not rerun the all-in-one SQL** while objects already exist.
- Security Advisor: 3 expected but nontrivial warnings for authenticated-callable `SECURITY DEFINER` RPCs; Auth leaked-password-protection disabled (WARN); private tenant table RLS with no policy (INFO). No claim that all security checks are closed.

## Negative test oracle corrected
- Existing `VS53L_C01_STAGING_PROOF_ROLLBACK.sql` attempted direct SELECT of `extcalc_offer_revision` as `authenticated`, which now rightfully has **no table SELECT privilege**. Replaced direct SELECT count with a negative assertion requiring `insufficient_privilege` (SQLSTATE 42501). Cross-tenant ownership is also checked by calling the promotion RPC with the B identity while A's source is bound.
- The proof uses SET LOCAL ROLE/claims in PostgreSQL for synthetic identities. It **does not prove an HTTP-signed user session**. Ends in `ROLLBACK` so synthetic suppliers, sources, candidates and offers are not retained. It assumes the new C01 tables are installed. It additionally rejects mismatched price, model identity, color prefix Azul vs Azul Claro, absent capacity/lineage, supplier mismatch, missing candidate, quarantined source, cross-tenant access and invalid retry; checks valid positive promotion and idempotence.

## Gate state
- `VS53L_C01_FOUNDATION_INSTALLED=PASS`
- `VS53L_RLS_GRANTS_OWNER_PREFLIGHT=PASS`
- `VS53L_REAL_PG17_SYNTHETIC_RPC_TRANSACTION=NOT_RUN`: require user to execute updated SQL Editor proof or a newly authorized service session. Prior connector write path was blocked by platform security. Do not bypass it.
- `VS53L_REAL_SIGNED_JWT_C01_AB=NOT_RUN`
- `C01_PRODUCTION_RELEASE=NO_GO`
- PRs #178–#180 remain draft; historical contaminated C01 analysis in other DB remains unresolved. This staging project has no productive data.

## Next exact action
Run only the updated `ferramentas/external-calc-list-intake/v0/vs53l/VS53L_C01_STAGING_PROOF_ROLLBACK.sql` through **the same** project's SQL Editor, report complete success or error message. Then read-only audit every table row count, source hashes/events and grants; obtain real signed JWT A/B HTTP test for C01 write-path from an approved QA session, without disclosing credentials, tokens or service_role.
