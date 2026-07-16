# Handoff de Migracao Pit Wall 2.0 (Nucleo), v15

## Como usar este documento
Continuacao da TRILHA DE MIGRACAO. Este handoff SUBSTITUI o v14. Para o que NAO mudou (schema base, ETL, invariantes, contratos das RPCs de escrita, stack alvo, orientacoes de conteudo e de banco de scripts), os handoffs v1 a v14 seguem validos; este v15 registra so o delta desta sessao. Le primeiro "Estado em uma frase", "O que mudou nesta sessao" e "Primeiro movimento do proximo chat".

Delta do v15 em uma linha: a feature de editar e arquivar lead foi construida e provada (RPCs no banco + frontend), a coluna data_nascimento nasceu, a aba Indicacoes e o telefone visivel entraram, e um bug de arranque do frontend (um listener que falhava derrubava os demais) foi eliminado por design.

Convencao de escrita: prosa sem acento, sem cedilha, nunca travessao (virgula, parenteses ou ponto conforme a gramatica). EXCECAO: valor real do sistema carrega seus proprios caracteres (aba com em-dash U+2014, status com emoji, nomes de funcao, campos do Notion como Data/Tipo/Status, tokens, pg_cron, RLS, security_invoker).

---

## Estado em uma frase
O nucleo e a operacao real, agora com poder de corrigir a propria base: da pra editar qualquer lead e arquivar (nunca apagar) lead com historico. O CRM roda no app, backup provado por drill, porta do anon fechada (B1). O proximo bloco grande continua sendo a Fase 3 (regua nativa em pg_cron); antes dela, falta so o dono publicar esta versao e preencher os dados que a edicao agora destrava.

## Mapa das fases
- Fase 0. Schema. FEITA e provada.
- Fase 1. Frontend login + leitura + ETL das 15 linhas. FECHADA.
- Fase 2. Escrita no banco com auditoria. FECHADA.
- Corte operacional (cutover do CRM). FEITO (v14).
- **Feature de editar/arquivar lead. FEITA nesta sessao (v15), no codigo. Falta publicar e preencher dados.**
- **Fase 3. Regua nativa em pg_cron. <- proximo bloco grande.**
- Fase 3.5. Sugestao de mensagem com banco de scripts. Depende da regua. Ver v14.
- Fase 4. Aposenta a planilha formalmente, reaponta o Notion/conteudo pro nucleo.
- Fase 5. Dashboards, visual, calculadora, reconstrucao da interface, aba de aniversariantes.
- Fase SaaS. So quando um lojista pagar.

---

## O que mudou nesta sessao

### 1. Lead teste (LEAD-0016) removido; B1 provado por olho
O lead teste que o dono cadastrou no fim da sessao anterior foi apagado direto no banco (hard delete, junto com seu 1 evento). Ele nao tinha historico real. Isso fechou o item 1 do "primeiro movimento" do v14: o cadastro do teste passou pelo caminho authenticated depois do B1, entao o B1 nao quebrou a operacao. Confirmado. Banco de volta ao canonico: 15 leads, LEAD-0001 e LEAD-0015 presentes.

### 2. Migration `editar_arquivar_lead_e_data_nascimento` (aplicada e provada)
Bloco unico, entregue fechado. Conteudo:
- Colunas novas em `lead`: `data_nascimento` (date, nullable) e `arquivado_em` (timestamptz, nullable).
- `lead_evento.tipo` passou a aceitar `lead_editado` e `arquivado` (constraint recriada com os dois valores a mais).
- `v_lead` recriada com as duas colunas novas no fim, `security_invoker = on` reafirmado e verificado.
- RPC **`editar_lead`** (14 parametros: p_lead_id, p_nome, p_whatsapp, p_produto, p_condicao, p_perfil, p_origem, p_indicado_por, p_observacoes, p_aparelho_entrada, p_upgrade_entrada, p_valor_oferta, p_proximo_contato, p_data_nascimento). Contrato: o formulario carrega os valores atuais e devolve o conjunto completo. Recusa nome vazio; normaliza WhatsApp pra digitos; devolve erro legivel em telefone duplicado (unique_violation) e em valor invalido de select (check_violation). NAO edita lead arquivado. Gera evento `lead_editado`.
- RPC **`arquivar_lead`** (p_lead_id, p_motivo default null). Marca `arquivado_em`, preserva status e todo o historico. Gera evento `arquivado`. Reversivel so por administrador (anular a coluna via SQL).
- Trava B1 desde o nascimento nas duas: revoke de PUBLIC e anon, grant pra authenticated e service_role. Provado por `has_function_privilege` (anon = false, authenticated = true nas duas).
- Prova funcional (auth simulada como authenticated): cadastro de descartavel, edicao de todos os campos incluindo data de nascimento, arquivamento, recusa de edicao pos-arquivamento. Rastro: 3 eventos + 3 registros de auditoria por lead. Descartavel apagado ao fim. Banco de volta a 15 leads, 0 arquivados.

