-- Prova de banco do molde de conteudo (Fatias 1 e 2, 13-14/08/2026).
-- Itens 1 a 10 da secao 6 da spec (Fatia 1: cache, recusa, RLS, privilegio) e
-- 11 a 20 (Fatia 2: o cruzamento com o calendario), da spec
-- docs/superpowers/specs/2026-08-13-molde-conteudo-notion-design.md
--
-- Roda, escreve, assere e termina em `raise exception`: o bloco inteiro e uma
-- transacao so, entao nada fica no banco e o molde v3 real sobrevive intacto.
-- O relatorio sai dentro da mensagem do erro.
-- ERRO com "0 falhas" no fim = APROVOU. Qualquer outro erro = REPROVOU.
--
-- Reexecutar: colar em execute_sql do MCP do Supabase, ou psql -f.
do $$
declare
  ten1   uuid := '00000000-0000-0000-0000-000000000001';
  dono   uuid := 'fb2aad8e-b728-4e59-a198-71da2156449d';
  alheio uuid := 'aaaaaaaa-0000-0000-0000-00000000000a';
  ten2   uuid := 'aaaaaaaa-0000-0000-0000-00000000000b';
  rel text := ''; nok int := 0; nfa int := 0;
  bom jsonb; r jsonb; n int; h1 text; h2 text; t1 timestamptz; t2 timestamptz;
  pay jsonb; logs int; sofreu boolean;
  -- Fatia 2: a semana de 05 a 11/01/2026 foi escolhida VAZIA (medido: 0 cards)
  -- para o cruzamento se provar contra o dado que esta prova mesma cria, nunca
  -- contra o calendario real, que muda a cada sincronizacao.
  ref date := date '2026-01-08';   -- quinta da semana 05 a 11/01/2026
  dia jsonb;
