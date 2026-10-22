-- External Calc VS5.3L -- staging-only C01 graph, phase 1 of 2.
-- TARGET EXACTLY: PitswallV2 external-calc-staging ref mfsshvckclnmftpaprxk.
-- NEVER run on production; NEVER use this to infer productive migrations.
-- DEPENDENCIES: VS5.3i staging membership, immutable original-source tables, Auth users A/B.
-- Do not apply before a real catalog preflight and change approval.
-- After applying this proposal, execute the *existing exact* guard SQL
-- ferramentas/external-calc-list-intake/v0/GATE1_DB_AUTO_PROMOTION_GUARD_DRAFT.sql
-- from PR #179, not a competing copy. Validate guard before any real use.

begin;

-- Block accidental running outside the dedicated staging Supabase DB. This
-- distinguishes the staging SOURCE bootstrap from a populated production DB.
do $scope$
begin
 if to_regclass('privado.extcalc_original_source_v0') is null
    or to_regclass('privado.extcalc_staging_membership_v0') is null
    or to_regclass('public.extcalc_offer_revision') is not null
    or to_regclass('public.extcalc_review_candidate') is not null
    or (select count(*) from privado.extcalc_staging_tenant_v0) <> 2
 then
   raise exception 'EXTCALC_C01_STAGING_PRECONDITION_FAILED';
 end if;
end $scope$;

create table public.extcalc_supplier(
 tenant_id uuid not null references privado.extcalc_staging_tenant_v0(tenant_id),
 supplier_id uuid not null,
 name text not null check(length(btrim(name)) between 1 and 100),
 primary key(tenant_id,supplier_id)
);
create table public.extcalc_source_supplier(
 tenant_id uuid not null,
 source_id text not null,
 supplier_id uuid not null,
 primary key(tenant_id,source_id),
 foreign key(tenant_id,source_id) references privado.extcalc_original_source_v0(tenant_id,source_ref),
 foreign key(tenant_id,supplier_id) references public.extcalc_supplier(tenant_id,supplier_id)
);
create table public.extcalc_analysis(
 tenant_id uuid not null references privado.extcalc_staging_tenant_v0(tenant_id),
 analysis_id text not null check(length(analysis_id) between 3 and 160),
 primary key(tenant_id,analysis_id)
);
create table public.extcalc_offer(
 tenant_id uuid not null,analysis_id text not null,offer_id text not null,source_id text not null,
 primary key(tenant_id,analysis_id,offer_id),
 foreign key(tenant_id,analysis_id) references public.extcalc_analysis(tenant_id,analysis_id),
 foreign key(tenant_id,source_id) references public.extcalc_source_supplier(tenant_id,source_id)
);
create table public.extcalc_review_candidate(
 tenant_id uuid not null,analysis_id text not null,offer_id text not null,
 offer_revision integer not null check(offer_revision>0),
 candidate_snapshot jsonb not null,
 primary key(tenant_id,analysis_id,offer_id,offer_revision),
 foreign key(tenant_id,analysis_id,offer_id) references public.extcalc_offer(tenant_id,analysis_id,offer_id)
);
create table public.extcalc_offer_revision(
 tenant_id uuid not null,analysis_id text not null,offer_id text not null,
 offer_revision integer not null check(offer_revision>0),
 c01_contract_version text not null,c01_snapshot jsonb not null,
 offer_identity_fingerprint text not null,offer_value_fingerprint text not null,
 domain_outcome text not null check(domain_outcome='VALID'),
 freshness_status text not null check(freshness_status='CURRENT'),
 primary key(tenant_id,analysis_id,offer_id,offer_revision),
 foreign key(tenant_id,analysis_id,offer_id,offer_revision)
  references public.extcalc_review_candidate(tenant_id,analysis_id,offer_id,offer_revision)
);

