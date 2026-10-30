# TREE WM-03.4a — Pure routing policy execution proof
Date: 2026-10-28
Status: PASS 12/12 PURE LOCAL / NO DEPLOY / NO DURABLE INBOX / NO CRM CONNECTION

## GitHub evidence
- `whatsapp-routing-policy-v0.cjs`, commit `d95c7cd4683ef82480a33cda00c7e54f08d6d356`, Git blob `bd2a96a4ece5e7e8b4adaa8be01c6e4ac3f7ee97`.
- `proof-whatsapp-routing-policy-v0.cjs`, commit `d3a23c8db30cbe8a1b8b129d2409ccb11711f3a9`, Git blob `afa5795f30fb8f5f47c585e4013748f2a0f1953a`.
- Local reconstructed files were verified with git hash-object against these two remote blob hashes.
- Environment Node.js v22.16.0, isolated container; NOT a Git checkout and not a staging runtime.
- Both node --check commands exit 0; proof command exit 0.

## Actual proof stdout
```text
PASS R01 approved supplier routed only to External Calc
PASS R02 known customer routes to CRM candidate
PASS R03 unknown contact stays in review
PASS R04 dual role stays in review
PASS R05 unverified provider ignored
PASS R06 unauthorized tenant ignored
PASS R07 unapproved supplier stays in review
PASS R08 CRM disabled keeps customer held
PASS R09 unsupported media ignored
PASS R10 metadata has no raw content
PASS R11 untrusted text does not force supplier routing
PASS R12 policy version retained for audit
WM03 ROUTING PURE PASS 12/12
```

## Gate interpretation
This is deterministic routing logic for server-supplied identity flags. It does not prove how those flags are authorized, whether Meta signatures are verified at the runtime entrypoint, whether any record is durably stored, whether CRM privacy/consent is approved, or whether HTTP callbacks work.

The contract `EXTERNAL_CALC_WM03_4_DURABLE_INGRESS_CONTRACT_2026-10-28.md` defines inbox/outbox and transactional deduplication as future requirements, not implemented capabilities.

Decision: WM-03.4a PASS (pure function); WM-03.4b DB schema/tenant ownership BLOCKED pending Chat A and Pitwall V2 approval; WM-03.4c real HTTPS deployment NOT_RUN; Meta webhook registration NOT_RUN; production NO_GO.