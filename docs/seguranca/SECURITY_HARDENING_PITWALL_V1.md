# SECURITY HARDENING — PITWALL V1

Data de criação: 15/09/2026
Status: FONTE CANÔNICA DO PROCESSO DE HARDENING
Linha: Segurança / Backend / QA
Responsável de negócio: Pitwall
Origem técnica: auditoria read-only do CRM/sistema realizada em 15/09/2026 + Documento Mestre de Checkup Completo de Segurança de Sistemas.
Criado por: ChatGPT (GPT-5.6 Sol)

---

## 1. Finalidade

Este documento define o processo oficial de endurecimento de segurança do Pitwall.

Ele existe para que ChatGPT, Claude Code e qualquer outro agente trabalhem sobre a mesma referência, com a mesma ordem de prioridade, os mesmos gates de saída e o mesmo protocolo de transparência.

Este documento NÃO substitui:

- `docs/handoffs/handoff_indice_pitwall.md`;
- o handoff vivo de cada domínio;
- `CLAUDE.md`;
- contratos específicos, como `docs/financeiro/CONTRATO.md`;
- processos específicos, como `docs/calculadora/PROCESSO.md`;
- o estado real do Git;
- o estado vivo do Supabase.

A ordem obrigatória para qualquer tarefa de segurança é:

**índice -> handoff de Segurança -> este documento -> handoff do domínio afetado -> Git real -> banco vivo, quando aplicável.**

Se houver conflito entre este plano e um contrato/invariante de domínio, a execução deve parar antes da escrita e o conflito deve ser informado explicitamente ao dono.

---

## 2. Regra central: nenhuma mudança silenciosa

A partir deste processo, nenhuma alteração de segurança deve acontecer de forma silenciosa.

Antes de qualquer escrita em código, banco, configuração, workflow ou documentação, o agente deve informar:

### MUDANÇA PROPOSTA

- objetivo;
- domínio afetado;
- arquivos que pretende alterar;
- objetos de banco que pretende alterar, se houver;
- se toca produção;
- risco principal;
- rollback previsto;
- quem executará a mudança.

Depois da execução, o agente deve informar:

### MUDANÇA APLICADA

- o que mudou de fato;
- arquivos e objetos alterados;
- branch;
- commits;
- PR/merge, quando houver;
- testes executados e resultado;
- banco/deploy afetado ou não afetado;
- risco residual;
- próximo passo;
- assinatura do agente responsável pela mudança.

É proibido esconder mudança de escopo dentro de uma tarefa maior.

Se durante uma fatia surgir a necessidade de tocar outra área, o agente deve avisar antes de ampliar o escopo.

---

## 3. Regra de assinatura e procedência

Toda mudança material do processo de segurança deve possuir procedência explícita.

### 3.1 Onde assinar

A assinatura deve existir em pelo menos dois pontos:

1. no commit, por trailer textual;
2. no novo handoff que fecha a mudança.

Formato recomendado de commit:

```text
Agent: ChatGPT (GPT-5.6 Sol)
Change-Scope: security
Human-Approval: explicit | not-required | pending
```

Para Claude Code:

```text
Agent: Claude Code
Change-Scope: security
Human-Approval: explicit | not-required | pending
```

### 3.2 O que NÃO fazer

Não inserir comentários de assinatura em arquivos de código apenas para marcar autoria.

A procedência deve ficar no Git e no handoff, não poluir o produto.

### 3.3 Natureza da assinatura

Essas assinaturas são de rastreabilidade operacional.

Elas NÃO equivalem a assinatura criptográfica GPG/Sigstore do commit. Se o projeto adotar assinatura criptográfica no futuro, ela será uma camada adicional.

---

## 4. Estado de referência da auditoria de 15/09/2026

A auditoria que originou este processo foi read-only. Nenhuma correção foi aplicada durante a auditoria.

### 4.1 Pontos positivos observados

- RLS está habilitado nas tabelas de negócio inspecionadas.
- O isolamento por tenant usa `auth.uid()`/usuário atual e não depende apenas de tenant enviado pelo frontend.
- Views sensíveis inspecionadas usam `security_invoker=true`.
- Helpers privados de autorização estão fora do acesso normal do PostgREST.
- Buckets principais de Storage observados são privados.
- O Financeiro já possui RPCs com verificações de dono mais fortes do que partes antigas do CRM.
- Existe trilha de auditoria relevante em `public.auditoria`.
- Existe workflow de restore drill e preocupação explícita com recuperação.
- Não foi encontrado `service_role` exposto no frontend/repositório durante a auditoria.

