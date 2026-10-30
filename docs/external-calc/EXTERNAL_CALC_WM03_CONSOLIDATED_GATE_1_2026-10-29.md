# TREE WM-03 | Consolidated Gate 1, 2026-10-29
Owner Chat B, PR #201. Isolated Neon staging project purple-violet-98259937.

## Real execution
Eight independent Neon run_sql calls were issued concurrently via Promise.allSettled, using synthetic UUIDs but identical provider/scope/receiver/wamid. Each used INSERT ... ON CONFLICT DO NOTHING RETURNING id.
Observed responses: 1 insertion returning id and 7 empty results. Follow-up SELECT in staging returned count=1 for the synthetic scope. This proves database uniqueness for eight parallel requests, not full application transaction serialization or outbox creation.
No customer or supplier data involved.

## Security preflight observed
Application SQL LOGIN roles pch_app_a_login and pch_app_b_login count=0; old API-created privileged roles count=0; three policies exist; two target tables have RLS+FORCE RLS.
Previous selective read proof with SQL roles A/B: PASS limited. Real independent login A/B: NOT_RUN.

## Two remaining consolidated gates
Gate 1: partial, pending independent non-bypass app credentials, cross-tenant WRITE denial and complete Inbox+Outbox concurrency/rollback through actual application connector.
Gate 2: Meta sandbox webhook real HTTPS → verified HMAC → durable inbox → outbox → authorized consumer test, after Gate 1 and F1 staging authorization.
Do not activate real commercial number or CRM.
