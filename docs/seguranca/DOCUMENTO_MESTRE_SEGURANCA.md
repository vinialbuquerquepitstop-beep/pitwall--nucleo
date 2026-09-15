# DOCUMENTO MESTRE DE SEGURANÇA — PITWALL

Data de criação: 15/09/2026
Status: PORTA DE ENTRADA OFICIAL DA LINHA DE SEGURANÇA
Linha: Segurança / Backend / QA
Responsável de negócio: Pitwall
Criado por: ChatGPT (GPT-5.6 Sol)

---

## 1. Finalidade

Este é o documento mestre de ORIENTAÇÃO da linha de Segurança do Pitwall.

Ele existe para que Claude Code, ChatGPT/Codex e qualquer outro agente saibam exatamente:

- por onde começar;
- quais documentos são obrigatórios;
- onde vive o estado atual;
- onde vive o processo permanente;
- quais regras não podem ser quebradas;
- como registrar mudanças;
- como continuar o trabalho sem depender de memória de conversa.

Este documento NÃO substitui o handoff vivo e NÃO substitui a fonte canônica do hardening.

A função dele é ser a porta de entrada estável e reduzir ambiguidade entre documentos.

---

## 2. Ordem obrigatória de leitura

Toda tarefa de Segurança / Backend / QA deve começar nesta ordem:

1. sincronizar e conferir a `main` atual;
2. ler `docs/handoffs/handoff_indice_pitwall.md`;
3. ler o handoff de Segurança apontado pelo índice;
4. ler ESTE documento;
5. ler `docs/seguranca/SECURITY_HARDENING_PITWALL_V1.md`;
6. se a tarefa tocar outro domínio, ler também o handoff/contrato/processo desse domínio;
7. conferir o Git real;
8. se tocar banco, conferir o Supabase vivo antes de escrever.

A ordem mental é:

**índice -> handoff de Segurança -> Documento Mestre -> fonte canônica do hardening -> domínio afetado -> Git real -> banco vivo**.

---

## 3. Papel de cada documento

### `docs/seguranca/DOCUMENTO_MESTRE_SEGURANCA.md`

Porta de entrada estável da Segurança.

Responde:

- o que ler;
- em que ordem;
- qual documento manda em qual assunto;
- quais regras de trabalho são obrigatórias.

### `docs/seguranca/SECURITY_HARDENING_PITWALL_V1.md`

Fonte canônica do PROCESSO de hardening.

Responde:

- quais riscos foram encontrados;
- quais são as Fatias 0 a 7;
- qual é o gate de cada fatia;
- quais testes e critérios fecham cada etapa;
- regras de produção, banco, agentes, rollback e reauditoria.

### `docs/handoffs/handoff_seguranca_pitwall_vN.md`

Fonte do ESTADO VIVO da Segurança.

Responde:

- o que já foi aplicado;
- o que está em andamento;
- branch/PR/merge;
- testes executados;
- pendências abertas;
- próximo passo exato.

Handoff commitado é imutável. Mudança de estado gera nova versão.

### `docs/handoffs/handoff_indice_pitwall.md`

Fonte canônica de NAVEGAÇÃO.

Ele diz qual handoff vivo deve ser lido em cada linha do projeto.

---

## 4. Estado de referência na criação deste documento

Na criação deste Documento Mestre, o estado vivo da linha de Segurança era:

- SECURITY FATIA 0 — CONTENÇÃO em andamento;
- `mcp__supabase__apply_migration` removido da allowlist do Claude e explicitamente bloqueado;
- backup diário ainda sendo commitado no próprio repositório;
- repositório ainda público;
- `.mcp.json` ainda apontando para o projeto Supabase de produção;
- outras operações mutáveis do MCP ainda precisando de revisão;
- próximo bloco: criar e provar destino privado separado para backup antes de desligar o fluxo atual.

Este bloco é apenas referência histórica da criação deste arquivo.

Para estado atual, SEMPRE ler o handoff de Segurança apontado pelo índice.

---

## 5. Fonte canônica do processo

O processo oficial é:

`docs/seguranca/SECURITY_HARDENING_PITWALL_V1.md`

Nenhum agente deve criar um processo paralelo de segurança fora dele.

Se o processo precisar mudar materialmente:

1. não editar silenciosamente a intenção histórica;
2. criar nova versão do documento de processo quando aplicável;
3. registrar a mudança em novo handoff;
4. atualizar o índice/Documento Mestre se a navegação mudar;
5. assinar a procedência.

---

## 6. Programa oficial

O hardening atual está dividido em:

- Fatia 0 — Contenção;
- Fatia 1 — Autorização do CRM;
- Fatia 2 — Identidade e Sessão;
- Fatia 3 — Git, CI/CD e Staging;
- Fatia 4 — Backup e Disaster Recovery;
- Fatia 5 — Observabilidade e Auditoria;
- Fatia 6 — Segurança integrada ao desenvolvimento;
- Fatia 7 — Reauditoria e Fechamento.

