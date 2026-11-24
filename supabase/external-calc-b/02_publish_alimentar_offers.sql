-- EXTERNAL CALC B | 02 Alimentar -> product offers (EC-01, 2026-11-24).
-- The product API (sales simulation, trade-in, offers, Home radar, tracked models) reads CURRENT VALID revisions of
-- public.extcalc_offer_revision. Until now those came only from the F1 interpreter (NO_GO). This publishes the
-- store's APPROVED price table (public.calc_dados, written only by calc_carga_aprovar) as product offers:
--  * one analysis per approved table ('alimentar:' || md5 of the table), source_id 'calc_dados';
--  * one offer per model x capacity x color x condition x supplier, price = the approved value in BRL;
--  * offers of the previous approved table move to freshness 'SUPERSEDED' (history keeps them);
--  * same tenant only; runs as a trigger, so no client can publish prices without an approved load.
-- Idempotent: re-approving an identical table changes nothing.

create or replace function privado.extcalc_alimentar_capacity_gb(p_nome text) returns integer
language sql immutable set search_path to '' as $$
 select case when m[2] ilike 'TB' then (m[1])::int * 1024 else (m[1])::int end
   from (select pg_catalog.regexp_match(p_nome, '(\d+)\s*(GB|TB)\M', 'i') as m) s
  where m is not null
$$;
create or replace function privado.extcalc_alimentar_model_label(p_nome text) returns text
language sql immutable set search_path to '' as $$
 select pg_catalog.btrim(pg_catalog.regexp_replace(pg_catalog.regexp_replace(p_nome, '\s*\d+\s*(GB|TB)\M', '', 'i'), '\s+', ' ', 'g'))
$$;
create or replace function privado.extcalc_alimentar_slug(p text) returns text
language sql immutable set search_path to '' as $$
 select pg_catalog.btrim(pg_catalog.regexp_replace(pg_catalog.lower(pg_catalog.translate(p,
  'áàâãäéèêëíìîïóòôõöúùûüçñªº','aaaaaeeeeiiiiooooouuuucnao')), '[^a-z0-9]+', '_', 'g'), '_')
$$;

create or replace function privado.extcalc_publish_calc_dados_v1(p_tenant uuid, p_dados jsonb) returns integer
language plpgsql security definer set search_path to '' as $$
declare
 v_analysis text := 'alimentar:' || pg_catalog.md5(p_dados::text);
 v_n integer := 0;
