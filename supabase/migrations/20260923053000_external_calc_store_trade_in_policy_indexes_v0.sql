-- External Calc Store Trade-in Policy V0 — FK index correction.
-- Removes the two performance regressions reported after the T03 production migration.

create index if not exists extcalc_store_trade_in_policies_created_by_ix
  on public.extcalc_store_trade_in_policies (created_by);

create index if not exists extcalc_store_trade_in_policies_supersedes_ix
  on public.extcalc_store_trade_in_policies (supersedes_policy_id)
  where supersedes_policy_id is not null;
