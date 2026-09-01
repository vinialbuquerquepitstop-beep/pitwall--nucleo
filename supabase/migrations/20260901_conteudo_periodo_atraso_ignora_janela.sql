-- Aplicada em producao como 20260901080242 conteudo_periodo_atraso_ignora_janela.
--
-- Opcao A, escolhida pelo dono em 01/09/2026, depois que a coluna Atrasados
-- entrou no kanban (commit 32740f9) e mostrou 11 das 85 pecas atrasadas.
--
-- O defeito: a janela de leitura (conteudo_fonte.janela_atras_dias = 7) cortava
-- o atraso junto com o resto. Divida nao expira, mas a janela expirava por ela,
-- e as colunas `Em produção` e `Pronto` desenhavam "vazia" com 16 pecas reais
-- dentro. Uma coluna de divida que mostra 11 de 85 nao cobra nada.
--
-- A regra nova, em uma frase: PECA ATRASADA IGNORA A JANELA. O funil mantem o
-- recorte de 7 dias atras / 28 a frente, que e o que faz a aba ser sobre a
-- semana; a peca vencida e nao publicada entra sempre, venha de quando vier.
--
-- Por que a condicao e negativa (`not in publicado/descartado`) e nao positiva:
-- ela tem que casar EXATAMENTE com nivelPeca() no app.js, que devolve "ok" para
-- publicado e "nulo" para descartado antes de olhar a data. Listar os status que
-- ENTRAM faria a RPC e a tela divergirem no dia em que o Notion ganhasse um
-- status novo: pelo desenho, status desconhecido e peca que ainda deve
-- publicacao, entao ela tem que aparecer, nao sumir.
--
-- `c.data < v_hoje` usa o fuso do Brasil ja calculado em v_hoje (invariante 10),
-- nunca CURRENT_DATE. Peca sem data continua fora dos dois ramos, igual a antes.
--
-- Isolamento inalterado: `c.tenant_id = v_tenant` segue no where, a funcao segue
-- STABLE e security invoker, e a RLS de conteudo continua valendo por cima.
-- Provado em 01/09/2026, no banco vivo, nos tres papeis:
--   dono (fb2aad8e...)      -> ok:true, 87 itens, 85 atrasadas, 74 fora da janela
--   uid desconhecido        -> ok:false, `Sessao invalida.`, 0 itens
--   anon                    -> permission denied for function conteudo_periodo
create or replace function public.conteudo_periodo(p_ini date default null::date, p_fim date default null::date)
returns json
language plpgsql
stable
set search_path to 'public', 'privado'
as $function$
declare
  v_tenant uuid := privado.fn_tenant_atual();
  v_hoje   date := (now() at time zone 'America/Sao_Paulo')::date;
  v_ini date; v_fim date; v_itens json; v_sync json;
begin
  if v_tenant is null then
    return json_build_object('ok', false, 'msg', 'Sessao invalida.');
  end if;
  select coalesce(p_ini, v_hoje - cf.janela_atras_dias),
         coalesce(p_fim, v_hoje + cf.janela_frente_dias)
    into v_ini, v_fim
    from public.conteudo_fonte cf
   where cf.tenant_id = v_tenant and cf.ativo
   order by cf.codigo limit 1;
  if v_ini is null then
    v_ini := coalesce(p_ini, v_hoje); v_fim := coalesce(p_fim, v_hoje);
  end if;

  select coalesce(json_agg(json_build_object(
           'id', c.id, 'titulo', coalesce(c.titulo, '(sem titulo)'), 'data', c.data,
           'tipo_rotulo', c.tipo_rotulo, 'tipo_codigo', c.tipo_codigo,
           'status_rotulo', c.status_rotulo, 'status_codigo', c.status_codigo,
           'semana', c.semana, 'url', c.url,
           'hoje', c.data = v_hoje,
           'metrica', case when m.medido_em is null then null else json_build_object(
              'alcance', m.alcance, 'conversas', m.conversas,
              'medido_em', m.medido_em,
              'medido_dias', (v_hoje - (m.medido_em at time zone 'America/Sao_Paulo')::date)
           ) end) order by c.data, c.tipo_rotulo nulls last, c.titulo), '[]'::json)
    into v_itens
    from public.conteudo c
    left join lateral (
      select mm.alcance, mm.conversas, mm.medido_em
        from public.conteudo_metrica mm
       where mm.tenant_id = c.tenant_id and mm.conteudo_id = c.id
       order by mm.medido_em desc, mm.criado_em desc
       limit 1) m on true
   where c.tenant_id = v_tenant and c.sumiu_em is null
     and ( c.data between v_ini and v_fim
           or ( c.data < v_hoje
                and coalesce(c.status_codigo, '') not in ('publicado', 'descartado') ) );

  select json_build_object('ok', l.ok, 'quando', l.criado_em, 'msg', l.msg,
                           'horas', round(extract(epoch from (now() - l.criado_em)) / 3600.0)::int)
    into v_sync
    from public.conteudo_sync_log l
   where l.tenant_id = v_tenant order by l.id desc limit 1;

  -- `ini` e `fim` continuam sendo a janela DO FUNIL, e e isso que a tela declara
  -- no topo. `atraso_sem_janela` avisa a tela de que a coluna Atrasados nao
  -- obedece a esse recorte: sem esse aviso o cabecalho declararia uma janela que
  -- uma das cinco colunas nao cumpre, que e a mesma mentira por omissao que a
  -- declaracao de janela veio consertar.
  return json_build_object('ok', true, 'ini', v_ini, 'fim', v_fim, 'hoje', v_hoje,
                           'atraso_sem_janela', true,
                           'itens', v_itens, 'sync', coalesce(v_sync, json_build_object('ok', null)));
end
$function$;

-- CREATE OR REPLACE mexe em ACL: refazer explicito, identico ao que estava
-- (postgres=X, authenticated=X, service_role=X). `anon` nunca teve e nao ganha.
revoke all on function public.conteudo_periodo(date, date) from public;
revoke all on function public.conteudo_periodo(date, date) from anon;
grant execute on function public.conteudo_periodo(date, date) to authenticated;
grant execute on function public.conteudo_periodo(date, date) to service_role;
