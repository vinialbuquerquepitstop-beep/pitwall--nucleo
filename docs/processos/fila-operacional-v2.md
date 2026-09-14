# Processo de evolucao da Fila Operacional v2

Data de abertura: 13/09/2026
Projeto: Pitwall
Escopo: CRM, fila de execucao diaria, aba Hoje, pos-venda e registro operacional

## 1. Objetivo

Transformar a fila atual em um sistema de execucao comercial diaria.

O problema que esta entrega resolve nao e falta de inteligencia da regua. A auditoria de 13/09/2026 mostrou que o motor esta funcionando, mas a operacao acumula tarefas e depende demais do operador lembrar quem deve ser acionado, por que deve ser acionado e o que precisa ser registrado depois.

A Fila Operacional v2 deve fazer quatro coisas bem:

1. mostrar somente trabalho realmente executavel;
2. explicar por que cada lead esta na fila;
3. oferecer a proxima acao com o menor numero de cliques;
4. registrar o resultado de forma que a regua continue sabendo o que aconteceu.

A meta nao e criar um novo CRM. A meta e tornar o CRM existente mais operacional.

---

## 2. Baseline de inicio

A baseline operacional desta entrega e 13/09/2026.

Depois da limpeza auditada:

- 0 pendencias com vencimento anterior a 13/09/2026;
- 14 cadencias validas concentradas na baseline de 13/09/2026;
- 2 repescagens com veredito `pare` retiradas da cadencia ativa;
- 1 pos-venda sem WhatsApp retirado da fila acionavel;
- nenhum toque, resposta ou venda foi inventado para limpar a fila.

A partir desta data, novos atrasos devem ser tratados como dado real de operacao. Nao devem ser apagados ou reagendados em lote apenas para deixar o painel verde.

---

## 3. Invariantes que nao podem ser quebrados

Estas regras valem durante toda a implementacao.

### 3.1 Sensor e regua continuam separados

O sensor registra o que aconteceu. A regua le os fatos e decide o proximo movimento.

A interface nao pode fabricar evento para fazer a regua avancar.

### 3.2 Toque enviado e respondido continuam distintos

Abrir o WhatsApp nao significa que um toque foi enviado.

Registrar `toque_enviado` deve continuar sendo uma acao explicita e auditavel.

### 3.3 Veredito nao substitui perfil, status ou nivel

`prioridade`, `agora`, `mande`, `espere`, `pare` e outros vereditos sao decisoes derivadas de fila.

Eles nao devem virar status persistido do lead sem justificativa de modelo.

### 3.4 Mensagem sugerida continua vindo de uma unica fonte

`sugerir_mensagem` continua sendo a unica fonte de texto de abordagem da fila.

Nao criar copias de mensagem em JavaScript, HTML ou nova tabela apenas para facilitar a tela.

### 3.5 Historico continua append-only

Nao apagar eventos antigos para corrigir apresentacao da fila.

### 3.6 O motor da regua nao sera reescrito sem evidencia

A auditoria de 13/09 apontou o motor como saudavel.

Qualquer mudanca em `fn_regua_varredura`, `cadencia_perfil` ou `cadencia_regra` precisa nascer de um comportamento medido que a Fila v2 nao consiga resolver na camada operacional.

### 3.7 Sem canal nao pode parecer tarefa executavel

Um lead sem WhatsApp valido nao deve ocupar a mesma fila de uma tarefa que pode ser executada agora.

### 3.8 Consentimento nao pode ser inferido silenciosamente

A Fila v2 nao deve abrir atalho de WhatsApp se a regra de consentimento nao estiver satisfeita.

A revisao definitiva do modelo de consentimento e uma dependencia de seguranca da entrega.

---

## 4. Definicao operacional da fila

Antes de desenhar a interface, a fila precisa ter semantica clara.

### 4.1 Fila principal

A fila principal deve conter somente itens que o operador consegue executar.

Um item e acionavel quando, no minimo:

- o lead esta ativo;
- existe cadencia ativa ou outra razao operacional valida;
- existe canal necessario para a acao;
- o consentimento exigido para o canal esta valido;
- nao existe desfecho que retire o lead da acao;
- existe uma proxima acao compreensivel.

