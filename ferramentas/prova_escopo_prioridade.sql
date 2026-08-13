-- Prova de banco da Fatia A da aba Escopo: a urgencia (12/08/2026).
-- Assercoes 15 a 19 da secao 7 da spec
-- docs/superpowers/specs/2026-08-12-escopo-grafico-abandono-design.md
--
-- Roda como `authenticated`, escreve, assere e termina em `raise exception`:
-- o bloco inteiro e uma transacao so, entao nada fica no banco. O relatorio
-- sai dentro da mensagem do erro.
-- ERRO com "0 falhas" no fim = APROVOU. Qualquer outro erro = REPROVOU.
--
-- Reexecutar: colar em execute_sql do MCP do Supabase, ou psql -f.
do $$
declare
  ten1   uuid := '00000000-0000-0000-0000-000000000001';
  dono   uuid := 'fb2aad8e-b728-4e59-a198-71da2156449d';
  alheio uuid := 'aaaaaaaa-0000-0000-0000-00000000000a';
  ten2   uuid := 'aaaaaaaa-0000-0000-0000-00000000000b';
  vend   uuid := 'aaaaaaaa-0000-0000-0000-00000000000c';
  rel text := ''; nok int := 0; nfa int := 0;
  n int; ev_antes int; ev_depois int; msg text; dias_antes text; r jsonb; vid uuid;
  a_alta uuid; a_media uuid; a_baixa uuid;
  caso record;
