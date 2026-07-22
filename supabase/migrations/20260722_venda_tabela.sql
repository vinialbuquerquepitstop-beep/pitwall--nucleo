create table public.venda (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenant(id),
  venda_code text,
  lead_id uuid references public.lead(id),

  comprador_nome text,
  comprador_whatsapp text,
  comprador_cpf text,
  comprador_nascimento date,
  comprador_instagram text,

  modelo_id uuid references public.catalogo_iphone(id),
  capacidade text,
  cor text,
  condicao text check (condicao in ('lacrado','vitrine','seminovo')),
  imei text,

  fornecedor_nome text,
  fornecedor_contato text,
  fornecedor_local_retirada text,
  fornecedor_pix_url text,

  valor_venda numeric not null,
  custo_aparelho numeric,
  despesa_frete numeric,
  despesa_taxas numeric,

  tem_trade_in boolean not null default false,
  entrada_modelo text,
  entrada_imei text,
  entrada_valor numeric,

  nf_numero text,
  nf_url text,

  status text not null default 'concluida' check (status in ('pre_venda','concluida','cancelada')),
  endereco_entrega text,
  valor_a_cobrar numeric,

  motoboy text,
  forma_pagamento text check (forma_pagamento in ('pix','dinheiro','cartao','misto')),
  data_venda date,
  observacoes text,

  criado_por uuid references public.app_usuario(id),
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz,
  arquivado_em timestamptz
);
alter table public.venda enable row level security;

create policy venda_sel on public.venda
  for select using (tenant_id = privado.fn_tenant_atual());
create policy venda_ins on public.venda
  for insert with check (tenant_id = privado.fn_tenant_atual());
create policy venda_upd on public.venda
  for update using (tenant_id = privado.fn_tenant_atual())
  with check (tenant_id = privado.fn_tenant_atual());

grant select, insert, update on public.venda to authenticated;

create index venda_tenant_idx on public.venda(tenant_id);
create index venda_lead_idx on public.venda(lead_id) where lead_id is not null;