Esses pontos devem ser preservados. Hardening não é autorização para reescrever componentes que já estão corretos.

### 4.2 Riscos prioritários observados

#### P0 — Backups de produção dentro do mesmo repositório público

O repositório estava público no início deste processo e continha backups criptografados de produção versionados em `backups/`.

Mesmo criptografados, esses arquivos ficam publicamente copiáveis e permanecem no histórico Git. Se a passphrase for comprometida, snapshots históricos podem se tornar legíveis.

Direção obrigatória: parar novos backups no Git, mover o destino para storage privado separado, rotacionar a passphrase e só então planejar limpeza de histórico.

#### P1 — Autorização interna do CRM ampla demais

O isolamento entre tenants é melhor do que a separação de papéis dentro do mesmo tenant.

Foram observadas rotas/policies/RPCs onde `authenticated` consegue operar em escopo de tenant sem prova suficientemente forte de ownership/papel para venda, NF e pagamentos.

Direção obrigatória: formalizar matriz Dono x Vendedor e implementar essa matriz no banco, não apenas no frontend.

#### P1 — UPDATE direto em `lead`

`authenticated` possui capacidade ampla de UPDATE na tabela `lead`, criando caminho paralelo ao fluxo controlado do frontend/RPC.

Direção obrigatória: restringir UPDATE direto ou limitar colunas seguras, mantendo alterações sensíveis em RPCs autorizadas.

#### P1 — Endurecimento de autenticação insuficiente

No momento da auditoria não havia MFA verificado nas contas observadas e o Security Advisor sinalizava proteção contra senha vazada desativada.

Direção obrigatória: MFA para contas privilegiadas e ativação de leaked-password protection.

#### P1 — `main` e deploy sem gate forte

A `main` estava sem proteção/ruleset e o processo documentado levava commit em `main` diretamente a produção, sem staging obrigatório.

Direção obrigatória: branch/PR/CI/review/staging/gate antes de produção.

#### P1 — Agente com caminho direto para migration em produção

O repositório possui configuração MCP apontando para o Supabase de produção e permissões do Claude incluem ferramenta de migration.

Direção obrigatória: agente read-only por padrão em produção; migration deve ser preparada, revisada e aplicada por fluxo explicitamente aprovado.

#### P1 — Recuperação ainda não provada como reconstrução total

Há backup e restore drill, porém a auditoria não provou um restore completo de DB + Auth + Storage + jobs/config + frontend como uma única reconstrução operacional.

Direção obrigatória: provar recuperação em ambiente isolado.

#### P2 — Auditoria, privacidade e retenção

`public.auditoria` guarda snapshots de linhas e pode reter PII por mais tempo do que o dado operacional principal.

Direção obrigatória: matriz de eventos, retenção, minimização e acesso.

#### P2 — Consentimento

O fluxo observado pode representar consentimento como verdadeiro por default em pontos do sistema, reduzindo qualidade da evidência.

Direção obrigatória: consentimento explícito, rastreável e sem inferência silenciosa.

#### P2 — Edge Functions e integrações externas

As Edge Functions observadas usam JWT, o que é positivo, porém a autorização por papel e controles de abuso/idempotência precisam de validação específica.

#### P2 — Frontend e supply chain

Há grande superfície dinâmica no `app.js`; não foi provado XSS explorável, mas o uso deve ser testado de forma dirigida. A dependência Supabase JS estava referenciada por major version e não foi encontrado gate obrigatório de secret/dependency scanning.

---

## 5. Programa oficial de execução

O hardening será executado em fatias. Uma fatia só fecha quando o gate correspondente estiver provado.

Não criar Fatia 8 automaticamente. Depois da Fatia 7, a próxima ação é reauditoria e decisão consciente sobre novo ciclo.

---

## FATIA 0 — CONTENÇÃO

### Objetivo

Reduzir exposição imediata sem alterar regra de negócio do CRM.

### Escopo

1. interromper backup novo no Git;
2. escolher storage privado separado do repositório;
3. migrar o workflow de backup para o novo destino;
4. rotacionar a passphrase depois que o novo fluxo estiver funcionando;
5. tornar o repositório privado, quando operacionalmente possível;
6. remover `apply_migration` das permissões automáticas de agentes contra produção;
7. definir produção como read-only por padrão para agentes;
8. NÃO reescrever histórico Git antes de provar o novo backup e planejar rollback.

### Gate

