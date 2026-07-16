# Handoff Pit Wall / Pitstop Imports (v16)

## Como usar este documento
Continuacao da operacao do Pit Wall. Este handoff SUBSTITUI o v15 e todos os anteriores. Le primeiro "Estado em uma frase", "Ponto de partida do proximo chat", "TAREFA DO PROXIMO CHAT (form de cadastro)" e "O que ainda falta antes de publicar".

Convencao de escrita: prosa sem acento e sem cedilha, nunca travessao. EXCECAO: dado real do sistema carrega seus proprios caracteres (nome da aba com em-dash U+2014, status com emoji, sentinelas "💬 Conversando" e "⏰ Negociação parada", cabecalhos "Etapa cadencia", "Historico", "Nível", "Data do ultimo toque", "Respondido", rotulos com ponto do meio U+00B7).

## Estado em uma frase
O backend `crm_pitwall.gs` foi reescrito com nivel derivado (Rota A) e a nova funcao `cadastrarLead`, validado (acorn + harness, 51 asserts, 0 falha) e JA COLADO no projeto do Pit Wall. NAO foi testado no editor e NAO foi publicada nova versao. O frontend NAO foi tocado. O proximo passo e construir o form de cadastro no frontend e so entao publicar backend e frontend juntos.

## Ponto de partida do proximo chat
- O `crm_pitwall.gs` novo esta colado no projeto (Head), mas nao testado e nao publicado.
- O frontend (`Index.html`, `window.PitWallCRM`) esta na versao v14 (card com WhatsApp so-abre, Toque enviado dedicado, termometro, quatro desfechos). Sem form de cadastro ainda.
- Como o backend novo mudou o contrato (nivel derivado + campo `diasSilencio`), publicar agora subiria backend novo com frontend velho. Nao publicar ate o form estar pronto. O frontend velho nao quebra com o backend novo (o card mostra "🔥 Quente" via esc(c.nivel)), mas o certo e subir os dois juntos.
- Antes de publicar, recomendado rodar um teste do `cadastrarLead` no editor (ver "Teste no editor" no fim). Grava numa linha real; confirma que o mapa de colunas casou com a planilha de verdade.

---

## Descoberta desta sessao: nenhuma coluna a criar
A planilha ja tem as 29 colunas necessarias. A tarefa do v15 de "criar colunas Origem, Estado, Upgrade, Aparelho de entrada" esta CANCELADA. Todas ja existem. Mapa real do cabecalho (por posicao):

| Col | Cabecalho real | Papel |
|---|---|---|
| A | Nome | nome |
| B | WhatsApp | telefone (chave do dedup) |
| C | Produto | qual aparelho ("17 Pro Max", "MacBook M1") |
| D | Modelo | CONDICAO (Lacrado / Vitrine / Seminovo). Nome legado; e o "Estado" do v15 |
| E | Data do contato | data de entrada |
| F | Próximo contato | dispara a fila do dia |
| G | Última resposta | |
| H | Situação | |
| I | Perfil | classifica o lead; a regua le pra montar a cadencia |
| J | Nível | NAO usada mais na leitura (Rota A deriva). Coluna morta |
| K | Status | 5 fixos |
| L | Tipo de msg | template do WhatsApp |
| M | Origem | dropdown (7 valores) |
| N | Indicado por | condicional (Origem = Indicacao) |
| O | Qtd compras | |
| P | Valor total (R$) | |
| Q | Valor oferta (R$) | e o "Proposta enviada". Fora do cadastro basico |
| R | Agendado | possivel marcador de "ja agendado" (a confirmar na regua) |
| S | Event IDs | IDs dos eventos de Agenda. VAZIO = sinal de "cadencia nao inicializada" |
| T | Observações | obs |
| U | Consentimento | Sim / Nao |
| V | Data consentimento | |
| W | Lead ID (com espaco no fim) | LEAD-0001. _crmNorm apara o espaco, mapa casa |
| X | Etapa cadencia | sentinelas cross-project |
| Y | Historico | log dd/MM/yyyy HH:mm · evento |
| Z | Respondido | freio permanente |
| AA | Data do ultimo toque | |
| AB | UPGRADE (com espaco no fim) | Sim / Nao |
| AC | APARELHO DE ENTRADA | texto |

