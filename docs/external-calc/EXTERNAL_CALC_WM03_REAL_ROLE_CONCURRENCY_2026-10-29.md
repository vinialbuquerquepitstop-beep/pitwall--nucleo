# WM-03 | Real Neon restricted-role concurrency
Date: 2026-10-29. Chat B. Isolated staging only.

- Project purple-violet-98259937, role authenticated as pch_app_a_login via role_name Neon connection.
- Attempted 8 parallel single-statement writable CTE inserts; each rejected by RLS for ingress_outbox. Count check showed zero residual event rows. This shape is NOT supported by current policy and is NOT the adapter's SQL shape.
- Executed 8 parallel separate Neon.run_sql_transaction calls authenticated as pch_app_a_login. Each transaction contained two SQL statements: INSERT ingress_events ON CONFLICT DO NOTHING; INSERT ingress_outbox SELECT id FROM ingress_events WHERE id=unique_candidate_id ON CONFLICT DO NOTHING. All 8 calls fulfilled. Unique provider message identity was the same for all eight; candidate UUIDs varied.
- Read under pch_app_a_login: exactly one matching Inbox row and one linked Outbox row for scope wm03-role-tx-20261029.
- The DB unique constraint and RLS worked; atomic two-statement transactions survived concurrency. This is an actual PostgreSQL test, but it is NOT execution of the Node.js acceptIngress function with pg client; delivery and CRM paths remain unverified.
- No production DB, worker or commercial WhatsApp changed.

Gate 1 partial PASS: restricted-role auth, tenant RLS select/insert denial and real concurrent transaction confirmed. Node pg exact source execution NOT_RUN, Cloudflare durable bridge NOT_RUN, Meta callback NOT_RUN.
