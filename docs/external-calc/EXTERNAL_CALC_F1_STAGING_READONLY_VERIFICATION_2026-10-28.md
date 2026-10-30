# F1 staging read-only verification — 2026-10-28

## Scope
Read-only verification through the connected Supabase project `PitswallV2`, exact project id `mfsshvckclnmftpaprxk` (`external-calc-staging`). No SQL writes, auth impersonation, deployment, secret retrieval or production access.

## Observations from live connected project
- Project status: `ACTIVE_HEALTHY`.
- Migrations returned: `20261022060654`, `20261022061751`, `20261028013107`.
- Four named public RPCs exist: `extcalc_register_original_source_v0`, `extcalc_resolve_manual_recovery_source_v0`, `extcalc_persist_review_candidate_v0`, `extcalc_persist_review_result_v0`.
- All four are `SECURITY DEFINER`; `anon` lacks EXECUTE, `authenticated` has EXECUTE.
- RLS enabled AND forced on private original source, original event, staging tenant/membership, review decision stage tables; also enabled AND forced on public supplier, source_supplier, analysis, offer, offer_revision and review_candidate tables.
- Structural inspection of all four functions finds `auth.uid()` checks, tenant-related code, and exception paths. This is NOT a runtime proof of proper authorization and cannot replace authenticated A/B testing.

## Not verified
- Real auth JWTs of two independent tenant owners; neither positive nor negative cross-tenant RPC access.
- Cloudflare staging Worker URL/deployment/version, actual Wrangler dry-run or bundle, live HTTP smoke.
- End-to-end `original source -> candidate -> queue -> explicit human review -> persisted decision -> C01 authority -> C02-C05`.
- Existing production anomaly quarantine/rollback.
- WhatsApp coexistence eligibility or actual Meta webhook traffic.

## Gate
`STAGING_DATABASE_FOUND=PASS`; `MIGRATIONS_PRESENT=PASS`; `RPC_EXISTENCE_AND_BASIC_GRANTS=PASS`; `RLS_FLAGS_PRESENT=PASS`; `JWT_AB=NOT_RUN`; `WORKER_DEPLOY=BLOCKED_UNVERIFIED`; `F1_HTTP_E2E=NOT_RUN`; `PRODUCTION=NO_GO`.

## Next executable movement
Use existing F1 handoff and PR #200. On a safe runner with Cloudflare staging credentials (never paste in chat), validate Wrangler account and `wrangler.external-calc-staging.jsonc` exact target, run preflight and dry-run, deploy staging only, capture verified URL/version, run HTTP smoke and real JWT A/B tests. Do not use GitHub Actions; do not merge or publish the WM-00 adapter before F1 gates.
