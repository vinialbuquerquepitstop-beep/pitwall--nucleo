# Handoff Pit Wall / Pitstop Imports (v15)

## Como usar este documento
Continuacao da operacao do Pit Wall. Este handoff SUBSTITUI o v14 e todos os anteriores. Le primeiro "Estado em uma frase", "Decisoes travadas nesta sessao", "O que ainda falta para liberar o codigo" e "Sequencia de execucao".

Convencao de escrita: prosa sem acento e sem cedilha, nunca travessao. EXCECAO: dado real do sistema carrega seus proprios caracteres (nome da aba com em-dash U+2014, status com emoji, sentinelas "💬 Conversando" e "⏰ Negociação parada", cabecalhos "Etapa cadencia", "Historico", "Data do ultimo toque", "Respondido", rotulos com ponto do meio U+00B7).

## Estado em uma frase
Esta sessao foi de DECISAO, nao de codigo. Definiu-se que o cadastro de lead passa a ser feito dentro do Pit Wall (app como unica porta de cadastro, planilha como matriz de edicao), com dedup leve, campos travados e nivel derivado (Rota A). NADA foi aplicado ainda: nenhum codigo alterado, nenhuma coluna criada, o trigger de backfill NAO foi instalado. O proximo chat comeca do zero de execucao, com as decisoes ja cravadas.

## Ponto de partida do proximo chat (importante)
- Nenhuma alteracao foi feita nesta sessao.
- O trigger de `backfillLeadIds` NAO foi instalado.
- As colunas novas NAO foram criadas.
- O estado de codigo real e o do fim do v14 (card refeito, Toque enviado dedicado, termometro, registrarDesfecho) que o proprio dono ainda precisa confirmar se chegou a implantar. Este handoff nao pressupoe que o v14 foi ao ar; confirmar no inicio.

---

## Decisoes travadas nesta sessao

### 1. Cadastro pelo Pit Wall
- **O app vira a UNICA porta de cadastro de lead.** A planilha continua sendo a matriz de edicao (corrigir dado existente e no Sheets).
- "Unica porta" e regra de disciplina, nao tranca fisica. Nada impede digitar uma linha no Sheets; por isso existe a rede de seguranca (trigger).
- O append e a unica escrita imune ao risco de "linha errada" do `_crmLocalizaLinha`, ja aprovado como excecao. Manter estreito. Isso NAO transforma o app em mesa de edicao ampla: e criacao, nao edicao.

### 2. Lead ID: nascimento no app + trigger como rede
- **Primario:** o Lead ID nasce dentro do `cadastrarLead`, no momento do append (via `_crmMaxLeadNum + 1`). Sem lag.
- **Rede de seguranca:** trigger diario de `backfillLeadIds` carimba qualquer lead que entre por fora do app (linha digitada direta no Sheets) ou por bug, em ate 24h.
- Os dois juntos garantem: nao existe lead sem ID, venha de onde vier. Fecha a pendencia critica #1 do v14.

### 3. Nivel: Rota A (derivado). TRAVADO.
- `nivel` (quente / morno / frio) passa a ser CALCULADO dentro do `getClientes` por faixa de dias de silencio. Nunca gravado na planilha.
- Vantagens: zero coluna nova para nivel, zero escrita da regua sobre nivel, zero risco de celula defasar, auto-atualiza a cada leitura da fila.
- **Consequencia:** a auditoria "a varredura atualiza nivel por perfil" SAI da fila. Nao ha celula de nivel para a varredura manter.
- Distincao conceitual travada (nao colapsar):
  - **frio (nivel):** esfriou, mas ainda vale perseguir. Ultima temperatura antes de desistir. E LEITURA.
  - **❄️ Lista fria (status):** encerrado. E DECISAO. Quem vira o lead para Lista fria e a Regra 2 da regua (ultimo passo da cadencia + silencio). frio e o degrau final antes disso.
- **Perfil x nivel (travado):** Perfil classifica o lead no primeiro contato e define QUAL cadencia a regua roda. Nivel e temperatura, muda sozinho com o tempo. Perfil e input do cadastro (obrigatorio); nivel NUNCA e input. Lead novo nasce quente por definicao.

### 4. Dedup leve. TRAVADO.
- Antes do append, o `cadastrarLead` varre a coluna WhatsApp normalizada. Se o telefone ja existe, o app avisa "Ja existe: [nome]" e oferece dois caminhos: abrir o lead existente OU criar mesmo assim.
- Impede duplicata acidental sem prender casos legitimos raros. Chave do dedup = telefone normalizado.