Não criar nova fatia automaticamente.

O gate e o conteúdo completo de cada fatia vivem na fonte canônica do hardening.

---

## 7. Regra central: nenhuma mudança silenciosa

Antes de qualquer escrita material em código, banco, configuração, workflow ou documentação de segurança, registrar:

### MUDANÇA PROPOSTA

- objetivo;
- domínio afetado;
- arquivos que serão alterados;
- objetos de banco, se houver;
- se toca produção;
- risco principal;
- rollback previsto;
- executor.

Depois da execução, registrar:

### MUDANÇA APLICADA

- o que mudou de fato;
- arquivos/objetos alterados;
- branch;
- commits;
- PR/merge;
- testes e resultados;
- banco/deploy afetado ou não;
- risco residual;
- próximo passo;
- assinatura.

Mudança de escopo no meio de uma fatia deve ser avisada antes da ampliação.

---

## 8. Assinatura e procedência

Mudanças materiais devem registrar procedência no commit e no handoff.

### ChatGPT

```text
Agent: ChatGPT (GPT-5.6 Sol)
Change-Scope: security
Human-Approval: explicit | not-required | pending
```

### Claude Code

```text
Agent: Claude Code
Change-Scope: security
Human-Approval: explicit | not-required | pending
```

Esses trailers são rastreabilidade operacional e não equivalem a assinatura criptográfica GPG/Sigstore.

---

## 9. Regras de produção

1. produção não é ambiente de experimentação;
2. leitura de produção pode ser usada para diagnóstico quando autorizada;
3. escrita em produção deve ser avisada antes e documentada depois;
4. migrations devem ser versionadas antes da aplicação sempre que tecnicamente aplicável;
5. agente não deve ter `apply_migration` automático contra produção;
6. mudanças de RLS, grant e RPC precisam de teste negativo e positivo;
7. rollback ou forward-fix precisa estar explícito antes de mudanças críticas;
8. backup não pode ser desligado antes de existir substituto provado;
9. histórico Git com backups não deve ser reescrito antes de o novo fluxo de backup estar validado.

---

## 10. Regras entre agentes

Claude Code e ChatGPT não compartilham memória de conversa.

A sincronização oficial é:

**Git + handoff + Documento Mestre + fonte canônica.**

Nenhum agente deve assumir que o outro "sabe" algo que não esteja versionado.

Antes de qualquer merge ou escrita em produção:

- conferir `main` atual;
- conferir o handoff vivo;
- verificar se outra branch/sessão alterou o mesmo domínio;
- registrar conflito antes de continuar.

---

## 11. Regra de handoff

Handoff commitado é imutável.

Ao alterar o estado operacional da Segurança:

1. validar;
2. integrar conforme o processo;
3. criar novo `handoff_seguranca_pitwall_vN.md`;
4. atualizar o índice mestre;
5. manter este Documento Mestre como porta de entrada, sem duplicar o estado vivo em detalhe.

---

## 12. Critério de orientação para o Claude Code

Ao iniciar uma tarefa de segurança, Claude Code deve interpretar este arquivo como regra de navegação, não como autorização de escrita.

Ele deve:

1. localizar o handoff vivo pelo índice;
2. ler a fonte canônica do hardening;
3. identificar a fatia atual;
4. conferir se o pedido cabe dentro do escopo da fatia;
5. anunciar a mudança proposta antes de escrever;
6. trabalhar em branch quando aplicável;
7. testar;
8. registrar mudança aplicada;
9. gerar novo handoff quando o estado mudar.

Se o pedido conflitar com a fonte canônica, contratos ou invariantes do domínio, deve parar antes da escrita e avisar.

---

## 13. Documento já existente e confirmado

Antes da criação deste Documento Mestre, já existia e estava integrado na `main`:

`docs/seguranca/SECURITY_HARDENING_PITWALL_V1.md`

Ele foi criado como fonte canônica do processo de hardening e integrado ao repositório antes da SECURITY FATIA 0A.

Este Documento Mestre foi criado justamente para deixar explícito que essa fonte deve ser lida e respeitada por qualquer agente que opere via repo.

---

## 14. Próximo passo

O próximo passo operacional NÃO é definido por este arquivo.

Ele deve ser lido no último `handoff_seguranca_pitwall_vN.md` apontado pelo índice.

Na data de criação deste documento, o próximo bloco era continuar a SECURITY FATIA 0 com o destino privado de backup.

---

## 15. Assinatura de criação

- banco alterado: NÃO;
- produção alterada: NÃO;
- código de produto alterado: NÃO;
- finalidade: criar uma porta de entrada única para orientação de Segurança via repositório;
- assinatura: `ASSINADO-POR: ChatGPT (GPT-5.6 Sol)`.
