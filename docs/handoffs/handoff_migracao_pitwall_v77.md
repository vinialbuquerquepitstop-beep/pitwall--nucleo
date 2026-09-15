# Handoff de Migração Pit Wall v77

Data: 15/09/2026
Linha: CRM / Fila Operacional v2
Estado: Fatia 7 concluída e integrada ao `main`.

## 1. O que esta entrega fecha

A Fatia 7 adiciona **alertas e degradação operacional** à Fila Operacional v2. O objetivo não é criar outro dashboard, nem notificação externa. A aba Hoje passa a sinalizar apenas quando um fato operacional ultrapassa um limite objetivo.

Com esta entrega, as Fatias 0 a 7 previstas em `docs/processos/fila-operacional-v2.md` ficam implementadas no núcleo atual.

## 2. Base técnica usada

A implementação reaproveita fatos já existentes:

- `public.v_lead` para estado vivo da fila, primeiro toque, canal, pós-venda, vencimento e veredito;
- `painel_do_dia()` para estado da régua (`ok`, `horas`, `erro`, `atrasados` etc.);
- `public.regua_execucao` para uma leitura histórica curta do backlog atrasado;
- indicadores da Fatia 6, especialmente `sem_canal`;
- `vOperacional()` e `vPos()` continuam soberanas para classificação de trabalho executável.

Não houve migration, nova tabela, nova coluna, nova RPC ou escrita de alerta em banco.

## 3. Alertas implementados

### Prioridade vencida

Dispara apenas quando um item acionável com `veredito = prioridade` está vencido há mais de 1 dia.

A interface mostra quantidade, idade da ocorrência mais antiga e declara o limite de 1 dia.

### Primeiro toque atrasado

Dispara quando lead pendente ainda não possui `primeiro_toque_em` e `horas_esperando_1o_toque >= 24`.

A interface mostra quantidade e o tempo do mais antigo. O limite de 24h fica explícito.

### Pós-venda vencido

Usa `vPos()` e considera degradação apenas quando o vencimento é anterior a hoje. Item devido hoje não é chamado de vencido.

### Sem canal

Reaproveita `metricas.sem_canal` da Fatia 6. É tratado como degradação crítica porque existe trabalho devido que não pode ser executado sem corrigir o cadastro.

### Backlog em crescimento contínuo

A leitura histórica consulta `regua_execucao` em modo somente leitura e consolida uma observação por dia em `America/Sao_Paulo`.

O alerta só existe quando os três dias mais recentes formam crescimento estrito:

`hoje > ontem > anteontem`

Platô, queda ou histórico insuficiente não geram alerta.

Se a leitura histórica falhar, a aba Hoje continua funcionando; apenas esse sinal histórico deixa de ser calculado.

### Régua degradada

A régua entra como estado crítico quando:

- não existe execução registrada;
- a última execução retornou `ok = false`;
- ou a última execução tem 26h ou mais.

O limiar de 26h mantém coerência com a leitura já existente de `reguaLinha()`.

## 4. Estado vivo observado antes da implementação

Na leitura de produção realizada em 15/09/2026:

- 2 leads estavam sem primeiro toque há pelo menos 24h;
- o mais antigo aguardava cerca de 986h;
- os 2 eram acionáveis, com consentimento e canal válidos;
- não havia prioridade acionável vencida há mais de 1 dia;
- havia 7 pós-vendas vencidos;
- havia 0 pendência devida sem canal;
- a última execução da régua estava `ok = true` e com cerca de 12h de idade;
- o backlog diário recente não estava em crescimento estrito por três dias consecutivos.

Esses números foram apenas diagnóstico. Nenhum valor foi fixado no código.

## 5. Interface

Foi criada a faixa **Atenção operacional**, posicionada na aba Hoje depois da leitura geral e antes de Pendências.

Regras visuais:

- o bloco não existe quando não há alerta;
- atenção usa a semântica `--morno-*`;
- falha operacional crítica usa `--erro-*`;
- cada sinal informa quantidade/estado, motivo e limite quando aplicável;
- quando existe destino operacional, há atalho `abrir` para Fila, Pitscare ou Todos;
- desktop usa grade compacta de duas colunas;
- mobile empilha em uma coluna.

