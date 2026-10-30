# TREE / WM-02.1 — Supervised WhatsApp group capture contract
Date: 2026-10-28
Status: CONTRACT_DEFINED / IMPLEMENTATION_NOT_RUN / NO_RUNTIME
Ownership: Chat B; PR #201

## REALIDADE
Existing supplier offers arrive in ~20 normal WhatsApp Business groups and private chats. Cloud API coexistence cannot read existing normal groups. Preserve the operational phone. F1 staging authorization bridge is owned by Chat A and not yet homologated.

## MODELO
First slice handles 3 groups via manual supervised operator actions only, independently of Meta and F1. One operator-submitted message/list yields a proposed transport event, not an offer, commercial authorization, or persisted original.

## FUNDAÇÃO — contract `external-calc-whatsapp-supervised-source-event/v0`
Trusted input (supplied by a future authenticated host application, never by pasted WhatsApp text):
- authenticated actor identity and authorized tenant context (server-provided, not client-entered)
- selected approved supplier ID from server-backed tenant allowlist
- selected source group alias from server-backed allowed group catalog
- generated immutable intake event ID for each explicit submission
Untrusted input:
- operator-submitted original text, and optionally operator-declared message timestamp
Normalization output:
- contract_version, provider: operator_supervised, channel_kind: whatsapp_group_supervised
- capture_method: operator_forward | operator_import
- tenant_id, supplier_id, operator_id, group_alias
- source_event_key: supervised:<server-issued intake ID>
- original_text, original_sha256 (hash of exactly captured UTF-8 text)
- captured_at from trusted host; optional declared_message_timestamp
- provenance_confidence: operator_asserted
- review_state: REVIEW_REQUIRED
- no C01 offer_id, no auto_promoted, no computed price classifications
Unknown supplier/group, empty or oversized content, invalid method, inconsistent tenant binding: reject, no output containing original message.

## EXECUÇÃO — planned slices
WM-02.2 pure CommonJS transform only. Host authorization, database lookups, immutable storage and route are intentionally outside this pure module. Do not permit a client to forge trusted context via request payload.
WM-02.3 negative and deterministic synthetic tests.
WM-02.4 pilot prep: three groups, explicit operator, two private suppliers in simulation pending Cloud API coexistence; no live group scraping.

## PROVA — acceptance matrix
T01 valid approved group yields one review-only event
T02 unknown supplier rejected
T03 unknown group alias rejected
T04 wrong tenant supplier mapping rejected
T05 blank or excessive content rejected
T06 source_event_key uses trusted event ID, not original text hash
T07 identical text with separate intake IDs retains distinct source identity
T08 same intake ID deterministically produces same key (persistent dedup is NOT proven)
T09 operator input cannot override tenant/operator identity
T10 no offer/C01 commercial authority emitted
T11 only operator_forward/operator_import accepted
T12 group source remains operator_asserted, never provider_verified

## CONSOLIDAÇÃO / boundaries
The adapter has no trusted identity on its own; the future host must prove identity, tenant permission and approved supplier/group lists. No route to F1 list-intake, no service_role shortcut, no secrets, DB, deploy, Meta activation or production. Do not claim permanent dedup, A/B auth, or real pilot PASS from pure tests.

## Gate
WM-02.1: document committed only -> CONTRACT_DEFINED; WM-02.2 and WM-02.3: NOT_RUN.
Next: pure adapter + synthetic proof in PR #201, with isolated runtime evidence. F1 and bridge remain Chat A ownership.
