# Handoff Migracao Pit Wall (Nucleo) v39

Substitui a v38. Data: 24/07/2026.

---

## 1. Headline: alimentar a calculadora de UM lugar so + vitrine do parceiro (opcao B)

Problema que abriu a sessao: a calculadora (repo GitHub `calculadora-pitstop`,
publica, servida por 2 sites Netlify — interna e parceiro) tinha o preco em tres
fontes divergentes (dados.js publico da interna, dados.js do parceiro, tabela
`calc_dados` no Supabase). Alimentar virou tres updates que se afastavam. Alem
disso o `dados.js` e publico: custo de fornecedor exposto no fonte (baixei o
arquivo inteiro sem login nenhum durante a sessao — vazamento vivo).

Decisao do dono nesta sessao:
- Interna e parceiro sao **dois sites Netlify do mesmo repo**; a diferenca
  interno x parceiro era so o botao `📊 interno` dentro do app.
- Parceiro passa a ver **so preco de venda** (opcao B): vitrine so-leitura, sem
  custo, sem fornecedor, sem margem. A avaliacao de usado do parceiro fica pra
  uma fatia futura ("em um determinado momento voltamos").

Arquitetura escolhida: **fonte unica = `public.calc_dados`**. Interna e /calc/ do
Pit Wall leem ela apos login; a vitrine do parceiro le uma funcao DERIVADA dela
(invariante 4: derivar na leitura, nunca armazenar segunda copia). Alimenta um
lugar, todas acompanham.

---

## 2. Entregue e PROVADO nesta sessao (fatia 1 + parceiro B)

### Backend (migration `supabase/migrations/20260724_calc_parceiro_derivado.sql`, APLICADA)
- Papel novo `parceiro` no CHECK de `public.app_usuario` (antes so `dono`/`vendedor`).
- Funcao `public.calc_dados_parceiro()` — SECURITY DEFINER, STABLE. Deriva de
  `calc_dados` para o tenant do chamador (`privado.fn_tenant_atual()`), calcula a
  venda replicando a calc (frete zero): `custo + margem`, onde custo = menor `v`
  entre as cores (senao `v`), margem = `config.mav/mpc` para `MacBook`, senao
  `config.iav/ipc`. Os NUMEROS das margens ficam no `config` (invariante 11).
  Retorna so `{n, c, t, cs(sem v), av, pc}` + `atualizado_em`. Sem `f`, sem `l`,
  sem custo, sem `config`. `revoke ... from anon`; `grant execute to authenticated`.
- RLS de `calc_dados` apertada: papel `parceiro` NAO le a tabela crua
  (`fn_papel_atual() <> 'parceiro'`); dono/interno continuam lendo.

Provas rodadas (personificando via `set local role authenticated` + jwt claims):

| Prova | Esperado | Resultado |
|---|---|---|
| Vitrine tem produtos | 340 | 340 |
| Vaza `f`/`l`/`v`/custo em algum produto | 0 | 0 |
| Cor com custo | 0 | 0 |
| Expoe `config` (margens) | nao | nao |
| Parceiro le `calc_dados` cru | 0 | 0 |
| Parceiro le a vitrine | 340 | 340 |
| Dono ainda le `calc_dados` cru | 1 | 1 |

Parceiro de teste (`11111111-2222-3333-4444-555555555555`) criado, testado, apagado.

### Frontend: `public/calc-parceiro/index.html` (servido pela Cloudflare)
Vitrine so-leitura: login proprio (email+senha via Supabase, NAO cai no Pit Wall),
busca, produtos agrupados por categoria (ordem iPhone/iPad/MacBook/Apple Watch/
Acessorio), preco A vista + parcelado base, bolinhas de cor. Estados de carga/erro/
vazio. Le `sb.rpc('calc_dados_parceiro')`. Reusa a chave anon publica. Estilo
Montserrat + tokens da calc (familiaridade). Sintaxe JS validada (`node --check`, EXIT 0).

