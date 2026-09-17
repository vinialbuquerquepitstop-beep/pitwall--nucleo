# Candidate Engine + Resolver V1

Branch: `feat/calculadora-interpretador-resolver-v1`

## Objetivo

Adicionar a primeira camada semantica ao Interpreter Core sem acoplar o motor ao Pitwall, ao Supabase, a um fornecedor ou ao dominio Apple.

O Core continua em shadow mode.

## O que esta fatia adiciona

1. `record_trigger` no `DomainSchema`
   - define qual campo/materializacao dispara a tentativa de formar um registro.
   - o motor nao assume que preco sempre fecha um registro; isso e configurado por dominio.

2. `resolver` por campo no `DomainSchema`
   - atualmente `kind = entity`.
   - o schema declara `entity_kind` e os mecanismos permitidos de match (`alias`, `label`).

3. indice read-only de conhecimento
   - entidades indexadas por kind;
   - aliases indexados por kind;
   - normalizacao sem acento, caixa ou pontuacao superficial.

4. resolucao conservadora
   - label canonico unico -> `interpreted`;
   - alias unico -> `inferred`;
   - sem correspondencia -> `entity_unresolved`;
   - mais de um destino plausivel -> `entity_resolution_ambiguous`;
   - nunca escolhe silenciosamente entre dois destinos.

5. composicao de registro
   - junta valor direto da linha com contexto herdado;
   - exige todos os campos `required`;
   - mantem `trace` por campo;
   - so cria `record` se nenhuma ambiguidade bloqueante existir.

6. aprendizado como proposta, nao escrita
   - entidade nao resolvida gera `LearningProposal(kind=local_resolution)`;
   - o Core nao grava alias, entidade, regra ou perfil.

## Invariantes preservadas

- zero acesso a Supabase/Postgres;
- zero tenant dentro do Core;
- zero escrita operacional;
- zero branch por nome de fornecedor;
- zero branch por Apple/iPhone;
- zero escolha silenciosa quando ha conflito;
- todo registro contem trace de origem;
- contexto antigo nao pode contaminar novo anchor.

## Fixture de prova

Schema: `ferramentas/interpreter-core/v1/fixtures/generic-device-domain.json`

KnowledgeSnapshot: `ferramentas/interpreter-core/v1/fixtures/generic-device-knowledge.json`

Exemplos:

```text
DEVICE ALPHA16
256GB
6999
```

Resolve `ALPHA16` diretamente pelo label canonico.

```text
DEVICE A16
128GB
5999
```

Resolve por alias para `model-alpha16` e marca o registro como `inferred`.

```text
DEVICE GAMMA30
256GB
8999
```

Nao gera registro. Gera ambiguidade `entity_unresolved` e proposta de aprendizado.

Se `A16` apontar para dois IDs diferentes, o registro e bloqueado com `entity_resolution_ambiguous`.

## O que ainda NAO existe

- schema Apple real;
- KnowledgeSnapshot exportado do catalogo Pitwall;
- resolucao de cor/condicao/fornecedor real;
- validacao de combinacoes de atributos;
- montagem de ofertas multi-cor;
- comparador contra `calc_parse_v2`;
- escrita em `calc_carga`;
- promocao para producao.

## Prova local

Rodar:

```bash
node ferramentas/interpreter-core/v1/prova_core.js
```

A suite foi expandida para cobrir estrutura, contexto, label canonico, alias, desconhecido, conflito de alias e vazamento de contexto. O resultado deve ser confirmado localmente antes de considerar a fatia verde.

## Proximo passo recomendado

`Apple Domain Adapter V0` em shadow mode:

1. construir `DomainSchema` Apple a partir do catalogo atual, sem escrever regras de fornecedor no Core;
2. construir um `KnowledgeSnapshot` fixture com amostra canonica de modelos/aliases/condicoes;
3. alimentar trechos reais ja conhecidos da lista 17/08;
4. comparar resultado campo a campo com o leitor vigente;
5. somente depois conectar um exportador read-only do catalogo Pitwall.
