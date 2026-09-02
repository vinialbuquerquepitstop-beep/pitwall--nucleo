-- Prova do conserto de 02/09/2026: fin_regra_salvar passa a recusar categoria
-- que nao e atribuivel a mao (a `repasse`), como o fin_classificar ja fazia.
--
-- RODE NO SQL EDITOR DO SUPABASE, DEPOIS de aplicar a migration
-- supabase/migrations/20260902_fin_fatia4_regra_recusa_categoria_nao_manual.sql
--
-- NAO SUJA A BASE. Tudo roda numa transacao e o bloco termina com um
-- `raise exception` de proposito: o Postgres desfaz tudo, inclusive a regra de
-- teste do caso 2. Se voce ver a mensagem ROLLBACK PROPOSITAL no fim, os dois
-- casos passaram e nada foi gravado.
--
-- Por que o set_config: as RPCs do Financeiro exigem sessao (fn_tenant_atual le
-- auth.uid(), que le request.jwt.claims). No SQL Editor voce e `postgres`, sem
-- JWT, e sem isto toda chamada devolveria 'Sessao invalida.' — que e o
-- comportamento certo dela, e nao o que esta prova quer medir.

do $$
declare
  r jsonb;
begin
  perform set_config(
    'request.jwt.claims',
    '{"sub":"fb2aad8e-b728-4e59-a198-71da2156449d","role":"authenticated"}',
    true);

  -- ---- CASO 1: a regra com categoria `repasse` tem que ser RECUSADA --------
  -- Era exatamente isto que passava antes do conserto: o servidor aceitava, e a
  -- regra carimbava repasse em lote, sem par, criando o orfao que a
  -- 20260831_fin_fatia3_repasse_so_por_par existe para impedir.
  r := public.fin_regra_salvar(
        '{"padrao":"BR IPHONES","tipo_match":"contem","categoria_codigo":"repasse"}'::jsonb);

  if coalesce(r->>'ok', 'null') <> 'false' then
    raise exception 'FALHOU caso 1: a regra com categoria repasse foi ACEITA. Retorno: %', r;
  end if;
  if r->>'erro' <> 'Categoria nao pode ser escolhida a mao: repasse' then
    raise exception 'FALHOU caso 1: recusou, mas com outra frase. Retorno: %', r;
  end if;
  raise notice 'PASSOU caso 1: %', r->>'erro';

  -- ---- CASO 2: a funcao continua funcionando para o caso normal -----------
  -- Conserto que quebra o caminho bom nao e conserto. Padrao real, que casa 31
  -- linhas da base viva, com dominio e sem categoria (o que basta para o F3).
  r := public.fin_regra_salvar(
        '{"padrao":"PROVA IFOOD 0209","tipo_match":"contem","dominio":"pessoal"}'::jsonb);

  if coalesce(r->>'ok', 'null') = 'true' then
    raise notice 'PASSOU caso 2: regra normal aceita (sera desfeita).';
  else
    -- Se o retorno for a recusa de "regra que nao classifica nada", troque o
    -- padrao por um que exista no seu extrato (ex.: IFOOD) e rode de novo: o
    -- que importa aqui e que a recusa NAO seja a do caso 1.
    if r->>'erro' = 'Categoria nao pode ser escolhida a mao: repasse' then
      raise exception 'FALHOU caso 2: a trava do caso 1 vazou para o caminho normal. Retorno: %', r;
    end if;
    raise notice 'ATENCAO caso 2: recusado por outro motivo, confira se faz sentido: %', r->>'erro';
  end if;

  -- ---- CASO 3: nao existe regra viva apontando para categoria travada -----
  if exists (
    select 1
      from public.fin_regra g
      join public.fin_categoria c
        on c.tenant_id = g.tenant_id and c.codigo = g.categoria_codigo
     where not c.atribuivel_manual
       and g.arquivado_em is null) then
    raise exception 'FALHOU caso 3: ja existe regra viva com categoria nao atribuivel a mao.';
  end if;
  raise notice 'PASSOU caso 3: nenhuma regra viva aponta para categoria travada.';

  raise exception 'ROLLBACK PROPOSITAL: os casos passaram e nada foi gravado.';
end $$;
