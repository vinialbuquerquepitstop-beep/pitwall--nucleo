# Frontend

App web hospedado fora do Apps Script, servido pela Cloudflare. Le e escreve no Postgres
via Supabase. Este arquivo cobre a estrutura, o deploy e a disciplina de validacao.

## Estrutura (trio legivel)

Depois do split do monolito (concluido na v23/v24), o frontend e um trio servido direto,
sem versao minificada:

```
public/
  index.html   (estrutura, aponta pra app.css e app.js)
  app.css
  app.js
wrangler.jsonc  (raiz)
```

O `index_brand.html` monolitico foi aposentado. Cores: `--morno` = `#f2a71b`
(semantico, nunca unificar com a marca), acento de marca `#0025cc`.

## Telas (leitura primeiro, escrita depois)

Ordem que a migracao seguiu: leitura antes de escrita, porque leitura nao corrompe dado.
- Fila do dia: os leads que vencem hoje, com o texto de abordagem vindo de
  `sugerir_mensagem` (3 chips Direto/Consultivo/Leve). O link de WhatsApp respeita
  consentimento: so aparece se `consentimento = true`.
- Todos: a base completa, com nivel derivado na leitura (quente/morno/frio por tempo de
  silencio, nunca coluna).
- Cards do lead, termometro, aba `pos-venda` (fluxo do perfil comprou).
- Escrita: registrar toque, resposta, nota, reagendamento, cada uma gerando auditoria.

## WhatsApp abstraido

O link de WhatsApp so ABRE a conversa, nunca registra contato. Registrar o toque e acao
separada e explicita do operador. `whatsapp_digitos` guarda so digitos (sem formatacao),
validado por CHECK `^[0-9]{10,15}$`.

## Deploy

- Git e a fonte da verdade. Push no `main` do repo `vinialbuquerquepitstop-beep/
  pitwall--nucleo` dispara o build da Cloudflare (Workers Builds). Empurrar pro git E o
  deploy.
- Supabase fica FORA de qualquer tarefa de frontend.
- O `name` no `wrangler.jsonc` (`flat-resonance-09ba`) tem que bater exatamente com o
  Worker no painel, senao o build da integracao falha e a Site URL do Auth quebra.
- `not_found_handling: single-page-application` protege o hash de recovery de senha (o
  fragmento cai no `index.html` com 200, nao em 404).
- `assets.directory: ./public`, alinhado com o split.

## Disciplina de validacao (obrigatoria antes de dar por pronto)

Qualquer split, extracao ou edicao grande passa por:
1. `acorn.parse(src, { ecmaVersion: 2020, sourceType: 'script' })` no JS.
2. Harness jsdom: chamar `renderLista` direto nos testes (nao simular clique de aba,
   porque `init()` e pulado no harness).
3. Fidelidade byte a byte: MD5 da fonte concatenada vs arquivo gerado. Quando o MD5 for
   prova, a receita exata (campos concatenados, separador, ordenacao/collation) tem que
   ficar ESCRITA no handoff, senao o numero nao e reproduzivel na proxima sessao.

Entregar sempre arquivo completo, nunca fragmento. Fragmento foi a causa raiz de
corrupcao no historico do projeto.

## Resiliencia

- Binding de evento isolado: helper `on(id, evt, fn)` isola cada binding. Elemento
  ausente vira warning no log e o `init` continua, nao derruba a tela toda.
- Debug no mobile: capturador de `window 'error'` + `'unhandledrejection'` que mostra o
  erro de runtime como toast vermelho visivel (o dono opera no celular, sem console).

## Minificacao (se um dia voltar a ser necessaria)

O trio hoje e servido legivel. Se precisar minificar: `html-minifier-terser` CLI com
`--minify-js '{"compress":{"passes":2},"mangle":true}'`. Nunca segredo, chave ou ID de
base no HTML/JS do cliente.