A captura real foi conferida antes do merge e manteve a hierarquia da Hoje: alertas como exceção, Pendências como trabalho aberto e Fila como execução.

## 6. Arquivos persistentes alterados

- `public/app.js`
- `public/app.css`
- `ferramentas/prova_fila_operacional_v2_fatia7.js`

Arquivos temporários de patch e workflow foram removidos antes do merge.

## 7. Provas

Workflow de validação da Fatia 7: run `35016481505`.

Portas estritas aprovadas:

- `git diff --check`;
- `python ferramentas/validar.py` — TUDO PASSOU;
- prova base Fila Operacional v2: 30/30;
- Fatia 3: 10/10;
- Fatia 4: 10/10;
- Fatia 5: 10/10;
- Fatia 6: 12/12;
- Fatia 7: 10/10;
- harmonia da Hoje: 12/12;
- diagnóstico 390px: zero sobreposição/overflow;
- diagnóstico 1280px: zero sobreposição/overflow.

Artefato visual da execução: `fila-fatia7-visual`, artifact id `10414769443`.

## 8. Harness histórico

O `ferramentas/harness.py` permanece diagnóstico e contém dívida anterior à Fatia 7.

Nesta execução, além das antigas expectativas incompatíveis com o reload integral do Modo Próximo da Fatia 5, o harness interrompeu mais adiante em uma prova financeira com `Cannot read properties of null (reading 'click')`, deixando testes posteriores sem execução.

Isso não apareceu nas portas específicas da Fila/Hoje, que ficaram verdes. Não alterar o comportamento aprovado da Fila para satisfazer essas expectativas históricas; a dívida do harness deve ser tratada separadamente.

## 9. Merge

Branch de trabalho:

`codex/fila-operacional-v2-fatia7`

Produto aplicado na branch:

`c7a9a62` — `feat(crm): adiciona alertas da Fatia 7 [fat7-applied]`

Branch final limpa:

`b1c6ab91683af67a66b050a819b3d15e003ad407`

Merge real de dois pais no `main`:

`96b30d6da6e7e4e9573760c96c8f08a92fd723c1`

Pais:

1. `714264f15599b2b7a233375c33976548cdb63b07`
2. `b1c6ab91683af67a66b050a819b3d15e003ad407`

## 10. Invariantes preservados

- nenhum alerta envia mensagem;
- abrir WhatsApp continua diferente de registrar toque;
- `toque_enviado` continua explícito;
- `sugerir_mensagem` continua única fonte de copy;
- consentimento não é inferido;
- sem canal não vira trabalho acionável;
- ordem e classificação continuam vindas da fila existente;
- nenhum alerta cria persistência paralela de estado;
- `Fechou` continua passando pelo fluxo real de venda.

## 11. Estado da Fila Operacional v2

As Fatias 0 a 7 do processo estão fechadas no núcleo atual:

0. descoberta/contrato de estado;
1. classificação operacional;
2. card operacional;
3. execução assistida;
4. desfecho rápido;
5. Modo Próximo;
6. indicadores de execução;
7. alertas e degradação.

Não existe uma Fatia 8 definida no processo atual.

## 12. Próximo passo

O próximo passo deve ser **estabilização operacional da Fila v2**, não criação automática de nova fatia.

Sequência recomendada para essa estabilização:

1. usar a Fila/Hoje em operação real e observar se os limiares da Fatia 7 produzem sinal útil sem ruído;
2. corrigir separadamente a dívida do harness histórico para que a suíte volte a refletir o contrato atual das Fatias 5–7;
3. revisar a dependência de consentimento já registrada como tema paralelo antes de declarar a Fila pronta para uso mais amplo/multioperador;
4. só depois decidir novo ciclo de produto, com processo e fatias explicitamente documentados.

O defeito visual mobile histórico, venda sem WhatsApp e repescagem por evento continuam fora deste fechamento e não devem ser misturados retroativamente à Fatia 7.
