-- migration aplicada: 20260831235504_fin_fatia3_restaura_classificar
-- migration: fin_fatia3_restaura_classificar
--
-- CONSERTO DE REGRESSAO que eu mesmo introduzi em 20260831235349
-- (fin_fatia3_repasse_so_por_par). Ao acrescentar a guarda de categoria nao
-- atribuivel, eu RECONSTRUI o corpo da fin_classificar de memoria em vez de
-- copiar do arquivo versionado, e perdi quatro coisas:
--
--   1. `and m.arquivado_em is null` na contagem de incoerencia de sinal, entao
--      lancamento arquivado voltava a puxar aviso;
--   2. a mensagem `Nada mudou: os lancamentos ja estavam assim.` quando n = 0,
--      que virava "0 lancamentos classificados";
--   3. o texto do aviso de sinal contrario, que perdeu o "Confira se a
--      categoria e a certa.";
--   4. o bloco `exception` inteiro, com foreign_key_violation e
--      check_violation, ou seja, duas recusas nomeadas da secao 4 deixaram de
--      existir e o erro cru do Postgres passaria a vazar para a tela.
--
-- Esta migration devolve o corpo COPIADO de 20260826_fin_fatia1_rpcs_escrita.sql
-- com a guarda nova enxertada, e nada mais. E a mesma licao que o P-AUDITA desta
-- sessao ja tinha registrado sobre a fatia21: corpo de funcao se COPIA, nunca se
-- transcreve no olho.
create or replace function public.fin_classificar(payload jsonb)
returns jsonb
language plpgsql
set search_path to 'public','privado'
as $$
declare
  v_tenant  uuid := privado.fn_tenant_atual();
  v_ids     uuid[];
  v_has_cat boolean := jsonb_exists(payload, 'categoria_codigo');
  v_has_dom boolean := jsonb_exists(payload, 'dominio');
  v_has_obs boolean := jsonb_exists(payload, 'observacao');
  v_cat     text := nullif(btrim(coalesce(payload->>'categoria_codigo','')), '');
  v_dom     text := nullif(btrim(coalesce(payload->>'dominio','')), '');
  v_obs     text := nullif(btrim(coalesce(payload->>'observacao','')), '');
  v_n       int := 0;
  v_incoer  int := 0;
  v_aviso   text;
begin
  if v_tenant is null then
    return jsonb_build_object('ok', false, 'erro', 'Sessao invalida.');
  end if;
  if privado.fn_papel_atual() <> 'dono' then
    return jsonb_build_object('ok', false, 'erro', 'Financeiro e restrito ao dono.');
  end if;

  if jsonb_typeof(coalesce(payload->'ids','null'::jsonb)) <> 'array' then
    return jsonb_build_object('ok', false, 'erro', 'Informe os lancamentos a classificar.');
  end if;
  begin
    select coalesce(array_agg(x::uuid), '{}'::uuid[]) into v_ids
      from jsonb_array_elements_text(payload->'ids') x;
  exception when others then
    return jsonb_build_object('ok', false, 'erro', 'Lista de lancamentos invalida.');
  end;
  if array_length(v_ids, 1) is null then
    return jsonb_build_object('ok', false, 'erro', 'Informe os lancamentos a classificar.');
  end if;

  if not v_has_cat and not v_has_dom and not v_has_obs then
    return jsonb_build_object('ok', false, 'erro', 'Nada para mudar: informe categoria, dominio ou observacao.');
  end if;

  if v_has_cat and v_cat is not null then
    if not exists (select 1 from public.fin_categoria
                    where tenant_id = v_tenant and codigo = v_cat and ativo) then
      return jsonb_build_object('ok', false, 'erro', 'Categoria desconhecida ou desativada: ' || v_cat);
    end if;
    -- Repasse so existe em PAR. Deixar escolher a mao faz o valor sair dos
    -- totais sem contraparte, que e despesa escondida atras de categoria neutra.
    -- A defesa vive AQUI, no servidor: sumir do seletor e conforto, o payload
    -- da RPC e publico e a tela nunca e o guarda.
    if exists (select 1 from public.fin_categoria
                where tenant_id = v_tenant and codigo = v_cat and not atribuivel_manual) then
      return jsonb_build_object('ok', false, 'erro', 'Categoria nao pode ser escolhida a mao: ' || v_cat);
    end if;
  end if;

  if v_has_dom and v_dom is not null and v_dom not in ('empresa','pessoal') then
    return jsonb_build_object('ok', false, 'erro', 'Dominio invalido: use empresa ou pessoal.');
  end if;

  update public.fin_movimento m
     set categoria_codigo = case when v_has_cat then v_cat else m.categoria_codigo end,
         dominio          = case when v_has_dom then v_dom else m.dominio end,
         observacao       = case when v_has_obs then v_obs else m.observacao end,
         atualizado_em    = now()
   where m.id = any(v_ids)
     and m.tenant_id = v_tenant
     and m.arquivado_em is null
     and ( (v_has_cat and m.categoria_codigo is distinct from v_cat)
        or (v_has_dom and m.dominio          is distinct from v_dom)
        or (v_has_obs and m.observacao       is distinct from v_obs) );
  get diagnostics v_n = row_count;

  select count(*) into v_incoer
    from public.fin_movimento m
    join public.fin_categoria c
      on c.tenant_id = m.tenant_id and c.codigo = m.categoria_codigo
   where m.id = any(v_ids)
     and m.arquivado_em is null
     and ( (c.natureza_esperada = 'entrada' and m.valor < 0)
        or (c.natureza_esperada = 'saida'   and m.valor > 0) );

  if v_incoer > 0 then
    v_aviso := (case when v_incoer = 1 then '1 lancamento ficou' else v_incoer || ' lancamentos ficaram' end)
               || ' com o sinal do valor contrario a natureza da categoria. Confira se a categoria e a certa.';
  end if;

  return jsonb_build_object(
    'ok', true,
    'n', v_n,
    'aviso', v_aviso,
    'msg', case when v_n = 0 then 'Nada mudou: os lancamentos ja estavam assim.'
                when v_n = 1 then '1 lancamento classificado.'
                else v_n || ' lancamentos classificados.' end);
exception
  when foreign_key_violation then
    return jsonb_build_object('ok', false, 'erro', 'Categoria desconhecida neste tenant.');
  when check_violation then
    return jsonb_build_object('ok', false, 'erro', 'Classificacao recusada pelo banco: confira o dominio.');
end
$$;
revoke all on function public.fin_classificar(jsonb) from public;
grant execute on function public.fin_classificar(jsonb) to authenticated, postgres, service_role;
