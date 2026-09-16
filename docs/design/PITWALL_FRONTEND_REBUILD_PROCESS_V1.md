# PITWALL — PROCESSO MESTRE DE RECONSTRUÇÃO DO FRONTEND V1

**Status:** documento canônico de processo  
**Projeto:** Pitwall / Pit Wall 2.0 — Núcleo  
**Objetivo:** reconstruir o frontend do Pitwall usando a mesma disciplina de produto validada no COMMERCIAL AI, preservando o sistema atual em produção até existir paridade funcional e segurança para o corte.  
**Data:** 2026-09-16

---

# 1. POR QUE ESTE DOCUMENTO EXISTE

O Pitwall já possui um sistema real, com operação, CRM, vendas, pós-venda, financeiro, conteúdo, captação, rotina, escopo, dashboard e ferramentas. O problema não é ausência de funcionalidades.

O problema é que o frontend cresceu organicamente dentro de uma estrutura estática e monolítica. Hoje, a aplicação de produção está concentrada principalmente em:

```text
public/
├── index.html
├── app.css
├── app.js
└── calc/
```

Essa arquitetura cumpriu seu papel e deve continuar funcionando enquanto a nova camada de produto é construída.

O objetivo deste processo não é reescrever o Pitwall por estética. É transformar o frontend em um produto estruturado, modular, versionado e expansível, sem perder a inteligência operacional acumulada.

O processo de referência é o utilizado no COMMERCIAL AI:

```text
Referência visual
↓
Design System canônico
↓
Frontend Foundation real
↓
Mocks determinísticos
↓
Tela/fatia isolada
↓
Auditoria visual e operacional
↓
Aprovação
↓
Próxima fatia
↓
Integração com dados reais
↓
Polimento
↓
Produção
```

Este documento congela esse método para que ele não seja perdido ou reinventado em sessões futuras.

---

# 2. DECISÃO CENTRAL

O novo frontend do Pitwall deve passar a usar **a mesma estrutura de engenharia do COMMERCIAL AI**, mas não os mesmos componentes de domínio.

Isto significa que os projetos poderão ser considerados irmãos tecnicamente:

```text
mesma disciplina de branches
mesma separação foundation / features / data
mesma lógica de design system
mesma construção por fatias
mesma estratégia de mocks antes do backend
mesma ideia de aprovação por superfície
mesma documentação de handoff
mesma separação entre shell e domínio
mesma lógica de evolução controlada
```

Mas continuam sendo produtos diferentes.

COMMERCIAL AI trabalha com objetos como:

```text
Mission
Commercial Run
Commercial Score
Signals
Human Review
Commercial Intelligence
```

Pitwall trabalha com objetos como:

```text
Lead
Fila
Follow-up
Venda
Cliente
Upgrade
Pitscare
Financeiro
Conteúdo
Captação
Rotina
Calculadora
```

Portanto:

> replicar a arquitetura, não copiar o produto.

---

# 3. REGRA DE OURO — O PITWALL ATUAL NÃO É DESCARTADO

O sistema atual deve ser tratado como:

```text
PITWALL LEGACY / PRODUÇÃO ATUAL
```

Enquanto o novo frontend estiver sendo criado:

- `public/` continua servindo a produção atual;
- o Cloudflare continua apontando para a aplicação existente;
- nenhuma mudança estrutural do novo frontend deve quebrar a operação atual;
- o novo frontend deve nascer paralelamente;
- o corte só acontece depois de paridade funcional, testes e plano de rollback.

Não migrar tela por tela diretamente dentro do monólito atual.

Não tentar transformar `app.js`, `app.css` e `index.html` progressivamente em React.

A estratégia correta é **strangler / reconstrução paralela**:

```text
Pitwall atual funcionando
        │
        ├──────── produção real
        │
        └──────── novo frontend sendo construído
                         │
                         ↓
                  paridade validada
                         │
                         ↓
                     cutover
```

---

