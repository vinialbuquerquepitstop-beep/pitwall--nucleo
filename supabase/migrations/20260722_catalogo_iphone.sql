create table public.catalogo_iphone (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenant(id),
  rotulo text not null,
  ativo boolean not null default true,
  ordem int not null default 0,
  criado_em timestamptz not null default now()
);
alter table public.catalogo_iphone enable row level security;

create policy catalogo_iphone_sel on public.catalogo_iphone
  for select using (tenant_id = privado.fn_tenant_atual());
create policy catalogo_iphone_ins on public.catalogo_iphone
  for insert with check (tenant_id = privado.fn_tenant_atual());
create policy catalogo_iphone_upd on public.catalogo_iphone
  for update using (tenant_id = privado.fn_tenant_atual())
  with check (tenant_id = privado.fn_tenant_atual());

grant select, insert, update on public.catalogo_iphone to authenticated;

insert into public.catalogo_iphone (tenant_id, rotulo, ordem) values
  ('00000000-0000-0000-0000-000000000001','iPhone 11',10),
  ('00000000-0000-0000-0000-000000000001','iPhone 12',20),
  ('00000000-0000-0000-0000-000000000001','iPhone 13',30),
  ('00000000-0000-0000-0000-000000000001','iPhone 14',40),
  ('00000000-0000-0000-0000-000000000001','iPhone 15',50),
  ('00000000-0000-0000-0000-000000000001','iPhone 16',60);
