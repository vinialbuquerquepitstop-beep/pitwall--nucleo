# Handoff de Migracao Pit Wall 2.0 (Nucleo), v9

## Como usar este documento
Continuacao da TRILHA DE MIGRACAO. Este handoff SUBSTITUI o v8. Corre em paralelo ao v16 operacional (Apps Script, ainda no ar). Para o que NAO mudou (schema, ETL, invariantes, stack alvo, fases), o v1 a v8 seguem validos; este v9 registra so o delta desta sessao.

Delta do v9 em uma linha: tentou-se trocar o deploy manual do Worker por deploy automatico conectado ao GitHub; a conexao foi criada mas o primeiro build NAO rodou (erro "Number of triggers created exceeds limit"), e ficou aberta a decisao de manter ou abandonar essa rota de CI.

Convencao de escrita: prosa sem acento, sem cedilha, nunca travessao. EXCECAO: valor real do sistema carrega seus proprios caracteres.

---

## Estado em uma frase
A Fase 1 segue FECHADA (15 leads no banco, index de leitura no ar). Esta sessao foi so de infraestrutura de deploy: um repo GitHub foi criado e populado com os 3 arquivos na estrutura certa, mas a tentativa de ligar deploy automatico Cloudflare a partir do Git travou num erro de limite de triggers, com ZERO build concluido. O app continua no ar servindo a versao anterior (laranja); nada quebrou.

---

## O que foi feito nesta sessao

1. **Repo GitHub criado.** Privado, nome de exibicao `pitwall--nucleo` (com dois tracos), caminho `vinialbuquerquepitstop-beep/pitwall--nucleo`.

2. **Tres arquivos subidos na estrutura correta**, confirmado na tela de commit antes de commitar:
   - `public/index.html`
   - `wrangler.jsonc` (raiz)
   - `README.md` (raiz)
   - Commit na branch `main`.
   - LICAO de estrutura: no GitHub web, pasta vazia nao existe; a pasta `public/` so nasce com um arquivo carregando o caminho. Arrastar a PASTA (nao o arquivo solto) preserva; ou usar Create new file e digitar `public/index.html` (a barra cria a pasta). Arrastar arquivo solto joga tudo na raiz e o Cloudflare sobe vazio.

3. **`wrangler.jsonc` aplicado (limpo, sem trigger):**
```jsonc
{
  "name": "flat-resonance-09ba",
  "compatibility_date": "2026-07-01",
  "assets": {
    "directory": "./public",
    "not_found_handling": "single-page-application"
  }
}
```
O `name` bate com o Worker existente (deploy na mesma URL, nao cria outro). `single-page-application` protege o link de recovery de senha (chega com fragmento `#`).

4. **Conexao Git no Worker `flat-resonance-09ba` criada.** Settings > Builds > Connect. Configuracao confirmada na tela: Build command None, Deploy command `npx wrangler deploy`, Version command `npx wrangler versions upload`, Root directory `/`, Production branch `main`, Build watch paths `*`. API token "Workers Builds" gerado.

5. **TRAVA:** ao disparar, a aba comecou a se repetir e apareceu advertencia vermelha **"Number of triggers created exceeds limit"**.

6. **Diagnostico parcial:**
   - Worker tem **0 cron triggers e 0 rotas** configurados.
   - `wrangler.jsonc` **nao declara** trigger, cron nem route.
   - Build history: **"No builds exist yet for this worker"**. Ou seja, NENHUM build concluiu; o erro e da etapa de conexao/setup, nao de um build. Por isso NAO ha log pra ler.

---

## CORRECAO DE FATO importante (dado do sistema)
A versao do `index.html` que subiu ao repo e a **LARANJA** (cor de destaque provisoria `#f2a71b`), a que ja estava no ar. NAO e a versao azul da marca (`#0025cc`). A troca para azul continua pendente e depende de material do dono (ver Dependencias).

---