# 4. FONTE DE VERDADE

A ordem de autoridade do novo frontend deve ser explícita.

## Durante exploração visual

```text
1. Documento de arquitetura de produto
2. Design System Matrix
3. referência aprovada no Stitch
4. implementação Next.js
```

## Depois da Foundation aprovada

```text
1. GitHub
2. Design System Matrix
3. tokens
4. componentes reutilizáveis
5. documentação
6. Stitch como referência/exploração
```

O Stitch não deve permanecer como fonte canônica depois da implementação.

O código real e o Design System passam a mandar.

---

# 5. ESTRUTURA-ALVO DO NOVO FRONTEND

Estrutura conceitual:

```text
pitwall--nucleo/
│
├── public/                         # produção atual / legacy
│   ├── index.html
│   ├── app.css
│   ├── app.js
│   └── calc/
│
├── frontend/                       # novo Pitwall
│   ├── app/
│   │   ├── page.tsx
│   │   ├── operation/
│   │   ├── crm/
│   │   ├── sales/
│   │   ├── pitscare/
│   │   ├── growth/
│   │   ├── management/
│   │   └── tools/
│   │
│   ├── components/
│   │   ├── shell/
│   │   ├── ui/
│   │   ├── operation/
│   │   ├── crm/
│   │   ├── sales/
│   │   ├── pitscare/
│   │   ├── growth/
│   │   └── finance/
│   │
│   ├── data/
│   │   └── mocks/
│   │
│   ├── lib/
│   ├── styles/
│   │   ├── tokens.css
│   │   └── ...
│   └── package.json
│
├── supabase/
├── ferramentas/
└── docs/
    └── design/
```

A localização física definitiva pode ser ajustada quando a Foundation for iniciada, mas a separação conceitual é obrigatória.

---

# 6. CAMADAS DO FRONTEND

O frontend deve ser organizado em quatro níveis.

## 6.1 Foundation

Elementos independentes do domínio:

```text
Tokens
Typography
Spacing
Grid
AppShell
Sidebar
Topbar
PageHeader
Button
Input
Select
Search
Table primitives
Metric primitives
Status primitives
Drawer
Modal
Toast
Empty State
Loading State
Error State
```

## 6.2 Componentes de domínio

Componentes que conhecem conceitos do Pitwall:

```text
LeadRow
LeadSummary
FollowUpState
QueueItem
SaleSummary
CustomerTimeline
PitscareStatus
FinanceMetric
ContentTask
CaptureSource
```

## 6.3 Features / superfícies

Páginas e fluxos completos:

```text
Hoje
Fila
Todos / Leads
Vendas
Clientes
Pitscare
Captação
Conteúdo
Financeiro
Dashboard
Calculadora
```

## 6.4 Data layer

A tela nunca deve depender diretamente de detalhes do backend em todos os pontos.

Criar uma camada que permita trocar:

```text
mock
↓
adapter
↓
Supabase real
```

sem redesenhar o componente visual.

---

# 7. O DESIGN SYSTEM MATRIX

Antes da implementação real, deve existir:

```text
docs/design/PITWALL_DESIGN_SYSTEM_MATRIX_V1.md
```

Esse documento será o equivalente funcional ao Design System do COMMERCIAL AI.

Deve definir, no mínimo:

- identidade de produto;
- princípios visuais;
- cores e tokens;
- tipografia;
- grid;
- sidebar;
- topbar;
- densidade;
- hierarquia;
- estados;
- tabelas;
- métricas;
- formulários;
- feedback;
- overlays;
- responsividade;
- comportamento mobile;
- linguagem de status;
- componentes aprovados;
- padrões proibidos;
- regras de reutilização.

A regra principal é:

> nenhuma nova tela cria uma nova linguagem visual se um primitive já aprovado resolver o problema.

---

# 8. A MATRIZ DE PRODUTO DO PITWALL

O Pitwall não deve parecer uma coleção de miniaplicativos dentro de uma sidebar.

