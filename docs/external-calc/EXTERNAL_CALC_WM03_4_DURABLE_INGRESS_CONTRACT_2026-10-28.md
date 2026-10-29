# WM-03.4 | Tree contract: durable ingress and isolated routing
Date: 2026-10-28
Status: DESIGN_ONLY / PENDING_BILATERAL_CONTRACT_APPROVAL
Owner: Chat B PR #201. No database changes.

## REALIDADE
Current HTTP handler only verifies GET challenge and inbound POST signature; for valid allowlisted supplier messages it returns 503 because no durable source has accepted the event. Other senders are currently ignored with 200. This must not be presented as a real CRM intake or production behavior. Meta test number generated; sandbox outbound and inbound Meta console payload observed, but no owned HTTPS webhook deployment proven.

## MODELO: secure bounded inbox
1. Receive exact raw bytes via an isolated HTTPS ingress, enforce size limits and HMAC-SHA256 before parsing.
2. Validate provider account+phone IDs against server-controlled tenant configuration and route sender against tenant-scoped policy.
3. Commit an idempotent ingress record transactionally BEFORE acknowledging 200, using UNIQUE(provider_app_scope, phone_number_id, provider_message_id). Atomic insert+record creation; repeated deliveries return prior accepted identity, never duplicate an original.
4. Restrict raw payload and body storage; store only data required by each approved destination, use access-controlled encrypted storage and retention TTL policy. No generic logs containing customer content or identifiers.
5. Create an outbox record in the same transaction. Asynchronous delivery with capped retries, dead-letter state, auditable processing state and no silent loss.
6. Only after durable commit may the webhook return 200. On transient storage failure return retryable 5xx. On invalid signature return 401, on invalid body return 4xx. Unsupported events should be explicitly ignored according to a reviewed policy.
7. Routing defaults to HOLD_REVIEW, never sender text heuristics. Explicit approved supplier goes to External Calc candidate transport only; CRM candidates route through a future CRM-owned consumer contract; dual-role contacts remain HOLD_REVIEW.
8. Authorized service boundary to F1 is Chat A ownership. CRM upsert and consent are Pitwall V2 ownership. Neither may be assumed by Chat B.

## Proposed record contract (not SQL)
inbox_id: immutable server-generated ID
provider: meta_cloud_api
provider_scope_id: authenticated Meta app / WABA context
phone_number_id: server-authorized receiver
provider_message_id: original wamid
tenant_id: server-only mapping, not from payload
received_at: server timestamp
message_time: provider timestamp, separately marked
body_hash: SHA256 of original bytes/content with explicit scope
encrypted_body_ref: optional per-policy pointer, not automatically stored
classification: SUPPLIER_EXTERNAL_CALC | CRM_CANDIDATE | HOLD_REVIEW | IGNORE
policy_version: immutable routing policy reference
status: RECEIVED | ENQUEUED | DELIVERED | HELD | DEAD_LETTER
delivery_attempts: counter
No real phone numbers/tokens or copied chat texts in code fixtures or telemetry.

## PROVA matrix
D01 HMAC invalid rejected pre-JSON.
D02 unauthorized account/receiver rejected, never routed.
D03 idempotent replay of same provider identity yields one persisted source/outbox.
D04 distinct message IDs with same body create distinct sources.
D05 transaction failure produces no 200.
D06 crash after commit before 200 survives retry without duplicates.
D07 unknown customer never reaches External Calc.
D08 CRM consumer disabled means HOLD/explicit policy, no unauthorized CRM write.
D09 dual-role sender HOLD_REVIEW.
D10 concurrent same-ID deliveries produce exactly one ingress and one outbox.
D11 reprocessing retries bounded and observable.
D12 cross-tenant A/B isolation tested with real independent identities in staging.
D13 secrets/redacted raw content absent from generic logs.
D14 malformed media, status-only, and group events handled without false offer ingestion.
D15 authentic webhook GET/POST in isolated HTTPS staging.
D16 original WhatsApp Business customer support and Click-to-WhatsApp ads unaffected in later coexistence pilot.

## EXECUÇÃO slices
WM-03.4a policy-only pure routing module + adversarial synthetic tests: Chat B can start independently.
WM-03.4b inbox/outbox storage adapter: BLOCKED until Chat A/CRM owners sign off on storage authority, tenant topology, data retention, and allocation of schemas.
WM-03.4c HTTPS staging adapter: BLOCKED until isolated environment and secrets are authorized; never bind production phone.
WM-03.4d Meta test webhook event end-to-end: BLOCKED until 4b/4c and exact-source tests.

## CONSOLIDAÇÃO / Decisions requested
CHAT A: Which service boundary accepts approved supplier original? What tenant authorization proof and idempotency contract will be authoritative? Is F1 staging approved?
PITWALL V2: Which bounded CRM candidate inbox and lawful retention/consent process exists? Who owns merge/upsert and customer identity?
CHAT B: Own signed Meta transport, source-only routing, safe failure and evidence in PR #201. Do not configure the Meta callback until durable acceptance and explicit staging authorization.

Gate: WM-03.4 DESIGN DOCUMENTED; DURABLE RUNTIME NOT_RUN; PRODUCTION NO_GO.
