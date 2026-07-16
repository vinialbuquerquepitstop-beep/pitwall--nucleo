# Biblioteca de Fórmulas (Google Sheets)

Fórmulas com exemplos aplicados ao CRM. Observação sobre separadores: dependendo da configuração regional da planilha, o separador de argumentos é `;` (comum no Brasil) ou `,`. Os exemplos usam `;`. Se a planilha do usuário usar `,`, troque.

## QUERY (o motor SQL da planilha)
Cliente sem contato há mais de 30 dias:
```
=QUERY(Leads!A:J; "SELECT A, B, C WHERE J < date '"&TEXT(HOJE()-30;"yyyy-mm-dd")&"'"; 1)
```
Faturamento por modelo, do maior para o menor:
```
=QUERY(Pipeline!A:H; "SELECT C, SUM(E) WHERE F='Fechado Ganho' GROUP BY C ORDER BY SUM(E) DESC LABEL SUM(E) 'Total'"; 1)
```
Cuidados: colunas referenciadas por letra; texto entre aspas simples; data como `date 'aaaa-mm-dd'`; não existe HAVING (use um QUERY por fora).

## ARRAYFORMULA (aplica a fórmula na coluna inteira)
Linhas novas calculam sozinhas:
```
=ARRAYFORMULA(SE(LIN(E2:E1000)=1; "Valor ponderado"; E2:E1000*G2:G1000))
```

## FILTER (retorna várias linhas que batem)
Todos os negócios em negociação:
```
=FILTER(Pipeline!A:E; Pipeline!F:F="Negociação")
```

## XLOOKUP (busca em qualquer direção, com tratamento de "não achou")
```
=XLOOKUP(B2; Leads!A:A; Leads!B:B; "não encontrado")
```
Alternativa clássica de duas direções: `=INDICE(retorno; CORRESP(chave; busca; 0))`.

## Indicadores de dashboard
- Negócios por estágio: `=CONT.SE(Pipeline!F:F; "Negociação")`
- Taxa de conversão (ganhos / fechados):
```
=CONT.SE(Pipeline!F:F;"Fechado Ganho") / (CONT.SE(Pipeline!F:F;"Fechado Ganho")+CONT.SE(Pipeline!F:F;"Fechado Perdido"))
```
- Pipeline ponderado total: `=SOMARPRODUTO(Pipeline!E2:E1000; Pipeline!G2:G1000)`
- Faturamento do mês (sobre valor ponderado e data de fechamento):
```
=SOMASES(Pipeline!H:H; Pipeline!I:I; ">="&DATA(ANO(HOJE());MÊS(HOJE());1); Pipeline!I:I; "<"&DATA(ANO(HOJE());MÊS(HOJE())+1;1))
```

## Dropdown dependente (categoria -> subcategoria)
No campo dependente, gerar a lista filtrada:
```
=TRANSPOR(ÚNICO(FILTER(_Config!B:B; _Config!A:A=A2)))
```
Prefira esse caminho com FILTER a usar INDIRETO + intervalo nomeado: INDIRETO é volátil e não escala bem.

## Formatação condicional úteis
- Follow-up vencido (vermelho): regra "fórmula personalizada" `=$J2<HOJE()` na coluna de data da próxima ação.
- Vence em até 3 dias (amarelo): `=E($J2>=HOJE(); $J2<=HOJE()+3)`.

## Cuidados de desempenho
- Evite funções voláteis (AGORA, HOJE, ALEATÓRIO, INDIRETO) espalhadas; isole HOJE() numa célula e referencie.
- Evite intervalos abertos (A:B) quando der; limite o alcance.
- Troque fórmulas já finalizadas por valores (Colar especial > só valores) em bases históricas.
- IMPORTRANGE é lento; minimize.
