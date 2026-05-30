## Context

O fluxo atual de geração (4.3.1) executa: input validation → prompt assembly → image generation (com retry) → quality review → done. Três lacunas principais persistem:

1. **Direção criativa genérica**: O `campaign-image-director.md` usa o segmento da loja como único guia visual, ignorando quando o produto pertence a categoria diferente (ex: loja de moda anunciando energético). O campo "detalhes adicionais" do lojista é interpolado no prompt mas sem interpretação semântica — não vira direção visual, microcopy ou badge.

2. **Desalinhamento validação → revisão**: O `ImageReviewService` não recebe contexto sobre decisões da pré-validação. Se o usuário aceitou uma sugestão de nome (`auto-fix`) ou prosseguiu com conflito permitido (`override`), a revisão pode flagrar exatamente essa divergência como erro, gerando falso positivo e ciclo de regeneração desnecessário.

3. **Logs técnicos esporádicos**: O painel "Detalhes técnicos" no `GenerationProgress` só aparece se `diagnostics.length > 0`. Como poucas fases emitem `detail`, o painel frequentemente fica oculto durante a geração.

**Arquitetura atual relevante:**
- `ImageGenerationService` (`src/lib/image-generation/services/image-generation-service.ts`) — orquestra o pipeline, monta variáveis do prompt em `buildPromptVariables()` e o texto final em `assemblePrompt()`
- `InputValidationService` (`src/lib/image-generation/services/input-validation-service.ts`) — valida produto vs imagem, retorna classificação + nome corrigido
- `ImageReviewService` (`src/lib/image-generation/services/image-review-service.ts`) — revisa imagem gerada, retorna `ImageReviewResult` com issues e `failureType`
- `PromptLoader` (`src/lib/image-generation/prompt-loader.ts`) — carrega e interpola `{{variable}}` nos prompts
- `campaign-image-director.md` (`prompts/campaign-image-director.md`) — prompt de direção criativa para geração de imagem
- `campaign-input-visual-check.md` — prompt de validação produto vs imagem

## Goals / Non-Goals

**Goals:**
- Evoluir o `campaign-image-director.md` com direção criativa contextual (persona por segmento, adaptação categoria inferida × segmento, repertório comercial dos detalhes adicionais)
- Inferir a categoria do produto durante a input validation existente (sem chamada extra de API)
- Passar contexto de validação (`inputCorrections`, overrides, conflitos permitidos) para a revisão de qualidade
- Aplicar etapa explícita de alinhamento pós-revisão: `applyValidationContextToReviewResult()` filtra issues que correspondem a divergências já aprovadas pelo usuário
- Garantir que o pipeline emita eventos técnicos mínimos, reais e sanitizados por fase para que o painel "Detalhes técnicos" tenha conteúdo para exibir
- Preservar todo o fluxo validado da 4.3.1 — nada é reescrito, apenas estendido

**Non-Goals:**
- Reescrita do pipeline de geração
- Nova chamada de API para inferência de categoria (reusa a validação existente)
- Editor avançado, variações, templates manuais, exportação, histórico, publicação
- Compliance legal por segmento
- Subsegmentação avançada
- Mudança no schema do banco de dados

## Decisions

### Decision 1: Inferência de categoria do produto na input validation existente

**Contexto:** Precisamos saber a categoria inferida do produto para adaptar a direção criativa quando ela difere do segmento da loja. Adicionar uma chamada separada de IA aumenta latência e custo.

**Decisão:** Estender o prompt `campaign-input-visual-check.md` para que o modelo de visão também retorne um campo `inferredCategory` — a categoria inferida do produto analisando a imagem. O `InputValidationService` já chama o modelo de visão com a imagem do produto; basta adicionar o campo ao JSON de resposta e ao tipo `InputValidationResult`.

```typescript
// Extensão do retorno
interface InputValidationResult {
  classification: "match" | "auto-fix" | "conflict" | "strong_conflict" | "low-confidence";
  confidence: number;
  correctedProductName?: string;
  suggestedProductName?: string;
  reason?: string;
  inferredCategory?: string; // NOVO — ex: "bebidas-energeticos", "calcados-esportivos"
}
```

**Por que não uma chamada separada?** Evita latência adicional (~2-5s) e custo de tokens. O modelo já está analisando a imagem; pedir um campo extra no JSON é praticamente zero de custo incremental.

