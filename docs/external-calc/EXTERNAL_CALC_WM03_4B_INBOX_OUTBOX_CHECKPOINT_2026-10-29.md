# TREE WM-03.4b — Isolated Inbox/Outbox implementation checkpoint
Date: 2026-10-29
Status: DDL_DRAFT_COMMITTED / DATABASE_NOT_CREATED / TRANSACTIONAL_TESTS_NOT_RUN / NO_DEPLOY

## Context and cross-team decision
Chat A approved with changes, design only, a separate WhatsApp Ingress storage boundary and dedicated future F1 supplier-original contract `external-calc.whatsapp-supplier-original.v1`.
Pitwall V2 approved with changes, design only, a future admission contract `PW-WA-LEAD-CANDIDATE/0.1.0`. CRM lead creation/upsert, consent and identity remain CRM ownership. Both real integrations blocked.

## Executed in Chat B
Added `ferramentas/external-calc-whatsapp/v0/sql/ingress-outbox-isolated-proposal.sql` in PR #201.
Commit `c2b9d79b3914f97ed312d25c8f8d504bc3e81470`.
The file is a candidate PostgreSQL schema only, NOT an applied migration.
Contains unique Meta identity on provider/scope/phone/message, separate outbox with one outbox row per event, controlled destination enum, limited delivery lifecycle, retry fields and revocation from PUBLIC.

## Required corrections before executable gate
1. Explicitly choose independently isolated PostgreSQL staging project/roles; do not run this DDL in External Calc F1/Pitwall DB.
2. Confirm tenant binding authority, role separation, RLS or equivalent tenant-isolation proof, and controlled access to `protected_content_ref`.
3. Define encrypted content storage and retention with LGPD review; never store raw WhatsApp messages as ordinary logs.
4. Implement single-transaction insert event + outbox with conflict/hash mismatch behavior. The SQL alone does NOT implement atomic ingestion.
5. Implement concurrency, retries, leased worker, backoff, dead letter and reconciliation.
6. Review outbox cardinality and explicit HOLD_REVIEW/IGNORE policy, including CRM-disabled state.
7. Run PostgreSQL actual integration tests with two independent tenant identities, concurrent duplicate submissions, crash/retry and failure handling; record stdout/SQL evidence and exit codes.
8. Only after these checks connect it to real GET/POST webhook staging; never connect the production WhatsApp number without separate approval.

## Gates
Contract review: APPROVED_WITH_CHANGES
DDL draft: COMMITTED
Durable runtime: NOT_RUN
DB isolation test: NOT_RUN
HTTP staging webhook: NOT_RUN
Meta callback: NOT_RUN
Production: NO_GO

## Ownership
Chat B: ingress and storage technical implementation. Chat A: F1 bridge and C01–C05. Pitwall V2: CRM admission and commercial writes. Pitsquad independent.