### 5. Interesse x Aparelho de entrada. TRAVADO.
- **Interesse de compra:** reaproveita as colunas Produto/Modelo (existentes). Nada novo.
- **Aparelho de entrada:** coluna NOVA e distinta. Sempre um aparelho diferente do interesse de compra. Campos separados sao obrigatorios para o casamento de interesses na Estrategia (o que um cliente da de entrada pode ser o interesse de outro). Opcional no cadastro; preenche quando souber.

### 6. Estado (Lacrado / Vitrine / Seminovo): coluna dedicada. TRAVADO.
- Coluna Estado propria, NAO reaproveitar Modelo. Modelo responde "qual iPhone"; Estado responde "em que condicao". Duas perguntas, duas colunas, para permitir filtrar e cruzar por condicao depois. Dropdown com os tres valores, aplicada ao interesse de compra.

### 7. Origem: lista fechada (dropdown). TRAVADO.
Sete valores:
1. Indicacao
2. Instagram
3. WhatsApp direto
4. Loja fisica
5. Prospeccao ativa
6. Parceria influencer
7. Parceria PAG local

### 8. Coluna Perfil. TRAVADO.
- O cadastro grava na coluna existente `Perfil`, que e a que a regua le para montar a cadencia. Obrigatorio, dropdown com os perfis da regua.

---

## Correcao sobre criacao de colunas
A regra "coluna nova sempre no fim" vale so para colunas que NAO existem. O mapa de colunas (`_crmMapaColunas`) le por NOME de cabecalho normalizado, nao por posicao.
- `Indicado por` e `Proposta enviada` JA EXISTEM (fora do fim). NAO recriar, NAO mover. Funcionam onde estao.
- Criar no fim apenas o que nao existe. Provavelmente: `Origem`, `Upgrade`, `Aparelho de entrada`, `Estado`.
- Antes de criar cada uma, conferir que o cabecalho ja nao existe com outro nome, para nao gerar dois cabecalhos que normalizam igual (quebra o mapa).
- Nenhuma coluna para nivel (Rota A deriva no codigo).

---

## Mapa de campos do cadastro (consolidado)

| Campo | Coluna | Obrigatorio | Tipo |
|---|---|---|---|
| Nome | Nome (existe) | Sim | texto |
| Telefone | WhatsApp (existe) | Sim, chave do dedup | numero normalizado |
| Origem | NOVA | Sim | dropdown (7 valores) |
| Perfil | Perfil (existe, lida pela regua) | Sim | dropdown (perfis da regua) |
| Interesse de compra | Produto/Modelo (existe) | Sim | texto |
| Estado do interesse | NOVA | Sim | dropdown (Lacrado / Vitrine / Seminovo) |
| Consentimento | U (existe) | Sim, default `Sim` | Sim / Nao |
| Observacao | Observacoes (existe) | Nao | texto |
| Proposta enviada | existe (fora do fim) | Nao | texto/numero |
| Upgrade (dara entrada?) | NOVA | Nao | Sim / Nao |
| Aparelho de entrada | NOVA | Nao | texto |
| Indicado por | existe (fora do fim) | Condicional (so quando Origem = Indicacao) | texto |
| Nivel | derivada no getClientes (Rota A) | Nao e input, nasce quente | quente / morno / frio |

Regra do campo condicional: `Indicado por` fica oculto por padrao no form e so aparece, ja obrigatorio, quando Origem = Indicacao.

---

## Faixas do nivel (PENDENTE de confirmacao do dono)
Rota A exige cravar os cortes. Proposta alinhada ao termometro do v14 (alerta aos 3 dias):

| Nivel | Dias sem resposta |
|---|---|
| quente | 0 a 2 |
| morno | 3 a 6 |
| frio | 7 ou mais |

O corte de frio NAO encerra o lead; quem encerra e a Regra 2 da regua (vira ❄️ Lista fria). Esta e a UNICA decisao que falta para liberar 100% do codigo do `getClientes` derivado e do `cadastrarLead`.

---

## Contrato provavel da funcao nova (para quando for codar)
`cadastrarLead(dados)` -> `{ ok, msg, leadId, linha, duplicado }`
- `dados = { nome, whatsappDigitos, origem, perfil, produto, modelo, estado, consentimento, observacao, propostaEnviada, upgrade, aparelhoEntrada, indicadoPor }`.
- Gera Lead ID via `_crmMaxLeadNum + 1`.
- Normaliza telefone (so digitos, 55, nono digito) antes do append; senao `waLink` quebra e a base suja.
- Checa dedup por telefone normalizado ANTES do append; se achar, retorna `duplicado` com nome e linha do existente, sem gravar (frontend decide abrir ou forcar).
- Carimba Consentimento + Data consentimento ao meio-dia (seguro contra fuso).
- Carimba Historico "Cadastrado (app)".
- Append com LockService (padrao das escritas estreitas).

