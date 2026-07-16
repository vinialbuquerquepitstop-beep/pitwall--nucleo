# Dashboard e Indicadores

A aba Dashboard só tem fórmulas e gráficos, nunca dado bruto. Puxa tudo das abas de dados.

## Cartões de KPI (scorecard)
Inserir > Gráfico > Scorecard, para um número grande com comparação (vs mês anterior ou meta). Bons KPIs para a Pitstop:
- Pipeline ponderado total
- Negócios por estágio
- Taxa de conversão (ganhos / fechados)
- Faturamento do mês
- Ticket médio: `=MÉDIA(FILTER(Pipeline!E:E; Pipeline!F:F="Fechado Ganho"))`
- Follow-ups vencidos: `=CONT.SE(Leads!J:J; "<"&HOJE())`

## SPARKLINE (mini-gráfico na célula)
Tendência de vendas:
```
=SPARKLINE(B10:M10; {"charttype"\"line"; "color"\"#34a853"})
```
Progresso da meta (rosca):
```
=SPARKLINE({B1\1-B1}; {"charttype"\"pie"; "colors"\{SE(B1>=0,9;"#34a853";"#3367d6")\"#cccccc"}})
```
(Em planilha com separador `,`, troque `\` por `,` dentro das chaves.)

## Tabela dinâmica e segmentação
- Tabela dinâmica (Inserir > Tabela dinâmica) para resumos agrupados; mais leve que muitos SOMASES.
- Segmentação de dados (Dados > Segmentação) para filtrar o dashboard de forma interativa por dono, estágio ou período.

## Boas práticas
- Comece com um scorecard de destaque + um gráfico de linha com linha de meta. É o combo de maior retorno.
- Evite pizza, 3D e barras empilhadas para KPI; confundem mais do que informam.
- Use cor com parcimônia e com significado (verde = bom, vermelho = atenção), nunca cor como dado.