Ele precisa ser compreendido como um sistema operacional da Pitstop.

A cadeia central proposta é:

```text
Entrada
→ Prioridade
→ Ação
→ Conversão
→ Relacionamento
→ Gestão
→ Aprendizado
```

Mapeamento inicial:

```text
ENTRADA
Captação
Leads
Indicações

PRIORIDADE
Hoje
Fila
Pendências

AÇÃO
Atendimento
Follow-up
Tarefas

CONVERSÃO
Venda
Upgrade
Nota fiscal

RELACIONAMENTO
Clientes
Pitscare

OPERAÇÃO
Conteúdo
Rotina
Escopo

GESTÃO
Dashboard
Financeiro

FERRAMENTAS
Calculadora
```

Essa matriz pode evoluir durante a fase de arquitetura, mas deve existir antes da Foundation final.

---

# 9. A PRIMEIRA TELA MATRIZ

O primeiro produto visual do novo Pitwall não deve ser uma reconstrução aleatória de todas as telas.

A primeira superfície deve ser:

```text
HOJE / PITWALL COMMAND CENTER
```

Ela será a equivalente do Overview no COMMERCIAL AI.

Deve provar:

- linguagem visual;
- shell;
- sidebar;
- topbar;
- hierarquia;
- densidade;
- métricas;
- ações prioritárias;
- informação operacional;
- estados;
- comportamento de tabelas/listas;
- como IA/inteligência futura poderá aparecer sem tomar controle da operação.

A Foundation não será considerada aprovada até essa tela funcionar como matriz do sistema.

---

# 10. PAPEL DO STITCH

O Google Stitch deve ser usado para:

- exploração visual;
- composição;
- testar hierarquia;
- comparar alternativas;
- fechar uma tela matriz;
- servir de referência de fidelidade.

O Stitch não deve ser usado para:

- gerar a aplicação inteira em uma tacada;
- definir arquitetura de dados;
- definir backend;
- substituir componentes canônicos;
- manter-se como fonte de verdade depois do código real.

Fluxo correto:

```text
produto definido
↓
prompt estruturado no Stitch
↓
tela matriz
↓
auditoria
↓
aprovação
↓
extração de regras
↓
Design System Matrix
↓
implementação real
```

---

# 11. MOCKS ANTES DO BACKEND

Durante a construção de cada nova superfície, usar dados mockados e determinísticos.

Objetivos:

1. avaliar UX sem depender do banco;
2. permitir reprodução visual consistente;
3. testar diferentes estados;
4. impedir que problemas de integração sejam confundidos com problemas de design;
5. acelerar auditoria.

Exemplos de estados que devem existir nos mocks:

```text
normal
vazio
loading
erro
urgente
atrasado
concluído
sem permissão
registro incompleto
```

Só depois da aprovação da superfície o adapter real do Supabase deve ser ligado.

---

# 12. ESTRATÉGIA DE BRANCHES

Seguir o mesmo padrão do COMMERCIAL AI.

Sequência inicial recomendada:

```text
frontend/foundation-v1
frontend/operation-v1
frontend/crm-v1
frontend/sales-v1
frontend/pitscare-v1
frontend/growth-v1
frontend/management-v1
frontend/tools-v1
frontend/integration-v1
frontend/final-polish-v1
```

Cada branch representa uma fatia clara.

Não desenvolver três grandes domínios simultaneamente na mesma branch.

Não usar `main` como área de experimentação.

---

# 13. SEQUÊNCIA DE IMPLEMENTAÇÃO

## Fase 0 — congelar entendimento

Criar e aprovar:

```text
PITWALL_PRODUCT_UI_ARCHITECTURE_V1.md
PITWALL_DESIGN_SYSTEM_MATRIX_V1.md
PITWALL_FRONTEND_REBUILD_PROCESS_V1.md
```

Resultado: todos os agentes e operadores sabem o que está sendo construído.

---

