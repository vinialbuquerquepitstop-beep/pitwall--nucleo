# Fases, cutover e timebox

O plano de migracao em fases, o tempo de cada uma, a sequencia de virada da fonte da
verdade e a trava de timebox. Parte deste plano ja foi EXECUTADA: o nucleo esta vivo e
em operacao diaria. Este arquivo serve tanto de registro do que foi feito quanto de
doutrina para o que falta.

## Mapa de fases

- Fase 0. Schema no Postgres com `tenant_id` e RLS. Reversivel, nao toca na operacao.
  Primeiro artefato. 1 a 2 dias. FEITA.
- Fase 1. Frontend com login, lendo do banco. Telas de leitura. ETL das linhas do CRM.
  4 a 6 dias, maior bloco. FEITA.
- Fase 2. Escrita no banco com auditoria em toda operacao. Cutover da fonte da verdade
  para o Postgres. 2 a 3 dias. FEITA.
- Fase 3. Regua nativa em pg_cron (sem Google Agenda). 2 a 3 dias. FEITA (job
  `regua_pitwall_diaria` ativo, config em `cadencia_regra`/`cadencia_perfil`).
- Fase 3.5. Banco de scripts (`dicionario_scripts`, 126 linhas, 3 variantes) e RPC
  `sugerir_mensagem`. FEITA.
- Fase 4. Aba historico/atividade. PENDENTE: exige a camada de escrita estavel primeiro
  (ja esta). Reapontar sync do Notion e backup diario. 1 dia.
- Fase 5. Dashboards, visual, calculadora. FORA da janela. So depois do nucleo firme.
  Ver `dashboards-metricas.md`.

Alem das fases: redesign estetico esta adiado. Com o split feito, mudar CSS ficou barato
(mexe so no `app.css`). Pode ser especificado agora sem escrever codigo.

## Sequencia de cutover (como foi feito com seguranca)

1. Destino existe antes do dado migrar (schema na Fase 0). Nao migrar dado de cliente
   antes de o destino existir.
2. Leitura antes de escrita. O front le do banco enquanto a planilha ainda e a fonte, o
   que permite comparar sem risco.
3. Virada da fonte da verdade so quando a escrita com auditoria esta provada.
4. So depois aposentar a planilha e reapontar integracoes.

## Timebox e criterio de parada

O timebox foi de 2 semanas. O dono decidiu NAO adotar criterio de parada formal.
Timebox sem criterio de parada nao freia nada. Sempre que a conversa tocar em prazo,
progresso ou "seguir mais um pouco", relembrar o criterio recomendado, sem impor: se no
fim da janela a operacao diaria nao estiver rodando na stack nova, congelar a migracao,
voltar a operar no Apps Script e reavaliar.

Ancora de realidade: o nucleo hoje ESTA rodando na stack nova em operacao diaria, entao
a migracao venceu o proprio timebox. O que sobra (Fase 4, Fase 5, redesign) e melhoria,
nao migracao critica. Tratar como melhoria: entra por decisao de valor, uma frente por
vez, sem inercia.

## Trava de negocio (SaaS)

Barato entra agora (ja entrou: multi-tenant, RLS, auditoria). Caro (billing, gestao de
tenant, onboarding) so quando alguem pagar. 2 lojistas interessados nao sao 2 pagantes.
O criterio de sucesso legitimo do dono e a propria ferramenta que ele usa; SaaS e upside,
nao premissa.
