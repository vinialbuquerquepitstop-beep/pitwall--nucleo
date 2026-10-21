# External Calc — VS5.3f / Fronteira de bytes originais — Prova isolada

**Data:** 21/10/2026. **Estado:** EXPERIMENTAL / SHADOW / READ_ONLY / SEM BANCO.
**Base:** VS5.3e PR #195 (proposta, não aprovada); VS5.3d PR #194 (8/8 in-memory no CI).

## Lacuna de prova
O resolver VS5.3d compara SHA-256 de string UTF-8, mas não recebe bytes comprovadamente preservados. A string pode ter sido normalizada, truncada ou decodificada incorretamente antes da verificação. Um hash consistente com conteúdo adulterado não prova autenticidade original: a captura e a imutabilidade física exigem evidência do storage.

## Implementação experimental
- trusted-original-byte-adapter.cjs: porta injetável reader.loadTenantOriginalBytes(source_ref,tenant_id,actor_ref), verifica Buffer/SHA-256 dos bytes, decodifica UTF-8 estrito com TextDecoder fatal + ignoreBOM, exige roundtrip idêntico e nega NUL; devolve string ao resolver VS5.3d existente.
- maxBytes é obrigatório por instância, sem congelar um limite produtivo.
- Rejeita fonte derivada, revogada, quarentenada, mutável, tenant/ref incompatível ou campo content paralelo.
- Não armazena bytes, não insere registros, não usa Supabase, não faz rede, não registra endpoint nem autoridade C01.

## Prova
Comando: node ferramentas/external-calc-generalization/v0/proof-vs53f.mjs

12 cenários: UTF-8/BOM/emoji/CRLF/newline final, hash incorreto, truncamento, newline normalizada, UTF-8 inválido, NUL, limite de tamanho, limite obrigatório, isolamento em reader simulado, estado inválido, texto concorrente e fonte ausente.

PASS significa somente integridade de bytes e decodificação sob reader em memória, não isolamento efetivo em Postgres. O teste de ator é condicionado ao reader fake; RLS e autorização reais continuam bloqueados.

## Próximo gate
1. Aprovar explicitamente staging isolado, armazenamento escolhido, retenção e limites medidos. Sem migrations/DDL antes do gate humano.
2. Provar capture inicial, hash confiável, insert-only físico e RLS instalada, sem admitir bypass privilegiado como prova.
3. Executar autenticação A/B real sob authenticated, validar preview sem efeitos colaterais.
4. Resolver incidente de 20/10 e dependências #178–#180 antes de qualquer produção.
5. Preservar Core C01–C05, PRs empilhados e experiência aprovada.

**Provas confirmadas:** Node v22 local 12/12 e GitHub Actions run 39645683416 (job 119380503477), 12/12 com resolver VS5.3d do próprio repositório. GENERALIZATION_OWNERSHIP=PASS paths=27 deny=4; VS5.3d regressão 8/8; seis workflows PASS no commit 46576316c4fa2874b8830009af171369ac010f5d. A verificação é isolada e não valida Supabase, JWT ou RLS real.
**Estado:** VS53F_BYTE_PROOF=CI_PASS_STATIC_STUB; REAL_SOURCE_RLS=BLOCKED/NOT_RUN; C01_PRODUCTION=NO_GO.
