# TREE | UP-06X — Fluxo integrado de upgrade, sem ativação
Data: 2026-11-09 | PR #202 draft

## Entregas
- Novo `ferramentas/external-calc-public-upgrade/v0/internal-upgrade-e2e.test.js`.
- Exercita, dentro do checkout canônico, `createInternalUpgradeApplication` com JWT Ed25519 assinado por chave efêmera e verificação real de assinatura, consumo de nonce via pool simulado, publicação e contexto simulados.
- Exercita os métodos canônicos reais importados do repo: `resolveVariant`, `resolveTradeIn`, `resolveSimulation`.
- Confere saída pública: preço publicado de venda (não preço de fornecedor), crédito pelo usado, parcelas por regra canônica; campos de fornecedor, taxas e custo não devem ser serializados.
- Provas negativas incluídas: nonce reutilizado, expiração, draft, tenant alheio, fingerprint desatualizado, indisponibilidade do pool, modo desativado.

## Evidência realmente executada nesta sessão
`node --test` com os arquivos locais disponíveis (up06p/up06v/up06w): **52/52 PASS**. Registro: `/mnt/data/up06x-local-baseline.txt`.
**Não se afirma que o novo internal-upgrade-e2e.test.js passou**: o checkout canônico completo com `external-calc-sales-product/v0/sales-product-service.js` não está montado na máquina e acesso git por rede está indisponível; GitHub Actions não foram disparadas.
GitHub PR #202 permanece draft, sem merge.

## Limites
- Teste é integração funcional **com armazenamento sintético**, não prova HTTP/Worker, conta PostgreSQL produtiva, emissor JWT instalado ou CRM real.
- Fonte `privado.extcalc_upgrade_context_v0` e tabela de publicações existem somente no banco Neon de laboratório, não na External Calc produtiva.
- Oferta, aprovação, escopo dinâmico, mapeamento de tenant e autorização de publicador precisam de contrato final e prova operacional.
- Não ativar routes, não publicar preços nem simulação a clientes sem homologação completa.

## Próxima ação, sem criar mais componentes isolados
Executar `node --test ferramentas/external-calc-public-upgrade/v0/*.test.js` em clone autorizado do PR #202; corrigir qualquer falha.
Em seguida prover leitura estritamente tenant-scoped das duas tabelas (sem usuário vendedor fictício) em serviço fechado, com credenciais e rotação de chave, antes de conectar ao Worker existente.