### 3. Decisao de desenho: arquivar, nunca apagar (para lead com historico)
Cravada com o dono. Exclusao real (hard delete) so faz sentido para lead sem evento nenhum (caso do lead teste). Qualquer lead com toque, desfecho ou qualquer evento so ARQUIVA: some da operacao, permanece no banco. Isso protege a auditoria append-only e as metricas futuras. O app so oferece Arquivar; nao existe botao de apagar no frontend.

### 4. Frontend: edicao, arquivamento, telefone visivel, aba Indicacoes
Dois artefatos novos (padrao de dois artefatos mantido):
- `index_brand.html`: fonte legivel. O que o dono guarda e manda nas proximas sessoes.
- `index_deploy.min.html`: minificado. O que vai pro ar no Worker.

Mudancas de tela:
- Botao **Editar** em cada card (fila, todos, indicacoes). Abre painel de edicao pre-carregado com os dados do lead.
- Painel de edicao com todos os campos editaveis, incluindo **data de nascimento**, proximo contato e valor da oferta. WhatsApp e opcional na edicao (destrava lead legado sem telefone pra ganhar um).
- Botao **Arquivar lead** com confirmacao (window.confirm).
- **Telefone formatado visivel** no card (funcao pura fmtTel: 11 digitos vira (DD) 9XXXX-XXXX, trata prefixo 55).
- **Aba Indicacoes** no topo: filtro de `origem = indicacao`, cada card mostra chip "Ind. por <nome>". Dado ja existia (origem, indicado_por), sem migration.
- Leads arquivados somem da fila, do pitboard (contagens de base e ativos) e da busca. Filtro `arquivado_em is null` aplicado na fonte, antes de montarFila/filtrarBusca/filtrarIndicacoes.
- Leitura via `select('*')` na v_lead ja traz data_nascimento e arquivado_em automaticamente.

### 5. Bug de arranque do frontend eliminado por design
Sintoma relatado pelo dono no celular: painel de edicao abre, mas Salvar, Cancelar e Arquivar nao respondem. Diagnostico (provado em jsdom): o botao Editar funciona por delegacao (listener unico no container `lista`, registrado cedo no init); os botoes do painel dependiam de `addEventListener` individuais registrados depois. Se qualquer passo intermediario do init lancava erro no ambiente do dono (cache, deploy parcial, elemento faltante), o init abortava ali: Editar sobrevivia, o resto morria.
Correcao (nao foi remendo de um botao, foi a classe inteira): helper `on(id, evt, fn)` que registra cada listener isolado; elemento ausente vira console.warn e o arranque segue. Provado removendo um elemento do HTML de proposito: no codigo antigo Salvar quebrava, no novo Salvar continua funcionando. Adicionado tambem captador global (window 'error' e 'unhandledrejection') que joga o erro num toast vermelho, pra diagnostico no mobile (sem console a mao).
Validacao do frontend: Acorn (sintaxe, sourceType=script) + jsdom (34 checks de contrato de DOM e funcoes puras + fluxo de clique real: editar abre, cancelar fecha, salvar chama editar_lead, arquivar chama arquivar_lead). Tudo verde, no fonte e no minificado.

### 6. Aniversariantes NAO construido (de proposito)
Nenhum dos 15 leads tem data de nascimento ainda. A aba nasceria vazia. Caminho barato adotado: a coluna ja existe, o formulario de edicao ja coleta, e a aba entra quando houver massa de dado. Aba antes do dado e superficie morta. Fica como pendencia de Fase 5.

---

## Como publicar esta versao (o dono e mobile, sem terminal)
O que vai pro ar e o `index_deploy.min.html` (minificado). O `index_brand.html` e so a fonte legivel; nunca troque os dois.
Caminho provavel: editor web do dashboard Cloudflare pelo navegador do celular, abrindo o Worker `flat-resonance-09ba` e colando o conteudo novo, salvando pelo painel (o proprio painel faz o deploy). O caminho por GitHub com CI foi abandonado (limite de gatilhos no free); o repo e backup versionado.
Ponto que importa apos publicar: FORCAR recarregamento no celular (fechar a aba do app e reabrir, ou limpar cache do site). Se o problema anterior teve componente de cache, sem isso o dono continua vendo a versao velha.
Pendencia de processo em aberto: confirmar com o dono qual foi o caminho de publicacao das versoes anteriores, pra dar o passo a passo exato sem termo tecnico solto.

