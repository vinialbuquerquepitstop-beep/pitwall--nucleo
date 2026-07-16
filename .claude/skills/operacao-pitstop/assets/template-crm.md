# Template de CRM (pronto para montar)

Sequência mínima para o usuário montar o CRM no Google Sheets dele. Sete abas. Monte na ordem.

## 1. Aba `_Config` (oculte depois)
Coluna A: estágios do funil (Contato Inicial, Qualificação, Proposta, Negociação, Fechado Ganho, Fechado Perdido).
Coluna B: origens (Instagram, WhatsApp, Indicação, Cliente recorrente, Outro).
Coluna C: status (Novo, Em andamento, Concluído, Perdido).
Coluna D: donos (nomes do time).
Coluna E: modelos.
Coluna F: fornecedores.

## 2. Aba `Leads`
Cabeçalho: Lead ID | Nome | Telefone | E-mail | Origem | Status | Dono | Data criação | Próxima ação | Data próxima ação | Observações
Em Lead ID (B2 pra baixo, ou A2): `="LEAD-"&TEXT(LIN()-1;"0000")`
Origem/Status/Dono: validação de dados puxando de `_Config`.
Formatação condicional na coluna Data próxima ação: vermelho se `=$J2<HOJE()`.

## 3. Aba `Pipeline`
Cabeçalho: Deal ID | Lead ID | Modelo | Armazenamento | Valor | Estágio | Probabilidade | Valor ponderado | Fechamento previsto | Dono | Próximo passo
Probabilidade: `=IFS(F2="Contato Inicial";0,1;F2="Qualificação";0,25;F2="Proposta";0,5;F2="Negociação";0,75;F2="Fechado Ganho";1;F2="Fechado Perdido";0)`
Valor ponderado: `=E2*G2`
Nome do cliente (se quiser exibir): `=XLOOKUP(B2;Leads!A:A;Leads!B:B;"")`

## 4. Aba `Atividades`
Cabeçalho: Data | Lead ID | Deal ID | Tipo | Resumo | Próxima ação

## 5. Aba `Estoque`
Cabeçalho: SKU | Modelo | Armazenamento | Custo fornecedor | Preço venda | Margem | Fornecedor | Qtd | Atualizado em
Margem: `=(E2-D2)/E2` (formatar como %)

## 6. Aba `Entregas`
Cabeçalho: Entrega ID | Deal ID | Cliente | Endereço | Status | Courier | Data prevista | Confirmado

## 7. Aba `Dashboard`
Cartões: pipeline ponderado, negócios por estágio, taxa de conversão, faturamento do mês, follow-ups vencidos. Fórmulas em biblioteca-formulas.md e dashboard.md.

## Checagem final (auditoria de entrega)
Rode a checklist de "Auditoria de entrega" do SKILL.md antes de dar como pronto.
