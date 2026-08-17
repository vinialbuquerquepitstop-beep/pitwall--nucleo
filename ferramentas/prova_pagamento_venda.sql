-- Prova de banco do DETALHAMENTO DE PAGAMENTO (v61, 16/08/2026).
--
-- Roda como `authenticated` com os claims do dono, cria a venda de teste pela
-- PROPRIA RPC (nao por insert direto, senao nao prova o caminho da tela) e
-- termina em `raise exception`: o bloco inteiro e uma transacao so, entao tudo
-- volta atras e nenhum VENDA-000X e queimado.
-- ERRO com "0 falhas" no fim = APROVOU. Qualquer outro erro = REPROVOU.
--
-- O que este arquivo defende, em uma frase: A SOMA DOS PAGAMENTOS TEM QUE FECHAR
-- COM O VALOR DA VENDA. Sem essa regra o painel vira ficcao — daria para lancar
-- R$ 200 numa venda de R$ 8.400 e a tela diria "detalhado".
--
-- Resultado em 16/08/2026: 21 ok, 0 falhas.
-- Reexecutar: colar em execute_sql do MCP do Supabase, ou psql -f.
do $$
declare
  dono   uuid := 'fb2aad8e-b728-4e59-a198-71da2156449d';
  alheio uuid := 'aaaaaaaa-0000-0000-0000-00000000000a';
  ten2   uuid := 'aaaaaaaa-0000-0000-0000-00000000000b';
  rel text := ''; nok int := 0; nfa int := 0;
  r jsonb; vid uuid; n int; e text; vparc numeric; b boolean;
