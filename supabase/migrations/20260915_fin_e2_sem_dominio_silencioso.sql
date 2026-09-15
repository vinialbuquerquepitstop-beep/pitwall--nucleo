-- E2: nenhuma regra julga dominio sozinha.
--
-- Esta migration foi preparada na branch financeiro-e2 e NAO deve ser aplicada
-- isoladamente em producao: a entrega E2 e vertical e so fecha junto da tela,
-- contrato e provas.
--
-- Medicao de entrada em 15/09/2026:
--   Compra no debito, prioridade 9000, dominio pessoal, categoria null
--   214 linhas sem categoria dependem apenas dela, R$ 8.207,31 em valor absoluto.
--   Marco/2026 cai para 91,77% de cobertura apos a correcao.
--
-- O banco vivo tambem mostrou por que a defesa NAO pode exigir que o texto do
-- padrao apareca literalmente em fin_movimento.contraparte: regras por CNPJ
-- validas identificam a mesma contraparte por um identificador que so aparece
-- em descricao_original. A defesa usa diversidade de contraparte dos matches:
-- regras especificas existentes chegam a 3 variantes; Compra no debito chega a 175.

-- -------------------------------------------------------------------------
-- 1. Unidade explicita para notas de numero.
-- -------------------------------------------------------------------------
alter table public.fin_nota_numero
  add column if not exists unidade text not null default 'brl';

alter table public.fin_nota_numero
  drop constraint if exists fin_nota_numero_unidade_check;

alter table public.fin_nota_numero
  add constraint fin_nota_numero_unidade_check
  check (unidade = any (array['brl'::text, 'pct'::text]));

comment on column public.fin_nota_numero.unidade is
  'Unidade de exibicao da nota: brl ou pct. A tela nao pode formatar pct_julgado como dinheiro.';

-- -------------------------------------------------------------------------
-- 2. Defesa permanente no caminho de criacao/edicao de regra.
-- -------------------------------------------------------------------------
create or replace function public.fin_regra_salvar(payload jsonb)
returns jsonb
language plpgsql
set search_path to 'public','privado'
as $$
declare
  v_tenant uuid := privado.fn_tenant_atual();
  v_id     uuid;
  v_reg    public.fin_regra%rowtype;
  v_padrao text;
  v_tipo   text;
  v_cat    text;
  v_dom    text;
  v_prio   int;
  v_ativo  boolean;
  v_origem text;
  v_forcar boolean := coalesce((payload->>'forcar')::boolean, false);
  v_base   int;
  v_casa   int;
  v_contrapartes int;
  v_uteis  int;
  v_nc     int;
  v_novo   boolean;
