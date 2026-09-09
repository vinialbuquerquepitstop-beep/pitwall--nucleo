# Handoff — Calculadora como produto, v2

Data: 08/09/2026. Linha `calculadora`. Este e o topo dela, e substitui o v1.

Escrito para uma sessao de terminal continuar do zero, sem contexto anterior.
Tudo abaixo foi **medido nesta sessao**, nao herdado de documento.

Nota de linguagem: prosa sem acento, sem cedilha, sem travessao (convencao do
`CLAUDE.md`). Valores reais do sistema aparecem exatos.

---

## 0. Leia nesta ordem, antes de tocar em qualquer coisa

1. `CLAUDE.md` (arranque de toda sessao).
2. **`docs/calculadora/PROCESSO.md`** — o guia de PROCESSO desta linha, criado em
   08/09/2026: como conduzir um bloco do arranque ao fechamento, quem faz o que,
   o que fazer quando um subagente trava, como perguntar ao dono, o checklist de
   fechamento e o que NAO fazer. Ele nao repete fato de dominio, de proposito.
3. `docs/runbook-operacao.md` — como nao atropelar outra sessao, o remote real,
   as armadilhas de Git Bash no Windows, EXIT CODE.
4. `docs/superpowers/specs/2026-09-05-calculadora-produto-design.md` — o desenho.
   Se o plano divergir dele, **a spec ganha** e voce avisa.
5. `docs/superpowers/plans/2026-09-05-calculadora-produto.md` — o plano, bloco a
   bloco. Os Blocos 0 e 1 ja tem secao `FECHADO` com o portao medido.
6. So entao a skill `calculadoras` e os 4 `references/` dela.

---

## 1. O pedido do dono, e a decisao que ele tomou contra o conselho

Pedido literal: **transformar a calculadora em sistema comercializavel, com outro
lojista usando sem dificuldade**, alimentando a propria tabela com os proprios
fornecedores a partir do export do chat, do mesmo jeito que ele faz hoje.

Isso **rompe o invariante 17** (nao construir superficie de SaaS antes do primeiro
pagamento). Foi apontado, e ele decidiu seguir. Registrado como escolha
consciente, com o custo assumido. Nao reabrir a discussao a cada sessao.

**O que ele NAO assumiu** (07/09/2026): *"nao assumi atualizar nenhum catalogo
base. quem vai atualizar e o cliente."* Nao existe catalogo mantido pelo dono do
produto. Existe uma **semente**, copiada uma vez no nascimento da conta; dali em
diante o catalogo e do cliente. E a decisao **D5**, e desde 08/09 ela nao e mais
so texto: esta no schema e provada com JWT.

---

## 2. Decisoes fechadas (nao perguntar de novo)

| # | Pergunta | Resposta |
|---|---|---|
| D1 | Os 341 produtos do tenant `...0004` servem de historico? | **Nao.** Ja apagados |
| D2 | O que e vendido? | **O conjunto** (Pit Wall com a calc). A calc vira produto separado DEPOIS |
| D3 | Descarte configuravel por tenant? | **Sim.** O padrao do dono foi escolhido por ele em 08/09, regra a regra (secao 4) |
| D4 | `Acessório` e margem | **Margem propria** (`aav`/`apc`) e **entra no consultor** |
| — | Assentos | **Time completo incluso.** Acesso so por login |
| — | Cota de modelo | **3.000 linhas/mes + 3.000 de abertura** |
| D5 | Quem atualiza o catalogo? | **O CLIENTE.** So semente no nascimento, invisivel em execucao |

### Unica decisao ABERTA

**D4a — comissao de `Acessório` na escada do consultor.** A escada
`config.comissao` so tem os ramos `lacrado` e `seminovo`, por nivel (Embaixador /
C1 / C2 / C3). **Nao inventar numero: ele paga comissao real ao Brendon.** Trava so
o passo 3.3, dentro do Bloco 3. **Nao trava o Bloco 2**, que e o proximo.

---

## 3. BLOCO 1 FECHADO em 08/09/2026

Commit `9327c30`. **Tres migrations**, aplicadas pelo subagente `base`:
`calc_catalogo_duas_camadas`, `calc_catalogo_semente`,
`calc_catalogo_tenant_pitstop`.

