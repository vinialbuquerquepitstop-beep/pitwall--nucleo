# Handoff Pit Wall / Pitstop Imports (v14)

## Como usar este documento
Continuacao da operacao do Pit Wall. Este handoff SUBSTITUI o v13 e todos os anteriores. Le primeiro "Estado em uma frase", "O que mudou nesta sessao", "Pendencias abertas" e "Primeiro movimento do proximo chat".

Convencao de escrita: prosa sem acento e sem cedilha, nunca travessao. EXCECAO: dado real do sistema carrega seus proprios caracteres (nome da aba com em-dash U+2014, status com emoji, sentinelas "💬 Conversando" e "⏰ Negociação parada", cabecalhos "Etapa cadencia", "Historico", "Data do ultimo toque", "Respondido", rotulos com ponto do meio U+00B7).

## Estado em uma frase
O card da fila foi refeito: WhatsApp virou so-abre (nao registra toque), nasceu um botao dedicado "Toque enviado", entrou um termometro de dias-sem-resposta, e os desfechos Fechou / Sem interesse passaram a carimbar Historico distinto. A cadencia da regua passa a ser dirigida por toque (decisao travada). Duas pendencias novas entraram: Lead ID parou de atualizar na planilha, e a aba Estrategia vai ganhar captacao ativa com metas diarias.

## O que mudou nesta sessao (entregue e validado, falta implantar)
1. **WhatsApp da fila agora SO abre.** Perdeu o `data-wa`; nao registra mais toque. Continua com o template e continua travado por consentimento (so aparece com waLink, que exige Consentimento = Sim). Abrir a conversa para conferir nao e contato.
2. **Botao "Toque enviado" dedicado.** E o unico que registra o toque agora (chama `registrarToque`), carimba Historico e tira o card da fila. E ele que faz a regua andar a cadencia.
3. **Termometro de silencio.** Etiqueta "N dias sem resposta" no card (fila e Todos), derivada de `dataUltimoToque` + `respondido` (sem coluna nova, B=SIM). Fica em alerta vermelho a partir de 3 dias. E leitura visual; o app nao esfria sozinho.
4. **Desfechos Fechou / Sem interesse carimbam Historico distinto** via nova funcao `registrarDesfecho(nome, whatsapp, tipo)`. tipo 'convertido' grava "Fechou / Convertido (app)"; tipo 'sem_interesse' grava "Sem interesse (app)". Antes chamavam `marcarStatus`, que nao carimbava nada. Agora "sem interesse" (recusou) fica distinguivel de "esfriado por silencio" (sumiu, evento da regua).
5. **crm_pitwall.gs reconstruido com passo 4.** ATENCAO: a copia do .gs revisada nesta sessao NAO tinha `registrarConversando`, `reagendarProximoContato` nem `ETAPA_CONVERSANDO`, apesar de o frontend chamar as duas. Foram reconstruidas a partir do contrato do v13 e reincorporadas. Ver "Pendencia critica" abaixo.
6. **Validacao executada:** acorn no .gs completo (26 funcoes, zero duplicata, `ETAPA_CONVERSANDO` unica); jsdom com 15 asserts (WhatsApp e link sem data-wa, Toque enviado -> registrarToque, leque abre, Conversando/Fechou/SemInteresse/Retomar mapeiam para a funcao certa, Retomar envia YYYY-MM-DD, termometro renderiza, aba Todos sem leque).

## Pendencia critica antes de colar o .gs
O .gs entregue inclui `registrarConversando`, `reagendarProximoContato` e a sentinela `var ETAPA_CONVERSANDO`. **Antes de Ctrl+A + colar, confirmar que essas tres coisas NAO vivem num arquivo .gs separado do mesmo projeto.** Se viverem, colar o arquivo novo duplica a sentinela e da erro fatal de `const`/`var` duplicada no mesmo escopo global. Como conferir: no editor, abrir cada arquivo .gs do projeto e buscar por `ETAPA_CONVERSANDO`. Tem que aparecer em UM arquivo so.

## Decisao travada: cadencia da regua dirigida por toque
A regua NAO anda por tempo puro. Ela so avanca quando confirma que houve toque para o passo atual. Isso protege contra esfriar um lead que o operador esqueceu de tocar.

