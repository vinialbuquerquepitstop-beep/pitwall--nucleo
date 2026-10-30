# TREE / WM-03 — Shared WhatsApp ingress, separated supplier and CRM consumers
Date: 2026-10-28
Status: ARCHITECTURAL_DECISION / DESIGN_ONLY / NO_RUNTIME
Owner: Chat B PR #201. External Calc bridge: Chat A. CRM consumer: Pitwall V2 owner.

## REALIDADE
The same Pitstop Imports Business WhatsApp number handles customer leads (including click-to-WhatsApp ads) and supplier price lists. User confirms no broadcast list dependency and requests future automatic CRM lead capture. Existing WhatsApp groups are not ingested by the Cloud API coexistence route. Coexistence eligibility, real number registration and production traffic are NOT proven. No number changes authorized.

## MODELO
One Meta webhook subscriber and signature-verifying ingress for the authorized WhatsApp Business account, with logical isolation of downstream consumers:
- approved known supplier -> External Calc source-event adapter (transport only, review required)
- customer or otherwise unknown sender -> CRM candidate / restricted inbox owned by CRM scope, not External Calc
- ambiguous identity (e.g. a contact acting as both supplier and buyer) -> quarantine for human classification; NEVER feed External Calc automatically
- statuses, unsupported media, group events -> ignore or minimally audit by policy; never pretend normal WhatsApp group data is available
No application silently forwards client message contents to the External Calc or to AI. CRM consumer is not implemented, consent and retention gates must be defined before CRM persistence.
Routing should use server-owned, tenant-scoped identities, not message-text heuristics or user-supplied tenant identifiers.
Do not assume message includes ad-referral metadata; attach referral IDs and CTWA attribution only when delivered by Meta and allowed.

## FUNDAÇÃO — proposed boundary contracts (not live endpoints)
Transport envelope `pitstop-whatsapp-inbound-event/v0` holds verified provider message identity, authenticated server tenant mapping, timestamp, event kind, source provenance and restricted raw content pointer. No secrets/tokens in the envelope.
Routing decision `pitstop-whatsapp-routing-decision/v0`: `SUPPLIER_EXTERNAL_CALC | CRM_CANDIDATE | HOLD_REVIEW | IGNORE`, reason code, policy version, identity mapping evidence, decision timestamp.
External Calc sink emits `external-calc-whatsapp-source-event/v0` only for allowlisted suppliers; no direct webhook to F1 list-intake. Chat A owns authorized bridge.
CRM sink is future `pitwall-whatsapp-lead-candidate/v0`; Pitwall V2 team owns CRM identity matching, upsert, consent, lead lifecycle, and customer communications. No CRM DB writes by Chat B.
Inbound event idempotency for private messages must be keyed on provider phone_number_id + provider message ID, persisted transactionally later, not on content hash. Equal texts in distinct messages are distinct events.
Metadata minimization: do not log chat bodies, phone numbers, access tokens or message webhook JSON; ensure data processing policy, access control, retention and audit rules before any real messages.

## EXECUÇÃO
WM-03.1 design and routing invariants in this document.
WM-03.2 pure routing policy module and synthetic negative tests (no provider calls or DB).
WM-03.3 stage-only signed webhook ingress once prerequisites are satisfied and approved.
WM-03.4 consumer contract review with Chat A and Pitwall V2 owners.
WM-03.5 Meta app separated from Pitsquad Wpp; test Meta sandbox number first, NOT live Pitstop number.
WM-03.6 later coexistence/onboarding only after explicit operational approval and client support continuity test.

## PROVA / GATES
R01 verified authorized supplier -> supplier transport only.
R02 customer -> CRM candidate or HOLD per policy, never supplier transport.
R03 unknown -> restricted CRM/HOLD, no generic raw logging and no External Calc.
R04 dual-role identity -> HOLD_REVIEW.
R05 spoofed tenant/supplier in message -> ignored, server mapping remains authoritative.
R06 exact same provider identity replay -> idempotent at durable ingress (NOT proven in pure test).
R07 two different message IDs with same body -> distinct event identities.
R08 unsigned/bad signature -> reject before parsing.
R09 missing ad referral -> no invented ad attribution.
R10 no CRM write before CRM-owned consent/access controls and versioned contract.
R11 no cross-tenant data flow.
R12 normal group messages not claimed to be available via Cloud API.
Pass in pure tests does not pass durability, server auth, webhook, consent, or CRM integrations.

## CONSOLIDAÇÃO / ownership handoff
Chat B only owns capture, source classification and routing proposal in PR #201.
Chat A owns F1 C01–C05 authority/ingress bridge; no modifications by Chat B.
Pitwall V2 team owns CRM, lead creation/updates, consent and CRM data. Pitsquad app remains independent.
No automatic CRM registration or Meta Cloud API changes yet. Integration requires versioned approval and real staging proofs.
