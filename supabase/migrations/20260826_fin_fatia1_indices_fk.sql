-- migration aplicada: 20260826015511_fin_fatia1_indices_fk
-- Cobre as FK de NEGOCIO apontadas pelo advisor de performance.
-- As FK de criado_por (fin_conta, fin_categoria, fin_movimento) ficam sem indice
-- de proposito: sao coluna de auditoria, nunca criterio de busca, e o resto da base
-- (venda.criado_por, captacao.criado_por, lead_evento.criado_por) vive igual.
create index fin_mov_categoria_idx  on public.fin_movimento (tenant_id, categoria_codigo);
create index fin_mov_conta_idx      on public.fin_movimento (conta_id);
create index fin_imp_conta_fk_idx   on public.fin_importacao (conta_id);