O catalogo saiu de `.claude/skills/calculadoras/references/formato-dados.md`
(onde so o Claude lia) e virou tabela. O dono abre `/calc/`, clica em
**CATÁLOGO**, e ve o que o sistema sabe ler das listas.

### As cinco tabelas, e as duas camadas

| Tabela | Semente (`tenant_id` null) | Tenant `...0001` |
|---|---|---|
| `calc_modelo` | 124 | 124 |
| `calc_cor` | 32 | 32 |
| `calc_alias` | 27 | 48 |
| `calc_regra` | 20 | 20 |
| `calc_fornecedor` | **0** | 17 |

**Fornecedor e praca nunca entram na semente**: sao ativo do dono, e o vazamento
de 14 dos 17 pela linha orfa do tenant `...0004` era essa falha ja armada. O
`0/17` e o numero que prova que fechou.

**Nenhuma policy faz `or tenant_id is null`.** A semente e invisivel em execucao
de proposito: se vazasse, o dono do produto herdaria por acidente a obrigacao de
mante-la, que e exatamente o que ele recusou em D5.

### Portao do Bloco 1, medido

```sql
select
 (select count(*) from public.calc_fornecedor where tenant_id='00000000-0000-0000-0000-000000000001') as fornecedores,
 (select count(*) from public.calc_modelo     where tenant_id='00000000-0000-0000-0000-000000000001') as modelos,
 (select count(distinct p->>'n') from public.calc_dados d, jsonb_array_elements(d.dados->'produtos') p
   where d.tenant_id='00000000-0000-0000-0000-000000000001') as modelos_no_blob;
```
Medido: **17, 124, 118**. Mais `modelo_sem_catalogo=0`, `cor_sem_catalogo=0`,
fornecedor e praca com **zero divergencia** contra o blob (acento e travessao
inclusos), e `fk_proibida=0` (restricao global 10).

### Isolamento, PROVADO com JWT (nao lido)

| Quem | Consulta | Resultado |
|---|---|---|
| `dono` do `...0001` | `count(*) from calc_modelo where tenant_id is null` | **0** (criterio 1b da spec) |
| `dono` | `count(*) from calc_fornecedor` | **17** |
| `vendedor` do mesmo tenant | `count(*) from calc_fornecedor` | **0** |
| uid fora de `app_usuario` | `count(*) from calc_modelo` | **0** |

Advisors de seguranca: os **3 WARN da baseline** (`registrar_venda`, `remover_nf`,
leaked password protection). Zero achado novo.

### A ordem de condicao virou COLUNA

`calc_regra.prioridade`: **CPO 10, Lacrado 20, Seminovo 30**. Em 27/07/2026 a
ordem errada gerou 341 produtos com **zero CPO**, com CPO farto nas listas. Agora
e dado, nao ordem de insercao.

---

## 4. O padrao de descarte, escolhido pelo dono em 08/09/2026

Por D3 o descarte e configuravel. Ele escolheu regra a regra, com o efeito de
cada uma na mesa. **14 regras ligadas, 6 desligadas.**

| Regra | Estado | Por que |
|---|---|---|
| aparelho com `mensagem`, `msg`, `aviso`, `peça não genuína` | **LIGADA** | decisao dele de 27/07/2026, segue valendo |
| `caixa aberta`, `lacre rompido`, `deslacrado`, `c/caixa` | **LIGADA** | ele **reconsiderou** depois de ver o efeito (abaixo) |
| `a vista`, `só hoje`, `unidades` | **LIGADA** (vira pendencia) | a calc nao tem onde guardar condicao |
| paralelo: `1ª linha`, `réplica`, `similar`, `genérico`, preco em dolar | **DESLIGADA** | a regra de 27/07 foi **superada em 15/08**, quando `1ª Linha` virou categoria propria e ele passou a querer o custo do paralelo a mao |
| Android: `poco`, `xiaomi`, `redmi`, `samsung`, `galaxy`, `motorola` | **DESLIGADA** | sem a regra a linha vira **pendencia, nunca preco**. Custo aceito: cerca de 6 pendencias por carga, medido em 17/08/2026 |