### 4.2 Estados operacionais desejados

A interface deve conseguir distinguir, sem misturar significado:

- `Prioridade`: melhor oportunidade ou risco que deve furar a ordem normal;
- `Agora`: deve ser trabalhado imediatamente;
- `Hoje`: tarefa valida com vencimento no dia;
- `Aguardando`: nao deve receber novo toque agora;
- `Sem canal`: existe pendencia, mas a operacao nao tem como executa-la;
- `Pausado/fora`: a regra decidiu que nao existe acao de rotina agora.

Os nomes finais podem mudar durante a descoberta, mas a separacao conceitual nao.

---

## 5. Experiencia alvo

Ao abrir a fila, o operador deve responder em segundos:

1. Quantas tarefas eu realmente tenho hoje?
2. Qual devo fazer primeiro?
3. Por que este lead esta aqui?
4. O que eu devo falar?
5. O que eu preciso registrar depois?

O card de trabalho deve priorizar:

- nome do lead;
- perfil;
- interesse/produto quando existir;
- valor em jogo quando confiavel;
- passo atual da cadencia;
- atraso ou vencimento;
- veredito e motivo;
- ultima interacao relevante;
- acao recomendada;
- acesso a mensagem sugerida;
- registro do desfecho.

A tela nao deve obrigar o operador a abrir varias abas para montar esse contexto.

---

## 6. Fluxo de execucao desejado

Fluxo de referencia:

1. operador abre a fila;
2. sistema mostra o item de maior prioridade;
3. operador entende o motivo sem abrir detalhes secundarios;
4. sistema oferece as variantes vindas de `sugerir_mensagem`;
5. operador escolhe uma variante;
6. abre o WhatsApp somente se canal e consentimento permitirem;
7. ao voltar, registra o que realmente aconteceu;
8. o item muda de estado ou sai da posicao atual;
9. a fila recalcula e apresenta o proximo trabalho.

Abrir o WhatsApp e registrar o resultado sao eventos diferentes.

---

## 7. Fatias de implementacao

A entrega sera feita em fatias pequenas e verificaveis.

## Fatia 0. Descoberta e contrato do estado atual

Objetivo: entender exatamente como a fila atual e montada antes de alterar qualquer comportamento.

Atividades:

- localizar no frontend o codigo da Fila e da aba Hoje;
- mapear a origem de dados usada por cada uma;
- listar RPCs, views e funcoes envolvidas;
- medir os 14 itens da baseline pela mesma consulta usada pela aplicacao;
- conferir como `veredito`, `veredito_ordem`, `veredito_motivo`, `toques`, `respostas` e `valor_em_jogo` chegam ao browser;
- identificar onde o WhatsApp e aberto e onde `toque_enviado` e registrado;
- identificar filtros que hoje escondem ou misturam estados;
- verificar se a Fila e o Hoje podem divergir para o mesmo lead.

Saida obrigatoria:

- mapa do fluxo atual;
- lista dos pontos de alteracao;
- comportamento que sera preservado;
- testes/regressoes existentes que protegem a fila.

Gate: nenhum codigo de produto antes desse mapa estar fechado.

## Fatia 1. Classificacao operacional

Objetivo: garantir que a fila principal contenha apenas trabalho executavel.

Escopo esperado:

- separar `sem canal` da fila principal;
- garantir que `pare` nao apareca como chamada a acao;
- diferenciar item devido hoje de item realmente atrasado;
- preservar prioridade derivada;
- definir o comportamento de item sem consentimento.

Preferencia arquitetural:

Derivar o maximo possivel na leitura. Evitar criar coluna persistida para estado que pode ser calculado com fatos existentes.

Gate de aceite:

- um lead sem canal nunca aparece como contato executavel;
- um lead `pare` nao recebe CTA de abordagem;
- a mesma regra vale em Fila e Hoje;
- nao houve mudanca no motor da cadencia sem necessidade provada.

## Fatia 2. Card operacional

Objetivo: reduzir busca de contexto.

Escopo esperado:

- reorganizar hierarquia do card;
- colocar o motivo do veredito visivel;
- exibir passo e vencimento da regua;
- exibir contexto comercial relevante;
- mostrar valor em jogo somente quando houver lastro;
- deixar a acao principal inequivoca.

