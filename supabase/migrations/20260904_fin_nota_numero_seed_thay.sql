-- migration aplicada: 20260905022554_20260904_fin_nota_numero_seed_thay
--
-- E1, passo 2: as tres notas dos saldos que mudaram em 03/09/2026.
--
-- O FATO, medido na tabela auditoria (append-only), nao estimado:
-- em 2026-09-04 01:56:46+00, que e 03/09/2026 22:56:46 no fuso America/Sao_Paulo,
-- 8 linhas de fin_movimento da contraparte Thay foram de dominio 'empresa' para
-- 'pessoal'. Liquido por mes de competencia da linha:
--   fev/2026: 2 linhas, +473,00 e +1400,00  => 1.873,00
--   mar/2026: 3 linhas, -200,00, -800,00 e +3000,00 => 2.000,00
--   mai/2026: 3 linhas, +1300,00, +3500,00 e -400,00 => 4.400,00
--   total 8.273,00, que e exatamente a soma dos tres deltas de saldo_empresa.
--
-- Os seis valores de antes/depois sao os medidos pela fin_painel de producao com o
-- dono autenticado, nao os estimados no plano.
--
-- A decisao da Thay foi do dono e NAO se reverte aqui. Esta migration nao toca em
-- fin_movimento, nao toca em dominio de contraparte nenhuma e nao muda nenhum calculo:
-- ela so escreve a explicacao do que ja aconteceu.
--
-- IDEMPOTENTE por 'on conflict (tenant_id, codigo) do nothing'. Rodar duas vezes nao
-- duplica. A trava no fim falha a migration inteira se o estado alvo nao ficar exato,
-- entao rodar de novo tambem nao mascara valor divergente.

insert into public.fin_nota_numero
  (tenant_id, codigo, escopo, competencia, valor_antes, valor_depois, causa, mudou_em)
values
  ('00000000-0000-0000-0000-000000000001',
   'thay_pessoal_2026_02', 'saldo_empresa', date '2026-02-01',
   3872.09, 1999.09,
   'Em 03/09/2026 você marcou como pessoais 2 lançamentos da Thay que antes contavam como da empresa, e por isso R$ 1.873,00 saíram do saldo da empresa em fevereiro.',
   date '2026-09-03'),
  ('00000000-0000-0000-0000-000000000001',
   'thay_pessoal_2026_03', 'saldo_empresa', date '2026-03-01',
   3864.20, 1864.20,
   'Em 03/09/2026 você marcou como pessoais 3 lançamentos da Thay que antes contavam como da empresa, e por isso R$ 2.000,00 saíram do saldo da empresa em março.',
   date '2026-09-03'),
  ('00000000-0000-0000-0000-000000000001',
   'thay_pessoal_2026_05', 'saldo_empresa', date '2026-05-01',
   5635.02, 1235.02,
   'Em 03/09/2026 você marcou como pessoais 3 lançamentos da Thay que antes contavam como da empresa, e por isso R$ 4.400,00 saíram do saldo da empresa em maio.',
   date '2026-09-03')
on conflict (tenant_id, codigo) do nothing;

-- Trava: a migration falha inteira se as tres notas nao ficarem no estado alvo.
do $$
declare v_n int; v_soma numeric;
begin
  select count(*), coalesce(sum(diferenca), 0) into v_n, v_soma
    from public.fin_nota_numero
   where tenant_id = '00000000-0000-0000-0000-000000000001'
     and codigo in ('thay_pessoal_2026_02','thay_pessoal_2026_03','thay_pessoal_2026_05')
     and escopo = 'saldo_empresa'
     and mudou_em = date '2026-09-03'
     and arquivado_em is null
     and (
       (codigo = 'thay_pessoal_2026_02' and competencia = date '2026-02-01'
          and valor_antes = 3872.09 and valor_depois = 1999.09)
       or (codigo = 'thay_pessoal_2026_03' and competencia = date '2026-03-01'
          and valor_antes = 3864.20 and valor_depois = 1864.20)
       or (codigo = 'thay_pessoal_2026_05' and competencia = date '2026-05-01'
          and valor_antes = 5635.02 and valor_depois = 1235.02)
     );
  if v_n <> 3 then
    raise exception 'fin_nota_numero_seed_thay: esperava 3 notas no estado alvo, encontrei %', v_n;
  end if;
  if v_soma <> -8273.00 then
    raise exception 'fin_nota_numero_seed_thay: esperava soma de diferenca -8273.00, encontrei %', v_soma;
  end if;
end $$;
