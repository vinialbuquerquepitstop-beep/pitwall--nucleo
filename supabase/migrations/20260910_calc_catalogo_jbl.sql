-- ─────────────────────────────────────────────────────────────────────────────
-- Catalogo: JBL Boombox 4 entra. Decisao do dono, 10/09/2026.
--
-- Estava aberta desde a medicao das listas reais: o MP IMPORTS vende
-- `🎼JBL BOOMBOX 4` a R$ 2.199,99, e o catalogo nao tinha onde por. O dono
-- decidiu que entra.
--
-- ── Categoria propria, nao `Acessório` ─────────────────────────────────────
--
-- Segue o precedente que o catalogo JA usa para produto que nao e Apple: marca
-- vira categoria. `Garmin` tem seis modelos na categoria `Garmin`, e
-- `Moto Elétrica` tem a sua. Enfiar caixa de som em `Acessório` misturaria um
-- produto de R$ 2.200 com cabo de R$ 90 na mesma linha de margem, e a margem da
-- calc e POR CATEGORIA.
--
-- Consequencia declarada, e ela e do mesmo tipo da D4a: a escada de comissao do
-- consultor (`config.comissao`) cobre `iPhone`, `iPad`, `Apple Watch` e
-- `MacBook`. `JBL` nao esta la, entao a calc do consultor vai mostrar
-- **`Consultar loja`** para ele, que e o comportamento seguro ja existente
-- (`com()` devolve null quando a categoria falta, e nunca calcula zero).
-- Nao invento o numero: quando o dono disser quanto paga de comissao em JBL, ele
-- entra junto com o de `Acessório`.
--
-- Mesmo criterio para a MARGEM: `JBL` tambem nao esta nas margens por categoria.
-- Isso precisa ser resolvido ANTES de a calc do dono precificar JBL, senao ela
-- cai no que for o default da categoria ausente. Fica registrado como pendencia
-- no handoff, nao resolvido as cegas aqui.
--
-- Entra na semente E no tenant, pelo mesmo motivo dos apelidos: o proximo
-- lojista que revende JBL deve nascer sabendo. A semente segue invisivel em
-- execucao (D5).
-- ─────────────────────────────────────────────────────────────────────────────

-- ── CORRECAO de 10/09/2026, achada aplicando ──────────────────────────────
--
-- A primeira versao deste arquivo fazia so o insert e REPROVOU:
--
--   ERROR: 23514: new row for relation "calc_modelo" violates check constraint
--          "calc_modelo_categoria_ck"
--
-- `categoria` nao e texto livre: e conjunto FECHADO por CHECK com oito valores.
-- O precedente que o comentario acima invoca (`Garmin`, `Moto Elétrica`) e real,
-- mas os dois entraram DENTRO do CHECK, quando ele foi escrito. Valor novo exige
-- recriar a constraint, e e o que entra agora.
--
-- E a categoria esta travada em QUATRO lugares, nao um. Os outros tres NAO sao
-- deste arquivo e ficam registrados para nao virarem surpresa:
--
--   public/calc/index.html:1493   const KCATS=[... oito ...]
--   public/calc/index.html:552    const SEMMARGEM=new Set([...])
--   ferramentas/prova_catalogo.js:84   assere a lista EXATA por regex
--
-- A prova reprova se o HTML mudar sem ela, e isso e o guard-rail funcionando:
-- adicionar categoria e mudanca coordenada, nao um insert solto.

alter table public.calc_modelo drop constraint if exists calc_modelo_categoria_ck;
alter table public.calc_modelo add  constraint calc_modelo_categoria_ck
  check (categoria = any (array[
    'iPhone','iPad','MacBook','Apple Watch','Acessório',
    '1ª Linha','Garmin','Moto Elétrica','JBL']));

insert into public.calc_modelo (tenant_id, codigo, nome, categoria, ativo)
select e.tenant_id, 'jbl_boombox_4', 'JBL Boombox 4', 'JBL', true
  from (values
    (null::uuid),
    ('00000000-0000-0000-0000-000000000001'::uuid)
  ) as e(tenant_id)
 where not exists (
   select 1 from public.calc_modelo m
    where m.tenant_id is not distinct from e.tenant_id
      and m.codigo = 'jbl_boombox_4'
 );

-- O MP escreve `🎼JBL BOOMBOX 4`, sem espaco depois do emoji e sem capacidade.
-- O casamento por token nao precisa de apelido aqui (`jbl boombox 4` casa
-- inteiro), mas a grafia com `Boom Box` separado aparece em lista de fornecedor
-- e custaria uma pendencia. Entra so a variante que NAO casa sozinha.
insert into public.calc_alias (tenant_id, tipo, texto, aponta)
select e.tenant_id, 'modelo', 'JBL Boom Box 4', 'jbl_boombox_4'
  from (values
    (null::uuid),
    ('00000000-0000-0000-0000-000000000001'::uuid)
  ) as e(tenant_id)
 where not exists (
   select 1 from public.calc_alias x
    where x.tenant_id is not distinct from e.tenant_id
      and x.tipo = 'modelo'
      and privado.calc_norm(x.texto) = privado.calc_norm('JBL Boom Box 4')
 )
   and exists (
     select 1 from public.calc_modelo m
      where m.tenant_id is not distinct from e.tenant_id
        and m.codigo = 'jbl_boombox_4'
   );