begin
  -- vizinhos de prova, ainda como dono do banco. Somem no rollback.
  insert into public.tenant(id, nome) values (ten2, 'Tenant vizinho (prova)');
  insert into public.app_usuario(id, tenant_id, nome, papel, ativo)
  values (alheio, ten2, 'Vizinho (prova)', 'dono', true),
         (vend,   ten1, 'Vendedor (prova)', 'vendedor', true);

  ------------------------------------------------------------ sessao do DONO
  perform set_config('request.jwt.claims',
    json_build_object('sub', dono, 'role', 'authenticated')::text, true);
  perform set_config('role', 'authenticated', true);

  -- Alvo unico desta prova, na frente `comercial`, que hoje esta vazia. Frente
  -- vazia porque as assercoes de leitura montam o retrato do zero, e retrato
  -- montado em cima de acao real quebraria toda vez que o dono mexesse no
  -- escopo. Nasce sem prioridade, como as 12 acoes vivas de verdade.
  select (public.criar_acao_escopo('comercial', 'alvo da prova de urgencia')::jsonb->>'id')::uuid
    into vid;
  if vid is null then
    raise exception 'PROVA ABORTADA: nao consegui criar a acao alvo';
  end if;

  select prioridade into msg from public.escopo_acao where id = vid;
  if msg is null then nok:=nok+1; rel:=rel||E'\n  ok  base: acao nasce sem prioridade declarada';
  else nfa:=nfa+1; rel:=rel||E'\nFALHOU base: acao nasceu com prioridade "'||msg||'"'; end if;

  ------------------------------------------------------------------ 15
  -- Os TRES valores do dominio sao aceitos e chegam gravados. Um loop, e nao
  -- tres blocos copiados: se alguem apertar o dominio, a fatia inteira reprova
  -- junta em vez de uma linha so.
  for caso in select * from (values ('alta'),('media'),('baixa')) as t(p)
  loop
    select public.definir_prioridade_acao(vid, caso.p)::jsonb into r;
    select prioridade into msg from public.escopo_acao where id = vid;
    if (r->>'ok')::boolean and msg = caso.p then
      nok:=nok+1; rel:=rel||E'\n  ok  15 aceita "'||caso.p||'" e grava';
    else
      nfa:=nfa+1; rel:=rel||E'\nFALHOU 15 "'||caso.p||'": rpc='||coalesce(r::text,'nulo')||
        ' gravado='||quote_literal(coalesce(msg,'NULL'));
    end if;
  end loop;

  -- o retorno ecoa a prioridade: a tela repinta sem reler o escopo inteiro
  select public.definir_prioridade_acao(vid, 'alta')::jsonb into r;
  if r->>'prioridade' = 'alta' then
    nok:=nok+1; rel:=rel||E'\n  ok  15 o retorno ecoa a prioridade gravada';
  else nfa:=nfa+1; rel:=rel||E'\nFALHOU 15 retorno sem eco: '||coalesce(r::text,'nulo'); end if;

  ------------------------------------------------------------------ 16
  -- Valor fora do dominio volta como {ok:false,msg}. O begin/exception NAO e
  -- decoracao: e ele que separa "recusado com mensagem" de "CHECK
  -- escopo_acao_prioridade_ck estourou cru". Sem ele, um 23514 subiria como
  -- excecao e a prova morreria com cara de erro de infraestrutura, que e
  -- exatamente o que o dono veria na tela.
  begin
    select public.definir_prioridade_acao(vid, 'urgente')::jsonb into r;
    if (r->>'ok')::boolean is false and coalesce(r->>'msg','') <> '' then
      nok:=nok+1; rel:=rel||E'\n  ok  16 "urgente" recusada com msg: '||(r->>'msg');
    else
      nfa:=nfa+1; rel:=rel||E'\nFALHOU 16: "urgente" nao foi recusada: '||coalesce(r::text,'nulo');
    end if;
  exception when others then
    nfa:=nfa+1; rel:=rel||E'\nFALHOU 16: estourou erro CRU em vez de msg ('||sqlstate||'): '||sqlerrm;
  end;

  -- e a recusa nao pode ter sujado a prioridade que ja estava la
  select prioridade into msg from public.escopo_acao where id = vid;
  if msg = 'alta' then nok:=nok+1; rel:=rel||E'\n  ok  16 valor recusado nao apaga a prioridade anterior';
  else nfa:=nfa+1; rel:=rel||E'\nFALHOU 16: apos a recusa a prioridade virou '||
    quote_literal(coalesce(msg,'NULL')); end if;

  ------------------------------------------------------------------ 17
  -- nulo LIMPA
  select public.definir_prioridade_acao(vid, null)::jsonb into r;
  select prioridade into msg from public.escopo_acao where id = vid;
  if (r->>'ok')::boolean and msg is null then
    nok:=nok+1; rel:=rel||E'\n  ok  17 nulo LIMPA a prioridade';
  else nfa:=nfa+1; rel:=rel||E'\nFALHOU 17 nulo: rpc='||coalesce(r::text,'nulo')||
    ' gravado='||quote_literal(coalesce(msg,'NULL')); end if;

  -- string so-de-espaco LIMPA tambem, e nao grava '   ', que o CHECK recusaria
  perform public.definir_prioridade_acao(vid, 'media');
  select public.definir_prioridade_acao(vid, '   ')::jsonb into r;
  select prioridade into msg from public.escopo_acao where id = vid;
  if (r->>'ok')::boolean and msg is null then
    nok:=nok+1; rel:=rel||E'\n  ok  17 string so-de-espaco LIMPA a prioridade';
  else nfa:=nfa+1; rel:=rel||E'\nFALHOU 17 espaco: rpc='||coalesce(r::text,'nulo')||
    ' gravado='||quote_literal(coalesce(msg,'NULL')); end if;

  -- string vazia idem
  perform public.definir_prioridade_acao(vid, 'baixa');
  select public.definir_prioridade_acao(vid, '')::jsonb into r;
  select prioridade into msg from public.escopo_acao where id = vid;
  if (r->>'ok')::boolean and msg is null then
    nok:=nok+1; rel:=rel||E'\n  ok  17 string vazia LIMPA a prioridade';
  else nfa:=nfa+1; rel:=rel||E'\nFALHOU 17 vazia: rpc='||coalesce(r::text,'nulo')||
    ' gravado='||quote_literal(coalesce(msg,'NULL')); end if;

  ------------------------------------------------------------------ 18
  -- A PROVA QUE SUSTENTA O EIXO DO GRAFICO (spec, secao 3).
  -- privado.fn_escopo_evento() so insere quando new.status is distinct from
  -- old.status. Se um CREATE OR REPLACE futuro afrouxar essa condicao,
  -- declarar urgencia passaria a gravar evento, dias_parada zeraria, e a
  -- frente abandonada apareceria recem-tocada: a tela nova falsificaria o
  -- proprio eixo, em silencio e sem nenhum outro teste reclamar.
  -- Contado no TENANT inteiro, nao so na acao alvo: evento gravado contra
  -- outra linha tambem envenena o dias_parada de uma frente.
  select count(*) into ev_antes from public.escopo_acao_evento where tenant_id = ten1;

  perform public.definir_prioridade_acao(vid, 'alta');
  perform public.definir_prioridade_acao(vid, 'media');
  perform public.definir_prioridade_acao(vid, null);
  perform public.definir_prioridade_acao(vid, 'baixa');

  select count(*) into ev_depois from public.escopo_acao_evento where tenant_id = ten1;
  if ev_depois = ev_antes then
    nok:=nok+1; rel:=rel||E'\n  ok  18 4 escritas de prioridade geraram 0 evento (antes='||
      ev_antes||' depois='||ev_depois||')';
  else
    nfa:=nfa+1; rel:=rel||E'\nFALHOU 18: prioridade gerou '||(ev_depois-ev_antes)||
      ' evento(s) e ZERA dias_parada (antes='||ev_antes||' depois='||ev_depois||')';
  end if;

  -- Contagem de evento sozinha nao basta: o que o grafico le e dias_parada.
  -- ENVELHECE o evento de nascimento para 40 dias, senao a frente ja esta em 0
  -- e a comparacao 0 contra 0 passaria verde ATE COM O TRIGGER DERRUBADO. O log
  -- e append-only e nem o dono tem UPDATE nele: volta-se ao papel do banco so
  -- para esta linha, como a prova da Fatia 1 ja fazia.
  perform set_config('role', 'postgres', true);
  update public.escopo_acao_evento set em = now() - interval '40 days' where acao_id = vid;
  perform set_config('role', 'authenticated', true);

  select (f->>'dias_parada') into dias_antes
    from json_array_elements((public.escopo_completo())->'frentes') f
   where f->>'codigo' = 'comercial';
  if dias_antes = '40' then
    nok:=nok+1; rel:=rel||E'\n  ok  18 cenario armado: comercial parada ha 40 dias';
  else nfa:=nfa+1; rel:=rel||E'\nFALHOU 18 cenario: dias_parada armado veio '||
    quote_literal(coalesce(dias_antes,'NULL')); end if;

  perform public.definir_prioridade_acao(vid, 'alta');
  select (f->>'dias_parada') into msg
    from json_array_elements((public.escopo_completo())->'frentes') f
   where f->>'codigo' = 'comercial';
  if msg = dias_antes then
    nok:=nok+1; rel:=rel||E'\n  ok  18 declarar urgencia NAO move dias_parada (continua '||msg||')';
  else nfa:=nfa+1; rel:=rel||E'\nFALHOU 18: dias_parada caiu de '||coalesce(dias_antes,'NULL')||
    ' para '||quote_literal(coalesce(msg,'NULL'))||' so por declarar urgencia'; end if;

  -- O contraste que da sentido ao numero acima: MUDAR STATUS ainda grava. Sem
  -- esta, a assercao 18 ficaria verde com o trigger inteiro apagado.
  select count(*) into ev_antes from public.escopo_acao_evento where tenant_id = ten1;
  perform public.mudar_status_acao_escopo(vid, 'fazendo');
  select count(*) into ev_depois from public.escopo_acao_evento where tenant_id = ten1;
  if ev_depois = ev_antes + 1 then
    nok:=nok+1; rel:=rel||E'\n  ok  18 contraste: mudar STATUS ainda grava exatamente 1 evento';
  else
    nfa:=nfa+1; rel:=rel||E'\nFALHOU 18 contraste: mudar status gerou '||(ev_depois-ev_antes)||' evento(s)';
  end if;

  --------------------------------- contrato de leitura (spec, secao 5)
  -- urgencia = a MAIOR prioridade entre as acoes vivas NAO-FEITAS da frente.
  -- vid volta a nao ter urgencia: ele existe aqui so como a acao `fazendo`.
  perform public.definir_prioridade_acao(vid, null);

  select (public.criar_acao_escopo('comercial', 'urg baixa')::jsonb->>'id')::uuid into a_baixa;
  select (public.criar_acao_escopo('comercial', 'urg media')::jsonb->>'id')::uuid into a_media;
  select (public.criar_acao_escopo('comercial', 'urg alta') ::jsonb->>'id')::uuid into a_alta;
  perform public.definir_prioridade_acao(a_baixa, 'baixa');
  perform public.definir_prioridade_acao(a_media, 'media');

  select (f->>'urgencia') into msg
    from json_array_elements((public.escopo_completo())->'frentes') f
   where f->>'codigo' = 'comercial';
  if msg = 'media' then nok:=nok+1; rel:=rel||E'\n  ok  leitura: urgencia = media (baixa + media, sem alta)';
  else nfa:=nfa+1; rel:=rel||E'\nFALHOU leitura urgencia: esperava media, veio '||
    quote_literal(coalesce(msg,'NULL')); end if;

  perform public.definir_prioridade_acao(a_alta, 'alta');
  select (f->>'urgencia') into msg
    from json_array_elements((public.escopo_completo())->'frentes') f
   where f->>'codigo' = 'comercial';
  if msg = 'alta' then nok:=nok+1; rel:=rel||E'\n  ok  leitura: urgencia sobe para alta';
  else nfa:=nfa+1; rel:=rel||E'\nFALHOU leitura urgencia: esperava alta, veio '||
    quote_literal(coalesce(msg,'NULL')); end if;

  -- acao FEITA sai da conta: urgencia resolvida nao e urgencia pendente
  perform public.mudar_status_acao_escopo(a_alta, 'feito');
  select (f->>'urgencia') into msg
    from json_array_elements((public.escopo_completo())->'frentes') f
   where f->>'codigo' = 'comercial';
  if msg = 'media' then nok:=nok+1; rel:=rel||E'\n  ok  leitura: acao FEITA sai da urgencia (alta -> media)';
  else nfa:=nfa+1; rel:=rel||E'\nFALHOU leitura urgencia com feita: veio '||
    quote_literal(coalesce(msg,'NULL')); end if;

  -- acao ARQUIVADA tambem sai
  perform public.descartar_acao_escopo(a_media);
  select (f->>'urgencia') into msg
    from json_array_elements((public.escopo_completo())->'frentes') f
   where f->>'codigo' = 'comercial';
  if msg = 'baixa' then nok:=nok+1; rel:=rel||E'\n  ok  leitura: acao arquivada sai da urgencia (media -> baixa)';
  else nfa:=nfa+1; rel:=rel||E'\nFALHOU leitura urgencia com arquivada: veio '||
    quote_literal(coalesce(msg,'NULL')); end if;

  -- Sem nenhuma prioridade declarada, urgencia e NULL, nunca 'baixa' por
  -- default: default silencioso pintaria marca em frente que o dono nunca
  -- classificou, e o rodape do grafico conta justamente quantas estao em branco.
  perform public.definir_prioridade_acao(a_baixa, null);
  select (f->>'urgencia') into msg
    from json_array_elements((public.escopo_completo())->'frentes') f
   where f->>'codigo' = 'comercial';
  if msg is null then nok:=nok+1; rel:=rel||E'\n  ok  leitura: sem prioridade declarada, urgencia = null';
  else nfa:=nfa+1; rel:=rel||E'\nFALHOU leitura urgencia: esperava null, veio '||quote_literal(msg); end if;

  -- frente sem acao nenhuma: urgencia null e fazendo 0 (ela nem desenha coluna)
  select (f->>'urgencia'), (f->>'fazendo')::int into msg, n
    from json_array_elements((public.escopo_completo())->'frentes') f
   where f->>'codigo' = 'captacao_organica';
  if msg is null and n = 0 then
    nok:=nok+1; rel:=rel||E'\n  ok  leitura: frente sem acao vem urgencia=null e fazendo=0';
  else nfa:=nfa+1; rel:=rel||E'\nFALHOU leitura frente vazia: urgencia='||
    quote_literal(coalesce(msg,'NULL'))||' fazendo='||coalesce(n::text,'NULL'); end if;

  -- `fazendo` conta so as vivas em andamento
  select (f->>'fazendo')::int into n
    from json_array_elements((public.escopo_completo())->'frentes') f
   where f->>'codigo' = 'comercial';
  if n = 1 then nok:=nok+1; rel:=rel||E'\n  ok  leitura: fazendo = 1 (so a acao alvo esta em andamento)';
  else nfa:=nfa+1; rel:=rel||E'\nFALHOU leitura fazendo: esperava 1, veio '||coalesce(n::text,'NULL'); end if;

  perform public.mudar_status_acao_escopo(a_baixa, 'fazendo');
  select (f->>'fazendo')::int into n
    from json_array_elements((public.escopo_completo())->'frentes') f
   where f->>'codigo' = 'comercial';
  if n = 2 then nok:=nok+1; rel:=rel||E'\n  ok  leitura: fazendo sobe para 2';
  else nfa:=nfa+1; rel:=rel||E'\nFALHOU leitura fazendo: esperava 2, veio '||coalesce(n::text,'NULL'); end if;

  -- a prioridade chega POR ACAO, senao o seletor da tela abre no valor errado
  perform public.definir_prioridade_acao(vid, 'alta');
  select count(*) into n
    from json_array_elements((public.escopo_completo())->'frentes') f,
         json_array_elements(f->'acoes') a
   where (a->>'id')::uuid = vid and a->>'prioridade' = 'alta';
  if n = 1 then nok:=nok+1; rel:=rel||E'\n  ok  leitura: prioridade chega por acao';
  else nfa:=nfa+1; rel:=rel||E'\nFALHOU leitura: prioridade nao chegou na acao'; end if;

  -- A nota NAO pode ter mudado de formula: prioridade e leitura, nao regua.
  select (f->>'nota') into msg
    from json_array_elements((public.escopo_completo())->'frentes') f
   where f->>'codigo' = 'comercial';
  if msg ~ '^[0-9]+$' then nok:=nok+1; rel:=rel||E'\n  ok  leitura: nota continua inteira ('||msg||'), sem casa decimal';
  else nfa:=nfa+1; rel:=rel||E'\nFALHOU leitura: nota veio '||quote_literal(coalesce(msg,'NULL')); end if;

  ------------------------------------------------------------------ 19
  ------------------------------------------------------- sessao do VENDEDOR
  -- Mesmo tenant, papel errado: le, mas nao escreve.
  perform set_config('request.jwt.claims',
    json_build_object('sub', vend, 'role', 'authenticated')::text, true);

  select public.definir_prioridade_acao(vid, 'baixa')::jsonb into r;
  select prioridade into msg from public.escopo_acao where id = vid;
  if (r->>'ok')::boolean is false and msg = 'alta' then
    nok:=nok+1; rel:=rel||E'\n  ok  19 vendedor NAO define urgencia: '||coalesce(r->>'msg','sem msg');
  else nfa:=nfa+1; rel:=rel||E'\nFALHOU 19: vendedor mexeu na urgencia, virou '||
    quote_literal(coalesce(msg,'NULL')); end if;

  -- e nem pela porta dos fundos: UPDATE direto na tabela
  update public.escopo_acao set prioridade = 'baixa' where id = vid;
  get diagnostics n = row_count;
  select prioridade into msg from public.escopo_acao where id = vid;
  if n = 0 and msg = 'alta' then
    nok:=nok+1; rel:=rel||E'\n  ok  19 vendedor barrado tambem no UPDATE direto (RLS)';
  else nfa:=nfa+1; rel:=rel||E'\nFALHOU 19: UPDATE direto do vendedor afetou '||n||' linha(s)'; end if;

  -------------------------------------------------------- sessao do VIZINHO
  -- Outro TENANT. Simulado pelo `sub`, nunca por app_metadata:
  -- privado.fn_tenant_atual() resolve o tenant por auth.uid() em app_usuario,
  -- entao forjar app_metadata.tenant_id nao muda nada e o teste passaria falso.
  perform set_config('request.jwt.claims',
    json_build_object('sub', alheio, 'role', 'authenticated')::text, true);

  select count(*) into n from public.escopo_acao where prioridade is not null;
  if n = 0 then nok:=nok+1; rel:=rel||E'\n  ok  19 vizinho NAO LE prioridade nenhuma do tenant alheio';
  else nfa:=nfa+1; rel:=rel||E'\nFALHOU 19: vizinho leu '||n||' prioridade(s) alheias'; end if;

  select count(*) into n
    from json_array_elements((public.escopo_completo())->'frentes') f
   where f->>'urgencia' is not null;
  if n = 0 then nok:=nok+1; rel:=rel||E'\n  ok  19 escopo_completo() do vizinho nao vaza urgencia de frente';
  else nfa:=nfa+1; rel:=rel||E'\nFALHOU 19: escopo_completo() vazou '||n||' urgencia(s) para o vizinho'; end if;

  select public.definir_prioridade_acao(vid, 'baixa')::jsonb into r;
  if (r->>'ok')::boolean is false then
    nok:=nok+1; rel:=rel||E'\n  ok  19 vizinho NAO ESCREVE urgencia no tenant alheio: '||
      coalesce(r->>'msg','sem msg');
  else nfa:=nfa+1; rel:=rel||E'\nFALHOU 19: vizinho escreveu urgencia no tenant alheio'; end if;

  update public.escopo_acao set prioridade = 'baixa' where id = vid;
  get diagnostics n = row_count;
  if n = 0 then nok:=nok+1; rel:=rel||E'\n  ok  19 vizinho barrado no UPDATE direto (RLS)';
  else nfa:=nfa+1; rel:=rel||E'\nFALHOU 19: UPDATE direto do vizinho afetou '||n||' linha(s)'; end if;

  -- de volta como dono: a prioridade ficou intacta depois dos dois ataques
  perform set_config('request.jwt.claims',
    json_build_object('sub', dono, 'role', 'authenticated')::text, true);
  select prioridade into msg from public.escopo_acao where id = vid;
  if msg = 'alta' then nok:=nok+1; rel:=rel||E'\n  ok  19 a prioridade sobreviveu intacta aos dois ataques';
  else nfa:=nfa+1; rel:=rel||E'\nFALHOU 19: prioridade final virou '||
    quote_literal(coalesce(msg,'NULL')); end if;

  ------------------------------------------------------------- sessao INVALIDA
  -- `sub` que nao existe em app_usuario: fn_tenant_atual() volta null.
  perform set_config('request.jwt.claims',
    json_build_object('sub', '99999999-9999-9999-9999-999999999999', 'role', 'authenticated')::text, true);
  select public.definir_prioridade_acao(vid, 'alta')::jsonb into r;
  if (r->>'ok')::boolean is false and r->>'msg' = 'Sessao invalida.' then
    nok:=nok+1; rel:=rel||E'\n  ok  sessao sem tenant devolve "Sessao invalida."';
  else nfa:=nfa+1; rel:=rel||E'\nFALHOU sessao invalida: '||coalesce(r::text,'nulo'); end if;

  ------------------------------------------------------------------ privilegio
  -- CREATE OR REPLACE FUNCTION reseta ACL para o default do Postgres. Esta
  -- assercao existe para a proxima substituicao nao subir com `anon` executando.
  perform set_config('role', 'postgres', true);
  if has_function_privilege('authenticated', 'public.definir_prioridade_acao(uuid, text)', 'EXECUTE')
     and not has_function_privilege('anon', 'public.definir_prioridade_acao(uuid, text)', 'EXECUTE')
     and has_function_privilege('authenticated', 'public.escopo_completo()', 'EXECUTE')
     and not has_function_privilege('anon', 'public.escopo_completo()', 'EXECUTE') then
    nok:=nok+1; rel:=rel||E'\n  ok  grant: authenticated executa as duas, anon nenhuma';
  else nfa:=nfa+1; rel:=rel||E'\nFALHOU grant: ACL errada apos o CREATE OR REPLACE'; end if;

  select count(*) into n from pg_proc p join pg_namespace ns on ns.oid = p.pronamespace
   where ns.nspname = 'public' and p.proname in ('definir_prioridade_acao','escopo_completo')
     and p.prosecdef;
  if n = 0 then nok:=nok+1; rel:=rel||E'\n  ok  as duas funcoes sao SECURITY INVOKER (a RLS vale)';
  else nfa:=nfa+1; rel:=rel||E'\nFALHOU: '||n||' funcao(oes) viraram SECURITY DEFINER'; end if;

  raise exception E'PROVA ESCOPO PRIORIDADE (FATIA A) -- % ok, % falhas%', nok, nfa, rel;
end $$;
