# Handoff de Migracao Pit Wall 2.0 (Nucleo), v10

## Como usar este documento
Continuacao da TRILHA DE MIGRACAO. Este handoff SUBSTITUI o v9. Corre em paralelo ao v16 operacional (Apps Script, ainda no ar). Para o que NAO mudou (schema, ETL, invariantes, stack alvo, fases), o v1 a v9 seguem validos; este v10 registra so o delta desta sessao. Le primeiro "Estado em uma frase", "O que mudou nesta sessao", "Decisao registrada: reconstrucao da interface" e "Primeiro movimento do proximo chat".

Delta do v10 em uma linha: a Fase 2 (escrita) foi FECHADA de ponta a ponta, backend (5 RPCs) aplicado e provado no banco real, frontend com a camada de escrita validado (52 asserts) e entregue, higiene de Auth resolvida, e o painel azul no ar.

Convencao de escrita: prosa sem acento, sem cedilha, nunca travessao (usar virgula, parenteses ou ponto conforme a gramatica). EXCECAO: valor real do sistema carrega seus proprios caracteres (aba com em-dash U+2014, status com emoji, perfis, tokens tenant_id, pg_cron, RLS, security_invoker).

---

## Estado em uma frase
Fase 2 FECHADA: as cinco operacoes de escrita existem como funcoes RPC no banco (RLS por dentro, evento em lead_evento, auditoria por trigger), provadas em dado real e limpas; o frontend azul ganhou a camada de escrita (Toque enviado, leque de quatro desfechos, retomar com data, form de cadastro com dedup), validado e entregue nas duas pecas. O proximo bloco grande e a Fase 3 (regua nativa em pg_cron).

## Mapa das fases (voce esta saindo da 2 para a 3)
- Fase 0. Schema. FEITA e provada.
- Fase 1. Frontend com login + leitura + ETL das 15 linhas. FECHADA (v8).
- Fase 2. Escrita no banco (cadastro, toque, desfecho) com auditoria. **FECHADA nesta sessao.**
- **Fase 3. Regua nativa em pg_cron (Google Agenda fora do escopo). <- proximo bloco grande.**
- Fase 4. Aposenta a planilha, backup diario, reaponta Notion.
- Fase 5. Dashboards, visual, calculadora, e a reconstrucao da interface. So depois do nucleo.
- Fase SaaS. So quando um lojista pagar.

---

## O que mudou nesta sessao

### 1. Higiene de Auth fechada (pre-requisito da escrita)
- Site URL do Auth trocada de localhost para a URL do Worker de producao. Email de recuperacao de senha agora redireciona corretamente para o Pit Wall (confirmado pelo dono).
- Senha do dono rotacionada pelo painel (input mascarado, nunca por SQL).
- Isso encerra a pendencia de higiene que vinha aberta desde o v4/v5.

### 2. Painel azul no ar
- A versao azul da marca (accent `#0025cc`) foi ao ar no Worker `flat-resonance-09ba`, pelo caminho de deploy manual. O laranja provisorio (`#f2a71b`) foi aposentado como cor de marca, mas o mesmo `#f2a71b` PERMANECE com papel semantico proprio no termometro (temperatura de pneu, morno). As duas cores nao se confundem mais.

### 3. Backend da Fase 2 aplicado (migration `fase2_funcoes_escrita`)
Cinco funcoes de escrita, todas no mesmo padrao do `registrar_toque` que ja existia: `security invoker` (a RLS vale por dentro, o usuario so escreve no que a policy permite), escrita estreita via UPDATE/INSERT alvo, evento carimbado em `lead_evento`, retorno `json` com `ok`. A auditoria vem de graca: os triggers `fn_auditar` em `lead`, `lead_evento` e `cadencia_estado` ja cobriam INSERT/UPDATE/DELETE antes desta sessao.

Decisao de arquitetura travada: a escrita NAO vai direto do frontend pra tabela. Cada operacao e uma RPC. Motivo: geracao atomica do `lead_code` (advisory lock, sem corrida), dedup por telefone no servidor, e funil estreito (o front so faz o que a funcao permite, nao um UPDATE livre na linha). A policy `p_lead_update` e mais larga que a operacao precisa; a RPC e o funil que a estreita.

