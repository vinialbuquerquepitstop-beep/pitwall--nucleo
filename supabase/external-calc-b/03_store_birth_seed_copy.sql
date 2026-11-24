-- EXTERNAL CALC B | 03 store birth: copy the seed catalog to each store (EC-01, 2026-11-24).
-- Núcleo decision D5 (07/09/2026): rows with tenant_id NULL are the SEED, "copied once at the birth of each account and
-- NEVER read at runtime"; rows with tenant_id are that store's catalog and the store maintains them. The copy step was
-- never written (the Núcleo had a single store). This adds it:
--  * privado.extcalc_store_birth_v1(tenant) copies seed models, colors, aliases and rules (origem 'semente');
--  * runs automatically when a store (public.tenant) is created, and once now for the stores that already exist;
--  * idempotent (on conflict do nothing per the tenant-scoped unique keys): never overwrites what the store learned.
-- Suppliers are never seeded: each store teaches its own.

create or replace function privado.extcalc_store_birth_v1(p_tenant uuid) returns jsonb
language plpgsql security definer set search_path to '' as $$
declare v_m int; v_c int; v_a int; v_r int;
begin
 if p_tenant is null or not exists (select 1 from public.tenant where id = p_tenant) then
  raise exception 'extcalc_store_birth: loja inexistente';
 end if;
 insert into public.calc_modelo(tenant_id, codigo, nome, categoria, ativo, origem)
 select p_tenant, s.codigo, s.nome, s.categoria, s.ativo, 'semente' from public.calc_modelo s where s.tenant_id is null
 on conflict do nothing;
 get diagnostics v_m = row_count;
 insert into public.calc_cor(tenant_id, codigo, nome, hex, ativo)
 select p_tenant, s.codigo, s.nome, s.hex, s.ativo from public.calc_cor s where s.tenant_id is null
 on conflict do nothing;
 get diagnostics v_c = row_count;
 insert into public.calc_alias(tenant_id, tipo, texto, aponta, origem)
 select p_tenant, s.tipo, s.texto, s.aponta, 'semente' from public.calc_alias s
  where s.tenant_id is null and s.tipo <> 'fornecedor'
 on conflict do nothing;
 get diagnostics v_a = row_count;
 insert into public.calc_regra(tenant_id, tipo, padrao, acao, valor, prioridade, motivo, ativo, origem)
 select p_tenant, s.tipo, s.padrao, s.acao, s.valor, s.prioridade, s.motivo, s.ativo, 'semente' from public.calc_regra s
  where s.tenant_id is null
 on conflict do nothing;
 get diagnostics v_r = row_count;
 return pg_catalog.jsonb_build_object('modelos', v_m, 'cores', v_c, 'apelidos', v_a, 'regras', v_r);
end $$;
revoke all on function privado.extcalc_store_birth_v1(uuid) from public, anon, authenticated;

create or replace function privado.extcalc_store_birth_trg_v1() returns trigger
language plpgsql security definer set search_path to '' as $$
begin perform privado.extcalc_store_birth_v1(new.id); return new; end $$;
revoke all on function privado.extcalc_store_birth_trg_v1() from public, anon, authenticated;
drop trigger if exists extcalc_store_birth_v1 on public.tenant;
create trigger extcalc_store_birth_v1 after insert on public.tenant
 for each row execute function privado.extcalc_store_birth_trg_v1();

select privado.extcalc_store_birth_v1(t.id) from public.tenant t;
