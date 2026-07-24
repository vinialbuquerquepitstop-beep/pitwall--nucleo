# Handoff Migracao Pit Wall (Nucleo) v39

Substitui a v38. Data: 24/07/2026.

---

## 1. Headline: a /calc/ ganhou LOGIN PROPRIO + interno so pro dono

A calculadora servida pela Cloudflare (`/calc/`, dentro do Worker do Pit Wall)
passou a ter login proprio e a esconder o custo de quem nao e dono. Escopo do
dono, dito de forma enfatica no meio da sessao: **"exclusivamente mudar o backend
e adicionar um login"**, mantendo o **formato antigo** da calc. Sem tela nova.

Entregue e no ar (3 commits em `main`, Cloudflare publica no push):
- `e7cfd0c` feat(calc): login proprio na /calc/ + botao interno so pro dono
- `c389e27` fix(calc): sessao propria (storageKey) + botao sair

O que a `/calc/` faz agora (so mexeu em `public/calc/index.html`, zero banco):
- **Login proprio**: sem sessao, mostra tela de login (email+senha via Supabase)
  em vez de jogar pro painel do Pit Wall.
- **Sessao propria** (`storageKey:'sb-calc-auth'`): NAO herda o login do Pit Wall.
  Antes herdava, e por isso abria direto sem pedir login. Agora sempre pede, e o
  logout da calc nao desloga o painel.
- **Botao "sair"** (canto superior direito) apos logar.
- **Botao interno some para quem nao e dono**: `esconderInternoSeNaoDono()` le o
  proprio papel em `app_usuario` (policy `p_usuario_select` deixa `id=auth.uid()`)
  e, se != 'dono', esconde os dois botoes `onclick*="Int()"` (linhas ~300 e ~380).
  Nivel COSMETICO por decisao do dono: o custo ainda chega no navegador (visivel
  por devtools), so some da tela. Esconder de verdade exigiria filtrar no backend
  (rejeitado nesta sessao, ver secao 3).

Validacao: `node --check` no bloco (EXIT 0). A suite Python do repo cobre so o app
principal, nao a `/calc/`.

---

## 2. Acesso de teste criado (colaborador/parceiro)

Usuario Supabase criado direto por SQL (nao ha Auth Admin API nas ferramentas MCP;
insert em `auth.users` + `auth.identities` + `app_usuario`, senha via
`extensions.crypt(...,gen_salt('bf'))`):
- **brendonalbuquerque@gmail.com** / **testandosenha123**, papel `vendedor`,
  uid `130353b1-64da-4ed4-b766-776261191a99`.
- Login PROVADO ponta a ponta via endpoint GoTrue (`/auth/v1/token?grant_type=password`
  devolveu `access_token`). Impersonado: le os precos (RLS ok, `calc_dados` = 1) e
  papel `vendedor` (interno escondido).

Para novos acessos: Supabase > Authentication > Add user (email+senha), depois
`insert into public.app_usuario (id,tenant_id,nome,papel,ativo) values
('<uid>','00000000-0000-0000-0000-000000000001','Nome','vendedor',true);`

---

## 3. IMPORTANTE: overbuild REVERTIDO nesta sessao (nao reconstruir)

No inicio da sessao eu (Claude) extrapolei o pedido: construi uma **"vitrine do
parceiro"** nova — pagina `public/calc-parceiro/`, RPC derivada
`calc_dados_parceiro()`, papel `parceiro`, RLS por papel, e um comando
`ferramentas/publicar_calc.py`. O dono reprovou ("absolutamente fora de
cogitacao") e mandou voltar ao formato antigo.

Tudo foi revertido:
- Codigo: commit de revert `97f1eed` (apagou os 4 arquivos: vitrine, migration
  `20260724_calc_parceiro_derivado.sql`, `publicar_calc.py`, o handoff v39 antigo).
- Banco: migration `revert_calc_parceiro_derivado` — dropou a funcao
  `calc_dados_parceiro()`, restaurou a policy `calc_dados_sel` original
  (`tenant_id = privado.fn_tenant_atual()`, sem corte de papel) e voltou o CHECK
  de `app_usuario.papel` para `['dono','vendedor']` (sem 'parceiro').

Licao registrada tambem em memoria (`calc-escopo-backend-login`): na calc, ficar
no trilho estreito (backend + login sobre a calc existente); nao criar tela do
parceiro, RPC derivada nem papel novo sem o dono pedir. Confirmar escopo antes.

---

## 4. As DUAS hospedagens da calc (contexto que confundiu o dono)

Existem duas calculadoras em dois lugares, e o login novo so vale numa:
- **Cloudflare** `flat-resonance-09ba.pitstopimports.workers.dev/calc/` — serve o
  Pit Wall inteiro (o `name` no `wrangler.jsonc` e `flat-resonance-09ba`). A `/calc/`
  le precos do **Supabase atras de login**. E aqui que o acesso do Brendon vale.
- **Netlify** (repo `calculadora-pitstop`, PUBLICO) — a calc antiga, le do `dados.js`
  publico, **sem login nenhum**. O usuario do Supabase NAO tem efeito la.

O `dados.js` publico da Netlify ainda expoe custo de fornecedor (baixavel sem
login). Fechar isso (migrar a interna Netlify pro Supabase-atras-de-login + trocar
o `dados.js` por fixture falso) segue pendente e exige push no repo
`calculadora-pitstop`, que nao tem acesso a partir daqui.

---

## 5. Alimentar precos hoje (estado atual)

Fonte do backend = tabela `public.calc_dados` (blob unico `{config,bateria,tela,
produtos}`, 340 produtos). A `/calc/` da Cloudflare le dela. Para atualizar preco,
o caminho continua sendo editar o `dados.js` mestre; gravar em `calc_dados` foi
feito por MCP/SQL nesta sessao (o helper `publicar_calc.py` que automatizava isso
foi revertido junto com o overbuild — reintroduzir so se o dono pedir).

A Netlify interna, por ler `dados.js`, ainda exige o push do `dados.js` no repo da
calc para atualizar. So a Cloudflare `/calc/` esta ligada ao `calc_dados`.

---

## 6. Pendencias / proximos passos possiveis
- Testar o login do Brendon na `/calc/` (Ctrl+F5 para pegar o JS novo).
- Se o dono quiser: esconder o custo DE VERDADE (nao so o botao) — exige filtrar no
  backend antes de enviar; foi conscientemente adiado.
- Fechar o vazamento do `dados.js` publico da Netlify (precisa do repo `calculadora-pitstop`).
