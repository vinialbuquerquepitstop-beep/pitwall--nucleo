-- venda_code sequencial por tenant (VENDA-0001) e auditoria reusando a funcao
-- generica public.fn_auditar() (le tenant_id/id de qualquer tabela via to_jsonb).
create or replace function privado.fn_venda_code() returns trigger
language plpgsql security definer set search_path = public, privado as $$
declare n int;
begin
  if new.venda_code is null then
    select coalesce(max((regexp_replace(venda_code,'\D','','g'))::int),0)+1
      into n from public.venda where tenant_id = new.tenant_id;
    new.venda_code := 'VENDA-' || lpad(n::text, 4, '0');
  end if;
  return new;
end $$;

create trigger venda_code_bi before insert on public.venda
  for each row execute function privado.fn_venda_code();

create trigger trg_auditar_venda after insert or update or delete on public.venda
  for each row execute function public.fn_auditar();
