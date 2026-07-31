-- Prova de banco da correcao e do arquivamento de venda (31/07/2026).
--
-- Roda como `authenticated` com os claims do dono, sobre as LINHAS REAIS, e
-- termina em `raise exception`: o bloco inteiro e uma transacao so, entao tudo
-- que ela escreve volta atras. O relatorio sai dentro da mensagem do erro.
-- ERRO com "0 falhas" no fim = APROVOU. Qualquer outro erro = REPROVOU.
--
-- Reexecutar: colar em execute_sql do MCP do Supabase, ou psql -f.
do $$
declare
  -- linhas reais (conferidas em 31/07/2026)
  v1     uuid := '7485cfe9-ea9a-4716-96f0-cbaa1217067f'; -- VENDA-0001, unica do LEAD-0019
  v2     uuid := '57917399-c73c-42d6-832f-6b152bb2da45'; -- VENDA-0002, tem NF viva
  v3     uuid := 'dfa9688c-a5de-4e66-963e-48b88ad5d591'; -- VENDA-0003, a duplicata
  l18    uuid := '4b633c67-341c-4edd-bae4-70705dda7355'; -- Victor, dono das duas
  dono   uuid := 'fb2aad8e-b728-4e59-a198-71da2156449d';
  alheio uuid := 'aaaaaaaa-0000-0000-0000-00000000000a';
  ten2   uuid := 'aaaaaaaa-0000-0000-0000-00000000000b';
  rel text := ''; nok int := 0; nfa int := 0;
  r jsonb; qtd0 int; tot0 numeric; n int; d date; l uuid; val numeric;
  ev0 int; fe0 int; marco_n int;
