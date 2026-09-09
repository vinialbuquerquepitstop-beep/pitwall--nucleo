# `calc_catalogo_tenant_pitstop` fica FORA do repo, de proposito

Data da decisao: 09/09/2026. Esta nota existe para que a proxima sessao **nao
procure o arquivo achando que ele se perdeu**, e nao o recrie sem pensar.

## O que e

Migration aplicada em `unjzpyexgtbcmjfgcqrx` em 08/09/2026 (`version`
`20260908122319`), Bloco 1.2 do plano `2026-09-05-calculadora-produto`. Ela semeia o
catalogo do tenant `00000000-0000-0000-0000-000000000001` (Pitstop Imports).

Tamanho: 25.064 caracteres, em seis `insert`. Medido em 09/09/2026:

| Trecho | Conteudo | Sensivel |
|---|---|---|
| chars 1 a 21.370 (85%) | `calc_modelo`, `calc_cor`, `calc_alias`, `calc_regra` do tenant | **nao** — e o mesmo lado Apple generico que ja esta versionado em `20260908_calc_catalogo_semente.sql` |
| chars 21.371 a 25.064 (15%) | `calc_fornecedor` (os **17 fornecedores do dono, com praca exata**) e os `calc_alias` de fornecedor | **sim** |

## Por que nao entra

1. **Restricao global 8 do plano:** *"Nenhum export de fornecedor entra no repo, nem
   como corpus de teste. Dado comercial de terceiro vive em `privado` ou e sintetico."*
2. **O repo so guarda dado sensivel CRIPTOGRAFADO.** Os dumps em `backups/` sao
   `.gpg` justamente por isso. Um `.sql` em texto puro com a lista de fornecedores e a
   praca de cada um quebraria essa regra em silencio.
3. **D2: a calculadora vira produto separado depois.** No dia em que este repo for
   desmembrado ou mostrado a alguem, a lista de fornecedores do dono viajaria junto do
   codigo.
4. **O Bloco 0 existiu por causa deste exato vazamento.** A linha orfa de `calc_dados`
   no tenant `...0004` expunha **14 dos 17 fornecedores**, e foi apagada em 07/09/2026.
   Reintroduzir os mesmos 17 em texto puno no git desfaria aquele trabalho por outra
   porta.

## Como recuperar, se precisar

Nao pelo git. Pelo caminho que ja existe e ja e provado:

- **Backup diario criptografado**: `backups/pitwall_AAAAMMDD_HHMMSS.dump.gpg`, gerado
  por `.github/workflows/backup_git.yml`. O `restore_drill.yml` prova que restaura.
- **O SQL exato continua no banco**, recuperavel a qualquer momento:

```sql
select statements[1]
  from supabase_migrations.schema_migrations
 where name = 'calc_catalogo_tenant_pitstop';
```

## O que ESTA versionado, e basta para reconstruir um tenant novo

| Arquivo | Papel |
|---|---|
| `20260908_calc_catalogo_duas_camadas.sql` | as 5 tabelas, RLS, policies, indices |
| `20260908_calc_catalogo_semente.sql` | a semente (`tenant_id null`): **124 modelos, 32 cores, 27 aliases, 20 regras**, contados no banco em 09/09/2026 |

Uma conta NOVA nasce dessas duas mais `fn_provisionar_tenant` (Bloco 4). O tenant do
dono e o unico que depende da migration nao versionada, e ele esta no backup.

## Contradicao com o plano, declarada

O plano `2026-09-09-rebarbas-bloco2-calculadora.md`, tarefa **T6**, manda versionar as
**tres**. Foram versionadas **duas**. A terceira foi recusada aqui pela restricao 8 do
plano principal, que e mais forte. **Se o dono discordar, e decisao dele**: o SQL esta
no banco e o arquivo se cria em um comando.
