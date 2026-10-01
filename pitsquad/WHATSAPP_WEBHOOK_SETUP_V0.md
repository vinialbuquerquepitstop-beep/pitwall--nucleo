# PITSQUAD — WhatsApp Webhook Setup V0

Status: CANDIDATE / NOT DEPLOYED

## Objective

Receive inbound WhatsApp Cloud API messages and convert tracked messages containing:

`[PS-AQ-...]`

into Pitsquad AcquisitionInput records.

## Callback URL

`https://flat-resonance-09ba.pitstopimports.workers.dev/api/pitsquad/whatsapp/webhook`

## Worker secrets required

Configure these as Cloudflare Worker secrets. Do not commit values:

- `WHATSAPP_VERIFY_TOKEN`
- `WHATSAPP_APP_SECRET`
- `SUPABASE_SERVICE_ROLE_KEY`

Existing public vars remain unchanged.

## Meta webhook setup

1. Connect the Pitstop WhatsApp number to WhatsApp Business Platform / Cloud API.
2. Configure the callback URL above.
3. Use the same value stored in `WHATSAPP_VERIFY_TOKEN` as the Meta webhook verification token.
4. Subscribe the app/WABA to the `messages` webhook field.
5. Keep the Meta App Secret only in `WHATSAPP_APP_SECRET`.

## Runtime behavior

GET webhook:
- validates `hub.mode=subscribe`
- compares `hub.verify_token`
- returns `hub.challenge`

POST webhook:
- reads raw body
- validates `X-Hub-Signature-256` with HMAC-SHA256 and Meta App Secret
- accepts text messages only in V0
- reads `message.id`, `message.from`, and `message.text.body`
- extracts `[PS-AQ-...]`
- calls `pitsquad_ingest_whatsapp_message_v0` with service role
- creates/reuses AcquisitionInput
- deduplicates by WhatsApp message id

## Database objects

- `pitsquad_whatsapp_message_event`
- `pitsquad_ingest_whatsapp_message_v0(text,text,text)`

The ingest RPC is executable only by `service_role`.

## V0 outcomes

- `LINKED_TO_INPUT`
- `NO_TRACKING_REF`
- `ACTION_NOT_FOUND`
- `INVALID`

## Proven

- tracked message -> AcquisitionInput: PASS
- duplicate wamid -> deduplicated: PASS
- Worker syntax: PASS
- rollback: clean

## Production gate

Do not merge/deploy until all three Worker secrets exist and the WhatsApp number is available in a Meta WABA / Cloud API setup.