begin
  -- preparo do vizinho, ainda como dono do banco. Some no rollback.
  insert into public.tenant(id, nome) values (ten2, 'Tenant vizinho (prova)');
  insert into public.app_usuario(id, tenant_id, nome, papel, ativo)
  values (alheio, ten2, 'Vizinho (prova)', 'dono', true);

  -- daqui pra baixo e a sessao do dono, pelo mesmo caminho da tela
  perform set_config('request.jwt.claims',
    json_build_object('sub', dono, 'role', 'authenticated')::text, true);
  perform set_config('role', 'authenticated', true);

  ---------------------------------------------------------------- baseline
  select vendas_qtd, vendas_total into qtd0, tot0 from public.v_cliente where id = l18;
  if qtd0 = 2 and tot0 = 16800 then nok:=nok+1; rel:=rel||E'\n  ok  baseline: LEAD-0018 com 2 vendas / R$ 16.800';
  else nfa:=nfa+1; rel:=rel||E'\nFALHOU baseline: LEAD-0018 esta '||coalesce(qtd0,-1)||' / '||coalesce(tot0,-1); end if;

  select count(*) into n from public.v_venda_nf where venda_id = v2;
  if n = 1 then nok:=nok+1; rel:=rel||E'\n  ok  baseline: VENDA-0002 com 1 NF viva';
  else nfa:=nfa+1; rel:=rel||E'\nFALHOU baseline: VENDA-0002 tem '||n||' NF'; end if;

  select count(*) into ev0 from public.lead_evento where lead_id = l18;
  select count(*) into fe0 from public.lead_evento where lead_id = l18 and tipo = 'fechou';

  ------------------------------------------------- arquivar tira o dinheiro
  r := public.arquivar_venda(v3, true);
  if r->>'ok' = 'true' then nok:=nok+1; rel:=rel||E'\n  ok  arquivar_venda devolve ok';
  else nfa:=nfa+1; rel:=rel||E'\nFALHOU arquivar_venda: '||coalesce(r->>'erro','?'); end if;

  -- o Victor fica com a VENDA-0002: nao ficou sem venda
  if r->>'cliente_ficou_sem_venda' = 'false' then nok:=nok+1; rel:=rel||E'\n  ok  com outra venda viva, cliente_ficou_sem_venda = false';
  else nfa:=nfa+1; rel:=rel||E'\nFALHOU cliente_ficou_sem_venda deveria ser false'; end if;

  select count(*) into n from public.v_venda where id = v3;
  if n = 0 then nok:=nok+1; rel:=rel||E'\n  ok  arquivada some da v_venda (a aba Vendas)';
  else nfa:=nfa+1; rel:=rel||E'\nFALHOU arquivada ainda aparece na v_venda'; end if;

  -- o pedido explicito do dono: o faturamento acompanha
  select vendas_qtd, vendas_total into n, val from public.v_cliente where id = l18;
  if n = 1 and val = 8400 then nok:=nok+1; rel:=rel||E'\n  ok  o dinheiro acompanha: LEAD-0018 cai para 1 venda / R$ 8.400';
  else nfa:=nfa+1; rel:=rel||E'\nFALHOU v_cliente ficou '||coalesce(n,-1)||' / '||coalesce(val,-1); end if;

  -- historico e append-only (invariante 6): entra evento novo, o velho fica
  select count(*) into n from public.lead_evento where lead_id = l18;
  if n = ev0 + 1 then nok:=nok+1; rel:=rel||E'\n  ok  arquivar grava exatamente 1 evento novo no cliente';
  else nfa:=nfa+1; rel:=rel||E'\nFALHOU eventos: '||ev0||' -> '||n; end if;

  select count(*) into n from public.lead_evento where lead_id = l18 and tipo = 'fechou';
  if n = fe0 then nok:=nok+1; rel:=rel||E'\n  ok  o evento fechou original continua la (append-only)';
  else nfa:=nfa+1; rel:=rel||E'\nFALHOU o evento fechou original mudou: '||fe0||' -> '||n; end if;

  select count(*) into n from public.lead_evento
   where lead_id = l18 and detalhe like 'VENDA-0003 arquivada%';
  if n = 1 then nok:=nok+1; rel:=rel||E'\n  ok  o evento novo nomeia a venda e diz que saiu do faturamento';
  else nfa:=nfa+1; rel:=rel||E'\nFALHOU o evento novo nao explica o arquivamento'; end if;

  ------------------------------------------------------------ desarquivar
  r := public.arquivar_venda(v3, false);
  select count(*) into n from public.v_venda where id = v3;
  select vendas_qtd, vendas_total into qtd0, tot0 from public.v_cliente where id = l18;
  if r->>'ok' = 'true' and n = 1 and qtd0 = 2 and tot0 = 16800
  then nok:=nok+1; rel:=rel||E'\n  ok  desarquivar traz a venda e o dinheiro de volta (2 / R$ 16.800)';
  else nfa:=nfa+1; rel:=rel||E'\nFALHOU desarquivar nao restaurou: '||coalesce(qtd0,-1)||' / '||coalesce(tot0,-1); end if;

  ---------------------------------------------------- a NF acompanha tambem
  perform public.arquivar_venda(v2, true);
  select count(*) into n from public.v_venda_nf where venda_id = v2;
  if n = 0 then nok:=nok+1; rel:=rel||E'\n  ok  arquivar tira a venda da aba Notas fiscais';
  else nfa:=nfa+1; rel:=rel||E'\nFALHOU v_venda_nf ainda lista a arquivada'; end if;
  perform public.arquivar_venda(v2, false);
  select count(*) into n from public.v_venda_nf where venda_id = v2;
  if n = 1 then nok:=nok+1; rel:=rel||E'\n  ok  desarquivar devolve a NF para a aba';
  else nfa:=nfa+1; rel:=rel||E'\nFALHOU a NF nao voltou'; end if;

  ------------------------------------------- unica venda do cliente avisa
  r := public.arquivar_venda(v1, true);
  if r->>'cliente_ficou_sem_venda' = 'true'
  then nok:=nok+1; rel:=rel||E'\n  ok  unica venda do cliente: cliente_ficou_sem_venda = true';
  else nfa:=nfa+1; rel:=rel||E'\nFALHOU deveria avisar que o cliente ficou sem venda'; end if;

  -- arquivada nao se corrige nem se arquiva duas vezes
  r := public.editar_venda(jsonb_build_object('id', v1, 'valor_venda', '9000'));
  if r->>'ok' = 'false' and r->>'erro' like '%desarquive%'
  then nok:=nok+1; rel:=rel||E'\n  ok  corrigir venda arquivada e recusado, dizendo o caminho';
  else nfa:=nfa+1; rel:=rel||E'\nFALHOU corrigiu venda arquivada: '||r::text; end if;

  r := public.arquivar_venda(v1, true);
  if r->>'ok' = 'false' then nok:=nok+1; rel:=rel||E'\n  ok  arquivar duas vezes e recusado';
  else nfa:=nfa+1; rel:=rel||E'\nFALHOU arquivou de novo'; end if;
  perform public.arquivar_venda(v1, false);

  ------------------------------------------------------------- corrigir
  -- Contagem antes/depois, NAO filtro por horario: dentro de uma transacao
  -- now() e o instante em que ela comecou, entao `criado_em >= clock_timestamp()`
  -- nunca casa e a prova dava falso negativo (medido em 31/07/2026).
  select count(*) into marco_n from public.auditoria
   where tabela = 'venda' and registro_id = v2::text;
  -- os dois campos fora de escopo vao DE PROPOSITO no payload: a whitelist da
  -- RPC tem que ignora-los mesmo quando a tela erra e os manda.
  r := public.editar_venda(jsonb_build_object(
    'id', v2, 'valor_venda', '8399,50', 'modelo_texto', 'iPhone 17 Pro Max',
    'observacoes', 'corrigido pela prova',
    'data_venda', '2020-01-01', 'lead_id', v1::text, 'tenant_id', ten2::text,
    'venda_code', 'VENDA-9999'));
  if r->>'ok' = 'true' then nok:=nok+1; rel:=rel||E'\n  ok  editar_venda devolve ok';
  else nfa:=nfa+1; rel:=rel||E'\nFALHOU editar_venda: '||coalesce(r->>'erro','?'); end if;

  select valor_venda into val from public.v_venda where id = v2;
  if val = 8399.50 then nok:=nok+1; rel:=rel||E'\n  ok  o valor corrigido aparece na v_venda (virgula aceita)';
  else nfa:=nfa+1; rel:=rel||E'\nFALHOU v_venda mostra '||coalesce(val,-1); end if;

  select data_venda, lead_id into d, l from public.venda where id = v2;
  if d = date '2026-07-16' then nok:=nok+1; rel:=rel||E'\n  ok  data_venda no payload NAO e aplicada (a ancora do pos-venda fica)';
  else nfa:=nfa+1; rel:=rel||E'\nFALHOU data_venda virou '||d; end if;
  if l = l18 then nok:=nok+1; rel:=rel||E'\n  ok  lead_id no payload NAO e aplicado (a venda nao muda de dono)';
  else nfa:=nfa+1; rel:=rel||E'\nFALHOU a venda mudou de dono'; end if;

  select count(*) into n from public.venda where id = v2 and venda_code = 'VENDA-0002' and tenant_id <> ten2;
  if n = 1 then nok:=nok+1; rel:=rel||E'\n  ok  venda_code e tenant_id no payload tambem sao ignorados';
  else nfa:=nfa+1; rel:=rel||E'\nFALHOU codigo ou tenant foram reescritos pelo payload'; end if;

  -- auditoria de graca pelo trigger: uma linha, com antes e depois
  select count(*) into n from public.auditoria
   where tabela = 'venda' and registro_id = v2::text;
  if n = marco_n + 1 then nok:=nok+1; rel:=rel||E'\n  ok  a correcao gera exatamente 1 linha de auditoria';
  else nfa:=nfa+1; rel:=rel||E'\nFALHOU auditoria: '||marco_n||' -> '||n||' linhas'; end if;

  select count(*) into n from (
    select antes, depois, usuario_id from public.auditoria
     where tabela = 'venda' and registro_id = v2::text
     order by criado_em desc, id desc limit 1) u
   where (u.antes->>'valor_venda')::numeric = 8400
     and (u.depois->>'valor_venda')::numeric = 8399.50
     and u.usuario_id = dono;
  if n = 1 then nok:=nok+1; rel:=rel||E'\n  ok  a auditoria guarda o antes (8400), o depois (8399,50) e quem mexeu';
  else nfa:=nfa+1; rel:=rel||E'\nFALHOU a auditoria nao guardou antes/depois/autor'; end if;

  ------------------------------------------------------ correcao recusada
  r := public.editar_venda(jsonb_build_object('id', v2, 'valor_venda', '0'));
  if r->>'ok' = 'false' then nok:=nok+1; rel:=rel||E'\n  ok  valor zero e recusado';
  else nfa:=nfa+1; rel:=rel||E'\nFALHOU aceitou valor zero'; end if;

  r := public.editar_venda(jsonb_build_object('id', v2, 'modelo_texto', '   '));
  if r->>'ok' = 'false' then nok:=nok+1; rel:=rel||E'\n  ok  modelo em branco e recusado';
  else nfa:=nfa+1; rel:=rel||E'\nFALHOU aceitou modelo em branco'; end if;

  r := public.editar_venda(jsonb_build_object('id', gen_random_uuid(), 'valor_venda', '10'));
  if r->>'ok' = 'false' and r->>'erro' = 'Venda nao encontrada.'
  then nok:=nok+1; rel:=rel||E'\n  ok  venda inexistente e recusada sem vazar se existe alhures';
  else nfa:=nfa+1; rel:=rel||E'\nFALHOU venda inexistente: '||r::text; end if;

  ------------------------------------------- a porta direta esta fechada
  begin
    update public.venda set valor_venda = 1 where id = v2;
    nfa:=nfa+1; rel:=rel||E'\nFALHOU authenticated ainda escreve direto na tabela venda';
  exception when insufficient_privilege then
    nok:=nok+1; rel:=rel||E'\n  ok  authenticated NAO tem update direto em venda (so pelas RPCs)';
  end;

  -- Os helpers SAO executaveis por authenticated, e tem que ser: a RPC e
  -- SECURITY INVOKER, entao ela roda com o privilegio de quem chamou (e a
  -- decisao 10 da v43, que existe justamente para o RLS continuar isolando o
  -- tenant). Revogar esse EXECUTE quebra editar_venda em producao. O que
  -- protege o helper NAO e o grant, e o SCHEMA: `privado` nao esta na lista de
  -- schemas que o PostgREST expoe, entao nao ha URL que chegue nele.
  -- O spec de 31/07/2026 pedia o contrario no item 8; a premissa estava errada.
  if has_function_privilege('authenticated','privado.fn_venda_atualizar(uuid,jsonb)','EXECUTE')
  then nok:=nok+1; rel:=rel||E'\n  ok  o helper segue executavel por authenticated DE PROPOSITO (RPC invoker)';
  else nfa:=nfa+1; rel:=rel||E'\nFALHOU revogaram o EXECUTE do helper: editar_venda quebra em producao'; end if;

  if not has_schema_privilege('anon','privado','USAGE')
     and not has_function_privilege('anon','privado.fn_venda_atualizar(uuid,jsonb)','EXECUTE')
     and not has_function_privilege('anon','privado.fn_venda_arquivar(uuid,boolean)','EXECUTE')
  then nok:=nok+1; rel:=rel||E'\n  ok  anon nao alcanca o schema privado nem os dois helpers';
  else nfa:=nfa+1; rel:=rel||E'\nFALHOU anon alcanca o schema privado'; end if;

  if not has_function_privilege('anon','public.editar_venda(jsonb)','EXECUTE')
     and not has_function_privilege('anon','public.arquivar_venda(uuid,boolean)','EXECUTE')
  then nok:=nok+1; rel:=rel||E'\n  ok  anon tambem nao executa as duas RPCs novas';
  else nfa:=nfa+1; rel:=rel||E'\nFALHOU anon executa RPC de escrita de venda'; end if;

  select count(*) into n from pg_proc p join pg_namespace ns on ns.oid = p.pronamespace
   where p.proname in ('fn_venda_atualizar','fn_venda_arquivar') and ns.nspname = 'privado';
  if n = 2 then nok:=nok+1; rel:=rel||E'\n  ok  os dois helpers vivem em privado, fora do alcance do PostgREST (inv. 8)';
  else nfa:=nfa+1; rel:=rel||E'\nFALHOU helper fora do schema privado'; end if;

  ------------------------------------------------------------ tenant errado
  perform set_config('request.jwt.claims',
    json_build_object('sub', alheio, 'role', 'authenticated')::text, true);

  select count(*) into n from public.v_venda;
  if n = 0 then nok:=nok+1; rel:=rel||E'\n  ok  tenant vizinho ve 0 vendas';
  else nfa:=nfa+1; rel:=rel||E'\nFALHOU tenant vizinho ve '||n||' vendas'; end if;

  r := public.editar_venda(jsonb_build_object('id', v2, 'valor_venda', '1'));
  if r->>'ok' = 'false' then nok:=nok+1; rel:=rel||E'\n  ok  tenant vizinho nao corrige venda alheia';
  else nfa:=nfa+1; rel:=rel||E'\nFALHOU tenant vizinho corrigiu venda alheia'; end if;

  r := public.arquivar_venda(v2, true);
  if r->>'ok' = 'false' then nok:=nok+1; rel:=rel||E'\n  ok  tenant vizinho nao arquiva venda alheia';
  else nfa:=nfa+1; rel:=rel||E'\nFALHOU tenant vizinho arquivou venda alheia'; end if;

  select valor_venda into val from public.venda where id = v2;
  if val is null then nok:=nok+1; rel:=rel||E'\n  ok  e a linha alheia nem sequer e visivel para ele';
  else nfa:=nfa+1; rel:=rel||E'\nFALHOU a linha alheia esta visivel'; end if;

  raise exception E'PROVA venda editar/arquivar%\n\n=== % assercoes, % falhas === (rollback de proposito)',
    rel, nok, nfa;
end $$;