**Por que não extrair do `CampaignIntelligenceService`?** Esse serviço opera sobre os dados textuais (produto, preço, loja) sem acesso à imagem. A categoria inferida precisa da imagem para ser precisa.

### Decision 2: CreativeBrief como extensão de `buildPromptVariables`

**Contexto:** O diretor de IA precisa de mais contexto do que simples variáveis interpoladas — precisa saber quando o produto é de categoria diferente da loja, quais detalhes adicionais são comercialmente relevantes, e qual o tom/objetivo da campanha.

**Decisão:** Estender o método `buildPromptVariables()` no `ImageGenerationService` para incluir novas variáveis que alimentam o prompt evoluído:

```typescript
private buildPromptVariables(body: GenerateImageRequest, effectiveProductName: string, inferredCategory?: string): Record<string, string> {
  // Variáveis existentes (preservadas)
  // ...
  
  // NOVAS variáveis de direção criativa
  const hasCategoryConflict = inferredCategory && body.storeSegment && !this.isSameCategory(inferredCategory, body.storeSegment);
  
  return {
    // ...variáveis existentes...
    
    // Direção criativa
    creativePersona: `Você é um diretor de marketing especializado em ${this.getSegmentLabel(body.storeSegment)}.`,
    inferredCategory: inferredCategory ?? body.storeSegment,
    hasCategoryConflict: hasCategoryConflict ? "sim" : "nao",
    categoryConflictDirective: hasCategoryConflict
      ? `ATENÇÃO: O produto anunciado é da categoria "${inferredCategory}", que é diferente do segmento principal da loja "${body.storeSegment}". A direção visual deve refletir o universo de ${inferredCategory}. A identidade da loja (nome, paleta, logo) deve aparecer como assinatura, não como tema visual.`
      : "",
    
    // Repertório comercial
    commercialRepertoire: this.buildCommercialRepertoire(body),
    
    // Validação
    inputValidationSummary: this.buildValidationSummary(body, effectiveProductName),
  };
}
```

`buildCommercialRepertoire()` analisa campos como `additionalDetails`, `availabilityNotes`, `validity` e extrai argumentos comercialmente acionáveis (ex: "vários sabores disponíveis" → "Disponível em vários sabores"). A saída é uma string em PT-BR inserida no prompt como repertório opcional do diretor — não como instrução obrigatória.

`buildValidationSummary()` gera um resumo sanitizado do que ocorreu na validação para ser incluído no prompt de revisão (ver Decision 4).

### Decision 3: `validationContext` no `ImageReviewInput`

**Contexto:** A revisão atual recebe apenas `{ productName, storeName, originalPrice, discountedPrice }` e não sabe se houve correção automática, override de conflito, ou campos ajustados pelo usuário.

**Decisão:** Estender `ImageReviewInput` com um campo `validationContext` opcional:

```typescript
interface ValidationContext {
  inputCorrection?: {
    field: "productName";
    from: string;
    to: string;
    reason: string;
  };
  // generated_product_mismatch NUNCA entra aqui — se a IA gerou produto diferente,
  // a geração deve falhar/regenerar. Override do usuário na pré-validação não autoriza
  // a imagem final sair com outro produto.
  allowedConflicts?: Array<{
    type: "product_image_conflict" | "product_image_low_confidence";
    userAction: "user_confirmed_continue" | "accepted_suggestion";
  }>;
  overrides?: {
    productImageCheck?: "user_confirmed_continue";
  };
}
```

O prompt `campaign-image-reviewer.md` é atualizado para incluir a seção de contexto de validação:

```markdown
## Contexto de Validação
- O nome do produto foi corrigido automaticamente de "{{originalProductName}}" para "{{correctedProductName}}" (motivo: {{correctionReason}}). A revisão deve usar "{{correctedProductName}}" como referência.
- O usuário confirmou que a imagem do produto está correta, mesmo com divergência na pré-validação. A revisão não deve reportar conflito produto × imagem.
```

### Decision 4: `applyValidationContextToReviewResult()` — etapa explícita pós-parse

**Contexto:** O usuário pediu explicitamente que o alinhamento não seja feito dentro de `parseResult()`, mas como etapa separada.

