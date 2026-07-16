# CLAUDE.md — Pit Wall 2.0 (Nucleo)

Contexto de arranque para o Claude Code neste repositorio. E lido em toda sessao,
antes de qualquer coisa. Vale acima de qualquer instrucao interna de skill que
aponte para arquivo inexistente.

---

## Arranque de toda sessao (nesta ordem)

1. Ler o handoff de MAIOR versao em `docs/handoffs/` (hoje: `handoff_migracao_pitwall_v27.md`).
   O handoff mais novo substitui todos os anteriores.
2. Verificar o estado vivo do banco via MCP do Supabase antes de tocar em qualquer coisa.
3. Se o pedido tocar no visual do frontend, abrir `docs/design/referencia-visual-v3.html`
   ANTES de escrever CSS. Ela e a referencia de record, aprovada pelo dono.
4. So entao abrir a skill do dominio do pedido.

Nota sobre skills: as tres skills do projeto (`pitwall-nucleo`, `pitwall-conteudo`,
`operacao-pitstop`) estao COMPLETAS. Conferido em 16/07/2026: os 8 `references/` que a
`pitwall-nucleo/SKILL.md` pede existem e tem conteudo (`invariantes.md` 126 linhas,
`modelo-de-dados.md` 117, `regua-cadencia.md` 82...), e os 4 da `pitwall-conteudo`
tambem. **Abrir esses arquivos normalmente.**

Ate a v25 este bloco dizia que os `references/` nao existiam e mandava nao abri-los.
Era mentira, e cara: fez varias sessoes pularem o conhecimento acumulado do projeto e
reconstruirem de cabeca o que ja estava escrito.

---

## Postura: conselheiro critico, nao carimbo

O dono pediu explicitamente para NAO validar ideias de forma automatica. Diante de
uma proposta, a primeira pergunta interna e "por que isso vai custar caro ou falhar",
nao "como eu elogio". Nomeie a MAIOR falha primeiro, com clareza. Seja exato sobre o
que cada mudanca entrega, sem inflar. Segure a sequencia quando construir fora de
ordem gera retrabalho. Surface contradicoes entre trilhos de trabalho. Nao execute em
silencio instrucoes conflitantes. Se o dono decidir contra o conselho, registre que
foi decisao consciente dele e siga.

---

## Invariantes duros (nunca colapsar nem inverter)

1. Sensor x regua: o sensor registra o que aconteceu; a regua le e decide a direcao.
2. Toque enviado x Respondido sao eventos distintos. Toque e acao do operador;
   Respondido e freio permanente. `respondido_freia` e por perfil, nunca global.
3. Nivel x Status: `frio` (nivel, temperatura, LEITURA) nunca se confunde com
   `❄️ Lista fria` (status, decisao da regua).
4. Nivel e DERIVADO na leitura, nunca armazenado. Rota A: 0-2 dias quente, 3-6 morno,
   7+ frio. No banco e expressao na query, nao coluna.
5. Lead ID e a chave estavel do vinculo entre tabelas, nunca id de linha volatil.
6. Historico e auditoria sao append-only, newest-first onde exibido.
7. Toda tabela de dado tem `tenant_id` e uma policy de RLS que o usa.
8. Funcoes helper de RLS (`fn_tenant_atual` / `fn_papel_atual`) vivem no schema
   `privado`, nunca em `public`, invisiveis ao PostgREST.
9. `authenticated` nunca recebe TRUNCATE. Privilegio minimo necessario.
10. `CURRENT_DATE` proibido onde se produz data de negocio. Sempre o equivalente no
    fuso do Brasil.
11. Numeros de cadencia vivem na tabela de config `cadencia_regra`, nunca dentro de
    `fn_regua_varredura()`.
12. Chave de busca de script e `perfil` + `passo` (inteiro), nunca o rotulo (rotulos
    sao editaveis).
13. `sugerir_mensagem` e a UNICA fonte de texto de abordagem na Fila, e e estritamente
    read-only. Nada de mensagem fixa no JS. Link WhatsApp so abre conversa, nunca
    registra acao de contato.
14. As 3 variantes (Direto / Consultivo / Leve) cumprem papeis distintos. Se Direto e
    Consultivo dizem a mesma coisa, e regressao.
15. Assinatura formal `Vini, da Pitstop Imports` so em primeiro contato e reativacao
    apos silencio longo.
16. LGPD na Fila: `waHrefFila` so devolve link se `consentimento === true`.
17. Nao construir superficie de SaaS antes do primeiro pagamento. Barato entra agora
    (schema multi-tenant, RLS, auditoria); caro so quando alguem pagar.

---

## IDs de sistema

- Supabase project ID: `unjzpyexgtbcmjfgcqrx`
- Tenant ID: `00000000-0000-0000-0000-000000000001`
- Auth UID (dono): `fb2aad8e-b728-4e59-a198-71da2156449d`
- Repo GitHub: `vinialbuquerquepitstop-beep/pitwall--nucleo` (privado, branch `main`)
- Cloudflare Worker: `flat-resonance-09ba.pitstopimports.workers.dev`
- CRM Sheets (legado): `1lJj4wHjniXhjW_dmFSJ2eKdohN8MCJ4MGvglXyyIrrY`, aba `Pitstop Imports — CRM de Clientes` (em-dash U+2014, casing exato)
- Conteudo/uso Sheets: `1fWhQ78vq1ScvYehvW6jvauS5WNY5kXtuPVhf09Ue7ek`
- Notion calendario DB: `ab0fc93f-d964-4f32-8c81-4be5343687b3`

---

## Estrutura do frontend