begin
 if p_tenant is null or p_dados is null then return 0; end if;
 if exists (select 1 from public.extcalc_analysis where tenant_id = p_tenant and analysis_id = v_analysis) then
  return 0; -- same approved table already published
 end if;

 -- Previous Alimentar offers stop being current (F1 offers, if any, are left as they are).
 update public.extcalc_offer_revision r set freshness_status = 'SUPERSEDED'
  from public.extcalc_offer o
  where o.tenant_id = r.tenant_id and o.analysis_id = r.analysis_id and o.offer_id = r.offer_id
    and o.source_id = 'calc_dados' and r.tenant_id = p_tenant and r.freshness_status = 'CURRENT';

 insert into public.extcalc_analysis(tenant_id, analysis_id) values (p_tenant, v_analysis);

 with linhas as (
  select p->>'n' as nome, p->>'c' as categoria, nullif(pg_catalog.btrim(p->>'t'), '') as condicao,
         pg_catalog.btrim(p->>'f') as fornecedor, p->>'l' as praca,
         nullif(pg_catalog.btrim(c->>'n'), '') as cor, coalesce(c->>'v', p->>'v') as valor
    from pg_catalog.jsonb_array_elements(coalesce(p_dados->'produtos', '[]'::jsonb)) p
    left join lateral pg_catalog.jsonb_array_elements(case when pg_catalog.jsonb_typeof(p->'cs') = 'array' then p->'cs' else '[]'::jsonb end) c on true
   where (p ? 'v' and not (p ? 'cs')) or c is not null
 ), ofertas as (
  select distinct on (oid)
         l.*, privado.extcalc_alimentar_model_label(l.nome) as rotulo,
         privado.extcalc_alimentar_capacity_gb(l.nome) as cap,
         privado.extcalc_alimentar_slug(privado.extcalc_alimentar_model_label(l.nome)) as model_id,
         pg_catalog.round((l.valor)::numeric * 100)::bigint as centavos,
         pg_catalog.md5(pg_catalog.concat_ws('|', privado.extcalc_alimentar_slug(privado.extcalc_alimentar_model_label(l.nome)),
           privado.extcalc_alimentar_capacity_gb(l.nome), pg_catalog.lower(l.cor), pg_catalog.lower(l.condicao), pg_catalog.lower(l.fornecedor))) as oid
    from linhas l
   where l.valor ~ '^[0-9]+(\.[0-9]+)?$' and (l.valor)::numeric > 0 and l.fornecedor <> '' and l.nome is not null
   order by oid, (l.valor)::numeric asc
 ), ins_offer as (
  insert into public.extcalc_offer(tenant_id, analysis_id, offer_id, source_id)
  select p_tenant, v_analysis, o.oid, 'calc_dados' from ofertas o
  returning offer_id
 )
 insert into public.extcalc_offer_revision(tenant_id, analysis_id, offer_id, offer_revision, c01_contract_version, c01_snapshot,
   offer_identity_fingerprint, offer_value_fingerprint, domain_outcome, freshness_status)
 select p_tenant, v_analysis, o.oid, 1, 'alimentar-publish/v1',
   pg_catalog.jsonb_build_object(
    'execution_status', 'SUCCEEDED', 'domain_outcome', 'VALID', 'freshness_status', 'CURRENT', 'source', 'alimentar',
    'analysis_id', v_analysis, 'offer_id', o.oid, 'offer_revision', 1,
    'offer_identity_fingerprint', o.oid, 'offer_value_fingerprint', pg_catalog.md5(o.oid || ':' || o.centavos),
    'reviewed_offer', pg_catalog.jsonb_build_object(
      'model', pg_catalog.jsonb_build_object('id', o.model_id, 'label', o.rotulo,
         'attributes', pg_catalog.jsonb_build_object('display_label', o.rotulo, 'category', o.categoria)),
      'supplier_id', o.fornecedor, 'supplier_region', o.praca, 'capacity_gb', o.cap, 'color', o.cor,
      'condition', o.condicao, 'availability', true,
      'price', pg_catalog.jsonb_build_object('amount_minor', o.centavos, 'currency', 'BRL'))),
   o.oid, pg_catalog.md5(o.oid || ':' || o.centavos), 'VALID', 'CURRENT'
  from ofertas o join ins_offer i on i.offer_id = o.oid;
 get diagnostics v_n = row_count;
 return v_n;
end $$;
revoke all on function privado.extcalc_publish_calc_dados_v1(uuid, jsonb) from public, anon, authenticated;
revoke all on function privado.extcalc_alimentar_capacity_gb(text), privado.extcalc_alimentar_model_label(text),
 privado.extcalc_alimentar_slug(text) from public, anon;

create or replace function privado.extcalc_calc_dados_publish_trg_v1() returns trigger
language plpgsql security definer set search_path to '' as $$
begin
 perform privado.extcalc_publish_calc_dados_v1(new.tenant_id, new.dados);
 return new;
end $$;
revoke all on function privado.extcalc_calc_dados_publish_trg_v1() from public, anon, authenticated;
drop trigger if exists extcalc_calc_dados_publish_v1 on public.calc_dados;
create trigger extcalc_calc_dados_publish_v1 after insert or update of dados on public.calc_dados
 for each row execute function privado.extcalc_calc_dados_publish_trg_v1();
