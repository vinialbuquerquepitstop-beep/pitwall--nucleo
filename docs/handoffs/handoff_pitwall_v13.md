# Handoff Pit Wall / Pitstop Imports (v13)

## Como usar este documento
Continuacao da operacao do Pit Wall. Este handoff SUBSTITUI o v12 e todos os anteriores. Le primeiro "Estado em uma frase", "O que mudou nesta sessao", "Confirmacao visual pendente" e "Primeiro movimento do proximo chat".

Convencao de escrita: prosa sem acento e sem cedilha, nunca travessao. EXCECAO: dado real do sistema carrega seus proprios caracteres (nome da aba com em-dash U+2014, perfis como "Lead — Repescagem", status com emoji, sentinelas "💬 Conversando" e "⏰ Negociação parada", cabecalhos "Etapa cadencia", "Historico", "Data do ultimo toque", "Respondido", rotulos como "R3 · D14" com o ponto do meio U+00B7).

## Estado em uma frase
O passo 4 (registrarResposta virando quatro desfechos) foi entregue, validado e IMPLANTADO nesta sessao, backend e frontend. O timezone do projeto Pit Wall foi confirmado em America/Sao_Paulo. O auto-retorno do desfecho "Conversando" depende de um ajuste na regua (outro projeto), que e o proximo passo. Foco estrategico novo do projeto: virar um produto SaaS multi-cliente.

## O que mudou nesta sessao
1. **Timezone confirmado.** O appsscript.json do Pit Wall esta em America/Sao_Paulo. Isso resolve a raiz do off-by-one (data gravada como ontem); a correcao de meio-dia do v9 ja deixava robusto, agora e cinto e suspensorio.

2. **Foco de SaaS registrado.** O norte do projeto passou a ser evoluir o Pit Wall para SaaS multi-cliente para outros lojistas/revendedores Apple. Amigos lojistas ja demonstraram interesse (sinal inicial, ainda nao pagantes confirmados). Auditoria feita: ver secao "Plano SaaS" no fim. Ponto-chave: dados single-tenant "organizados e protegidos" (Lead ID, LGPD) NAO equivalem a SaaS-ready; a migracao de dados e a ultima etapa, nao a primeira.

3. **Passo 4, backend (crm_pitwall.gs), implantado.** Tres adicoes, arquivo inteiro validado e colado:
   - Sentinela top-level `var ETAPA_CONVERSANDO = '\uD83D\uDCAC Conversando';` (renderiza 💬 Conversando).
   - `registrarConversando(nome, whatsapp)`: desfecho "Conversando agora", **Opcao A**. Escreve a sentinela em Etapa cadencia e carimba Data do ultimo toque (meio-dia). NAO usa Respondido (freio temporario, nao permanente). Historico best-effort ("Conversando agora (app)").
   - `reagendarProximoContato(nome, whatsapp, dataISO)`: desfecho "Retomar em data" e reagendamento manual da Fase 1. So move Proximo contato para a data escolhida (meio-dia). Nao mexe em Respondido nem Status. Historico best-effort ("Reagendado para dd/MM/yyyy (app)").
   - **getClientes NAO foi tocado.** O retorno do lead anda pela regra de fila que ja existia.
   - Validacao: acorn como script, 24 funcoes top-level, 2 consts (CRM_CONFIG, ETAPA_CONVERSANDO), zero duplicata; harness de planilha em memoria (conversa esconde via ultimo toque, reagendar move data, Respondido intacto, regressao toque/resposta).

