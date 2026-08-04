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
  ------------------------------------------------------ a nota, de volta como DONO
  perform set_config('request.jwt.claims',
    json_build_object('sub', dono, 'role', 'authenticated')::text, true);

  -- frente sem acao nenhuma nao entra no ranking
  select (f->>'faixa') into msg
    from json_array_elements((public.escopo_completo())->'frentes') f
   where f->>'codigo' = 'assistencia';
  if msg = 'sem_dado' then nok:=nok+1; rel:=rel||E'\n  ok  nota: frente vazia e sem_dado, nao 0 nem 100';
  else nfa:=nfa+1; rel:=rel||E'\nFALHOU nota: frente vazia veio como '||coalesce(msg,'NULL'); end if;

  -- 4 de 4 feitas, 0 travadas, evento de hoje = 100.
  -- O evento nasce do trigger da Task 1b: nao inserir na mao, senao duplica.
  insert into public.escopo_acao(tenant_id, frente, titulo, status)
  select ten1, 'comercial', 'a'||i, 'feito' from generate_series(1,4) i;

  select (f->>'nota') into msg
    from json_array_elements((public.escopo_completo())->'frentes') f
   where f->>'codigo' = 'comercial';
  if msg = '100' then nok:=nok+1; rel:=rel||E'\n  ok  nota: tudo feito, nada travado, mexido hoje = 100';
  else nfa:=nfa+1; rel:=rel||E'\nFALHOU nota: esperava 100, veio '||coalesce(msg,'NULL'); end if;

  select (f->>'faixa') into msg
    from json_array_elements((public.escopo_completo())->'frentes') f
   where f->>'codigo' = 'comercial';
  if msg = 'a_frente' then nok:=nok+1; rel:=rel||E'\n  ok  faixa: 100 e a_frente';
  else nfa:=nfa+1; rel:=rel||E'\nFALHOU faixa: 100 veio como '||coalesce(msg,'NULL'); end if;

  -- 0 feitas, 1 de 1 travada, parada ha 40 dias = 0
  insert into public.escopo_acao(tenant_id, frente, titulo, status, motivo_trava)
  values (ten1, 'whatsapp', 'parada', 'travado', 'sem numero definido');

  -- O trigger da Task 1b gravou o evento com em = now(). Para provar o
  -- decaimento de Movimento e preciso ENVELHECER esse evento, e o log e
  -- append-only: nem o dono tem UPDATE nele. Volta-se ao papel do dono do
  -- BANCO so para esta linha, e nao para o resto da prova.
  perform set_config('role', 'postgres', true);
  update public.escopo_acao_evento set em = now() - interval '40 days'
   where acao_id in (select id from public.escopo_acao where frente = 'whatsapp');
  perform set_config('role', 'authenticated', true);

  select (f->>'nota') into msg
    from json_array_elements((public.escopo_completo())->'frentes') f
   where f->>'codigo' = 'whatsapp';
  if msg = '0' then nok:=nok+1; rel:=rel||E'\n  ok  nota: nada feito, tudo travado, 40d parada = 0';
  else nfa:=nfa+1; rel:=rel||E'\nFALHOU nota: esperava 0, veio '||coalesce(msg,'NULL'); end if;

  select (f->>'faixa') into msg
    from json_array_elements((public.escopo_completo())->'frentes') f
   where f->>'codigo' = 'whatsapp';
  if msg = 'em_baixa' then nok:=nok+1; rel:=rel||E'\n  ok  faixa: 0 e em_baixa';
  else nfa:=nfa+1; rel:=rel||E'\nFALHOU faixa: 0 veio como '||coalesce(msg,'NULL'); end if;

  -- acao arquivada nao conta no total
  insert into public.escopo_acao(tenant_id, frente, titulo, status, arquivada)
  values (ten1, 'comercial', 'arquivada', 'a_fazer', true);
  select (f->>'total') into msg
    from json_array_elements((public.escopo_completo())->'frentes') f
   where f->>'codigo' = 'comercial';
  if msg = '4' then nok:=nok+1; rel:=rel||E'\n  ok  total ignora acao arquivada';
  else nfa:=nfa+1; rel:=rel||E'\nFALHOU total com arquivada: veio '||coalesce(msg,'NULL'); end if;

  -- o ranking desce da melhor pra pior. Assertado pela ORDEM DAS NOTAS, nao por
  -- uma lista fixa de codigos: os blocos anteriores desta prova ja povoaram
  -- outras frentes, e lista fixa quebraria toda vez que a prova crescesse.
  --
  -- Materializa a leitura UMA vez numa temp table: repetir
  -- json_array_elements(escopo_completo()) em subquery correlacionada custa uma
  -- chamada de RPC por linha e fica ilegivel.
  create temp table _esc_ord on commit drop as
    select (f->>'codigo')  as codigo,
           (f->>'grupo')   as grupo,
           (f->>'faixa')   as faixa,
           (f->>'nota')::int as nota,
           row_number() over () as ord
      from json_array_elements((public.escopo_completo())->'frentes') f;

  select bool_and(nota >= prox) into vb from (
    select nota, lead(nota) over (order by ord) prox
      from _esc_ord where grupo = 'frente' and faixa <> 'sem_dado') p
   where prox is not null;
  if coalesce(vb, true) then nok:=nok+1; rel:=rel||E'\n  ok  ranking: a nota desce da melhor pra pior';
  else nfa:=nfa+1; rel:=rel||E'\nFALHOU ranking: nota fora de ordem'; end if;

  -- sem_dado desce pro fim do grupo, nunca fica no meio de quem tem nota
  select count(*) into n from _esc_ord s
   where s.grupo = 'frente' and s.faixa = 'sem_dado'
     and exists (select 1 from _esc_ord s2
                  where s2.grupo = 'frente' and s2.faixa <> 'sem_dado' and s2.ord > s.ord);
  if n = 0 then nok:=nok+1; rel:=rel||E'\n  ok  sem_dado nunca fica no meio de quem tem nota';
  else nfa:=nfa+1; rel:=rel||E'\nFALHOU: '||n||' frente(s) sem_dado no meio do ranking'; end if;

  drop table _esc_ord;

  -- a linha de pendencia nunca aparece no meio das frentes. Comparado contra a
  -- CONTAGEM da propria leitura, nao contra a posicao fixa 9: a Fatia 3 deixa
  -- criar e desligar frente pela tela, e uma posicao chumbada passaria a
  -- checar a linha errada sem avisar.
  select (f->>'grupo') into msg from (
    select f, row_number() over () ord, count(*) over () tot
      from json_array_elements((public.escopo_completo())->'frentes') f
  ) s where ord = tot;
  if msg = 'pendencia' then nok:=nok+1; rel:=rel||E'\n  ok  pendencias vem sempre por ultimo';
  else nfa:=nfa+1; rel:=rel||E'\nFALHOU ordem: a ultima linha veio como grupo '||coalesce(msg,'NULL'); end if;

  -- ARQUIVAR NAO COMPRA MOVIMENTO. Este e o vetor que a revisao achou: sem o
  -- filtro `not a2.arquivada` no ult_evento, criar e arquivar uma acao
  -- descartavel derrubava dias_parada de 40 para 0 e dobrava a nota.
  insert into public.escopo_acao(tenant_id, frente, titulo, status)
  values (ten1, 'colaboradores', 'trabalho real parado', 'a_fazer') returning id into vid;
  perform set_config('role', 'postgres', true);
  update public.escopo_acao_evento set em = now() - interval '40 days' where acao_id = vid;
  perform set_config('role', 'authenticated', true);

  select (f->>'nota')::int into n
    from json_array_elements((public.escopo_completo())->'frentes') f
   where f->>'codigo' = 'colaboradores';

  insert into public.escopo_acao(tenant_id, frente, titulo, status, arquivada)
  values (ten1, 'colaboradores', 'descartavel', 'a_fazer', true);

  select (f->>'nota')::int - n into n
    from json_array_elements((public.escopo_completo())->'frentes') f
   where f->>'codigo' = 'colaboradores';
  if n = 0 then nok:=nok+1; rel:=rel||E'\n  ok  arquivar acao descartavel NAO muda a nota da frente';
  else nfa:=nfa+1; rel:=rel||E'\nFALHOU: acao descartavel arquivada moveu a nota em '||n||' pontos'; end if;

  -- e faixa sem_dado nao pode vazar dias_parada de acao arquivada
  insert into public.escopo_acao(tenant_id, frente, titulo, status, arquivada)
  values (ten1, 'assistencia', 'so arquivada', 'a_fazer', true);
  select f->>'dias_parada' into msg
    from json_array_elements((public.escopo_completo())->'frentes') f
   where f->>'codigo' = 'assistencia';
  if msg is null then nok:=nok+1; rel:=rel||E'\n  ok  sem_dado vem com dias_parada null, sem fantasma de arquivada';
  else nfa:=nfa+1; rel:=rel||E'\nFALHOU: sem_dado vazou dias_parada = '||msg; end if;

  ------------------------------------------------------------- RPCs de escrita
  select public.criar_acao_escopo('pitscare', '  Aplicar os 19 scripts  ')::jsonb into r;
  if (r->>'ok')::boolean then nok:=nok+1; rel:=rel||E'\n  ok  criar_acao_escopo devolve ok';
  else nfa:=nfa+1; rel:=rel||E'\nFALHOU criar_acao_escopo: '||coalesce(r->>'msg','sem msg'); end if;

  select titulo into msg from public.escopo_acao where id = (r->>'id')::uuid;
  if msg = 'Aplicar os 19 scripts' then nok:=nok+1; rel:=rel||E'\n  ok  o titulo entra sem espaco sobrando';
  else nfa:=nfa+1; rel:=rel||E'\nFALHOU trim do titulo: veio '||quote_literal(coalesce(msg,'NULL')); end if;

  select count(*) into n from public.escopo_acao_evento
   where acao_id = (r->>'id')::uuid and de_status is null and para_status = 'a_fazer';
  if n = 1 then nok:=nok+1; rel:=rel||E'\n  ok  criar acao grava exatamente 1 evento de nascimento';
  else nfa:=nfa+1; rel:=rel||E'\nFALHOU evento de nascimento: '||n||' linhas'; end if;

  -- titulo vazio nao cria acao
  if not (public.criar_acao_escopo('pitscare', '   ')::jsonb->>'ok')::boolean
  then nok:=nok+1; rel:=rel||E'\n  ok  titulo vazio recusado';
  else nfa:=nfa+1; rel:=rel||E'\nFALHOU: titulo vazio criou acao'; end if;

  -- travar SEM motivo e recusado pela RPC, com mensagem legivel
  if not (public.mudar_status_acao_escopo((r->>'id')::uuid, 'travado')::jsonb->>'ok')::boolean
  then nok:=nok+1; rel:=rel||E'\n  ok  travar sem motivo recusado pela RPC';
  else nfa:=nfa+1; rel:=rel||E'\nFALHOU: travou sem motivo'; end if;

  -- travar COM motivo passa e carimba travado_desde
  perform public.mudar_status_acao_escopo((r->>'id')::uuid, 'travado', 'capability Update content');
  select count(*) into n from public.escopo_acao
   where id = (r->>'id')::uuid and status = 'travado'
     and motivo_trava = 'capability Update content'
     and travado_desde = (now() at time zone 'America/Sao_Paulo')::date;
  if n = 1 then nok:=nok+1; rel:=rel||E'\n  ok  travar grava motivo e travado_desde no fuso BR';
  else nfa:=nfa+1; rel:=rel||E'\nFALHOU travar com motivo'; end if;

  select count(*) into n from public.escopo_acao_evento
   where acao_id = (r->>'id')::uuid and de_status = 'a_fazer' and para_status = 'travado';
  if n = 1 then nok:=nok+1; rel:=rel||E'\n  ok  mudanca de status grava evento com de e para';
  else nfa:=nfa+1; rel:=rel||E'\nFALHOU evento da mudanca: '||n||' linhas'; end if;

  -- sair de travado limpa o motivo, senao ele fica mentindo na tela
  perform public.mudar_status_acao_escopo((r->>'id')::uuid, 'fazendo');
  select count(*) into n from public.escopo_acao
   where id = (r->>'id')::uuid and motivo_trava is null and travado_desde is null;
  if n = 1 then nok:=nok+1; rel:=rel||E'\n  ok  destravar limpa motivo e travado_desde';
  else nfa:=nfa+1; rel:=rel||E'\nFALHOU destravar deixou motivo velho para tras'; end if;

  -- status igual ao atual nao gera evento fantasma
  select count(*) into n from public.escopo_acao_evento where acao_id = (r->>'id')::uuid;
  perform public.mudar_status_acao_escopo((r->>'id')::uuid, 'fazendo');
  select count(*) - n into n from public.escopo_acao_evento where acao_id = (r->>'id')::uuid;
  if n = 0 then nok:=nok+1; rel:=rel||E'\n  ok  status repetido nao gera evento fantasma';
  else nfa:=nfa+1; rel:=rel||E'\nFALHOU: status repetido gerou '||n||' evento(s)'; end if;

  -- descartar tira da leitura sem apagar a linha
  perform public.descartar_acao_escopo((r->>'id')::uuid);
  select count(*) into n from public.escopo_acao where id = (r->>'id')::uuid;
  if n = 1 then nok:=nok+1; rel:=rel||E'\n  ok  descartar NAO apaga a linha';
  else nfa:=nfa+1; rel:=rel||E'\nFALHOU: descartar apagou a linha'; end if;

  select count(*) into n
    from json_array_elements((public.escopo_completo())->'frentes') f,
         json_array_elements(f->'acoes') a
   where (a->>'id') = (r->>'id');
  if n = 0 then nok:=nok+1; rel:=rel||E'\n  ok  acao descartada some da leitura';
  else nfa:=nfa+1; rel:=rel||E'\nFALHOU: acao descartada continua na leitura'; end if;

  -- vendedor nao escreve
  perform set_config('request.jwt.claims',
    json_build_object('sub', vend, 'role', 'authenticated')::text, true);
  if not (public.criar_acao_escopo('pitscare', 'do vendedor')::jsonb->>'ok')::boolean
  then nok:=nok+1; rel:=rel||E'\n  ok  vendedor barrado ao criar acao';
  else nfa:=nfa+1; rel:=rel||E'\nFALHOU: vendedor criou acao'; end if;
  perform set_config('request.jwt.claims',
    json_build_object('sub', dono, 'role', 'authenticated')::text, true);

  raise exception E'PROVA ESCOPO FATIA 1 -- % ok, % falhas%', nok, nfa, rel;
end $$;
