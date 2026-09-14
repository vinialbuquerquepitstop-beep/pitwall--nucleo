# Fila Operacional v2 — Fatia 0

Data de fechamento: 13/09/2026
Projeto: Pitwall
Escopo: descoberta e contrato do estado atual da Fila, aba Hoje, pós-venda e ações de CRM
Status: FECHADA

## 1. Objetivo desta fatia

Fechar o mapa do comportamento atual antes de alterar produto.

Esta fatia não muda regra, banco, frontend ou cadência. Ela documenta de onde vem cada dado, como a fila é filtrada e ordenada, quais RPCs registram fatos, onde Fila e Hoje divergem e quais provas já existem.

Baseline de código usada: `main` em `eae564b0a9231d07584bf0b170337fc30cd8cddd`.

A medição da baseline foi refeita no banco vivo em 13/09/2026 usando o mesmo recorte lógico do `public/app.js`. Nenhum dado foi alterado.

---

## 2. Mapa do fluxo atual

```text
Supabase
  public.v_lead
      ↓ select("*") ordenado por proximo_contato
public/app.js
  B()
      ↓ array local i[]
  ├─ aba Fila
  │   ├─ v() / m()            → comercial vencido
  │   ├─ cmpVer()             → ordena comercial
  │   ├─ N() / x()            → cards comerciais
  │   └─ posAnexar()
  │       └─ vPos() / mPos()  → pós-venda vencido
  │
  └─ aba Hoje
      ├─ RPC painel_do_dia()  → rotina, conteúdo, lembretes, sync e saúde da régua
      └─ hojeFila()
          └─ v()              → reutiliza SOMENTE o recorte comercial de i[]

Ações do card
  sugerir_mensagem()          → texto de abordagem
  link wa.me                  → abre WhatsApp, não grava toque
  registrar_toque()           → grava fato do toque
  registrar_resposta()        → grava resposta
  registrar_conversando()     → grava conversa
  reagendar_proximo_contato() → reagenda
  registrar_desfecho()        → sem interesse
```

---

## 3. Fonte de dados da Fila

A aplicação carrega a view `public.v_lead` diretamente:

```text
from("v_lead").select("*").order("proximo_contato")
```

`v_lead` é `security_invoker` e concentra os campos derivados que a Fila usa para decidir e explicar a ordem.

Campos relevantes já derivados no banco:

- `toques`
- `respostas`
- `toques_sem_resposta`
- `valor_em_jogo`
- `duplicata_de`
- `veredito`
- `veredito_ordem`
- `veredito_motivo`
- estado atual da cadência
- datas de toque e resposta

Nenhuma coluna persistida nova é necessária para representar esses conceitos.

### 3.1 Veredito atual

A view deriva, em ordem, estados como:

- `fora`: arquivado, lista fria, cancelado ou sem cadência ativa;
- `nao_mande`: duplicata conhecida ou consentimento ausente;
- `pare`: repetição de toques sem resposta acima dos limites definidos;
- `espere`: passo ainda não vencido;
- `prioridade`: já respondeu e ainda está em faixa de tentativa útil;
- `agora`: pós-venda vencido ou lead nunca tocado;
- `mande`: demais casos acionáveis.

A ordem derivada é:

```text
prioridade = 1
agora      = 2
mande      = 3
espere     = 4
pare       = 5
nao_mande  = 6
fora       = 9
```

O motivo também nasce na view. O frontend não deveria reconstruir essa explicação.

---

## 4. Recorte da Fila comercial

O frontend usa `m()` para decidir entrada na fila comercial.

Critério atual:

```text
status = pendente
proximo_contato <= hoje
ultimo toque não ocorreu hoje
```

Depois, `v()` ordena com `cmpVer()` por:

1. `veredito_ordem`;
2. `valor_em_jogo` decrescente;
3. `proximo_contato`;
4. `nome`.

### Limite importante

`m()` não verifica:

- WhatsApp válido;
- consentimento;
- `veredito = pare`;
- `veredito = nao_mande`.

Hoje isso não quebra a baseline porque a limpeza de 13/09 retirou os casos impossíveis da cadência ativa. Porém o contrato da fila ainda permite que um caso futuro não executável volte a entrar no recorte principal.

---

## 5. Recorte de pós-venda

O pós-venda usa outra função, `mPos()`.

Critério atual:

```text
status = convertido
lead não arquivado
cadencia_passo existe
cadência não encerrada
proximo_contato <= hoje
ultimo toque não ocorreu hoje
```

`vPos()` usa o mesmo `cmpVer()`.

Na aba Fila, o resultado NÃO é unido ao comercial antes da ordenação. O fluxo é:

