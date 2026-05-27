## Why

A Phase 4.1 entregou o CampaignRenderer funcional, mas a arte gerada usa layout empilhado/amador — não atinge qualidade publicável. O lojista precisa de uma arte que pareça profissional de primeira, sem ajustes manuais. Esta fase transforma o renderer atual em um motor de arte comercial publicável com hierarquia visual clara, produto valorizado, bloco de preço forte, CTA de campanha e identidade da loja digna.

## What Changes

- **Novo contrato visual** — Art Direction documentada com a skill UI/UX Pro Max, definindo composição, hierarquia, zonas, tratamento de imagem, bloco de preço, CTA e assinatura para o template `produto-oferta-comercial`
- **4.2.0 bloqueia implementação** — A implementação do renderer não começa antes da conclusão da etapa 4.2.0 — Commercial Art Direction. Isso garante que todo o CSS e componentes sigam o direcionamento visual aprovado, não o contrário
- **Hook/benefício na arte** — `commercial_copy.hook` já existe no schema da IA mas não é renderizado. Passa a ser exibido como elemento visual na composição
- **CTA editável no painel** — Ajuste rápido para `commercial_copy.cta` adicionado ao `CampaignAdjustmentsPanel`
- **Hook editável no painel** — Ajuste rápido para `commercial_copy.hook` adicionado ao `CampaignAdjustmentsPanel`
- **Renderer refatorado** — CampaignRenderer reescrito para seguir o contrato visual do template único `produto-oferta-comercial`, com zonas redefinidas, hierarquia profissional e fallbacks robustos
- **Fundo visual tratado** — Background com base no segmento ou marca, com tratamento visual (gradiente, overlay, textura) em vez de cor sólida simples
- **Tratamento da imagem do produto** — Melhor integração da imagem do produto na composição (contain/crop inteligente, sombra, vinheta)
- **Bloco de oferta/preço** — Preço promocional como elemento hero com destaque visual, original com strikethrough estilizado
- **CTA como elemento de campanha** — CTA integrado visualmente, não apenas um botão desabilitado
- **Assinatura da loja melhorada** — Logo/initials com apresentação mais profissional e integrada à composição
- **Gate de publicabilidade** — Critérios objetivos (checklist) para aprovar a arte como publicável antes de seguir para Phase 5

## Non-Goals

- Não implementar múltiplos templates
- Não criar variações visuais
- Não permitir escolha manual de template pelo lojista
- Não adicionar export/download
- Não adicionar upload de logo
- Não criar editor visual avançado
- Não adicionar controles manuais de fonte, cor, posição, tamanho, margem ou layout
- Não alterar banco de dados
- Não alterar navegação principal

## Phase Breakdown

### 4.2.0 — Commercial Art Direction
Define, com UI/UX Pro Max, o contrato visual implementável do template único `produto-oferta-comercial`. Esta etapa é **bloqueadora** para a implementação do renderer — Nenhuma implementação visual do renderer deve começar antes deste contrato estar aprovado.

### 4.2.1 — Content, Types & Adjustments
Garante que hook e CTA existam no schema da IA, sejam úteis para a arte e possam ser editados no painel de ajustes rápidos. Expande os tipos de ajustes locais e a lógica de merge do preview.

### 4.2.2 — Commercial Renderer
Refatora o CampaignRenderer para abandonar o layout empilhado e implementar o template comercial único conforme o contrato visual da etapa 4.2.0.

### 4.2.3 — Visual Validation Gate
Valida com mock, OpenAI real e navegador usando os critérios de publicabilidade antes de liberar para Phase 5.

## Acceptance Criteria

- A arte não usa mais layout empilhado
- O hook/benefício aparece visualmente na campanha
- O CTA aparece como elemento de campanha, não como botão de UI
- O preço promocional aparece como bloco de oferta forte
- A assinatura da loja parece profissional com logo ou iniciais
- A ausência de logo não quebra a arte
- A ausência/erro da imagem do produto mostra estado explícito e a campanha **não passa** no gate como arte publicável sem imagem real do produto
- O painel permite editar hook e CTA
- Mock com dados mínimos funciona e gera arte coerente
- Mock com dados completos funciona
- OpenAI real gera conteúdo compatível com a arte
- `npm run typecheck`, `npm run lint` e `npm run build` passam sem erros
- Os 7 critérios de publicabilidade são respondidos como "sim"

## Capabilities

### New Capabilities
- `commercial-campaign-template`: Contrato visual e implementação do template único produto-oferta-comercial — composição, hierarquia, zonas, fallbacks
- `campaign-hook-copy`: Geração e exibição do hook/benefício na arte da campanha, com edição no painel de ajustes
- `campaign-cta-editing`: Edição do CTA no painel de ajustes rápidos

### Modified Capabilities
- `campaign-visual-renderer`: Renderer atual reescrito para implementar o template comercial único. Zonas, hierarquia, tratamento de imagem e fallbacks são alterados. A assinatura visual muda do layout empilhado para o layout profissional definido no contrato visual
- `campaign-preview-page`: Painel de ajustes ganha campos de hook e CTA. Tipos de ajustes locais e lógica de merge do preview expandidos para suportar edição de hook e CTA. Layout da página permanece igual
- `ai-campaign-intelligence`: Nenhuma mudança estrutural no schema da IA é esperada — `commercial_copy.hook` e `commercial_copy.cta` já existem. Garantir que o MockProvider gere hooks e CTAs úteis para a arte

## Impact

> **Nota:** Os caminhos abaixo devem ser confirmados contra o código real antes da implementação. Esta lista é uma estimativa inicial.

- `src/components/campaign/campaign-renderer.tsx` — Reescrever implementação do template único
- `src/components/campaign/campaign-adjustments-panel.tsx` — Adicionar campos de hook e CTA
- `src/components/campaign/types.ts` — Expandir `CampaignAdjustments` com hook e cta
- `src/app/campaign/preview/page.tsx` — Expandir lógica de merge do preview para hook e cta
- `src/lib/campaign-intelligence/schema.ts` — Revisar se `hook` e `cta` estão presentes (esperado: sim)
- `src/lib/campaign-intelligence/providers/mock.ts` — Melhorar geração de hook e CTA se necessário
- **Sem impacto** em API routes, database, store identity, ou navegação
- **Sem novas dependências** — apenas Tailwind CSS + lucide-react existentes