4. **Passo 4, frontend (Index.html, window.PitWallCRM), implantado.** O card da fila mudou:
   - O botao unico "Respondeu" virou um gatilho que abre quatro desfechos: **Conversando** (registrarConversando), **Retomar** (revela campo de data, depois reagendarProximoContato), **Fechou** (marcarStatus Convertido), **Sem interesse** (marcarStatus Lista fria).
   - Os botoes soltos Convertido e Lista fria sairam do card (viraram Fechou e Sem interesse dentro do leque).
   - O card agora LE etapaCadencia e mostra uma etiqueta colorida por palavra-chave (parada / conversando / neutra). E o que exibe o ⏰ Negociação parada quando a varredura marcar.
   - O "Respondeu" binario antigo (data-resp) e a funcao registrarResp foram aposentados no frontend. A funcao backend registrarResposta continua existindo, so nao e mais chamada pelo app.
   - Duas pecas coladas: um bloco de CSS no `<style>` do .pwcrm e o `<script>` inteiro do window.PitWallCRM substituido como unidade fechada.
   - Validacao: acorn no modulo, checagem de codigo morto (data-resp, data-st, registrarResp zerados), jsdom com 17 asserts (render, quatro desfechos chamando a funcao certa, campo de data, etiqueta parada, WhatsApp intacto, aba Todos intacta).

## Confirmacao visual pendente (o "sem percepcao de mudanca")
Isso e esperado, nao e erro. Backend e timezone sao invisiveis por design. A unica mudanca visivel do passo 4 e no card da fila. Como conferir em 1 minuto:
1. Abrir CRM, aba Fila do dia, com pelo menos um lead pendente. No card, os botoes Convertido e Lista fria nao existem mais soltos; tocar "Respondeu" deve abrir quatro botoes (Conversando, Retomar, Fechou, Sem interesse). Tocar "Retomar" deve revelar um campo de data.
2. Depois de tocar o WhatsApp de um lead, abrir a planilha e ver a coluna Historico daquela linha enchendo com "dd/MM/yyyy HH:mm · Toque enviado (app)...".
3. Se ainda aparecerem os botoes antigos, recarregar o app (cache do web app) e confirmar que a Nova versao foi de fato implantada (Implantar, Gerenciar implantacoes, Nova versao). Fila vazia = nenhum card = nada pra ver, e normal.

## Decisao travada: Opcao A (auto-retorno do Conversando)
- "Conversando agora" NAO usa o freio permanente (Respondido). Usa Etapa cadencia (sentinela) mais Data do ultimo toque como freio TEMPORARIO.
- O lead some da fila pela regra ja existente em getClientes: ultimo toque alcancou o proximo contato (toqueSatisfez).
- O retorno e da regua: quando a conversa esfria, a varredura 05h escreve ⏰ Negociação parada e empurra Proximo contato pra hoje, e o lead reaparece na fila com a etiqueta. Enquanto a regua nao fizer isso, o lead fica escondido corretamente, so nao volta sozinho.

## Primeiro movimento do proximo chat
1. Confirmar visualmente que o card novo subiu (teste acima). Se nao, e deploy ou cache.
2. **Ir para a REGUA** (projeto CRM Calendar Automation, outro chat). Confirmar ou ajustar que a varredura 05h, num lead com Etapa cadencia == 💬 Conversando, apos REDEA_DIAS de silencio (medido pela Data do ultimo toque), faz DUAS coisas: escreve ⏰ Negociação parada na Etapa cadencia E empurra Proximo contato pra hoje. O empurrao e o que traz o lead de volta a fila (via toqueSatisfez ficar falso). Se a regua so escrever a etiqueta sem adiantar a data, a alternativa e adicionar uma regra curta no getClientes: lead com Etapa == ETAPA_PARADA entra na fila (precisa = true) mesmo com toqueSatisfez. Preferir o empurrao na regua, que e a funcao natural dela.
3. Depois da regua: sugestao deterministica de mensagem por etapa (destravada, nao iniciada); Fase 3 pipeline; Fase 4 atividades (o Historico ja acumula toque, conversa e reagendamento desde agora).

