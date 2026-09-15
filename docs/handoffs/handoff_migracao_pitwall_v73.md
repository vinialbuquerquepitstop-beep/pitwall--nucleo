# Handoff migracao v73 - Fila Operacional v2, Fatia 3 integrada

Data: 15/09/2026. Linha: migracao / CRM. Substitui o `handoff_migracao_pitwall_v72.md` como topo desta linha.

Linguagem: prosa sem acento, sem cedilha, sem travessao.

## 1. Estado fechado desta sessao

A Fatia 3 da Fila Operacional v2, `Execucao assistida`, foi implementada, provada e integrada ao `main`.

| Ref | Hash |
|---|---|
| `main` antes da Fatia 3 | `07a12fd4bb5b6b620bef49937bd3c9ad565a4c89` |
| branch final da Fatia 3 | `199fedaf4a63b1a7ffcf521e5ef61d6b32377683` |
| commit de produto na branch | `8097df10a8588d489cf61f4cb13cd65a07bcfc96` |
| merge real no `main` | `81e861f09355526529936629ed8131cd0ac2c16b` |

O merge `81e861f` tem dois pais: `07a12fd` e `199fedaf`.

A arvore do merge e exatamente a arvore final da branch que passou pelas provas. Nao houve conflito nem alteracao adicional de produto durante o merge.

Nao houve migration, alteracao de schema ou escrita de dado de producao nesta fatia.

## 2. O que a Fatia 3 entrega

A Fatia 2 respondia quem deve ser trabalhado e por que aquele lead esta na frente.

A Fatia 3 permite executar a abordagem sem sair do fluxo mental da Fila e da Hoje.

### 2.1 Sugestao continua vindo do backend

A fonte de texto permanece a RPC `sugerir_mensagem`.

O frontend nao ganhou texto comercial duplicado nem regra paralela de copy.

As variantes retornadas pela RPC continuam sendo apresentadas ao operador e a variante escolhida altera apenas o texto de preview e o link do WhatsApp.

### 2.2 Execucao dentro da Hoje

A linha da Fila embutida na aba Hoje passa a oferecer no mesmo contexto:

- `Sugerir`;
- envio pelo WhatsApp quando canal e consentimento permitem;
- `Toque enviado`;
- `Desfecho`;
- `Respondeu`;
- `Conversando`;
- `Retomar`;
- `Fechou`;
- `Sem interesse`.

O operador nao precisa navegar para outra tela para concluir o ciclo basico da abordagem.

### 2.3 Abrir WhatsApp continua separado de registrar toque

Este invariante foi preservado e ganhou prova explicita de navegador.

Abrir o link do WhatsApp nao chama `registrar_toque`.

O toque continua sendo registrado somente pela acao explicita `Toque enviado`.

Essa separacao evita transformar uma intencao de contato em evento historico confirmado.

### 2.4 O contexto operacional reconhece card e linha da Hoje

As acoes que antes dependiam apenas de `.card` agora reconhecem tambem `.fila-lin` quando estao na Hoje.

Isso permite que:

- copiar script funcione no contexto da Hoje;
- variante selecionada funcione no mesmo item;
- desfechos reutilizem os contratos ja existentes;
- registro de toque e resultado usem o mesmo dispatcher operacional sem criar uma segunda implementacao.

## 3. Arquivos persistentes da Fatia 3

O diff da Fatia 3 contra o `main` anterior ficou restrito a quatro arquivos:

- `public/app.js`;
- `ferramentas/harness.py`;
- `ferramentas/patch_fila_operacional_v2_execucao.js`;
- `ferramentas/prova_fila_operacional_v2_fatia3.js`.

O executor temporario usado para aplicar e provar o patch no GitHub Actions foi removido antes do merge e nao faz parte do estado final.

## 4. Validacao tecnica

A branch final foi submetida a um runner real com Chrome.

Resultados do gate final:

