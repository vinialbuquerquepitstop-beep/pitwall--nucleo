# EXTERNAL CALC — BETA STORE TEAM ACCESS V0

Data: 22/09/2026  
Status: IMPLEMENTED / BETA PASS WITH SELLER PRODUCTION HOLD  
Implementation evidence: PR #56 merged on 22/09/2026.

## Objetivo

Permitir que uma loja beta opere o External Calc com contas individuais, sem compartilhar senha e sem misturar dados entre lojas.

## Modelo V0

```text
Loja/Tenant
├─ dono
└─ validador
   ├─ funcionario A
   ├─ funcionario B
   └─ funcionario C
```

O papel `vendedor` de producao continua separado.

## Por que `validador` e nao `vendedor`

A experiencia beta atual ainda pode expor informacoes internas, incluindo preco de fornecedor.

O papel futuro `vendedor` deve receber uma projecao server-side sem custos restritos.

Por isso:

- `dono`: acesso operacional privilegiado da propria loja;
- `validador`: acesso privilegiado temporario para beta;
- `vendedor`: continua bloqueado ate Seller Projection.

## Isolamento

Toda operacao continua derivando tenant do JWT:

```text
auth.uid()
  -> app_usuario
  -> tenant_id
  -> role
  -> policy
```

O browser nunca escolhe tenant.

Loja A nao pode acessar dados da Loja B.

## Convite

O dono gera um convite para nome + email.

O banco devolve o token bruto uma unica vez e persiste somente SHA-256.

O link esperado e:

```text
/cadastro?invite=<token>
```

O convidado cria a propria conta Supabase e reivindica o convite.

No claim:

1. usuario precisa estar autenticado;
2. email do JWT precisa ser exatamente o email convidado;
3. token precisa existir, estar ativo e dentro do prazo;
4. usuario nao pode pertencer a outro tenant;
5. `app_usuario` e criado com o tenant/role do convite;
6. claimed_by/claimed_at registram quem consumiu.

## Prazo

Convites V0 expiram em 7 dias.

## Permissoes

`validador` pode operar o External Calc no proprio tenant durante o beta:
- API de execucao;
- fila de revisao;
- Human Review;
- persistencia necessaria ao fluxo;
- leitura dos dados operacionais consumidos pelo runtime.

`validador` nao pode:
- criar outros validadores;
- revogar convites;
- ver learning candidates diretamente;
- administrar usuarios;
- usar dados de outro tenant.

Somente `dono` cria/revoga convites.

## Interacao com UserRateProfile

Quando o UserRateProfile atingir o gate de Settings:

- `dono` podera configurar somente o proprio perfil de taxas;
- `validador` podera configurar somente o proprio perfil de taxas durante o beta;
- identidade do perfil vem de `auth.uid()`, nunca de `user_id` escolhido pelo browser;
- nenhum usuario pode ler/escrever o perfil de outro usuario;
- taxas continuam sendo configuracao comercial do usuario, nao permissao de administracao de equipe;
- `vendedor` permanece fora desta superficie privilegiada ate Seller Projection.

Essa integracao ainda nao esta implementada enquanto os gates UserRateProfile G2–G7 estiverem pendentes.

## Gate

PASS quando:

1. dono continua operando;
2. validador consegue executar e revisar;
3. vendedor continua recebendo FORBIDDEN;
4. tenant continua derivado do JWT;
5. RLS exige tenant atual;
6. invite token nao e persistido em claro;
7. email convidado = email autenticado no claim;
8. convite nao pode ser reutilizado por outro usuario;
9. membership cross-tenant e negado;
10. reviewer_ref continua sendo auth.uid();
11. nenhuma service_role entra no browser/Worker;
12. C01-C05 permanecem intactos.

Current adjudication:

```text
BETA_TEAM_ACCESS = PASS
DONO = ALLOWED
VALIDADOR = ALLOWED_TEMPORARY_BETA
VENDEDOR = HOLD_UNTIL_SELLER_PROJECTION
```

## Bootstrap de uma nova loja beta

A criacao inicial de um novo tenant + convite de dono continua como operacao de plataforma durante o beta.

Depois que o dono reivindica a conta, ele proprio convida seus validadores.

Isso evita construir um painel global de administracao antes de a operacao multi-loja ser comprovada.