## Leitura critica (conselho, decisao do dono)
O objetivo real da sessao era **subir a versao azul**, nao "ter CI". O deploy manual pelo painel JA FUNCIONA (foi assim que o laranja subiu). Conectar GitHub -> Cloudflare Builds acrescenta pecas moveis: API token, webhook, minutos de build, e agora esse erro de limite. Para um unico `index.html` estatico de 556 linhas, que muda raramente, e operador unico que orquestra por painel, isso e complexidade sem retorno proporcional (o tipo de "arrumacao" que o dono evita).

Recomendacao: **nao insistir no CI agora.** Duas rotas:

- **Rota simples (recomendada):** desconectar o build Git (tira a peca que falha), manter o repo GitHub so como armazenamento/versionamento do codigo, e subir o azul pelo caminho manual que ja funcionou antes. O repo vira backup versionado, sem auto-build.
- **Rota CI (so se o dono quiser automatizar):** investigar o limite de triggers da conta. Como Worker e `wrangler.jsonc` estao limpos, o excesso provavelmente e de conta/plano (teto de Workers no free tier, ou o route `workers.dev` sendo recriado). Exige olhar quantos Workers/Pages existem na conta e, se possivel, o log de um build que chegue a rodar.

---

## PROXIMO PASSO (acionavel)

### Passo 1, decisao do dono (bloqueia o resto)
Escolher: **Rota simples** (desconectar CI, deploy manual) ou **Rota CI** (depurar o limite de triggers).

### Passo 2A, se Rota simples
1. No Worker, Settings > Builds, botao **Disconnect** (tira o build Git que falha; o Worker continua no ar).
2. Subir o azul pelo caminho manual anterior (o mesmo que subiu o laranja). Confirmar qual foi: upload de asset pelo painel do Worker, ou `wrangler deploy` de uma maquina.
3. Repo GitHub fica como backup do codigo, sem auto-build.

### Passo 2B, se Rota CI
1. Contar Workers/Pages totais na conta (Workers & Pages): teto do plano free e suspeito numero 1.
2. Tentar um build e capturar o LOG (aba Builds > build > texto do erro). Sem log real, correcao e chute.
3. So depois decidir o ajuste (provavel: desligar recriacao de route, ou liberar slot de Worker).

### Dependencia que atravessa as duas rotas: o arquivo AZUL
O `index.html` azul de 556 linhas NAO esta neste chat nem nos arquivos do projeto. Para entregar o azul, uma de duas:
1. Dono tem o pacote da sessao passada (arquivo azul pronto) -> so subir.
2. Dono cola o `index.html` laranja atual -> Claude devolve o azul completo, validado (acorn + jsdom), pronto pra `public/`.
Antes de gerar o azul, cravar: e **so cor** (`#f2a71b` -> `#0025cc`) ou **cor + logo** (PNG da Pitstop no lugar do texto PIT/WALL)? Se cor+logo, precisa do PNG.

---

## Referencias novas desta sessao
- **Repo GitHub:** privado, `vinialbuquerquepitstop-beep/pitwall--nucleo` (nome de exibicao `pitwall--nucleo`, dois tracos), branch `main`. Contem `public/index.html` (LARANJA), `wrangler.jsonc`, `README.md`.
- **Worker Cloudflare:** `flat-resonance-09ba`. Build Git CONECTADO mas com 0 builds concluidos e erro de trigger limit pendente. 0 cron triggers, 0 rotas.
- **`wrangler.jsonc`:** conteudo registrado acima (limpo, aponta pra `./public`).

