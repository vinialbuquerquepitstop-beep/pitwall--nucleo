# ferramentas/

Suite de validacao e harness do Pit Wall. **Nao vai ao ar:** o `wrangler.jsonc`
publica so `public/`.

Rodar sempre da raiz do repo.

| Arquivo | O que e |
|---|---|
| `validar.py` | Suite estatica: sintaxe (esprima), contrato de IDs e classes, invariantes (`sugerir_mensagem`, trava LGPD, 3 variantes, paleta), fidelidade a referencia v3, Fase 4. |
| `harness.py` | **Execucao real.** Roda o `app.js` de verdade em Chrome headless contra um Supabase falso, com o CSS aplicado. 31 assercoes. |
| `dados_teste.json` | Linha REAL do banco (16/07/2026). Nao inventar linha aqui: o harness so vale se o dado for o que o banco entrega. |
| `mock_historico.py` | Gera o mock da Fase 4 usando o `app.css` REAL. Saida ignorada pelo git; regerar quando precisar. |
| `patch_historico.py` | O patch da Fase 4, com ancoras que falham alto. Registro de como a mudanca entrou. |
| `fontes.css` | Instrument Sans + Geist Mono em base64. **Exemplar unico**, usado pelo mock (CSP bloqueia CDN de fonte). |
| `contraste.py` / `paleta.py` | Medem contraste WCAG. Cor semantica se MEDE (4.5:1 texto, 3:1 faixa), nao se escolhe no olho. |
| `build.py` / `preview.py` | Da era do redesign v25, quando o build vivia num scratchpad. **Baseline antiga:** apontam para `build/` e `pitwall--nucleo/`, que nao existem mais. Repontar antes de usar. |
| `app.js.antes` | Baseline pre-Fase 4, usada por `validar.py` como "velho". Ver aviso abaixo. |

## Por que Chrome e nao acorn/jsdom

O `CLAUDE.md` pede acorn + jsdom. **Nao existe node nesta maquina**, entao nenhum dos
dois roda. `esprima` (pip) cobre a sintaxe. Para comportamento, o Chrome instalado e um
runtime melhor que o jsdom: ele executa o JS **e** aplica o CSS, o que permite afirmar
sobre cor computada, nao so sobre classe presente.

## Aviso: `app.js.antes` e uma baseline que envelhece

`validar.py` compara `app.js.antes` (velho) com `public/app.js` (novo). Isso responde
"o que esta mudanca quebrou?", nao "o app esta certo?". Depois de um deploy, a pergunta
util muda: atualize a baseline (`cp public/app.js ferramentas/app.js.antes`) ao **comecar**
a proxima obra, nao no meio dela.

## Ponto cego conhecido

O check de classes de `validar.py` so enxerga `class="literal"`. Classe montada por
concatenacao (`'class="hist-ev ator-'+fn(x)`) escapa da regex. Essas vao conferidas na
mao na secao `[8]`. Nao ler "N classes emitidas" como se fosse a lista completa.