```
nucleo/            <- o repo git (clone de pitwall--nucleo). O codigo vive AQUI.
  public/
    index.html     (estrutura, aponta pra app.css e app.js)
    app.css
    app.js
  wrangler.jsonc
ferramentas/       <- suite de validacao e harness (fora do repo). Ver handoff v26.
docs/              <- handoffs e referencia visual (fora do repo)
```

O diretorio de trabalho NAO e um repo git; `nucleo/` e. O repo nao versiona `docs/`
nem `ferramentas/`. Armadilha: `Desktop/pitwall deploy/` e um monolito morto de 09/07,
sem git, anterior ao redesign. Nao e copia de trabalho, nao editar.

Frontend e trio servido direto, sem minificacao SEPARADA. Atencao: os arquivos no repo
ja estao minificados na origem (uma linha so). "Legivel" no historico queria dizer
"trio em vez de monolito", nao codigo formatado.

**Referencia visual de record: `docs/design/referencia-visual-v3.html`.** Aprovada em
16/07/2026 apos o dono reprovar a v1 (IBM Plex) e a v2 (serif). Construir ATE ela, nao
ate o denominador comum do que o HTML antigo ja tem. Foi exatamente esse o erro: entregar
uma versao pobre da referencia (sem icone de secao, sem contador na aba, sem rotulo de
grupo, sem avatar, sem terceira linha do pitboard) e chamar de pronto.

Cores (recalibradas para fundo branco em 16/07/2026, por decisao consciente do dono; os
valores antigos eram de fundo escuro e reprovavam em branco):
- `--accent` `#0025cc` (marca, inalterado, 9.83:1)
- `--quente` faixa `#F26B31` / texto `#BC4715` / tint `#FDF0E9` (era `#ff5d45`)
- `--morno` faixa `#C48808` / texto `#946500` / tint `#FBF3E0` (era `#f2a71b`, que
  marcava 2.04 em branco). Continua semantico, nunca unificar com a marca.
- `--frio` faixa `#8395AF` / texto `#5C6F8A` / tint `#F0F3F8` (era `#6db8e8`)
- `--erro` `#B01235` (era `#ff6b5e`, que tinha contraste 1.09 contra `--quente`, ou seja,
  lead quente e falha de sistema pintavam igual)
Alvo: 4.5:1 para texto, 3:1 para faixa. Medir, nao escolher no olho.

Tipografia: `Instrument Sans` (400/500/600) para palavra, `Geist Mono` (400/500) para
dado. Sem serif (reprovado: o mundo Apple nao tem serif). O refino vem de escala e
tracking, nao de familia decorativa.

Cadencia em notacao com ponto do meio: `R3 · D14` (U+00B7).

---

## Pipeline de deploy

- Git e a fonte da verdade. Guarda os arquivos.
- Cloudflare publica sozinha no push, via Workers Builds. Empurrar pro git E o deploy.
- Supabase fica de fora de qualquer tarefa de frontend.
- O `name` no `wrangler.jsonc` (`flat-resonance-09ba`) tem que bater exatamente com o
  Worker no painel, senao o build da integracao falha.
- `not_found_handling: single-page-application` protege o hash de recovery de senha.

---

## Disciplina de validacao e entrega

- Entregar arquivo completo, pronto para aplicar, nunca fragmento. Fragmento foi a
  causa raiz de corrupcao no historico do projeto.
- Frontend: qualquer split ou extracao passa por acorn (`sourceType: script`) +
  harness jsdom + fidelidade byte a byte (MD5 fonte vs arquivo) antes de dar por pronto.
  Quando o MD5 for prova, escrever a receita exata (campos, separador, ordenacao) no
  handoff, senao o numero nao e reproduzivel.
- SQL: nao entregar sem rodar. Policy de RLS testada como dono, como vendedor e como
  tenant errado, provando o isolamento. Auditoria: provar que uma escrita gera
  exatamente um registro append-only com valor antes e depois.
- `CREATE OR REPLACE VIEW` derruba `security_invoker = on` em silencio: sempre seguir
  com `ALTER VIEW ... SET (security_invoker = on)` e conferir em `pg_class.reloptions`.
- `CREATE OR REPLACE FUNCTION` reseta ACLs: refazer REVOKE/GRANT explicitos depois.
- MCP Supabase: `execute_sql` so devolve o resultado do ultimo statement do bloco;
  cada verificacao e uma chamada separada. `apply_migration` preferido para schema e
  insert em massa (lida com acento e payload grande, transacional).

---

## Convencao de linguagem

Responder em portugues do Brasil, direto e estruturado, orientado a execucao. Comecar
simples, aprofundar so quando ajuda a decisao. Sem cliche motivacional. Na prosa do
Claude: sem acento, sem cedilha, sem travessao (trocar por virgula, dois-pontos ou
reescrever). EXCECAO obrigatoria: valores reais do sistema carregam seus proprios
caracteres exatos e sao preservados sem alterar. Exemplos que NAO se mexe: aba
`Pitstop Imports — CRM de Clientes`, perfis `Lead — Repescagem` e `Comprou — 1ª vez`,
status `Pendente` e `Lista fria`, sentinelas `Conversando` e
`Negociação parada`, rotulos de toque com o ponto do meio (`R3 · D14`), cabecalhos
de coluna e nomes de funcao.

Emoji NAO faz mais parte de rotulo nenhum. Saiu do `dicionario_rotulos` em 16/07/2026,
por decisao da v25: na tela virou ponto colorido + palavra. Os exemplos acima ja estao
na forma nova, sem emoji. Nao reintroduzir. O que identifica um valor e o `codigo`
(`lista_fria`, `pendente`), nunca o `rotulo`, que e display e editavel.

---

## Handoff no fim da sessao

Registrar decisoes, nao so estado. Criar `docs/handoffs/handoff_migracao_pitwall_vNN.md`
com a versao incrementada. O novo substitui os anteriores.
