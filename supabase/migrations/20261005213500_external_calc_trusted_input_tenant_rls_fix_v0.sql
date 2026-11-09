alter table public.extcalc_trusted_input_sources enable row level security;
alter table public.extcalc_trusted_input_originals enable row level security;

drop policy if exists extcalc_trusted_input_sources_tenant on public.extcalc_trusted_input_sources;
create policy extcalc_trusted_input_sources_tenant on public.extcalc_trusted_input_sources for select to authenticated using (tenant_id = privado.fn_tenant_atual());

drop policy if exists extcalc_trusted_input_originals_tenant on public.extcalc_trusted_input_originals;
create policy extcalc_trusted_input_originals_tenant on public.extcalc_trusted_input_originals for select to authenticated using (tenant_id = privado.fn_tenant_atual());

revoke all on public.extcalc_trusted_input_sources from public, anon;
revoke all on public.extcalc_trusted_input_originals from public, anon;
grant select on public.extcalc_trusted_input_sources to authenticated;
grant select on public.extcalc_trusted_input_originals to authenticated;