### 4. Prova no banco real (feita e limpa)
Rodado como usuario autenticado (JWT do dono, role authenticated):
- `cadastrar_lead` gerou LEAD-0016 (max+1 correto), telefone normalizado, condicao em `condicao`, status `pendente`, tipo_msg `primeiro contato`, consentimento `true` com carimbo, datas ao meio-dia.
- Dedup barrou o telefone repetido, retornando o lead existente (nome, lead_code, id), sem gravar.
- `registrar_toque`, `registrar_conversando`, `reagendar_proximo_contato`, `registrar_desfecho` (sem_interesse) rodaram em sequencia no lead de teste.
- Rastro conferido: 5 eventos em ordem no `lead_evento` (cadastro, toque_enviado, conversando, reagendado, sem_interesse), 5 registros na `auditoria`, nivel derivando certo na `v_lead`.
- Limpeza: lead de teste e eventos apagados. Base voltou a 15 leads, maior code LEAD-0015. O proximo cadastro real recomeca do LEAD-0016.

### 5. DESCOBERTA que mata a decisao antiga do "forcar"
O schema tem `UNIQUE (tenant_id, whatsapp_digitos)`. Telefone duplicado e fisicamente impossivel no banco. Consequencia: o fluxo "Cadastrar mesmo assim" (o `forcar` herdado do mundo Sheets, previsto no v16 operacional) DEIXA DE EXISTIR. O dedup tem um caminho so agora: avisa e oferece "Abrir lead existente". Leitura registrada: e melhor assim, dois leads com o mesmo numero e ruido, nao caso legitimo. Reverter (derrubar a constraint) e uma migration de uma linha, nao recomendada.

### 6. Frontend da Fase 2 construido, validado e entregue
Sobre o `index.html` azul de leitura (556 linhas, v8), foi adicionada a camada de escrita. Entregue em DUAS pecas (o par padrao de agora):
- **`index_brand_v2.html`** (legivel): a fonte. Indentada, comentada, e a base da proxima edicao. Vai no repo GitHub como `public/index.html` (backup versionado).
- **`index_deploy_v2.min.html`** (minificada): a que sobe no Worker (renomear pra `index.html`). So performance; minificar e atrito, nao blindagem (invariante preservada).

Mudancas no app:
- Card da fila: WhatsApp continua so-abre (nao registra toque, invariante intacta). Entrou o botao **Toque enviado** (navy, o unico que registra, chama `registrar_toque`). O **Respondeu** virou gatilho que abre um leque de quatro desfechos: Conversando (`registrar_conversando`), Retomar (revela campo de data, default amanha, depois `reagendar_proximo_contato`), Fechou (`registrar_desfecho` convertido), Sem interesse (`registrar_desfecho` sem_interesse).
- Aba Todos: segue consulta pura, ZERO botao de escrita. Operacao e so na fila.
- Topo: botao **Novo lead** abre o form de cadastro. Dropdowns de condicao, perfil e origem montados a partir do `dicionario_rotulos` do banco (em runtime). Indicado por oculto por padrao, aparece e vira obrigatorio so em Origem = Indicacao. Consentimento default Sim. Upgrade e aparelho de entrada opcionais.
- Dedup no cadastro: se o retorno vier `duplicado`, mostra aviso com o nome do lead existente e o botao "Abrir lead existente" (pula pra aba Todos com a busca preenchida). NAO existe "cadastrar mesmo assim" (ver descoberta 5).
- Toast de confirmacao em cada operacao; a fila recarrega sozinha apos escrita.
- Termometro segue lendo `dias_silencio` pronto da view (fonte unica, Rota A).
- Validacao real: acorn (sourceType script, es2022) nas duas pecas; invariantes provadas por teste (escrita so pelas 5 RPC, nenhum insert/update/delete/upsert direto no front, `service_role` ausente, `#0025cc` e `#f2a71b` preservados); jsdom com 52 asserts cobrindo cada botao chamando a RPC certa com o payload certo, o leque, o campo de data, o form, o condicional do Indicado por, o dedup e o Abrir existente.

---

## Contratos das RPCs (assinaturas exatas, o frontend depende dos nomes dos parametros)