Contrato cross-project (so colunas existentes, zero coluna nova):
- **Le:** `Data do ultimo toque`, `Respondido`, `Etapa cadencia`, `Proximo contato`.
- **Regra 1 (avanco verificado por toque):** avanca a cadencia so quando `Data do ultimo toque >= data em que o passo venceu`. Sem toque confirmado, nao avanca; o lead fica na fila esperando o operador agir.
- **Regra 2 (esfriamento so em quem foi tocado e ignorado):** vira `❄️ Lista fria` quando cadencia no ultimo passo + toque confirmado + `Respondido` vazio + silencio acima do limite. Carimba Historico `Esfriado por silencio (regua)`.
- A contagem "sem resposta, sem resposta, sem resposta" e a propria cadencia rodando ate o fim. Nao precisa de contador numerico.
- Pendencia: o bookkeeping exato da "data em que o passo venceu" (ordem entre varredura 05h e toque no meio do dia) so fecha com o codigo da regua aberto, no chat da regua.

## Decisao travada: WhatsApp x consentimento (por que sumia da fila)
O WhatsApp da fila so nasce com `waLink`, e `waLink` e travado por Consentimento = Sim (fail-closed). Leads sem Sim ficam sem o botao na fila (na aba Todos aparece porque la o link e limpo, sem trava). Isso explica o "WhatsApp sumiu".
- Acao imediata (recomendada): preencher `Sim` na coluna U dos leads ativos (selecionar o intervalo, digitar Sim). Desbloqueia sem codigo.
- Decisao em aberto do dono: manter fail-closed (so Sim libera) OU afrouxar para bloquear so no `Nao` explicito (vazio passa a liberar, interesse legitimo do inbound; `Nao` continua sendo o kill-switch). Se optar por afrouxar, e uma linha no `getClientes` (a montagem de `waLink`). Nao alterado ainda; aguarda a palavra do dono.
- Nota: "Toque enviado" NAO e travado por consentimento; registra o evento mesmo sem Sim.

## Contrato de dados (frontend/backend) apos esta sessao
- `getClientes(forcar)` inalterado no contrato.
- `registrarToque(nome, whatsapp)` -> { ok, msg, dataUltimoToque, linha }. Chamado pelo botao Toque enviado. Carimba Historico.
- `registrarConversando(nome, whatsapp)` -> { ok, msg, etapaCadencia, dataUltimoToque, linha }.
- `reagendarProximoContato(nome, whatsapp, dataISO)` -> { ok, msg, proximoContato, linha }. Aceita YYYY-MM-DD ou dd/MM/yyyy; grava ao meio-dia (seguro contra fuso via `_crmParseDataFlex`).
- `registrarDesfecho(nome, whatsapp, tipo)` -> { ok, msg, status, linha }. tipo em {'convertido','sem_interesse'}. Grava status e carimba Historico distinto.
- `registrarResposta` continua existindo, nao e chamado pelo frontend.
- `marcarStatus`, `setConsentimento`, `backfillLeadIds`: inalterados.

## Estado dos arquivos (apos esta sessao)
- **crm_pitwall.gs:** 26 funcoes top-level, 2 vars top-level (CRM_CONFIG, ETAPA_CONVERSANDO), zero duplicata. Novas nesta sessao: `registrarDesfecho`, `_crmParseDataFlex`. Reincorporadas: `registrarConversando`, `reagendarProximoContato`.
- **Index.html / window.PitWallCRM:** card da fila com WhatsApp (so abre) + Toque enviado + Respondeu (leque de quatro). Termometro de silencio na fila e em Todos. Funcao `marcar()` removida (codigo morto); no lugar, `desfechoFinal()` chama `registrarDesfecho`. Sem `data-wa`.
- **CSS .pwcrm:** novas classes `.pwcrm-acao.toque` (navy) e `.pwcrm-silencio` (roxo, com variante `.alerta` vermelha).

