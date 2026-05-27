## Context

O CampaignRenderer atual (Phase 4.1) renderiza um layout empilhado/amador que não atinge qualidade publicável. A composição usa divisão 55% imagem / 45% texto com posicionamento absoluto básico, sem tratamento visual de fundo, sem hierarquia de preço, sem integração de hook, e com CTA como botão desabilitado de UI em vez de elemento de campanha.

O contrato visual existente em `CAMPAIGN_VISUAL_SYSTEM.md` define zonas, tipografia, paletas e regras de fallback, mas a implementação atual não segue esse contrato — ela usa aproximações próprias. A Phase 4.2 precisa alinhar a implementação ao contrato visual, enriquecido pelo output da etapa 4.2.0 (UI/UX Pro Max).

A fase precisa resolver três problemas estruturais:
1. **Renderer fora do contrato visual** — zonas, proporções, cores e hierarquia não seguem o design system
2. **Hook existe no schema mas não é usado** — `commercial_copy.hook` é gerado pela IA mas ignorado pelo renderer e pelo painel
3. **CTA é UI button, não elemento de campanha** — o CTA atual é um `<button disabled>` genérico, sem tratamento visual de campanha

## Goals / Non-Goals

**Goals:**
- Estabelecer um contrato visual aprovado (4.2.0) que o renderer implemente fielmente
- Renderizar `commercial_copy.hook` como elemento visual na composição
- Renderizar `commercial_copy.cta` como elemento de campanha (não como UI button)
- Expandir o painel de ajustes para editar hook e CTA
- Expandir `CampaignAdjustments` e lógica de merge para incluir hook e CTA
- Implementar o template único `produto-oferta-comercial` conforme o contrato visual
- Aplicar fallbacks robustos: logo ausente → iniciais, cor ausente → paleta de segmento, preço original ausente → apenas promocional
- Imagem do produto ausente/inválida → estado explícito de erro, sem arte publicável
- Passar nos 7 critérios de publicabilidade

**Non-Goals:**
- Múltiplos templates ou variações visuais
- Escolha manual de template pelo lojista
- Export/download de imagem (Phase 5)
- Upload de logo
- Editor visual avançado
- Controles manuais de fonte, cor, posição, tamanho, margem ou layout
- Alterações em banco de dados, API routes ou navegação principal

## Decisions

### Decision 1: Etapa 4.2.0 como artefato de design, não de código

A etapa 4.2.0 (Commercial Art Direction) será executada com a skill UI/UX Pro Max e produzirá um contrato visual no formato de documento de design. Este contrato será referenciado pelo design.md e pelas specs, mas não será código.

**Rationale:** A fase 4.2.0 é um direcionamento visual que precisa ser discutido e aprovado antes de qualquer implementação. Colocá-la como etapa de design/contrato (não de código) evita que o agente de IA implemente CSS antes de ter direcionamento visual.

**Output esperado da 4.2.0:**
- Definição de composição e hierarquia visual
- Zonas e proporções
- Tratamento de imagem do produto (contain, crop, overlay)
- Bloco de preço (estilo, destaque, posição)
- Estilo do CTA como elemento de campanha
- Assinatura da loja (posição, estilo, fallback de iniciais)
- Fallbacks visuais para dados ausentes
- Amostras/mocks de referência do template `produto-oferta-comercial`

### Decision 2: Refatoração in-place do CampaignRenderer

O `CampaignRenderer` será reescrito no mesmo arquivo (`src/components/campaign/campaign-renderer.tsx`) sem criar um novo componente. A interface de props (`CampaignRendererProps`) permanece a mesma para não quebrar o `PreviewPage`.

```typescript
// Interface permanece idêntica — sem breaking change
interface CampaignRendererProps {
  spec: CampaignSpec;
  storeIdentity: StoreIdentitySnapshot;
  productImageUrl: string | null;
}

export function CampaignRenderer({ spec, storeIdentity, productImageUrl }: CampaignRendererProps) {
  // ...
}
```

**Rationale:** O PreviewPage importa e renderiza `CampaignRenderer` com essas props. Mudar a interface exigiria mudanças no PreviewPage, aumentando o escopo. A refatoração interna permite qualquer transformação visual sem impacto externo.

**Riscos:** Baixos — a interface pública permanece igual, mas a refatoração visual interna ainda pode introduzir regressões de layout.

### Decision 3: Hook e CTA entram no CampaignAdjustments

O tipo `CampaignAdjustments` será expandido para incluir `hook` e `cta`:

```typescript
export interface CampaignAdjustments {
  title?: string;
  discountedPriceDisplay?: string;
  badgeText?: string;
  hook?: string;         // NOVO
  cta?: string;          // NOVO
}
```

