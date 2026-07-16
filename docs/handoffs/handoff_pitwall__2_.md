# Handoff Pit Wall / Pitstop Imports, para novo chat

## Como usar este documento
Continuacao da operacao do Pit Wall, o dashboard da Pitstop Imports. Este handoff substitui as versoes anteriores. Le primeiro a secao **"A regua existe e e o v3.2 (descoberta desta sessao)"**, porque ela muda o plano de fases.

Estado em uma frase: o backend do CRM esta na v5 (sensor), a Fase 0 (Lead ID estavel) foi entregue e validada nesta sessao, e descobriu-se que a regua de cadencia ja existe como um sistema separado (v3.2 Calendar Automation) que precisa ser reconciliado com o sensor v5.

---

## RESPOSTA A PERGUNTA "o v3.2 e o CRM para substituir?"
**Nao.** O v3.2 (CRM Calendar Automation) nao substitui o `crm_pitwall.gs`. Sao camadas diferentes:
- `crm_pitwall.gs` + `Index.html` (Pit Wall) = **sensor e visualizador**: le a fila, registra toque e resposta, dispara WhatsApp, gera Lead ID.
- **v3.2 Calendar Automation = a regua**: cadencia por perfil, avanca "Proximo contato", volta status a Pendente, cria eventos no Google Agenda.
- A planilha do CRM = a base que os dois compartilham.

Nao e substituir um pelo outro, e **integrar**, e a integracao tem um conflito concreto a resolver (ver secao da regua). Para decidir entre integrar, reescrever ou aposentar parte do v3.2, o proximo chat precisa do **codigo completo do v3.2** (so o cabecalho foi visto) e da confirmacao de se ele roda no mesmo projeto Apps Script ou em projeto separado.

---

## A regua existe e e o v3.2 (descoberta desta sessao)
Em sessao antiga o handoff dizia "regua nao existe". Errado, e o dono corrigiu. Nesta sessao ele mostrou a regua: o arquivo **PITSTOP IMPORTS — CRM Calendar Automation (v3.2)**. Pelo cabecalho dele, a regua faz:
- Marcar "Feito" avanca "Proximo contato" 1 toque a partir da data atual da celula (nao de hoje), e volta o status a "Pendente". No ultimo toque, fica em "Feito" e avisa que a cadencia acabou.
- Selecionar o **Perfil** cria a cadencia de eventos no Google Agenda.
- Escreve a data do proximo toque de volta na coluna "Proximo contato".
- Resolve colunas por NOME do cabecalho. Matching de Perfil normalizado e exato.
- Cadencias alinhadas ao modelo do Notion. Evento carrega rotulo do toque (R1·D3...), link wa.me e link do script.
- "Lead — Em espera": 1 toque na data combinada.
- Dropdown de Estado (Lacrado/Vitrine/Seminovo) na coluna Modelo.
- `testarConexao()`: checa aba, cabecalhos e acesso ao Agenda.

### Conflito a resolver entre a regua (v3.2) e o sensor (v5)
1. **Gatilho de avanco divergente.** O v3.2 usa "Feito" para avancar a cadencia. O Pit Wall v5 tirou o "Feito" da fila e passou a usar dois eventos separados: o toque do WhatsApp (grava "Data do ultimo toque") e "Respondeu" (grava "Respondido"). O v3.2 **nao conhece essas duas colunas**, foi escrito antes delas.
2. **Escrita concorrente.** Os dois escrevem "Proximo contato" e "Status". Sem reconciliacao, um sobrescreve o outro.
3. **Colunas que cada lado ignora.** O v3.2 usa Perfil e algum campo de Event IDs que o `crm_pitwall.gs` nao mapeia. O `crm_pitwall.gs` criou colunas (sensor e Lead ID) que o v3.2 ignora.

### O que "reformular a regua" significa, concretamente
Fazer o v3.2 ler os sinais do sensor ("Data do ultimo toque", "Respondido") em vez de depender do clique manual em "Feito", e decidir se a varredura por gatilho de tempo substitui o avanco manual. Lembrar: `onEdit`/`onChange` nao disparam em escrita por script (`setValue`); cadencia automatica tem que ser gatilho de tempo que varre as linhas.