## Aplicacao (passo a passo)
1. Conferir a pendencia critica (ETAPA_CONVERSANDO em um arquivo so).
2. crm_pitwall.gs: Ctrl+A, Delete, colar o arquivo inteiro.
3. Index.html: substituir o bloco `<script>` do window.PitWallCRM inteiro (unidade fechada) e o bloco `<style>` do .pwcrm inteiro.
4. Implantar nova versao (Implantar, Gerenciar implantacoes, Nova versao, Implantar). Mudou contrato lido pelo app e mudou frontend, entao EXIGE nova versao.
5. Conferir no telefone: card com WhatsApp verde (se o lead tiver Sim), Toque enviado navy, Respondeu abrindo quatro. Termometro aparece em quem foi tocado e nao respondeu.

## Pendencias abertas (fila do proximo trabalho)
1. **[CRITICO] Lead ID parou de atualizar na planilha.** Diagnostico provavel: `backfillLeadIds` so preenche quando rodado no editor, e o cadastro de lead novo (append) nao gera Lead ID na hora. Entao lead novo entra sem ID. Nao e quebra, e um buraco que sempre existiu. Para fechar: (a) rodar `backfillLeadIds` agora para carimbar os pendentes; (b) decidir se o cadastro de lead novo passa a gerar Lead ID no append (o que exige ver como o lead novo entra hoje: digitado direto na planilha ou por funcao no app). Confirmar o caminho de entrada antes de codar.
2. **Aba Estrategia: captacao ativa com metas diarias.** Frente propria. A captacao ativa (prospeccao/outbound) precisa de meta acompanhada todo dia para nao se perder. Desenho a definir: onde mora a meta (aba Vetores? nova aba? Sheets?), qual a unidade (numero de abordagens/dia, de respostas, de agendamentos), como o Pit Wall le e mostra o progresso do dia, e o vinculo com o CRM (cada abordagem ativa vira lead com origem marcada). Nao comecar sem cravar a metrica-alvo e a fonte da verdade da meta.
3. **Regua dirigida por toque** (chat da regua): implementar Regra 1 e Regra 2 acima com o codigo da regua aberto.
4. **Politica de consentimento na fila:** dono decide fail-closed vs bloquear-so-no-Nao.
5. **Sugestao deterministica de mensagem por etapa:** destravada, nao iniciada.
6. **Fase 3 pipeline / Fase 4 atividades:** o Historico ja acumula toque, conversa, reagendamento, fechamento e sem-interesse, entao a Fase 4 ja tem materia-prima.
7. **SaaS:** comecar pela Fase A (validar demanda com 3 a 5 lojistas, sinal de pagamento). Interesse nao e pagamento.

## Regras criticas (mantidas)
- Validar como script (acorn, sourceType "script", ecmaVersion 2022), nao node --check. Harness de planilha para .gs, jsdom para frontend.
- Substituir funcao ou modulo = apagar o antigo inteiro e colar unidade fechada. Const/var duplicada = erro fatal; funcao duplicada = ultima vence em silencio.
- Mesmo projeto = escopo global compartilhado entre os .gs. Sensor e regua sao projetos diferentes, nao compartilham escopo; por isso `_crmCarimbarHistorico` e autossuficiente no sensor.
- Saving nao e deploying. Mudanca de contrato lido pelo app e mudanca de frontend EXIGEM nova versao.
- getSheetByName retorna null em silencio. Nome da aba exato, com em-dash U+2014.
- onEdit/onChange NAO disparam em escrita por script. Cadencia automatica = varredura 05h na regua.
- Gravar data-only em celula: meio-dia (12:00), nunca meia-noite, por causa do fuso. appsscript.json em America/Sao_Paulo (confirmado).
- Sensor so registra o que aconteceu; a regua le e decide; a planilha e a fonte da verdade.
- WhatsApp da fila = so abre (nao registra). Toque enviado = registra. Dois eventos distintos, nunca colapsar.

## Nao reabrir, a menos que o dono peca
Colapsar "toque enviado" e "respondido" num evento so; fazer o WhatsApp registrar toque de novo; tratar consentimento como input central do dia a dia; trocar a sugestao deterministica por IA; fazer o app esfriar lead sozinho (isso e da regua); migrar dado de cliente antes de existir destino multi-tenant e demanda provada. O Pit Wall e sensor; a regua e o motor de cadencia; a planilha e a base.
