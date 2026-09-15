# Handoff de Segurança Pitwall v1

Data: 15/09/2026
Linha: Segurança / Backend / QA
Estado: processo oficial de hardening criado; nenhuma correção técnica aplicada ainda.
Assinado por: ChatGPT (GPT-5.6 Sol)

## 1. O que esta entrega fecha

Esta entrega transforma a auditoria read-only de segurança de 15/09/2026 em um processo oficial, compartilhado e versionado no repositório.

Foi criada a fonte canônica:

`docs/seguranca/SECURITY_HARDENING_PITWALL_V1.md`

Ela define:

- prioridades P0/P1/P2 observadas;
- Fatias 0 a 7 do hardening;
- gates de saída;
- regras de banco/produção;
- protocolo obrigatório de aviso antes/depois de mudanças;
- assinatura de procedência por agente;
- regra de convergência ChatGPT <-> Claude Code via Git + handoff.

Nenhuma migration, policy, grant, RPC, Edge Function, workflow de backup, configuração do Supabase ou código de produto foi alterado nesta entrega.

## 2. Base sincronizada antes da escrita

`main` foi conferida antes da criação deste handoff.

Base observada:

`062c650035ad57cf9bfe3f9ba0e8974377f9308c` — `docs(crm): aponta indice para v77 e estabilizacao`

Topo do CRM lido:

`docs/handoffs/handoff_migracao_pitwall_v77.md`

O índice mestre ainda declarava que Segurança / Backend / QA não possuía handoff próprio. Esta entrega inaugura essa linha sem editar handoffs históricos.

## 3. Regra de transparência aprovada

A partir deste processo, mudança material de segurança deve ser anunciada em dois momentos:

### Antes

Bloco `MUDANÇA PROPOSTA` com objetivo, domínio, arquivos/objetos, produção, risco, rollback e executor.

### Depois

Bloco `MUDANÇA APLICADA` com alterações reais, branch, commits, testes, deploy/banco afetado, risco residual, próximo passo e assinatura.

Mudança silenciosa de escopo fica proibida no processo.

## 4. Regra de assinatura

Mudança material deve registrar procedência no commit e no handoff.

Exemplo ChatGPT:

```text
Agent: ChatGPT (GPT-5.6 Sol)
Change-Scope: security
Human-Approval: explicit | not-required | pending
```

Exemplo Claude Code:

```text
Agent: Claude Code
Change-Scope: security
Human-Approval: explicit | not-required | pending
```

Esses trailers são rastreabilidade operacional e não equivalem a commit criptograficamente assinado.

## 5. Próximo passo oficial

**SECURITY FATIA 0 — CONTENÇÃO.**

Escopo inicial fechado pela fonte canônica:

1. parar novos backups no Git;
2. mover backup para destino privado separado;
3. provar restore de amostra;
4. rotacionar passphrase somente depois do novo fluxo provado;
5. reduzir exposição pública do repositório;
6. remover `apply_migration` automático de agentes contra produção;
7. definir produção read-only por padrão para agentes.

Não iniciar alterações da Fatia 1 antes do gate mínimo da Fatia 0, salvo decisão humana explicitamente registrada.

## 6. Estado de risco que deve ser preservado como baseline

Este handoff não substitui a auditoria completa, mas registra os eixos que originaram o programa:

- backups criptografados de produção versionados no mesmo repositório público;
- autorização Dono x Vendedor mais fraca do que isolamento tenant;
- UPDATE direto amplo em `lead`;
- MFA ausente nas contas observadas e leaked-password protection desativada;
- `main` sem gate forte e sem staging obrigatório;
- agente com caminho configurado para migration em produção;
- restore completo ainda não provado ponta a ponta;
- retenção/PII em auditoria e consentimento como temas P2;
- Edge Functions, frontend dinâmico e supply chain exigindo validação dirigida.

## 7. Arquivos criados por esta entrega

- `docs/seguranca/SECURITY_HARDENING_PITWALL_V1.md`
- `docs/handoffs/handoff_seguranca_pitwall_v1.md`

O índice mestre deve ser atualizado nesta mesma branch para apontar esta linha como topo vivo de Segurança.

## 8. Banco, deploy e produto

- Supabase escrito: NÃO
- migration aplicada: NÃO
- produção escrita: NÃO
- deploy executado: NÃO
- código de produto alterado: NÃO
- handoff histórico alterado: NÃO

## 9. Assinatura

`ASSINADO-POR: ChatGPT (GPT-5.6 Sol)`

Escopo: criação da fonte canônica e inauguração da linha de Segurança / Backend / QA.
