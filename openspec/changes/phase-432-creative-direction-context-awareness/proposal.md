## Why

A geração atual produz arte visual consistente, mas a IA ainda opera com direção criativa genérica — o briefing interno trata todo produto como equivalente dentro do segmento da loja, ignorando quando um produto pertence a uma categoria diferente do segmento principal. Além disso, o campo "detalhes adicionais" do lojista raramente influencia a composição visual ou o microcopy, e a revisão de qualidade pós-geração não recebe contexto sobre decisões tomadas na pré-validação (sugestões aceitas, conflitos permitidos, overrides), causando desalinhamento entre validar, gerar e revisar. O resultado é uma arte correta mas que ainda não atinge o efeito "uau" — falta inteligência contextual para aproximar cada campanha do que um diretor de marketing real produziria.

## What Changes

- **Briefing interno estruturado**: Evolução controlada do prompt `campaign-image-director.md` — preservar a estrutura e tom atuais, adicionar seções de direção criativa que consideram segmento da loja, categoria inferida do produto, objetivo comercial, tom de voz e detalhes adicionais como repertório comercial
- **Context Awareness (segmento × categoria)**: Quando o produto pertence a categoria diferente do segmento da loja (ex: loja de moda anunciando energético), a direção criativa se adapta ao universo do produto sem abandonar a identidade da loja como assinatura
- **Detalhes adicionais como repertório**: "vários sabores", "poucas unidades", "cores variadas", "oferta por tempo limitado" viram microcopy, badge ou direção visual quando relevantes
- **Validation → Review alignment**: A revisão visual (`ImageReviewService`) recebe contexto sobre o resultado da pré-validação, sugestão aceita, campos corrigidos, conflitos leves permitidos e overrides do usuário — evitando que a revisão tente corrigir divergências já aceitas
- **Qualidade comercial da arte**: Melhorias na composição visual persuasiva, hierarquia, legibilidade, destaque de preço/oferta e aderência ao produto na campanha única gerada
- **Carryover 4.3.1 — "Detalhes técnicos"**: O painel colapsável já está implementado em `generation-progress.tsx:180-205` e só renderiza quando `diagnostics.length > 0`. O pipeline/stream de geração deve emitir eventos técnicos mínimos, reais e sanitizados durante fases relevantes (ex: modelo utilizado, fase concluída, tentativa de retry). O `GenerationProgress` apenas exibe o que receber — sem criação artificial de logs.

## Out of Scope

Os seguintes itens estão **fora** do escopo desta fase:

- Compliance legal profundo por segmento
- Subsegmentação avançada
- Editor avançado (camadas, reposicionamento, estilo livre)
- Variações visuais / múltiplas artes por campanha
- Escolha manual de templates pelo lojista
- Fluxo tipo Canva
- Exportação final (PNG/JPG)
- Histórico de campanhas
- Automação / publicação direta em redes sociais
- Reescrita ampla do pipeline de geração — a fase evolui o que já funciona sem quebrar o fluxo validado na 4.3.1

## Capabilities

### New Capabilities
- `creative-direction-context`: Briefing interno estruturado com persona de diretor de marketing consciente de segmento, categoria inferida do produto, objetivo comercial, tom da loja e repertório de detalhes adicionais
- `validation-review-alignment`: Alinhamento entre pré-validação, geração e revisão — a revisão visual recebe contexto sobre validação (sugestão aceita, conflito permitido, override, correção aplicada) para não tentar corrigir divergências já aprovadas

### Modified Capabilities
- `prompt-management`: Evolução controlada do prompt `campaign-image-director.md` para incluir direção criativa contextual (segmento, categoria inferida do produto, objetivo, repertório de detalhes), preservando a estrutura existente. Novas variáveis de template podem ser adicionadas. O prompt `campaign-input-visual-check.md` pode precisar de ajuste para informar a categoria inferida do produto detectada na imagem.
- `ai-image-generation`: `ImageGenerationService` passa contexto de validação (`inputCorrections`, overrides, conflitos permitidos) para as fases seguintes — especialmente para `ImageReviewService` — garantindo alinhamento. O método `assemblePrompt` adiciona contexto de direção criativa.
- `image-quality-review`: `ImageReviewInput` é estendido para receber `validationContext` (correções aplicadas, overrides, conflitos permitidos). Após o parse do resultado bruto em `parseResult()`, uma etapa explícita de alinhamento (`applyValidationContextToReviewResult()`) filtra issues que correspondem a divergências já aprovadas, sem poluir a lógica interna de parse.
- `campaign-preview-page`: O pipeline/stream de geração emite eventos técnicos sanitizados por fase quando apropriado. `GenerationProgress` apenas exibe os logs recebidos — sem lógica de geração artificial de logs.

## Impact

- **Services**: `ImageGenerationService` — estender `buildPromptVariables` e `assemblePrompt` para incluir contexto de direção criativa; passar `validationContext` como parte do input para `ImageReviewService`. `ImageReviewService` — estender `ImageReviewInput` com `validationContext`; aplicar `applyValidationContextToReviewResult()` como etapa explícita após `parseResult()` para alinhar revisão com overrides.
- **Prompts**: Evolução controlada do `campaign-image-director.md` — preservar seções existentes, adicionar direção criativa contextual (persona, regras de segmento × categoria, repertório de detalhes). `campaign-input-visual-check.md` — ajuste para informar categoria inferida do produto detectada na imagem.
- **Types**: Novos tipos `CreativeBrief`, `ValidationContext`, `SegmentCategoryOverride`. Estender `ImageReviewInput`, `ImageReviewResult`.
- **Stream/Logs**: Pipeline de geração emite eventos técnicos sanitizados por fase quando apropriado. `GenerationProgress` apenas exibe — sem lógica de geração artificial.
- **Dependencies**: Nenhuma nova dependência externa. Tudo usa os mesmos provedores OpenAI existentes.