**A reconsideracao vale registro**, porque e o unico caso em que o conselho mudou
a decisao: ele desligou `condicao pendurada` na primeira passada. Foi apontado que
essa e a unica das quatro que gera **preco errado**, e nao so pendencia a mais:
`caixa aberta` nao impede o modelo de casar, entao o aparelho entra como preco
normal e, sendo o mais barato, vira o menor custo e puxa a venda para baixo. Ele
religou como descarte. As outras duas ficam desligadas por decisao dele, e ele
liga na tela quando quiser, sem migration.

---

## 5. Dois defeitos que a execucao achou, e nenhum plano via

### 5.1 `calc()` sem espaco em volta do `+` e CSS invalido

`calc(env(safe-area-inset-bottom,0px)+80px)` **nao e uma expressao valida**: a
especificacao exige whitespace em volta de `+` e `-`, e o Chrome **descarta a
declaracao inteira**. Isolado em 08/09/2026 com quatro variantes no mesmo
documento:

```
calc(env(safe-area-inset-bottom,0px)+80px)     -> 0px    (invalida, descartada)
calc(env(safe-area-inset-bottom, 0px) + 80px)  -> 80px   (certa)
calc(0px+80px)                                 -> 0px
calc(0px + 80px)                               -> 80px
```

Efeito, e ele estava no ar **desde sempre**: o `padding-bottom` do `body` das
**duas** calcs (dono e consultor) resolvia para **0px**, entao a barra fixa de
64px cobria o fim do conteudo em todas as abas. **4 ocorrencias corrigidas** (2 no
`body`, 2 no `.toast`).

Regra que fica: `calc()` com `+` ou `-` colado e defeito silencioso, nao estilo.
Os do `app.css` ja usam espaco e estao certos.

### 5.2 Nenhuma ferramenta olhava para a calc

`diag_mobile.py` e `diag_largo.py` medem `public/index.html`, reusando o stub do
`harness.py`. **A calc nunca foi medida por ferramenta nenhuma.** A barra de abas
saiu de CINCO para SEIS colunas com a suite inteira em EXIT 0.

`ferramentas/diag_calc.py` fecha o buraco, e na primeira corrida achou o defeito
que a mudanca introduzia: `📚CATÁLOGO` pedindo **63px numa coluna de 60px** em
360px. Consertado com media query em `max-width:400px` (respiro e tracking
apertados so na tela estreita), nao encurtando o rotulo, que e a palavra certa.

Duas armadilhas que a ferramenta ja carrega documentadas: o headless do Chrome no
Windows tem piso de ~500px de largura (por isso a pagina roda em IFRAME e o script
ABORTA se `innerWidth` divergir), e o `<script src>` do CDN **sai da copia
medida**, senao o Chrome fica pendurado esperando a rede (medido: passou de 180s
sem devolver nada).

---

## 6. Estado vivo, medido em 08/09/2026

### Banco (projeto `unjzpyexgtbcmjfgcqrx`)

```sql
select
  (select count(*) from public.calc_dados) as calc_linhas,
  (select jsonb_array_length(dados->'produtos') from public.calc_dados
     where tenant_id='00000000-0000-0000-0000-000000000001') as produtos,
  (select count(*) from public.tenant) as tenants,
  (select count(*) from public.calc_modelo) as modelos_nas_duas_camadas,
  (select count(*) from public.calc_fornecedor) as fornecedores;
```
Esperado hoje: **1, 494, 1, 248, 17**. Mais 1007 precos no blob.

### Frontend

Suite em EXIT 0 nos **onze** comandos. `harness`: **1114 passou, 0 falhou**
(1119 declaradas, 1114 executadas, 5 de ramo alternativo, previstas).

```
python ferramentas/validar.py
python ferramentas/harness.py
python ferramentas/prova_trilho.py
python ferramentas/prova_grafico.py
python ferramentas/prova_atmosfera.py
python ferramentas/prova_taxas.py
node --check public/app.js
node ferramentas/prova_cpo.js
node ferramentas/prova_sem_margem.js
node ferramentas/prova_catalogo.js          <- NOVA, 50 assercoes
for w in 360 390 414 1280 1440; do python ferramentas/diag_mobile.py $w; done
for w in 1500 1920 2560; do python ferramentas/diag_largo.py $w; done
for w in 360 390 414; do python ferramentas/diag_calc.py $w; done   <- NOVA
```