## Fase 1 — Foundation V1

Branch:

```text
frontend/foundation-v1
```

Construir:

```text
tokens
AppShell
Sidebar
Topbar
PageHeader
navegação base
UI primitives
Hoje / Command Center com mocks
```

Não integrar tudo ao Supabase.

Gate:

> a tela matriz está visual, estrutural e operacionalmente aprovada?

Se não, a Foundation não avança.

---

## Fase 2 — Operation V1

Branch:

```text
frontend/operation-v1
```

Escopo:

```text
Hoje
Fila
prioridades
pendências
follow-ups
ações rápidas
```

Objetivo:

> provar que o núcleo operacional diário funciona melhor que no frontend legado.

---

## Fase 3 — CRM V1

Branch:

```text
frontend/crm-v1
```

Escopo:

```text
Todos / Leads
busca
filtros
Lead Detail
histórico
follow-up
origem
status
```

A interface deve ser desenhada a partir da operação real, não como CRM genérico.

---

## Fase 4 — Sales V1

Branch:

```text
frontend/sales-v1
```

Escopo:

```text
Vendas
Clientes
Upgrade
Notas fiscais
histórico de conversão
```

---

## Fase 5 — Pitscare V1

Branch:

```text
frontend/pitscare-v1
```

Escopo:

```text
pós-venda
clientes ativos
pendências
garantia
alertas
relacionamento
```

---

## Fase 6 — Growth V1

Branch:

```text
frontend/growth-v1
```

Escopo:

```text
Captação
Indicações
Conteúdo
Rotina
Escopo
```

---

## Fase 7 — Management V1

Branch:

```text
frontend/management-v1
```

Escopo:

```text
Dashboard
Financeiro
visões de gestão
```

Resultado e caixa continuam semanticamente separados.

---

## Fase 8 — Tools V1

Branch:

```text
frontend/tools-v1
```

Escopo:

```text
Calculadora
outras ferramentas operacionais
```

A calculadora pode ter arquitetura própria internamente, mas deve parecer parte do mesmo produto.

---

## Fase 9 — Integration V1

Branch:

```text
frontend/integration-v1
```

Agora ligar interfaces aprovadas aos contratos reais do backend.

Processo por feature:

```text
mock aprovado
↓
contrato de dados
↓
adapter
↓
Supabase
↓
teste
↓
comparação com legado
```

---

## Fase 10 — Final Polish V1

Branch:

```text
frontend/final-polish-v1
```

Revisar:

- consistência;
- responsividade;
- textos;
- loading;
- vazios;
- erros;
- acessibilidade;
- atalhos;
- densidade;
- microinterações;
- performance;
- comportamento mobile;
- observabilidade;
- permissões.

Nenhuma nova arquitetura estrutural deveria nascer aqui.

---

# 14. GATE DE APROVAÇÃO DE CADA FATIA

Uma fatia só termina quando passar pelos cinco gates abaixo.

## Gate A — Produto

```text
A tela responde a uma necessidade real?
O operador entende o que fazer?
Existe informação desnecessária?
Existe informação essencial ausente?
```

## Gate B — Visual

```text
Segue o Design System Matrix?
Reutiliza primitives existentes?
Hierarquia está clara?
Não parece um template genérico?
```

## Gate C — UX

```text
Fluxo é intuitivo?
A próxima ação é clara?
Erros e vazios estão previstos?
Mobile funciona?
```

## Gate D — Engenharia

```text
componentes estão separados?
tipos estão definidos?
build passa?
typecheck passa?
não existem dependências improvisadas?
```

## Gate E — Segurança e dados

Quando houver backend real:

```text
autenticação validada
autorização servidor-side
RLS preservada
sem secrets no frontend
sem tenant confiado pelo cliente
logs adequados
rollback possível
```

---

# 15. REGRA DE CONGELAMENTO

Depois que uma superfície for aprovada:

> ela não deve ser redesenhada casualmente durante a construção da próxima.

