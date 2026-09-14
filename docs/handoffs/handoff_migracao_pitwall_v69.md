# Handoff migracao v69 — ponte, nao repeticao

Data: 02/09/2026. Linha: migracao (fio historico principal). Substitui o
`handoff_migracao_pitwall_v68.md` como topo da linha.

**Este arquivo e curto de proposito.** Ele existe por um defeito conhecido do arranque:
o `CLAUDE.md` manda ler o handoff de MAIOR versao, e a linha migracao estava parada no
v68, de 26/08. Quem abrisse sessao lendo so ele perderia SETE dias de trabalho, entre
eles duas fatias inteiras do Financeiro e um conserto na rede de backup. Ja aconteceu
antes neste projeto, seis vezes, e esta anotado no proprio `CLAUDE.md`.

A substancia mora na **linha financeiro**. Aqui fica o mapa.

---

## O que aconteceu entre 26/08 e 02/09, em uma linha cada

| Quando | O que | Onde esta escrito |
|---|---|---|
| 31/08 | Fatia 3: repasse so existe em par, e a base incompleta para de virar numero (F3) | `handoff_financeiro_pitwall_v6` a `v9` |
| 01/09 | A suite para de mentir por omissao (trava de declaradas x executadas) e chega ao fim toda vez | `handoff_financeiro_pitwall_v10` e `v11` |
| 02/09 | **Fatia 4: cada linha sabe de quem veio ou para quem foi** | `handoff_financeiro_pitwall_v12`, secoes 1 a 7 |
| 02/09 | **O layout parou de desperdicar monitor grande** | `handoff_financeiro_pitwall_v12`, secao 8 |
| 02/09 | **O backup salvava o dado e nao o sistema** | `handoff_financeiro_pitwall_v12`, secao 12 |
| 02/09 | A cobertura da base foi medida pela primeira vez: **18,55%** | `handoff_financeiro_pitwall_v12`, secao 13 |

---

## O estado do sistema em 02/09/2026, para quem abrir a proxima sessao

**Banco.** 171 migrations no ledger, 39 arquivos em `supabase/migrations/`. Na era
financeira (26/08 em diante) sao **27 contra 27, zero divergencia, medido**. Antes
disso, 138 aplicadas nunca viraram arquivo: divida antiga, fechada como RETRATO em
`supabase/baseline/20260902_schema_baseline.sql` (40 tabelas, 94 funcoes, 75 policies,
261 GRANT, 91 REVOKE), nao como historia.

**Frontend.** Suite em **1037 assercoes, 0 falhas**, EXIT 0 nas cinco larguras de
celular e nas tres de monitor grande, medido em 14 corridas seguidas em 02/09. Sao
SETE comandos de validacao agora: entrou o `ferramentas/diag_largo.py`, que mede tela
SOBRANDO (o irmao do `diag_mobile`, que mede tela estourando).

**Backup.** Corrigido e PROVADO em 02/09: o dump passou a levar o schema `privado` e
os GRANT/REVOKE, e o drill ganhou um segundo juiz que exige schema, helpers de RLS,
policies e grants, nao so contagem de linhas. Os tres workflows rodaram verdes
(`backup-git`, drill e a linha de base). Nenhum dump anterior a 02/09/2026 restaura um
sistema funcionando, e o drill agora diz isso em voz alta.

**Ferramenta que mudou de fato conhecido:** o `gh` CLI **esta** instalado e autenticado
nesta maquina (escopos `gist, read:org, repo`). Da para disparar e ler CI daqui, sem
pedir clique ao dono. A memoria do projeto afirmava o contrario e foi corrigida.

---

## O unico item aberto, e ele nao e de codigo

O portao entre a semana 2 e a 3 do `docs/financeiro/PLANO.md` pede **95% do valor
julgado**. A medida de 02/09 e **18,55%**: R$ 362.299,35 pendentes em 785 linhas de
1.132.

Enquanto isso nao subir, a semana 3 (Visao Pessoal, graficos, Agente 1) **nao comeca**,
por decisao do proprio plano. Detalhe, lista de contrapartes e o caminho recomendado
(regras, nao cliques) na secao 13 do `handoff_financeiro_pitwall_v12.md`.

---

## O que a proxima sessao faz PRIMEIRO

Aplicar `supabase/migrations/20260902_fin_fatia4_regra_recusa_categoria_nao_manual.sql`
por `apply_migration` (nao pelo SQL Editor, que nao gera linha no ledger e quebraria a
igualdade 27 contra 27), e em seguida rodar `ferramentas/prova_regra_repasse.sql`.

Ela fecha um furo achado em 02/09 lendo o codigo: a trava de categoria nao atribuivel
a mao existia so no `fin_classificar`, e o `fin_regra_salvar` aceitava criar regra com
categoria `repasse`, que carimbaria repasse em lote sem par. Nao houve incidente, e a
pauta de regras de 02/09 nao tem nenhuma regra assim.

