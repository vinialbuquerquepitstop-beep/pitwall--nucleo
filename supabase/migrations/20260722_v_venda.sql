create or replace view public.v_venda as
select v.*,
  coalesce(v.valor_venda,0) - coalesce(v.custo_aparelho,0)
    - coalesce(v.despesa_frete,0) - coalesce(v.despesa_taxas,0) as lucro,
  c.rotulo as modelo_rotulo,
  coalesce(l.nome, v.comprador_nome) as cliente_nome
from public.venda v
left join public.catalogo_iphone c on c.id = v.modelo_id
left join public.lead l on l.id = v.lead_id
where v.arquivado_em is null;

alter view public.v_venda set (security_invoker = on);
grant select on public.v_venda to authenticated;
