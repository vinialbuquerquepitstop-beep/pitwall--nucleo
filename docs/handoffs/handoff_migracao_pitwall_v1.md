# Handoff de Planejamento, Migracao Pit Wall 2.0 (fora do Apps Script), v1

## Como usar este documento
Esta e uma TRILHA NOVA e SEPARADA da linha operacional (handoff_pitwall_vNN, atual v16). Nao substitui o v16, corre em paralelo. O v16 descreve o sistema que esta no ar hoje (Apps Script). Este documento descreve para onde o sistema vai (banco proprio, frontend hospedado, sem vinculo com o Apps Script). Le primeiro "Estado em uma frase", "Decisoes travadas", "Leitura do negocio" e "Fases".

Convencao de escrita: prosa sem acento e sem cedilha, nunca travessao. EXCECAO: dado real do sistema carrega seus proprios caracteres (nome da aba com em-dash U+2014, status com emoji, sentinelas, cabecalhos, tokens tecnicos como tenant_id, pg_cron, RLS, LockService).

## Nome da iniciativa
Pit Wall 2.0 (Nucleo). "Nucleo" = o sistema unico e centralizado que absorve o sensor, a regua e o conteudo num backend so, com login, banco de verdade e frontend hospedado.

## Estado em uma frase
Decidido migrar o Pit Wall de Apps Script mais Sheets para um sistema unico centralizado (Postgres/Supabase mais frontend estatico hospedado), com login por email e senha, isolamento por usuario, auditoria completa e schema multi-tenant-ready desde a primeira linha. Nada foi construido ainda. O primeiro artefato concreto e o schema da Fase 0.

---

## Decisoes travadas nesta trilha

1. Sair do Apps Script. O acoplamento profundo nao e o Apps Script, e a planilha. O que justifica a saida NAO e volume nem performance (a escala e minima), e sim quatro coisas que a stack atual nao entrega: login de verdade, isolamento por usuario, auditoria completa e base multi-tenant. O banco e pelo MODELO DE ACESSO, nao pelo dado.

2. As duas planilhas saem como fonte da verdade. Base unica em Postgres. Ver secao "Destino das planilhas".

3. Corte limpo, nao strangler pesado. Justificado pela escala (19 linhas). Levanta o novo, migra as 19 linhas de uma vez, desliga o velho. A operacao segue durante, mas nao precisa de escrita dupla por semanas.

4. Regua vira job nativo. Deixa de ser projeto separado e vira funcao agendada por pg_cron no mesmo backend. Some o split de dois projetos, a duplicacao do _crmCarimbarHistorico e o risco de escrita concorrente (transacao do Postgres substitui o LockService).

5. Google Agenda SAI do escopo. Decidido nesta sessao: os eventos de Agenda eram so lembrete. A notificacao na tela assume. Isso encurta a regua e elimina a dependencia de Calendar API / service account. A regua continua sendo o coracao do acompanhamento do lead, so sem criar evento externo.

6. Login por email e senha. Nao login por conta Google. Supabase Auth.

7. Isolamento por usuario e multi-tenant. Vendedor ve so a sessao dele (leads, operacao diaria e calculadora). Cada lojista no SaaS e uma conta totalmente isolada. Ambos resolvidos por tenant_id mais Row Level Security (RLS) do Postgres.

8. Blindagem = os tres riscos. Ver o dado, alterar sem rastro, vazar o numero do cliente. Resposta: RLS (quem ve o que), auditoria append-only (todo alteracao com rastro), segredos e ID de base no servidor (numero nunca exposto no HTML). Ofuscar HTML nao e blindagem.

9. Auditoria completa. Nao so operacoes principais. Tabela de auditoria append-only mais trigger, registrando quem fez o que e quando, em tudo.

10. Backup diario, retencao indeterminada. Backup gerenciado do banco mais export proprio.

11. WhatsApp estruturado para API oficial futura. Hoje segue wa.me. A camada de mensagem nasce abstraida para trocar wa.me por API oficial depois sem reescrever o resto.

12. Divisao de trabalho. Claude constroi (gera schema SQL, policies RLS, funcoes, frontend). Dono orquestra (faz deploy por painel, valida, decide). O dono nao escreve codigo.

13. Notion continua como autoria de conteudo por enquanto. Pode sair numa fase futura se surgir opcao melhor, mas fica pelo valor de acompanhamento. Sincroniza para o banco em vez de para a Sheet.

---

## Leitura do negocio (base das decisoes)
- Negocio: Pitstop Imports, revenda Apple em Araruama RJ. Operador unico hoje.
- Escala: dezenas de ativos, 19 linhas totais na planilha CRM, 0 a 2 toques por dia, ~20 leads novos por mes. Escala minima. Qualquer banco engole isso dormindo.
- Consequencia 1: migracao de dado trivial (19 linhas), corte limpo seguro.
- Consequencia 2: dashboards ricos so ganham valor com historico acumulado; cedo ficam magros. Construir a estrutura cedo (barato), o visual sofisticado quando houver dado.
- Interesse de mercado: 2 lojistas sinalizaram. Interesse nao e pagamento (regra travada dos handoffs). Criterio de sucesso do dono: o proprio desenvolvimento da Pitstop. Legitimo: constroi a ferramenta que ele mesmo usa, SaaS e upside.

