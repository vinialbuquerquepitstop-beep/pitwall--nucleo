# Pitstop Connect Hub | Standalone repository migration plan

Status: prepared, **new repository NOT YET CREATED**. Owner Chat B. Source PR #201.

## Source and isolation
Read **only** source from `vinialbuquerquepitstop-beep/pitwall--nucleo`, branch `feat/external-calc-whatsapp-source-adapter-wm00-20261028`.
Destination: new **private** repo `vinialbuquerquepitstop-beep/pitstop-connect-hub`.
Copy entire `ferramentas/external-calc-whatsapp/v0/` subtree, preserving relative paths, into destination root `ferramentas/external-calc-whatsapp/v0/`. This preserves internal import `../ingress-transaction-v0.cjs`.
DO NOT import original repository root `wrangler.jsonc`, `worker/`, `public/`, `pitsquad/`, live Supabase credentials, frontend assets, `flat-resonance-09ba`, or the separate CRM repository `pitswal-v2`.

## Worker config
`ferramentas/external-calc-whatsapp/v0/cloudflare/wrangler.json`:
- name: `pitstop-connect-hub-staging`
- entry: `./connect-hub-worker.mjs`
- Hyperdrive: `HYPERDRIVE` id `6a35651fc97f4a34b0850fbc9abc0de7`
- compatibility flag `nodejs_compat`
- **Worker root / build root**: `ferramentas/external-calc-whatsapp/v0/cloudflare`.
- install: `npm ci` only after committing a lockfile, else `npm install` to generate reviewed lockfile. Deploy from directory: `npx wrangler deploy --config wrangler.json`.
- Disable automatic production deployment until an isolated Worker deploy is inspected; no GitHub Actions billing assumed.
- `PCH_STAGING_INGRESS_ENABLED` absent/false by default.

## Secrets and staging configuration
In dedicated Worker only: `META_APP_SECRET`, `META_VERIFY_TOKEN`, `PCH_ORIGINAL_AES256_KEY` (64 hex chars).
Staging receiver/sender/provider and tenant names must be fixed **server-side** before enabling.
Do not commit passwords, direct Neon connection strings, Cloudflare tokens, commercial phone numbers, or app secrets. Do not put any actual secret in README or workflow logs.
The current Hyperdrive config was created under the same Cloudflare account and points to the isolated Neon staging database. Its existence does not establish a successful Worker query.

## Hard blockers before enablement
1. Test the exact standalone source and Cloudflare build/bundle without touching the live Worker.
2. Deploy only isolated staging Worker, leave Meta callback unregistered and ingress flag off. Check GET challenge and HMAC-negative POST.
3. Configure secrets, verify role A through Hyperdrive, and prove encrypted original can be written and recovered with RLS tenant B negative reads.
4. Ensure business-content consumer can securely retrieve a supplier offer; this remains NOT PROVEN.
5. Verify retry/multi-message Meta batches and outbox consumer semantics before any active sandbox intake.
6. Production and commercial WhatsApp number require separate authorization.

## GitHub Cloudflare UI handoff
At Cloudflare Workers Create app, choose GitHub ONLY after the private destination repo exists; pick destination repo, not `pitwall--nucleo` or `pitswal-v2`. Check build root and `wrangler.json` before deployment. Keep the source PR as immutable evidence, do not merge/deploy legacy code accidentally.

## Current evidence
Neon RLS tenant A/B and SQL-backed atomic transactions were previously demonstrated in isolated staging. Transaction mock 8/8 passed. The standalone Worker’s real Hyperdrive deployment and Meta callback are NOT RUN.