**Decisão:** Criar uma função pura (ou método) `applyValidationContextToReviewResult()` que recebe o `ImageReviewResult` já parseado e o `ValidationContext`, e retorna um `ImageReviewResult` ajustado:

```typescript
function applyValidationContextToReviewResult(
  result: ImageReviewResult,
  context?: ValidationContext
): ImageReviewResult {
  if (!context || result.passed) return result;

  // Remove APENAS a issue específica que corresponde ao conflito já aprovado
  // pelo usuário. Issues não relacionadas ao override (preço errado, texto
  // ilegível, arte quebrada, CTA errado, layout impróprio, produto distorcido,
  // composição ruim, badge inventado) continuam bloqueando.
  if (context.overrides?.productImageCheck === "user_confirmed_continue") {
    const ignoredTypes = new Set(["product_image_conflict", "product_image_low_confidence"]);
    result.issues = result.issues.filter(issue => !ignoredTypes.has(issue.type));
  }

  // generated_product_mismatch NUNCA é ignorado — se a IA gerou produto
  // diferente do esperado, a geração deve falhar independentemente de override.
  // O nome corrigido (effectiveProductName) já foi passado como referência
  // para a revisão. Se a issue persiste, é porque a arte final está errada.

  // Recalcular passed/failureType com base nas issues restantes
  // Tipos NUNCA removíveis — mesmo que venham como minor, bloqueiam
  const BLOCKING_NON_OVERRIDE_TYPES = new Set([
    "wrong_price",
    "wrong_store_name",
    "wrong_product_name",
    "generated_product_mismatch",
    "illegible_text",
    "insufficient_image",
    "wrong_cta",
    "bad_composition",
    "invented_badge",
    "distorted_product",
    "empty_review",
    "review_low_confidence",
  ]);

  const hasBlockingIssue = result.issues.some(
    issue => BLOCKING_NON_OVERRIDE_TYPES.has(issue.type) || issue.severity === "critical"
  );

  if (!hasBlockingIssue) {
    result.passed = true;
    result.failureType = undefined;
  }

  return result;
}
```

**Onde é chamada:** No `ImageGenerationService`, imediatamente após `reviewResult = await this.imageReview.review(...)`, antes de avaliar `reviewResult.passed` e decidir o próximo estado:

```typescript
reviewResult = await this.imageReview.review(imageDataUrl, reviewInput);
reviewResult = applyValidationContextToReviewResult(reviewResult, validationContext);
```

### Nota sobre `wrong_product_name` (pós-Decision 4)

O `reviewInput.productName` passado para `ImageReviewService.review()` deve ser SEMPRE o `effectiveProductName` (nome corrigido pela validação ou o original se não houve correção). A revisão compara a arte contra esse nome desde o início, sem necessidade de filtrar issues no pós-processamento.

Se mesmo com o nome corrigido como referência a arte gerada exibir nome diferente de `effectiveProductName`, a issue `wrong_product_name` continua bloqueando — é um problema real, não um falso positivo da correção aceita.

### Nota sobre `isSameCategory()` (pós-Decision 2)

`inferredCategory` vem como texto livre do modelo de visão (ex: `"bebidas-energeticos"`, `"bebida energética"`, `"energético"`), enquanto `storeSegment` usa valores controlados (ex: `"alimentacao-bebidas"`, `"variedades"`). A comparação `isSameCategory()` NÃO deve ser string match ingênua.

**Abordagem para esta fase:** Usar mapping por grupos amplos no backend — um mapa `CATEGORY_TO_SEGMENT_GROUP` que agrupa categorias inferidas em segmentos conhecidos:

```typescript
const CATEGORY_TO_SEGMENT_GROUP: Record<string, string[]> = {
  "alimentacao-bebidas": ["bebidas", "alimentos", "bebida", "energetico", "cafe", "cerveja", "refrigerante", "suco", "agua", "comida", "snack", "doce", "salgado"],
  "moda-vestuario": ["roupa", "calcado", "tenis", "vestuario", "moda", "acessorio", "bolsa", "camiseta", "jeans"],
  // ... demais segmentos
};
```

Se a categoria inferida não corresponder a nenhum grupo, `hasCategoryConflict` deve ser `false` (comportamento conservador — assume alinhamento por padrão). Apenas quando houver correspondência clara com grupo diferente do segmento da loja é que o conflito é ativado.

### Decision 5: Eventos técnicos sanitizados no pipeline

