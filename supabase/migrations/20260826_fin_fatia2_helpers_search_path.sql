-- migration aplicada: 20260826133336_fin_fatia2_helpers_search_path
-- get_advisors acusou function_search_path_mutable nas 3 helpers de casamento.
-- Fechado com search_path vazio: tudo que elas usam e pg_catalog ou esta
-- schema-qualificado. O indice unico fin_regra_padrao_uniq depende de
-- fn_fin_norm, entao o REPLACE preserva a assinatura de proposito.
create or replace function privado.fn_fin_norm(t text)
returns text
language sql
immutable
set search_path to ''
as $$
  select upper(translate(coalesce(t, ''),
    'áàâãäéèêëíìîïóòôõöúùûüçñÁÀÂÃÄÉÈÊËÍÌÎÏÓÒÔÕÖÚÙÛÜÇÑ',
    'aaaaaeeeeiiiiooooouuuucnAAAAAEEEEIIIIOOOOOUUUUCN'));
$$;

create or replace function privado.fn_fin_esc(p text)
returns text
language sql
immutable
set search_path to ''
as $$
  select replace(replace(replace(privado.fn_fin_norm(p), '\', '\\'), '%', '\%'), '_', '\_');
$$;

create or replace function privado.fn_fin_casa(p_alvo_norm text, p_padrao text, p_tipo text)
returns boolean
language sql
immutable
set search_path to ''
as $$
  select case p_tipo
    when 'exato'  then p_alvo_norm = privado.fn_fin_norm(p_padrao)
    when 'comeca' then p_alvo_norm like privado.fn_fin_esc(p_padrao) || '%' escape '\'
    else               p_alvo_norm like '%' || privado.fn_fin_esc(p_padrao) || '%' escape '\'
  end;
$$;

-- CREATE OR REPLACE FUNCTION reseta as ACLs: refazendo (invariante 9).
revoke all on function privado.fn_fin_norm(text) from public;
revoke all on function privado.fn_fin_esc(text)  from public;
revoke all on function privado.fn_fin_casa(text,text,text) from public;
grant execute on function privado.fn_fin_norm(text) to authenticated;
grant execute on function privado.fn_fin_esc(text)  to authenticated;
grant execute on function privado.fn_fin_casa(text,text,text) to authenticated;
