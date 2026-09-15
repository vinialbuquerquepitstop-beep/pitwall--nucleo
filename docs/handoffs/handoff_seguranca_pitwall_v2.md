# Handoff de Segurança Pitwall v2

Data: 15/09/2026
Linha: Segurança / Backend / QA
Estado: SECURITY FATIA 0 em andamento; contenção do caminho agente -> migration em produção concluída.
Assinado por: ChatGPT (GPT-5.6 Sol)

## 1. O que esta entrega fecha

Esta entrega fecha o primeiro subpasso técnico da SECURITY FATIA 0 — CONTENÇÃO.

Foi removida a autorização automática de `mcp__supabase__apply_migration` do Claude Code e adicionada uma negação explícita em `.claude/settings.json`.

O objetivo é impedir que o agente tenha um caminho automático de migration contra o projeto Supabase de produção configurado em `.mcp.json`.

A Fatia 0 NÃO está concluída.

## 2. Base sincronizada antes da mudança

`main` observado antes da implementação:

`d426a9e658ce95d4e907a746a9b22489165bf90c` — `merge(security): integra fonte canonica do hardening`

Fonte canônica obrigatória:

`docs/seguranca/SECURITY_HARDENING_PITWALL_V1.md`

Handoff anterior:

`docs/handoffs/handoff_seguranca_pitwall_v1.md`

## 3. Mudança aplicada

Arquivo alterado:

`.claude/settings.json`

Antes:

```json
"allow": [
  "mcp__supabase__apply_migration"
]
```

Depois:

```json
"allow": [],
"deny": [
  "mcp__supabase__apply_migration"
]
```

As regras existentes que bloqueiam comandos amplos de `git add`/`git commit -a` foram preservadas.

## 4. Branch, PR e merge

Branch:

`chatgpt/security-fatia0a-agent-guard`

Commit de implementação:

`dcf2c284c6ab8f8b1f19d45186f1192a267419d0`

PR:

`#4 — security: bloqueia migration automática do Claude em produção`

Merge na `main`:

`7ada26781357032da2edc571c18dc950142ecb34`

## 5. Validação

A branch foi comparada contra a base antes do merge.

Resultado:

- 1 arquivo alterado;
- 2 adições;
- 3 remoções;
- zero mudança em banco;
- zero mudança em deploy;
- zero mudança em workflow de backup;
- zero mudança em código de produto.

O PR ficou mergeable e foi integrado com merge commit.

## 6. Riscos ainda abertos na Fatia 0

### Backup ainda no Git

`.github/workflows/backup_git.yml` continua executando dump diário, criptografando com GPG/AES-256 e fazendo commit dos arquivos `.gpg` na pasta `backups/` do próprio repositório.

Esse fluxo NÃO foi desligado nesta entrega para evitar criar uma janela sem backup antes de existir e ser provado um destino substituto.

### Repositório ainda público

No início desta entrega o repositório `vinialbuquerquepitstop-beep/pitwall--nucleo` continuava com visibilidade `public`.

A visibilidade não foi alterada nesta entrega.

### MCP ainda aponta para produção

`.mcp.json` continua apontando para o projeto Supabase de produção:

`unjzpyexgtbcmjfgcqrx`

A contenção aplicada reduz o risco de migration automática, mas não transforma toda a conexão em read-only por si só. Outras ferramentas mutáveis do MCP precisam de revisão específica antes de declarar o gate de agentes fechado.

## 7. Próximo passo obrigatório

Continuar a SECURITY FATIA 0 com o bloco de backup.

Sequência:

1. escolher e criar destino privado separado para backup;
2. adaptar o workflow para enviar o dump criptografado ao novo destino;
3. rodar backup real no novo destino;
4. provar restore de amostra;
5. só então impedir novos commits de backup em Git;
6. rotacionar `BACKUP_PASSPHRASE` após o novo fluxo estar provado;
7. tratar a visibilidade pública do repositório;
8. revisar outras operações mutáveis do MCP e consolidar produção read-only por padrão para agentes.

## 8. Banco, deploy e produto

- Supabase escrito: NÃO
- migration aplicada: NÃO
- produção escrita: NÃO
- deploy executado: NÃO
- código de produto alterado: NÃO
- workflow de backup alterado: NÃO
- handoff histórico alterado: NÃO

## 9. Assinatura

`ASSINADO-POR: ChatGPT (GPT-5.6 Sol)`

Escopo: SECURITY FATIA 0A — contenção do caminho automático de migration do Claude Code contra produção.