```text
1. renderiza todos os comerciais ordenados
2. anexa um bloco Pós-venda
3. renderiza os pós-venda ordenados dentro desse bloco
```

Consequência: a prioridade é correta dentro de cada grupo, mas não globalmente.

Na baseline viva existe um pós-venda com `veredito_ordem = 1`. Mesmo assim, visualmente ele fica depois de todo o bloco comercial porque `posAnexar()` acontece depois de `N()`.

---

## 6. Aba Hoje

`renderHoje()` chama a RPC `painel_do_dia()`.

O contrato dessa RPC retorna:

- contagem e categorias da rotina;
- nota do dia;
- lembretes;
- conteúdo;
- estado do sync;
- estado da régua.

Ela não é a fonte dos cards da Fila de hoje.

`hojeFila()` usa o mesmo array local vindo de `v_lead`, mas aplica somente `v()`.

Portanto:

```text
Fila completa = comercial + pós-venda
Fila de hoje  = somente comercial
```

A prévia da Hoje mostra no máximo os 5 primeiros comerciais e o contador informa o total comercial.

Isso é uma divergência estrutural real entre as duas superfícies, não falha da régua.

---

## 7. Medição viva da baseline

Consulta refeita em 13/09/2026 usando o mesmo recorte lógico do browser.

Resultado:

```text
Fila comercial: 6
Pós-venda:       8
Total Fila:     14
```

Distribuição dos 14 por veredito:

```text
prioridade: 1
agora:      9
mande:      4
```

Na baseline medida:

- os 14 têm WhatsApp;
- os 14 têm consentimento verdadeiro;
- não há `pare` ativo;
- não há `nao_mande` ativo;
- nenhum item anterior a 13/09 voltou a aparecer.

Isso confirma a limpeza operacional registrada antes desta fatia e confirma que os 14 itens são reproduzidos pela leitura usada pela aplicação.

Nenhum nome, telefone ou outro dado pessoal da consulta viva foi adicionado a este documento.

---

## 8. Mensagem e WhatsApp

`sugerir_mensagem(p_lead_id)` continua sendo a fonte única da mensagem.

Fluxo observado:

1. lê o lead;
2. lê o passo ativo da cadência;
3. procura `dicionario_scripts` por `tenant_id + perfil + passo`;
4. se não houver script específico, usa o fallback `passo = 0` do perfil;
5. interpola as variáveis previstas;
6. devolve as variantes.

No frontend:

- `prefetchFilaSug()` pode buscar antecipadamente a primeira variante;
- `sugerirMensagem()` mostra todas as opções;
- o link de WhatsApp só é criado quando há telefone e `consentimento === true`;
- abrir `wa.me` não dispara RPC de escrita.

Esse comportamento deve ser preservado.

---

## 9. Registro do toque e demais desfechos

`registrar_toque(p_lead_id)`:

- grava `ultimo_toque_em = now()` no lead;
- grava `lead_evento` do tipo `toque_enviado`;
- não altera `cadencia_passo` diretamente;
- não encerra nem ressuscita cadência.

No frontend, depois do toque, o lead é relido em `v_lead`. Como `m()` e `mPos()` excluem quem já foi tocado hoje, o card sai da fila do dia.

Outras ações atuais:

```text
Respondeu     → registrar_resposta
Conversando   → registrar_conversando
Retomar       → reagendar_proximo_contato
Sem interesse → registrar_desfecho
Fechou        → fluxo de venda
```

Abrir WhatsApp e registrar toque continuam eventos distintos.

---

## 10. Relação com a régua

`fn_regua_varredura()` continua sendo o motor de decisão temporal.

Ela trabalha sobre `cadencia_estado`, regras e fatos já registrados. A Fatia 0 não encontrou evidência que justifique reescrever esse motor para construir a Fila v2.

A recomendação permanece:

```text
classificação operacional na leitura
+
registro explícito de fatos
+
motor da cadência preservado
```

---

## 11. Pontos de alteração para a Fatia 1

### Frontend

Pontos principais em `public/app.js`:

- `m()`
- `v()`
- `mPos()`
- `vPos()`
- `cmpVer()`
- `posAnexar()`
- `hojeFila()`
- `filaWaCard()`
- `prefetchFilaSug()`
- roteador de ações do card

### Banco

A Fatia 1 não apresenta, neste momento, necessidade provada de alterar:

- `fn_regua_varredura()`;
- `cadencia_perfil`;
- `cadencia_regra`;
- persistência de novo status operacional.

`v_lead` já fornece a maior parte da semântica necessária.

Mudança de banco só deve entrar se a implementação provar que a classificação segura não pode ser derivada com os fatos existentes.

---

## 12. Comportamentos que devem ser preservados

