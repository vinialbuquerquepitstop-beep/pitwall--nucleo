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

## Onde continuam os bloqueios antigos

- **Notion "Update content"**: escrever de volta no kanban continua parado na capability
  da integracao. Bloqueio do dono, nao de codigo. Ver `handoff_migracao_pitwall_v33`.
- **MCP do Supabase**: os dois servidores estavam fora nesta sessao. O caminho que
  funcionou foi o SQL Editor com a helper privada
  (`select privado.fn_fin_cobertura(<tenant>, <ini>, <fim>)`), porque a RPC publica
  recusa com `Sessao invalida.` fora de uma sessao com JWT, que e o comportamento certo.