Isso não proíbe evolução futura.

Impede apenas retrabalho contínuo sem justificativa.

Exemplo:

```text
Foundation aprovada
↓
Hoje aprovado
↓
construir CRM
```

Durante CRM, não reabrir Hoje porque surgiu uma nova preferência estética.

Reabrir somente se:

- houver problema real de usabilidade;
- surgir conflito estrutural;
- houver nova regra de produto;
- um primitive precisar ser corrigido globalmente.

---

# 16. HANDOFF OBRIGATÓRIO

Toda fase relevante deve terminar com `handoff.md` ou documento equivalente contendo:

```text
branch atual
último commit relevante
estado do projeto
telas aprovadas
telas em andamento
decisões congeladas
arquivos centrais
mock utilizado
backend ligado ou não
problemas conhecidos
próxima fatia
primeira ação da próxima sessão
regras de não-regressão
```

Objetivo:

> qualquer nova sessão ou agente deve conseguir continuar sem reconstruir mentalmente o projeto.

---

# 17. PAPEL DOS AGENTES DE CÓDIGO

Claude Code, Codex, Antigravity ou outros agentes podem executar trabalho dentro da estrutura definida.

Eles não devem redefinir autonomamente:

- arquitetura principal;
- linguagem visual;
- modelo de domínio;
- contratos críticos;
- regras de permissão;
- estratégia de deploy.

Fluxo ideal:

```text
Documento canônico
↓
branch específica
↓
agente implementa
↓
typecheck / build / testes
↓
auditoria
↓
aprovação humana
↓
merge
```

---

# 18. O QUE NÃO FAZER

Evitar explicitamente:

```text
reescrever tudo de uma vez
migrar produção enquanto o design ainda muda
usar main para experimentação
criar um design novo por tela
gerar aplicação inteira no Stitch e aceitar como arquitetura
misturar mock e Supabase no mesmo componente sem adapter
criar componentes duplicados para problemas iguais
transformar o Design System em documento decorativo
refazer telas já aprovadas a cada nova sessão
ligar backend antes de saber se a superfície está correta
substituir produção sem paridade e rollback
```

---

# 19. PARIDADE COM O LEGADO

Antes do corte, criar uma matriz de paridade.

Exemplo:

| Capacidade | Legacy | Novo | Validado |
|---|---|---|---|
| Login | sim | sim | pendente |
| Hoje | sim | sim | pendente |
| Fila | sim | sim | pendente |
| Leads | sim | sim | pendente |
| Vendas | sim | sim | pendente |
| Clientes | sim | sim | pendente |
| Pitscare | sim | sim | pendente |
| Financeiro | sim | sim | pendente |
| Conteúdo | sim | sim | pendente |
| Calculadora | sim | sim | pendente |

Uma funcionalidade só pode ser considerada migrada se o comportamento de negócio também estiver preservado.

Não basta existir visualmente.

---

# 20. CUTOVER

O corte do frontend legado para o novo Pitwall deve ser uma fase própria.

Pré-condições:

```text
[ ] paridade funcional validada
[ ] dados reais testados
[ ] login validado
[ ] permissões validadas
[ ] RLS testada
[ ] build reproduzível
[ ] staging/preview disponível
[ ] backup válido
[ ] rollback documentado
[ ] monitoramento disponível
[ ] operador testou fluxos principais
```

Procedimento conceitual:

```text
1. congelar mudanças no legado
2. registrar versão de rollback
3. validar backend
4. validar build novo
5. executar smoke tests
6. trocar destino de produção
7. validar de fora
8. acompanhar erros
9. manter rollback disponível
```

Nunca confundir:

```text
merge realizado
```

com:

```text
produção validada
```

---

# 21. COMO PITWALL E COMMERCIAL AI PASSAM A SE RELACIONAR

Os dois projetos devem compartilhar um **padrão interno de construção de produto**.