## Contrato dos sentinelas cross-project
- `ETAPA_CONVERSANDO = '💬 Conversando'`: escrito pelo sensor no desfecho "Conversando agora" (registrarConversando). Lido pela varredura para aplicar a redea. No sensor esta como escape `'\uD83D\uDCAC Conversando'`.
- `ETAPA_PARADA = '⏰ Negociação parada'`: escrito pela varredura quando a redea dispara apos REDEA_DIAS de silencio. Lido pelo frontend (etiqueta) e, se for preciso, por uma regra futura no getClientes. Emoji U+23F0.
- Grafia identica nos dois projetos. As comparacoes no sensor usam _crmNorm (tira acento e U+FE0F), entao sao robustas a variacao.

## Contrato de _crmCarimbarHistorico (cross-project)
Corpo identico byte a byte entre regua e sensor. Formato "dd/MM/yyyy HH:mm · evento", prepend newest-first com \n. Se mexer num lado, replicar no outro e reconferir o diff (mesmo sha256).

## Estado do crm_pitwall.gs (apos esta sessao)
24 funcoes top-level, 2 consts (CRM_CONFIG, ETAPA_CONVERSANDO), zero duplicada, zero simbolo nao definido (excluindo globais GAS/JS). Funcoes novas: registrarConversando, reagendarProximoContato.

Contratos:
- `getClientes(forcar)` topo: ok, geradoEm, total, pendentes, consentColOk, toqueColOk, respColOk, leadColOk, etapaColOk, clientes[]. Por cliente inclui etapaCadencia. Inalterado nesta sessao.
- `registrarConversando(nome, whatsapp)` -> { ok, msg, etapaCadencia, dataUltimoToque, linha }.
- `reagendarProximoContato(nome, whatsapp, dataISO)` -> { ok, msg, proximoContato, linha }. dataISO aceita YYYY-MM-DD ou dd/MM/yyyy.
- `registrarToque` -> { ok, msg, dataUltimoToque, linha } (carimbo de Historico e efeito colateral).
- `registrarResposta` -> { ok, msg, respondido, linha } (binario; existe mas nao e mais chamado pelo frontend).
- `marcarStatus`, `setConsentimento`, `backfillLeadIds`: inalterados.

## Estado do frontend (Index.html, window.PitWallCRM)
- Fila do dia: card com WhatsApp (registra toque) e "Respondeu" que abre quatro desfechos. Convertido/Lista fria dentro do leque como Fechou/Sem interesse. Retomar tem campo de data (default amanha, formato YYYY-MM-DD enviado ao backend). Card mostra etiqueta de etapa quando preenchida.
- Aba Todos: busca, chip de consentimento, WhatsApp de checagem (link limpo, nao registra toque). Agora tambem mostra a etiqueta de etapa. Sem leque de desfecho.
- Chamadas ao backend por google.script.run: getClientes, registrarToque, registrarConversando, reagendarProximoContato, marcarStatus, setConsentimento.
- CSS novo: classes .pwcrm-etapa (parada/conversando/neutra) e .pwcrm-desf* (leque e campo de data).

## Colunas da planilha do CRM (estado)
Mapeadas por _crmMapaColunas (nome de cabecalho normalizado, 0-based): nome, whatsapp, produto, modelo, proximo contato, nivel, status, tipo de msg, situacao, ultima resposta, observacoes, consentimento, data consentimento, data do ultimo toque, respondido, lead id, etapa cadencia, historico.
Posicoes conhecidas: U Consentimento, V Data consentimento, W Lead ID, X Etapa cadencia, Y Historico, Z Respondido.
Status (5 fixos): 🟡 Pendente, ✅ Feito, 🟢 Convertido, ❄️ Lista fria, 🚫 Cancelado.
Consentimento: so Sim ou Nao sem til, identico na planilha e no codigo. Data dd/MM/yyyy.