---

## Stack alvo
| Necessidade | Peca |
|---|---|
| Banco | Postgres (Supabase) |
| Login email e senha | Supabase Auth |
| Vendedor ve so o dele / tenant isolado | Row Level Security mais tenant_id |
| Auditoria completa | Tabela append-only mais trigger |
| Regua agendada | pg_cron no mesmo backend |
| Backup diario | Backup gerenciado mais export |
| Frontend hospedado com link | Host estatico (Cloudflare Pages ou Vercel) |
| Dominio | a registrar |

Custo: enquanto for so o dono, o free tier cobre com folga enorme (volume ridiculo perto do limite). Gasto inicial de fato = dominio. Fica abaixo de R$50/mes. Quando o SaaS escalar o custo, ja havera receita de lojista. Confirmar limites exatos do free tier no site do fornecedor no dia de comprometer (mudam).

Nota de dimensionamento: como CRM de 19 linhas isso e overkill. Dado o requisito real (login, isolamento, auditoria, multi-tenant), e o minimo que entrega isso de forma nativa. A alternativa leve (Apps Script como API publica com token) falharia no requisito central: nao da login real nem isolamento por usuario.

---

## Destino das planilhas
- Planilha CRM (1lJj4wHjniXhjW_dmFSJ2eKdohN8MCJ4MGvglXyyIrrY, aba `Pitstop Imports — CRM de Clientes`): vira as tabelas de lead e de historico/auditoria. E onde vive o risco de escrita concorrente e a dependencia de LockService; melhora ao virar transacao. Mantida como espelho somente-leitura durante a migracao, depois cortada.
- Planilha de dados/conteudo (1fWhQ78vq1ScvYehvW6jvauS5WNY5kXtuPVhf09Ue7ek): sai. Uso diario vira tabela de eventos (ja e o "log em tudo"). Vetores de campanha vira tabela propria. Conteudo continua autorado no Notion, sincronizado para o banco.
- Superficie de edicao manual: hoje a planilha e a mesa de edicao de graca. Ao aposenta-la, o painel de tabelas do proprio Supabase faz esse papel enquanto o app nao tiver telas de edicao completas. A capacidade nao some, muda de lugar.

---

## Regua nova (Agenda fora do escopo)
- Vira uma funcao agendada por pg_cron, no mesmo backend, lendo e gravando a mesma base.
- Logica que carrega da regua atual: cadencia por Perfil, avanco dirigido por toque (Regra 1: so avanca com toque confirmado; Regra 2: esfria so quem foi tocado e ignorado no ultimo passo), esfriamento para ❄️ Lista fria, historico carimbado.
- O que SAI: criacao de eventos no Google Agenda, sentinelas cross-project, _crmCarimbarHistorico duplicado. Tudo isso existia por causa do split de dois projetos do Apps Script, que deixa de existir.
- Nivel (temperatura) segue derivado na leitura (Rota A: 0-2 quente, 3-6 morno, 7+ frio), nunca armazenado. Vira uma expressao na query, nao uma coluna.

---

## Modelo de acesso
- Auth: email e senha (Supabase Auth).
- Papeis: dono (ve tudo do tenant) e vendedor (ve so os leads dele, operacao diaria dele e calculadora). RLS aplica o corte no banco, nao no frontend.
- Multi-tenant: tenant_id em toda tabela de dado, RLS por tenant. So o dado do dono existe como tenant 1 ate o SaaS ligar.
- Acesso de qualquer maquina: consequencia natural de ser web com login. Entregue ja na fase do frontend.

---

## Blindagem e auditoria
- Ver: RLS decide quem le cada linha.
- Alterar sem rastro: impossivel, toda escrita gera registro de auditoria (quem, o que, quando, valor antes e depois).
- Vazar numero: ID de base, chaves e segredos ficam no servidor; o HTML nunca carrega credencial nem ID de planilha.
- Auditoria: tabela append-only, alimentada por trigger em cada tabela de dado. Nao editavel pela aplicacao.

---

## Backup
- Backup diario do banco, retencao indeterminada.
- Export proprio periodico como segunda copia independente do fornecedor.

---

