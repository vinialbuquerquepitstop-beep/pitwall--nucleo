-- Prova de banco da ETAPA da venda (v61, 15/08/2026).
--
-- Roda como `authenticated` com os claims do dono, cria a venda de teste pela
-- PROPRIA RPC (nao por insert direto, senao o teste nao prova o caminho que a
-- tela usa) e termina em `raise exception`: o bloco inteiro e uma transacao so,
-- entao tudo que ela escreve volta atras e nenhum VENDA-000X e queimado.
-- ERRO com "0 falhas" no fim = APROVOU. Qualquer outro erro = REPROVOU.
--
-- ARMADILHA DE METODO, aprendida aqui na 1a rodada:
--   `now()` e CONSTANTE dentro de uma transacao. Comparar dois `now()` nao
--   prova nada — os dois carimbos saem identicos. Na 1a rodada a assercao do
--   "recarimbou" REPROVOU e a do "nao zerou" PASSOU, as duas pelo mesmo motivo
--   errado. Onde o carimbo importa, este arquivo EMPURRA etapa_em para o
--   passado (como dono do banco, porque `authenticated` nao tem UPDATE na
--   venda) e mede se ele voltou para o presente.
--
-- Reexecutar: colar em execute_sql do MCP do Supabase, ou psql -f.
do $$
declare
  dono   uuid := 'fb2aad8e-b728-4e59-a198-71da2156449d';
  alheio uuid := 'aaaaaaaa-0000-0000-0000-00000000000a';
  ten2   uuid := 'aaaaaaaa-0000-0000-0000-00000000000b';
  rel text := ''; nok int := 0; nfa int := 0;
  r jsonb; vid uuid; n int; e text; st text;
  t0 timestamptz; t1 timestamptz; dias int; aud0 int; aud1 int;
