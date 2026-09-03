-- migration aplicada: 20260903040422_20260903_fin_comissao_vira_receita_pessoal
--
-- Redefine a categoria 'comissao': era custo de operacao, passa a ser entrada pessoal.
--
-- POR QUE
-- Declaracao do dono: "comissao e entrada financeira minha, nao operacao como motoboy."
-- A base concorda. Existe EXATAMENTE 1 movimento com categoria_codigo = 'comissao':
--   id 8f38bcd7-78ee-4e2e-9a3c-c7504d1f728e, data 2026-08-06,
--   contraparte 'BRABA STUDIOS LTDA', valor +4800.00, dominio 'pessoal'.
-- Ou seja: uma ENTRADA numa categoria de natureza 'saida', com dominio 'pessoal'
-- numa categoria que sugeria 'empresa'. Na tela isso desenhava R$ 4.800 de renda
-- DENTRO do bloco de custo, com o sinal invertido: em agosto/2026 o grupo
-- 'Operação' aparecia com total -4275,00 (custo negativo), porque a linha
-- 'Comissão' entrava como total -4800,00 / abatido 4800,00.
--
-- O QUE MUDA: 4 campos (grupo, natureza_esperada, dominio_sugerido, ordem).
-- O 'codigo' NAO muda (Inv. 12: codigo e a chave e e imutavel).
-- O 'rotulo' NAO muda. 'ativo' e 'atribuivel_manual' NAO mudam.
--
-- NOTA SOBRE A ORDEM (achado, o brief presumia 28 livre)
-- 'ordem' nesta tabela e uma sequencia GLOBAL 1..34, nao por grupo, e 28 ja
-- pertence a 'outro_pessoal' ('Outro (pessoal)', grupo 'Outros'). Nao existe
-- unique em (tenant_id, ordem), entao o empate e legal, e 'fin_config' ordena por
-- (ordem, rotulo), o que torna o desempate deterministico: 'Comissão' vem antes de
-- 'Outro (pessoal)'. Como sao grupos diferentes na tela, o empate nao e visivel.
-- Fica 28 por decisao consciente: nao ha inteiro livre entre 28 e 29, e renumerar
-- as demais categorias seria mudanca maior sem ganho visivel. Dentro do grupo
-- 'Receita' o resultado e o pedido: 14, 15, 16, 17, 28 (Comissão), 29 (Pró-labore),
-- 30 (Outra entrada pessoal, que segue sendo o ultimo, catch-all).
--
-- CONSEQUENCIA FUTURA, REGISTRADA
-- Este codigo passou a significar o OPOSTO do que significava. No dia em que o dono
-- PAGAR comissao ao consultor por esta conta, isso exige um codigo proprio (ex.
-- 'comissao_paga', saida / empresa / grupo 'Operação'). Nao se reaproveita este.
--
-- FRONTEIRAS RESPEITADAS
-- Nao toca 'fin_movimento' (a linha do BRABA STUDIOS segue com dominio 'pessoal').
-- Nao cria nem desativa categoria. Nao mexe em app.js (a categoria e servida por
-- 'fin_config', invariante C2, entao a tela absorve sozinha).
-- Conferido antes de aplicar: nenhuma linha de 'fin_regra' aponta para 'comissao'
-- e nenhuma funcao em 'public' ou 'privado' cita 'comissao' no corpo.

update public.fin_categoria
   set grupo             = 'Receita',
       natureza_esperada = 'entrada',
       dominio_sugerido  = 'pessoal',
       ordem             = 28,
       atualizado_em     = now()
 where tenant_id = '00000000-0000-0000-0000-000000000001'
   and codigo    = 'comissao';

-- Trava: a migration falha inteira se o estado alvo nao ficar exato.
do $$
declare v_n int;
begin
  select count(*) into v_n
    from public.fin_categoria
   where tenant_id         = '00000000-0000-0000-0000-000000000001'
     and codigo            = 'comissao'
     and rotulo            = 'Comissão'
     and grupo             = 'Receita'
     and natureza_esperada = 'entrada'
     and dominio_sugerido  = 'pessoal'
     and ordem             = 28
     and ativo
     and atribuivel_manual;
  if v_n <> 1 then
    raise exception 'fin_comissao_vira_receita_pessoal: esperava 1 linha no estado alvo, encontrei %', v_n;
  end if;
end $$;