begin
  insert into public.tenant(id, nome) values (ten2, 'Tenant vizinho (prova)');
  insert into public.app_usuario(id, tenant_id, nome, papel, ativo)
  values (alheio, ten2, 'Vizinho (prova)', 'dono', true);

  perform set_config('request.jwt.claims',
    json_build_object('sub', dono, 'role', 'authenticated')::text, true);
  perform set_config('role', 'authenticated', true);

  r := public.registrar_venda(jsonb_build_object(
        'modelo_texto','iPhone de prova','valor_venda','8400',
        'comprador_nome','Comprador de prova','comprador_whatsapp','21999990000'));
  vid := (r->>'id')::uuid;

  ------------------------------------------------- 1. a regra que sustenta tudo
  r := public.salvar_pagamentos(jsonb_build_object('venda_id', vid::text, 'itens',
    jsonb_build_array(jsonb_build_object('forma','pix','valor','200'))));
  if r->>'ok' = 'false' and r->>'erro' like '%nao fecha%' then
    nok:=nok+1; rel:=rel||E'\n  ok  soma que NAO fecha com a venda e recusada';
  else nfa:=nfa+1; rel:=rel||E'\nFALHOU aceitou R$ 200 numa venda de R$ 8.400: '||coalesce(r->>'erro','?'); end if;

  -- valida ANTES de apagar: recusa nao pode deixar a venda sem o que ela tinha
  select count(*) into n from public.venda_pagamento where venda_id = vid;
  if n = 0 then nok:=nok+1; rel:=rel||E'\n  ok  e a recusa nao apagou nada (valida antes de mexer)';
  else nfa:=nfa+1; rel:=rel||E'\nFALHOU gravou '||n||' linhas numa chamada recusada'; end if;

  ------------------------------------------------- 2. o caminho feliz
  r := public.salvar_pagamentos(jsonb_build_object('venda_id', vid::text, 'itens',
    jsonb_build_array(
      jsonb_build_object('forma','pix','valor','3400'),
      jsonb_build_object('forma','cartao_credito','valor','5000','parcelas','5',
                         'bandeira','Visa','taxa','210'))));
  if r->>'ok' = 'true' and (r->>'n')::int = 2 then
    nok:=nok+1; rel:=rel||E'\n  ok  duas formas que somam o valor da venda entram';
  else nfa:=nfa+1; rel:=rel||E'\nFALHOU caminho feliz: '||coalesce(r->>'erro','?'); end if;

  ------------------------------------------------- 3. forma_pagamento DERIVADA
  -- O campo velho da venda nao morre: ele vira consequencia do conjunto, para
  -- nao existirem duas verdades sobre forma de pagamento no mesmo sistema.
  select forma_pagamento into e from public.venda where id = vid;
  if e = 'misto' then nok:=nok+1; rel:=rel||E'\n  ok  duas formas distintas derivam forma_pagamento = misto';
  else nfa:=nfa+1; rel:=rel||E'\nFALHOU derivou '||coalesce(e,'null')||' em vez de misto'; end if;

  ------------------------------------------------- 4. o derivado da leitura
  select valor_parcela into vparc from public.v_venda_pagamento
   where venda_id = vid and forma = 'cartao_credito';
  if vparc = 1000 then nok:=nok+1; rel:=rel||E'\n  ok  valor_parcela derivado na leitura: 5000/5 = 1000';
  else nfa:=nfa+1; rel:=rel||E'\nFALHOU valor_parcela = '||coalesce(vparc,-1); end if;

  select count(*) into n from information_schema.columns
   where table_schema='public' and table_name='venda_pagamento' and column_name='valor_parcela';
  if n = 0 then nok:=nok+1; rel:=rel||E'\n  ok  valor_parcela NAO virou coluna (invariante 4)';
  else nfa:=nfa+1; rel:=rel||E'\nFALHOU valor_parcela foi armazenado'; end if;

  ------------------------------------------------- 5. o default do negocio
  -- "uso a calculadora da pitswall pra obter as taxas. nunca perco taxa, so
  -- repasso" (dono, 16/08/2026). Taxa absorvida e a excecao, nao a regra.
  select taxa_repassada into b from public.venda_pagamento
   where venda_id = vid and forma = 'cartao_credito';
  if b is true then nok:=nok+1; rel:=rel||E'\n  ok  taxa nasce REPASSADA (o dono repassa, nunca absorve)';
  else nfa:=nfa+1; rel:=rel||E'\nFALHOU taxa_repassada nasceu false'; end if;

  ------------------------------------------------- 6. substituir, nao acumular
  r := public.salvar_pagamentos(jsonb_build_object('venda_id', vid::text, 'itens',
    jsonb_build_array(jsonb_build_object('forma','pix','valor','8400'))));
  select count(*) into n from public.venda_pagamento where venda_id = vid;
  if r->>'ok' = 'true' and n = 1 then
    nok:=nok+1; rel:=rel||E'\n  ok  salvar de novo SUBSTITUI o conjunto, nao acumula';
  else nfa:=nfa+1; rel:=rel||E'\nFALHOU ficaram '||n||' linhas'; end if;

  select forma_pagamento into e from public.venda where id = vid;
  if e = 'pix' then nok:=nok+1; rel:=rel||E'\n  ok  e a forma derivada acompanha (voltou para pix)';
  else nfa:=nfa+1; rel:=rel||E'\nFALHOU forma ficou '||coalesce(e,'null'); end if;

  -- credito + debito e UM cartao para o campo velho, nao misto
  r := public.salvar_pagamentos(jsonb_build_object('venda_id', vid::text, 'itens',
    jsonb_build_array(
      jsonb_build_object('forma','cartao_debito','valor','400'),
      jsonb_build_object('forma','cartao_credito','valor','8000','parcelas','10'))));
  select forma_pagamento into e from public.venda where id = vid;
  if r->>'ok' = 'true' and e = 'cartao' then
    nok:=nok+1; rel:=rel||E'\n  ok  credito + debito derivam cartao, e nao misto';
  else nfa:=nfa+1; rel:=rel||E'\nFALHOU derivou '||coalesce(e,'?'); end if;

  ------------------------------------------------- 7. as recusas
  r := public.salvar_pagamentos(jsonb_build_object('venda_id', vid::text, 'itens',
    jsonb_build_array(jsonb_build_object('forma','pix','valor','8400','parcelas','3'))));
  if r->>'ok' = 'false' then nok:=nok+1; rel:=rel||E'\n  ok  parcelar Pix e recusado (so credito parcela)';
  else nfa:=nfa+1; rel:=rel||E'\nFALHOU aceitou Pix em 3x'; end if;

  r := public.salvar_pagamentos(jsonb_build_object('venda_id', vid::text, 'itens',
    jsonb_build_array(jsonb_build_object('forma','cartao_credito','valor','8400','parcelas','36'))));
  if r->>'ok' = 'false' then nok:=nok+1; rel:=rel||E'\n  ok  36x e recusado (teto de 24)';
  else nfa:=nfa+1; rel:=rel||E'\nFALHOU aceitou 36x'; end if;

  r := public.salvar_pagamentos(jsonb_build_object('venda_id', vid::text, 'itens',
    jsonb_build_array(jsonb_build_object('forma','cheque','valor','8400'))));
  if r->>'ok' = 'false' then nok:=nok+1; rel:=rel||E'\n  ok  forma fora do dominio e recusada';
  else nfa:=nfa+1; rel:=rel||E'\nFALHOU aceitou forma inventada'; end if;

  r := public.salvar_pagamentos(jsonb_build_object('venda_id', vid::text, 'itens',
    jsonb_build_array(jsonb_build_object('forma','pix','valor','0'))));
  if r->>'ok' = 'false' then nok:=nok+1; rel:=rel||E'\n  ok  valor zero e recusado';
  else nfa:=nfa+1; rel:=rel||E'\nFALHOU aceitou valor zero'; end if;

  ------------------------------------------------- 8. limpar sem perder o campo
  r := public.salvar_pagamentos(jsonb_build_object('venda_id', vid::text, 'itens', '[]'::jsonb));
  select count(*) into n from public.venda_pagamento where venda_id = vid;
  if r->>'ok' = 'true' and n = 0 then
    nok:=nok+1; rel:=rel||E'\n  ok  lista vazia limpa o detalhamento';
  else nfa:=nfa+1; rel:=rel||E'\nFALHOU limpar: '||coalesce(r->>'erro','?'); end if;

  select forma_pagamento into e from public.venda where id = vid;
  if e = 'cartao' then nok:=nok+1; rel:=rel||E'\n  ok  e limpar NAO apaga a forma que ja estava na venda';
  else nfa:=nfa+1; rel:=rel||E'\nFALHOU forma virou '||coalesce(e,'null')||' ao limpar'; end if;

  ------------------------------------------------- 9. um ponto de escrita so
  begin
    insert into public.venda_pagamento (tenant_id, venda_id, forma, valor)
    values ('00000000-0000-0000-0000-000000000001', vid, 'pix', 1);
    nfa:=nfa+1; rel:=rel||E'\nFALHOU authenticated inseriu pagamento DIRETO na tabela';
  exception when insufficient_privilege then
    nok:=nok+1; rel:=rel||E'\n  ok  authenticated NAO escreve direto: so pela RPC';
  end;

  ------------------------------------------------- 10. isolamento de tenant
  r := public.salvar_pagamentos(jsonb_build_object('venda_id', vid::text, 'itens',
    jsonb_build_array(jsonb_build_object('forma','pix','valor','8400'))));

  perform set_config('request.jwt.claims',
    json_build_object('sub', alheio, 'role', 'authenticated')::text, true);

  select count(*) into n from public.v_venda_pagamento where venda_id = vid;
  if n = 0 then nok:=nok+1; rel:=rel||E'\n  ok  o vizinho nao enxerga pagamento alheio';
  else nfa:=nfa+1; rel:=rel||E'\nFALHOU vizinho viu '||n||' pagamentos'; end if;

  r := public.salvar_pagamentos(jsonb_build_object('venda_id', vid::text, 'itens',
    jsonb_build_array(jsonb_build_object('forma','dinheiro','valor','8400'))));
  if r->>'ok' = 'false' then nok:=nok+1; rel:=rel||E'\n  ok  o vizinho NAO salva pagamento em venda alheia';
  else nfa:=nfa+1; rel:=rel||E'\nFALHOU vizinho salvou pagamento alheio'; end if;

  -- ler como vizinho devolveria zero pelo RLS: volta-se ao dono para conferir
  perform set_config('request.jwt.claims',
    json_build_object('sub', dono, 'role', 'authenticated')::text, true);
  select count(*) into n from public.venda_pagamento where venda_id = vid and forma='pix';
  if n = 1 then nok:=nok+1; rel:=rel||E'\n  ok  e o pagamento do dono continuou intacto';
  else nfa:=nfa+1; rel:=rel||E'\nFALHOU o pix do dono sumiu'; end if;

  ------------------------------------------------- 11. arquivada nao mexe
  r := public.arquivar_venda(vid, true);
  r := public.salvar_pagamentos(jsonb_build_object('venda_id', vid::text, 'itens',
    jsonb_build_array(jsonb_build_object('forma','pix','valor','8400'))));
  if r->>'ok' = 'false' then nok:=nok+1; rel:=rel||E'\n  ok  venda arquivada nao aceita pagamento';
  else nfa:=nfa+1; rel:=rel||E'\nFALHOU mexeu no pagamento de venda arquivada'; end if;

  raise exception E'PROVA PAGAMENTO DA VENDA\n%\n\n% ok, % falhas', rel, nok, nfa;
end $$;