begin
  insert into public.tenant(id, nome) values (ten2, 'Tenant vizinho (prova)');
  insert into public.app_usuario(id, tenant_id, nome, papel, ativo)
  values (alheio, ten2, 'Vizinho (prova)', 'dono', true);

  perform set_config('request.jwt.claims',
    json_build_object('sub', dono, 'role', 'authenticated')::text, true);
  perform set_config('role', 'authenticated', true);

  ------------------------------------------------------------ 1. o nascimento
  r := public.registrar_venda(jsonb_build_object(
        'modelo_texto','iPhone de prova','valor_venda','1000',
        'comprador_nome','Comprador de prova','comprador_whatsapp','21999990000',
        'status','pre_venda','etapa','pendente'));
  if r->>'ok' = 'true' then nok:=nok+1; rel:=rel||E'\n  ok  registrar_venda aceita a etapa';
  else nfa:=nfa+1; rel:=rel||E'\nFALHOU registrar_venda: '||coalesce(r->>'erro','?'); end if;
  vid := (r->>'id')::uuid;

  select etapa, etapa_em into e, t0 from public.venda where id = vid;
  if e = 'pendente' then nok:=nok+1; rel:=rel||E'\n  ok  a venda nasce na etapa pedida';
  else nfa:=nfa+1; rel:=rel||E'\nFALHOU nasceu em '||coalesce(e,'null'); end if;
  if t0 is not null then nok:=nok+1; rel:=rel||E'\n  ok  etapa_em carimbado no nascimento';
  else nfa:=nfa+1; rel:=rel||E'\nFALHOU etapa_em nulo no nascimento'; end if;

  r := public.registrar_venda(jsonb_build_object(
        'modelo_texto','x','valor_venda','1','comprador_nome','y',
        'etapa','etapa_inventada'));
  if r->>'ok' = 'false' then nok:=nok+1; rel:=rel||E'\n  ok  registrar_venda recusa etapa fora do dominio';
  else nfa:=nfa+1; rel:=rel||E'\nFALHOU aceitou etapa inventada no cadastro'; end if;

  ------------------------------------------------------------ 2. o movimento
  select count(*) into aud0 from public.auditoria
   where tabela='venda' and registro_id=vid::text and acao='UPDATE';

  r := public.mover_etapa_venda(vid, 'a_retirar');
  if r->>'ok' = 'true' and r->>'etapa' = 'a_retirar' then
    nok:=nok+1; rel:=rel||E'\n  ok  mover_etapa_venda anda para a_retirar';
  else nfa:=nfa+1; rel:=rel||E'\nFALHOU mover: '||coalesce(r->>'erro','?'); end if;

  -- o rotulo vem do DICIONARIO, nao chumbado na funcao (invariante 12)
  if r->>'etapa_rotulo' = 'A retirar' then nok:=nok+1; rel:=rel||E'\n  ok  o rotulo sai do dicionario_rotulos';
  else nfa:=nfa+1; rel:=rel||E'\nFALHOU rotulo veio como '||coalesce(r->>'etapa_rotulo','?'); end if;

  if r->>'de' = 'pendente' then nok:=nok+1; rel:=rel||E'\n  ok  a resposta diz DE ONDE a venda saiu';
  else nfa:=nfa+1; rel:=rel||E'\nFALHOU nao declarou a etapa de origem'; end if;

  -- UM movimento = UM registro de auditoria (invariante 6, append-only)
  select count(*) into aud1 from public.auditoria
   where tabela='venda' and registro_id=vid::text and acao='UPDATE';
  if aud1 = aud0 + 1 then nok:=nok+1; rel:=rel||E'\n  ok  um movimento gera exatamente um registro de auditoria';
  else nfa:=nfa+1; rel:=rel||E'\nFALHOU auditoria foi de '||aud0||' para '||aud1; end if;

  select count(*) into n from public.auditoria
   where tabela='venda' and registro_id=vid::text and acao='UPDATE'
     and antes->>'etapa' = 'pendente' and depois->>'etapa' = 'a_retirar';
  if n = 1 then nok:=nok+1; rel:=rel||E'\n  ok  a auditoria guarda o antes E o depois da etapa';
  else nfa:=nfa+1; rel:=rel||E'\nFALHOU auditoria sem antes/depois da etapa'; end if;

  ------------------------------------------- 3. o carimbo (com passado forjado)
  perform set_config('role', 'postgres', true);
  update public.venda set etapa_em = now() - interval '5 days' where id = vid;
  perform set_config('role', 'authenticated', true);
  select etapa_em into t0 from public.venda where id = vid;

  r := public.mover_etapa_venda(vid, 'em_maos');
  select etapa_em into t1 from public.venda where id = vid;
  if t0 < now() and t1 = now() then
    nok:=nok+1; rel:=rel||E'\n  ok  mover recarimba etapa_em (de 5 dias atras para agora)';
  else nfa:=nfa+1; rel:=rel||E'\nFALHOU etapa_em nao voltou para o presente: '||coalesce(t1::text,'null'); end if;

  ------------------------------------------------------------ 4. as recusas
  r := public.mover_etapa_venda(vid, 'em_maos');
  if r->>'ok' = 'false' then nok:=nok+1; rel:=rel||E'\n  ok  toque repetido na mesma etapa e recusado (nao zera o contador de dias)';
  else nfa:=nfa+1; rel:=rel||E'\nFALHOU aceitou mover para a etapa em que ja estava'; end if;

  r := public.mover_etapa_venda(vid, 'voando');
  if r->>'ok' = 'false' then nok:=nok+1; rel:=rel||E'\n  ok  etapa fora do dominio e recusada';
  else nfa:=nfa+1; rel:=rel||E'\nFALHOU aceitou etapa invalida'; end if;

  r := public.mover_etapa_venda(gen_random_uuid(), 'em_maos');
  if r->>'ok' = 'false' then nok:=nok+1; rel:=rel||E'\n  ok  venda inexistente e recusada';
  else nfa:=nfa+1; rel:=rel||E'\nFALHOU moveu uma venda que nao existe'; end if;

  ------------------------------- 5. entregue FECHA a venda (e so quando fecha)
  r := public.mover_etapa_venda(vid, 'entregue');
  select status into st from public.venda where id = vid;
  if r->>'ok' = 'true' and st = 'concluida' and r->>'status_promovido' = 'true' then
    nok:=nok+1; rel:=rel||E'\n  ok  entregue promove pre_venda para concluida, e DECLARA a promocao';
  else nfa:=nfa+1; rel:=rel||E'\nFALHOU promocao: status='||coalesce(st,'?')||' declarou='||coalesce(r->>'status_promovido','?'); end if;

  -- a venda que ja era concluida nao e "promovida" de novo: nao ha o que declarar
  r := public.mover_etapa_venda(vid, 'a_caminho');
  r := public.mover_etapa_venda(vid, 'entregue');
  if r->>'status_promovido' = 'false' then nok:=nok+1; rel:=rel||E'\n  ok  venda ja concluida nao anuncia promocao que nao houve';
  else nfa:=nfa+1; rel:=rel||E'\nFALHOU anunciou promocao numa venda ja concluida'; end if;

  ------------------------------------------------- 6. quem NAO anda no fluxo
  r := public.editar_venda(jsonb_build_object('id', vid::text, 'status','cancelada'));
  r := public.mover_etapa_venda(vid, 'pendente');
  if r->>'ok' = 'false' then nok:=nok+1; rel:=rel||E'\n  ok  venda cancelada nao anda no fluxo';
  else nfa:=nfa+1; rel:=rel||E'\nFALHOU venda cancelada andou no fluxo'; end if;
  r := public.editar_venda(jsonb_build_object('id', vid::text, 'status','concluida'));

  r := public.arquivar_venda(vid, true);
  r := public.mover_etapa_venda(vid, 'pendente');
  if r->>'ok' = 'false' then nok:=nok+1; rel:=rel||E'\n  ok  venda arquivada nao anda no fluxo';
  else nfa:=nfa+1; rel:=rel||E'\nFALHOU venda arquivada andou no fluxo'; end if;
  r := public.arquivar_venda(vid, false);

  ------------------------- 7. o carimbo NAO se mexe sem troca de etapa
  perform set_config('role', 'postgres', true);
  update public.venda set etapa_em = now() - interval '5 days' where id = vid;
  perform set_config('role', 'authenticated', true);
  select etapa_em into t0 from public.venda where id = vid;

  r := public.editar_venda(jsonb_build_object('id', vid::text, 'observacoes','mexi so na observacao'));
  select etapa_em into t1 from public.venda where id = vid;
  if t1 = t0 and t1 < now() then
    nok:=nok+1; rel:=rel||E'\n  ok  salvar o formulario sem trocar de etapa NAO zera "ha X dias aqui"';
  else nfa:=nfa+1; rel:=rel||E'\nFALHOU etapa_em mudou numa edicao que nao tocou na etapa'; end if;

  -- e o "ha X dias" que o quadro exibe sai justamente desse carimbo antigo
  select dias_na_etapa into dias from public.v_venda where id = vid;
  if dias = 5 then nok:=nok+1; rel:=rel||E'\n  ok  dias_na_etapa conta do carimbo, nao do dia da consulta';
  else nfa:=nfa+1; rel:=rel||E'\nFALHOU dias_na_etapa = '||coalesce(dias,-1)||', esperado 5'; end if;

  -- e a correcao pelo formulario TAMBEM carimba, quando a etapa muda de fato
  r := public.editar_venda(jsonb_build_object('id', vid::text, 'etapa','a_caminho'));
  select etapa, etapa_em into e, t1 from public.venda where id = vid;
  if e = 'a_caminho' and t1 = now() then
    nok:=nok+1; rel:=rel||E'\n  ok  corrigir a etapa pelo formulario carimba igual a RPC do fluxo';
  else nfa:=nfa+1; rel:=rel||E'\nFALHOU correcao pelo formulario: etapa='||coalesce(e,'?'); end if;

  r := public.editar_venda(jsonb_build_object('id', vid::text, 'etapa','etapa_torta'));
  if r->>'ok' = 'false' then nok:=nok+1; rel:=rel||E'\n  ok  editar_venda tambem recusa etapa fora do dominio';
  else nfa:=nfa+1; rel:=rel||E'\nFALHOU editar_venda aceitou etapa invalida'; end if;

  select count(*) into n from information_schema.columns
   where table_schema='public' and table_name='venda' and column_name='dias_na_etapa';
  if n = 0 then nok:=nok+1; rel:=rel||E'\n  ok  dias_na_etapa NAO virou coluna (invariante 4)';
  else nfa:=nfa+1; rel:=rel||E'\nFALHOU dias_na_etapa foi armazenado como coluna'; end if;

  ------------------------------------------------- 8. o isolamento de tenant
  perform set_config('request.jwt.claims',
    json_build_object('sub', alheio, 'role', 'authenticated')::text, true);

  select count(*) into n from public.v_venda where id = vid;
  if n = 0 then nok:=nok+1; rel:=rel||E'\n  ok  o vizinho nao enxerga a venda na v_venda';
  else nfa:=nfa+1; rel:=rel||E'\nFALHOU vizinho enxergou a venda'; end if;

  r := public.mover_etapa_venda(vid, 'pendente');
  if r->>'ok' = 'false' then nok:=nok+1; rel:=rel||E'\n  ok  o vizinho NAO move a etapa de venda alheia';
  else nfa:=nfa+1; rel:=rel||E'\nFALHOU vizinho moveu venda de outro tenant'; end if;

  -- Conferir a etapa AINDA como vizinho leria null (o RLS esconde a linha) e a
  -- assercao passaria sem provar nada sobre a escrita. Volta-se ao dono para ler.
  perform set_config('request.jwt.claims',
    json_build_object('sub', dono, 'role', 'authenticated')::text, true);

  select etapa into e from public.venda where id = vid;
  if e = 'a_caminho' then nok:=nok+1; rel:=rel||E'\n  ok  e a etapa continuou onde estava';
  else nfa:=nfa+1; rel:=rel||E'\nFALHOU a etapa virou '||coalesce(e,'?')||' depois do vizinho'; end if;

  ------------------------------------------------- 9. o dominio do dicionario
  select count(*) into n from public.dicionario_rotulos where dominio='etapa_venda';
  if n = 5 then nok:=nok+1; rel:=rel||E'\n  ok  as 5 etapas estao no dicionario';
  else nfa:=nfa+1; rel:=rel||E'\nFALHOU o dicionario tem '||n||' etapas de venda'; end if;

  -- a colisao que este desenho existe para evitar: `etapa` ja e do LEAD
  select count(*) into n from public.dicionario_rotulos
   where dominio='etapa' and codigo in ('pendente','a_retirar','em_maos','a_caminho','entregue');
  if n = 0 then nok:=nok+1; rel:=rel||E'\n  ok  a etapa da VENDA nao invadiu o dominio `etapa` do LEAD';
  else nfa:=nfa+1; rel:=rel||E'\nFALHOU etapa de venda vazou para o dominio do lead'; end if;

  raise exception E'PROVA ETAPA DA VENDA\n%\n\n% ok, % falhas', rel, nok, nfa;
end $$;