---

## Primeiro movimento do proximo chat
1. Confirmar que o dono publicou e que, no celular, editar/salvar/cancelar/arquivar funcionam. Se aparecer faixa vermelha de erro, pegar o texto dela (o captador global existe pra isso) e ir direto na causa.
2. Assim que a edicao estiver no ar, usar ela pra fechar os buracos de dado: telefones de Yasmim (LEAD-0007) e Erickao (LEAD-0008); corrigir a data placeholder 20/07 do Erickao (LEAD-0008); confirmar Miguel (LEAD-0013) ativo ou frio.
3. **Ir para a Fase 3, a regua nativa em pg_cron.** Proximo bloco grande. Antes de codar, cravar com o dono: a cadencia por perfil (quantos passos, intervalos por perfil) e o limite de silencio da Regra 2. Esses numeros vem do dono ou do codigo da regua antiga (Apps Script). Regras ja acordadas: Regra 1 (so avanca com toque confirmado no passo), Regra 2 (esfria so quem foi tocado, ignorado, chegou ao ultimo passo e passou do limite de silencio). Estado vive em `cadencia_estado`.

---

## Pendencias abertas (fila do proximo trabalho)
1. [dono] Publicar o `index_deploy.min.html` no Worker e recarregar forcado no celular. Confirmar edicao/arquivamento por olho.
2. [dono, apos publicar] Preencher telefones de LEAD-0007 e LEAD-0008; corrigir data do LEAD-0008; confirmar status do LEAD-0013. Tudo destravado pela edicao.
3. [proximo bloco grande] Fase 3, regua nativa em pg_cron. Depende de cravar cadencia por perfil e limite de silencio.
4. Fase 3.5, sugestao de mensagem com banco de scripts (`dicionario_scripts`, substituicao de variaveis, deep link `?text=`). Depende da regua. Ver v14.
5. Aba de aniversariantes. Depende de haver data_nascimento preenchida em massa suficiente. Coluna e coleta ja prontas. Fase 5.
6. Abas do topo tocaveis como filtros: parcialmente entregue (Indicacoes ja e um filtro). Restante e evolucao de frontend, deferida.
7. Vigiar nos primeiros dias: backup automatico verde as 05:05; planilha nao editada por reflexo.
8. Registrar dominio proprio (some o `flat-resonance-09ba`).
9. Reconstrucao da interface (Fase 5). Gatilho: operacao cortada E estavel (falta a estabilidade com a regua).
10. Reapontar o conteudo/Notion pro nucleo (Fase 4/5). Hoje ainda no Apps Script.
11. Restante da trilha B de seguranca (pos-B1): MFA, rate limiting, protecao de senha vazada, prova de isolamento com um segundo tenant real.
12. SaaS: validacao de demanda com 3 a 5 lojistas (sinal de pagamento). Interesse nao e pagamento.

---

## Invariantes e travas (seguem validas; deltas do v15 marcados)
- Toda escrita gera registro de auditoria (trigger `fn_auditar`, provado). **Vale tambem pra editar_lead e arquivar_lead (eventos lead_editado e arquivado).**
- Escrita so por RPC; o frontend nunca escreve direto em tabela. **editar_lead e arquivar_lead entram no mesmo padrao (chamarRPC/acaoEscrita).**
- anon nao executa nenhuma funcao de escrita nem helper (B1). **editar_lead e arquivar_lead nasceram ja com a trava B1.** authenticated e service_role preservados.
- **Nao apagar lead com historico. Lead com qualquer evento so arquiva (arquivar_lead). Hard delete so pra lead sem evento, e so por administrador via SQL, nunca pelo app.**
- **Lead arquivado (arquivado_em nao nulo) some da operacao: fila, pitboard, busca, indicacoes. So reaparece se um administrador anular a coluna.**
- Nivel derivado na leitura, nunca armazenado (v_lead, Rota A: 0-2 quente, 3-6 morno, 7+ frio).
- `security_invoker = on` em toda view sobre tabela com RLS. **v_lead recriada nesta sessao mantem a trava.**
- Nao colapsar "toque enviado" e "respondido". WhatsApp so abre; o botao Toque enviado registra.
- Nao colapsar frio (nivel, leitura) com ❄️ Lista fria (status, decisao da regua).
- Produto = aparelho; condicao = condicao. Nao inverter.
- `service_role` NUNCA no frontend; anon key e publica, protegida por RLS.
- `UNIQUE (tenant_id, whatsapp_digitos)` torna telefone duplicado impossivel; editar_lead devolve erro legivel se tentar colidir.
- Config de Auth e troca de senha: so pelo painel do Supabase, nunca por SQL.
- Backup: pg_dump 17 via Session pooler, cifrado AES256, so `.gpg` no git.
- Conteudo: `Data` obrigatoria; sync full replace hoje-7..hoje+28; grafia exata nos selects; deletar = Status Descartado.
- Entrega em unidade fechada, validada, nunca fragmento. **Frontend validado com Acorn + jsdom antes de entregar; SQL provado por MCP antes de entregar.**
- **Registro de listener resiliente: um bind que falha nao pode derrubar os demais (helper on()).**

