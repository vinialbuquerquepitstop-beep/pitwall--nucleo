# Handoff migracao v70 — Fila Operacional v2, Fatia 0 fechada

Data: 13/09/2026. Linha: migracao / CRM.

Substitui o `handoff_migracao_pitwall_v69.md` como topo da linha para trabalho de CRM. O v69 continua sendo a ponte histórica para Financeiro e contém a auditoria/limpeza operacional de 13/09.

## Estado de código

HEAD usado para a descoberta: `eae564b0a9231d07584bf0b170337fc30cd8cddd`.

A Fatia 0 foi fechada em documentação no commit `026274ba98e06ad3203a06b27619a5a05538d7aa`.

Documento completo:

`docs/processos/fila-operacional-v2-fatia0.md`

Nenhum arquivo em `public/`, migration, função, tabela, cadência ou dado de produção foi alterado para fechar a Fatia 0.

## O que foi provado

### Fonte da Fila

O frontend carrega `public.v_lead.select("*")` e mantém o resultado no array local. `v_lead` é `security_invoker` e já deriva os campos necessários para decisão operacional:

- `toques`
- `respostas`
- `toques_sem_resposta`
- `valor_em_jogo`
- `duplicata_de`
- `veredito`
- `veredito_ordem`
- `veredito_motivo`

A ordem do frontend é veredito, valor em jogo, data e nome.

### Fila comercial

`m()` considera acionável para a superfície comercial quem está `pendente`, tem `proximo_contato <= hoje` e não recebeu toque hoje.

`v()` aplica a ordenação de `cmpVer()`.

### Pós-venda

`mPos()` usa um recorte separado para `status=convertido`, cadência ativa e vencida e nenhum toque hoje.

`vPos()` ordena o pós-venda internamente, mas `posAnexar()` coloca TODO o bloco depois dos comerciais. Portanto a prioridade não é global.

### Hoje

`renderHoje()` consulta `painel_do_dia()` para rotina, conteúdo, lembretes, sync e saúde da régua.

A Fila de hoje NÃO vem dessa RPC. `hojeFila()` reutiliza o array local de `v_lead`, mas chama somente `v()`, o recorte comercial.

Resultado estrutural:

```text
Fila completa = comercial + pós-venda
Fila de hoje  = somente comercial
```

### Baseline viva medida em 13/09/2026

O banco foi consultado em modo somente leitura usando o mesmo recorte lógico do browser.

```text
Fila comercial: 6
Pós-venda:       8
Total:          14
```

Os 14 têm WhatsApp e consentimento verdadeiro. Não havia `pare`, `nao_mande` nem item anterior a 13/09 na baseline medida.

Isso reproduz exatamente a baseline estabelecida na limpeza operacional.

### Mensagens e contato

`sugerir_mensagem(p_lead_id)` continua sendo a única fonte da copy de abordagem e busca scripts por `tenant_id + perfil + passo`, com fallback de `passo=0`.

Abrir WhatsApp não registra toque.

`registrar_toque(p_lead_id)` grava `ultimo_toque_em` e um evento append-only `toque_enviado`. Depois do toque, o próprio filtro diário remove o card.

## Achados que definem a Fatia 1

1. O filtro principal da Fila não exclui diretamente `sem_canal`, `sem_consentimento`, `pare` ou `nao_mande`.
2. A baseline está limpa porque esses casos foram removidos operacionalmente, não porque o contrato do frontend os impede.
3. A Fila e a Hoje usam conjuntos diferentes: 14 contra 6 na baseline atual.
4. A Hoje exibe no máximo 5 dos 6 comerciais e não inclui pós-venda na sua Fila de hoje.
5. Comercial e pós-venda são priorizados em blocos separados. Na baseline há um pós-venda `prioridade` que visualmente fica depois dos comerciais.
6. O CTA de WhatsApp verifica telefone e consentimento, mas não verifica `veredito=pare`.
7. `v_lead` já sabe classificar `nao_mande` por duplicata ou consentimento ausente. A Fatia 1 deve reutilizar essa semântica, não criar um novo status persistido.

## Provas existentes

- `ferramentas/harness.py`: principal prova integrada do frontend, incluindo Fila, Hoje, consentimento, ações e veredito.
- `ferramentas/prova_regua.js`: prova histórica da régua e separação toque/resposta.
- `ferramentas/validar.py`
- `ferramentas/diag_mobile.py`
- `ferramentas/prova_sessao.js`
- `ferramentas/suite_veredito.py`

Atenção: `prova_regua.js` ainda contém uma asserção textual da composição antiga da Hoje. Não alterar produto para fazer uma prova antiga passar; revisar o teste antes de usá-lo como gate da Fatia 1.

## O que NÃO fazer agora

- não reescrever `fn_regua_varredura()`;
- não criar coluna/status de classificação operacional;
- não duplicar texto de abordagem no JS;
- não fazer abrir WhatsApp registrar toque;
- não inferir consentimento;
- não “limpar” nova fila atrasada automaticamente.

## Próximo passo exato

Começar a **Fatia 1 — Classificação operacional**.

Antes do diff de produto, escrever/ajustar provas que fiquem vermelhas para:

1. sem telefone não ser contato executável;
2. consentimento falso não receber CTA;
3. `pare` não receber CTA de abordagem;
4. Fila e Hoje usarem a mesma regra de executabilidade;
5. pós-venda não sumir da visão operacional do dia;
6. prioridade visual respeitar `veredito_ordem` de forma coerente entre superfícies;
7. tudo isso acontecer sem tocar no motor da cadência.

Depois da prova vermelha, aplicar o menor diff suficiente da Fatia 1 e rodar o portão correspondente.