### A confirmar no proximo chat
- Codigo completo do v3.2 (colunas exatas que toca, como casa Perfil, se mexe em Status).
- v3.2 roda no MESMO projeto Apps Script que o `crm_pitwall.gs`? Se sim, escopo global compartilhado e ha risco de colisao de nomes de funcao entre os arquivos (checar com AST). Se nao, projeto separado na mesma planilha, sem colisao de nomes mas ainda com escrita concorrente.
- Mapear sobreposicao de colunas: certas em "Proximo contato" e "Status"; verificar Perfil vs nivel, e Event IDs.

---

## Preferencias e estilo do usuario (Albuquerque)
- Respostas diretas, estruturadas, hierarquicas, orientadas a execucao. Sem filler, sem clichê motivacional.
- Quer arquivos completos e prontos para colar, nunca fragmentos. Fragmento foi causa raiz de bloqueio anterior.
- Espera validacao real (`node --check`, AST de colisao, harness de planilha em memoria para `.gs`, jsdom para frontend) antes de entregar codigo, nunca so revisao visual.
- Nao busca validacao automatica de ideias. Reage mal a trabalho descrito como mais fundamental do que e. Seja exato sobre o que cada mudanca entrega. Maior falha primeiro. Conselheiro, nao executor que concorda.
- Baixa tolerancia a complexidade e a "arrumacao" sem retorno pratico. Justifique o retorno ou nao proponha.
- Nunca usar travessao no texto. Excecao: dado real, como o nome da aba com em-dash U+2014.
- Portugues do Brasil, muitas vezes por voz, transcricao pode vir fragmentada. Interpretar a intencao.

## Contexto do projeto
**Pit Wall** e o dashboard operacional (Google Apps Script + HtmlService) da **Pitstop Imports**, revenda de produtos Apple no Rio de Janeiro (Araruama, RJ). Usado no telefone, pelo dono, operador unico.

| Camada | Ferramenta | Papel |
|---|---|---|
| Frontend | `Index.html` (GAS HtmlService) | Abas Hoje, CRM, Escopo, Conteudo, Metricas, Evolucao, Rotina. Modulo CRM (`window.PitWallCRM`) embutido no `Index.html` |
| Backend geral | `Code.gs` | doGet, roteamento, saveDay, sync Notion |
| Backend CRM (sensor) | `crm_pitwall.gs` | getClientes, marcarStatus, setConsentimento, registrarToque, registrarResposta, backfillLeadIds, gate de WhatsApp |
| Regua (cadencia) | v3.2 "CRM Calendar Automation" | Cadencia por perfil, avanca Proximo contato, cria eventos no Agenda. Arquivo completo ainda nao visto nesta linha de trabalho |
| Manifesto | `appsscript.json` | timeZone, webapp access (`MYSELF`), oauthScopes |
| Banco CRM | Sheets `1lJj4wHjniXhjW_dmFSJ2eKdohN8MCJ4MGvglXyyIrrY`, aba `Pitstop Imports — CRM de Clientes` (em-dash U+2014, grafia exata e critica) | Fonte da verdade e mesa de edicao |
| Banco uso/conteudo | Sheets `1fWhQ78vq1ScvYehvW6jvauS5WNY5kXtuPVhf09Ue7ek` | Uso diario, cache de conteudo |
| Calendario editorial | Notion "Calendario de Conteudo" (ID `ab0fc93f-d964-4f32-8c81-4be5343687b3`) | So referencia de schema |
| Backup independente | Projeto "Pitstop Backups", script ID `1eRu-ZVFYzP5REMD3oQb1wnpyAlKR7QB3H9V3GN4BH-1NRjH-V1rLj9q6`, trigger semanal | Concluido |

**Status values do CRM (5, fixos):** `🟡 Pendente`, `✅ Feito`, `🟢 Convertido`, `❄️ Lista fria`, `🚫 Cancelado`
**Proprietario / e-mail de alerta:** `vinialbuquerque.pitstop@gmail.com`
**Test row:** TESTE PITWALL, Proximo contato 20/06/2026. Nao modificar.

---

## Colunas da planilha do CRM
Mapeadas por `_crmMapaColunas` (leitura por nome de cabecalho normalizado, nao por indice):
`nome`, `whatsapp`, `produto`, `modelo`, `proximo contato`, `nivel`, `status`, `tipo de msg`, `situacao`, `ultima resposta`, `observacoes`, `consentimento`, `data consentimento`, `data do ultimo toque`, `respondido`, **`lead id` (novo, Fase 0)**.