---

## Referencias de sistema
- Projeto Supabase (Nucleo): `unjzpyexgtbcmjfgcqrx`, org vinialbuquerquepitstop-beep, plano FREE, PRODUCTION, branch main. Conector MCP ativo.
- Worker / URL do app: `https://flat-resonance-09ba.pitstopimports.workers.dev`.
- Repo GitHub: privado, `vinialbuquerquepitstop-beep/pitwall--nucleo`, branch `main`. `public/index.html`, `wrangler.jsonc`, `.github/workflows/backup_git.yml`, `.github/workflows/restore_drill.yml`, pasta `backups/`. Raw retorna 404 sem token (repo privado): pra ler o fonte, o dono manda o `index_brand.html` no chat.
- Secrets do repo: `SUPABASE_DB_URL` (Session pooler), `BACKUP_PASSPHRASE` (cifra dos backups).
- Tenant 1 (Pitstop Imports): `00000000-0000-0000-0000-000000000001`.
- Usuario dono: auth.users id `fb2aad8e-b728-4e59-a198-71da2156449d`, papel dono, email `vinialbuquerque.pitstop@gmail.com`.
- CRM Sheets (espelho congelado): `1lJj4wHjniXhjW_dmFSJ2eKdohN8MCJ4MGvglXyyIrrY`, aba `Pitstop Imports — CRM de Clientes`.
- Conteudo Sheets (cache do Notion, ainda ativo no Apps Script): `1fWhQ78vq1ScvYehvW6jvauS5WNY5kXtuPVhf09Ue7ek`.
- Notion calendario de conteudo: DB `ab0fc93f-d964-4f32-8c81-4be5343687b3`.
- Cor da marca (azul): `#0025cc`. Termometro morno (semantico): `#f2a71b`.
- Estado do banco (verificado nesta sessao): 15 leads (LEAD-0001..LEAD-0015), 0 arquivados, 1 tenant, 27 rotulos, todo lead com code. Sentinelas LEAD-0001 e LEAD-0015 presentes.
- Postgres do servidor: 17.6 (pg_dump/pg_restore 17 obrigatorio no backup e no drill).
- Migrations aplicadas: `fase0_schema_nucleo.sql` + `v_lead_security_invoker_on` + `dicionario_add_consulta_whatsapp_status` + `lead_checks_add_consulta_whatsapp_status` + `lead_whatsapp_digitos_nullable` + `etl_leads_iniciais_pitstop_v2` + `fase2_funcoes_escrita` + `b1_revoke_anon_execute_rpcs` + **`editar_arquivar_lead_e_data_nascimento` (esta sessao)**.
- RPCs de escrita atuais: cadastrar_lead, registrar_toque, registrar_conversando, reagendar_proximo_contato, registrar_desfecho, **editar_lead, arquivar_lead**. Helpers: fn_tenant_atual, fn_papel_atual. Gatilho: fn_auditar.

---

## Nao reabrir, a menos que o dono peca
Construir superficie de SaaS antes do primeiro pagante; migrar mais dado sem necessidade; transformar o deploy num CI elaborado; colapsar "toque enviado" e "respondido"; colapsar frio (nivel) com ❄️ Lista fria (status); fazer o WhatsApp registrar toque; unificar o ambar do termometro com o azul da marca; reintroduzir "cadastrar mesmo assim"; introduzir hard delete de lead com historico no app; construir a aba de aniversariantes antes de haver data_nascimento em massa; commitar dump em claro no git; usar pg_dump mais antigo que o servidor; iniciar a reconstrucao visual antes da operacao estabilizar com a regua. O Pit Wall e sensor; a regua e o motor de cadencia; a base vive no Postgres.