Ponto critico de nomenclatura: **Produto (C) = qual aparelho; Modelo (D) = condicao.** Invertido do senso comum, mas consistente e ja ligado no codigo (`col.modelo` aponta pra D). NAO renomear D, porque a regua tambem le por nome; renomear e mudanca cross-project que pode quebrar o outro projeto.

---

## O que mudou no backend nesta sessao (entregue, colado, nao testado, nao publicado)

Arquivo `crm_pitwall.gs`, 30 funcoes top-level, 3 vars (CRM_CONFIG, ETAPA_CONVERSANDO, NIVEL_ROTULO), zero duplicata.

1. **Nivel derivado (Rota A). TRAVADO.** `getClientes` parou de ler a coluna J e passou a calcular o nivel por dias de silencio:
   - Faixas: 0-2 = quente, 3-6 = morno, 7+ = frio.
   - Lead novo (sem toque) ou que respondeu = quente.
   - Rotulos exibidos (definidos no bloco `NIVEL_ROTULO` no topo): `🔥 Quente`, `🌡️ Morno`, `❄️ Frio`. Trocaveis em 3 strings se preferir outros emojis.
   - Novo campo no contrato: `diasSilencio` (numero ou null). Fonte unica pro termometro (antes o frontend recalculava).

2. **`cadastrarLead(dados)` nova.** Append com dedup leve, Lead ID no ato, defaults. Detalhe no contrato abaixo.

3. **Mapa de colunas estendido** (`_crmMapaColunas`): novas chaves dataContato, perfil, origem, indicadoPor, agendado, eventIds, upgrade, aparelhoEntrada.

4. **Template do WhatsApp sem `{modelo}`.** Como Modelo virou condicao, "Vitrine" nao vai mais pra mensagem do cliente. `msgPorTipo` agora usa so `{nome}` e `{produto}`.

5. **`_crmAgoraHistorico`** nova (auxiliar): monta a primeira linha do Historico no append sem tocar em `_crmCarimbarHistorico` (que segue byte a byte identico a regua, contrato cross-project preservado).

### 3 decisoes assumidas nesta sessao (cada uma e 1 linha; reverter e trivial)
1. **Proximo contato do lead novo = hoje.** Cai na fila no mesmo dia (fluxo inbound: cliente chama, voce responde no dia).
2. **Tipo de msg do lead novo = "primeiro contato".** O WhatsApp da fila abre com "Vi seu interesse no {produto}, posso passar as condicoes?".
3. **Emojis do nivel: 🔥 / 🌡️ / ❄️** (a antiga coluna J tinha palavra com emoji; como a Rota A abandona a J, os rotulos foram redefinidos).

---

## Contratos de dados (frontend/backend) apos esta sessao

- `getClientes(forcar)` topo inalterado no shape geral. Por cliente, MUDOU:
  - `nivel`: agora vem DERIVADO (string com emoji, ex "🔥 Quente"), nao mais da celula J.
  - `diasSilencio`: NOVO. numero de dias sem resposta, ou null (sem toque ou ja respondeu).
- `cadastrarLead(dados)` -> `{ ok, msg, leadId, linha, duplicado }` ou, se telefone repetido sem forcar, `{ ok:false, duplicado:true, existente:{ nome, linha, whatsappDigitos }, msg }`.
  - `dados = { nome, whatsapp (ou whatsappDigitos), produto, modelo (=condicao), perfil, origem, indicadoPor, observacao, upgrade, aparelhoEntrada, consentimento, forcar }`.
  - Obrigatorios: nome, whatsapp, produto, perfil, origem. Se `origem` normaliza para "indicacao", `indicadoPor` tambem e obrigatorio.
  - Grava: Nome, WhatsApp (normalizado), Produto, Modelo (condicao), Perfil, Origem, Status Pendente, Tipo de msg "primeiro contato", Data do contato hoje (12:00), Proximo contato hoje (12:00), Consentimento (default Sim) + Data consentimento, Lead ID (max+1), Historico "Cadastrado (app)". Opcionais so se preenchidos: Indicado por, Observacoes, Upgrade, Aparelho de entrada.
  - Deixa VAZIO de proposito: Nivel (J, Rota A deriva) e Event IDs (S, sinal pra regua inicializar).
- Inalterados: `registrarToque`, `registrarResposta`, `registrarConversando`, `reagendarProximoContato`, `registrarDesfecho`, `marcarStatus`, `setConsentimento`, `backfillLeadIds`.

