-- External Calc Supplier Context V0
-- Lightweight supplier registry for Calculator + AI Advisor context.

create table if not exists public.extcalc_supplier (
  supplier_id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null default privado.fn_tenant_atual(),
  name text not null,
  phone text,
  address text,
  city text,
  notes text,
  ai_context text,
  created_by uuid not null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint extcalc_supplier_name_nonempty check (length(btrim(name)) between 1 and 120),
  constraint extcalc_supplier_phone_len check (phone is null or length(phone) <= 40),
  constraint extcalc_supplier_address_len check (address is null or length(address) <= 240),
  constraint extcalc_supplier_city_len check (city is null or length(city) <= 120),
  constraint extcalc_supplier_notes_len check (notes is null or length(notes) <= 1000),
  constraint extcalc_supplier_ai_context_len check (ai_context is null or length(ai_context) <= 2000)
);

create index if not exists extcalc_supplier_tenant_name_idx
  on public.extcalc_supplier (tenant_id, lower(name));

alter table public.extcalc_supplier enable row level security;

drop policy if exists extcalc_supplier_select on public.extcalc_supplier;
create policy extcalc_supplier_select
on public.extcalc_supplier
for select
to authenticated
using (
  tenant_id = privado.fn_tenant_atual()
  and privado.fn_papel_atual() = 'dono'
);

drop policy if exists extcalc_supplier_insert on public.extcalc_supplier;
create policy extcalc_supplier_insert
on public.extcalc_supplier
for insert
to authenticated
with check (
  tenant_id = privado.fn_tenant_atual()
  and created_by = (select auth.uid())
  and privado.fn_papel_atual() = 'dono'
);

drop policy if exists extcalc_supplier_update on public.extcalc_supplier;
create policy extcalc_supplier_update
on public.extcalc_supplier
for update
to authenticated
using (
  tenant_id = privado.fn_tenant_atual()
  and privado.fn_papel_atual() = 'dono'
)
with check (
  tenant_id = privado.fn_tenant_atual()
  and privado.fn_papel_atual() = 'dono'
);

drop policy if exists extcalc_supplier_delete on public.extcalc_supplier;
create policy extcalc_supplier_delete
on public.extcalc_supplier
for delete
to authenticated
using (
  tenant_id = privado.fn_tenant_atual()
  and privado.fn_papel_atual() = 'dono'
);

grant select, insert, update, delete on public.extcalc_supplier to authenticated;

create or replace function public.extcalc_touch_supplier_updated_at_v0()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists extcalc_supplier_touch_updated_at on public.extcalc_supplier;
create trigger extcalc_supplier_touch_updated_at
before update on public.extcalc_supplier
for each row execute function public.extcalc_touch_supplier_updated_at_v0();