Gate de aceite:

O operador deve conseguir explicar por que o primeiro card esta na primeira posicao sem abrir o modal completo do lead.

## Fatia 3. Execucao assistida

Objetivo: permitir trabalhar o lead sem sair do fluxo mental da fila.

Escopo esperado:

- carregar as opcoes de `sugerir_mensagem` no contexto da fila;
- permitir escolher a variante;
- abrir WhatsApp respeitando canal e consentimento;
- manter separado o ato de abrir WhatsApp do ato de registrar toque;
- apos o retorno, oferecer registro de resultado.

Gate de aceite:

- nenhum texto de mensagem duplicado no frontend;
- nenhum toque e registrado apenas porque o link foi aberto;
- todas as variantes continuam vindo de `sugerir_mensagem`;
- o operador consegue concluir uma acao sem navegar por varias telas.

## Fatia 4. Desfecho rapido

Objetivo: fechar o ciclo operacional.

Acoes candidatas:

- toque enviado;
- respondeu;
- reagendar;
- sem interesse;
- venda;
- corrigir canal;
- sem canal.

Cada acao precisa usar o contrato existente ou uma nova RPC minima, auditavel e protegida por RLS.

Nao criar um botao generico que atualiza varias colunas diretamente do browser.

Gate de aceite:

Depois de qualquer desfecho, a fila deve refletir imediatamente o novo estado do lead sem fabricar historia.

## Fatia 5. Modo Proximo

Objetivo: transformar a fila em uma rotina de execucao sequencial.

Comportamento alvo:

- selecionar automaticamente o item de maior prioridade;
- concluir o item;
- recalcular a fila;
- abrir o proximo item valido.

O modo Proximo nao substitui a fila visual. E um acelerador para a operacao.

Gate de aceite:

Uma sessao de contatos pode ser executada de forma continua sem o operador decidir manualmente a ordem apos cada lead.

## Fatia 6. Indicadores de execucao

Objetivo: medir comportamento operacional, nao criar dashboard decorativo.

Indicadores minimos candidatos:

- tarefas validas para hoje;
- atrasados reais;
- concluidos hoje;
- sem canal;
- taxa de execucao da fila;
- tempo ate primeiro toque;
- respostas por toque;
- pos-venda devido x executado.

Gate de aceite:

Cada numero precisa ter definicao, fonte e acao associada. Se um numero nao muda uma decisao, ele nao entra nesta entrega.

## Fatia 7. Alertas e degradacao

Objetivo: fazer o sistema avisar quando a operacao esta saindo do controle.

Alertas candidatos:

- prioridade vencida ha mais de 1 dia;
- lead novo sem primeiro toque;
- pos-venda vencido;
- crescimento continuo do backlog;
- lead sem canal;
- regua nao executada no horario esperado.

A preferencia e consolidar esses alertas na aba Hoje antes de criar notificacoes externas.

---

## 8. Dependencias paralelas

Alguns problemas foram descobertos durante a auditoria e precisam ser tratados sem misturar suas solucoes com a UX da fila.

### 8.1 Consentimento

`registrar_venda` atualmente pode criar lead com consentimento verdadeiro automaticamente.

Antes de considerar a Fila v2 pronta para uso amplo, o contrato de consentimento deve ser revisado e testado.

### 8.2 Venda sem WhatsApp

Registrar uma venda nao deve exigir WhatsApp se a operacao precisa aceitar clientes sem esse dado.

Porem, a criacao da venda tambem nao pode produzir silenciosamente uma tarefa de WhatsApp impossivel.

A solucao deve separar relacionamento existente de capacidade real de contato.

### 8.3 Repescagem por evento

A Fatia 4 historica da evolucao do CRM, repescagem por evento, continua fora deste processo principal.

Ela so deve ser retomada depois de a fila normal estar confiavel e mensuravel.

---

## 9. Processo de trabalho neste chat

Este documento e a referencia para as proximas sessoes.

Para cada fatia, seguir sempre a mesma sequencia.

### Passo A. Sincronizar

Antes de tocar codigo:

1. conferir HEAD de `main`;
2. conferir handoff atual;
3. verificar commits recentes de Claude/Codex;
4. conferir banco vivo quando a fatia depender de dados.