- nenhum backup novo entra no Git;
- backup novo chega ao destino privado;
- restauração de amostra do novo backup funciona;
- agente não possui migration automática de produção;
- exposição pública do repositório foi eliminada ou existe exceção formal registrada.

### Rollback

Manter o workflow anterior desabilitado, não apagado, até o novo backup ser provado. Não destruir backups históricos antes da validação do novo destino.

---

## FATIA 1 — AUTORIZAÇÃO DO CRM

### Objetivo

Transformar a separação Dono x Vendedor em regra de banco verificável.

### Primeiro artefato obrigatório

Criar matriz formal de autorização antes da primeira migration.

Mínimo:

| Recurso | Dono | Vendedor |
|---|---|---|
| Lead próprio | total | permitido |
| Lead de outro vendedor | total | definir explicitamente |
| Venda própria | total | permitido |
| Venda de outro vendedor | total | restrito conforme contrato |
| Custos/margem | total | restrito |
| NF | total | conforme ownership |
| Pagamentos | total | conforme ownership |
| Financeiro | total | negado ao vendedor |
| Configuração | total | negado ao vendedor |

Nenhuma célula pode ficar implícita antes da migration.

### Ordem de revisão

1. `venda`;
2. `venda_pagamento`;
3. `venda_nf`;
4. RPCs `SECURITY DEFINER` ligadas a venda;
5. `lead` e UPDATE direto;
6. demais objetos sensíveis.

### Provas mínimas

```text
vendedor A -> objeto próprio = OK
vendedor A -> objeto de vendedor B = DENY quando não autorizado
vendedor A -> financeiro = DENY
dono -> objetos do próprio tenant = OK
tenant A -> tenant B = DENY
```

### Gate

A matriz de autorização está documentada e toda linha relevante possui teste executável verde.

---

## FATIA 2 — IDENTIDADE E SESSÃO

### Objetivo

Reduzir risco de tomada de conta.

### Escopo

- MFA obrigatório para dono/admin e contas privilegiadas;
- leaked-password protection;
- revisar recuperação de conta;
- revisar sessão/refresh;
- processo de admissão de operador;
- processo de desligamento e revogação de sessão;
- revisão de contas inativas.

### Gate

Nenhuma conta privilegiada ativa sem MFA e processo de revogação testado.

---

## FATIA 3 — GIT, CI/CD E STAGING

### Objetivo

Impedir que uma alteração não validada chegue diretamente à produção.

### Fluxo-alvo

```text
branch -> PR -> CI -> review -> merge -> staging -> produção
```

### Escopo mínimo

- proteção da `main` ou gate equivalente;
- impedir force push;
- PR antes de integração;
- checks obrigatórios;
- staging/pre-prod para mudanças relevantes;
- deploy somente após checks verdes;
- detectar migration não revisada.

### CI mínimo

- validações existentes do Pitwall;
- testes de autorização;
- testes tenant x tenant;
- secret scan;
- dependency scan;
- validação de migrations;
- `git diff --check`.

### Gate

Push direto ou release inseguro deve falhar por mecanismo técnico, não apenas por disciplina humana.

---

## FATIA 4 — BACKUP E DISASTER RECOVERY

### Objetivo

Provar que o Pitwall pode ser reconstruído.

### Escopo de reconstrução

- Postgres;
- Auth/config aplicável;
- Storage;
- Edge Functions;
- cron/jobs;
- secrets/configuração externa documentada;
- Cloudflare/deploy;
- integrações essenciais.

### Artefato obrigatório

Manifesto de recuperação com:

- componentes;
- origem do backup;
- retenção;
- RPO;
- RTO;
- passo de restore;
- responsável;
- prova mais recente.

### Gate

Ambiente isolado reconstruído e validado pela suíte operacional aplicável.

---

## FATIA 5 — OBSERVABILIDADE E AUDITORIA

### Objetivo

Garantir que ação crítica deixe rastro útil sem criar um segundo vazamento de PII.

### Eventos mínimos a revisar

- login privilegiado;
- mudança de papel;
- configuração;
- venda editada/arquivada;
- NF;
- pagamento;
- migration;
- backup;
- restore;
- ação administrativa de agente.

### Regras

- minimizar PII;
- definir retenção;
- definir quem consulta;
- diferenciar auditoria de telemetria;
- alertar padrões anômalos relevantes.

### Gate

Eventos críticos possuem rastreabilidade e retenção definida.

---

## FATIA 6 — SEGURANÇA INTEGRADA AO DESENVOLVIMENTO