Colunas usadas pela regua v3.2 que o `crm_pitwall.gs` NAO mapeia: **Perfil** e algum campo de **Event IDs** (a confirmar nomes exatos). Possivel relacao entre "Perfil" (v3.2) e "nivel" (crm) a esclarecer.

Regras das colunas:
- **Consentimento / Data consentimento:** so `Sim` ou `Nao` sem til, grafia identica na planilha e no codigo. Data dd/MM/yyyy. Preencher `Sim` na mao ao cadastrar nao carimba a data (aceitavel para inbound).
- **Data do ultimo toque:** carimbada por `registrarToque`, sempre sobrescrita.
- **Respondido:** carimbada por `registrarResposta`, freio permanente enquanto tiver data.
- **Lead ID:** gerado por `backfillLeadIds`, congelado como valor, formato LEAD-0001. Nunca por formula ROW().
- **Adicionar coluna nova sempre no fim.**

---

## ESTADO REAL DO CODIGO

### Backend `crm_pitwall.gs` (v5 sensor + Fase 0)
- `getClientes(forcar)`: monta a fila. `precisa = pendente && proximoContato <= hoje && !tocadoHoje && !respondeu`. Expoe no topo `consentColOk`, `toqueColOk`, `respColOk`, `leadColOk`. Por cliente expoe `leadId` e `waLink` (so se telefone + `podeContatar`).
- `marcarStatus`, `setConsentimento`, `registrarToque`, `registrarResposta`: escritas estreitas, celula alvo, LockService, limpam cache.
- **Fase 0 entregue e validada nesta sessao:** `backfillLeadIds()` (idempotente, com lock, gera Lead ID estavel a partir do maior numero existente), mais auxiliares `_crmNumLead`, `_crmFormataLeadId`, `_crmMaxLeadNum`. `getClientes` passou a expor `leadId` e `leadColOk`.
- Validacao executada: `node --check` limpo; harness de planilha em memoria com 23 asserts e 0 falhas (backfill do zero, idempotencia, max+1, estabilidade sob reordenacao, coluna ausente, exposicao de leadId com e sem coluna); AST Acorn com 21 funcoes top-level e 0 colisao interna.
- Arquivo final entregue: `crm_pitwall.gs` (450 linhas), pronto para colar inteiro.

### Frontend `Index.html`, modulo `window.PitWallCRM` (v5)
- **Fila do dia:** card com WhatsApp (link wa.me com template + registra toque + baixa fila), "Respondeu" (registrarResposta), "Convertido", "Lista fria". Nao tem mais "Feito" na fila.
- **Aba Todos:** busca por nome/telefone/produto + chip discreto de consentimento. Nao tem WhatsApp nem botoes de status hoje.
- Cache local em localStorage, banner de coluna ausente, toasts.
- **Ainda nao carrega `leadId` nos cards** (entra na Fase 0.2).

---

## DECISOES TRAVADAS

1. **WhatsApp tem dois papeis por lugar.** Na fila: disparo (template + gate de consentimento + registra toque + baixa card), mantido. Na aba Todos: so abrir pra checar, **a fazer**, com link montado direto do telefone (`https://wa.me/<digitos>`, sem `?text=`, sem gate, sem registrar toque). Checar conversa existente nao e contato.
2. **A planilha e a mesa de edicao.** Pit Wall escreve pouco (status, consentimento, toque, resposta, e agora gera Lead ID por backfill). Excecao aprovada: cadastro de lead por **append** (linha nova no fim) nao fere isso, append nao tem risco de linha errada.
3. **Lead ID deixou de ser adiado e virou Fase 0 (feita).** A expansao para pipeline e atividades (pedida pelo dono) exige vinculo por ID estavel entre abas. Por isso o Lead ID passou a ser pre-requisito, nao opcional.
4. **A regua existe (v3.2).** Sera reformulada para ler o sensor, nao construida do zero. Ver secao da regua.
5. **Consentimento:** para inbound do dia a dia e redundante (base legal propria na LGPD, Art. 7 V, nao e consentimento). Funcao real: kill-switch da fase automatica e protecao do numero contra denuncia de spam (Meta). Preenche `Sim` direto na coluna ao cadastrar; botoes Sim/Nao no app sao so para revogacao rara.

---

## PLANO DE ESTRUTURACAO POR FASES (revisado a luz do v3.2)
O dono decidiu evoluir o CRM ate ter pipeline, valor de negocio, estagio de funil, historico de atividades e camada de gestao. Ordem por dependencia e retorno. Fase 0 e primeiro e ja foi feita.

