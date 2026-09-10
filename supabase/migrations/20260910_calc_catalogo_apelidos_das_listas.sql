-- ─────────────────────────────────────────────────────────────────────────────
-- Catalogo: os apelidos que as listas reais usam, e a regra de condicao no plural.
--
-- Isto e DADO, nao motor. Depois das quatro rodadas de conserto do parser, as
-- listas de 09/09/2026 fecharam assim:
--
--   BR10, primeira metade   29 de 29   100,0%
--   BR10, segunda metade    24 de 31    77,4%
--   MP IMPORTS              28 de 28   100,0%
--   ------------------------------------------
--   somado                  81 de 88    92,0%
--
-- As 7 linhas que faltam nao sao defeito do parser: sao grafia que o catalogo
-- ainda nao conhece, e o parser fez a coisa certa com elas (virou pendencia
-- nomeando o CABECALHO, que e onde o dono ensina o apelido). Este arquivo
-- ensina.
--
-- ── Parte 1: a regra `LACRADOS` no plural ──────────────────────────────────
--
-- Ja foi APLICADA no banco em 09/09/2026, direto do prompt do subagente, e ficou
-- sem arquivo no repo. Entra aqui para o repo parar de discordar do banco. E
-- idempotente: reaplicar nao muda nada.
--
-- Motivo medido: a regra casava `\ylacrado\y`, e o MP escreve o cabecalho no
-- plural (`📱 *IPHONES & ACESSÓRIOS          LACRADOS !!*`). Fronteira de palavra
-- nao casa plural, entao 16 linhas do MP ficavam sem condicao e viravam
-- duvidoso. A ordem CPO (10) antes de Lacrado (20) e obrigatoria e nao muda.
--
-- ── Parte 2: dois apelidos que evitam PERDA SILENCIOSA ─────────────────────
--
-- Estes dois sao diferentes dos outros, e por isso vem primeiro. Medido:
--
--   'AirPods 4 - Sem cancelamento de ruído'  -> casa `AirPods 4`
--   'AirPods 4 - COM cancelamento de ruído'  -> casa `AirPods 4`   <- ERRADO
--
-- O catalogo tem `AirPods 4` e `AirPods 4 ANC` separados. A linha do ANC nao diz
-- a sigla `anc`, diz `COM cancelamento de ruído`, entao o multiconjunto de
-- tokens casa o modelo SEM ANC nos dois casos. Como os dois caem no mesmo
-- modelo, mesmo fornecedor e sem cor, eles viram UM grupo e `min(preco)` fica
-- com R$ 850,00: o AirPods 4 ANC de R$ 1.250,00 **desaparece do blob sem virar
-- pendencia**. Nao e preco errado, e produto sumindo calado, que e pior de
-- achar. O apelido do ANC e mais longo, e `order by length(a.texto) desc` no
-- parser garante que ele ganha do outro.
--
-- ── Parte 3: os apelidos de grafia ─────────────────────────────────────────
--
-- Cada um foi PRE-CHECADO contra a linha real da lista antes de entrar aqui
-- (o alias casa por substring sobre `calc_norm(calc_limpar(...))`, e o travessao
-- `–` do BR10 sai no `calc_limpar`, entao `Series 11 42mm` casa
-- `⌚️ Series 11 – 42mm`). Todos deram `casa = true`.
--
-- Os apelidos carregam a CAPACIDADE ou o TAMANHO de proposito (`iPhone Air
-- 256GB`, nao `iPhone Air`): o alias aponta para UM codigo, entao um apelido sem
-- capacidade mandaria o iPhone Air de 512GB, quando existir, para o registro de
-- 256GB. Apelido mais estreito custa um insert a mais no dia em que a capacidade
-- nova aparecer; apelido largo custa preco no aparelho errado.
--
-- ── Onde entram: semente E tenant ──────────────────────────────────────────
--
-- Nos dois. Sao fatos de como o mercado brasileiro de Apple escreve, nao
-- preferencia deste lojista, entao o proximo tenant deve nascer sabendo. Isso
-- NAO fere a D5 (so o cliente atualiza o catalogo em execucao) nem a regra de
-- nao pendurar `or tenant_id is null` em policy: a semente segue invisivel em
-- execucao, e o parser continua lendo apenas o catalogo do proprio tenant.
--
-- ── O que este arquivo NAO faz ─────────────────────────────────────────────
--
-- Nao cria modelo novo. Faltam de verdade no catalogo, medidos nas duas listas:
-- `iPhone 15 512GB`, `iPhone 15 Pro 1TB`, `iPhone 16 512GB`, `iPhone 16 Pro
-- 512GB` e `Apple Watch Series 3` (40mm e 44mm). Mais o `JBL Boombox 4`, que nao
-- e Apple e nao tem categoria no catalogo: decisao do dono, ainda aberta em
-- 10/09/2026. Modelo novo e outra migration, com o dono decidindo o que entra.
-- ─────────────────────────────────────────────────────────────────────────────

