-- Isolated staging migration. Review before executing; no destructive changes.
CREATE TABLE IF NOT EXISTS public.ingress_originals (
 ingress_event_id uuid PRIMARY KEY REFERENCES public.ingress_events(id) ON DELETE CASCADE,
 ciphertext bytea NOT NULL,
 iv bytea NOT NULL CHECK (octet_length(iv)=12),
 encryption_version text NOT NULL CHECK (encryption_version='aes-256-gcm-v1'),
 created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.ingress_originals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ingress_originals FORCE ROW LEVEL SECURITY;
CREATE POLICY pch_original_tenant ON public.ingress_originals
FOR ALL TO pch_app_a_login,pch_app_b_login
USING (EXISTS (SELECT 1 FROM public.ingress_events e WHERE e.id=ingress_event_id))
WITH CHECK (EXISTS (SELECT 1 FROM public.ingress_events e WHERE e.id=ingress_event_id));
GRANT SELECT,INSERT ON public.ingress_originals TO pch_app_a_login,pch_app_b_login;
-- Do not grant UPDATE/DELETE to ingress roles; retention is a separate privileged workflow.
