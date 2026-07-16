# Modelo de dados (schema vivo)

O CRM antigo era uma planilha de ~29 colunas numa aba so. Aqui ele virou 10 tabelas
normalizadas no Postgres, todas com `tenant_id` e RLS. Este arquivo e o mapa real,
conferido no projeto `unjzpyexgtbcmjfgcqrx`. Onde houver duvida, a fonte da verdade e o
banco: rodar `list_tables` no MCP.

## Visao geral das tabelas (schema public)

| Tabela | Papel | Linhas (ref) |
|---|---|---|
| `tenant` | a loja (multi-tenant desde ja) | 1 |
| `app_usuario` | usuarios do app, papel dono/vendedor | 1 |
| `lead` | o CRM, uma linha por lead | 15 |
| `lead_evento` | linha do tempo append-only por lead | 23 |
| `cadencia_estado` | onde cada lead esta na regua | 13 |
| `cadencia_perfil` | config por perfil (silencio, freio, transicao) | 6 |
| `cadencia_regra` | os passos da cadencia por perfil | 36 |
| `dicionario_scripts` | banco de scripts (126 = 36 passos x variantes) | 126 |
| `dicionario_rotulos` | traducao codigo -> rotulo humano | 27 |
| `evento_uso` | telemetria de uso (jsonb) | 0 |
| `auditoria` | log tecnico append-only, antes/depois | 521 |

Helper de RLS: `privado.fn_tenant_atual()` e `privado.fn_papel_atual()` (schema
`privado`, invisiveis a API).

## tenant
`id` uuid PK | `nome` text | `criado_em` timestamptz. Referenciada por todas as tabelas
de dado via FK `tenant_id`.

## app_usuario
`id` uuid PK | `tenant_id` | `nome` | `papel` text CHECK `dono` ou `vendedor` | `ativo`
bool | `criado_em`. O papel alimenta `fn_papel_atual()` e diferencia o que dono e
vendedor enxergam.

## lead (o CRM)
Uma linha por lead. Colunas reais:

Identidade e dono: `id` uuid PK | `tenant_id` | `lead_code` text (LEAD-0001, chave
estavel humana) | `dono_user_id` uuid FK app_usuario (nullable).

Pessoa e produto: `nome` | `whatsapp_digitos` text CHECK `^[0-9]{10,15}$` (so digitos,
sem formatacao) | `produto` | `condicao` CHECK `lacrado`/`vitrine`/`seminovo` |
`data_nascimento` date.

Classificacao: `perfil` CHECK `compra_imediata`/`avaliando`/`em_espera`/`repescagem`/
`comprou`/`consulta` | `origem` CHECK `indicacao`/`instagram`/`whatsapp_direto`/
`loja_fisica`/`prospeccao_ativa`/`parceria_influencer`/`parceria_pag_local`/
`whatsapp_status` | `indicado_por` text.

Estado operacional: `status` CHECK `pendente`/`feito`/`convertido`/`lista_fria`/
`cancelado` (default `pendente`) | `tipo_msg` | `situacao` | `observacoes` |
`etapa_cadencia` CHECK `conversando`/`negociacao_parada` (as sentinelas 💬 Conversando e
⏰ Negociação parada).

Datas de contato: `data_contato` date | `proximo_contato` date | `ultima_resposta` date
| `ultimo_toque_em` timestamptz | `respondido_em` timestamptz.

Consentimento (LGPD): `consentimento` bool default true | `consentimento_em` timestamptz.

Comercial: `upgrade_entrada` bool | `aparelho_entrada` text | `qtd_compras` int |
`valor_total` numeric | `valor_oferta` numeric.

Sistema: `criado_em` | `atualizado_em` | `arquivado_em` timestamptz (soft delete).

Nota importante: o nivel (quente/morno/frio) NAO e coluna. E derivado na query a partir
das datas. Ver invariante 4.

## lead_evento (historico append-only)
`id` uuid PK | `tenant_id` | `lead_id` FK | `tipo` CHECK | `detalhe` text | `criado_por`
uuid FK app_usuario | `criado_em`.

Tipos de evento: `cadastro`, `toque_enviado`, `respondeu`, `conversando`, `reagendado`,
`fechou`, `sem_interesse`, `esfriado_por_silencio`, `consentimento`, `nota`,
`lead_editado`, `arquivado`, `cadencia_iniciada`, `cadencia_avancou`,
`perfil_transicionado`, `cadencia_encerrada`. Os quatro ultimos sao emitidos pela regua.

## cadencia_estado (onde o lead esta na regua)
`lead_id` uuid PK (1 por lead) | `tenant_id` | `perfil` | `passo_atual` int default 0 |
`passo_rotulo` text | `passo_vence_em` date | `encerrada` bool | `atualizado_em`.

## cadencia_perfil (config por perfil)
`perfil` | `limite_silencio_dias` int CHECK > 0 | `permite_esfriar` bool |
`respondido_freia` bool | `perfil_seguinte` (para onde transiciona ao esgotar) | `ativo`.
Detalhe dos valores em `regua-cadencia.md`.

## cadencia_regra (os passos)
`perfil` | `passo` int CHECK >= 1 | `rotulo` (ex `R3 · D14`) | `dias_offset` int |
`ancora` CHECK `toque_anterior`/`data_combinada` (default toque_anterior) | `ativo`.
`dias_offset` e relativo a ancora, nao absoluto. Ver `regua-cadencia.md`.

## dicionario_scripts (banco de scripts)
`perfil` | `passo` int CHECK >= 0 (0 = fallback generico do perfil) | `rotulo_ref` (so
documentacao) | `texto_template` text (com placeholders como `{data_combinada}`) |
`variante` smallint 1-5 default 1 | `rotulo_variante` (Direto/Consultivo/Leve) | `ativo`.
Chave real de busca: `perfil` + `passo` (+ `variante`). 126 linhas = 36 passos x 3
variantes + fallbacks.

## dicionario_rotulos (codigo -> humano)
`dominio` + `codigo` PK | `rotulo` | `ordem`. Traduz os codigos snake_case do banco
para o rotulo que o operador ve (ex perfil `repescagem` -> `Lead — Repescagem`; status
`pendente` -> `🟡 Pendente`; `lista_fria` -> `❄️ Lista fria`). Rotulo e editavel; o
codigo e a chave. Nunca buscar por rotulo.

## auditoria (log tecnico)
`id` bigint identity PK | `tenant_id` | `tabela` | `registro_id` text | `acao` CHECK
INSERT/UPDATE/DELETE | `antes` jsonb | `depois` jsonb | `usuario_id` | `criado_em`.
Gerada por trigger em cada escrita relevante. Append-only.

## evento_uso (telemetria)
`id` uuid PK | `tenant_id` | `usuario_id` | `tipo` | `payload` jsonb | `criado_em`. Base
para metricas de uso da Fase 5.

## Relacoes
tenant 1->N tudo. app_usuario 1->N lead (via `dono_user_id`) e 1->N lead_evento (via
`criado_por`). lead 1->N lead_evento e 1->1 cadencia_estado. Todas as FK de negocio
passam por `tenant_id`, o que casa com as policies de RLS.
