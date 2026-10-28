# TREE / WM-02.4 — Two catalog messages and loose-offer patterns
Date: 2026-10-28
Owner: Chat B WhatsApp capture, PR #201
State: FORMAT_PROOF_PASS / SOURCE_PROVENANCE_UNVERIFIED / OPERATIONAL_PILOT_NOT_RUN
Scope: synthetic transport tests only; NO F1 bridge and NO Meta activation

## REALIDADE — operator-provided example, not persisted in repository
One named supplier example was supplied in chat with TWO long WhatsApp text lists dated 28/10 and a statement that ad-hoc messages are also sent. The first list has a sealed-device headline but includes CPO, opened-box/not-activated variants, accessories, different warranties, variants and ambiguous currency markers. The second is dedicated to used phones and includes battery-condition ranges and differing warranty rules. No separate real ad-hoc message has yet been submitted. A WhatsApp group invitation URL was provided but was not opened or committed; never use an invitation URL as evidence of identity, ownership or group-message provenance.

Do not commit real supplier text, real prices, phone numbers, invitation tokens, or sensitive chats as a general fixture. The source supplier and group are NOT verified by the transport adapter or the public-facing chat sample.

## MODELO — three separate transport events
Message A (catalog-style) -> one immutable original source event.
Message B (used catalog-style) -> a different immutable original source event even if same supplier and printed date.
Message C (loose offer) -> a third immutable original source event; no inferred full-catalog overwrite.

One transport event can contain multiple product lines. The transport must preserve the exact text, line breaks, emojis and price symbols. The adapter DOES NOT split or price individual SKUs; downstream extraction/revision is the responsibility of External Calc.

## FUNDAÇÃO — edge cases requiring later interpretation
1. Headline 'lacrados' must not silently override explicit CPO or opened-box item conditions.
2. Used-list general terms (e.g. warranty, battery exclusions) and per-item battery ranges need to stay traceable to their source lines.
3. Multiple colors may share a price; other colors may use a second price. Do not collapse price/color combinations.
4. Malformed or ambiguous R$/dollar markers must be reviewed, not silently converted.
5. '1ª linha' accessories must not silently be equated to genuine Apple products; treat as a classification/authenticity review concern.
6. Re-sent lists with distinct provider-message IDs or operator intake IDs remain distinct sources; transactional dedup only for retry of the SAME identity.
7. The printed update date is not a trustworthy provider-message timestamp; provenance timestamps must be tracked separately.
8. Operator-forwarded text and group aliases are operator-asserted, not Meta-verified.

## EXECUÇÃO / PROVA — real local test, synthetic examples
File: `ferramentas/external-calc-whatsapp/v0/proof-whatsapp-two-catalogs-v0.cjs`
Commit: `9e0183f8d3934d26f5d0b1e930d703b5e5c2d677`
Local Node.js: v22.16.0.
Verified GitHub remote blob SHA == local git hash-object: `4cedad271e4b22b89adb3a37cf030882354c4cee`.
Local SHA-256: `5f0ca413d1a4d99cf46ab2e559b18ffb3d04facc523e2fc1fb4eafa160f31e7d`.
`node --check proof-whatsapp-two-catalogs-v0.cjs`: exit 0.
`node proof-whatsapp-two-catalogs-v0.cjs`: exit 0, PASS 12/12.
Reused pure supervised adapter, verified source blob: `2a598d672ef5a4c789e1a8584cf6bd687a4aacd4`.

Actual summary stdout:
```text
PASS S01 two catalogs yield two source events
PASS S02 same supplier date does not merge identities
PASS S03 sealed list preserves CPO and open-box exceptions
PASS S04 used list preserves battery and warranty qualifiers
PASS S05 colors and per-color price notation preserved
PASS S06 malformed currency syntax not silently repaired
PASS S07 standalone update has its own identity
PASS S08 same intake id creates same key, not durable dedup
PASS S09 review only, no offer authority or price parsing
PASS S10 unknown group rejected without text leakage
PASS S11 raw content hash matches exact UTF-8 bytes
PASS S12 synthetic fixtures contain no real WhatsApp invite link
WM02 TWO-CATALOG SYNTHETIC PROOF PASS 12/12
```

## CONTRACT QUESTION for Chat A, not an authorization to modify C01-C05
Recommend that a future authenticated ingestion contract distinguish an operator-asserted content-scope hint (`catalog`, `offer_delta`, `unknown`) from actual C01 commercial interpretation. Absence of a product in a new message does NOT prove an earlier supplier offer is unavailable. Chat A decides lifecycle/versioning, effective date and review semantics. Chat B will not implement these semantics in C01-C05.

## CONSOLIDAÇÃO / GATES
- WM-02.4 sample format coverage: PASS 12/12 synthetic.
- Actual group origin verification: NOT_RUN.
- Real supervised ingress + persistence: NOT_RUN.
- Real ad-hoc example: NOT_RECEIVED.
- Other group samples: NOT_RECEIVED.
- Private-supplier Cloud API pilot: BLOCKED by coexistence and F1 gates.
- F1 bridge / tenant A-B / durable dedup: BLOCKED, owned by Chat A/Codex.
- Phone safety: no number connection or modification performed.

Next independent action: obtain representative standalone offer and additional suppliers as operator-supplied text only; prepare bounded offline sample acceptance checklist. No commit of real supplier raw data or group invitation token.