## Referencias de sistema (inalteradas)
- **Projeto Supabase (Nucleo):** `unjzpyexgtbcmjfgcqrx`, org vinialbuquerquepitstop-beep, plano FREE, PRODUCTION, branch main.
- **URL da API Supabase:** `https://unjzpyexgtbcmjfgcqrx.supabase.co`.
- **Worker/URL do app:** `https://flat-resonance-09ba.pitstopimports.workers.dev`.
- **Tenant 1 (Pitstop Imports):** `00000000-0000-0000-0000-000000000001`.
- **Usuario dono:** auth.users id `fb2aad8e-b728-4e59-a198-71da2156449d`, papel dono, email `vinialbuquerque.pitstop@gmail.com`.
- **CRM Sheets (espelho a aposentar):** `1lJj4wHjniXhjW_dmFSJ2eKdohN8MCJ4MGvglXyyIrrY`, aba `Pitstop Imports — CRM de Clientes`.
- **Cor da marca (azul):** `#0025cc`. Provisorio atual (laranja): `#f2a71b`.
- **Status CRM (5 fixos):** 🟡 Pendente, ✅ Feito, 🟢 Convertido, ❄️ Lista fria, 🚫 Cancelado.
- **Nivel (Rota A):** 0-2 quente, 3-6 morno, 7+ frio.
- **Escala atual:** 15 leads, 0-2 toques/dia, ~20 leads/mes.

---

## Pendencias abertas (fila do proximo trabalho)
1. **[DECISAO] Rota simples vs Rota CI** para o deploy (bloqueia o passo do azul).
2. **Subir a versao azul** do index (depende do arquivo azul; ver dependencia acima). Cravar so-cor vs cor+logo.
3. **Higiene do v4/v5, ainda aberta:** trocar a senha do dono que passou em texto claro no historico do SQL Editor (via painel, input mascarado, nao SQL); corrigir a Site URL do Auth para a URL do Worker antes de qualquer email de recovery.
4. **Fase 2, escrita com auditoria** (toque, desfecho, cadastro). Bloco grande, e o proximo do nucleo depois do deploy resolvido.
5. **Telefones de Yasmim (LEAD-0007) e Erickao (LEAD-0008).** Sem numero. 1 update por lead quando o dono tiver.
6. **Miguel (LEAD-0013):** confirmar ativo ou frio. 1 update se mudar.
7. **Erickao:** data de proximo contato real (20/07 arbitraria).
8. **Registrar dominio proprio** (some o `flat-resonance-09ba`).
9. **Notificacao/digest diario:** item de Fase 2/3, nao construir agora.
10. Fases 3 a 5 conforme o mapa. SaaS so com pagante.

---

## Invariantes e travas (seguem validas)
- Nivel derivado na leitura, nunca armazenado (view, Rota A).
- `security_invoker = on` em toda view sobre tabela com RLS.
- Nao colapsar toque enviado e respondido. Nao colapsar frio (nivel, leitura) com Lista fria (status, decisao).
- Produto = aparelho; condicao = condicao. Nao inverter.
- `service_role` NUNCA no frontend; anon key e publica, protegida por RLS.
- Config de Auth e troca de senha: so pelo painel do Supabase (UI com input mascarado), nunca por SQL (exporia credencial no historico).
- O `--morno` ambar (`#f2a71b`) da faixa de temperatura tem papel semantico proprio; NAO unificar com o azul da marca so porque as duas cores hoje coincidem no laranja provisorio. Ao aplicar o azul da marca, preservar o ambar do termometro.
- Frontend estatico nao se esconde de verdade; minificar e atrito, nao blindagem. Protecao real e RLS + logica sensivel no servidor.

---

## Timebox
Janela de 2 semanas iniciada em 04/07/2026. Fase 1 fechou na primeira semana. Esta sessao consumiu tempo em infra de deploy sem entregar o azul. Se ao fim da janela a operacao diaria nao estiver na stack nova, criterio recomendado (nao formalizado): congelar a migracao, voltar ao Apps Script e reavaliar.

## Nao reabrir, a menos que o dono peca
Construir superficie de SaaS antes do primeiro pagante; migrar mais dado antes da escrita (Fase 2) existir; transformar o deploy num sistema de CI elaborado sem retorno claro para um unico arquivo estatico. O Pit Wall e sensor; a regua e o motor de cadencia; a base agora vive no Postgres.