## Regras criticas (mantidas)
- Validar como script (acorn, sourceType "script", ecmaVersion 2022), nao node --check.
- Substituir funcao ou modulo = apagar o antigo inteiro primeiro e colar unidade fechada. Const duplicada = erro fatal; funcao duplicada = ultima vence em silencio.
- Mesmo projeto = escopo global compartilhado entre os .gs. Projetos diferentes (sensor vs regua) NAO compartilham escopo: por isso _crmCarimbarHistorico e autossuficiente no sensor.
- Saving nao e deploying. Mudanca de contrato lido pelo app (getClientes, registrarToque, etc.) e mudanca de frontend EXIGEM Nova versao. Funcao de servidor pura roda no editor sem publicar.
- getSheetByName retorna null em silencio. Nome da aba exato, com em-dash U+2014.
- onEdit/onChange NAO disparam em escrita por script. Cadencia automatica = varredura 05h na regua.
- Gravar data-only em celula: meio-dia (12:00), nunca meia-noite, por causa do fuso. appsscript.json em America/Sao_Paulo (confirmado).
- O sensor (crm_pitwall.gs) so registra o que aconteceu; a regua le e decide; a planilha e a fonte da verdade.
- Validacao real, nao visual: acorn full-file + enumeracao AST + simbolo nao definido (excluindo globais GAS) + harness de planilha para .gs + jsdom para frontend.

## Plano SaaS (auditoria desta sessao)
Pergunta do dono: em que momento os dados dos clientes migram para um banco proprio, ja que estao organizados e protegidos.
Resposta: por ultimo, nao por estarem organizados. A organizacao (Lead ID) so torna a migracao barata; nao adianta o momento. O gatilho e "o destino multi-tenant existe e a demanda foi provada".
Fases:
- Fase A: validar demanda barato (3 a 5 lojistas confirmando dor e preco, de preferencia com sinal de pagamento). Sem mexer em dado. Amigos ja demonstraram interesse, mas interesse nao e pagamento.
- Fase B: endurecer o single-tenant (passo 4 feito; falta regua, pipeline, atividades), na stack atual, usando a Pitstop como cobaia.
- Fase C: arquitetura multi-tenant (ex.: Postgres/Supabase mais app web), tenant_id como particao de topo, autenticacao. Aqui nasce o banco de verdade, so com o dado do dono como tenant 1.
- Fase D: migracao de dados (este e o momento perguntado). Lead ID faz um ETL limpo.
- Fase E: onboard de clientes, contrato de operador LGPD (o dono vira operador, nao so controlador), backup por cliente, cobranca.
Alerta de fundo: revenda (Pitstop) e software (Pit Wall) sao dois negocios com economias diferentes. Nao deixar a construcao do software comer a margem da revenda antes da Fase A dizer que o software vale mais.

## Estado atual (tabela)
| Item | Estado |
|---|---|
| Regua relativa (projeto CRM Calendar Automation) | No ar |
| Varredura 05h | Instalada |
| Sensor passos 1 a 3 (Historico, getClientes, registrarToque) | No ar |
| Correcao de fuso (meio-dia) + appsscript.json America/Sao_Paulo | No ar e confirmado |
| Sensor passo 4: registrarConversando + reagendarProximoContato + sentinela | No ar (implantado) |
| Frontend passo 4: card com quatro desfechos + etiqueta de etapa | No ar (implantado); confirmacao visual pendente |
| Auto-retorno do Conversando (varredura escreve ETAPA_PARADA + adianta Proximo contato) | A fazer na REGUA (proximo passo) |
| Sugestao deterministica de mensagem por etapa | Destravada, nao iniciada |
| Fase 3 pipeline / Fase 4 atividades | A fazer (Historico ja acumula) |
| Evolucao para SaaS | Estrategia definida (Fases A a E); comecar pela Fase A (validar demanda) |

## Nao reabrir, a menos que o dono peca
Colapsar "toque enviado" e "respondido" num evento so; tratar consentimento como input central do dia a dia; trocar a sugestao deterministica por geracao com IA; voltar o auto-loop de repescagem; validar .gs so com node --check; diagnosticar por fragmento; migrar dado de cliente antes de existir destino multi-tenant e demanda provada. O Pit Wall e sensor; a regua e o motor de cadencia; a planilha e a base.
