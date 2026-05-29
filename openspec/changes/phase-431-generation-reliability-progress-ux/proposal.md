## Why

A geração de campanhas leva de 80s a 2min+, mas a UI não comunica progresso — o usuário vê uma tela congelada e não sabe se o processo está rodando ou travou. Além disso, falhas de geração (timeout, erro de provider, revisão por visão rejeitando a imagem) não têm diagnóstico claro, retry automatizado ou fallback de modelo, resultando em experiência frustrante e abandono. A validação por visão é útil mas precisa ser menos cega e mais diagnóstica, diferenciando o tipo de falha para dar respostas úteis ao usuário.

## Non-Goals (explicitamente fora do escopo da 4.3.1)

Os seguintes itens estão **fora** do escopo desta fase e serão tratados nas fases seguintes:

- **Direção criativa e contexto** (4.3.2): Decisão de densidade visual por segmento/produto, CTA/economia/urgência como repertório opcional do diretor, tema visual guiado por produto, identidade de loja, campo "detalhes" como argumento comercial.
- **Acabamento visual e identidade de loja** (4.3.3): Hierarquia visual produto-título-preço-badge-CTA, contraste/legibilidade/espaçamento/sombras, checklist de publicabilidade, uso de logo real vs assinatura textual gerada, persistência de brand lockup.
- **Review, Adjust & Export** (Phase 5): Bloqueado por 4.3.3, não por 4.3.
- **Troca de provedor de IA**: Fallback Gemini não será implementado agora — apenas arquitetura preparada para suportá-lo no futuro.
- **Camada de edição**: Nenhuma interface de edição visual da campanha (camadas, reposicionamento, etc.).

## What Changes

- **Barra/estado de progresso por fases**: UI exibe etapas discretas da geração (validação, prompt, geração, revisão) com indicador visual de qual fase está rodando.
- **Mensagens de espera para geração longa**: Texto dinâmico que informa o usuário sobre o que está acontecendo, evitando sensação de travamento.
- **Logs diagnósticos por etapa**: Cada fase da geração produz logs estruturados visíveis para depuração.
- **Erros estruturados por fase**: Tipos de erro bem definidos para cada etapa, com mensagens claras para o usuário.
- **Timeout controlado**: Geração com prazo máximo; se estourar, falha controlada com diagnóstico.
- **Retry controlado**: Tentativas automáticas em falhas recuperáveis (rate limit, erro temporário de provider).
- **Fallback de modelo/provedor**: Se o modelo primário falhar, tentar alternativa (ex: Gemini como fallback futuro).
- **Preservação de input em caso de falha**: Dados da campanha não são perdidos se a geração falhar.
- **Diferenciação de tipos de falha**: Resposta sem imagem, revisão vazia, imagem insuficiente, baixa confiança, produto não correspondente, erro do provider, timeout, dados inválidos — cada um com tratamento e mensagem específicos.
- **Preço original não obrigatório**: Campo `originalPrice` deixa de ser obrigatório para certos tipos de oferta.

## Capabilities

### New Capabilities
- `generation-progress`: Acompanhamento em tempo real das fases de geração com indicador visual, mensagens de espera e logs diagnósticos.
- `structured-error-handling`: Sistema de erros tipados por fase de geração com mensagens claras para o usuário e diagnóstico para o desenvolvedor.
- `generation-retry-fallback`: Lógica de retry automático para falhas recuperáveis e fallback entre modelos/provedores quando disponível.
- `generation-timeout`: Controle de timeout por fase e global com falha controlada e diagnóstico.

### Modified Capabilities
- `ai-image-generation`: Adicionar fases de geração (validação → prompt → geração → revisão), suporte a retry/fallback, timeout controlado, preservação de input em falha.
- `image-quality-review`: Retornar tipo estruturado de falha em vez de booleano simples; diferenciar "review vazio", "produto não corresponde", "baixa confiança", "imagem insuficiente".
- `campaign-preview-page`: Exibir progresso por fases, estado de erro por fase, mensagens de espera dinâmicas, logs diagnósticos.

## Impact

- **Services**: `ImageGenerationService` — adicionar fases, retry, fallback, timeout, progress callbacks. `ImageReviewService` — tipos de falha estruturados.
- **UI**: `CampaignPreviewPage` — novo componente de progresso e estado de erro. Substituir loading spinner simples por indicador multifase.
- **Providers**: Camada de abstração entre `ImageGenerationService` e provedor para suportar fallback.
- **Types**: Novos tipos `GenerationPhase`, `GenerationError`, `RetryPolicy`, `TimeoutConfig`, `ReviewFailureType`.
- **Dependencies**: Nenhuma nova dependência externa prevista. Fallback Gemini é future-proof, não será implementado agora.

## Próximas Fases Planejadas

Estas fases estão registradas como próximos passos — seus escopos **não** fazem parte da 4.3.1.

### Phase 4.3.2 — Creative Direction & Context Awareness

**Objetivo**: Melhorar a "contratação" do agente diretor de arte/marketing, preservando liberdade criativa sem transformar o prompt em checklist rígido.

**Escopo esperado**:
- Diretor decide densidade visual conforme segmento, produto, objetivo e tom de voz
- CTA, economia, urgência, benefícios, selos, ícones e microcopy como repertório opcional do diretor, não obrigação fixa
- Produto/campanha guiam o tema visual da peça
- Loja guia identidade, assinatura, cor e contexto
- Conflito segmento × categoria: preservar marca da loja, adaptar campanha ao universo do produto
- Campo "detalhes" lido e usado quando relevante (ex: "vários sabores disponíveis" vira argumento visual)

### Phase 4.3.3 — Publishability & Store Identity Polish

**Objetivo**: Elevar acabamento final para arte realmente publicável.

**Escopo esperado**:
- Hierarquia visual: produto, título, preço, badge e CTA
- Acabamento: contraste, legibilidade, espaçamento, sombras, composição
- Checklist de publicabilidade
- Uso do nome/logo da loja
- Se `stores.logo_url` existir, usar como logo real
- Se não existir, pode gerar assinatura textual visual na peça (sem persistir como `stores.logo_url`)
- Persistência de assinatura/brand lockup aprovado fica para fase futura

### Phase 5 — Bloqueada por 4.3.3

A Phase 5 (Review, Adjust & Export) está bloqueada pela conclusão da 4.3.3, **não** pela 4.3 como um todo. Isso significa que 4.3.1 e 4.3.2 não precisam esperar a conclusão da 4.3 inteira para desbloquear a Phase 5 — apenas a 4.3.2 + 4.3.1 não bastam; é necessário também a 4.3.3.