---

## TAREFA DO PROXIMO CHAT (form de cadastro no frontend)

Construir o form de cadastro dentro de `window.PitWallCRM` (bloco `<script>` do `Index.html`), CSS `.pwcrm`. Unidade fechada, validada com jsdom antes de entregar. Sobe junto com o `crm_pitwall.gs` novo (nova versao).

### Interface (mobile-first, orcamento de dois cliques)
- Botao "Novo lead" no topo do modulo CRM (perto de Atualizar ou como acao fixa). Abre um painel/form (inline ou modal simples), nao uma nova aba.
- Campos, na ordem, com o controle certo:
  1. Nome (texto, obrigatorio)
  2. WhatsApp (tel, obrigatorio; normaliza no backend, mas exibir mascara ajuda)
  3. Produto (texto, obrigatorio) = qual aparelho
  4. Condicao (dropdown, obrigatorio): Lacrado / Vitrine / Seminovo (grava na coluna D via campo `modelo`)
  5. Perfil (dropdown, obrigatorio): valores exatos da coluna I (VER pendencia abaixo, faltam os valores)
  6. Origem (dropdown, obrigatorio): Indicacao, Instagram, WhatsApp direto, Loja fisica, Prospeccao ativa, Parceria influencer, Parceria PAG local
  7. Indicado por (texto): OCULTO por padrao; aparece e vira obrigatorio SO quando Origem = Indicacao
  8. Consentimento (Sim / Nao, default Sim)
  9. Observacao (texto, opcional)
  10. Upgrade (Sim / Nao, opcional)
  11. Aparelho de entrada (texto, opcional)
- Botao "Cadastrar" chama `google.script.run` -> `cadastrarLead(dados)`.

### Dedup leve (fluxo obrigatorio)
- Se o retorno vier `{ ok:false, duplicado:true, existente:{ nome, linha } }`, NAO tratar como erro. Mostrar aviso "Ja existe um lead com esse WhatsApp: [nome]" e dois botoes:
  - "Abrir existente": troca pra aba Todos e filtra pela busca (telefone ou nome) pra achar o lead.
  - "Cadastrar mesmo assim": reenvia o mesmo `dados` com `forcar:true`.
- Chave do dedup = telefone normalizado (o backend ja faz).

### Pos-sucesso
- Toast de confirmacao com o Lead ID.
- Refetch da fila (`buscar(true)`): o lead novo aparece na fila hoje, com WhatsApp verde liberado (Consentimento Sim).
- Fechar o form.

### Ajustes de leitura que entram junto
- **Termometro passa a ler `c.diasSilencio` do backend** (fonte unica). Trocar a funcao `diasSemResposta` do frontend por ler `c.diasSilencio` (manter fallback local so se o campo vier undefined, por seguranca com cache antigo).
- **Nivel agora aparece em TODOS os cards** (a Rota A sempre deriva; antes so quem tinha J preenchida). Decidir com o dono: mostrar as tres temperaturas ou suprimir "Quente" pra reduzir ruido (Quente e o default; morno/frio e que sinalizam esfriamento). Sugestao: suprimir Quente, destacar morno/frio. Decisao do dono.

### Validacao exigida (jsdom)
- Form abre e fecha; obrigatorios bloqueiam; Indicado por aparece so em Origem = Indicacao e vira obrigatorio; Cadastrar chama `cadastrarLead` com o objeto certo; dedup mostra o aviso e "Cadastrar mesmo assim" reenvia com `forcar:true`; sucesso dispara refetch; termometro le `c.diasSilencio`.

### PENDENCIA que trava so o dropdown de Perfil
Faltam os VALORES exatos da coluna I (Perfil), que sao os perfis que a regua reconhece (ex "Lead — Repescagem", "Lead — Em espera", etc). Pegar do dropdown da coluna I na planilha (Dados, validacao de dados) ou do codigo da regua. Sem eles, o dropdown de Perfil no form fica sem opcoes corretas. O resto do form nao depende disso.

---

## Trabalho na regua (outro projeto, chat do Código.gs). NAO trava o cadastro.
A regua monta a cadencia e cria os eventos de Agenda quando o Perfil e selecionado NA MAO (onEdit). Cadastro por script (append) NAO dispara onEdit. Entao lead do app entra com Perfil preenchido mas sem cadencia montada e sem eventos de Agenda.