`getClientes(forcar)` passa a DERIVAR nivel: para cada cliente, calcular dias de silencio a partir de `dataUltimoToque` (com `respondido` como B=SIM, mesma logica do termometro do v14) e mapear pela faixa. O campo `nivel` do contrato deixa de vir da celula e passa a vir do calculo. Conferir se algum consumidor do frontend dependia do valor antigo da celula.

---

## Verificacoes antes de codar (nao sao decisao, sao checagem)
1. **O que a coluna `nivel` guarda hoje?** Olhar na planilha. Se vazia ou com lixo, tranquilo: para de escrever e passa a derivar. Se guarda algo que a regua usa para outra coisa, alinhar antes de sobrescrever a semantica.
2. **A regua (outro projeto) escreve em `nivel`?** Se escrever, DESLIGAR essa escrita na regua, senao o app deriva um valor e a regua grava outro por cima. Isso e no chat da regua, com o `Código.gs` aberto. Nao da para verificar do lado do sensor.

---

## Trigger de backfillLeadIds: passo a passo (NAO instalado ainda)
Nao exige publicar nova versao (roda contra o codigo Head do editor).
1. Abrir o projeto Apps Script do Pit Wall (o vinculado a planilha, onde vive `crm_pitwall.gs`).
2. Barra lateral, icone de relogio, Acionadores (Triggers).
3. Canto inferior direito, Adicionar acionador.
4. Funcao: `backfillLeadIds`. Implantacao: Head.
5. Origem do evento: Baseado no tempo. Tipo: Contador de dias.
6. Hora: entre 3h e 4h da manha (longe da varredura 05h da regua, evita disputa de lock na mesma planilha).
7. Salvar. Autorizar com `vinialbuquerque.pitstop@gmail.com`.
8. Depois, rodar `backfillLeadIds` uma vez na mao (Executar) para carimbar os pendentes atuais. Funcao idempotente e com lock: rodar todo dia e seguro.

Alternativa por codigo (`instalarBackfillDiario` com `ScriptApp.newTrigger`) existe, mas nao vale agora: exige editar o .gs para ganhar o que a interface faz em 30 segundos.

---

## Sequencia de execucao (ordem)
1. **Agora, independente de codigo:** instalar o trigger diario de `backfillLeadIds` e rodar a funcao uma vez na mao.
2. **Planilha:** criar so as colunas novas no fim (Origem, Upgrade, Aparelho de entrada, Estado, mais o que a checagem indicar), com dropdowns (Origem 7 valores, Estado 3 valores). Nao recriar Indicado por nem Proposta enviada. Grafia exata dos cabecalhos.
3. **Olhar rapido:** o que a coluna `nivel` guarda hoje.
4. **Chat da regua:** confirmar se a varredura escreve em `nivel`; se escrever, desligar.
5. **Dono crava:** as faixas de nivel (0-2 / 3-6 / 7+ ou os numeros dele).
6. **Codar (sensor):** `getClientes` derivando nivel + `cadastrarLead` novo. Validar com acorn (script, ecmaVersion 2022, arquivo completo) + harness de planilha em memoria antes de entregar.
7. **Frontend:** form de cadastro (dropdowns, Indicado por condicional em Origem = Indicacao, tela de dedup leve). Bloco fechado no `window.PitWallCRM`, CSS `.pwcrm`.
8. **Deploy:** nova versao (muda contrato lido pelo app e muda frontend, entao EXIGE nova versao).

---

