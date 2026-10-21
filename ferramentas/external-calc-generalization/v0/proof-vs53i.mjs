#!/usr/bin/env node
// VS5.3i: static structural review ONLY; no SQL execution or network.
// This DOES NOT prove policy behavior, storage, or live RLS.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
const location=fileURLToPath(new URL('./VS53I_SOURCE_STORAGE_STAGING_CANDIDATE.sql',import.meta.url));
const source=readFileSync(location,'utf8');
const lower=source.toLowerCase();
const extract=()=>{
 const mark='create view public.extcalc_original_source_probe_v0';
 const part=lower.split(mark);
 if(part.length!==2)return null;
 const end=part[1].indexOf('from privado.extcalc_original_source_v0 src;');
 if(end<0)return null;
 return part[1].slice(0,end);
};
const check=(candidate)=>{
 const l=candidate.toLowerCase();
 const viewMarker='create view public.extcalc_original_source_probe_v0';
 if(!l.includes(viewMarker))return false;
 const between=l.split(viewMarker)[1].split('from privado.extcalc_original_source_v0 src;')[0];
 return (
  l.includes('unapproved, not a migration') &&
  l.includes('create table privado.extcalc_original_source_v0') &&
  l.includes('create table privado.extcalc_original_source_state_event_v0') &&
  l.includes('content_bytes bytea not null') &&
  /content_sha256 text generated always as\s*\(/.test(l) &&
  l.includes('extensions.digest(content_bytes,') &&
  l.includes('primary key (tenant_id, source_ref)') &&
  l.includes('foreign key (tenant_id, source_ref)') &&
  l.includes('create function privado.extcalc_original_source_reject_mutation_v0()') &&
  l.includes('before update or delete on privado.extcalc_original_source_v0') &&
  l.includes('before update or delete on privado.extcalc_original_source_state_event_v0') &&
  ['extcalc_original_source_v0','extcalc_original_source_state_event_v0'].every(t=>
   l.includes('alter table privado.'+t+' enable row level security;') &&
   l.includes('alter table privado.'+t+' force row level security;') &&
   l.includes('revoke all on privado.'+t+' from public, anon, authenticated;')) &&
  /for select to authenticated\s+using\s*\(\s*auth.uid\(\) is not null\s+and tenant_id = \(select privado.fn_tenant_atual\(\)\)\s+and \(select privado.fn_papel_atual\(\)\) = 'dono'/.test(l) &&
  l.includes('with (security_invoker = true) as') &&
  l.includes('grant select on public.extcalc_original_source_probe_v0 to authenticated;') &&
  l.includes('revoke all on public.extcalc_original_source_probe_v0') &&
  /src\.content_sha256/.test(between) &&
  !/\bsrc\.content_bytes\b|\bsrc\.created_by\b|\bsrc\.filename\b/.test(between) &&
  !/create policy[\s\S]{0,100}for (insert|update|delete) to authenticated/.test(l) &&
  !/grant (insert|update|delete)/.test(l) &&
  !/create (table|view) public\.extcalc_original_source_v0/.test(l)
 );
};
let checks=0;
const test=(name,callback)=>{callback();checks++;console.log('VS53I_OK '+checks+' '+name)};
test('candidate has required private storage and read-only RLS structure',()=>{
 assert(check(source),'VS53I_CANDIDATE_STATIC_STRUCTURE_FAIL');
});
test('a public original bytes table is denied',()=>{
 assert(!check(source+'\ncreate table public.extcalc_original_source_v0(content_bytes bytea);'));
});
test('a view exposing original bytes is denied',()=>{
 assert(!check(source.replace('  src.content_sha256\nfrom privado.extcalc_original_source_v0 src;',
  '  src.content_sha256, src.content_bytes\nfrom privado.extcalc_original_source_v0 src;')));
});
test('a missing force RLS clause is denied',()=>{
 assert(!check(source.replace('alter table privado.extcalc_original_source_v0 force row level security;','')));
});
test('an accidental authenticated INSERT grant is denied',()=>{
 assert(!check(source+'\ngrant insert on privado.extcalc_original_source_v0 to authenticated;'));
});
test('a missing no-update-delete trigger is denied',()=>{
 assert(!check(source.replace('before update or delete on privado.extcalc_original_source_v0',
  'before insert on privado.extcalc_original_source_v0')));
});
console.log('EXTERNAL_CALC_VS53I_SQL_CANDIDATE_STATIC=PASS checks='+checks+' postgres=NOT_RUN production=NO_GO');
