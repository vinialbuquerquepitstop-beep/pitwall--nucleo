# Handoff migracao v72 - Fila Operacional v2, Fatia 2 validada e publicada

Data: 14/09/2026. Linha: migracao / CRM. Substitui o `handoff_migracao_pitwall_v71.md` como topo desta linha.

Linguagem: prosa sem acento, sem cedilha, sem travessao.

## 1. Estado fechado desta sessao

A Fatia 2 da Fila Operacional v2, `Card operacional`, esta integrada ao `main` e publicada.

A construcao foi feita pelo ChatGPT na branch `codex/fila-operacional-v2-fatia2`. A validacao final foi feita pelo Claude sobre o merge real antes da publicacao ser considerada fechada.

| Ref | Hash |
|---|---|
| `github/main` antes da Fatia 2 | `9df17d0` |
| entrega inicial da Fatia 2 | `4f75735` |
| fechamento da validacao | `5387ac4` |
| merge no `main` | `4c579d6` |

O merge `4c579d6` foi feito com `--no-ff`, sem conflito, com dois pais: `9df17d0` e `5387ac4`.

A branch permaneceu em `5387ac4`; `main` e `github/main` ficaram em `4c579d6` depois do merge.

Nao houve migration, alteracao de schema ou escrita de dado de producao nesta fatia. O diff entre `9df17d0` e `4c579d6` ficou em frontend e ferramentas de prova:

- `public/app.js`;
- `public/app.css`;
- `ferramentas/harness.py`;
- `ferramentas/dados_teste.json`;
- `ferramentas/prova_fila_operacional_v2.js`;
- `ferramentas/patch_fila_operacional_v2_card.js`;
- `ferramentas/patch_fila_operacional_v2_card_fix.js`.

## 2. O que a Fatia 2 entrega

A Fatia 1 tinha fechado a classificacao operacional: a Fila passou a mostrar apenas trabalho executavel.

A Fatia 2 fecha a segunda pergunta do operador: alem de saber quem deve entrar na fila, agora o primeiro card explica por que esta ali e qual e o contexto minimo para agir.

### 2.1 Card com hierarquia operacional

O card da Fila passou a expor diretamente:

- identidade do lead;
- produto e condicao quando existem;
- origem;
- quem indicou, quando a origem e indicacao;
- veredito;
- passo atual da cadencia;
- vencimento;
- valor em jogo somente quando existe valor com lastro;
- motivo do veredito, com o rotulo `Por que agora`;
- WhatsApp como acao principal inequivoca quando permitido.

O objetivo do gate da Fatia 2 fica atendido: o operador consegue explicar por que o primeiro card ocupa a primeira posicao sem abrir o modal completo do lead.

### 2.2 Passo e vencimento sem duplicacao

A primeira versao da fatia mostrou o mesmo prazo em mais de um lugar na aba Hoje.

O commit `5387ac4` fechou essa regressao antes do merge:

- o prazo fica concentrado na faixa operacional;
- o chip de veredito da Hoje nao repete o prazo;
- o motivo fica compacto quando passo e atraso ja estao estruturados;
- item devido hoje mostra `hoje` e nao parece atrasado;
- passo e atraso aparecem uma vez cada.

Essa correcao faz parte da Fatia 2 publicada. Nao existe uma versao intermediaria considerada pronta.

### 2.3 Fila e Hoje usam o mesmo contexto operacional

A aba Hoje passou a repetir o contexto necessario do card operacional:

- produto e condicao;
- passo;
- vencimento;
- valor quando houver lastro;
- motivo do veredito.

Fila e Hoje continuam usando a mesma classificacao operacional introduzida na Fatia 1.

### 2.4 A omissao agora e declarada

A decisao registrada no v71 foi implementada: quem fica fora da fila executavel continua fora dos cards, mas a tela declara a omissao.

O recorte passou a informar quantos itens ficaram fora e por quais motivos, sem transforma-los novamente em tarefas.

A classificacao cobre motivos como:

- `pare`;
- sem consentimento;
- sem canal;
- duplicata;
- `nao_mande`;
- aguardando;
- fora da cadencia;
- bloqueio da regua.

Na fixture de prova da fatia, Fila e Hoje declaram `2 fora da fila`, com os motivos `pare` e `sem consentimento`, e esses dois leads continuam sem card executavel.

O recorte tambem permanece visivel quando a fila executavel esta vazia. Assim, uma fila zerada nao apaga a explicacao de que existem itens devidos, mas bloqueados para execucao.

## 3. Validacao do merge real

A suite foi rodada sobre o merge `4c579d6`, nao apenas sobre a ponta da branch.

Resultado informado na validacao final:

