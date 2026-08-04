-- Prova de banco da Fatia 1 da aba Escopo (04/08/2026).
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
  n int; msg text; vb boolean; r jsonb; vid uuid;
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

  select count(*) into n from public.escopo_frente where grupo = 'frente' and ativo;
  if n = 8 then nok:=nok+1; rel:=rel||E'\n  ok  seed: 8 frentes ativas';
  else nfa:=nfa+1; rel:=rel||E'\nFALHOU seed: achei '||n||' frentes, esperava 8'; end if;

  select count(*) into n from public.escopo_frente where grupo = 'pendencia';
  if n = 1 then nok:=nok+1; rel:=rel||E'\n  ok  seed: 1 linha de pendencia';
  else nfa:=nfa+1; rel:=rel||E'\nFALHOU seed: achei '||n||' linhas de pendencia'; end if;

  select count(*) into n from public.escopo_frente where codigo = 'crm_legado';
  if n = 0 then nok:=nok+1; rel:=rel||E'\n  ok  seed: crm_legado NAO existe (cortada)';
  else nfa:=nfa+1; rel:=rel||E'\nFALHOU seed: crm_legado existe'; end if;

  -- CHECK: travado sem motivo tem que ser recusado
  begin
    insert into public.escopo_acao(tenant_id, frente, titulo, status)
    values (ten1, 'pitscare', 'trava sem motivo', 'travado');
    nfa:=nfa+1; rel:=rel||E'\nFALHOU CHECK: aceitou travado sem motivo';
  exception when check_violation then
    nok:=nok+1; rel:=rel||E'\n  ok  CHECK: travado sem motivo recusado';
  end;

  -- CHECK: travado COM motivo passa
  begin
    insert into public.escopo_acao(tenant_id, frente, titulo, status, motivo_trava)
    values (ten1, 'pitscare', 'trava com motivo', 'travado', 'capability do Notion');
    nok:=nok+1; rel:=rel||E'\n  ok  CHECK: travado com motivo aceito';
  exception when others then
    nfa:=nfa+1; rel:=rel||E'\nFALHOU CHECK: recusou travado com motivo: '||sqlerrm;
  end;

  -- status invalido nao entra
  begin
    insert into public.escopo_acao(tenant_id, frente, titulo, status)
    values (ten1, 'pitscare', 'status torto', 'concluido');
    nfa:=nfa+1; rel:=rel||E'\nFALHOU CHECK: aceitou status fora da lista';
  exception when check_violation then
    nok:=nok+1; rel:=rel||E'\n  ok  CHECK: status fora da lista recusado';
  end;

  -- frente inexistente nao entra
  begin
    insert into public.escopo_acao(tenant_id, frente, titulo, status)
    values (ten1, 'frente_que_nao_existe', 'orfa', 'a_fazer');
    nfa:=nfa+1; rel:=rel||E'\nFALHOU FK: aceitou acao em frente inexistente';
  exception when foreign_key_violation then
    nok:=nok+1; rel:=rel||E'\n  ok  FK: acao em frente inexistente recusada';
  end;

  -- append-only do evento: authenticated nao pode UPDATE nem DELETE
  insert into public.escopo_acao_evento(tenant_id, acao_id, de_status, para_status, por)
  select ten1, a.id, null, 'a_fazer', dono
    from public.escopo_acao a where a.titulo = 'trava com motivo' limit 1;

  begin
    update public.escopo_acao_evento set para_status = 'feito' where tenant_id = ten1;
    nfa:=nfa+1; rel:=rel||E'\nFALHOU append-only: UPDATE no evento passou';
  exception when insufficient_privilege then
    nok:=nok+1; rel:=rel||E'\n  ok  append-only: UPDATE no evento negado';
  end;

  begin
    delete from public.escopo_acao_evento where tenant_id = ten1;
    nfa:=nfa+1; rel:=rel||E'\nFALHOU append-only: DELETE no evento passou';
  exception when insufficient_privilege then
    nok:=nok+1; rel:=rel||E'\n  ok  append-only: DELETE no evento negado';
  end;

  -- acao tambem nao aceita DELETE (so arquivada)
  begin
    delete from public.escopo_acao where tenant_id = ten1;
    nfa:=nfa+1; rel:=rel||E'\nFALHOU: DELETE em escopo_acao passou';
  exception when insufficient_privilege then
    nok:=nok+1; rel:=rel||E'\n  ok  DELETE em escopo_acao negado (so arquivada)';
  end;

  --------------------------------------------------------- sessao do VIZINHO
  perform set_config('request.jwt.claims',
    json_build_object('sub', alheio, 'role', 'authenticated')::text, true);

  select count(*) into n from public.escopo_frente;
  if n = 0 then nok:=nok+1; rel:=rel||E'\n  ok  RLS: tenant vizinho nao ve frente nenhuma';
  else nfa:=nfa+1; rel:=rel||E'\nFALHOU RLS: tenant vizinho viu '||n||' frentes'; end if;

  select count(*) into n from public.escopo_acao;
  if n = 0 then nok:=nok+1; rel:=rel||E'\n  ok  RLS: tenant vizinho nao ve acao nenhuma';
  else nfa:=nfa+1; rel:=rel||E'\nFALHOU RLS: tenant vizinho viu '||n||' acoes'; end if;

  begin
    insert into public.escopo_acao(tenant_id, frente, titulo, status)
    values (ten1, 'pitscare', 'invasao', 'a_fazer');
    nfa:=nfa+1; rel:=rel||E'\nFALHOU RLS: vizinho escreveu no tenant alheio';
  exception when others then
    nok:=nok+1; rel:=rel||E'\n  ok  RLS: vizinho barrado ao escrever no tenant alheio';
  end;

  ------------------------------------------------------- sessao do VENDEDOR
  perform set_config('request.jwt.claims',
    json_build_object('sub', vend, 'role', 'authenticated')::text, true);

  select count(*) into n from public.escopo_frente where ativo;
  if n = 9 then nok:=nok+1; rel:=rel||E'\n  ok  RLS: vendedor LE as 9 linhas do proprio tenant';
  else nfa:=nfa+1; rel:=rel||E'\nFALHOU RLS: vendedor viu '||n||' linhas, esperava 9'; end if;

  begin
    insert into public.escopo_frente(tenant_id, codigo, rotulo, grupo, icone, ordem)
    values (ten1, 'invencao', 'Invencao', 'frente', 'alvo', 50);
    nfa:=nfa+1; rel:=rel||E'\nFALHOU RLS: vendedor criou frente (so dono pode)';
  exception when others then
    nok:=nok+1; rel:=rel||E'\n  ok  RLS: vendedor barrado ao criar frente';
  end;

  --------------------------------------------------- harden (Task 1b)
  perform set_config('request.jwt.claims',
    json_build_object('sub', dono, 'role', 'authenticated')::text, true);

  -- o evento e garantido pelo TRIGGER, nao pela disciplina de chamar a RPC
  insert into public.escopo_acao(tenant_id, frente, titulo, status)
  values (ten1, 'calculadoras', 'alvo do trigger', 'a_fazer') returning id into vid;

  select count(*) into n from public.escopo_acao_evento
   where acao_id = vid and de_status is null and para_status = 'a_fazer';
  if n = 1 then nok:=nok+1; rel:=rel||E'\n  ok  trigger: INSERT gera o evento de nascimento';
  else nfa:=nfa+1; rel:=rel||E'\nFALHOU trigger no INSERT: '||n||' evento(s)'; end if;

  update public.escopo_acao set status = 'feito' where id = vid;
  select count(*) into n from public.escopo_acao_evento
   where acao_id = vid and de_status = 'a_fazer' and para_status = 'feito';
  if n = 1 then nok:=nok+1; rel:=rel||E'\n  ok  trigger: UPDATE DIRETO tambem gera evento (nao da pra furar o log)';
  else nfa:=nfa+1; rel:=rel||E'\nFALHOU trigger no UPDATE direto: '||n||' evento(s)'; end if;

  -- status repetido nao gera evento fantasma, senao a tendencia le ruido
  select count(*) into n from public.escopo_acao_evento where acao_id = vid;
  update public.escopo_acao set status = 'feito' where id = vid;
  select count(*) - n into n from public.escopo_acao_evento where acao_id = vid;
  if n = 0 then nok:=nok+1; rel:=rel||E'\n  ok  trigger: status repetido nao gera evento fantasma';
  else nfa:=nfa+1; rel:=rel||E'\nFALHOU: status repetido gerou '||n||' evento(s)'; end if;

  -- mexer em outra coluna que nao o status tambem nao gera evento
  select count(*) into n from public.escopo_acao_evento where acao_id = vid;
  update public.escopo_acao set titulo = 'outro titulo' where id = vid;
  select count(*) - n into n from public.escopo_acao_evento where acao_id = vid;
  if n = 0 then nok:=nok+1; rel:=rel||E'\n  ok  trigger: mudar o titulo nao e mudanca de status';
  else nfa:=nfa+1; rel:=rel||E'\nFALHOU: editar titulo gerou '||n||' evento(s)'; end if;

  -- vendedor nao fabrica mais evento (era o furo do placar)
  perform set_config('request.jwt.claims',
    json_build_object('sub', vend, 'role', 'authenticated')::text, true);
  begin
    insert into public.escopo_acao_evento(tenant_id, acao_id, de_status, para_status, por)
    values (ten1, vid, 'a_fazer', 'feito', vend);
    nfa:=nfa+1; rel:=rel||E'\nFALHOU: vendedor fabricou evento e pode inflar a nota';
  exception when others then
    nok:=nok+1; rel:=rel||E'\n  ok  vendedor nao fabrica evento (o placar nao se manipula)';
  end;
  perform set_config('request.jwt.claims',
    json_build_object('sub', dono, 'role', 'authenticated')::text, true);

  raise exception E'PROVA ESCOPO FATIA 1 -- % ok, % falhas%', nok, nfa, rel;
end $$;
