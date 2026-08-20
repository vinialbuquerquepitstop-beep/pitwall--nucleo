-- Aplicada em 20/08/2026 (migration posvenda_p3_pede_indicacao).
--
-- Fatia 3, o que faltava: pedido de indicacao explicito no pos-venda.
-- O botao de um clique no Pitscare JA EXISTIA (commit 7d5f3f9: a aba renderiza os
-- tres grupos em modo "fila", que traz Chamar no WhatsApp + Sugerir mensagem via
-- waHrefFila e prefetchFilaSug), e sugerir_mensagem ja atendia perfil 'comprou'
-- com P1..P6 x 3 variantes. O handoff v65 listou esse item como pendente por engano.
--
-- O furo real era outro: indicacao so era pedida no P4 (D90). O P3 (D30) era o unico
-- passo do pos-venda que nao pedia NADA, e e justamente onde o cliente esta mais
-- satisfeito (um mes de uso sem problema).
--
-- Indicacao vale 40% de conversao e R$ 14.170 da receita, e nao havia nada
-- sistematizado pedindo antes de 90 dias.
--
-- O cuidado vem ANTES do pedido nas tres variantes: primeiro pergunta se esta tudo
-- certo, depois pede. Pedir sem cuidar e cobranca.
-- Invariante 14 respeitado: Direto pede o contato, Consultivo explica o porque,
-- Leve nao pesa. Invariante 15: nenhuma assinatura formal (nao e primeiro contato).
-- O rotulo do passo NAO muda: cadencia_estado ja gravou 'P3 · D30' nos leads vivos,
-- e mexer no rotulo criaria divergencia entre a regra e os estados existentes.

update public.dicionario_scripts set
  texto_template = 'Oi {nome}! Um mês de {produto}. Está tudo rodando redondo? Qualquer coisa de garantia ou dúvida de uso, é só me chamar. E se alguém que você conhece estiver atrás de um Apple, me manda o contato que eu cuido.',
  atualizado_em = now()
where perfil = 'comprou' and passo = 3 and variante = 1;

update public.dicionario_scripts set
  texto_template = 'Oi {nome}, Vini aqui. Um mês de {produto}. Está funcionando como você esperava? Se aparecer qualquer coisa de garantia, eu cuido. Aproveito pra perguntar: tem alguém perto de você pensando em trocar de aparelho? Prefiro atender quem chega por indicação, dá pra cuidar melhor da pessoa.',
  atualizado_em = now()
where perfil = 'comprou' and passo = 3 and variante = 2;

update public.dicionario_scripts set
  texto_template = 'Oi {nome}! Um mês de {produto}. Tudo certo por aí? Se rolar de indicar alguém, é só passar meu contato.',
  atualizado_em = now()
where perfil = 'comprou' and passo = 3 and variante = 3;
