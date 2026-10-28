# External Calc — WM-02 Pilot Readiness / Two-Source Intake
Date: 2026-10-28
Status: PLAN_ONLY / NO_META_ACTIVATION / NO_PRODUCTION
Depends on: PR #200 F1 controlled intake; PR #201 WM-00/WM-01 WhatsApp adapter.

## Decision
Supplier prices arrive from approximately 20 pre-existing WhatsApp groups plus individual chats on the existing Pitstop Imports business number. Preserve the mobile app and all groups. Start with three groups and two approved private-chat suppliers. Do not claim group access through Cloud API.

## Inputs
A. Private chats: only after confirmed Meta Cloud API coexistence eligibility, signed incoming webhook, trusted sender+phone_number_id allowlist and authorized service bridge. No outbound messages.
B. Existing groups: supervised/manual export or manual forwarding of supplier posts to a controlled intake; no unofficial Web client tied to the production number. Group provenance must be declared by an authorized operator and tagged as operator-asserted, not API-verified. Avoid importing unrelated personal messages; use supplier permission and minimization.

## Common envelope (proposal, not an implemented API)
schema: external-calc-source-envelope/v0
- channel_kind: whatsapp_cloud_private | whatsapp_group_supervised
- intake_method: cloud_webhook | operator_forward | operator_import
- tenant_id: resolved by authenticated server-side mapping, never accepted from untrusted text
- supplier_id: from approved server-side mapping or selected by authorized operator
- source_event_key: provider phone_number_id + wamid for private; server-issued immutable intake ID for supervised
- group_label: optional, operator-entered; never treat as verified provider group ID
- captured_at, message_occurred_at (optional), operator_id (supervised only)
- original_text, original_sha256, provenance_confidence: provider_verified | operator_asserted
- consent_basis / access policy metadata, review_state: REVIEW_REQUIRED
Envelope must never be wired directly to F1 list-intake. Existing authenticated F1 list intake requires its established fields and an end-user Bearer token; a least-privilege service bridge is a distinct future gate.

## Pilot matrix
P01 Three groups, manual supervised sources: 3 separate supplier lists, one per group; preserve source text, group labels and human actor.
P02 Two approved private suppliers: synthetic adapter tests first; real API only after coexistence evidence and signed webhook setup.
P03 Unauthorized private contact: reject before storage/AI; no generic raw logging.
P04 Same provider message ID twice: one durable original and candidate set.
P05 Identical text, different IDs: two source events, no improper deduplication.
P06 Multi-product prices with variants: preserve line spans and unrecognized product review.
P07 Unknown source, missing price, ambiguous supplier: REVIEW_REQUIRED, no auto-promotion.
P08 Cross-tenant A/B isolation on real authenticated staging.
P09 Retry/crash recovery: no silent partial persistence, stable evidence trail.
P10 Number safety: WhatsApp Business stays operational on handset; existing groups unchanged.

## Order and gates
G0 Existing WM-01 proof must run and be archived with actual stdout and exit status (15 synthetic checks expected, not presumed passed).
G1 F1 staging Worker deployment and real JWT A/B E2E from PR #200 must pass. No GitHub Actions executor.
G2 Build secure supervised intake path only after contract review; must require operator authentication, tenant authority, immutable originals, and C01 review. No production writes.
G3 Durable dedup and least privilege service-to-service bridge; independent negative tests.
G4 Meta coexistence eligibility and inbound-only signed webhook confirmed; pilot 2 approved private suppliers.
G5 Evaluate first 3 groups + 2 suppliers: capture coverage, rejected unauthorized content, duplicate suppression, review rate, missed products, traceability, delivery retries.
G6 Expand to approximately 20 groups only with documented evidence and operational approval.

## Exit criteria
100% of accepted pilot originals trace to channel, supplier, ingestion event and review record; no unauthorized content persists; zero duplicate review sets from retries; no cross-tenant leakage; no automatic C01 promotion; zero interruption to existing business number. If any criterion cannot be proven, NO_GO.

## Explicit boundaries
Do not activate Meta, request or store credentials, migrate number, scrape group chats, modify C01-C05, deploy, merge to main, or integrate Pitwall V2 as part of this planning slice.
