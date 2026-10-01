# PITSQUAD — WHATSAPP ASSISTANT OPERATIONAL SLICE V0

**Status:** CANDIDATE / IMPLEMENTED FOR PROOF  
**Tree Method V1:** FROZEN

## Objective

Prove one real operator-assisted path without depending on Meta channel automation:

```text
real message pasted by operator
→ contact/lead resolution
→ compact CRM context
→ AI interpretation
→ recommendation + draft
→ human review/edit
→ copy
→ manual send outside the system
```

The slice does not send WhatsApp messages and does not mutate commercial state.

## Minimum Context Resolver

Input: WhatsApp number.

Resolution:
1. normalize to digits and compare the last 11 digits against `v_lead.whatsapp_digitos`;
2. exactly one match → `RESOLVED`;
3. zero matches → `NOT_FOUND`;
4. multiple matches → `AMBIGUOUS`;
5. read up to 6 newest `lead_evento` rows for the resolved lead;
6. read up to 3 newest `pitsquad_acquisition_input` rows for the resolved lead.

Compact context includes only CRM fields already exposed to the authenticated operator. The CRM remains source of truth.

## InboundMessage candidate

```json
{
  "channel": "whatsapp_manual",
  "message_id": null,
  "contact_ref": "<normalized whatsapp>",
  "text": "<pasted inbound text>",
  "received_at": null,
  "acquisition_ref": "<when evidenced>",
  "lead_id": "<when resolved>",
  "source": "operator_paste"
}
```

## AssistantOutput

```json
{
  "intent": "string",
  "summary": "string",
  "missing_information": ["string"],
  "recommended_action": "string",
  "draft_reply": "string",
  "confidence": 0.0,
  "requires_human_approval": true,
  "evidence_refs": ["CRM:lead:...", "CRM:lead_evento:...", "CRM:acquisition_input:..."]
}
```

The Worker requires structured output and forcibly sets `requires_human_approval=true`.

## Guardrails

- no invented price;
- no invented stock;
- no invented warranty;
- no invented deadline;
- no automatic discount;
- no automatic status/profile/cadence mutation;
- no automatic send;
- commercial authority remains human;
- missing evidence must be represented as missing information;
- AI receives only the pasted message and compact CRM context.

## UI

The existing PitWall **Aquisição** screen receives an **Assistente de WhatsApp** section with:

- WhatsApp input;
- inbound-message textarea;
- Resolve + Suggest action;
- resolved context;
- intent / recommended action / summary;
- missing information;
- editable draft;
- confidence;
- evidence references;
- Copy / Regenerate / Open lead.

## Proof gate

PASS requires a real CRM case:

1. paste a real WhatsApp message and number;
2. resolver identifies the correct real lead;
3. displayed context matches CRM;
4. AI output contains no unsupported commercial facts;
5. operator can edit/copy the draft;
6. no message is sent automatically;
7. no CRM commercial state is mutated by generation.

Until this proof is recorded, this slice remains **CANDIDATE**, not consolidated architecture.

## Channel strategy remains separate

A. WhatsApp Business App + Cloud API coexistence  
B. total migration to Cloud API, only with cutover/impact plan  
C. second number only if A and B are infeasible

This operational slice does not depend on choosing A, B, or C.
