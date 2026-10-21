# External Calc VS4 — Generalização composicional e risco comercial

Data: 21/10/2026. PR #186 (DRAFT), empilhado em #185/VS3 → #184/VS2 → #183/VS1 → #182/método.

## Evidência do primeiro desafio pós-freeze
- CI #39626077733: **SUCCESS**; corpus sintético gerado após checkout do SHA, semente revelada somente no artefato posterior.
- Oracle independente: **113 ofertas**. VS2: **113 propostas**, 113 correspondências exatas, zero divergências de proveniência.
- VS3 e avaliador VS4: **113 exatas com origem**, 0 faltantes, 0 extras, 0 inconsistências de origem, **0 erros críticos silenciosos nesta amostra** e **0 abstenções**.
- Todas permanecem **REVIEW_REQUIRED**, nenhuma proposta foi autorizada. Isso é prova **SYNTHETIC_EXACT_REVIEW_PASS**, não autorização de importação comercial nem generalização externa.
- Suite negativa `proof-vs4.mjs`: altera preço, falsifica evidência ou simula oferta autorizada; avaliação bloqueia e identifica o erro. CI de método #39626077781 deve ser conferido separadamente antes de declarar fechamento total.
- Artefatos temporários e hashes estão no workflow; a fonte sintética revelada deixa de ser cega imediatamente após este ensaio.

## Métricas obrigatórias do VS4
- `exact_with_lineage`: identidade de modelo + capacidade + cor + condição + preço e origem documental correta.
- `wrong_fields`: propostas que não correspondem ao oracle.
- `wrong_lineage`: campos coincidem, mas atribuição de origem não corresponde.
- `missing`: ofertas do oracle sem proposta equivalente.
- `critical_silent_errors`: proposta errada ou origem errada **não detectada como CRITICAL no VS3**, medida contra oracle independente.
- `review_required`, `material_abstentions`, `global_risks`: separar incerteza e perda de cobertura.
- `authorized_offers`: sempre zero no ambiente shadow.

## Limites e próximo gate
Este primeiro desafio não incluiu ambiguidades deliberadamente insolúveis, tendo 0 abstenções. **Não interpretar esse zero como qualidade de calibração**. A validação de VS4 exige *um corpus adversarial pré-registrado* com expectativas independentes tanto para associações válidas quanto para abstenções materiais.

Métrica de calibração complementar a estabelecer antes do próximo desafio: entre casos onde o oracle determina que não existe vínculo único, quantos foram indevidamente propostos, quantos foram corretamente recusados e quantas ofertas válidas deixaram de ser cobertas. Negativos devem incluir preços contraditórios, cor ambígua, preços sem unidade, número de contato, condições conflitantes e linhas sem âncora, preservando os positivos.

Não alterar C01, Core FROZEN, frontend, Cloudflare, Supabase, autenticação ou política de promoção. PRs ainda DRAFT; Gate 1 operacional **NO-GO**. VS5 depende de VS4 com positivos e negativos antes de integrar.

## Checkpoint adicional — calibração adversarial conhecida (21/10/2026)

- CI [#39626541906](https://github.com/vinialbuquerquepitstop-beep/pitwall--nucleo/actions/runs/39626541906): **PASS** em avaliação adversarial `KNOWN_DEV`.
- **5/5 situações inseguras** resultaram em abstenção material com motivo rastreável, **0 propostas inseguras**: cores concorrentes com preço único não compartilhado, condição contraditória, condição ausente, ausência de preço e condição em colunas conflitante.
- **3/3 casos válidos** foram propostos corretamente: cor→preço, preço→cor e colunas tipadas. Nenhuma oferta autorizada.
- CI [#39626541848](https://github.com/vinialbuquerquepitstop-beep/pitwall--nucleo/actions/runs/39626541848): desafio sintético de associação + revisão gerado depois do commit, **108/108 correspondências exatas**; zero origem incorreta, zero oferta faltante ou excedente, zero erro crítico silencioso **no corpus avaliado**.
- O conjunto adversarial é **especificado manualmente e conhecido**, não um desafio cego. Ele demonstra rejeição dos casos enumerados, **não** robustez universal a ambiguidades imprevisíveis.
- Ainda é necessário **gerador composicional adversarial com oracle de abstinência independente**, após freeze, para medir recall de incertezas em combinações não vistas. Os 108 casos positivos usam a mesma família de gerador anterior.
- `VS4_DEVELOPMENT_AND_CONTROLS=PASS`; `VS4_ADVERSARIAL_BLIND=UNVERIFIED`; `C01_OPERATIONAL=NO_GO`.