- **Fase 0 — Fundacao de identidade (Lead ID estavel). FEITA.** Coluna Lead ID congelada por script, backfill, getClientes expondo o ID. Nao muda o uso diario; e o terreno para pipeline e atividades vincularem por ID que nao quebra.
- **Fase 0.2 — Localizacao por ID.** As quatro funcoes de escrita passam a localizar por Lead ID com fallback nome+telefone; o frontend carrega `leadId` nos cards. Fecha o risco de escrita em linha errada. Toca backend e `Index.html`.
- **Fase 1 — Fluidez diaria.** Reagendar/adiar "Proximo contato" no app; cadastro rapido de lead por append (ja nascendo com Lead ID); WhatsApp de checagem na aba Todos (link limpo). Nota: o avanco automatico de "Proximo contato" ja existe na regua v3.2 via "Feito"; o que falta e o reagendamento manual pelo app.
- **Fase 2 — Regua (reformular o v3.2, nao construir).** Fazer o v3.2 ler "Data do ultimo toque" e "Respondido" em vez de depender do clique em "Feito"; decidir varredura por tempo vs avanco manual; reconciliar a escrita concorrente em Proximo contato/Status. Notificacao diaria da fila pode ja estar parcialmente coberta pelos eventos de Agenda que o v3.2 cria. **Depende de ver o v3.2 completo.**
- **Fase 3 — Pipeline (negocio e gestao).** Aba Pipeline com Deal ID vinculado por Lead ID, 6 estagios do funil (Contato Inicial, Qualificacao, Proposta, Negociacao, Fechado Ganho, Fechado Perdido), valor, probabilidade por estagio, valor ponderado, fechamento previsto. Dashboard enxuto: pipeline ponderado, taxa de conversao, ticket medio, follow-ups vencidos. Aqui entram valor de negocio, estagio de funil e camada de gestao.
- **Fase 4 — Atividades (historico).** Aba Atividades como log por Lead ID e Deal ID (data, tipo, resumo). Resolve "o que falei da ultima vez".
- **Fase 5 — Gestao e higiene.** Origem do lead e filtros na aba Todos; politica de retencao/exclusao LGPD com rastro de revogacao; limpar TESTE.gs e migracoes antigas; gatilho de migracao para Pipedrive/HubSpot quando passar de alguns milhares de linhas ativas ou virar gargalo (os IDs estaveis tornam a migracao limpa).

**Decisao em aberto para o proximo chat:** depois da Fase 0, seguir para 0.2 (conservadora, fecha risco) ou pular para a Fase 1 (retorno diario imediato). E, em paralelo, resolver a integracao da regua v3.2, que e a peca que destrava a automacao real.

---

## Contrato de dados frontend/backend
`getClientes(forcar)` retorna no topo: `ok`, `geradoEm`, `total`, `pendentes`, `consentColOk`, `toqueColOk`, `respColOk`, `leadColOk`, `clientes[]`. Cada cliente: `leadId`, `nome`, `whatsapp`, `whatsappDigitos`, `produto`, `modelo`, `nivel`, `status`, `tipoMsg`, `situacao`, `ultimaResposta`, `proximoContato` (ISO), `atraso`, `precisa`, `dataUltimoToque` (ISO), `respondido` (ISO), `consentimento`, `podeContatar`, `dataConsentimento` (ISO), `waLink`.
`marcarStatus(nome, whatsapp, novoStatus)` -> `{ ok, msg, status, linha }`.
`setConsentimento(nome, whatsapp, valor)` -> `{ ok, msg, consentimento, dataConsentimento, linha }`.
`registrarToque(nome, whatsapp)` -> `{ ok, msg, dataUltimoToque, linha }`.
`registrarResposta(nome, whatsapp)` -> `{ ok, msg, respondido, linha }`.
`backfillLeadIds()` -> `{ ok, msg, gerados }`. Roda no editor; nao exige publicar.
Frontend identifica cliente por `data-nome` + `data-whats` (= `whatsappDigitos`).

---