- `registrar_toque(p_lead_id uuid)` -> `{ ok, msg, lead_id, ultimo_toque_em }`. Ja existia; confirmada.
- `registrar_conversando(p_lead_id uuid)` -> `{ ok, msg, lead_id, etapa_cadencia, ultimo_toque_em }`. Grava `etapa_cadencia = 'conversando'` e carimba `ultimo_toque_em` (freio temporario, Opcao A). NAO toca `respondido_em`.
- `reagendar_proximo_contato(p_lead_id uuid, p_data date)` -> `{ ok, msg, lead_id, proximo_contato }`. So move `proximo_contato`.
- `registrar_desfecho(p_lead_id uuid, p_tipo text)` -> `{ ok, msg, lead_id, status }`. `p_tipo` in `convertido` (status convertido, evento fechou) ou `sem_interesse` (status lista_fria, evento sem_interesse).
- `cadastrar_lead(p_nome, p_whatsapp, p_produto, p_condicao, p_perfil, p_origem, p_indicado_por default null, p_observacoes default null, p_upgrade_entrada default null, p_aparelho_entrada default null, p_consentimento default true)` -> `{ ok, msg, lead_id, lead_code }` no sucesso, ou `{ ok:false, duplicado:true, msg, existente:{ lead_id, lead_code, nome } }` no telefone repetido, ou `{ ok:false, msg }` em obrigatorio faltando / valor fora do dicionario. Normaliza telefone (so digitos, prepende 55 se tiver 10 ou 11 digitos), dedup por telefone, `lead_code` via advisory lock + max+1, defaults do v16, evento cadastro, consentimento com carimbo.

Todas as escritas do front passam por um unico wrapper (`chamarRPC` / `acaoEscrita`) que trata erro e dispara o toast. Nenhuma chamada `sb.from(...).insert/update/delete` existe no frontend.

---

## Decisao registrada: reconstrucao da interface (analise desta sessao)
O dono quer refazer toda a interface. O atual serve como rascunho mas esta distante do formato pretendido. Pergunta: quando reconstruir, pode comecar agora.

Analise (conselho, decisao do dono):
- Separar superficie FUNCIONAL (quais telas, onde cada acao mora) de superficie VISUAL (layout, tipografia, componentes, marca). A funcional esta ~fechada depois da Fase 2; o que falta (historico na Fase 4, metricas na Fase 5) e aditivo, nao reestruturacao. O desejo do dono e a visual.
- A visual e a camada mais barata de trocar e a mais volatil. Por isso ela e Fase 5 no plano ("so depois do nucleo"). Nao e arbitrario, e sequenciamento por retrabalho.
- Risco de reconstruir AGORA: o timebox de 2 semanas (inicio 04/07) existe pra colocar a operacao diaria na stack nova. Gastar a janela num redesign visual, em vez da Fase 3 (regua), dispara o criterio de abortar (fim da janela sem operacao migrada). Redesign e a "arrumacao" classica que come a janela.
- Agravante de ordem: redesenhar agora e projetar sem a regua, o historico e as metricas na frente; quando chegarem, vira retrofit (retrabalho). Redesenhar no fim do nucleo projeta uma vez so, com todas as pecas visiveis.
- Trava do SaaS: o NIVEL de acabamento visual depende de quem ve a tela (operador unico = "bom e rapido"; multi-lojista = precisa ser bom). Isso so importa depois da Fase A (validar demanda), que nao aconteceu. UI grau-SaaS antes de pagante e a armadilha de sempre.
- O que e BARATO e pode entrar agora: travar a DIRECAO de design como especificacao, sem construir (referencia visual, tokens de cor/tipografia/espacamento, layout-alvo das telas que ja existem). Nao toca codigo, nao compete com a regua, transforma o redesign de exploracao em execucao.

**DECISAO:** nao iniciar o rebuild visual agora. Gatilho para a reconstrucao cara = operacao 100% cortada pra stack nova e estavel (regua rodando, uso diario fora do Apps Script). O nivel de acabamento se define pelo que a Fase A disser sobre SaaS. Opcional agora, se o dono quiser adiantar: rascunho de direcao de design (spec, sem codigo).

Observacao tecnica que reduz o medo do retrabalho: a logica de escrita (botoes ligados as RPCs, dedup, validacao) SOBREVIVE a um redesign; so a apresentacao muda. O redesign troca a pele, nao o musculo. Entao construir features sobre o rascunho atual nao e trabalho jogado fora.

---

