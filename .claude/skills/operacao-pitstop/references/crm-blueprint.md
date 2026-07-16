# Blueprint do CRM em Google Sheets

Arquitetura de um CRM funcional dentro do Google Sheets. A regra que sustenta tudo: separar camadas (dados, cálculo, apresentação) e vincular abas por ID estável, nunca por número de linha.

## Abas (estrutura recomendada)

| Aba | Função | Camada |
|-----|--------|--------|
| `_Config` (oculta) | listas de dropdown: estágios, origens, status, donos, modelos, fornecedores | configuração |
| `Leads` | base mestre de pessoas/clientes | dados |
| `Pipeline` | uma linha por oportunidade/negócio | dados |
| `Atividades` | log de cada contato (ligação, WhatsApp, e-mail) | dados |
| `Estoque` | produtos e preço de fornecedor | dados |
| `Entregas` | acompanhamento de fulfillment (Leandro) | dados |
| `Dashboard` | KPIs e gráficos, só fórmulas, sem dado bruto | apresentação |

O prefixo "_" sinaliza "não mexer". Proteja as abas de cálculo e dashboard (Dados > Proteger intervalo), deixando editável só o que é entrada.

## Aba Leads (colunas)
`Lead ID` | `Nome` | `Telefone (WhatsApp)` | `E-mail` | `Origem` | `Status` | `Dono` | `Data de criação` | `Próxima ação` | `Data próxima ação` | `Observações`

- **Lead ID:** `="LEAD-"&TEXT(ROW()-1,"0000")` (gera LEAD-0001, LEAD-0002...). ID estável é o que liga esta aba às outras.
- **Origem, Status, Dono:** dropdowns puxando de `_Config`.
- **Próxima ação / Data próxima ação:** as duas colunas mais valiosas do CRM. Ficam na frente, bem visíveis.

## Aba Pipeline (colunas)
`Deal ID` | `Lead ID` | `Modelo` | `Armazenamento` | `Valor` | `Estágio` | `Probabilidade` | `Valor ponderado` | `Fechamento previsto` | `Dono` | `Próximo passo`

- **Deal ID:** `="DEAL-"&TEXT(ROW()-1,"0000")`.
- **Lead ID:** dropdown ou referência aos IDs da aba Leads (liga o negócio à pessoa).
- **Probabilidade automática por estágio:**
  `=IFS(F2="Contato Inicial";0,1; F2="Qualificação";0,25; F2="Proposta";0,5; F2="Negociação";0,75; F2="Fechado Ganho";1; F2="Fechado Perdido";0)`
- **Valor ponderado:** `=E2*G2`
- **Sinalizar negócio parado/atrasado:**
  `=SE(E(I2<HOJE(); F2<>"Fechado Ganho"; F2<>"Fechado Perdido"); "ATRASADO"; "")`

## Aba Atividades (colunas)
`Data` | `Lead ID` | `Deal ID` | `Tipo` | `Resumo` | `Próxima ação`

Tipo: Ligação, WhatsApp, E-mail, Visita, Outro (dropdown).

## Aba Estoque (colunas)
`SKU` | `Modelo` | `Armazenamento` | `Custo fornecedor (BRL)` | `Preço de venda` | `Margem` | `Fornecedor` | `Qtd disponível` | `Atualizado em`

- **Margem:** `=(E2-D2)/E2` formatada como porcentagem.

## Aba Entregas (colunas)
`Entrega ID` | `Deal ID` | `Cliente` | `Endereço` | `Status` | `Courier` | `Data prevista` | `Confirmado`

Status: Pendente, A caminho, Entregue, Reagendada (dropdown).

## Relações entre abas
- Leads 1 -> N Pipeline (uma pessoa pode ter vários negócios), via `Lead ID`.
- Pipeline 1 -> N Atividades, via `Deal ID`.
- Pipeline 1 -> 1 Entregas, via `Deal ID`.

Puxar o nome do cliente para o Pipeline a partir do Lead ID:
`=XLOOKUP(B2; Leads!A:A; Leads!B:B; "não encontrado")`

## Quando o Sheets deixa de servir
Planilha aguenta bem operação pequena (até ~2.000 a 5.000 linhas ativas, poucos usuários editando). Passou disso, ou precisa de log automático de e-mail/ligação, acesso mobile bom e relatório de verdade, recomende migrar para Pipedrive ou HubSpot (exporta CSV; os IDs estáveis tornam a migração limpa). Não empurre planilha além do ponto em que ela vira gargalo.
