-- migration aplicada: 20260826014901_fin_fatia1_seed_config
-- Os codigo ficam SEM acento (chave, invariante 12); os rotulo carregam os
-- caracteres reais do sistema e sao preservados exatamente.

insert into public.fin_conta (tenant_id, codigo, rotulo, banco, tipo, dominio_padrao, ordem)
values ('00000000-0000-0000-0000-000000000001', 'principal', 'Conta principal', null, 'corrente', 'misto', 1)
on conflict (tenant_id, codigo) do nothing;

insert into public.fin_categoria (tenant_id, codigo, rotulo, grupo, natureza_esperada, dominio_sugerido, ordem) values
('00000000-0000-0000-0000-000000000001','compra_aparelho','Compra de aparelho','Mercadoria','saida','empresa',1),
('00000000-0000-0000-0000-000000000001','frete_envio','Frete e envio','Operação','saida','empresa',2),
('00000000-0000-0000-0000-000000000001','taxa_maquineta','Taxa de maquineta','Taxas','saida','empresa',3),
('00000000-0000-0000-0000-000000000001','taxa_bancaria','Taxa bancária','Taxas','saida','empresa',4),
('00000000-0000-0000-0000-000000000001','motoboy','Motoboy','Operação','saida','empresa',5),
('00000000-0000-0000-0000-000000000001','embalagem','Embalagem','Operação','saida','empresa',6),
('00000000-0000-0000-0000-000000000001','anuncio_trafego','Anúncio e tráfego','Marketing','saida','empresa',7),
('00000000-0000-0000-0000-000000000001','software_ferramenta','Software e ferramenta','Operação','saida','empresa',8),
('00000000-0000-0000-0000-000000000001','imposto','Imposto','Taxas','saida','empresa',9),
('00000000-0000-0000-0000-000000000001','contador','Contador','Operação','saida','empresa',10),
('00000000-0000-0000-0000-000000000001','telefone_internet','Telefone e internet','Operação','saida','empresa',11),
('00000000-0000-0000-0000-000000000001','comissao','Comissão','Operação','saida','empresa',12),
('00000000-0000-0000-0000-000000000001','outro_empresa','Outro (empresa)','Outros','saida','empresa',13),
('00000000-0000-0000-0000-000000000001','venda_aparelho','Venda de aparelho','Receita','entrada','empresa',14),
('00000000-0000-0000-0000-000000000001','entrada_trade_in','Entrada / trade-in','Receita','entrada','empresa',15),
('00000000-0000-0000-0000-000000000001','servico','Serviço','Receita','entrada','empresa',16),
('00000000-0000-0000-0000-000000000001','outro_entrada','Outra entrada','Receita','entrada','empresa',17),
('00000000-0000-0000-0000-000000000001','moradia','Moradia','Casa','saida','pessoal',18),
('00000000-0000-0000-0000-000000000001','mercado','Mercado','Casa','saida','pessoal',19),
('00000000-0000-0000-0000-000000000001','alimentacao_fora','Alimentação fora','Vida','saida','pessoal',20),
('00000000-0000-0000-0000-000000000001','transporte','Transporte','Vida','saida','pessoal',21),
('00000000-0000-0000-0000-000000000001','saude','Saúde','Vida','saida','pessoal',22),
('00000000-0000-0000-0000-000000000001','educacao','Educação','Vida','saida','pessoal',23),
('00000000-0000-0000-0000-000000000001','lazer','Lazer','Vida','saida','pessoal',24),
('00000000-0000-0000-0000-000000000001','assinatura','Assinatura','Vida','saida','pessoal',25),
('00000000-0000-0000-0000-000000000001','vestuario','Vestuário','Vida','saida','pessoal',26),
('00000000-0000-0000-0000-000000000001','familia','Família','Casa','saida','pessoal',27),
('00000000-0000-0000-0000-000000000001','outro_pessoal','Outro (pessoal)','Outros','saida','pessoal',28),
('00000000-0000-0000-0000-000000000001','prolabore','Pró-labore','Receita','entrada','pessoal',29),
('00000000-0000-0000-0000-000000000001','outro_pessoal_entrada','Outra entrada pessoal','Receita','entrada','pessoal',30),
('00000000-0000-0000-0000-000000000001','transferencia_interna','Transferência entre contas','Neutro','neutro','ambos',31),
('00000000-0000-0000-0000-000000000001','aplicacao','Aplicação','Neutro','neutro','ambos',32),
('00000000-0000-0000-0000-000000000001','resgate','Resgate','Neutro','neutro','ambos',33)
on conflict (tenant_id, codigo) do nothing;