## Primeiro movimento do proximo chat
1. Confirmar com o dono que o `index_deploy_v2.min.html` subiu no Worker e que a camada de escrita funciona no telefone (Toque enviado tira o card da fila; Novo lead cadastra; dedup avisa). Se algo falhar, e deploy ou cache, nao codigo (52 asserts passaram).
2. **Ir para a Fase 3, a regua nativa em pg_cron.** E o proximo bloco grande do nucleo. Desenho ja acordado nos handoffs:
   - Vira funcao agendada por pg_cron, no mesmo backend, lendo e gravando a mesma base. Sem Google Agenda, sem sentinelas cross-project, sem `_crmCarimbarHistorico` duplicado (tudo isso existia por causa do split de dois projetos do Apps Script, que deixou de existir).
   - **Regra 1 (avanco verificado por toque):** a cadencia so avanca quando ha toque confirmado para o passo atual (`ultimo_toque_em >= data em que o passo venceu`). Sem toque, nao avanca; o lead fica na fila esperando acao. Protege contra esfriar um lead que o operador esqueceu de tocar.
   - **Regra 2 (esfriamento so em quem foi tocado e ignorado):** vira `lista_fria` quando a cadencia chega ao ultimo passo + toque confirmado + `respondido_em` vazio + silencio acima do limite. Carimba evento `esfriado_por_silencio`.
   - Estado da regua vive na tabela `cadencia_estado` (ja no schema: `lead_id`, `perfil`, `passo_atual`, `passo_rotulo`, `passo_vence_em`, `encerrada`).
   - Inicializacao do lead do app: a varredura precisa montar a cadencia de todo lead com `perfil` preenchido e sem estado de cadencia ainda (equivalente ao "Event IDs vazio" do mundo antigo). Latencia ate a proxima varredura, aceitavel; o lead ja e util na fila desde o cadastro (status pendente, proximo_contato hoje).
   - Antes de codar a Fase 3: confirmar a cadencia por perfil (quantos passos, intervalos por perfil) e o limite de silencio da Regra 2. Esses numeros vem do dono / do codigo da regua antiga (v16 operacional).

---

## Pendencias abertas (fila do proximo trabalho)
1. **[proximo bloco grande] Fase 3, regua nativa em pg_cron.** Regra 1 e Regra 2 acima. Depende de cravar cadencia por perfil e limite de silencio.
2. **Confirmar deploy do frontend v2 no Worker** e o funcionamento da escrita no telefone.
3. **Telefones de Yasmim (LEAD-0007) e Erickao (LEAD-0008).** Sem numero, sem botao de WhatsApp. 1 update por lead quando o dono tiver.
4. **Miguel (LEAD-0013):** confirmar ativo ou frio. 1 update se mudar.
5. **Erickao (LEAD-0008): data de proximo contato real** (hoje 20/07 e arbitraria).
6. **Registrar dominio proprio** (some o `flat-resonance-09ba`).
7. **Notificacao / digest diario:** item de Fase 2/3. Barato quando a regua existir: um pg_cron manda 1x/dia um resumo (fila hoje, esfriando, vencidos). Canal em aberto (email, WhatsApp pra si, push do browser).
8. **Reconstrucao da interface (Fase 5).** Gatilho: operacao cortada e estavel na stack nova. Opcional agora: rascunho de direcao de design (spec, sem codigo). Ver secao "Decisao registrada".
9. **Calculadora Pitstop (Fase 5):** spec em aberto (onde vive hoje, o que calcula, se salva no lead).
10. **Lista de metricas do dashboard (Fase 5):** cravar o que mede antes de construir painel.
11. **SaaS:** comecar pela Fase A (validar demanda com 3 a 5 lojistas, sinal de pagamento). Interesse nao e pagamento.

---

## Invariantes e travas (seguem validas)
- Toda escrita da Fase 2 gera registro de auditoria (trigger `fn_auditar`, provado).
- Escrita so por RPC; o frontend nunca escreve direto em tabela (provado por teste: nenhum insert/update/delete/upsert no front).
- Nivel derivado na leitura, nunca armazenado (na `v_lead`, Rota A: 0-2 quente, 3-6 morno, 7+ frio).
- `security_invoker = on` em toda view sobre tabela com RLS.
- Nao colapsar "toque enviado" e "respondido". WhatsApp so abre (nao registra); o botao Toque enviado registra. Dois eventos distintos.
- Nao colapsar frio (nivel, leitura) com ❄️ Lista fria (status, decisao). frio e a ultima temperatura antes de desistir; Lista fria e a Regra 2 da regua encerrando.
- Produto = aparelho; condicao = condicao. Nao inverter no ETL nem no cadastro.
- `service_role` NUNCA no frontend; anon key e publica, protegida por RLS.
- Telefone normalizado no cadastro (so digitos, prepende 55 em 10 ou 11 digitos), senao `waHref` quebra. `UNIQUE (tenant_id, whatsapp_digitos)` torna duplicata impossivel; nao existe "cadastrar mesmo assim".
- Config de Auth e troca de senha: so pelo painel do Supabase (input mascarado), nunca por SQL.
- O `--morno` ambar (`#f2a71b`) tem papel semantico proprio no termometro; NAO unificar com o azul da marca (`#0025cc`).
- Frontend estatico nao se esconde de verdade; minificar e atrito, nao blindagem. Protecao real e RLS + logica sensivel no servidor (RPC).
- Sensor registra o que aconteceu; a regua le e decide; a base agora vive no Postgres.
- Entrega em unidade fechada, validada (acorn + jsdom no front, DDL + teste em dado real no banco), nunca fragmento.