Decisao do dono: **manter os eventos de Agenda.** Desenho para nao perder automacao:
- Lado sensor (ja feito): `cadastrarLead` deixa o lead acionavel na hora (Status Pendente, Proximo contato hoje) e deixa `Event IDs` VAZIO como sinal.
- Lado regua (a fazer): ensinar a varredura das 05h a inicializar todo lead com Perfil preenchido e `Event IDs` vazio: montar a cadencia, calcular o primeiro Proximo contato e criar os eventos de Agenda. A varredura ja roda todo dia e ja le Perfil, entao e acrescimo, nao reconstrucao. Latencia ate 24h, aceitavel; o lead ja e util na fila desde o cadastro.
- A confirmar no chat da regua: (a) a varredura hoje inicializa cadencia de lead que tem Perfil mas nunca passou por onEdit? Provavelmente nao. (b) qual coluna e o marcador real de "ja agendado": Agendado (R) ou Event IDs (S) vazio? Isso define o sinal exato. So da pra ver com o Código.gs aberto.
- Descartado: app chamar a regua direto (biblioteca / API executavel). Acopla os projetos, complica deploy e autorizacao; a varredura resolve o mesmo com menos peca movel.

---

## Validacao executada nesta sessao (real, nao visual)
- acorn no arquivo completo (sourceType script, ecmaVersion 2022): sintaxe valida. 30 funcoes top-level, 3 vars, zero duplicata, ETAPA_CONVERSANDO unica.
- Harness de planilha em memoria (fakes de SpreadsheetApp/Utilities/Session/LockService/CacheService, Date nativo no realm atual via new Function, sem cross-realm): 51 asserts, 0 falha. Cobre: nivel derivado nas tres faixas (novo=quente, 5d=morno, 8d=frio, respondeu=quente), diasSilencio, lead novo precisa=true, cadastrarLead (append, leadId max+1, telefone normalizado, condicao em D, status Pendente, tipo primeiro contato, consentimento Sim+data, datas ao meio-dia, historico com U+00B7, J vazio, Event IDs vazio, upgrade/aparelho/obs), dedup bloqueia, forcar ignora, Indicado por condicional, obrigatorios, e waLink sem expor a condicao.

## Teste no editor (recomendado antes de publicar)
Rodar uma vez pra confirmar a gravacao na planilha real, depois apagar o lead de teste e a funcao:
```
function _testeCadastro() {
  var r = cadastrarLead({
    nome: 'TESTE CADASTRO', whatsapp: '22999990000',
    produto: '16', modelo: 'Vitrine', perfil: '<UM PERFIL VALIDO DA COLUNA I>',
    origem: 'Instagram', observacao: 'teste', upgrade: 'Nao'
  });
  Logger.log(JSON.stringify(r));
}
```
Conferir no log o Lead ID e a linha, e na planilha se as colunas cairam certas (Produto em C, condicao em D, etc). Apagar a linha de teste depois.

---

## O que ainda falta antes de publicar
1. Construir o form (tarefa do proximo chat).
2. Pegar os valores exatos do dropdown de Perfil (coluna I).
3. Trocar o termometro pra ler `c.diasSilencio`.
4. Decidir exibicao do nivel (mostrar Quente ou so morno/frio).
5. Publicar nova versao (backend novo + frontend novo juntos). Muda contrato lido pelo app e muda frontend, entao EXIGE nova versao (Implantar, Gerenciar implantacoes, Nova versao, Implantar).

---

## Pendencias abertas (fila do proximo trabalho, depois do form)
1. **Regua inicializa lead do app** (chat do Código.gs): varredura monta cadencia + Agenda pra lead com Perfil e Event IDs vazio.
2. **Regua dirigida por toque** (do v14): Regra 1 (avanco verificado por toque) e Regra 2 (esfriamento so em quem foi tocado e ignorado).
3. **Pos-venda dentro do Pit Wall**: registro de relacionamento por Lead ID (LTV, ciclo de upgrade via Aparelho de entrada, depoimento, indicacao). Compartilha campos com o cadastro. Gancho `sincronizarPosVenda` previsto.
4. **Aba Estrategia: captacao ativa com metas diarias**. Depende de Origem no cadastro (cada abordagem ativa vira lead com origem "Prospeccao ativa"). Cravar metrica-alvo e fonte da verdade da meta antes de comecar.
5. **Politica de consentimento na fila**: fail-closed (so Sim libera) vs bloquear so no Nao explicito. Decisao do dono, pendente desde o v14. Nota: como o cadastro ja grava Sim por padrao, o atrito do inbound some na pratica; a decisao vale so pra base antiga sem Sim.
6. **Sugestao deterministica de mensagem por etapa**: destravada, nao iniciada.
7. **Fase 3 pipeline / Fase 4 atividades**: Historico ja acumula toque, conversa, reagendamento, fechamento, sem-interesse, cadastro. Fase 4 tem materia-prima.
8. **SaaS**: comecar pela Fase A (validar demanda com 3 a 5 lojistas, sinal de pagamento). Interesse nao e pagamento.

