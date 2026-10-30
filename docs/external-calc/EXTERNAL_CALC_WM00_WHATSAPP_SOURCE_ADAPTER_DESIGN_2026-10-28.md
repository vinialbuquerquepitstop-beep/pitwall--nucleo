# External Calc — WM-00 WhatsApp Source Adapter (design gate)
Date: 2026-10-28
Status: DESIGN_ONLY / NO_WEBHOOK / NO_PRODUCTION / F1_E2E_BLOCKED
Base: feat/external-calc-f1-controlled-intake-20261022 (PR #200, draft)

## Existing contract is authoritative
The existing F1 route `POST /api/external-calc/v0/list-intake` accepts only `filename`, `mime_type`, `content`, `supplier_id`, requires a real user's Bearer token, and is restricted to the dedicated Supabase staging URL. It registers the original via `extcalc_register_original_source_v0` before persisting C01 review candidates, with `auto_promoted=0`. Do not send Meta webhook payloads to this route or impersonate a user with a service key.

## Ownership and boundaries
Meta Cloud API inbound private-chat messages -> NEW authenticated webhook ingress -> supplier allowlist and privacy filtering -> source event adapter -> EXISTING trusted original source / F1 intake (only through a separately reviewed server-side authorization bridge) -> C01 REVIEW_REQUIRED. C02–C05 unchanged. Pitwall remains future downstream consumer. Ordinary WhatsApp groups are not captured by the coexistence API.

The WhatsApp provider may deliver clients' messages to the same number. Therefore reject anything not from an explicitly approved supplier **before** sending text to AI or persisting original content. Don't log raw payloads, phone numbers or message text in generic logs. Supplier mapping and tenant attribution must come from server-side authorized configuration, never from webhook fields.

## Required ingress verification (NOT IMPLEMENTED)
- Verify `X-Hub-Signature-256` HMAC SHA-256 against exact raw body with app secret and constant-time comparison, before JSON parsing, persistence or async queueing.
- GET verification challenge only after verification token match. Bound payload bytes, request timeout, and reject malformed event types.
- Accept only `messages[].type=text` from a known approved sender/phone-number-id mapping. Reject status, group, media, and system events in V0; do not treat captions as text.
- Maintain deduplication unique on (channel_id, message_id), transactional with persisted source identity. Retries must not create additional C01 candidates. Source text append-only, preserve original bytes and hash, event timestamps and provenance in a separate restricted metadata store.
- Separate source IDs by provider message identity, not just content hash: identical text resent as a NEW message must have a separate source record, while delivery retries of the same message ID are idempotent.
- Never construct end-user Bearer JWTs or call F1 with `service_role` to bypass its review/tenant protections. Design an authorized service-to-service boundary explicitly, with least privilege, separate gate, audit and JWT A/B proof.

## WM-00 standalone slice (safe for parallel development)
Pure adapter/validation tests may be developed in a separate branch based on F1, but **no runtime wiring or secret provisioning** until F1 staging E2E and tenant isolation are proven. Expected outputs are normalized transport records, **not** C01 reviewed offers.

## Gate matrix
1. Valid webhook with approved supplier -> source event eligible for authorized ingress, no auto-promotion.
2. Client/unknown sender -> no source text persistence, no AI, no workflow invocation.
3. Duplicate message-id -> exactly one original source and one set of review candidates.
4. Same text, distinct message-id -> distinct source events, no accidental merge.
5. Wrong signature/missing signature -> reject before parsing/processing.
6. Cross-tenant sender mapping/identity -> deny, with real authenticated tenant A/B evidence.
7. Multi-product list -> coverage and original line spans preserved; unknown/missing product -> review.
8. Worker crash/retry -> source registration and candidate persistence idempotent, no partial silent success.
9. Meta Business App coexistence -> eligible number confirmed, inbound private texts verified, customer support in iPhone unchanged.
10. No group-read claim; no send-message permission or automated replies.

## Release constraints
As of 2026-10-28, F1 staging Worker deployment is BLOCKED, real HTTP E2E has NOT RUN, and PRODUCTION is NO_GO. This branch MUST NOT merge to main or modify production. Do not use GitHub Actions as executor; use Codex/local terminal + isolated staging and record evidence.