begin
  if v_tenant is null then
    return jsonb_build_object('ok', false, 'erro', 'Sessao invalida.');
  end if;
  if privado.fn_papel_atual() <> 'dono' then
    return jsonb_build_object('ok', false, 'erro', 'Financeiro e restrito ao dono.');
  end if;

  begin
    v_id := nullif(btrim(coalesce(payload->>'id','')), '')::uuid;
  exception when others then
    return jsonb_build_object('ok', false, 'erro', 'Id de regra invalido.');
  end;
  v_novo := (v_id is null);

  if not v_novo then
    select * into v_reg from public.fin_regra where id = v_id and tenant_id = v_tenant;
    if not found then
      return jsonb_build_object('ok', false, 'erro', 'Regra nao encontrada.');
    end if;
    if coalesce((payload->>'arquivar')::boolean, false) then
      update public.fin_regra
         set arquivado_em = now(), ativo = false, atualizado_em = now()
       where id = v_id and tenant_id = v_tenant;
      return jsonb_build_object('ok', true, 'id', v_id, 'arquivada', true,
        'msg', 'Regra arquivada. As classificacoes ja feitas continuam como estao.');
    end if;
    if v_reg.arquivado_em is not null then
      return jsonb_build_object('ok', false, 'erro', 'Regra arquivada: crie uma nova em vez de editar esta.');
    end if;
  end if;

  v_padrao := coalesce(nullif(btrim(coalesce(payload->>'padrao','')), ''), v_reg.padrao);
  v_tipo   := coalesce(nullif(btrim(lower(coalesce(payload->>'tipo_match',''))), ''), v_reg.tipo_match, 'contem');
  v_origem := coalesce(nullif(btrim(lower(coalesce(payload->>'origem',''))), ''), v_reg.origem, 'aprendida');
  if payload ? 'categoria_codigo' then
    v_cat := nullif(btrim(coalesce(payload->>'categoria_codigo','')), '');
  else
    v_cat := v_reg.categoria_codigo;
  end if;
  if payload ? 'dominio' then
    v_dom := nullif(btrim(lower(coalesce(payload->>'dominio',''))), '');
  else
    v_dom := v_reg.dominio;
  end if;
  begin
    v_prio := coalesce(nullif(btrim(coalesce(payload->>'prioridade','')), '')::int, v_reg.prioridade, 100);
  exception when others then
    return jsonb_build_object('ok', false, 'erro', 'Prioridade invalida: use um numero inteiro.');
  end;
  v_ativo := coalesce((payload->>'ativo')::boolean, v_reg.ativo, true);

  if v_padrao is null then
    return jsonb_build_object('ok', false, 'erro', 'Informe o padrao a casar.');
  end if;
  v_uteis := length(regexp_replace(privado.fn_fin_norm(v_padrao), '[^A-Z0-9]', '', 'g'));
  if v_uteis < 3 then
    return jsonb_build_object('ok', false, 'erro',
      'Padrao curto demais (' || v_uteis || ' caractere(s) util(eis)). Use pelo menos 3: padrao curto casa o extrato inteiro.');
  end if;
  if v_tipo not in ('contem','comeca','exato') then
    return jsonb_build_object('ok', false, 'erro', 'Tipo de casamento invalido: use contem, comeca ou exato.');
  end if;
  if v_origem not in ('manual','aprendida') then
    return jsonb_build_object('ok', false, 'erro', 'Origem invalida: use manual ou aprendida.');
  end if;
  if v_dom is not null and v_dom not in ('empresa','pessoal') then
    return jsonb_build_object('ok', false, 'erro', 'Dominio invalido: use empresa ou pessoal.');
  end if;
  if v_cat is null and v_dom is null then
    return jsonb_build_object('ok', false, 'erro',
      'A regra precisa definir categoria, dominio, ou os dois. Regra que nao classifica nada e ruido.');
  end if;
  if v_cat is not null and not exists (
    select 1 from public.fin_categoria
     where tenant_id = v_tenant and codigo = v_cat and ativo) then
    return jsonb_build_object('ok', false, 'erro', 'Categoria inexistente ou desativada: ' || v_cat);
  end if;
  if v_cat is not null and exists (
    select 1 from public.fin_categoria
     where tenant_id = v_tenant and codigo = v_cat and not atribuivel_manual) then
    return jsonb_build_object('ok', false, 'erro', 'Categoria nao pode ser escolhida a mao: ' || v_cat);
  end if;
  if v_prio < 0 or v_prio > 9999 then
    return jsonb_build_object('ok', false, 'erro', 'Prioridade fora da faixa: use de 0 a 9999.');
  end if;

  select count(*)::int into v_base
    from public.fin_movimento
   where tenant_id = v_tenant and arquivado_em is null;

  select count(*)::int,
         count(distinct nullif(privado.fn_fin_norm(coalesce(m.contraparte,'')),''))::int
    into v_casa, v_contrapartes
    from public.fin_movimento m
   where m.tenant_id = v_tenant
     and m.arquivado_em is null
     and privado.fn_fin_casa(
           privado.fn_fin_norm(coalesce(m.descricao_original, m.descricao)),
           v_padrao, v_tipo);

  -- E2 / Inv.18: `forcar` NAO passa por cima desta defesa. Forcar existe para
  -- largura (>60%), nao para inventar dominio. Um padrao de transacao que cruza
  -- muitas contrapartes nao pode decidir empresa/pessoal. Regras especificas por
  -- nome/CNPJ existentes mediram ate 3 variantes de contraparte na base viva.
  if v_dom is not null and v_cat is null
     and (v_casa = 0 or coalesce(v_contrapartes,0) = 0 or v_contrapartes > 3) then
    return jsonb_build_object('ok', false, 'erro',
      'Dominio exige contraparte especifica: use nome ou identificador da contraparte, nao um tipo de transacao.');
  end if;

  if v_base > 0 and v_casa * 100 > v_base * 60 and not v_forcar then
    return jsonb_build_object('ok', false,
      'erro', 'Padrao generico demais: "' || v_padrao || '" casa ' || v_casa || ' de ' || v_base ||
              ' lancamentos (' || round(100.0 * v_casa / v_base, 1) ||
              '%). Uma regra assim classifica quase tudo igual e apaga a distincao entre os gastos. ' ||
              'Use o nome da contraparte. Se for mesmo o que voce quer, reenvie com forcar: true.',
      'casaria_total', v_casa, 'base_total', v_base, 'pode_forcar', true);
  end if;

  begin
    if v_novo then
      insert into public.fin_regra
        (tenant_id, padrao, tipo_match, categoria_codigo, dominio, prioridade, ativo, origem)
      values
        (v_tenant, v_padrao, v_tipo, v_cat, v_dom, v_prio, v_ativo, v_origem)
      returning id into v_id;
    else
      update public.fin_regra
         set padrao = v_padrao, tipo_match = v_tipo, categoria_codigo = v_cat,
             dominio = v_dom, prioridade = v_prio, ativo = v_ativo, origem = v_origem,
             atualizado_em = now()
       where id = v_id and tenant_id = v_tenant;
    end if;
  exception
    when unique_violation then
      return jsonb_build_object('ok', false, 'erro',
        'Ja existe uma regra ativa com este padrao e este tipo de casamento.');
    when foreign_key_violation then
      return jsonb_build_object('ok', false, 'erro', 'Categoria inexistente. Nada foi gravado.');
    when check_violation then
      return jsonb_build_object('ok', false, 'erro', 'Regra recusada pelo banco: confira padrao, dominio e tipo.');
  end;

  select count(*)::int into v_nc
    from public.fin_movimento m
   where m.tenant_id = v_tenant and m.arquivado_em is null
     and ( (v_dom is not null and m.dominio is null)
        or (v_cat is not null and m.categoria_codigo is null) )
     and privado.fn_fin_casa(
           privado.fn_fin_norm(coalesce(m.descricao_original, m.descricao)), v_padrao, v_tipo);

  return jsonb_build_object(
    'ok', true,
    'id', v_id,
    'criada', v_novo,
    'padrao', v_padrao,
    'casaria_total', v_casa,
    'casaria_nao_classificados', v_nc,
    'forcado', (v_forcar and v_base > 0 and v_casa * 100 > v_base * 60),
    'msg', (case when v_novo then 'Regra criada. ' else 'Regra atualizada. ' end) ||
           (case when v_nc = 0 then 'Nenhum lancamento pendente para ela agora.'
                 when v_nc = 1 then 'Ela classifica 1 lancamento ainda nao classificado.'
                 else 'Ela classifica ' || v_nc || ' lancamentos ainda nao classificados.' end));