-- Explicit RLS per table; no blanket policy that only checks authenticated role.
-- No raw candidate_snapshot or C01 snapshots are granted for arbitrary direct SELECT.
alter table public.extcalc_supplier enable row level security;
alter table public.extcalc_supplier force row level security;
alter table public.extcalc_source_supplier enable row level security;
alter table public.extcalc_source_supplier force row level security;
alter table public.extcalc_analysis enable row level security;
alter table public.extcalc_analysis force row level security;
alter table public.extcalc_offer enable row level security;
alter table public.extcalc_offer force row level security;
alter table public.extcalc_review_candidate enable row level security;
alter table public.extcalc_review_candidate force row level security;
alter table public.extcalc_offer_revision enable row level security;
alter table public.extcalc_offer_revision force row level security;

do $rls$ declare n text;
begin
 foreach n in array array[
  'extcalc_supplier','extcalc_source_supplier','extcalc_analysis',
  'extcalc_offer','extcalc_review_candidate','extcalc_offer_revision'
 ] loop
  execute format('revoke all on table public.%I from public, anon, authenticated',n);
  execute format(
   'create policy stage_c01_owner_read on public.%I for select to authenticated '
   || 'using (exists (select 1 from privado.extcalc_staging_membership_v0 m '
   || 'where m.user_id = (select auth.uid()) and m.tenant_id = public.%I.tenant_id '
   || 'and m.member_role = ''dono'' and m.active is true))',n,n);
 end loop;
end $rls$;
-- Only allow non-sensitive identity columns to be returned by direct Data API.
grant select(tenant_id,supplier_id,name) on public.extcalc_supplier to authenticated;
grant select(tenant_id,source_id,supplier_id) on public.extcalc_source_supplier to authenticated;
grant select(tenant_id,analysis_id) on public.extcalc_analysis to authenticated;
grant select(tenant_id,analysis_id,offer_id,source_id) on public.extcalc_offer to authenticated;
grant select(tenant_id,analysis_id,offer_id,offer_revision) on public.extcalc_review_candidate to authenticated;
grant select(tenant_id,analysis_id,offer_id,offer_revision) on public.extcalc_offer_revision to authenticated;

-- Tenant/role originate from SERVER membership, never user_metadata or tenant payload.
-- These helpers are not exposed through public or anon grants.
create function privado.fn_tenant_atual() returns uuid language sql stable security definer
 set search_path = '' as $t$
 select m.tenant_id from privado.extcalc_staging_membership_v0 m
 where m.user_id=auth.uid() and m.active is true and m.member_role='dono' limit 1
 $t$;
create function privado.fn_papel_atual() returns text language sql stable security definer
 set search_path = '' as $p$
 select m.member_role from privado.extcalc_staging_membership_v0 m
 where m.user_id=auth.uid() and m.active is true limit 1
 $p$;
revoke all on function privado.fn_tenant_atual() from public,anon;
revoke all on function privado.fn_papel_atual() from public,anon;
grant execute on function privado.fn_tenant_atual() to authenticated;
grant execute on function privado.fn_papel_atual() to authenticated;

-- ONLY source linking, no automatic promotion. Returns receipt used by intake.
create function public.extcalc_bind_source_supplier_v0(p_source_id text,p_supplier_id uuid)
returns jsonb language plpgsql security definer set search_path='' as $fn$
declare t uuid; bound uuid;
begin
 t:=privado.fn_tenant_atual();
 if auth.uid() is null or t is null or privado.fn_papel_atual() is distinct from 'dono' then
  raise exception using errcode='42501',message='C01_STAGING_UNAUTHORIZED'; end if;
 if p_source_id is null or p_supplier_id is null then
  raise exception 'C01_STAGING_BIND_INVALID';end if;
 if not exists(
  select 1 from privado.extcalc_original_source_v0 s
  where s.tenant_id=t and s.source_ref=p_source_id
  and not exists(select 1 from privado.extcalc_original_source_state_event_v0 ev
    where ev.tenant_id=t and ev.source_ref=p_source_id and ev.event_type in ('QUARANTINED','REVOKED'))
 ) then raise exception 'C01_STAGING_SOURCE_UNAVAILABLE';end if;
 if not exists(select 1 from public.extcalc_supplier s where s.tenant_id=t and s.supplier_id=p_supplier_id)
 then raise exception 'C01_STAGING_SUPPLIER_UNKNOWN';end if;
 insert into public.extcalc_source_supplier(tenant_id,source_id,supplier_id)
 values(t,p_source_id,p_supplier_id) on conflict(tenant_id,source_id) do nothing;
 select ss.supplier_id into bound from public.extcalc_source_supplier ss
 where ss.tenant_id=t and ss.source_id=p_source_id;
 if bound is distinct from p_supplier_id then raise exception 'C01_STAGING_SUPPLIER_CONFLICT';end if;
 return pg_catalog.jsonb_build_object('ok',true,'source_id',p_source_id,'supplier_id',p_supplier_id);
