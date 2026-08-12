-- Prova de banco do relatorio de entrega (08/08/2026).
--
-- O que esta obra mexeu no banco: a coluna venda.motoboy_whatsapp, a whitelist
-- privado.fn_venda_atualizar, a normalizacao em registrar_venda e editar_venda,
-- e a v_venda expondo a coluna nova.
--
-- Roda como `authenticated` com os claims do dono, sobre as LINHAS REAIS, e
-- termina em `raise exception`: o bloco inteiro e uma transacao so, entao tudo
-- que ela escreve volta atras. O relatorio sai dentro da mensagem do erro.
-- ERRO com "0 falhas" no fim = APROVOU. Qualquer outro erro = REPROVOU.
--
-- Reexecutar: colar em execute_sql do MCP do Supabase, ou psql -f.
do $$
declare
  v1     uuid := '7485cfe9-ea9a-4716-96f0-cbaa1217067f'; -- VENDA-0001, real
  dono   uuid := 'fb2aad8e-b728-4e59-a198-71da2156449d';
  alheio uuid := 'aaaaaaaa-0000-0000-0000-00000000000a';
  ten2   uuid := 'aaaaaaaa-0000-0000-0000-00000000000b';
  rel text := ''; nok int := 0; nfa int := 0;
  r jsonb; s text; n int; barrou boolean;