## Pendencias abertas (fila do proximo trabalho)
1. **[decisao unica que falta] Faixas do nivel** (Rota A). Bloqueia o codigo do getClientes derivado e do cadastrarLead.
2. **Pos-venda dentro do Pit Wall** (NOVA, registrada nesta sessao). Registro de relacionamento por Lead ID (LTV, ciclo de upgrade, depoimento, indicacao gerada). Compartilha campos com o cadastro: Aparelho de entrada (ciclo de upgrade) e Indicado por (processo de indicacao). Desenhar junto do cadastro faz sentido, mesmos campos novos. Gancho `sincronizarPosVenda` ja previsto.
3. **Aba Estrategia: captacao ativa com metas diarias.** Depende de Origem no cadastro (cada abordagem ativa vira lead com origem marcada). Cravar metrica-alvo e fonte da verdade da meta antes de comecar.
4. **Regua dirigida por toque** (chat da regua): Regra 1 (avanco verificado por toque) e Regra 2 (esfriamento so em quem foi tocado e ignorado), do v14.
5. **Politica de consentimento na fila:** fail-closed (so Sim libera) vs bloquear so no Nao explicito. Decisao do dono, pendente do v14.
6. **Sugestao deterministica de mensagem por etapa:** destravada, nao iniciada.
7. **Fase 3 pipeline / Fase 4 atividades:** Historico ja acumula toque, conversa, reagendamento, fechamento, sem-interesse; Fase 4 tem materia-prima.
8. **SaaS:** comecar pela Fase A (validar demanda com 3 a 5 lojistas, sinal de pagamento). Interesse nao e pagamento.

### Pendencia que MORREU nesta sessao
- Auditar se a varredura atualiza nivel por perfil: eliminada pela escolha da Rota A (nao ha celula de nivel para a varredura manter). So voltaria a existir se um dia migrar para Rota B (armazenado), o que exigiria filtrar temperatura no proprio Sheets ou a Estrategia ler nivel direto da planilha.

---

## Regras criticas (mantidas)
- Validar como script (acorn, sourceType "script", ecmaVersion 2022) no ARQUIVO COMPLETO, nao node --check, nao fragmento. Harness de planilha em memoria para .gs, jsdom para frontend.
- Substituir funcao ou modulo = apagar o antigo inteiro e colar unidade fechada. Const/var duplicada = erro fatal; funcao duplicada = ultima vence em silencio.
- Mesmo projeto = escopo global compartilhado entre os .gs. Sensor e regua sao projetos diferentes, nao compartilham escopo; por isso `_crmCarimbarHistorico` e autossuficiente no sensor.
- Saving nao e deploying. Mudanca de contrato lido pelo app e mudanca de frontend EXIGEM nova versao. Funcao de servidor pura (ex.: backfillLeadIds) roda no editor sem publicar.
- getSheetByName retorna null em silencio. Nome da aba exato, com em-dash U+2014.
- Mapa de colunas le por NOME de cabecalho, nao por posicao. Coluna nova so no fim; coluna existente fica onde esta.
- onEdit/onChange NAO disparam em escrita por script. Cadencia automatica = varredura 05h na regua; backfill = trigger de tempo proprio.
- Gravar data-only em celula: meio-dia (12:00), nunca meia-noite, por causa do fuso. appsscript.json em America/Sao_Paulo (confirmado).
- Telefone sempre normalizado no append (so digitos, 55, nono digito), senao waLink quebra.
- Sensor so registra o que aconteceu; a regua le e decide; a planilha e a fonte da verdade.
- WhatsApp da fila = so abre (nao registra). Toque enviado = registra. Dois eventos distintos, nunca colapsar.

---

## Nao reabrir, a menos que o dono peca
Colapsar "toque enviado" e "respondido" num evento so; colapsar frio (nivel) com ❄️ Lista fria (status); fazer o WhatsApp registrar toque de novo; tratar consentimento como input central do dia a dia; transformar o app em mesa de edicao ampla (cadastro por append e criacao, nao edicao); trocar a sugestao deterministica por IA; fazer o app esfriar lead sozinho (isso e da regua); migrar dado de cliente antes de existir destino multi-tenant e demanda provada. O Pit Wall e sensor; a regua e o motor de cadencia; a planilha e a base.

---

## Referencias de sistema
- CRM Sheets: `1lJj4wHjniXhjW_dmFSJ2eKdohN8MCJ4MGvglXyyIrrY`, aba `Pitstop Imports — CRM de Clientes`.
- Uso/conteudo Sheets: `1fWhQ78vq1ScvYehvW6jvauS5WNY5kXtuPVhf09Ue7ek`.
- Proprietario / alerta: `vinialbuquerque.pitstop@gmail.com`.
- Dois projetos Apps Script: Pit Wall (sensor, HtmlService) e CRM Calendar Automation (regua, varredura 05h). Escopos separados.
- Status CRM (5 fixos): 🟡 Pendente, ✅ Feito, 🟢 Convertido, ❄️ Lista fria, 🚫 Cancelado.
- Consentimento: so `Sim` ou `Nao` sem til, identico na planilha e no codigo.
- Historico: `dd/MM/yyyy HH:mm · evento`, prepend newest-first.
