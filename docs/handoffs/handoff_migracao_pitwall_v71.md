# Handoff migracao v71 — Fila Operacional v2, Fatia 1 validada e publicada

Data: 14/09/2026. Linha: migracao / CRM. Substitui o `handoff_migracao_pitwall_v70.md` como topo.

Linguagem: prosa sem acento, sem cedilha, sem travessao.

## 1. O que subiu

A Fatia 1 da Fila Operacional v2 (classificacao operacional), construida pelo ChatGPT na branch
`codex/fila-operacional-v2-fatia1`, validada pelo Claude (ambiente com Chrome) e publicada com OK
explicito do dono.

| Ref | Hash |
|---|---|
| `github/main` antes | `7782a1a` (backup de 14/09) |
| branch validada | `2e37b23` (ja continha `7782a1a`) |
| `github/main` depois | `2e37b23`, por fast-forward, sem commit de merge |

Como foi fast-forward, o codigo publicado e byte a byte o que a suite mediu. Deploy conferido no
Worker `flat-resonance-09ba.pitstopimports.workers.dev` cerca de 60 s depois do push: md5 do
`app.js` servido (CR removido) `0809edc646a800d324461deda275e32c`, igual ao do commit; `app.css`
servido contem `.fila-recorte`. Conferencia so por `curl`, sem clicar em nada que grave toque,
resposta ou desfecho.

**Nada da calculadora subiu junto.** O `cc2d538` (conserto do leitor, outra sessao, linha
`calculadora`) segue commitado so no `main` local desta pasta. Ele NAO descende de `2e37b23`: quem
publica-lo precisa rebasear sobre o `github/main` atual. As provas de banco dele foram rodadas nesta
sessao a pedido do dono (leitor 77, laco 39, catalogo 29 = 145 executadas, 0 falhas, producao
identica antes e depois), mas a publicacao e decisao daquela linha.

## 2. O que a fatia muda na tela

- A Fila mostra so trabalho executavel. Lead com veredito `pare` e lead sem consentimento saem da
  fila principal (a guarda do card e do `waHrefFila` continua como defesa em profundidade).
- Comercial e pos-venda viram uma lista unica com prioridade global. O cabecalho `.pos-cab` sai da
  Fila (continua na Pitscare) e entra o recorte `Fila unificada · N comercial · N de pós-venda`,
  com a janela declarada.
- A mesma funcao (`montarFilaOperacional`) alimenta Fila e Hoje; item devido hoje diz
  `vence hoje`, sem parecer atrasado.
- A linha da regua foi para o rodape da Hoje.

Arquivos: `public/app.js`, `public/app.css`, `ferramentas/harness.py`, `ferramentas/diag_mobile.py`,
`ferramentas/prova_regua.js`, e dois novos, `ferramentas/prova_fila_operacional_v2.js` e
`ferramentas/patch_fila_operacional_v2_recorte.js`. Zero migration, zero escrita em producao.

## 3. Validacao (worktree isolado em `2e37b23`)

EXIT 0 nos 24 comandos: `validar.py` (TUDO PASSOU), `harness.py`, `prova_trilho`, `prova_grafico`,
`prova_atmosfera`, `prova_taxas`, `node --check public/app.js`, `prova_cpo` (39/39),
`prova_sem_margem` (22/22), `prova_catalogo` (119), `prova_regua.js` (27/0),
`prova_fila_operacional_v2.js` (20/0), `prova_alimentar.py` (170/0), `diag_mobile` 360/390/414/1280/1440,
`diag_largo` 1500/1920/2560, `diag_calc` 360/390/414.

**Harness: 1117 passou, 0 falhou; 1122 declaradas, 1117 executadas, 0 nao executaram (5 de ramo
alternativo).** Linha de base no main anterior: 1114/0, 1119 declaradas.

Guard-rails alterados, conferidos no diff:
- as provas de LGPD da Fila foram trocadas uma por uma: o lead sem consentimento nao renderiza mais,
  entao a prova deixou de clicar no card dele e passou a assertar `waHrefFila === null`, `cardHTML`
  sem WhatsApp, sugestao ou toque, e nenhum `sugerir_mensagem` para ele;
- as 5 assercoes do bloco `.pos-cab` na Fila viraram 5 sobre a fila unificada (conjunto unico,
  prioridade global, sem `.pos-cab`, recorte com composicao e janela);
- +3 novas na Hoje (pos-venda nao some, encabeca, `vence hoje`); e a diferenca 1114 -> 1117;
- `diag_mobile` passou a exigir um card convertido na Fila no lugar do `.pos-cab`;
- nenhuma baseline `.antes` repontada.

Prints (Fila e Hoje, 1280 e 390) gerados por `ferramentas/foto_fila.py` e conferidos pelo dono.
Comparacao na mesma fixture: main anterior 3 cards (na fila 3, em atraso 3); Fatia 1, 1 card (1 e 1).

## 4. Decisoes do dono

1. **Proxima fatia, registrada aqui:** mostrar quantos ficaram fora da fila executavel e os motivos,
   sem recoloca-los como tarefas. Hoje o recorte diz `1 comercial` e o contador `Em atraso` cai de 3
   para 1 sem dizer que 2 sairam (`pare`, sem consentimento). Pela regra da v33, tela que omite
   recorte mente.
2. **O vao de ~220px** acima do cabecalho mobile com a Fila curta vira correcao visual separada, fora
   da branch do CRM. Nao e da Fatia 1: `.app` e grid de uma coluna com `min-height:100dvh`, e as
   linhas implicitas esticam quando o conteudo e curto (`app.css:136` e `:1050`). Aparece em
   producao em qualquer Fila vazia ou curta.
3. Merge e push so com OK explicito, dado em 14/09.
4. O `cc2d538` nao sobe junto (secao 1).

## 5. Protocolo com o ChatGPT, como rodou

Branch congelada em `2e37b23` durante a validacao (confirmado por ele). Ele nao commita no main e
nao cria handoff; a proxima fatia sai de branch nova a partir do `main` publicado, ja com o item 1
da secao 4. A suite visual segue rodando no ambiente do Claude antes de todo merge.

## 6. Erro desta sessao, para nao repetir

O Claude misturou a linha `calculadora` na validacao do CRM: incluiu o `cc2d538` no plano de push
porque ele estava no `main` local, e levou ao dono detalhes do leitor que eram de outra sessao.
Correcao: a Fatia 1 subiu sozinha, pelo hash validado. **Regra:** commit local de outra linha nao
entra em push de outra linha; publicar pelo hash validado (`git push github <hash>:main`), nunca
empurrando o `main` local inteiro.

## 7. Aberto

- Contagem dos excluidos da fila (proxima fatia do CRM).
- Vao do cabecalho mobile com Fila curta (correcao visual separada).
- `cc2d538` da calculadora sem publicar, fora do `github/main` (linha `calculadora`).
- O `main` local desta pasta esta divergente do `github/main`: tem o `cc2d538`, que o GitHub nao
  tem, e nao tem o backup, os commits da Fatia 1 nem este handoff. A proxima sessao faz
  `git fetch github` antes de tudo.