begin
  -- vizinho de outro tenant, para o teste de isolamento. Some no rollback.
  insert into public.tenant(id, nome) values (ten2, 'Tenant vizinho (prova)');
  insert into public.app_usuario(id, tenant_id, nome, papel, ativo)
  values (alheio, ten2, 'Vizinho (prova)', 'dono', true);

  -- daqui pra baixo e a sessao do dono, pelo mesmo caminho da tela
  perform set_config('request.jwt.claims',
    json_build_object('sub', dono, 'role', 'authenticated')::text, true);
  perform set_config('role', 'authenticated', true);

  ----------------------------------------------------------------- a coluna
  select count(*) into n from information_schema.columns
   where table_schema = 'public' and table_name = 'venda' and column_name = 'motoboy_whatsapp';
  if n = 1 then nok:=nok+1; rel:=rel||E'\n  ok  venda.motoboy_whatsapp existe';
  else nfa:=nfa+1; rel:=rel||E'\nFALHOU venda.motoboy_whatsapp nao existe'; end if;

  -- a tela LE pela view, nao pela tabela: coluna que nao chega na v_venda e
  -- coluna que o painel de entrega nunca ve.
  select count(*) into n from information_schema.columns
   where table_schema = 'public' and table_name = 'v_venda' and column_name = 'motoboy_whatsapp';
  if n = 1 then nok:=nok+1; rel:=rel||E'\n  ok  v_venda expoe motoboy_whatsapp';
  else nfa:=nfa+1; rel:=rel||E'\nFALHOU v_venda NAO expoe motoboy_whatsapp'; end if;

  -- create or replace view derruba security_invoker em silencio
  select count(*) into n from pg_class c join pg_namespace ns on ns.oid = c.relnamespace
   where ns.nspname = 'public' and c.relname = 'v_venda'
     and 'security_invoker=on' = any(c.reloptions);
  if n = 1 then nok:=nok+1; rel:=rel||E'\n  ok  v_venda continua com security_invoker = on';
  else nfa:=nfa+1; rel:=rel||E'\nFALHOU v_venda perdeu security_invoker'; end if;

  ------------------------------------------------- normalizacao em editar_venda
  -- o operador digita como fala; o banco guarda um formato so
  r := public.editar_venda(jsonb_build_object('id', v1, 'motoboy_whatsapp', '(21) 99888-7766'));
  if r->>'ok' = 'true' then nok:=nok+1; rel:=rel||E'\n  ok  editar_venda aceita motoboy_whatsapp';
  else nfa:=nfa+1; rel:=rel||E'\nFALHOU editar_venda: '||coalesce(r->>'erro','?'); end if;

  select motoboy_whatsapp into s from public.venda where id = v1;
  if s = '5521998887766' then nok:=nok+1; rel:=rel||E'\n  ok  gravou normalizado: 5521998887766 (digitado "(21) 99888-7766")';
  else nfa:=nfa+1; rel:=rel||E'\nFALHOU gravou "'||coalesce(s,'(null)')||'", esperava 5521998887766'; end if;

  -- a whitelist da fn_venda_atualizar e o ponto onde isso ja falhou em silencio:
  -- RPC devolve ok, e a coluna nao muda. A assercao acima e sobre a COLUNA, nao
  -- sobre o retorno, exatamente por isso.
  select motoboy_whatsapp into s from public.v_venda where id = v1;
  if s = '5521998887766' then nok:=nok+1; rel:=rel||E'\n  ok  o valor chega na v_venda (o que a tela le)';
  else nfa:=nfa+1; rel:=rel||E'\nFALHOU v_venda devolve "'||coalesce(s,'(null)')||'"'; end if;

  -- ja com o 55 na frente nao ganha outro 55
  r := public.editar_venda(jsonb_build_object('id', v1, 'motoboy_whatsapp', '5521998887766'));
  select motoboy_whatsapp into s from public.venda where id = v1;
  if s = '5521998887766' then nok:=nok+1; rel:=rel||E'\n  ok  numero ja com 55 nao ganha outro 55';
  else nfa:=nfa+1; rel:=rel||E'\nFALHOU dupla normalizacao virou "'||coalesce(s,'(null)')||'"'; end if;

  -- vazio LIMPA, e nao vira string vazia: sem isso o CHECK derrubaria a edicao
  r := public.editar_venda(jsonb_build_object('id', v1, 'motoboy_whatsapp', ''));
  select motoboy_whatsapp into s from public.venda where id = v1;
  if r->>'ok' = 'true' and s is null then nok:=nok+1; rel:=rel||E'\n  ok  campo vazio limpa o telefone (vira null, nao "")';
  else nfa:=nfa+1; rel:=rel||E'\nFALHOU limpar devolveu ok='||coalesce(r->>'ok','?')||' valor="'||coalesce(s,'(null)')||'"'; end if;

  -- lixo e RECUSADO com mensagem, nunca truncado em silencio
  r := public.editar_venda(jsonb_build_object('id', v1, 'motoboy_whatsapp', '123'));
  if r->>'ok' = 'false' and r->>'erro' like '%motoboy%' then
    nok:=nok+1; rel:=rel||E'\n  ok  telefone curto recusado com mensagem: '||(r->>'erro');
  else nfa:=nfa+1; rel:=rel||E'\nFALHOU telefone "123" nao foi recusado: '||coalesce(r::text,'?'); end if;

  select motoboy_whatsapp into s from public.venda where id = v1;
  if s is null then nok:=nok+1; rel:=rel||E'\n  ok  a recusa nao gravou nada';
  else nfa:=nfa+1; rel:=rel||E'\nFALHOU a recusa gravou "'||s||'"'; end if;

  ---------------------------------------------- o CHECK, para escrita direta
  -- a RPC normaliza, mas o CHECK e quem garante quando a escrita vem por fora
  barrou := false;
  begin
    perform set_config('role', 'postgres', true);
    update public.venda set motoboy_whatsapp = 'nao-e-telefone' where id = v1;
  exception when check_violation then barrou := true;
  end;
  perform set_config('role', 'authenticated', true);
  if barrou then nok:=nok+1; rel:=rel||E'\n  ok  o CHECK barra update direto com lixo';
  else nfa:=nfa+1; rel:=rel||E'\nFALHOU update direto com lixo passou pelo CHECK'; end if;

  ---------------------------------------- normalizacao em registrar_venda tambem
  r := public.registrar_venda(jsonb_build_object(
    'valor_venda', '1000', 'modelo_texto', 'iPhone de prova',
    'comprador_nome', 'Comprador de prova', 'comprador_whatsapp', '21988887777',
    'motoboy', 'Motoboy de prova', 'motoboy_whatsapp', '(21) 97777-6655'));
  if r->>'ok' = 'true' then nok:=nok+1; rel:=rel||E'\n  ok  registrar_venda aceita motoboy_whatsapp';
  else nfa:=nfa+1; rel:=rel||E'\nFALHOU registrar_venda: '||coalesce(r->>'erro','?'); end if;

  select motoboy_whatsapp into s from public.venda where id = (r->>'id')::uuid;
  if s = '5521977776655' then nok:=nok+1; rel:=rel||E'\n  ok  venda nova nasce com o telefone normalizado';
  else nfa:=nfa+1; rel:=rel||E'\nFALHOU venda nova gravou "'||coalesce(s,'(null)')||'"'; end if;

  r := public.registrar_venda(jsonb_build_object(
    'valor_venda', '1000', 'modelo_texto', 'iPhone de prova 2',
    'comprador_nome', 'Comprador de prova 2', 'motoboy_whatsapp', '99'));
  if r->>'ok' = 'false' and r->>'erro' like '%motoboy%' then
    nok:=nok+1; rel:=rel||E'\n  ok  registrar_venda recusa telefone de motoboy invalido';
  else nfa:=nfa+1; rel:=rel||E'\nFALHOU registrar_venda aceitou "99": '||coalesce(r::text,'?'); end if;

  ------------------------------------------------------------ isolamento
  -- o campo novo nao abre porta: venda de outro tenant continua invisivel
  perform set_config('request.jwt.claims',
    json_build_object('sub', alheio, 'role', 'authenticated')::text, true);
  r := public.editar_venda(jsonb_build_object('id', v1, 'motoboy_whatsapp', '21999999999'));
  if r->>'ok' = 'false' then nok:=nok+1; rel:=rel||E'\n  ok  tenant vizinho nao edita o motoboy da venda alheia: '||coalesce(r->>'erro','?');
  else nfa:=nfa+1; rel:=rel||E'\nFALHOU tenant vizinho conseguiu editar a venda'; end if;

  select count(*) into n from public.v_venda where id = v1;
  if n = 0 then nok:=nok+1; rel:=rel||E'\n  ok  tenant vizinho nem enxerga a venda na v_venda';
  else nfa:=nfa+1; rel:=rel||E'\nFALHOU tenant vizinho enxerga '||n||' venda(s) alheia(s)'; end if;

  perform set_config('request.jwt.claims',
    json_build_object('sub', dono, 'role', 'authenticated')::text, true);

  raise exception E'%\n\n=== %  ok  /  %  falhas ===  (rollback: nada disso ficou)',
    rel, nok, nfa;