### Objetivo

Impedir regressão depois do hardening.

### Escopo

- scanner de secrets;
- scanner de dependências;
- teste de autorização no CI;
- teste multi-tenant no CI;
- revisão de `SECURITY DEFINER`;
- pinning de dependências críticas;
- CSP/headers;
- revisão dirigida de XSS;
- revisão de sessão no browser;
- checklist de migration.

### Gate

Introduzir regressão de segurança conhecida deve quebrar o pipeline antes de produção.

---

## FATIA 7 — REAUDITORIA E FECHAMENTO

### Objetivo

Medir o estado final contra o mesmo critério usado no início.

### Saída

Relatório comparativo:

```text
antes -> depois
críticos restantes
altos restantes
médios restantes
riscos aceitos
riscos eliminados
provas anexadas
```

### Critério mínimo para estado "Secure Enough"

- zero crítico conhecido;
- zero alto não aceito formalmente;
- isolamento tenant comprovado;
- autorização por papel/ownership comprovada;
- contas privilegiadas com MFA;
- nenhum segredo de produção utilizável exposto;
- backup externo e restore funcional;
- trilha de auditoria suficiente;
- gate antes de produção;
- agentes sem poder irreversível automático sobre produção;
- política de minimização/retenção definida.

---

## 6. Ciclo obrigatório de cada fatia

Toda fatia deve seguir exatamente esta ordem:

```text
AUDITAR
  -> DESENHAR
  -> AVISAR MUDANÇA PROPOSTA
  -> IMPLEMENTAR EM BRANCH
  -> TESTAR
  -> REAUDITAR
  -> AVISAR MUDANÇA APLICADA
  -> MERGE
  -> NOVO HANDOFF
  -> ATUALIZAR ÍNDICE
```

Exceção só pode existir se for registrada no handoff com motivo e aprovação humana.

---

## 7. Regras de banco e produção

1. Leitura de produção pode ser usada para diagnóstico quando autorizada pelo acesso vigente.
2. Escrita em produção não deve ser o primeiro passo de desenvolvimento.
3. Migration deve existir como arquivo versionado antes de aplicação sempre que tecnicamente aplicável.
4. Agente não deve ter `apply_migration` de produção em allowlist automática.
5. Qualquer escrita direta excepcional em produção precisa ser avisada ANTES e documentada DEPOIS.
6. Toda migration de segurança precisa de rollback ou estratégia explícita de reversão/forward-fix.
7. Mudança de RLS/grant/RPC precisa de teste negativo, não apenas teste positivo.

---

## 8. Regras de documentação e handoff

- handoff commitado é imutável;
- mudança de estado cria novo handoff;
- não editar handoff antigo para "corrigir a história";
- este documento descreve o PROCESSO, não o estado corrente de uma fatia;
- o estado corrente vive no último `handoff_seguranca_pitwall_vN.md`;
- mudanças materiais neste processo devem gerar uma nova versão deste documento (`V2`, `V3`...), preservando versões anteriores;
- o índice mestre deve apontar sempre para o handoff vivo e para a versão vigente desta fonte canônica.

---

## 9. Divisão operacional entre agentes

### ChatGPT

Pode atuar em:

- auditoria independente;
- leitura Git/Supabase;
- desenho de fatia;
- revisão de autorização/RLS/RPC;
- validação pós-implementação;
- documentação e handoff;
- implementação quando explicitamente solicitada e dentro do processo de branch/gate.

### Claude Code

Pode atuar em:

- implementação local/repo;
- migrations preparadas e versionadas;
- testes;
- correções de código;
- criação de provas;
- documentação técnica.

### Regra de convergência

Nenhum agente deve confiar na memória da conversa do outro.

Git + handoff + esta fonte são o canal oficial de sincronização.

---

## 10. Próximo passo oficial

O próximo passo deste programa é:

**SECURITY FATIA 0 — CONTENÇÃO.**

Não iniciar a Fatia 1 antes de o gate mínimo da Fatia 0 estar provado, salvo decisão humana registrada.

---

## 11. Registro de origem

Criação desta fonte:

- data: 15/09/2026;
- tipo: documentação/processo;
- banco alterado: não;
- produção alterada: não;
- código de produto alterado: não;
- objetivo: tornar o plano de hardening uma referência compartilhada entre ChatGPT, Claude Code e demais agentes;
- assinatura: `ASSINADO-POR: ChatGPT (GPT-5.6 Sol)`.