- `prova_fila_operacional_v2_fatia3.js`: 10 OK, 0 falhas;
- `prova_fila_operacional_v2.js`: 30 OK, 0 falhas;
- `validar.py`: TUDO PASSOU;
- `harness.py`: 1129 passou, 0 falhou;
- `prova_alimentar.py`: 170 assercoes, 0 falhas;
- provas auxiliares de calculadora, catalogo, CPO, trilho, grafico, atmosfera e taxas passaram;
- diagnosticos de monitor largo permaneceram verdes;
- diagnosticos da calculadora permaneceram verdes.

O harness de navegador confirmou explicitamente:

- a linha da Hoje oferece `Toque enviado`;
- a linha da Hoje oferece `Desfecho`;
- abrir WhatsApp nao registra toque.

## 5. Diagnostico mobile preexistente

Durante a validacao apareceu uma reprovacao do `diag_mobile.py` em 360, 390 e 414 px.

Foi feita contraprova antes e depois da Fatia 3 no mesmo runner.

Resultado:

- antes da Fatia 3: 1 sobreposicao, 0 estouros, 0 reprovacoes da barra e 0 do painel de vendas;
- depois da Fatia 3: exatamente a mesma assinatura.

Portanto essa reprovacao e preexistente e nao foi causada pela Fatia 3.

Ela pertence ao problema visual separado ja registrado no v72 e nao deve ser corrigida dentro desta fatia.

## 6. Integracao

O `main` avancou de `07a12fd` para o merge real `81e861f`.

A arvore do merge e `eb7b7f2bddf0095f16fef9e638e095f6c6776b47`, a mesma arvore da ponta `199fedaf` que passou pelo gate final.

Por isso o conteudo versionado do merge e byte a byte o mesmo conteudo validado no runner. Nesta sessao nao foi criada uma segunda execucao da suite depois do merge, porque o merge nao alterou a arvore provada.

## 7. O que nao mudou

Continuam valendo os contratos de `docs/processos/fila-operacional-v2.md`:

- sensor e regua separados;
- `sugerir_mensagem` e a fonte unica do texto de abordagem;
- abrir WhatsApp nao registra toque;
- canal e consentimento continuam guardas obrigatorias;
- veredito continua derivado;
- historico continua append-only;
- nenhuma acao privilegiada nova foi criada no banco.

## 8. Proximo passo oficial

A proxima fatia do processo e a **Fatia 4 - Desfecho rapido**.

Objetivo: tornar o fechamento da interacao ainda mais curto e explicito depois da abordagem, preservando os contratos de registro existentes.

Antes de implementar, reler `docs/processos/fila-operacional-v2.md` e confirmar o gate exato da Fatia 4 no documento de processo.

Nao antecipar Fatia 5 ou indicadores nesta etapa.

## 9. Aberto paralelo

Continua separado da Fila v2 o defeito visual mobile ja conhecido:

- vao / sobreposicao preexistente em larguras pequenas;
- deve ser tratado em branch propria;
- nao misturar com Fatia 4.

Tambem continuam fora desta fatia as revisoes paralelas de consentimento, venda sem WhatsApp e repescagem por evento.

## 10. Regra para a proxima sessao

Antes de tocar a Fatia 4:

1. conferir o `main` atual;
2. ler o indice mestre;
3. ler este v73 por inteiro;
4. reler `docs/processos/fila-operacional-v2.md`;
5. conferir o Git real contra os hashes deste handoff;
6. criar branch nova a partir do `main` atual;
7. medir o comportamento atual antes de alterar;
8. implementar somente o menor recorte necessario para o gate da Fatia 4;
9. provar regressao antes de integrar.

## 11. Veredito

Fatia 3 fechada no codigo e integrada ao `main`.

O CRM agora permite:

- entender por que o lead esta na fila;
- pedir a mensagem no backend;
- escolher variante;
- abrir WhatsApp respeitando canal e consentimento;
- continuar sem registrar toque apenas por abrir o link;
- registrar toque explicitamente;
- registrar desfecho no mesmo contexto da Hoje;
- concluir a abordagem sem navegar por varias telas.

Proxima entrega: **Fatia 4 - Desfecho rapido**.