**Contexto:** O `GenerationPhaseEvent` atual tem campos `message` (público, PT-BR) e `detail` (técnico, sanitizado). O painel "Detalhes técnicos" só aparece se `detail` for preenchido.

**Decisão:** Emitir `detail` sanitizado em momentos-chave do pipeline:

| Fase | Quando emitir | Exemplo de detail |
|------|--------------|-------------------|
| `input_validation` | Após validação completa | `"classificação: auto-fix, nome corrigido de 'neskau' para 'Nescau'"` |
| `prompt_assembly` | Após montagem do prompt | `"briefing montado com persona de moda-vestuário, categoria inferida: bebidas"` |
| `image_generation` | Início de cada tentativa | `"tentativa 2/3, modelo: dall-e-3, tempo decorrido: 32s"` (apenas tempo decorrido — orçamento restante só se o pipeline já controlar timeout de forma confiável) |
| `quality_review` | Após revisão | `"issues encontradas: 2 (1 crítica, 1 menor), failureType: null"` |
| `done` | Ao concluir | `"geração concluída em 32s, 1 correção aplicada, 2 tentativas de geração"` |

Estes detalhes são **reais** (não artificiais) — cada um reflete algo que de fato ocorreu na fase. O pipeline emite strings seguras por construção contendo apenas metadados técnicos resumidos. O `GenerationProgress` continua aplicando `sanitizeDetail()` antes da exibição como defesa em profundidade.

### Decision 6: Evolução do `campaign-image-director.md` — seções adicionadas, não reescritas

**Contexto:** O prompt atual funciona bem para o caso básico. Precisamos enriquecê-lo sem quebrar o que já está validado.

**Decisão:** Adicionar três novas seções ao final do prompt existente, preservando todo o conteúdo anterior:

```markdown
## Direção Criativa Contextual

{{creativePersona}}

### Categoria do Produto

O produto anunciado é da categoria: **{{inferredCategory}}**

{{categoryConflictDirective}}

### Repertório Comercial

Considere os seguintes detalhes como argumentos visuais opcionais — use apenas se fizerem sentido para a composição:
{{commercialRepertoire}}

### Instruções de Validação

{{inputValidationSummary}}
```

O conteúdo existente (briefing, especificações técnicas, diretrizes de composição, instruções obrigatórias) permanece intocado. A nova seção aparece antes de "Observações sobre o Segmento" (ou depois, mantendo a ordem lógica).

## Risks / Trade-offs

- **[Risco]** Modelo de visão pode inferir categoria incorreta → **Mitigação:** O campo `inferredCategory` é opcional e tem fallback para o segmento da loja. Se o modelo não retornar categoria ou retornar algo sem sentido, o comportamento atual é preservado.

- **[Risco]** `applyValidationContextToReviewResult()` pode mascarar problemas reais se o override for muito permissivo → **Mitigação:** A função remove APENAS `product_image_conflict` e `product_image_low_confidence` quando o usuário confirmou override. `generated_product_mismatch` SEMPRE bloqueia. Preço errado, texto ilegível, arte quebrada, layout impróprio, produto distorcido, CTA errado, composição ruim e badge inventado continuam bloqueando.

- **[Risco]** Prompts mais longos aumentam custo de tokens → **Mitigação:** As seções adicionadas são condicionais — `categoryConflictDirective` só tem conteúdo quando há conflito real; `commercialRepertoire` é vazio quando não há detalhes acionáveis.

- **[Risco]** Pipeline existente pode ser afetado por nova variável em `buildPromptVariables` → **Mitigação:** Nenhuma variável existente é removida ou renomeada. As novas variáveis só são usadas pelo prompt evoluído; se o prompt antigo estiver em cache, simplesmente não as interpola (ficam como `{{var}}` literais, sem erro).

- **[Risco]** Retry excessivo por causa de falso positivo na revisão mesmo com alinhamento → **Mitigação:** O alinhamento acontece antes da decisão de estado no state machine. Se `reviewResult.passed = true` após alinhamento, o ciclo de correção/regeneração não é disparado.

- **[Risco]** `detail` sanitizado pode vazar informação sensível → **Mitigação:** Usar o `sanitizeDetail()` existente que já filtra API keys, base64 longos e stack traces. Novos `detail` seguem o mesmo padrão.
