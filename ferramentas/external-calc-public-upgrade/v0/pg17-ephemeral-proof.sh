#!/usr/bin/env bash
# UP-06O / local disposable PostgreSQL 17 only. Never targets external DB.
set -euo pipefail
[[ $(id -u) != 0 ]] || { echo 'REFUSED: root' >&2; exit 2; }
for x in initdb pg_ctl psql; do command -v "$x" >/dev/null || { echo "MISSING $x" >&2; exit 3; }; done
[[ "$(initdb --version)" == *"PostgreSQL) 17."* ]] || { echo 'PG17_REQUIRED' >&2; exit 4; }
umask 077
tmp="$(mktemp -d "${TMPDIR:-/tmp}/up06o-ephemeral.XXXXXXXX")"
mkdir -m 700 "$tmp/sock"
started=0
cleanup(){ if [[ $started == 1 ]]; then pg_ctl -D "$tmp/db" -m immediate stop >/dev/null 2>&1 || true; fi; rm -rf -- "$tmp"; }
trap cleanup EXIT INT TERM
initdb -D "$tmp/db" -A trust --no-instructions >/dev/null
pg_ctl -D "$tmp/db" -o "-c listen_addresses='' -c unix_socket_directories='$tmp/sock' -c unix_socket_permissions=0700" -w start >/dev/null
started=1
export PGHOST="$tmp/sock" PGPORT=5432 PGDATABASE=postgres PGUSER="$(id -un)" PGPASSWORD=''
psql -Xq -v ON_ERROR_STOP=1 <<'SQL'
CREATE SCHEMA privado;
REVOKE ALL ON SCHEMA privado FROM PUBLIC;
CREATE ROLE up06o_writer NOLOGIN;
CREATE ROLE up06o_anon NOLOGIN;
CREATE ROLE up06o_authenticated NOLOGIN;
CREATE ROLE up06o_service_role NOLOGIN;
CREATE TABLE privado.extcalc_upgrade_nonce_ledger_v0(
 nonce_digest text PRIMARY KEY CHECK(nonce_digest ~ '^[a-f0-9]{64}$'),
 tenant_id uuid NOT NULL, expires_at timestamptz NOT NULL,
 inserted_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 CHECK(expires_at>inserted_at));
ALTER TABLE privado.extcalc_upgrade_nonce_ledger_v0 ENABLE ROW LEVEL SECURITY;
CREATE POLICY writer_insert ON privado.extcalc_upgrade_nonce_ledger_v0 FOR INSERT TO up06o_writer WITH CHECK(true);
CREATE POLICY writer_select ON privado.extcalc_upgrade_nonce_ledger_v0 FOR SELECT TO up06o_writer USING(true);
REVOKE ALL ON privado.extcalc_upgrade_nonce_ledger_v0 FROM PUBLIC;
GRANT USAGE ON SCHEMA privado TO up06o_writer;
GRANT INSERT(nonce_digest,tenant_id,expires_at) ON privado.extcalc_upgrade_nonce_ledger_v0 TO up06o_writer;
GRANT SELECT(nonce_digest) ON privado.extcalc_upgrade_nonce_ledger_v0 TO up06o_writer;
DO $$ BEGIN
IF has_schema_privilege('up06o_anon','privado','USAGE')
 OR has_table_privilege('up06o_anon','privado.extcalc_upgrade_nonce_ledger_v0','SELECT')
 OR has_table_privilege('up06o_authenticated','privado.extcalc_upgrade_nonce_ledger_v0','INSERT')
 OR has_table_privilege('up06o_service_role','privado.extcalc_upgrade_nonce_ledger_v0','SELECT')
 OR has_table_privilege('up06o_writer','privado.extcalc_upgrade_nonce_ledger_v0','DELETE')
THEN RAISE EXCEPTION 'BAD_PRIVILEGES'; END IF;
END $$;
SQL
digest="$(printf '%064d' 0)"
tenant='5212679b-8b2e-459f-a2ba-7ae8db558ba1'
mkdir -m 700 "$tmp/out"
pids=()
for i in $(seq 1 32); do
 (psql -XAtq -v ON_ERROR_STOP=1 -c "SET ROLE up06o_writer; INSERT INTO privado.extcalc_upgrade_nonce_ledger_v0(nonce_digest,tenant_id,expires_at) VALUES('$digest','$tenant',now()+interval '10 minutes') ON CONFLICT(nonce_digest) DO NOTHING RETURNING nonce_digest;" >"$tmp/out/$i") & pids+=("$!")
done
for pid in "${pids[@]}"; do wait "$pid"; done
winner="$(grep -l -x "$digest" "$tmp"/out/* | wc -l)"
[[ "$winner" == 1 ]] || { echo "CONCURRENCY_FAILED $winner" >&2; exit 1; }
[[ "$(psql -XAtq -c 'SELECT count(*) FROM privado.extcalc_upgrade_nonce_ledger_v0')" == 1 ]] || exit 1
if psql -XAtq -v ON_ERROR_STOP=1 -c 'SET ROLE up06o_writer; DELETE FROM privado.extcalc_upgrade_nonce_ledger_v0;' >/dev/null 2>&1; then exit 1; fi
if psql -XAtq -v ON_ERROR_STOP=1 -c 'SET ROLE up06o_writer; SELECT * FROM privado.extcalc_upgrade_nonce_ledger_v0;' >/dev/null 2>&1; then exit 1; fi
if psql -XAtq -v ON_ERROR_STOP=1 -c 'SET ROLE up06o_anon; SELECT * FROM privado.extcalc_upgrade_nonce_ledger_v0;' >/dev/null 2>&1; then exit 1; fi
echo 'UP06O PASS: 32 independent PostgreSQL sessions; one winner; denied unwanted privileges.'