---

## Timebox
Janela de 2 semanas iniciada em 04/07/2026. Fase 1 fechou na primeira semana; Fase 2 fechou nesta sessao, dentro da janela. Resta a Fase 3 (regua) pra operacao diaria cortar de vez pra stack nova. Criterio de parada recomendado (nao formalizado): se ao fim das 2 semanas a operacao diaria nao estiver na stack nova, congelar a migracao, voltar ao Apps Script e reavaliar. A reconstrucao de interface NAO entra nesta janela (ver decisao registrada).

---

## Referencias de sistema
- **Projeto Supabase (Nucleo):** `unjzpyexgtbcmjfgcqrx`, org vinialbuquerquepitstop-beep, plano FREE, PRODUCTION, branch main. Conector MCP ativo.
- **URL da API Supabase:** `https://unjzpyexgtbcmjfgcqrx.supabase.co`.
- **Worker / URL do app:** `https://flat-resonance-09ba.pitstopimports.workers.dev`. Painel azul no ar.
- **Repo GitHub:** privado, `vinialbuquerquepitstop-beep/pitwall--nucleo`, branch `main`. `public/index.html`, `wrangler.jsonc`, `README.md`.
- **Chave anon (publica, protegida por RLS):** embutida no index.html. `service_role` NUNCA no front.
- **Tenant 1 (Pitstop Imports):** `00000000-0000-0000-0000-000000000001`.
- **Usuario dono:** auth.users id `fb2aad8e-b728-4e59-a198-71da2156449d`, papel dono, email `vinialbuquerque.pitstop@gmail.com`.
- **CRM Sheets (espelho a aposentar):** `1lJj4wHjniXhjW_dmFSJ2eKdohN8MCJ4MGvglXyyIrrY`, aba `Pitstop Imports — CRM de Clientes`.
- **Uso/conteudo Sheets:** `1fWhQ78vq1ScvYehvW6jvauS5WNY5kXtuPVhf09Ue7ek`.
- **Notion calendario:** DB `ab0fc93f-d964-4f32-8c81-4be5343687b3`.
- **Cor da marca (azul):** `#0025cc`. Termometro morno (semantico): `#f2a71b`.
- **Status CRM (5 fixos):** 🟡 Pendente, ✅ Feito, 🟢 Convertido, ❄️ Lista fria, 🚫 Cancelado.
- **Nivel (Rota A):** 0-2 quente, 3-6 morno, 7+ frio. Rotulos: 🔥 Quente, 🌡️ Morno, ❄️ Frio.
- **Escala atual:** 15 leads, 0-2 toques/dia, ~20 leads/mes.
- **Migrations aplicadas ate aqui:** `fase0_schema_nucleo.sql` + `v_lead_security_invoker_on` + `dicionario_add_consulta_whatsapp_status` + `lead_checks_add_consulta_whatsapp_status` + `lead_whatsapp_digitos_nullable` + `etl_leads_iniciais_pitstop_v2` + **`fase2_funcoes_escrita` (esta sessao)**.
- **Artefatos do frontend (Fase 2):** `index_brand_v2.html` (legivel, fonte) e `index_deploy_v2.min.html` (minificada, deploy).

---

## Nao reabrir, a menos que o dono peca
Construir superficie de SaaS antes do primeiro pagante; migrar mais dado sem necessidade; transformar o deploy num CI elaborado sem retorno pra um unico arquivo estatico; colapsar "toque enviado" e "respondido"; colapsar frio (nivel) com ❄️ Lista fria (status); fazer o WhatsApp registrar toque; unificar o ambar do termometro com o azul da marca; reintroduzir "cadastrar mesmo assim" (a constraint UNIQUE fecha isso); iniciar a reconstrucao visual antes da operacao cortar pra stack nova. O Pit Wall e sensor; a regua e o motor de cadencia; a base vive no Postgres.