end
$$;

-- -------------------------------------------------------------------------
-- 3. Corrige o historico sem apagar a regra e sem enfraquecer D-f.
--
-- A tabela exige que toda regra classifique algo. Como Compra no debito nao tem
-- categoria, simplesmente zerar dominio quebraria fin_regra_classifica_algo.
-- A regra fica arquivada/desativada, preservando prioridade=9000 e auditoria.
-- Somente movimentos sem categoria, que dependem desta regra e nao de outra
-- regra especifica de dominio, voltam para dominio null.
-- -------------------------------------------------------------------------
do $$
declare
  v_tenant uuid;
  v_regra uuid;
  v_n int;
  v_val numeric;
begin
  select tenant_id, id into v_tenant, v_regra
    from public.fin_regra
   where padrao = 'Compra no débito'
     and tipo_match = 'comeca'
     and prioridade = 9000
     and ativo
     and arquivado_em is null
   limit 1;

  if v_regra is null then
    raise exception 'E2: regra Compra no debito ativa, prioridade 9000, nao encontrada';
  end if;

  select count(*)::int, round(coalesce(sum(abs(m.valor)),0),2)
    into v_n, v_val
    from public.fin_movimento m
   where m.tenant_id = v_tenant
     and m.arquivado_em is null
     and m.dominio = 'pessoal'
     and m.categoria_codigo is null
     and privado.fn_fin_casa(
           privado.fn_fin_norm(coalesce(m.descricao_original,m.descricao)),
           'Compra no débito','comeca')
     and not exists (
       select 1
         from public.fin_regra r
        where r.tenant_id = m.tenant_id
          and r.id <> v_regra
          and r.ativo
          and r.arquivado_em is null
          and r.dominio is not null
          and privado.fn_fin_casa(
                privado.fn_fin_norm(coalesce(m.descricao_original,m.descricao)),
                r.padrao,r.tipo_match)
     );

  -- Se a base mudou entre a conferencia e a aplicacao, falha fechado em vez de
  -- adivinhar quais linhas o dono quis devolver para julgamento.
  if v_n <> 214 or v_val <> 8207.31 then
    raise exception 'E2: conjunto medido mudou; esperava 214 linhas / 8207.31, encontrei % / %', v_n, v_val;
  end if;

  update public.fin_movimento m
     set dominio = null,
         atualizado_em = now()
   where m.tenant_id = v_tenant
     and m.arquivado_em is null
     and m.dominio = 'pessoal'
     and m.categoria_codigo is null
     and privado.fn_fin_casa(
           privado.fn_fin_norm(coalesce(m.descricao_original,m.descricao)),
           'Compra no débito','comeca')
     and not exists (
       select 1
         from public.fin_regra r
        where r.tenant_id = m.tenant_id
          and r.id <> v_regra
          and r.ativo
          and r.arquivado_em is null
          and r.dominio is not null
          and privado.fn_fin_casa(
                privado.fn_fin_norm(coalesce(m.descricao_original,m.descricao)),
                r.padrao,r.tipo_match)
     );

  update public.fin_regra
     set ativo = false,
         arquivado_em = now(),
         atualizado_em = now()
   where id = v_regra
     and tenant_id = v_tenant;

  if (select count(*) from public.fin_movimento
       where tenant_id = v_tenant and arquivado_em is null and dominio is null
         and categoria_codigo is null
         and privado.fn_fin_casa(
           privado.fn_fin_norm(coalesce(descricao_original,descricao)),
           'Compra no débito','comeca')) < 214 then
    raise exception 'E2: menos de 214 linhas voltaram para a fila';
  end if;