```text
PRODUCT SYSTEM
│
├── Product Architecture
├── Design System
├── Foundation
├── App Shell
├── UI Primitives
├── Domain Components
├── Features
├── Mock Data
├── Data Adapters
├── Backend Integration
├── Validation
└── Deployment
```

Isso permite que novos sistemas também adotem a mesma matriz.

A longo prazo, Pitwall, Commercial AI, Tree e outros produtos podem ter convenções equivalentes sem compartilhar regras de negócio.

O ganho não é apenas visual.

É operacional:

- agentes entendem projetos mais rápido;
- handoffs ficam previsíveis;
- branches seguem padrão;
- componentes têm papéis claros;
- backend é conectado depois de superfícies aprovadas;
- erros de produto são separados de erros de integração;
- decisões deixam de depender da memória de uma sessão.

---

# 22. ARQUIVOS CANÔNICOS A CRIAR

Este documento é o primeiro dos três principais.

Estrutura recomendada:

```text
docs/design/
├── PITWALL_FRONTEND_REBUILD_PROCESS_V1.md
├── PITWALL_PRODUCT_UI_ARCHITECTURE_V1.md
└── PITWALL_DESIGN_SYSTEM_MATRIX_V1.md
```

Depois deles:

```text
frontend/foundation-v1
```

pode ser iniciado.

---

# 23. ORDEM IMEDIATA DE EXECUÇÃO

A partir deste documento:

```text
PASSO 1
Mapear arquitetura de produto do Pitwall.

PASSO 2
Definir a matriz de navegação e domínios.

PASSO 3
Criar PITWALL_PRODUCT_UI_ARCHITECTURE_V1.md.

PASSO 4
Criar PITWALL_DESIGN_SYSTEM_MATRIX_V1.md.

PASSO 5
Criar prompt mestre para a tela Hoje / Command Center no Stitch.

PASSO 6
Explorar e aprovar a tela matriz.

PASSO 7
Criar frontend/foundation-v1.

PASSO 8
Implementar Foundation + Hoje com mocks.

PASSO 9
Auditar.

PASSO 10
Congelar Foundation V1 e iniciar operation-v1.
```

---

# 24. DEFINITION OF DONE — RECONSTRUÇÃO DO FRONTEND

A reconstrução só pode ser considerada concluída quando:

```text
[ ] existe Design System canônico
[ ] existe arquitetura de produto documentada
[ ] shell é reutilizável
[ ] domínio está separado de primitives
[ ] principais superfícies foram reconstruídas
[ ] mocks foram substituídos por adapters reais onde necessário
[ ] existe paridade funcional com o legado
[ ] autenticação e autorização foram validadas
[ ] comportamento multi-tenant foi preservado
[ ] erros/loading/vazios estão tratados
[ ] responsividade está validada
[ ] operação real foi testada
[ ] staging/preview existe
[ ] rollback foi documentado
[ ] novo frontend está em produção
[ ] legado pode ser congelado/arquivado sem perda operacional
```

---

# 25. VEREDITO DO PROCESSO

O Pitwall não deve ser reconstruído como uma sequência de telas independentes.

Ele deve ser reconstruído como um produto.

O método oficial passa a ser:

```text
entender
↓
documentar
↓
desenhar sistema
↓
provar uma tela matriz
↓
criar foundation
↓
construir uma fatia por vez
↓
aprovar
↓
congelar
↓
integrar dados
↓
validar paridade
↓
fazer o corte
```

A regra que protege todo o projeto é:

> **o frontend novo nasce ao lado do Pitwall atual; a produção existente só é substituída quando o produto novo estiver estruturalmente aprovado, funcionalmente equivalente e operacionalmente seguro.**

---

# RESUMO DE UMA LINHA

**Pitwall adotará a mesma matriz de engenharia de frontend do COMMERCIAL AI — Design System → Foundation → fatias por branch → mocks → aprovação → integração real — preservando o frontend legado em produção até um cutover controlado.**