A lógica de merge no PreviewPage (`mergedSpec`) será expandida para aplicar os ajustes de hook e CTA ao spec antes de passar ao renderer.

**Rationale:** Consistência com o padrão existente — adjustments são overrides locais que o preview mergeia no spec. Hook e CTA seguem o mesmo fluxo que title, price e badge.

**Alternativa considerada:** Criar um estado separado no PreviewPage. Rejeitado porque duplicaria a lógica de merge e aumentaria a complexidade do componente sem benefício.

### Decision 4: Painel de ajustes ganha dois novos campos

O `CampaignAdjustmentsPanel` ganhará dois novos fieldsets:

1. **Hook/Benefício** — text input, label "Texto do Benefício", maxLength={120}, undo, mostra original
2. **CTA** — text input, label "Chamada para Ação", maxLength={60}, undo, mostra original

Ambos seguem o mesmo padrão dos campos existentes (title, price, badge): input → `onAdjustmentChange(key, value)` → merge no preview → re-render.

**Rationale:** O painel já estabeleceu o padrão de "ajuste rápido orientado a conteúdo, não a design". Hook e CTA são conteúdo — encaixam naturalmente.

### Decision 5: Imagem do produto ausente → sem gate de publicabilidade

Se `productImageUrl` for null, undefined ou a imagem falhar ao carregar (onerror no PreviewPage), o CampaignRenderer deve exibir um estado explícito de "Imagem do produto indisponível" no lugar da zona de imagem. A campanha não deve passar no gate de publicabilidade (4.2.3) sem imagem real do produto.

**Fluxo de validação:**
1. PreviewPage já detecta `productImageError` via `new Image().onerror` (implementado na Phase 4.1)
2. Quando `productImageError === true`, o PreviewPage passa `productImageUrl={null}` para o renderer
3. Renderer exibe estado de erro na zona de imagem
4. O gate de publicabilidade (4.2.3) verifica se `productImageUrl` é válido — se não, a arte não passa

**Rationale:** Campanha de produto + oferta sem imagem do produto não é uma campanha publicável. Fallback profissional faz sentido para logo, cor, cidade — não para o produto em si.

### Decision 6: Fundo visual segue CAMPAIGN_VISUAL_SYSTEM.md §8

O fundo da composição usará as cores de background por segmento já definidas na `SEGMENT_PALETTES` em `types.ts`, que seguem `CAMPAIGN_VISUAL_SYSTEM.md §8`. O tratamento visual adicional (gradiente sutil, overlay) será definido pelo contrato visual da 4.2.0.

**Estado atual:** `resolveCampaignBackgroundColor()` já implementa a lógica de segmento → cor de fundo. O que falta é o tratamento visual (não apenas cor sólida).

**Decisão:** Aguardar o contrato visual da 4.2.0 para definir o tratamento exato. Hipótese atual: background com gradiente radial sutil ou overlay sutis por segmento.

### Decision 7: MockProvider atualizado para hooks e CTAs úteis

O MockProvider atual gera `commercial_copy.hook` e `commercial_copy.cta`, mas os valores podem ser genéricos demais para testar a arte. A etapa 4.2.1 deve revisar e melhorar os valores gerados pelo mock para que sejam visualmente úteis durante o desenvolvimento.

**Exemplo de melhoria:**
- Hook: "O conforto que você merece!" (em vez de "Aproveite esta oferta")
- CTA: "Garanta o seu hoje!" (em vez de "Compre agora")

**Rationale:** Mock deve gerar dados que pareçam reais para validar a composição visual. Hooks e CTAs genéricos demais podem mascarar problemas de layout.

## Risks / Trade-offs

- **[4.2.0 atrasa todo o resto]** A etapa 4.2.0 com UI/UX Pro Max é bloqueadora. Se ela demorar, a implementação para. → Mitigação: 4.2.0 tem escopo bem definido (contrato visual de um template único), não uma pesquisa de design aberta.
- **[Renderer reescrito pode introduzir regressões]** Mudar o layout interno do CampaignRenderer pode quebrar casos de borda que funcionavam. → Mitigação: Manter a interface de props idêntica e validar com mock + navegador antes de fechar a fase.
- **[Expansão do painel pode ficar confusa]** Com 5 campos (title, hook, price, badge, cta), o painel pode ficar sobrecarregado. → Mitigação: Agrupar por tipo (campos de copy / campos de oferta) com separadores visuais.
- **[PreviewPage pode crescer demais]** A lógica de merge e os estados do PreviewPage já têm complexidade moderada. → Mitigação: Extrair a lógica de merge para um hook ou utilitário separado se necessário.
- **[Gate de publicabilidade é subjetivo]** Os 7 critérios são perguntas de julgamento humano. → Mitigação: Checklist objetivo com exemplos visuais de "sim" e "não". O gate é manual, não automatizado.
