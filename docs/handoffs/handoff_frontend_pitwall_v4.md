# Handoff frontend v4 - Fila da Hoje harmonizada

Data: 15/09/2026. Linha: frontend. Substitui `handoff_frontend_pitwall_v3.md` como topo desta linha.

## 1. Motivo da correcao

Depois da Fatia 5 da Fila Operacional v2, a fila compacta da aba Hoje ficou funcional, mas visualmente densa demais.

A mesma linha podia expor ao mesmo tempo:

- sugerir mensagem;
- enviar no WhatsApp;
- toque enviado;
- respondeu;
- conversando;
- retomar;
- fechou;
- sem interesse.

O resultado contrariava a direcao visual do frontend: `timing screen, nao cockpit`.

Esta entrega corrige apenas a hierarquia da interface da Hoje. Nao altera o motor da regua, prioridade, cadencia, RPCs ou banco.

## 2. Nova hierarquia da linha de lead

A linha normal passa a separar leitura, acao principal e registro.

### Leitura

O topo fica reservado a:

- identidade do lead;
- nivel;
- veredito;
- contexto comercial;
- passo;
- vencimento;
- motivo.

### Acao principal

Existe uma unica chamada principal de contato:

- `Preparar mensagem`.

A sugestao continua vindo de `sugerir_mensagem` e permanece no proprio lead.

O WhatsApp nao fica exposto antes de o operador preparar a mensagem.

### Registro

Duas acoes secundarias ficam disponiveis sem competir com o CTA principal:

- `Toque enviado`;
- `Registrar resultado`.

`Toque enviado` continua sendo fato explicito e separado de abrir WhatsApp.

Ao abrir `Registrar resultado`, aparecem as cinco opcoes existentes:

- Respondeu;
- Conversando;
- Retomar;
- Fechou;
- Sem interesse.

O bloco recebe o contexto `O que aconteceu?` e fica fechado por padrao.

## 3. Progressive disclosure

A principal decisao desta entrega e usar progressive disclosure na Hoje.

A aba Hoje e uma tela compacta de execucao diaria. Ela nao precisa mostrar todas as possibilidades de desfecho antes de o operador decidir registrar um resultado.

A Fila completa continua podendo exibir seus desfechos diretamente. A reducao de densidade foi aplicada especificamente a linha compacta da Hoje.

## 4. Invariantes preservados

Continuam valendo:

- `sugerir_mensagem` e a fonte unica da copy;
- abrir WhatsApp nao registra toque;
- toque e resposta continuam fatos diferentes;
- Respondeu continua em `registrar_resposta`;
- Conversando continua em `registrar_conversando`;
- Retomar continua em `reagendar_proximo_contato` e exige data;
- Sem interesse continua em `registrar_desfecho`;
- Fechou continua exigindo o fluxo real de venda;
- consentimento e canal continuam guardas do contato;
- nenhuma escrita direta em lead foi adicionada;
- nenhuma RPC nova foi criada;
- nenhum dado de producao foi alterado nesta entrega.

## 5. Arquivos persistentes

O diff final contra o `main` anterior ficou restrito a:

- `public/app.js`;
- `public/app.css`;
- `ferramentas/prova_hoje_fila_harmonia.js`;
- `ferramentas/prova_fila_operacional_v2_fatia4.js`;
- `ferramentas/harness.py`.

Workflows e patches temporarios foram removidos antes do merge.

## 6. Validacao

A remodelacao foi validada em branch propria `codex/hoje-fila-harmonia`.

Provas principais depois das correcoes:

- `validar.py`: passou;
- prova base da Fila Operacional v2: 30 OK, 0 falhas;
- Fatia 3: 10 OK, 0 falhas;
- Fatia 4 contextual: 10 OK, 0 falhas;
- Fatia 5: 10 OK, 0 falhas;
- prova especifica da nova hierarquia da Hoje: 11 OK, 0 falhas;
- diagnostico 390px: 0 sobreposicoes e 0 estouros;
- diagnostico 1280px: 0 sobreposicoes e 0 estouros.

Tambem foi gerada fotografia real da aba Hoje em 1280x1600 durante a validacao para revisar a hierarquia visual.

O harness completo ainda contem divida tecnica de assercoes antigas ligadas ao modelo anterior de atualizacao localizada da Fila, que ja havia sido substituido pelo reload sequencial da Fatia 5. As expectativas especificas da Hoje que esta entrega mudou foram atualizadas. Essa divida nao bloqueou a correcao porque as provas diretamente relacionadas a Fila, Fatias 3/4/5, estrutura, geometria e nova hierarquia passaram.

## 7. Merge

Merge real no `main`:

`e3865a5983730b5de97388320fcd2f90a2f08b3c`

Branch final usada no merge:

`3eb47166ab7dcc327bd81fb352db59f072fc50d0`

## 8. Estado visual resultante

A linha da Hoje volta a cumprir a direcao do produto:

- leitura antes de controle;
- uma acao principal clara;
- registros secundarios discretos;
- detalhes revelados somente quando necessarios;
- nenhuma parede de botoes no estado normal;
- mobile sem compressao indevida dos controles.

## 9. Proximo passo

Esta entrega nao muda o roadmap da linha CRM.

O topo da linha Migracao / CRM continua sendo `handoff_migracao_pitwall_v75.md` e o proximo passo oficial continua sendo **Fatia 6 - Indicadores de execucao**.

Na linha frontend, este documento passa a ser o topo vivo.