end $$;


-- ============================================================================
-- Bloco 2: o cadastro de motoboy (tabela motoboy, salvar_motoboy,
-- desligar_motoboy). Mesmo contrato: rodar sozinho, "0 falhas" no fim = APROVOU.
-- Rodado em 08/08/2026: 12 ok / 0 falhas.
-- ============================================================================
do $$
declare
  dono   uuid := 'fb2aad8e-b728-4e59-a198-71da2156449d';
  alheio uuid := 'aaaaaaaa-0000-0000-0000-00000000000a';
  ten2   uuid := 'aaaaaaaa-0000-0000-0000-00000000000b';
  rel text := ''; nok int := 0; nfa int := 0;
  r jsonb; s text; n int; m1 uuid;
begin
  insert into public.tenant(id, nome) values (ten2, 'Tenant vizinho (prova)');
  insert into public.app_usuario(id, tenant_id, nome, papel, ativo)
  values (alheio, ten2, 'Vizinho (prova)', 'dono', true);

  perform set_config('request.jwt.claims',
    json_build_object('sub', dono, 'role', 'authenticated')::text, true);
  perform set_config('role', 'authenticated', true);

  r := public.salvar_motoboy(jsonb_build_object('nome','Hiago Araujo','whatsapp','(21) 98765-4321'));
  if r->>'ok' = 'true' then nok:=nok+1; rel:=rel||E'\n  ok  salvar_motoboy cria: '||(r->>'msg');
  else nfa:=nfa+1; rel:=rel||E'\nFALHOU salvar_motoboy: '||coalesce(r->>'erro','?'); end if;
  m1 := (r->>'id')::uuid;

  select whatsapp into s from public.motoboy where id = m1;
  if s = '5521987654321' then nok:=nok+1; rel:=rel||E'\n  ok  telefone gravado normalizado';
  else nfa:=nfa+1; rel:=rel||E'\nFALHOU gravou "'||coalesce(s,'(null)')||'"'; end if;

  r := public.salvar_motoboy(jsonb_build_object('nome','','whatsapp','21999998888'));
  if r->>'ok' = 'false' then nok:=nok+1; rel:=rel||E'\n  ok  nome vazio recusado: '||(r->>'erro');
  else nfa:=nfa+1; rel:=rel||E'\nFALHOU nome vazio aceito'; end if;

  -- sem numero o motoboy existiria na lista com um botao que nao leva a lugar
  -- nenhum. A recusa e o que mantem a lista util.
  r := public.salvar_motoboy(jsonb_build_object('nome','Sem telefone'));
  if r->>'ok' = 'false' and r->>'erro' like '%WhatsApp%' then nok:=nok+1; rel:=rel||E'\n  ok  cadastro sem telefone recusado: '||(r->>'erro');
  else nfa:=nfa+1; rel:=rel||E'\nFALHOU aceitou motoboy sem telefone'; end if;

  r := public.salvar_motoboy(jsonb_build_object('nome','Repetido','whatsapp','5521987654321'));
  if r->>'ok' = 'false' then nok:=nok+1; rel:=rel||E'\n  ok  telefone duplicado recusado: '||coalesce(r->>'erro','?');
  else nfa:=nfa+1; rel:=rel||E'\nFALHOU duplicata aceita'; end if;

  -- teto com RECUSA, nunca truncagem silenciosa
  r := public.salvar_motoboy(jsonb_build_object('nome', repeat('x', 81), 'whatsapp','21911112222'));
  if r->>'ok' = 'false' then nok:=nok+1; rel:=rel||E'\n  ok  nome de 81 chars recusado (nao truncado)';
  else nfa:=nfa+1; rel:=rel||E'\nFALHOU nome de 81 chars aceito'; end if;

  r := public.salvar_motoboy(jsonb_build_object('id', m1, 'nome','Hiago A.','whatsapp','5521987654321'));
  select nome into s from public.motoboy where id = m1;
  if r->>'ok' = 'true' and s = 'Hiago A.' then nok:=nok+1; rel:=rel||E'\n  ok  editar muda o nome sem criar linha nova';
  else nfa:=nfa+1; rel:=rel||E'\nFALHOU editar: ok='||coalesce(r->>'ok','?')||' nome="'||coalesce(s,'?')||'"'; end if;

  r := public.desligar_motoboy(m1, true);
  select count(*) into n from public.motoboy where desligado_em is null;
  if r->>'ok' = 'true' and n = 0 then nok:=nok+1; rel:=rel||E'\n  ok  desligar tira da lista viva: '||(r->>'msg');
  else nfa:=nfa+1; rel:=rel||E'\nFALHOU desligar: ok='||coalesce(r->>'ok','?')||' vivos='||n; end if;

  -- soft delete: quem levou a entrega de ontem continua legivel na venda
  select count(*) into n from public.motoboy where id = m1;
  if n = 1 then nok:=nok+1; rel:=rel||E'\n  ok  a linha continua no banco (soft delete)';
  else nfa:=nfa+1; rel:=rel||E'\nFALHOU a linha sumiu do banco'; end if;

  r := public.salvar_motoboy(jsonb_build_object('nome','Outro','whatsapp','5521987654321'));
  if r->>'ok' = 'true' then nok:=nok+1; rel:=rel||E'\n  ok  telefone de desligado volta a ser usavel (indice parcial)';
  else nfa:=nfa+1; rel:=rel||E'\nFALHOU telefone de desligado segue bloqueado: '||coalesce(r->>'erro','?'); end if;

  perform set_config('request.jwt.claims',
    json_build_object('sub', alheio, 'role', 'authenticated')::text, true);
  select count(*) into n from public.motoboy;
  if n = 0 then nok:=nok+1; rel:=rel||E'\n  ok  tenant vizinho nao ve motoboy nenhum';
  else nfa:=nfa+1; rel:=rel||E'\nFALHOU tenant vizinho ve '||n||' motoboy(s)'; end if;

  r := public.desligar_motoboy(m1, false);
  if r->>'ok' = 'false' then nok:=nok+1; rel:=rel||E'\n  ok  tenant vizinho nao mexe no motoboy alheio: '||coalesce(r->>'erro','?');
  else nfa:=nfa+1; rel:=rel||E'\nFALHOU tenant vizinho reativou motoboy alheio'; end if;

  raise exception E'%\n\n=== %  ok  /  %  falhas ===  (rollback: nada disso ficou)',
    rel, nok, nfa;
end $$;
