# Convenções da Pitstop Imports

Este arquivo guarda os parâmetros fixos da operação. É a "estabilidade" da skill: quando estes dados estão registrados, toda planilha, campanha e análise sai coerente com a realidade da loja em vez de genérica. Atualize este arquivo sempre que um parâmetro mudar (fornecedor novo, faixa de margem nova, estágio de funil ajustado).

> Preencha os campos marcados com [a confirmar]. A skill funciona sem eles, mas fica muito mais precisa com eles preenchidos.

## Negócio
- **Loja:** Pitstop Imports
- **Praça:** Rio de Janeiro, RJ
- **O que faz:** compra, venda e upgrade de iPhone e produtos Apple importados
- **Canal principal de venda e atendimento:** Instagram + WhatsApp
- **Time:** dono (estratégia, conteúdo, sistemas) / irmão (avaliação de upgrade) / Leandro (entregas)

## Funil de vendas (estágios padrão)
Use estes estágios em todo CRM e pipeline, salvo pedido em contrário:
1. Contato Inicial
2. Qualificação
3. Proposta
4. Negociação
5. Fechado Ganho
6. Fechado Perdido

Probabilidade sugerida por estágio (para valor ponderado): Contato 10%, Qualificação 25%, Proposta 50%, Negociação 75%, Ganho 100%, Perdido 0%.

## Origem de leads (lista de dropdown)
Instagram, WhatsApp, Indicação, Cliente recorrente, Outro. [ajustar conforme realidade]

## Produtos / modelos
Linhas trabalhadas: iPhone, AirPods, Apple Watch, iPad, acessórios. [a confirmar modelos e armazenamentos mais vendidos]

Padrão de cadastro de produto: sempre separar **modelo** e **armazenamento** em colunas distintas (ex.: "iPhone 15 Pro" / "256 GB"), nunca num campo só. Isso facilita filtro, precificação e relatório.

## Precificação
- **Moeda:** Real (BRL), formatar como moeda.
- **Câmbio USD/BRL:** manter numa célula única da aba de configuração e referenciar; nunca chumbar na fórmula. [valor atual a confirmar]
- **Faixa de margem alvo:** [a confirmar]
- **Atualização de preço de fornecedor:** rotina de segunda-feira; o dono envia preços novos e a tabela é atualizada.

## Fornecedores
[a confirmar lista de fornecedores e condições]

## Integrações já conectadas
Canva, Notion, Google Drive, Google Calendar (via MCP). Notion: Central de Operações é o hub de navegação; Área de Upgrade/Time é usada pelo irmão para avaliações.

## Preferências de trabalho do dono
- Respostas diretas, estruturadas, orientadas à execução.
- Análise crítica antes de validação. Nada de bajulação.
- Português do Brasil, muitas vezes por voz.
- Sem travessão "—" nos textos.
- Para calendário de conteúdo: grade vertical por dia (um card por dia, chips coloridos por formato: coral = reel/falado, azul = estático/carrossel, cinza = story; marcadores verde = novo, âmbar = ajustar).
