# Handoff migracao v76 - Fila Operacional v2, Fatia 6 integrada

Data: 15/09/2026. Linha: migracao / CRM. Substitui o `handoff_migracao_pitwall_v75.md` como topo desta linha.

Linguagem: prosa sem acento, sem cedilha, sem travessao.

## 1. Estado fechado desta sessao

A Fatia 6 da Fila Operacional v2, `Indicadores de execucao`, foi medida contra o banco vivo, implementada, provada, inspecionada visualmente e integrada ao `main`.

| Ref | Hash |
|---|---|
| `main` imediatamente antes da Fatia 6 | `472a4b4758c7f9458233ab4f2422d7f8689591db` |
| commit de produto na branch | `873818791075826f8e948f9553bd3bf6f4e9cb0d` |
| branch final limpa | `4cff03b8527016375feb69219c82f04aafaf35ef` |
| merge real no `main` | `4280a9dc096a1d5e5f57763546885cf2beaac594` |

O merge `4280a9d` tem dois pais: `472a4b4` e `4cff03b`.

Nao houve migration, nova tabela, nova coluna, nova RPC ou escrita de dado de producao nesta fatia.

## 2. Descoberta feita antes do codigo

O banco vivo ja possuia fatos suficientes para uma primeira leitura operacional segura.

A auditoria confirmou:

- `v_lead` ja entrega vencimento, ultimo toque, resposta, cadencia, contadores, primeiro toque e veredito;
- `lead_evento` registra os eventos operacionais e e protegido por RLS de tenant;
- `registrar_toque` grava `toque_enviado` de forma explicita;
- `registrar_resposta`, `registrar_conversando`, `registrar_desfecho` e `reagendar_proximo_contato` mantem eventos auditaveis;
- o frontend autenticado pode ler `v_lead` e `lead_evento` dentro do tenant atual.

Por isso a Fatia 6 foi derivada em leitura. Nao foi criado estado persistido novo apenas para exibir indicador.

## 3. Indicadores que entraram

A aba Hoje agora mostra uma faixa compacta dentro de `Fila de hoje`, antes do recorte e dos leads.

Entraram quatro numeros.

### 3.1 Execucao

Definicao:

`concluidos hoje / carga observada`

A carga observada e a uniao de:

- itens acionaveis que continuam pendentes agora;
- leads que tiveram um evento operacional valido hoje e ja sairam da fila acionavel.

Eventos considerados para concluir trabalho:

- `toque_enviado`;
- `respondeu`;
- `conversando`;
- `reagendado`;
- `sem_interesse`;
- `fechou`.

O mesmo lead conta uma vez.

Acao associada: dizer se a fila esta sendo de fato consumida durante o dia.

### 3.2 Na fila

Definicao:

quantidade atual de itens retornados pela mesma `vOperacional` que governa Fila e Hoje.

O pe do indicador mostra quantos sao atrasados reais. Atrasado real significa vencimento anterior a hoje, nao vencimento de hoje.

Acao associada: continuar executando a fila e distinguir carga atual de atraso acumulado.

### 3.3 Pos-venda

Definicao:

itens atualmente acionaveis da fila com `status = convertido` e passo de pos-venda devido.

Acao associada: mostrar quanto do trabalho atual e relacionamento depois da venda, sem separar sua prioridade da fila global.

### 3.4 Sem canal

Definicao:

pendencia comercial ou de pos-venda ja devida, mas sem WhatsApp valido.

Ela continua fora da fila acionavel, conforme o contrato da Fatia 1.

Acao associada: corrigir cadastro quando o numero for maior que zero.

## 4. Numeros que nao entraram nesta primeira faixa

Dois candidatos do processo foram auditados e ficaram de fora da interface desta entrega:

- tempo ate primeiro toque;
- respostas por toque.

O banco possui base para calcula-los, mas hoje eles sao mais historicos e diagnosticos do que uma decisao imediata sobre qual trabalho executar agora.

Nao foram exibidos so porque existem. Podem ser retomados em uma leitura de desempenho posterior se houver uma decisao operacional concreta ligada a eles.

Tambem nao foi criado um contador separado de `concluidos hoje`, porque o numero ja aparece no pe do indicador `execucao`; repeti-lo como quinto KPI aumentaria a densidade sem mudar decisao.

## 5. Medicao viva durante a implementacao

Snapshot medido no banco de producao em 15/09/2026, no momento da auditoria:

- 13 itens acionaveis pendentes;
- 13 atrasados reais;
- 1 concluido hoje;
- 14 itens na carga observada;
- taxa de execucao de 7 por cento;
- 0 pendencias devidas sem canal;
- 7 itens de pos-venda pendentes.

Esses numeros sao apenas o snapshot da auditoria. Nenhum deles foi hardcoded no produto.

A tela recalcula a partir dos fatos vivos.

## 6. Implementacao

Foram adicionadas funcoes de leitura no frontend:

- `medirExecucaoFila(eventos,hj,eventosOk)`;
- `carregarExecucaoFila(hj)`;
- `filaExecCel(...)`;
- `filaExecucaoHTML(m)`.