- 23 de 23 comandos com EXIT 0;
- `validar.py`: passou;
- `harness.py`: 1127 passou, 0 falhou;
- `prova_fila_operacional_v2.js`: 30 passou, 0 falhou;
- `prova_alimentar.py`: 170 passou, 0 falhou;
- diagnosticos de celular: verdes;
- diagnosticos de monitor largo: verdes;
- diagnosticos da calculadora: verdes.

Os invariantes 13, 14 e 16 foram conferidos no diff durante a validacao.

A Fatia 2 acrescenta 10 assercoes executadas no harness em relacao ao v71: 1117/0 -> 1127/0.

A prova dedicada da Fila passa de 20/0 para 30/0.

## 4. O que nao mudou

Esta fatia nao reescreve o motor da regua.

Continuam valendo os contratos do processo `docs/processos/fila-operacional-v2.md`:

- sensor e regua separados;
- abrir WhatsApp nao registra toque;
- `sugerir_mensagem` continua sendo a fonte unica de texto de abordagem;
- veredito continua derivado, sem virar status persistido;
- historico continua append-only;
- canal e consentimento continuam guardas obrigatorias;
- nenhuma acao privilegiada nova foi criada no banco.

## 5. Publicacao

A Fatia 2 esta no `main` em `4c579d6` e foi informada como ja publicada no ambiente vivo.

O merge real foi feito depois da validacao, sem conflito.

Nao ha workflow de GitHub Actions associado ao commit `4c579d6` retornado pela integracao do GitHub; a publicacao do frontend segue a politica do repositorio via Cloudflare Workers Builds descrita no processo da Fila.

Nao confundir este registro com uma nova prova independente por hash do Worker: nesta sessao, a evidencia de fechamento recebida foi `main` integrado, suite sobre o merge verde e ambiente informado como no ar.

## 6. Arquitetura da mudanca

A Fatia 2 separa duas perguntas que antes estavam misturadas:

1. o item esta devido?
2. o item pode ser executado agora?

As funcoes de leitura passaram a distinguir o universo devido do subconjunto executavel. Isso permite contar o que foi excluido sem recolocar o item na fila.

O resumo dos excluidos e derivado na leitura. Nao foi criada coluna nova para guardar um estado que pode ser calculado a partir dos fatos existentes.

Essa escolha preserva a preferencia arquitetural definida para a Fila v2.

## 7. Proximo passo oficial

A proxima fatia do processo e a **Fatia 3 - Execucao assistida**.

Objetivo: permitir trabalhar o lead sem sair do fluxo mental da fila.

Escopo oficial do processo:

- carregar as opcoes de `sugerir_mensagem` dentro do contexto da fila;
- permitir escolher a variante;
- abrir WhatsApp respeitando canal e consentimento;
- continuar separando abrir WhatsApp de registrar toque;
- ao voltar, oferecer o registro do resultado.

Gate:

- nenhum texto de mensagem duplicado no frontend;
- nenhum toque registrado apenas porque o link foi aberto;
- todas as variantes continuam vindo de `sugerir_mensagem`;
- o operador consegue concluir uma acao sem navegar por varias telas.

A Fatia 3 deve nascer de branch nova a partir do `main` publicado, nunca da branch antiga da Fatia 2.

## 8. Aberto paralelo, fora da Fatia 3

Continua aberto o defeito visual registrado no v71:

- vao de aproximadamente 220px acima do cabecalho mobile quando a Fila fica curta ou vazia;
- causa ja localizada no grid de uma coluna do `.app` com `min-height:100dvh` e linhas implicitas esticando;
- deve ser tratado como correcao visual separada, sem ser misturado com a execucao assistida.

Tambem continuam valendo as dependencias paralelas do documento de processo:

- revisao definitiva do contrato de consentimento;
- venda sem WhatsApp;
- repescagem por evento permanece fora do processo principal ate a fila normal estar confiavel e mensuravel.

## 9. Regra para a proxima sessao

Antes de tocar a Fatia 3:

1. conferir que `main` ainda descende de `4c579d6`;
2. reler este v72 e `docs/processos/fila-operacional-v2.md`;
3. conferir commits recentes de outras linhas para nao misturar calculadora, financeiro ou CRM no mesmo push;
4. criar branch nova a partir do `main` atual;
5. medir o fluxo atual de `sugerir_mensagem`, abertura do WhatsApp e registro de toque antes de alterar codigo;
6. implementar apenas a menor mudanca suficiente para o gate da Fatia 3;
7. validar no merge real antes de publicar.

## 10. Veredito

Fatia 2 fechada.

O CRM agora tem:

- classificacao operacional unica em Fila e Hoje;
- somente trabalho executavel como card;
- declaracao explicita do que ficou fora e por que;
- prioridade global entre comercial e pos-venda;
- card que mostra passo, vencimento, contexto, valor com lastro e motivo;
- acao principal de WhatsApp sem transformar abertura em toque;
- prova dedicada e harness ampliados;
- merge real validado antes do fechamento.

Proxima entrega: **Fatia 3 - Execucao assistida**.