-- ── Parte 1 ─────────────────────────────────────────────────────────────────
update public.calc_regra
   set padrao = '\ylacrado\y|\ylacrados\y|\ynovo\y|\ynovos\y'
 where tipo = 'condicao' and valor = 'Lacrado'
   and padrao <> '\ylacrado\y|\ylacrados\y|\ynovo\y|\ynovos\y';

-- ── Partes 2 e 3 ────────────────────────────────────────────────────────────
-- Um INSERT so, cruzando os apelidos com os dois escopos (semente e tenant do
-- dono). `where not exists` em vez de `on conflict`: a tabela nao declara chave
-- unica sobre (tenant_id, tipo, texto), entao um conflito nao seria pego e o
-- apelido entraria duplicado.
insert into public.calc_alias (tenant_id, tipo, texto, aponta)
select e.tenant_id, 'modelo', a.texto, a.aponta
  from (values
    -- Parte 2: os que evitam perda silenciosa
    ('AirPods 4 - COM cancelamento de ruído', 'airpods_4_anc'),
    ('AirPods 4 - Sem cancelamento de ruído', 'airpods_4'),
    -- Parte 3: grafia
    ('iPhone Air 256GB',        'iphone_17_air_256gb'),
    ('Series 11 42mm',          'apple_watch_s11_42mm'),
    ('Series 11 46mm',          'apple_watch_s11_46mm'),
    ('Ultra 3 49mm',            'apple_watch_ultra_3_49mm'),
    ('AirTag',                  'airtag_pack_4'),
    ('AirPods Pro 3ª geração',  'airpods_pro_3'),
    ('Cabo original Apple',     'cabo_tipo_c_apple'),
    ('MacBook MINI 4 16/256GB', 'mac_mini_m4_16_256gb'),
    ('MACBOOK NEO 256GB/8RAM',  'macbook_neo_13_8_256gb'),
    ('MACBOOK AIR M5 512GB/16RAM', 'macbook_air_m5_13_16_512gb')
  ) as a(texto, aponta)
  cross join (values
    (null::uuid),
    ('00000000-0000-0000-0000-000000000001'::uuid)
  ) as e(tenant_id)
 where not exists (
   select 1 from public.calc_alias x
    where x.tenant_id is not distinct from e.tenant_id
      and x.tipo = 'modelo'
      and privado.calc_norm(x.texto) = privado.calc_norm(a.texto)
 )
   -- trava: apelido nunca aponta para codigo que nao existe naquele escopo.
   -- Sem isto, um erro de digitacao no codigo entra calado e o apelido vira
   -- um buraco que so aparece quando a lista chegar.
   and exists (
     select 1 from public.calc_modelo m
      where m.tenant_id is not distinct from e.tenant_id
        and m.codigo = a.aponta
   );
