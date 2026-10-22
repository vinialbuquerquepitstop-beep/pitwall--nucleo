#!/usr/bin/env node
// VS5.3i: static rejection oracle ONLY; no PostgreSQL execution, JWT or network.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const source=readFileSync(new URL('./VS53I_SOURCE_STORAGE_STAGING_CANDIDATE.sql',import.meta.url),'utf8');
function check(input){
 const s=input.toLowerCase();
 const sourceMarker='create policy extcalc_original_tenant_owner_select_v0';
 const eventMarker='create policy extcalc_original_events_tenant_owner_select_v0';
 const viewMarker='create view public.extcalc_original_source_probe_v0';
 const viewEnd='from privado.extcalc_original_source_v0 src;';
 if(!s.includes(sourceMarker)||!s.includes(eventMarker)||!s.includes(viewMarker)||!s.includes(viewEnd))return false;
 const own=s.split(sourceMarker)[1].split(eventMarker)[0];
 const ev=s.split(eventMarker)[1].split('-- no authenticated/anon write grants')[0];
 const view=s.split(viewMarker)[1].split(viewEnd)[0];
 const names=['extcalc_staging_tenant_v0','extcalc_staging_membership_v0',
  'extcalc_original_source_v0','extcalc_original_source_state_event_v0'];
 return (
  s.includes('unapproved, not a migration') &&
  s.includes('create schema if not exists privado') &&
  names.every(t=>s.includes('create table privado.'+t)) &&
  names.every(t=>s.includes('alter table privado.'+t+' enable row level security;') &&
   s.includes('alter table privado.'+t+' force row level security;') &&
   s.includes('revoke all on privado.'+t+' from public, anon, authenticated;')) &&
  s.includes('user_id uuid primary key references auth.users(id)') &&
  s.includes('tenant_id uuid not null references privado.extcalc_staging_tenant_v0(tenant_id)') &&
  s.includes('member_role text not null check (member_role = \'dono\')') &&
  s.includes('using (user_id = (select auth.uid()) and active is true);') &&
  s.includes('grant select on privado.extcalc_staging_membership_v0 to authenticated;') &&
  s.includes('grant usage on schema privado to authenticated;') &&
  s.includes('content_bytes bytea not null') &&
  /content_sha256 text generated always as\s*\(/.test(s) &&
  s.includes('extensions.digest(content_bytes,') &&
  s.includes('primary key (tenant_id, source_ref)') &&
  s.includes('foreign key (tenant_id, source_ref)') &&
  s.includes('create function privado.extcalc_original_source_reject_mutation_v0()') &&
  s.includes('before update or delete on privado.extcalc_original_source_v0') &&
  s.includes('before update or delete on privado.extcalc_original_source_state_event_v0') &&
  [own,ev].every(block=>block.includes('for select to authenticated') &&
   block.includes('(select auth.uid()) is not null') &&
   block.includes('m.user_id = (select auth.uid())') &&
   block.includes('m.member_role = \'dono\' and m.active is true')) &&
  own.includes('m.tenant_id = privado.extcalc_original_source_v0.tenant_id') &&
  ev.includes('m.tenant_id = privado.extcalc_original_source_state_event_v0.tenant_id') &&
  !/privado\.fn_(tenant|papel)_atual/.test(s) &&
  s.includes('with (security_invoker = true) as') &&
  s.includes('grant select on public.extcalc_original_source_probe_v0 to authenticated;') &&
  s.includes('revoke all on public.extcalc_original_source_probe_v0') &&
  view.includes('src.content_sha256') &&
  !/\bsrc\.(content_bytes|filename|created_by)\b/.test(view) &&
  !/create policy[\s\S]{0,100}for (insert|update|delete) to authenticated/.test(s) &&
  !/grant (insert|update|delete)/.test(s) &&
  !/create (table|view) public\.extcalc_original_source_v0/.test(s) &&
  !/security definer/.test(s)
 );
}
let checks=0;
function test(name,change,expected=false){
 assert.equal(check(change),expected,'Static guard failed: '+name);
 console.log('VS53I_OK '+(++checks)+' '+name);
}
test('staging candidate structures and explicit RLS predicates exist',source,true);
test('reject public raw bytes table',source+'\ncreate table public.extcalc_original_source_v0(content_bytes bytea);');
test('reject original bytes in view',source.replace('  src.content_sha256\nfrom privado.extcalc_original_source_v0 src;',
 '  src.content_sha256, src.content_bytes\nfrom privado.extcalc_original_source_v0 src;'));
test('reject removal of FORCE RLS on source',source.replace('alter table privado.extcalc_original_source_v0 force row level security;',''));
test('reject removal of FORCE RLS on membership',source.replace('alter table privado.extcalc_staging_membership_v0 force row level security;',''));
test('reject authenticated INSERT grant',source+'\ngrant insert on privado.extcalc_original_source_v0 to authenticated;');
test('reject removal of source mutation trigger',source.replace('before update or delete on privado.extcalc_original_source_v0','before insert on privado.extcalc_original_source_v0'));
test('reject removal of audit event mutation trigger',source.replace('before update or delete on privado.extcalc_original_source_state_event_v0','before insert on privado.extcalc_original_source_state_event_v0'));
test('reject membership policy without auth.uid',source.replace('using (user_id = (select auth.uid()) and active is true);','using (active is true);'));
test('reject tautological tenant comparison on source',source.replace('m.tenant_id = privado.extcalc_original_source_v0.tenant_id','m.tenant_id = m.tenant_id'));
test('reject tautological tenant comparison on events',source.replace('m.tenant_id = privado.extcalc_original_source_state_event_v0.tenant_id','m.tenant_id = m.tenant_id'));
test('reject role-agnostic source policy',source.replaceAll("m.member_role = 'dono' and m.active is true",'m.active is true'));
test('reject unscoped identity membership',source.replace('user_id uuid primary key references auth.users(id)','user_id uuid primary key'));
test('reject privileged definer function',source.replace('returns trigger language plpgsql security invoker','returns trigger language plpgsql security definer'));
test('reject missing security_invoker view',source.replace('with (security_invoker = true) as','as'));
console.log('EXTERNAL_CALC_VS53I_SQL_CANDIDATE_STATIC=PASS checks='+checks+' postgres=NOT_RUN production=NO_GO');