end $fn$;
revoke all on function public.extcalc_bind_source_supplier_v0(text,uuid) from public,anon;
grant execute on function public.extcalc_bind_source_supplier_v0(text,uuid) to authenticated;

-- Persist a review candidate only after verifying line evidence independently
-- against the ORIGINAL SOURCE bytes stored in PostgreSQL, not a client string.
create function public.extcalc_persist_review_candidate_v0(p_candidate jsonb)
returns jsonb language plpgsql security definer set search_path='' as $fn$
declare
 t uuid; a text; o text; src text; rev integer; bound_supplier uuid;
 existing jsonb; source_text text; content_lines text[];
 source_line jsonb; line_no integer; line_raw text;
 fld text; ref_str text; refs jsonb; linked_line integer;
 amount bigint; money_matches text[]; money_text text; currency_text text;
 model_line integer; price_line integer; model_present boolean:=false; price_present boolean:=false;
begin
 t:=privado.fn_tenant_atual();
 if auth.uid() is null or t is null or privado.fn_papel_atual() is distinct from 'dono' then
  raise exception using errcode='42501',message='C01_STAGING_UNAUTHORIZED';end if;
 if p_candidate is null or pg_catalog.jsonb_typeof(p_candidate) is distinct from 'object' then
  raise exception 'C01_STAGING_CANDIDATE_INVALID';end if;
 a:=nullif(p_candidate->>'analysis_id','');
 o:=nullif(p_candidate->>'offer_id','');
 src:=nullif(p_candidate->>'source_id','');
 rev:=nullif(p_candidate->>'offer_revision','')::integer;
 if a is null or o is null or src is null or rev is null or rev<1 then
  raise exception 'C01_STAGING_IDENTITY_INVALID';end if;
 if p_candidate->>'contract_version' is distinct from 'external-calc-c01-readonly/v1'
 or p_candidate->>'execution_status' is distinct from 'SUCCEEDED'
 or p_candidate->>'freshness_status' is distinct from 'CURRENT'
 or p_candidate->>'domain_outcome' is distinct from 'REVIEW_REQUIRED'
 or p_candidate->>'stage' is distinct from 'REVIEW' then
  raise exception 'C01_STAGING_CANDIDATE_STATE_INVALID';end if;
 if nullif(p_candidate->>'offer_identity_fingerprint','') is null
 or nullif(p_candidate->>'offer_value_fingerprint','') is null
 or nullif(p_candidate->>'interpretation_run_id','') is null then
  raise exception 'C01_STAGING_FINGERPRINT_MISSING';end if;
 select ss.supplier_id into bound_supplier from public.extcalc_source_supplier ss
 where ss.tenant_id=t and ss.source_id=src;
 if not found then raise exception 'C01_STAGING_SOURCE_UNBOUND';end if;
 if nullif(p_candidate#>>'{interpreted_offer,supplier_id}','')::uuid is distinct from bound_supplier then
  raise exception 'C01_STAGING_SUPPLIER_MISMATCH';end if;
 if exists(select 1 from privado.extcalc_original_source_state_event_v0 ev
  where ev.tenant_id=t and ev.source_ref=src and ev.event_type in ('QUARANTINED','REVOKED')) then
  raise exception 'C01_STAGING_SOURCE_UNAVAILABLE';end if;
 select pg_catalog.convert_from(s.content_bytes,'UTF8') into source_text
 from privado.extcalc_original_source_v0 s where s.tenant_id=t and s.source_ref=src;
 if not found then raise exception 'C01_STAGING_SOURCE_MISSING';end if;
 content_lines:=pg_catalog.string_to_array(pg_catalog.replace(source_text,E'\r\n',E'\n'),E'\n');
 if pg_catalog.jsonb_typeof(p_candidate#>'{review_evidence,source_lines}') is distinct from 'array' then
  raise exception 'C01_STAGING_SOURCE_LINES_MISSING';end if;
 for source_line in select value from pg_catalog.jsonb_array_elements(p_candidate#>'{review_evidence,source_lines}') loop
  line_no:=nullif(source_line->>'line_number','')::integer;
  line_raw:=source_line->>'raw';
  if line_no is null or line_no<1 or line_no>pg_catalog.array_length(content_lines,1)
   or line_raw is distinct from content_lines[line_no] then
   raise exception 'C01_STAGING_LINE_NOT_IN_ORIGINAL';end if;
 end loop;
 amount:=nullif(p_candidate#>>'{interpreted_offer,price,amount_minor}','')::bigint;
 if amount is null or amount<=0
 or p_candidate#>>'{interpreted_offer,price,currency}' is distinct from 'BRL'
 or nullif(p_candidate#>>'{interpreted_offer,model,id}','') is null
 or nullif(p_candidate#>>'{interpreted_offer,model,label}','') is null then
  raise exception 'C01_STAGING_OFFER_INVALID';end if;
 foreach fld in array array['model','price'] loop
  refs:=p_candidate#>array['review_evidence','field_sources',fld];
  if pg_catalog.jsonb_typeof(refs) is distinct from 'array'
   or pg_catalog.jsonb_array_length(refs)=0 then
   raise exception 'C01_STAGING_FIELD_PROVENANCE_MISSING';end if;
  for ref_str in select value from pg_catalog.jsonb_array_elements_text(refs) loop
   linked_line:=ref_str::integer;
   if not exists(
    select 1 from pg_catalog.jsonb_array_elements(p_candidate#>'{review_evidence,source_lines}') x
    where (x.value->>'line_number')::integer=linked_line) then
    raise exception 'C01_STAGING_FIELD_LINE_UNVERIFIED';end if;
   if linked_line<1 or linked_line>pg_catalog.array_length(content_lines,1) then
    raise exception 'C01_STAGING_FIELD_LINE_OUT_OF_RANGE';end if;
   line_raw:=content_lines[linked_line];
   if fld='model' then
     if pg_catalog.strpos(pg_catalog.lower(line_raw),
       pg_catalog.lower(p_candidate#>>'{interpreted_offer,model,label}'))=0 then raise exception 'C01_STAGING_MODEL_UNVERIFIED';end if;
     model_present:=true;
     model_line:=linked_line;
   else
     -- Single monetary token, exact BRL amount, never multi-price scope.
     select array_agg((z.match)[1]) into money_matches from
      pg_catalog.regexp_matches(line_raw,'R\$\s*([0-9][0-9.,]*)','g') as z(match);
     if coalesce(pg_catalog.array_length(money_matches,1),0)<>1 then
      raise exception 'C01_STAGING_PRICE_SCOPE_AMBIGUOUS';end if;
     money_text:=money_matches[1];
     if money_text !~ '^[0-9]{1,3}(\.[0-9]{3})*(,[0-9]{2})?$'
       and money_text !~ '^[0-9]+(,[0-9]{2})?$' then
       raise exception 'C01_STAGING_PRICE_FORMAT_INVALID';end if;
     if (pg_catalog.replace(pg_catalog.replace(money_text,'.',''),',','.')::numeric * 100)::bigint
        is distinct from amount then raise exception 'C01_STAGING_PRICE_UNVERIFIED';end if;
     price_present:=true;
     price_line:=linked_line;
   end if;
  end loop;
 end loop;
 if not model_present or not price_present then
  raise exception 'C01_STAGING_PROVENANCE_INCOMPLETE';end if;
 -- Staging conservative constraint; multi-line complex cases require review,
 -- not silent auto-promotion (no header-crossing between these adjacent lines).
 if price_line<model_line or price_line>model_line+1 then
  raise exception 'C01_STAGING_PRICE_MODEL_SCOPE_UNVERIFIED';end if;
 insert into public.extcalc_analysis(tenant_id,analysis_id) values(t,a)
 on conflict(tenant_id,analysis_id) do nothing;
 insert into public.extcalc_offer(tenant_id,analysis_id,offer_id,source_id) values(t,a,o,src)
 on conflict(tenant_id,analysis_id,offer_id) do nothing;
 if not exists(select 1 from public.extcalc_offer offer
 where offer.tenant_id=t and offer.analysis_id=a and offer.offer_id=o and offer.source_id=src) then
  raise exception 'C01_STAGING_OFFER_SOURCE_CONFLICT';end if;
 select c.candidate_snapshot into existing from public.extcalc_review_candidate c
 where c.tenant_id=t and c.analysis_id=a and c.offer_id=o and c.offer_revision=rev;
 if found then
  if existing is distinct from p_candidate then raise exception 'C01_STAGING_CANDIDATE_CONFLICT';end if;
  return pg_catalog.jsonb_build_object('ok',true,'idempotent',true,'analysis_id',a,'offer_id',o,'offer_revision',rev);
 end if;
 insert into public.extcalc_review_candidate(tenant_id,analysis_id,offer_id,offer_revision,candidate_snapshot)
 values(t,a,o,rev,p_candidate);
 return pg_catalog.jsonb_build_object('ok',true,'idempotent',false,'analysis_id',a,'offer_id',o,'offer_revision',rev);
end $fn$;
revoke all on function public.extcalc_persist_review_candidate_v0(jsonb) from public,anon;
grant execute on function public.extcalc_persist_review_candidate_v0(jsonb) to authenticated;

-- Immutable C01 snapshots are append-only. Quarantine/revocation also blocks
-- an already-persisted candidate from becoming a fresh promoted revision.
create function privado.extcalc_c01_stage_guard_revision_v0() returns trigger
language plpgsql security invoker set search_path='' as $rev$
declare ref text;
begin
 if TG_OP <> 'INSERT' then
  raise exception using errcode='42501',message='C01_STAGE_REVISION_IMMUTABLE';
 end if;
 select o.source_id into ref from public.extcalc_offer o
 where o.tenant_id=NEW.tenant_id and o.analysis_id=NEW.analysis_id and o.offer_id=NEW.offer_id;
 if ref is null or not exists (
  select 1 from privado.extcalc_original_source_v0 s
  where s.tenant_id=NEW.tenant_id and s.source_ref=ref
    and not exists(select 1 from privado.extcalc_original_source_state_event_v0 e
      where e.tenant_id=s.tenant_id and e.source_ref=s.source_ref
       and e.event_type in ('QUARANTINED','REVOKED'))
 ) then raise exception 'C01_STAGE_SOURCE_UNAVAILABLE_ON_PROMOTION';end if;
 return NEW;
end $rev$;
revoke all on function privado.extcalc_c01_stage_guard_revision_v0() from public,anon,authenticated;
create trigger extcalc_c01_revision_protect_v0
before insert or update or delete on public.extcalc_offer_revision
for each row execute function privado.extcalc_c01_stage_guard_revision_v0();

create function privado.extcalc_c01_stage_immutable_candidate_v0() returns trigger
language plpgsql security invoker set search_path='' as $can$
begin
 raise exception using errcode='42501',message='C01_STAGE_CANDIDATE_IMMUTABLE';
end $can$;
revoke all on function privado.extcalc_c01_stage_immutable_candidate_v0() from public,anon,authenticated;
create trigger extcalc_c01_candidate_immutable_v0
before update or delete on public.extcalc_review_candidate
for each row execute function privado.extcalc_c01_stage_immutable_candidate_v0();

-- PHASE 2 intentionally lives in the existing PR #179 guard. Do not duplicate.
commit;
