-- PITSQUAD Manual Acquisition Intake — grants fix
-- The RPC runs with the caller role, so authenticated needs table privileges
-- in addition to tenant-scoped RLS policies.

grant select, insert on table public.pitsquad_manual_message_event to authenticated;

drop policy if exists pitsquad_manual_message_event_select on public.pitsquad_manual_message_event;
create policy pitsquad_manual_message_event_select
on public.pitsquad_manual_message_event
for select
to authenticated
using (tenant_id = privado.fn_tenant_atual());

drop policy if exists pitsquad_manual_message_event_insert on public.pitsquad_manual_message_event;
create policy pitsquad_manual_message_event_insert
on public.pitsquad_manual_message_event
for insert
to authenticated
with check (tenant_id = privado.fn_tenant_atual());
