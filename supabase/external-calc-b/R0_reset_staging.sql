-- EXTERNAL CALC B | R0 reset of the staging-only objects (owner approval 2026-11-23: "zerar e aplicar").
-- Removes ONLY what the 7 staging migrations created (vs53i, vs53p, f1_*): the extcalc_* tables/functions in public
-- and privado, the staging tenant/membership and the staging identity functions. Never touches auth, storage,
-- extensions or supabase_migrations. Data was exported before (local backup, outside git).
-- Idempotent: safe on a database where some or none of these objects exist.
do $$
declare r record;
begin
 for r in
  select p.oid::regprocedure as sig from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where (n.nspname in ('public','privado') and p.proname like 'extcalc\_%')
     or (n.nspname = 'privado' and p.proname in ('fn_tenant_atual','fn_papel_atual'))
 loop
  execute format('drop function if exists %s cascade', r.sig);
 end loop;
 for r in
  select c.oid::regclass as rel from pg_class c join pg_namespace n on n.oid = c.relnamespace
  where c.relkind in ('r','p') and n.nspname in ('public','privado') and c.relname like 'extcalc\_%'
 loop
  execute format('drop table if exists %s cascade', r.rel);
 end loop;
end $$;