begin
  insert into public.tenant(id, nome) values (ten2, 'Tenant vizinho (prova molde)');
  insert into public.app_usuario(id, tenant_id, nome, papel, ativo)
  values (alheio, ten2, 'Vizinho (prova molde)', 'dono', true);

  -- Molde valido de prova. version 99 para nao disputar com a v3 real.
  bom := jsonb_build_object(
    'molde','pitstop-grade-conteudo','version',99,'vigente_desde','2026-08-13',
    'story_slots', jsonb_build_array(jsonb_build_object('slot',1,'janela','07h-08h')),
    'metas', jsonb_build_object('reels_semana',3,'carrossel_semana',1,'stories_semana',49),
    'semana', jsonb_build_array(
      jsonb_build_object('dia','segunda','motor','iphone_volume','feed','reel_topo'),
      jsonb_build_object('dia','terca','motor','macbook','feed','carrossel'),
      jsonb_build_object('dia','quarta','motor','autoridade_apple','feed','reel'),
      jsonb_build_object('dia','quinta','motor','caixinha_e_oferta','feed',null),
      jsonb_build_object('dia','sexta','motor','seguranca_procedencia','feed','reel'),
      jsonb_build_object('dia','sabado','motor','ecossistema','feed',null),
      jsonb_build_object('dia','domingo','motor','indicacao_posvenda','feed',null)));

  ---------------------------------------------------------------- 1. gravou
  r := public.sincronizar_molde(ten1, bom, 'bloco-prova', 'cron', 12);
  select hash, lido_em into h1, t1 from public.conteudo_molde where tenant_id=ten1 and version=99;
  if (r->>'ok')='true' and (r->>'acao')='inserido' and h1 is not null
     and (select notion_block_id from public.conteudo_molde where tenant_id=ten1 and version=99)='bloco-prova'
  then nok:=nok+1; rel:=rel||E'\n  ok  1. molde valido grava linha com hash, lido_em e block_id';
  else nfa:=nfa+1; rel:=rel||E'\nFALHOU 1. nao gravou: '||coalesce(r::text,'(null)'); end if;

  ------------------------------------------------- 2. reler o mesmo nao duplica
  -- now() no Postgres e a hora de INICIO DA TRANSACAO: dentro deste bloco ela
  -- nao anda, entao pg_sleep nao serve para provar que lido_em avancou. A
  -- propriedade real (releitura bem sucedida ZERA o staleness) se prova
  -- envelhecendo a linha primeiro, o mesmo padrao da prova do Escopo.
  update public.conteudo_molde set lido_em = now() - interval '5 days'
   where tenant_id=ten1 and version=99;
  select lido_em into t1 from public.conteudo_molde where tenant_id=ten1 and version=99;
  r := public.sincronizar_molde(ten1, bom, 'bloco-prova', 'cron', 12);
  select count(*) into n from public.conteudo_molde where tenant_id=ten1 and version=99;
  select lido_em into t2 from public.conteudo_molde where tenant_id=ten1 and version=99;
  if (r->>'acao')='inalterado' and n=1 and t2 > t1
  then nok:=nok+1; rel:=rel||E'\n  ok  2. reler o mesmo molde nao cria linha, so renova lido_em';
  else nfa:=nfa+1; rel:=rel||format(E'\nFALHOU 2. acao=%s linhas=%s lido_em avancou=%s',
       r->>'acao', n, (t2 > t1)); end if;

  --------------------------- 3. payload mudou sem subir version: hash + aviso
  select count(*) into logs from public.conteudo_sync_log where tenant_id=ten1 and escopo='molde';
  r := public.sincronizar_molde(ten1, jsonb_set(bom,'{metas,reels_semana}','5'), 'bloco-prova','cron',12);
  select hash into h2 from public.conteudo_molde where tenant_id=ten1 and version=99;
  select count(*) into n from public.conteudo_molde where tenant_id=ten1 and version=99;
  if (r->>'acao')='atualizado' and h2 <> h1 and n=1
     and jsonb_array_length(r->'avisos')=1
     and (select count(*) from public.conteudo_sync_log
           where tenant_id=ten1 and escopo='molde' and msg like '%sem a version subir%') = 1
  then nok:=nok+1; rel:=rel||E'\n  ok  3. editar sem subir version muda o hash, reescreve a linha e AVISA';
  else nfa:=nfa+1; rel:=rel||format(E'\nFALHOU 3. acao=%s hash mudou=%s avisos=%s',
       r->>'acao', (h2 <> h1), r->'avisos'); end if;

  ---------------------------------------- 4. version MENOR e recusada, cache fica
  select payload into pay from public.conteudo_molde where tenant_id=ten1 and version=99;
  r := public.sincronizar_molde(ten1, jsonb_set(bom,'{version}','98'), 'bloco-prova','cron',12);
  if (r->>'ok')='false' and (r->>'acao')='recusado' and r->>'msg' like '%MENOR%'
     and (select payload from public.conteudo_molde where tenant_id=ten1 and version=99) = pay
     and not exists (select 1 from public.conteudo_molde where tenant_id=ten1 and version=98)
  then nok:=nok+1; rel:=rel||E'\n  ok  4. version menor e RECUSADA e o cache anterior fica byte a byte igual';
  else nfa:=nfa+1; rel:=rel||E'\nFALHOU 4. '||coalesce(r::text,'(null)'); end if;

  ----------------------------------------------- 5. payload que nao e objeto
  r := public.sincronizar_molde(ten1, '"isto nao e objeto"'::jsonb, null, 'cron', 1);
  if (r->>'acao')='recusado'
  then nok:=nok+1; rel:=rel||E'\n  ok  5. payload que nao e objeto e recusado';
  else nfa:=nfa+1; rel:=rel||E'\nFALHOU 5. '||coalesce(r::text,'(null)'); end if;

  ------------------------------------------------------- 6. marca errada
  r := public.sincronizar_molde(ten1, jsonb_set(bom,'{molde}','"outra-coisa"'), null,'cron',1);
  if (r->>'acao')='recusado' and r->>'msg' like '%pitstop-grade-conteudo%'
  then nok:=nok+1; rel:=rel||E'\n  ok  6. molde com marca diferente e recusado (a chave e o campo, nao o titulo)';
  else nfa:=nfa+1; rel:=rel||E'\nFALHOU 6. '||coalesce(r::text,'(null)'); end if;

  ------------------------------------------------------- 7. semana com 6 dias
  r := public.sincronizar_molde(ten1,
        jsonb_set(bom,'{semana}', (bom->'semana') - 6), null,'cron',1);
  if (r->>'acao')='recusado' and r->>'msg' like '%7 dias%'
  then nok:=nok+1; rel:=rel||E'\n  ok  7. semana com 6 dias e recusada';
  else nfa:=nfa+1; rel:=rel||E'\nFALHOU 7. '||coalesce(r::text,'(null)'); end if;

  -- 7b. segunda linha de defesa: nem por INSERT direto um molde quebrado pousa
  sofreu := false;
  begin
    insert into public.conteudo_molde(tenant_id,version,payload,hash)
    values (ten1, 97, jsonb_build_object('molde','pitstop-grade-conteudo'), 'x');
  exception when check_violation then sofreu := true; end;
  if sofreu then nok:=nok+1; rel:=rel||E'\n  ok  7b. CHECK barra molde quebrado ate por INSERT direto';
  else nfa:=nfa+1; rel:=rel||E'\nFALHOU 7b. INSERT direto de molde quebrado passou'; end if;

  ------------------------------------- 8. os dois escopos de log convivem
  perform public.registrar_falha_molde(ten1,'cron','falha de prova do molde',5);
  perform public.registrar_falha_sync(ten1,'cron','falha de prova do calendario',5);
  if (select count(*) from public.conteudo_sync_log
       where tenant_id=ten1 and escopo='molde' and msg='falha de prova do molde')=1
     and (select count(*) from public.conteudo_sync_log
       where tenant_id=ten1 and escopo='calendario' and msg='falha de prova do calendario')=1
  then nok:=nok+1; rel:=rel||E'\n  ok  8. falha do molde e falha do calendario deixam rastros DISTINGUIVEIS';
  else nfa:=nfa+1; rel:=rel||E'\nFALHOU 8. os dois escopos de log nao se separam'; end if;

  ------------------------------------------------------------- 9. RLS
  perform set_config('request.jwt.claims',
    json_build_object('sub', alheio, 'role','authenticated')::text, true);
  perform set_config('role','authenticated', true);
  select count(*) into n from public.conteudo_molde;
  if n=0 then nok:=nok+1; rel:=rel||E'\n  ok  9. tenant vizinho le ZERO linhas de conteudo_molde';
  else nfa:=nfa+1; rel:=rel||format(E'\nFALHOU 9. tenant vizinho enxergou %s linha(s)', n); end if;

  perform set_config('request.jwt.claims',
    json_build_object('sub', dono, 'role','authenticated')::text, true);
  select count(*) into n from public.conteudo_molde where version=99;
  if n=1 then nok:=nok+1; rel:=rel||E'\n  ok  9b. o dono continua enxergando o proprio molde';
  else nfa:=nfa+1; rel:=rel||format(E'\nFALHOU 9b. dono viu %s linha(s) da version 99', n); end if;

  --------------------------------------------------- 10. privilegio minimo
  perform set_config('role','postgres', true);
  if not has_table_privilege('authenticated','public.conteudo_molde','INSERT')
     and not has_table_privilege('authenticated','public.conteudo_molde','UPDATE')
     and not has_table_privilege('authenticated','public.conteudo_molde','DELETE')
     and has_table_privilege('authenticated','public.conteudo_molde','SELECT')
  then nok:=nok+1; rel:=rel||E'\n  ok  10. authenticated so LE conteudo_molde';
  else nfa:=nfa+1; rel:=rel||E'\nFALHOU 10. authenticated tem escrita em conteudo_molde'; end if;

  if not has_function_privilege('authenticated',
        'public.sincronizar_molde(uuid,jsonb,text,text,integer)','EXECUTE')
     and has_function_privilege('service_role',
        'public.sincronizar_molde(uuid,jsonb,text,text,integer)','EXECUTE')
     and has_function_privilege('authenticated','public.molde_semana(date)','EXECUTE')
  then nok:=nok+1; rel:=rel||E'\n  ok  10b. so service_role escreve o molde; authenticated so le pela RPC';
  else nfa:=nfa+1; rel:=rel||E'\nFALHOU 10b. ACL errada nas funcoes do molde'; end if;

  select count(*) into n from pg_proc p join pg_namespace ns on ns.oid=p.pronamespace
   where ns.nspname='public' and p.proname in ('sincronizar_molde','molde_semana','registrar_falha_molde')
     and p.prosecdef;
  if n=0 then nok:=nok+1; rel:=rel||E'\n  ok  10c. as tres funcoes sao SECURITY INVOKER (a RLS vale)';
  else nfa:=nfa+1; rel:=rel||format(E'\nFALHOU 10c. %s funcao(oes) viraram SECURITY DEFINER', n); end if;

  --====================================================================
  -- FATIA 2: o CRUZAMENTO. A grade deixa de so descrever e passa a cobrar.
  -- Aqui se prova o que a tela vai DIZER, nao o que ela pinta: planejamento e
  -- execucao como canais separados, e a fronteira do `fora do molde`.
  --====================================================================

  ------------------------------- 11. semana vazia nao inventa peca nenhuma
  r := public.molde_semana(ref);
  dia := r->'dias'->0;   -- segunda, o dia que o molde de prova pede reel_topo
  if (dia->>'existe')='false' and (dia->>'no_ar')='false'
     and jsonb_array_length(dia->'fora_do_molde')=0
     and (r->'stories'->>'existentes')='0' and (r->'stories'->>'previstos')='49'
  then nok:=nok+1; rel:=rel||E'\n  ok  11. semana sem card nenhum: existe=false, no ar=false, nada fora do molde';
  else nfa:=nfa+1; rel:=rel||E'\nFALHOU 11. semana vazia devolveu '||coalesce(dia::text,'(null)'); end if;

  ------------------- 12. peca criada acende PLANEJAMENTO, e so ele
  -- O molde de prova pede reel_topo na segunda; a ponte diz que isso e o tipo
  -- `reels` do Calendario. Se a ponte quebrar, este item cai.
  insert into public.conteudo(tenant_id,fonte,notion_page_id,titulo,data,tipo_codigo,status_codigo)
  values (ten1,'calendario','pg-prova-seg','Reel de prova (segunda)',ref-3,'reels','a_produzir');
  dia := public.molde_semana(ref)->'dias'->0;
  if (dia->>'existe')='true' and (dia->>'no_ar')='false'
  then nok:=nok+1; rel:=rel||E'\n  ok  12. card criado marca existe SEM marcar no ar (os dois canais nao se somam)';
  else nfa:=nfa+1; rel:=rel||E'\nFALHOU 12. '||coalesce(dia::text,'(null)'); end if;

  --------------------------------- 13. publicar acende EXECUCAO
  update public.conteudo set status_codigo='publicado' where notion_page_id='pg-prova-seg';
  dia := public.molde_semana(ref)->'dias'->0;
  if (dia->>'existe')='true' and (dia->>'no_ar')='true'
  then nok:=nok+1; rel:=rel||E'\n  ok  13. publicar acende no ar, e existe continua aceso';
  else nfa:=nfa+1; rel:=rel||E'\nFALHOU 13. '||coalesce(dia::text,'(null)'); end if;

  ------------------------------- 14. card DESCARTADO nao e peca que existe
  insert into public.conteudo(tenant_id,fonte,notion_page_id,titulo,data,tipo_codigo,status_codigo)
  values (ten1,'calendario','pg-prova-qua','Reel descartado (quarta)',ref-1,'reels','descartado');
  dia := public.molde_semana(ref)->'dias'->2;   -- quarta
  if (dia->>'existe')='false' and jsonb_array_length(dia->'fora_do_molde')=0
  then nok:=nok+1; rel:=rel||E'\n  ok  14. card descartado nao conta como existe nem como fora do molde';
  else nfa:=nfa+1; rel:=rel||E'\nFALHOU 14. '||coalesce(dia::text,'(null)'); end if;

  --------- 15. A ARMADILHA: story em dia de folga NUNCA e fora do molde
  -- Story tem regua propria (os 7 slots). Se ele entrasse no cruzamento, os 7
  -- stories que o proprio molde manda existir apareceriam como violacao.
  insert into public.conteudo(tenant_id,fonte,notion_page_id,titulo,data,tipo_codigo,status_codigo)
  values (ten1,'calendario','pg-prova-sab-story','Story de sabado',ref+2,'story','a_produzir');
  dia := public.molde_semana(ref)->'dias'->5;   -- sabado, dia sem peca no molde
  if jsonb_array_length(dia->'fora_do_molde')=0
  then nok:=nok+1; rel:=rel||E'\n  ok  15. story em dia de folga NAO e fora do molde (a armadilha dos 7 falsos positivos)';
  else nfa:=nfa+1; rel:=rel||E'\nFALHOU 15. story virou violacao: '||coalesce(dia::text,'(null)'); end if;

  ------------- 16. peca de feed em dia que o molde nao pede: fora do molde
  insert into public.conteudo(tenant_id,fonte,notion_page_id,titulo,data,tipo_codigo,status_codigo)
  values (ten1,'calendario','pg-prova-sab-carr','Carrossel de sabado',ref+2,'carrossel','a_produzir');
  dia := public.molde_semana(ref)->'dias'->5;
  if dia->'fora_do_molde' = '["carrossel"]'::jsonb
  then nok:=nok+1; rel:=rel||E'\n  ok  16. carrossel em dia de folga aparece como fora do molde';
  else nfa:=nfa+1; rel:=rel||E'\nFALHOU 16. '||coalesce((dia->'fora_do_molde')::text,'(null)'); end if;

  --------- 17. tipo DIFERENTE do pedido no mesmo dia: fora do molde tambem
  insert into public.conteudo(tenant_id,fonte,notion_page_id,titulo,data,tipo_codigo,status_codigo)
  values (ten1,'calendario','pg-prova-seg-carr','Carrossel na segunda',ref-3,'carrossel','a_produzir');
  dia := public.molde_semana(ref)->'dias'->0;
  if dia->'fora_do_molde' = '["carrossel"]'::jsonb and (dia->>'existe')='true'
  then nok:=nok+1; rel:=rel||E'\n  ok  17. peca de tipo errado no dia certo e fora do molde, e nao apaga o existe';
  else nfa:=nfa+1; rel:=rel||E'\nFALHOU 17. '||coalesce(dia::text,'(null)'); end if;

  ------------------------------- 18. story se conta no agregado da semana
  insert into public.conteudo(tenant_id,fonte,notion_page_id,titulo,data,tipo_codigo,status_codigo)
  values (ten1,'calendario','pg-prova-st2','Story 2',ref-2,'story','publicado'),
         (ten1,'calendario','pg-prova-st3','Story 3',ref-1,'story','a_produzir'),
         (ten1,'calendario','pg-prova-st4','Story descartado',ref,'story','descartado');
  r := public.molde_semana(ref);
  if (r->'stories'->>'existentes')='3' and (r->'stories'->>'no_ar')='1'
     and (r->'stories'->>'previstos')='49'
  then nok:=nok+1; rel:=rel||E'\n  ok  18. stories 3 de 49, 1 no ar, e o descartado nao conta';
  else nfa:=nfa+1; rel:=rel||E'\nFALHOU 18. stories='||coalesce((r->'stories')::text,'(null)'); end if;

  ---------------- 19. sem molde nao existe grade, nem depois da Fatia 2
  -- O tenant vizinho nunca teve molde: a resposta nao pode nem CARREGAR a
  -- chave `dias`, senao a tela ganha de onde desenhar uma grade que nao existe.
  perform set_config('request.jwt.claims',
    json_build_object('sub', alheio, 'role','authenticated')::text, true);
  r := public.molde_semana(ref);
  if (r->>'tem_molde')='false' and not (r ? 'dias') and not (r ? 'stories')
  then nok:=nok+1; rel:=rel||E'\n  ok  19. tenant sem molde nao recebe dias nem stories (a regra de ouro sobreviveu a Fatia 2)';
  else nfa:=nfa+1; rel:=rel||E'\nFALHOU 19. '||coalesce(r::text,'(null)'); end if;
  perform set_config('request.jwt.claims',
    json_build_object('sub', dono, 'role','authenticated')::text, true);

  ------------------------- 20. o REPLACE da Fatia 2 nao afrouxou a ACL
  -- CREATE OR REPLACE FUNCTION reseta ACL em silencio: aqui se cobra o REVOKE.
  if has_function_privilege('authenticated','public.molde_semana(date)','EXECUTE')
     and not has_function_privilege('anon','public.molde_semana(date)','EXECUTE')
  then nok:=nok+1; rel:=rel||E'\n  ok  20. depois do REPLACE: authenticated executa, anon nao';
  else nfa:=nfa+1; rel:=rel||E'\nFALHOU 20. ACL de molde_semana afrouxou no REPLACE'; end if;

  raise exception E'PROVA MOLDE DE CONTEUDO (FATIAS 1 e 2) -- % ok, % falhas%', nok, nfa, rel;
end $$;