## Fases (ordem por dependencia)
- Fase 0. Schema no Postgres: tenant, usuario (papel dono/vendedor), lead, historico/auditoria, estado de cadencia, evento de uso. Com tenant_id e RLS desde a primeira linha. Reversivel, nao toca na operacao. PRIMEIRO ARTEFATO.
- Fase 1. Frontend novo com login, lendo do banco. Migra as 19 linhas. Entrega: site hospedado, login email e senha, acesso de qualquer maquina.
- Fase 2. Escrita no banco (cadastro, toque, desfecho) com auditoria em toda operacao. Fecha a blindagem dos tres riscos.
- Fase 3. Regua nativa em pg_cron (Agenda fora).
- Fase 4. Aposenta a planilha, liga backup diario de banco, re-aponta Notion.
- Fase 5 (VISUAL E FERRAMENTAS, resposta desta sessao). Dashboards, visual melhor, calculadora acoplada. Ver secao dedicada.
- Fase SaaS (so quando um lojista pagar). Cadastro de tenant, onboarding, cobranca. Barato de ligar porque o schema ja nasce multi-tenant.

---

## Fase 5: dashboards, visual, calculadora (planejada, nao iniciada)
Possivel e mais facil que hoje. Vem DEPOIS do nucleo, nunca antes.
- Dashboards: agregacoes viram query SQL (conversao, ticket medio, funil, follow-ups vencidos, captacao ativa por origem). Grafico com biblioteca livre. Ressalva: com o volume atual o painel fica magro; o valor cresce com o historico. Construir a estrutura cedo, o visual rico quando houver dado.
- Visual: fora do sandbox do HtmlService, o frontend ganha liberdade total de layout e componente.
- Calculadora Pitstop: entra como modulo/rota do mesmo app; pode salvar a proposta gerada dentro do lead. PENDENCIA de especificacao: onde ela vive hoje, o que calcula (preco, margem, valor de entrada), e se o resultado precisa ser salvo. Sem isso, fica como modulo com spec em aberto. Vendedores tem acesso a ela (definido no modelo de acesso).

---

## Trava de risco e criterio de parada
- 2 interessados nao sao 2 pagantes. Ancorar no fato, nao no "venderei".
- Separar barato de caro. Barato (entra agora): schema multi-tenant-ready, RLS, auditoria. Caro (so quando alguem pagar): superficie de SaaS (billing, painel de gestao de tenant, onboarding de lojista). Construir a superficie de SaaS antes do primeiro pagamento e o que faz o software comer a margem da revenda.
- Time-box: definir quantas semanas o dono aceita gastar ate o CRM completo rodar na stack nova, e o que faz abortar e voltar. PENDENTE de definicao do dono.
- Enquanto construir so o que a Pitstop usa, o gasto e custo de operacao, legitimo.

---

## Pendencias / decisoes que faltam
1. Especificacao da calculadora (onde vive, o que calcula, se salva). Trava so a Fase 5, nao o nucleo.
2. Time-box e criterio de parada da migracao (numeros do dono).
3. Registro do dominio proprio.
4. Confirmar limites do free tier do fornecedor no dia de comprometer.
5. Definir a lista exata de metricas do dashboard antes de construir a Fase 5 (nao construir painel sem cravar o que mede).

---

## O que congela na trilha operacional (v16)
- NAO construir o form de cadastro no HtmlService. Se o destino e a stack nova, todo frontend sera reescrito; construir o form agora no Apps Script e reescrever depois e o retrabalho que o dono mais evita.
- Manter o que ja esta no ar operando normalmente ate a Fase 1 substituir.
- O cadastro nasce ja na stack nova, uma vez so.

---

## Regras criticas que sobrevivem a migracao
- Sensor registra o que aconteceu; a regua le e decide. A separacao conceitual continua, mesmo dentro de um backend so.
- Nao colapsar "toque enviado" e "respondido". Nao colapsar frio (nivel, leitura) com ❄️ Lista fria (status, decisao).
- Nivel derivado na leitura, nunca armazenado.
- Lead ID estavel como chave; torna o ETL da migracao limpo.
- Historico e auditoria sao append-only, newest-first onde exibido.
- Gravar data-only ao meio-dia continua valendo enquanto houver qualquer ponte com a planilha; no banco puro, timestamp com timezone resolve na origem.
- Nao migrar dado de cliente antes de o destino existir. O destino passa a existir na Fase 0.

---

## Referencias de sistema
- CRM Sheets: 1lJj4wHjniXhjW_dmFSJ2eKdohN8MCJ4MGvglXyyIrrY, aba `Pitstop Imports — CRM de Clientes`.
- Uso/conteudo Sheets: 1fWhQ78vq1ScvYehvW6jvauS5WNY5kXtuPVhf09Ue7ek.
- Notion calendario: DB ab0fc93f-d964-4f32-8c81-4be5343687b3.
- Proprietario / alerta: vinialbuquerque.pitstop@gmail.com.
- Status CRM (5 fixos): 🟡 Pendente, ✅ Feito, 🟢 Convertido, ❄️ Lista fria, 🚫 Cancelado.
- Nivel (Rota A): 0-2 quente, 3-6 morno, 7+ frio.
- Escala atual: 19 linhas, 0-2 toques/dia, ~20 leads/mes.