## Aplicacao da Fase 0 (passo a passo)
1. Criar coluna no fim da planilha, cabecalho exato `Lead ID`.
2. No editor do Apps Script, abrir `crm_pitwall.gs`, Ctrl+A, Delete, colar o arquivo inteiro. Nunca fragmento.
3. Salvar e rodar `backfillLeadIds` uma vez (Executar). Preenche os IDs das linhas atuais. Nao exige publicar.
4. Para o app publicado enviar `leadId`, publicar nova versao (Implantar, Gerenciar implantacoes, Nova versao). Como o frontend ainda nao usa o campo, pode esperar a Fase 0.2. Salvar nao publica.
5. Conferir que `backfillLeadIds`, `_crmNumLead`, `_crmFormataLeadId`, `_crmMaxLeadNum` nao colidem com nomes no `Code.gs` nem no v3.2 (escopo global compartilhado se mesmo projeto).

---

## Aprendizados e regras criticas
- Colar `.gs`/bloco inteiro, nunca fragmento. Fragmento desalinha chave e derruba o arquivo todo. Para sobrescrever na revalidacao local, usar `cat >` com heredoc (`create_file` nao sobrescreve).
- `node --check` nao aceita extensao `.gs`; copiar para `.js` so para validar sintaxe.
- Erro de sintaxe em um `.gs` derruba o arquivo todo. "is not defined" pede checar chaves antes da logica.
- Saving nao e deploying. Salvar nao publica. So Implantar, Gerenciar implantacoes, Nova versao, Implantar coloca no ar. Funcao de servidor (ex.: backfillLeadIds) roda no editor sem publicar.
- ID estavel e congelado como valor, gerado uma vez, baseado no maior numero existente. Nunca formula ROW() (muda ao ordenar/filtrar).
- `onEdit`/`onChange` nao disparam em escrita por script. Cadencia automatica = gatilho de tempo que varre linhas.
- Gate fail-closed: `_crmConsentiu` so libera "sim" normalizado; vazio/Nao/outro bloqueia. Coluna ausente bloqueia tudo e `consentColOk` sinaliza.
- Localizacao por nome + telefone: `_crmLocalizaLinha` erra se houver mais de um match. Telefone desambigua. (Fase 0.2 troca para Lead ID.)
- `getSheetByName` retorna null em silencio em qualquer divergencia. Nome da aba exato, com em-dash U+2014.
- Grafia de valores comparados e fixa e identica na planilha e no `.gs`. `Sim`/`Nao` sem til; emojis com cuidado de variation selector U+FE0F (`_crmNorm` remove U+FE0F na comparacao).
- Dependencia frontend/backend por nome via `google.script.run`. Renomear funcao no `.gs` exige mudar o frontend.
- Validacao real, nao visual: `node --check` + AST (colisao de nomes) + harness/jsdom. Problema conhecido: `Date` cross-realm no harness vm, recuperar via `vm.runInContext('Date', ctx)`.
- Notion e so referencia de schema. CRM real vive no Sheets.
- Backup independente do ativo protegido (projeto separado).

---

## Estado atual (tabela)

| Item | Estado |
|---|---|
| Backup independente (trigger semanal) | Concluido |
| Colunas LGPD, sensor (toque/respondido) | No ar |
| Gate de WhatsApp, getClientes com sensor | No ar |
| setConsentimento, registrarToque, registrarResposta | No ar |
| Frontend v5 (fila com Respondeu; aba Todos com busca e consentimento) | No ar |
| Fase 0: Lead ID estavel (backfillLeadIds + getClientes expoe leadId) | Entregue e validado, falta aplicar e publicar |
| Regua v3.2 (Calendar Automation) | Existe; arquivo completo a ver; integracao com sensor pendente |
| Fase 0.2: localizacao por ID + frontend carrega leadId | A fazer |
| Fase 1: reagendar e cadastrar no app, WhatsApp de checagem na aba Todos | A fazer |
| Fase 2: reformular a regua v3.2 (ler sensor, varredura por tempo) | A fazer, depende do v3.2 completo |
| Fase 3: pipeline (Deal ID, funil, valor, dashboard) | A fazer |
| Fase 4: aba de atividades (historico) | A fazer |
| Fase 5: origem, filtros, retencao LGPD, limpeza, gatilho de migracao | A fazer |

---

## Nao reabrir, a menos que o dono peca
Transformar o Pit Wall em mesa de edicao ampla sem retorno claro, tratar consentimento como input central do dia a dia, ou colapsar "toque enviado" e "respondido" num evento so. O Pit Wall e sensor; a regua (v3.2) e o motor de cadencia; a planilha e a base. Manter essa separacao.