1. sensor e régua separados;
2. abrir WhatsApp não registra toque;
3. `toque_enviado` e `respondeu` são eventos distintos;
4. `sugerir_mensagem` é a única fonte de copy;
5. consentimento continua travando link de WhatsApp;
6. histórico continua append-only;
7. `v_lead` continua `security_invoker`;
8. tenant e RLS não são substituídos por filtro de frontend;
9. veredito continua derivado, não vira status persistido;
10. ação de um card continua relendo o lead e não precisa recarregar toda a base.

---

## 13. Provas e regressões existentes

### `ferramentas/harness.py`

É a maior prova integrada do frontend e contém cenários de Fila, Hoje, ações, consentimento, recarga cirúrgica e veredito.

### `ferramentas/prova_regua.js`

Cobre a costura histórica da régua, `registrar_resposta`, separação toque/resposta e sinalização da régua na Hoje.

Atenção: o arquivo ainda contém uma asserção textual da composição antiga da aba Hoje (`hojePlacar + reguaLinha + hojeFila`). O layout atual moveu a régua para o rodapé. Portanto essa prova isolada deve ser revisada antes de ser usada como gate da Fatia 1; não alterar produto para fazer o teste antigo passar.

### `ferramentas/validar.py`

Guarda contratos estruturais e de uso de tokens/abas.

### `ferramentas/diag_mobile.py`

Guarda comportamento em larguras móveis e já inclui as superfícies de CRM relevantes.

### Outras provas relacionadas

- `prova_sessao.js`
- `prova_trilho.py`
- `prova_atmosfera.py`
- `prova_grafico.py`
- `suite_veredito.py`

`suite_veredito.py` separa regressão real de corrida inconclusiva do Chrome. Essa distinção deve ser mantida ao rodar a suite durante a Fatia 1.

---

## 14. Achados que definem a Fatia 1

### A1. Fila principal não garante executabilidade por contrato

O filtro principal não exclui diretamente sem canal, sem consentimento, `pare` ou `nao_mande`.

A baseline está limpa hoje, mas o defeito pode reaparecer quando novos fatos entrarem.

### A2. Fila e Hoje usam conjuntos diferentes

Hoje omite o bloco de pós-venda da sua Fila de hoje.

Baseline medida:

```text
Fila completa: 14
Fila de hoje:   6 comerciais, com 5 visíveis na prévia
```

### A3. Prioridade não é global

Comercial e pós-venda são ordenados separadamente. Uma prioridade de pós-venda pode aparecer depois de comerciais `agora` ou `mande`.

### A4. `pare` ainda pode receber CTA se voltar ativo

O CTA do card verifica telefone e consentimento, mas não verifica `veredito = pare`.

Hoje os casos `pare` foram retirados da cadência ativa pela limpeza de 13/09, então o defeito não aparece na baseline. A classificação da Fatia 1 deve fechar o contrato, não depender da limpeza manual.

### A5. `nao_mande` é explicado pelo banco, mas não retirado da fila pelo filtro

`v_lead` já sabe que duplicata ou ausência de consentimento significa `nao_mande`. O frontend deve respeitar essa decisão operacional na classificação da fila.

---

## 15. Gate da Fatia 0

Checklist:

```text
[x] código da Fila localizado
[x] código da aba Hoje localizado
[x] origem de dados mapeada
[x] RPCs e funções envolvidas mapeadas
[x] 14 itens da baseline reproduzidos no banco vivo pelo recorte do app
[x] veredito, ordem, motivo, toques, respostas e valor em jogo rastreados até v_lead
[x] fluxo de WhatsApp identificado
[x] fluxo de toque_enviado identificado
[x] filtros que misturam estado identificados
[x] divergência Fila x Hoje comprovada
[x] pontos de alteração listados
[x] comportamentos a preservar listados
[x] provas existentes inventariadas
```

**Fatia 0 fechada.**

---

## 16. Próximo passo exato

Começar a **Fatia 1 — Classificação operacional**.

A menor mudança a investigar primeiro é uma classificação única, derivada na leitura, reutilizada por Fila e Hoje, que separe pelo menos:

```text
acionavel
aguardando
sem_canal
sem_consentimento
pare
fora
```

Antes de alterar código, escrever/ajustar prova que reprove para estes casos:

1. lead sem telefone não aparece como contato executável;
2. consentimento falso não recebe CTA;
3. `pare` não recebe CTA de abordagem;
4. Fila e Hoje aplicam a mesma regra de executabilidade;
5. pós-venda não some da visão operacional do dia;
6. a prioridade usada pela experiência é coerente com `veredito_ordem`;
7. nenhuma mudança no motor de cadência é necessária para os seis casos acima.

Somente depois dessa prova vermelha deve entrar o diff da Fatia 1.