## Regras criticas (mantidas)
- Validar como script (acorn, sourceType "script", ecmaVersion 2022) no ARQUIVO COMPLETO, nao node --check, nao fragmento. Harness de planilha em memoria para .gs, jsdom para frontend.
- Substituir funcao ou modulo = apagar o antigo inteiro e colar unidade fechada. Const/var duplicada = erro fatal; funcao duplicada = ultima vence em silencio.
- Mesmo projeto = escopo global compartilhado entre os .gs. Sensor e regua sao projetos diferentes, nao compartilham escopo; por isso `_crmCarimbarHistorico` e autossuficiente no sensor e deve seguir byte a byte identico a versao da regua.
- Saving nao e deploying. Mudanca de contrato lido pelo app e mudanca de frontend EXIGEM nova versao. Funcao de servidor pura (backfillLeadIds, teste de cadastro) roda no editor sem publicar.
- getSheetByName retorna null em silencio. Nome da aba exato, com em-dash U+2014.
- Mapa de colunas le por NOME de cabecalho normalizado (_crmNorm apara acento, espaco, U+FE0F), nao por posicao. Coluna nova so no fim; coluna existente fica onde esta. Nao criar dois cabecalhos que normalizam igual.
- onEdit/onChange NAO disparam em escrita por script (setValue/append). Cadencia automatica e inicializacao de lead do app = varredura de tempo na regua.
- Gravar data-only em celula: meio-dia (12:00), nunca meia-noite, por causa do fuso. appsscript.json em America/Sao_Paulo (confirmado).
- Telefone sempre normalizado no append (so digitos, 55, nono digito), senao waLink quebra.
- Sensor so registra o que aconteceu; a regua le e decide; a planilha e a fonte da verdade.
- WhatsApp da fila = so abre (nao registra). Toque enviado = registra. Dois eventos distintos, nunca colapsar.

## Nao reabrir, a menos que o dono peca
Colapsar "toque enviado" e "respondido"; colapsar frio (nivel) com ❄️ Lista fria (status); renomear a coluna D (quebra a regua); fazer o WhatsApp registrar toque; tratar consentimento como input central do dia a dia; transformar o app em mesa de edicao ampla (cadastro por append e criacao, nao edicao); trocar a sugestao deterministica por IA; fazer o app esfriar lead sozinho (isso e da regua); migrar dado de cliente antes de existir destino multi-tenant e demanda provada. O Pit Wall e sensor; a regua e o motor de cadencia; a planilha e a base.

## Referencias de sistema
- CRM Sheets: `1lJj4wHjniXhjW_dmFSJ2eKdohN8MCJ4MGvglXyyIrrY`, aba `Pitstop Imports — CRM de Clientes`.
- Uso/conteudo Sheets: `1fWhQ78vq1ScvYehvW6jvauS5WNY5kXtuPVhf09Ue7ek`.
- Proprietario / alerta: `vinialbuquerque.pitstop@gmail.com`.
- Dois projetos Apps Script: Pit Wall (sensor, HtmlService) e CRM Calendar Automation (regua, varredura 05h). Escopos separados.
- Status CRM (5 fixos): 🟡 Pendente, ✅ Feito, 🟢 Convertido, ❄️ Lista fria, 🚫 Cancelado.
- Consentimento: so `Sim` ou `Nao` sem til, identico na planilha e no codigo.
- Historico: `dd/MM/yyyy HH:mm · evento`, prepend newest-first.
- Nivel (Rota A): 0-2 quente, 3-6 morno, 7+ frio. Rotulos em `NIVEL_ROTULO`.