**Conferir o EXIT CODE, nunca o texto da saida.**

### Git

Commit `9327c30` **feito, mas NAO empurrado**: o push foi negado pelo classifier
desta sessao. O remote real e **`github`** (`origin` e proxy morto). Comando:

```
git push github HEAD:main
```

Enquanto nao empurrar, **o banco esta a frente do app publicado**: as tabelas
existem e a Cloudflare ainda serve a calc sem a aba Catalogo.

---

## 7. Proximo passo: BLOCO 2, a tela `Alimentar`

**Nao ha bloqueador.** D4a nao trava este bloco.

E o bloco que muda o produto: no fim dele a Pitstop Imports atualiza o proprio
preco **sem abrir sessao de IA**. Hoje o unico caminho de escrita em `calc_dados`
e MCP ou SQL Editor.

| Etapa | Entrega |
|---|---|
| 2.1 | `calc_carga`, `calc_pendencia`, `calc_uso` |
| 2.2 | 3 RPCs: `calc_carga_abrir`, `calc_pendencia_resolver`, `calc_carga_aprovar` |
| 2.3 | a tela `/calc/alimentar` |

### O que o Bloco 1 ja resolveu para o Bloco 2

- **O parse ja tem contra o que casar**: 124 modelos, 32 cores, 48 apelidos e 20
  regras, todos no tenant, todos legiveis por `select` simples (a RLS filtra
  sozinha, nao se passa `tenant_id` no cliente).
- **A ordem de condicao ja e dado** (`prioridade`), entao o parser le a regra em
  vez de carregar a ordem no codigo.
- **Nao ha resolucao de sobreposicao a implementar.** O plano previa regra do
  tenant sobrepondo a global de mesmo `padrao`; com D5 nao ha global viva, so a
  linha do tenant. Isso **simplifica** o 2.2.
- **O painel `Catalogo` ja e o lugar dos interruptores.** Ele nasceu so leitura
  (escrita so por RPC). Ligar e desligar regra entra junto com
  `calc_pendencia_resolver`, na mesma superficie que ja mostra `ativo`.

### Duas travas deste bloco

1. **Linha nao entendida nunca vira preco.** Duvidoso e nao reconhecido nao entram
   no blob, em circunstancia nenhuma.
2. **Nada e gravado sem diff aprovado por gente.** Nao existe carga automatica, e
   `calc_carga_aprovar` carrega a trava de tres numeros (produtos, precos e soma
   saem do parse ANTES da escrita; a transacao inteira volta se algum nao bater).

---

## 8. Restricao que vale em todo bloco daqui pra frente

**A calc tem que poder sair inteira depois (D2).** Nenhuma tabela `calc_*` ganha
FK para tabela de operacao. Conferir a cada migration:

```sql
select conrelid::regclass as tabela, confrelid::regclass as aponta_para
  from pg_constraint
 where contype='f' and conrelid::regclass::text like 'calc\_%'
   and confrelid::regclass::text not in ('tenant','app_usuario');
```
Esperado: **zero linhas**, sempre. Medido em 08/09/2026 com as cinco tabelas
novas: zero.

---

## 9. Uma ressalva de processo

O subagente `vitrine` **travou no watchdog** (600s sem progresso) sem escrever uma
linha. A tela do 1.3, a `prova_catalogo.js` e a `diag_calc.py` foram construidas
pela Torre. Registrado por honestidade, nao como excecao a regra: quem constroi
tela continua sendo o `vitrine`. Se travar de novo, e barato refazer pela Torre e
registrar, e caro ficar reenviando.

---

## 10. Comandos de arranque, copiaveis

```
cd "C:\Users\jessi\OneDrive\Documentos\pitswall claude"
git log -3 --format='%h %ad %s' --date=format:'%d/%m %H:%M'
git status --short
git remote -v
git fetch github main && git rev-list --left-right --count github/main...HEAD
```

Tree suja ou commit que voce nao fez = **outra sessao viva nesta pasta**. Ler a
secao 1 do `docs/runbook-operacao.md` antes de qualquer coisa.
