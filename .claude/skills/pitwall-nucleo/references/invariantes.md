# Invariantes da migracao

As regras que sobrevivem a saida do Apps Script para o Postgres. Violar uma delas nao
quebra uma linha de codigo, quebra o modelo mental do sistema. Por isso sao o erro mais
caro que da pra cometer aqui. Cada uma vem com o porque, para nao virar dogma vazio.

Estado atual: o schema descrito aqui esta VIVO no projeto Supabase
`unjzpyexgtbcmjfgcqrx`, tenant `00000000-0000-0000-0000-000000000001`. Os nomes de
coluna e os valores de enum abaixo sao os reais, conferidos no banco.

## 1. Sensor x regua sao camadas distintas

O sensor registra o que aconteceu (colunas de evento na tabela `lead` e linhas em
`lead_evento`). A regua le esse estado e decide a direcao (a varredura em pg_cron).
Nunca fundir as duas: se a regua passar a gravar o proprio fato que ela deveria so
ler, some a fronteira entre observar e agir, e fica impossivel auditar por que um lead
avancou.

## 2. Toque enviado x Respondido sao eventos diferentes

Toque e acao do operador (registra `ultimo_toque_em`, gera `lead_evento` tipo
`toque_enviado`). Respondido e sinal do cliente (registra `respondido_em`). Um nunca
vira o outro. Respondido e um freio: quando o cliente responde, a cadencia automatica
para de empurrar naquele perfil. Esse freio e por perfil, controlado pela coluna
`respondido_freia` em `cadencia_perfil`, nunca uma regra global chumbada. Perfis como
`comprou` e `em_espera` tem `respondido_freia = false` de proposito.

## 3. Nivel (temperatura) x Status (decisao) nao se confundem

Nivel e LEITURA: quente, morno, frio, derivado do tempo de silencio. Status e DECISAO
registrada, coluna `lead.status` com valores `pendente`, `feito`, `convertido`,
`lista_fria`, `cancelado`. O `frio` (nivel) nunca vira `lista_fria` (status)
automaticamente por confusao de nome. Frio e uma cor no term metro; lista_fria e um
encerramento que a regua decide.

## 4. Nivel e derivado na leitura, nunca armazenado

Regra de faixa (Rota A): 0-2 dias de silencio quente, 3-6 morno, 7+ frio. Isso nao e
coluna no banco, e expressao na query de leitura, calculada a partir de
`ultima_resposta` / `ultimo_toque_em` contra a data de hoje no fuso do Brasil.
Armazenar o nivel gera dado que envelhece sozinho e passa a mentir.

## 5. Lead code e a chave estavel

`lead.lead_code` (formato LEAD-0001) e o identificador humano estavel. O vinculo real
entre tabelas usa `lead.id` (uuid). Nunca vincular por numero de linha ou por posicao:
foi isso que tornou o ETL das linhas do CRM limpo.

## 6. Historico e auditoria sao append-only

`lead_evento` e a linha do tempo do lead: so cresce, newest-first onde exibido, nunca
edita evento passado. `auditoria` e o log tecnico (quem, tabela, acao INSERT/UPDATE/
DELETE, `antes`/`depois` em jsonb), gerado por trigger, tambem append-only. Reescrever
historico apaga a prova de por que o sistema fez o que fez.

## 7. Toda tabela de dado tem tenant_id e RLS

Toda tabela de negocio carrega `tenant_id` e uma policy de Row Level Security que o usa.
Isso nasce single-tenant mas ja fecha o isolamento para o dia do multi-tenant. Ligar
RLS depois, com dado dentro, e migracao de risco; ligar desde a primeira linha e barato.

## 8. Funcoes helper de RLS vivem no schema privado

`fn_tenant_atual()` e `fn_papel_atual()` moram no schema `privado`, nunca em `public`.
Em `public` elas ficariam visiveis ao PostgREST e expostas como se fossem RPC. No
`privado` sao invisiveis a API e servem so as policies. Quando o corpo de uma funcao
chama outra com schema qualificado, mudar so o `search_path` nao redireciona a chamada:
o corpo tem que ser atualizado tambem.

## 9. authenticated recebe o minimo necessario

O papel `authenticated` nunca recebe TRUNCATE. Grants de TRUNCATE/DELETE/REFERENCES/
TRIGGER foram revogados. `anon` teve EXECUTE revogado de todas as funcoes. Privilegio
minimo e o default; cada grant e uma decisao consciente. Lembrar que
`CREATE OR REPLACE FUNCTION` reseta as ACLs para o default do Postgres: refazer os
REVOKE/GRANT depois de toda substituicao.

## 10. CURRENT_DATE e proibido onde se produz data de negocio

O servidor Postgres pode estar em UTC. `CURRENT_DATE` ali produz a data errada perto da
virada do dia. Sempre usar o equivalente no fuso do Brasil (America/Sao_Paulo) quando o
resultado for uma data que o operador enxerga (proximo_contato, vencimento de passo).

## 11. Numeros de cadencia vivem em config, nunca no codigo

Todo offset de dia, limite de silencio e rotulo de passo mora nas tabelas
`cadencia_regra` e `cadencia_perfil`. Nada disso dentro do corpo de
`fn_regua_varredura()`. Mudar a cadencia e editar dado, nao reescrever funcao. Isso e o
que permite ajustar a regua sem deploy.

## 12. A chave do script e perfil + passo, nunca o rotulo

`dicionario_scripts` e buscado por `perfil` (enum) + `passo` (inteiro). O rotulo
(`R3 · D14`) e documentacao humana, editavel, e nunca deve ser chave de busca. Passo 0 e
o fallback generico do perfil quando o passo especifico nao tem script.

## 13. sugerir_mensagem e read-only e e a unica fonte de texto na Fila

A RPC `sugerir_mensagem` monta o texto de abordagem e nao registra nada: nao grava
toque, nao mexe em estado. Ela devolve `opcoes[]` (as 3 variantes) com um campo `texto`
compat vel apontando para a variante 1. Nenhuma mensagem fixa mora no JS do frontend. O
link de WhatsApp gerado a partir dela so abre a conversa, jamais registra contato.

## 14. As 3 variantes cumprem papeis distintos

Direto, Consultivo e Leve sao tres tons com funcao diferente. Se Direto e Consultivo
dizem a mesma coisa, e regressao, nao economia. A distincao e o valor da feature.

## 15. Assinatura formal so em momento certo

A assinatura `Vini, da Pitstop Imports` entra so em primeiro contato e em reativacao
apos silencio longo. Repetir assinatura em toda mensagem de uma conversa em andamento
soa robotico e denuncia automacao.

## 16. LGPD na Fila: sem consentimento, sem link

`waHrefFila` (ou equivalente no front) so devolve link de WhatsApp se
`lead.consentimento = true`. Consentimento negado ou ausente nao abre canal. O
consentimento e boolean com `consentimento_em` marcando quando foi dado.

## 17. Nao construir superficie de SaaS antes do primeiro pagamento

Barato entra agora e ja entrou: schema multi-tenant, RLS, auditoria. Caro (billing,
gestao de tenant, onboarding, telas de admin) so quando alguem pagar. Construir a
superficie de SaaS cedo e o mecanismo exato pelo qual o software passa a comer a margem
da revenda. Dois lojistas interessados nao sao dois pagantes.