### Comando unico de alimentar: `ferramentas/publicar_calc.py`
`python ferramentas/publicar_calc.py <dados.js> [--check]`. Le `const DADOS = {...}`
ou JSON puro, valida (config com margens, produtos com custo), faz upsert em
`calc_dados` via PostgREST. Chave de servico vem do env `SUPABASE_SERVICE_KEY`,
nunca chumbada. Dependencia zero (stdlib). Testado em `--check`: o `dados.js` do
repo tem 335 produtos; o `calc_dados` ja tinha 340 — confirmando a divergencia que
o comando elimina daqui pra frente.

---

## 3. Pendente para a fatia ficar usavel ponta a ponta

1. **Login do parceiro (bloqueador pra ABRIR a vitrine):** criar auth user em
   Supabase > Authentication > Add user (email+senha). Depois inserir a linha:
   ```sql
   insert into public.app_usuario (id, tenant_id, nome, papel, ativo)
   values ('<UID_DO_AUTH_USER>', '00000000-0000-0000-0000-000000000001',
           'Nome do Parceiro', 'parceiro', true);
   ```
2. **Deploy da vitrine:** commit + push (Cloudflare publica sozinha). Feito nesta
   sessao? Ver secao 5.
3. **Fechar o vazamento (proxima fatia, precisa do repo `calculadora-pitstop`, sem
   push daqui):** na interna, trocar o carregamento do `dados.js` publico pelo
   bloco Supabase-atras-de-login (identico ao rodape de `public/calc/index.html`,
   linhas 1337-1357) — exige dar login a interna. E substituir o `dados.js` publico
   pelo fixture falso da secao 4. Enquanto isso nao ocorre, o custo segue publico.

---

## 4. Fixture: `dados.js` de precos FALSOS para o repo publico / dev do colaborador

Cola no lugar do `dados.js` real do repo `calculadora-pitstop`. Mata o vazamento e
da ao colaborador dado de teste com a mesma forma. Numeros inventados.

```js
// dados.js — FIXTURE de desenvolvimento (precos FALSOS, nao usar em producao)
const DADOS = {
 "config": { "d": 300, "s300": false, "scusto": true, "iav": 550, "ipc": 650, "mav": 1200, "mpc": 1300 },
 "bateria": [],
 "tela": [],
 "produtos": [
  { "n": "iPhone 15", "f": "Fornecedor Exemplo", "l": "Cidade — RJ", "c": "iPhone", "t": "Lacrado",
    "cs": [ { "n": "Preto", "h": "#1a1f2b", "v": 4000.0 }, { "n": "Branco", "h": "#faf6ef", "v": 4000.0 } ] },
  { "n": "iPhone 15 Pro", "f": "Fornecedor Exemplo", "l": "Cidade — RJ", "c": "iPhone", "t": "Lacrado", "v": 6000.0 },
  { "n": "MacBook Air M3", "f": "Fornecedor Exemplo", "l": "Cidade — RJ", "c": "MacBook", "t": "Lacrado", "v": 8000.0 },
  { "n": "AirPods Pro 2", "f": "Fornecedor Exemplo", "l": "Cidade — RJ", "c": "Acessório", "t": "Lacrado", "v": 1400.0 }
 ]
};
```

---

## 5. Notas e pontas soltas

- **Quirk da calc original (revisar depois):** `mg()` da margem de iPhone (550/650)
  para TUDO que nao e MacBook, inclusive acessorio. Por isso `AirPods 4` sai a
  `1449` a vista (custo 899 + 550) na vitrine. A derivacao e FIEL a calc atual,
  mas o numero cheira a bug herdado. Nao foi mexido nesta sessao.
- A suite Python (`validar.py`/`harness.py`/`prova_trilho.py`) cobre so o app
  principal (`public/app.js`, `index.html`, `app.css`); nao toca em
  `public/calc-parceiro/`. A vitrine foi validada por `node --check`.
- Repo da calc: `vinialbuquerquepitstop-beep/calculadora-pitstop` (PUBLICO), uma
  branch `main`, arquivos `index.html`, `dados.js`, `historico.json`, `pitstop_hist.py`.
- SRI nos `<script>` de CDN: mantido SEM SRI, igual a calc e a `/calc/` ja em
  producao (tag `@2` movel; hash fixo quebraria no proximo patch). Endurecer os
  tres de uma vez e decisao separada.