Depois disso, o trabalho e do dono: aplicar as 19 regras de
`docs/financeiro/pauta_regras_20260902.md` e parear os repasses das quatro
contrapartes, o que leva a cobertura de 18,55% para ~72,4%.

---

## Onde continuam os bloqueios antigos

- **Notion "Update content"**: escrever de volta no kanban continua parado na capability
  da integracao. Bloqueio do dono, nao de codigo. Ver `handoff_migracao_pitwall_v33`.
- **MCP do Supabase**: os dois servidores estavam fora nesta sessao. O caminho que
  funcionou foi o SQL Editor com a helper privada
  (`select privado.fn_fin_cobertura(<tenant>, <ini>, <fim>)`), porque a RPC publica
  recusa com `Sessao invalida.` fora de uma sessao com JWT, que e o comportamento certo.

---

## Atualizacao operacional CRM em 13/09/2026

Esta secao registra uma intervencao feita diretamente no Supabase de producao depois de
uma auditoria da regua de CRM. **Nao houve migration, alteracao de schema, alteracao de
funcao, alteracao de frontend ou mudanca de regra permanente.** O objetivo foi remover
divida operacional antiga da fila sem fabricar historico de contato.

### Auditoria antes da intervencao

- `regua_pitwall_diaria` ativa em `0 8 * * *`, equivalente a 05:00 BRT.
- Ultima execucao auditada em 13/09/2026: `ok=true`.
- 0 falhas de `regua_execucao` nos 14 dias anteriores.
- 30 leads ativos, 0 duplicatas ativas por telefone, 0 leads perfilados sem estado de
  cadencia e 0 divergencias entre perfil do lead e perfil da cadencia.
- A fila tinha **17 cadencias vencidas**.
- Nos 14 dias anteriores havia apenas **1 evento `toque_enviado`**. O gargalo medido era
  operacional, nao falha do motor.

### Classificacao dos 17 vencidos

- **9 pos-venda**.
- **5 comerciais acionaveis**.
- **2 repescagens** cujo proprio `veredito` era `pare`.
- **1 pos-venda sem WhatsApp**, `LEAD-0032`, portanto sem canal para executar a tarefa.

### O que foi alterado

1. **14 cadencias validas foram trazidas para 13/09/2026** como nova baseline
   operacional. Foram ajustados `lead.proximo_contato` e
   `cadencia_estado.passo_vence_em`. O passo da cadencia foi preservado.
2. **LEAD-0015 e LEAD-0016** tiveram a cadencia ativa encerrada porque o proprio
   veredito era `pare`. O lead nao foi apagado nem convertido em contato realizado.
3. **LEAD-0032** teve a cadencia ativa encerrada por falta de WhatsApp. A venda e o
   cliente foram preservados. O caso deve voltar para uma cadencia de contato somente
   quando existir canal valido e a politica de consentimento estiver correta.
4. Foram inseridos eventos de historico descrevendo a limpeza operacional. **Nenhum
   `toque_enviado`, resposta ou contato foi inventado.**

### Estado imediatamente depois da limpeza

- **0 pendencias com vencimento anterior a 13/09/2026**.
- **14 cadencias validas vencendo em 13/09/2026**.
- As duas repescagens `pare` ficaram fora da cadencia ativa.
- O pos-venda sem WhatsApp ficou fora da fila acionavel.

### Bugs e dividas descobertos, mas NAO corrigidos nesta intervencao

1. `registrar_venda(payload jsonb)` aceita criar cliente sem WhatsApp e mesmo assim
   inicia a cadencia `comprou`. Isso produz tarefa de contato sem canal.
2. A mesma funcao cria lead novo com `consentimento=true` e `consentimento_em=now()`.
   Isso precisa de revisao: consentimento de WhatsApp deve ter origem/evidencia real,
   nao nascer automaticamente por causa de uma venda.
3. A **Fatia 4, repescagem por evento**, continua sem evidencia de implementacao no
   banco ou no repositorio e deve ser tratada como aberta.

### Regra para a proxima sessao de CRM

Nao "limpar" novos atrasos automaticamente. A data de 13/09/2026 passa a ser a
baseline. Se a fila voltar a acumular, medir isso como problema real de execucao.
Prioridade de produto: corrigir `sem canal`, revisar consentimento e depois construir
repescagem por evento. O motor da regua nao deve ser reescrito sem nova evidencia de
falha.

### Deploy e repositorio

A intervencao no CRM foi **somente de dados no Supabase vivo**. Nao exigiu deploy para
entrar em vigor. Esta atualizacao de handoff e apenas documentacao. Como o repositorio
faz build automatico a cada commit em `main`, este commit documental pode disparar um
build do Cloudflare, mas **nao altera nenhum arquivo de aplicacao**.