Se o HEAD mudou desde a leitura anterior, reler os arquivos afetados.

### Passo B. Medir o comportamento atual

Nao implementar a partir de memoria.

Executar a consulta, abrir o codigo ou reproduzir o fluxo que prova o estado atual.

### Passo C. Propor a menor mudanca suficiente

Explicar no chat:

- problema observado;
- causa;
- arquivos/funcoes afetados;
- o que nao sera alterado;
- prova que devera passar depois.

### Passo D. Implementar uma fatia por vez

Evitar misturar numa mesma mudanca:

- UX extensa;
- mudanca de regra da cadencia;
- mudanca de RLS;
- refatoracao sem relacao direta.

Se uma dependencia aparecer, registrar e decidir se bloqueia a fatia.

### Passo E. Provar

Toda mudanca precisa ser verificada no nivel correspondente.

Banco:

- RLS;
- tenant correto;
- evento correto;
- nenhuma escrita lateral inesperada.

Frontend:

- comportamento funcional;
- desktop e mobile;
- estados vazio, erro e sem permissao;
- card com dados reais, nao fixture idealizada.

Regua:

- nao avancou sem toque quando nao deveria;
- nao perdeu estado;
- nao inventou contato;
- segue coerente com os contratos de cadencia.

### Passo F. Commit

Commit deve descrever o comportamento entregue, nao apenas o arquivo alterado.

### Passo G. Handoff

Ao fechar uma fatia relevante:

- registrar o que foi alterado;
- registrar provas executadas;
- registrar pendencias descobertas;
- registrar o proximo passo exato.

---

## 10. Politica de deploy

O repositorio publica `main` automaticamente pelo Cloudflare Workers Builds.

Consequencias para este processo:

- commit em `main` pode gerar deploy;
- nao confundir commit com prova de deploy vivo;
- mudancas de banco aplicadas diretamente no Supabase entram em vigor sem deploy do Worker;
- mudancas de frontend precisam de verificacao de publicacao alem do commit quando a entrega depender disso.

Durante implementacao mais arriscada, considerar branch dedicada antes de integrar em `main`.

---

## 11. Definition of Done da Fila Operacional v2

A entrega completa so esta pronta quando:

1. a fila principal contem apenas itens realmente executaveis;
2. `sem canal` e `sem consentimento` nao se apresentam como contato normal;
3. o operador entende a prioridade de cada card;
4. as mensagens continuam centralizadas em `sugerir_mensagem`;
5. abrir WhatsApp nao registra toque sozinho;
6. os principais desfechos podem ser registrados sem sair do fluxo;
7. a fila se reorganiza depois de cada acao;
8. o operador consegue usar um fluxo sequencial de proximo lead;
9. existem indicadores de execucao com definicao auditavel;
10. novos atrasos sao medidos a partir da baseline de 13/09/2026;
11. RLS e isolamento por tenant continuam provados;
12. nenhum comportamento do motor da regua foi alterado sem teste e justificativa;
13. a entrega tem handoff atualizado e evidencia de validacao.

---

## 12. Ordem oficial de trabalho

A ordem adotada a partir deste documento e:

1. Fatia 0, descoberta e contrato atual;
2. Fatia 1, classificacao operacional;
3. Fatia 2, card operacional;
4. Fatia 3, execucao assistida;
5. Fatia 4, desfecho rapido;
6. Fatia 5, modo Proximo;
7. Fatia 6, indicadores;
8. Fatia 7, alertas.

Consentimento e venda sem canal sao dependencias paralelas e entram na primeira fatia em que bloquearem comportamento seguro.

---

## 13. Primeiro trabalho a executar

Comecar pela Fatia 0.

A primeira sessao deve produzir um mapa exato da fila atual com:

- caminho do carregamento no frontend;
- query/RPC/view de origem;
- filtros e ordenacao;
- construcao do card;
- fluxo de WhatsApp;
- fluxo de `toque_enviado`;
- fluxo de reagendamento e desfecho;
- interseccao com a aba Hoje;
- testes que cobrem cada trecho.

Somente depois desse mapa sera decidido o diff da Fatia 1.
