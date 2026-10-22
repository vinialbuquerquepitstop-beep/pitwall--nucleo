#!/usr/bin/env node
// Build phase 2 as one atomic SQL transaction, using the UNMODIFIED PR #179
// guard source (the sole authoritative guard). Never connects to Supabase.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const mode=process.argv[2]||'--check';
assert.ok(['--check','--emit'].includes(mode),'usage: node assemble-vs53l-phase2-atomic.mjs --check|--emit');
const path=new URL('../GATE1_DB_AUTO_PROMOTION_GUARD_DRAFT.sql',import.meta.url);
const guard=readFileSync(path,'utf8').trim();
assert.match(guard,/CREATE OR REPLACE FUNCTION public\.extcalc_persist_auto_promoted_c01_v0\(p_promoted jsonb\)/);
assert.match(guard,/SECURITY DEFINER/i);
assert.match(guard,/EXTCALC_AUTO_PROMOTION_CANDIDATE_MISMATCH/);
assert.match(guard,/EXTCALC_AUTO_PROMOTION_SOURCE_UNBOUND/);
assert.match(guard,/EXTCALC_AUTO_PROMOTION_SOURCE_EVIDENCE_MISMATCH/);
assert.ok(guard.endsWith('$function$')||guard.endsWith('$function$;'),'GUARD_SQL_TERMINATOR_CHANGED');
assert.equal((guard.match(/CREATE OR REPLACE FUNCTION/gi)||[]).length,1);
const sql=[
  '-- Generated from existing PR #179 guard. Staging ONLY. Not production.',
  'BEGIN;',
  "DO $scope$ BEGIN",
  " IF current_user IS DISTINCT FROM 'postgres' OR NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname=current_user AND rolbypassrls=true) THEN",
  "  RAISE EXCEPTION 'VS53L_NOT_STAGING_ADMIN_POSTGRES'; END IF;",
  " IF to_regclass('privado.extcalc_original_source_v0') IS NULL OR",
  "    to_regclass('public.extcalc_review_candidate') IS NULL OR",
  "    to_regclass('public.extcalc_offer_revision') IS NULL OR",
  "    to_regprocedure('public.extcalc_persist_auto_promoted_c01_v0(jsonb)') IS NOT NULL OR",
  "    (SELECT count(*) FROM privado.extcalc_staging_tenant_v0)<>2 THEN",
  "  RAISE EXCEPTION 'VS53L_PHASE2_SCOPE_OR_STATE_INVALID'; END IF;",
  "END $scope$;",
  guard.endsWith(';')?guard:guard+';',
  'REVOKE ALL ON FUNCTION public.extcalc_persist_auto_promoted_c01_v0(jsonb) FROM PUBLIC, anon, authenticated;',
  'GRANT EXECUTE ON FUNCTION public.extcalc_persist_auto_promoted_c01_v0(jsonb) TO authenticated;',
  'DO $grants$ BEGIN',
  " IF pg_catalog.has_function_privilege('anon','public.extcalc_persist_auto_promoted_c01_v0(jsonb)','EXECUTE') OR",
  "    NOT pg_catalog.has_function_privilege('authenticated','public.extcalc_persist_auto_promoted_c01_v0(jsonb)','EXECUTE') THEN",
  "  RAISE EXCEPTION 'VS53L_PROMOTION_GRANT_INVALID'; END IF;",
  'END $grants$;',
  'COMMIT;'
].join('\n')+'\n';
assert.equal((sql.match(/COMMIT;/g)||[]).length,1);
assert.ok(sql.indexOf('REVOKE ALL ON FUNCTION')>sql.indexOf('CREATE OR REPLACE FUNCTION'));
assert.ok(sql.indexOf('REVOKE ALL ON FUNCTION')<sql.lastIndexOf('COMMIT;'));
if(mode==='--emit')process.stdout.write(sql);
else console.log('VS53L_PHASE2_ATOMIC_ASSEMBLY=PASS, guard=PR179, privileges=single_transaction, DB=NOT_RUN');