end $$;

-- -------------------------------------------------------------------------
-- 4. Nota visivel do numero que muda (portao 6.3).
-- -------------------------------------------------------------------------
insert into public.fin_nota_numero
  (tenant_id, codigo, escopo, competencia, valor_antes, valor_depois,
   causa, mudou_em, unidade)
select r.tenant_id,
       'e2_compra_debito_cobertura_2026_03',
       'pct_julgado',
       date '2026-03-01',
       100.00,
       91.77,
       '214 lançamentos, somando R$ 8.207,31, voltaram para julgamento porque a regra genérica Compra no débito não pode decidir sozinha se um gasto é pessoal ou da empresa. Em março, 50 linhas mantêm a base em 91,77% até serem julgadas.',
       date '2026-09-15',
       'pct'
  from public.fin_regra r
 where r.padrao = 'Compra no débito'
   and r.tipo_match = 'comeca'
   and r.prioridade = 9000
 order by r.criado_em
 limit 1
on conflict (tenant_id, codigo) do nothing;

-- Pos-condicoes de banco da parte E2.
do $$
declare
  v_nota int;
  v_regra int;
begin
  select count(*)::int into v_nota
    from public.fin_nota_numero
   where codigo='e2_compra_debito_cobertura_2026_03'
     and escopo='pct_julgado'
     and unidade='pct'
     and valor_antes=100.00
     and valor_depois=91.77
     and arquivado_em is null;
  if v_nota <> 1 then
    raise exception 'E2: nota percentual nao ficou no estado alvo';
  end if;

  select count(*)::int into v_regra
    from public.fin_regra
   where padrao='Compra no débito'
     and tipo_match='comeca'
     and prioridade=9000
     and ativo=false
     and arquivado_em is not null;
  if v_regra <> 1 then
    raise exception 'E2: regra Compra no debito nao ficou arquivada preservando prioridade 9000';
  end if;
end $$;
