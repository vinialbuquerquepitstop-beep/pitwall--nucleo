# Prompts canonicos

**Fonte da verdade: `docs/financeiro/PROMPTS.md` no repo.** Esta copia existe para a sessao que nao tem o repo acessivel. Divergiu do repo? O repo ganha e esta copia se descarta.

## Indice

1. Ciclo: P-ABRE, P-FECHA, P-AUDITA
2. Contencao: P-FREIA, P-NAO-INVENTA, P-DECIDE
3. Molde de conserto em duas fases
4. Molde de entrega vertical

---

## 1. Ciclo

### P-ABRE

```
Portao de entrada do Financeiro. Leia docs/financeiro/CONTRATO.md e confirme que leu.

Rode e devolva EXIT CODE, nao texto de saida, em tabela (item | EXIT | veredito):

1.  git status --porcelain
2.  via Supabase MCP: migrations aplicadas vs supabase/migrations/ no git.
    Casamento por md5 do corpo, nunca por nome. Liste a diferenca nos dois sentidos.
3.  python ferramentas/validar.py
4.  python ferramentas/harness.py
5.  python ferramentas/prova_trilho.py
6.  python ferramentas/prova_grafico.py
7.  python ferramentas/prova_atmosfera.py
8.  node --check public/app.js
9.  python ferramentas/diag_mobile.py em 360, 390, 414, 1280 e 1440

Se QUALQUER item reprovar, pare e diga qual e o conserto.
Nao proponha, nao comece, nao adiante nada da entrega da vez.
```

### P-FECHA

```
Portao de saida. Antes de dizer pronto:

1. Confira item a item o portao de saida do CONTRATO.md, com sim/nao.
2. Liste os arquivos tocados e o hash do commit.
3. Atualize o handoff da linha do Financeiro, no nome que o
   docs/handoffs/handoff_indice_pitwall.md ja usa (nao crie serie paralela).
   Secoes: o que mudou nesta sessao / o que foi PROVADO, com EXIT code /
   o que NAO foi provado / pendencias / primeiro movimento do proximo chat /
   invariantes reforcados.
4. Responda explicitamente: algum numero visivel na tela mudou de valor nesta
   entrega? Se sim, onde esta a explicacao na tela? (portao de confianca)
5. Alguma recusa nova foi criada? Ela entrou na secao 4 do CONTRATO.md?

Se algum item reprovar, NAO commite. Reporte o que falta.
```

### P-AUDITA

Sempre em sessao separada da que construiu.

```
Voce e auditor, nao construtor. NAO edite nenhum arquivo.
Leia docs/financeiro/CONTRATO.md e o ultimo handoff da linha do Financeiro.

Audite o commit <hash> contra a secao 7 do CONTRATO.md, pergunta por pergunta,
com veredito binario e a evidencia (arquivo e linha, ou consulta rodada).

Cheque em especial:
- campo devolvido por RPC sem leitor em public/app.js
- inferencia de dominio em codigo, regra ou agente (Inv. 18, F2)
- numero economico exibido com base abaixo de 95% julgada (F3)
- current_date ou CURRENT_DATE novo (Inv. 10)
- grant de DELETE ou TRUNCATE para authenticated (Inv. 9)
- token de cor novo (C5)
- frase de erro inventada na tela (C3)
- migration aplicada no banco e ausente do git

Auditoria que nunca reprova e teatro. Se reprovar, diga o que esta errado e como consertar.
```

## 2. Contencao

### P-FREIA

```
Pare. Releia a frase da entrega da vez e escreva ela de volta, literal.

Responda:
1. Qual arquivo voce tocou que a frase NAO menciona?
2. Qual item da sua resposta e melhoria, e nao a entrega?

Descarte tudo que nao esta na frase. Melhoria vira entrega propria, com frase
propria, na sequencia. Retome so o que a frase cobre.
```

### P-NAO-INVENTA