`renderHoje` agora relê `v_lead` antes de desenhar a fila e consulta somente os eventos operacionais do dia em `lead_evento`.

A janela dos eventos usa o dia local de Sao Paulo, de `00:00 -03:00` ate o inicio do dia seguinte.

A fila atual continua vindo de `vOperacional`; a Fatia 6 nao cria uma segunda regra de classificacao ou prioridade.

Se a leitura de `lead_evento` falhar, os numeros que dependem de conclusao degradam para indisponiveis, enquanto os numeros derivados da fila atual continuam utilizaveis.

## 7. Mudanca visual

A faixa de indicadores e deliberadamente pequena.

Desktop:

- quatro colunas;
- separadores finos;
- sem novo dashboard;
- sem sombra ou card promocional;
- cor semantica somente quando existe atraso ou falta de canal.

Mobile:

- duas colunas por linha;
- texto secundario pode quebrar linha;
- sem overflow.

A captura real de `Hoje` em 1280x1600 foi inspecionada antes do merge. A faixa permaneceu compacta e nao alterou a hierarquia recente dos botoes `Enviar mensagem`, `Toque enviado` e `Registrar resultado`.

## 8. Arquivos persistentes

O diff final da Fatia 6 contra o `main` anterior ficou restrito a:

- `public/app.js`;
- `public/app.css`;
- `ferramentas/prova_fila_operacional_v2_fatia6.js`.

Workflow e patch temporarios foram removidos antes do merge.

## 9. Validacao

Runner principal: GitHub Actions `34938758307`.

Resultados do gate estrito:

- `git diff --check`: passou;
- `validar.py`: TUDO PASSOU;
- prova base da Fila: 30 OK, 0 falhas;
- Fatia 3: 10 OK, 0 falhas;
- Fatia 4: 10 OK, 0 falhas;
- Fatia 5: 10 OK, 0 falhas;
- Fatia 6: 12 OK, 0 falhas;
- prova da harmonia da Hoje: 12 OK, 0 falhas;
- diagnostico 390px: 0 sobreposicoes e 0 overflows;
- diagnostico 1280px: 0 sobreposicoes e 0 overflows.

A prova da Fatia 6 trava explicitamente:

- derivacao sem nova persistencia;
- `lead_evento` como fonte dos concluidos do dia;
- `vOperacional` como fonte soberana dos pendentes;
- atraso somente antes de hoje;
- sem canal separado da fila executavel;
- formula da taxa de execucao;
- somente quatro indicadores operacionais;
- degradacao quando eventos ficam indisponiveis;
- desktop e mobile;
- nenhuma antecipacao de notificacao da Fatia 7;
- nenhuma RPC nova.

## 10. Divida de harness preexistente

O harness completo continua contendo assercoes antigas que esperam atualizacao localizada de DOM depois de acao na Fila.

Depois da Fatia 5, o comportamento oficial passou a ser reload completo para Modo Proximo. Por isso o harness diagnostico ainda registra quatro falhas e tres assercoes nao executadas nesse trecho antigo.

Isso nao foi causado pela Fatia 6. As provas especificas da Fatia 5 e da Fatia 6 estao verdes.

Essa divida deve ser corrigida separadamente, sem alterar o comportamento aprovado so para satisfazer teste antigo.

## 11. Invariantes preservados

Continuam valendo:

- abrir WhatsApp nao registra toque;
- `toque_enviado` continua explicito;
- `sugerir_mensagem` continua unica fonte de copy;
- historico continua append-only;
- nenhum veredito novo foi persistido;
- sem canal continua fora da fila executavel;
- consentimento continua guardando a abordagem;
- prioridade continua vindo da fila existente;
- nenhuma escrita nova foi criada para indicadores;
- nenhum alerta externo foi criado.

## 12. Proximo passo oficial

A proxima fatia do processo e a **Fatia 7 - Alertas e degradacao**.

Objetivo:

- avisar quando a operacao estiver saindo do controle;
- usar fatos e limites claros;
- preferir consolidacao na aba Hoje antes de notificacoes externas.

Candidatos ja registrados no processo:

- prioridade vencida ha mais de 1 dia;
- lead novo sem primeiro toque;
- pos-venda vencido;
- crescimento continuo do backlog;
- lead sem canal;
- regua nao executada no horario esperado.

A Fatia 7 deve primeiro definir quais alertas ja possuem fonte e limiar confiaveis. Nao transformar todo indicador da Fatia 6 em alerta automaticamente.

## 13. Aberto paralelo

Continuam separados:

- defeito visual mobile preexistente historico;
- revisao definitiva de consentimento;
- venda sem WhatsApp;
- repescagem por evento;
- atualizacao das assercoes antigas do harness para o contrato do Modo Proximo.

## 14. Veredito

Fatia 6 fechada e integrada.

A Fila Operacional v2 agora nao apenas ordena e conduz o trabalho: ela tambem mostra, com fatos vivos, quanto foi executado, quanto ainda esta na fila, quanto e pos-venda e onde existe bloqueio por falta de canal.

Proxima entrega: **Fatia 7 - Alertas e degradacao**.
