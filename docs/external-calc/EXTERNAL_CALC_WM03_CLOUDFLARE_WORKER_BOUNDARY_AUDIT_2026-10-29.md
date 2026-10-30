# TREE WM-03 | Existing Cloudflare Worker boundary audit
Date: 2026-10-29 | Owner: Chat B | PR #201
Status: READ_ONLY_GITHUB_AUDIT / NO_CLOUDFLARE_CONTROL_PLANE_PROOF / NO_DEPLOY_CHANGE

## Verified repository state
`wrangler.jsonc` on WM branch names Worker `flat-resonance-09ba`, entrypoint `worker/external-calc-worker.mjs`, static assets `public`, with Worker-first routes for `/api/external-calc/*`, Pitsquad acquisition/WhatsApp/assistant, and `/a/*`. **Connect Hub has no dedicated route or isolated Worker in this configuration.**
`README.md` documents the existing Pit Wall frontend at `https://flat-resonance-09ba.pitstopimports.workers.dev` and auto-deploy on main, explicitly noting no staging.
`worker/external-calc-worker.mjs` imports and invokes `handleWhatsAppWebhook` from `pitsquad/whatsapp-worker.mjs`.
`pitsquad/whatsapp-worker.mjs` implements `/api/pitsquad/whatsapp/webhook`, verifies Meta HMAC then forwards textual messages to a privileged Supabase RPC `pitsquad_ingest_whatsapp_message_v0` using service_role. This is an existing Pitsquad integration, NOT the independent new Connect Hub/Neon inbox architecture. No assertion that this route is configured in the Meta app or actively receiving events.
PR #201 changed file inventory is limited to WhatsApp adapter/proof/docs paths, not `wrangler.jsonc` or Worker deployment entrypoint. Hence PR #201 code commits do NOT establish that the new ingress adapter is deployed or active on Cloudflare.

## Decision
- Do NOT reuse `flat-resonance-09ba` as Connect Hub staging, and do not modify its current Pitsquad route or Supabase privileged integration in this Chat B workstream.
- Preserve existing Worker, frontend, login, app and acquisition workflows; its preview deployments are not evidence of an isolated Connect Hub deployment.
- Create a NEW separately named Cloudflare Worker, separate secrets, branch/environment and callback path for the Meta SANDBOX only after approved signed-GET/POST and durable DB flow. Explicitly disable deployment routing to the commercial number.
- Continue using isolated Neon staging `purple-violet-98259937`, but DB work must pass least-privilege A/B auth and full durable handoff. Do not add privileged API-created Neon roles to compensate.
- Before invoking Cloudflare control plane, independently audit actual Worker bindings, routes, build triggers, secret names, and live release; GitHub files alone cannot prove deployment state.

## Gates
Cloudflare code ownership boundary: VERIFIED
Existing Pitsquad webhook route in repo: VERIFIED
Connect Hub independently deployed: NOT_RUN
Meta callback to existing worker: NOT_VERIFIED
Production Worker safety / bindings via Cloudflare API: UNVERIFIED
No new deployment, app changes or number modification occurred.