```
Pare. Toda afirmacao de estado do sistema na sua ultima resposta precisa
de rotulo: MEDIDO ou SUPOSTO.

Para cada MEDIDO, cole a consulta ou o comando que rodou e a saida.
Para cada SUPOSTO, rode a medicao agora ou apague a afirmacao.

SQL descrito nao e SQL rodado. "Deve estar" nao e estado.
```

### P-DECIDE

```
Pare. Sobre a proposta que voce acabou de fazer, responda em quatro linhas:

1. Qual e a MAIOR falha dela? Nao a menor, a maior.
2. Que medicao provaria que ela esta errada?
3. O que ela quebra que hoje funciona?
4. Qual seria a versao mais simples que resolve 80% do mesmo problema?

Nao defenda a proposta. Ataque ela.
```

## 3. Molde de conserto em duas fases

Use quando o portao reprova ou quando a entrega toca arquivo de raio grande.

**Fase 1, so conferencia.** Emita sozinha e pare.

```
<Portao|Item> reprovou em <item>. Entrega da vez e fechar esse item.
Leia docs/financeiro/CONTRATO.md e confirme que leu.

Esta e FASE 1, so conferencia. NAO edite nenhum arquivo. NAO commite. PARE no fim.

Rode e devolva em tabela (item | resultado | veredito):

1. <comando ou consulta>
2. <comando ou consulta>
...

Responda tambem, uma linha cada:
- <pergunta fechada 1>
- <pergunta fechada 2>
- <pergunta fechada 3>
- <pergunta fechada 4>

PARE AQUI. Nao proponha conserto, nao escreva codigo, nao adiante nada da
entrega. Eu decido a fase 2 com esses numeros na mao.
```

Regras da fase 1: as perguntas sao fechadas e as respostas mudam o que a fase 2 vai fazer. Pergunta cuja resposta nao muda nada nao entra. Nenhuma proposta de solucao no texto, porque o executor implementa a proposta em vez de medir.

**Fase 2, execucao.** So depois de o dono colar as respostas.

```
Fase 2. Executar. Leia docs/financeiro/CONTRATO.md antes da primeira linha.

Frase da entrega: <uma frase, com sujeito visivel na tela ou no repo>.

Contexto DECIDIDO, nao reabrir: <o que a fase 1 provou, em fatos>.

Ordem obrigatoria. NAO pule etapa e NAO commite antes da ultima.

=== ETAPA 1, <nome> ===
<passos numerados>

=== ETAPA 2, <nome> ===
<passos numerados, com a prova de que a etapa fechou>

=== ETAPA N, commit e handoff ===
1. Commit unico. Mensagem: <o que estava errado e o que passou a valer>.
2. Atualize docs/handoffs/handoff_financeiro_pitwall_v<N>.md com: <secoes>,
   e Ressalvas com tudo que nao foi provado ao vivo.
3. Responda: algum numero visivel na tela mudou nesta entrega? (portao 6.3)

ESCOPO, nao ampliar: <o que NAO entra, item a item>.
NAO comece <proximo prompt da sequencia>.
```

## 4. Molde de entrega vertical

Toda entrega de feature vai vertical: banco, servidor e tela no mesmo commit. Separar os tres foi o que produziu o defeito do abatimento.

```
Frase da entrega: <uma frase, sujeito visivel na tela>.

Leia os invariantes <lista> do CONTRATO.md antes de comecar.

Contexto DECIDIDO pelo dono, nao inferir e nao ampliar:
<fatos, incluindo o que explicitamente NAO existe>

Tarefa, vertical:
1. <banco: tabela, coluna, policy, com RLS e tenant_id>
2. <RPC: leitura ou escrita, security invoker, search_path fixo, dono-only>
3. <tela: o que aparece, e no lugar de que>
4. Assercoes <prefixo da fatia>:, incluindo uma que PROVE <o caso limite>.
```
