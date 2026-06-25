## 1. Types e Schemas

- [ ] 1.1 Atualizar `BrandProfileRecord.brand_colors_chosen` de `string[]` para `Array<string | null>` em `src/lib/brand-assets/types.ts`
- [ ] 1.2 Atualizar `CreateBrandProfileInput.brand_colors_chosen` de `string[]?` para `Array<string | null>?` em `src/lib/brand-assets/types.ts`
- [ ] 1.3 Atualizar `BrandProfileSnapshot.brand_colors_chosen` de `string[]` para `Array<string | null>` em `src/components/campaign/types.ts`
- [ ] 1.4 Adicionar `@deprecated` JSDoc em `manual_color_override` nos tipos e configurar lint rule temporária

## 2. PATCH /api/store/[id]/brand-profile

- [ ] 2.1 Alterar validação do body para aceitar `Array<string | null>` — cada elemento deve ser HEX válido (`#RRGGBB`) ou `null`; rejeitar arrays com elemento único
- [ ] 2.2 Remover escrita de `manual_color_override: { enabled: true }` no brand profile
- [ ] 2.3 Remover atualização de `stores.manual_color_override`
- [ ] 2.4 Adicionar cenário de reset: `{ colors: [] }` persiste array vazio
- [ ] 2.5 Manter exigência de synced profile existente (retorna 404 se não houver)
- [ ] 2.6 Garantir que `stores.brand_color` não é atualizado pelo PATCH

## 3. Text-only inference (POST /api/store/[id]/brand-profile/infer)

- [ ] 3.1 Aceitar `userChosenColors: Array<string | null>` opcional no body da requisição
- [ ] 3.2 Ignorar `manualColorOverride` se enviado pelo front-end (compatibilidade retroativa)
- [ ] 3.3 Quando `userChosenColors` contiver ao menos um HEX válido: persistir no novo profile como `brand_colors_chosen`
- [ ] 3.4 Quando `userChosenColors` não for enviado ou for `[]`: preservar `brand_colors_chosen` do profile anterior (se houver escolha manual), ou deixar `[]`

## 4. Realinhamento backend

- [ ] 4.1 Em `src/app/api/store/[id]/brand-profile/realign/route.ts`: ao criar novo profile após realinhamento, preservar `brand_colors_chosen` do profile anterior quando contiver ao menos um HEX válido
- [ ] 4.2 Não preencher `brand_colors_chosen` com `logo_colors_detected`, `safe_color_tokens` ou `[]` incondicionalmente
- [ ] 4.3 Não consultar `manual_color_override` para decisão de preservação

## 5. Formulário — estado local e tipo

- [ ] 5.1 Renomear estado `brandColorsChosen` de `string[]` para `Array<string | null>` no `StoreIdentityForm`
- [ ] 5.2 Atualizar `saveBrandColors` para enviar `[primaryOuNull, accentOuNull]` — campo vazio ou placeholder `#RRGGBB` vira `null`
- [ ] 5.3 Implementar lógica de bifurcação: se houver synced profile → PATCH; se não → manter em estado local
- [ ] 5.4 Atualizar `handleStep2Submit` e `executeStep2Save` para passar `userChosenColors` ao invés de `manualColorOverride`
- [ ] 5.5 Atualizar todos os `setBrandColorsChosen(...)` com o novo tipo (Array<string | null>)

## 6. Formulário — hidratação dos color pickers

- [ ] 6.1 Atualizar useEffect de carregamento (linhas 301-324): se `brand_colors_chosen` tiver HEX válido, hidratar com os valores do array respeitando `null`; se `[]`, usar `safe_color_tokens`
- [ ] 6.2 Atualizar `handleRetryBrandDirector` — hidratação com null support
- [ ] 6.3 Atualizar `handleApprovalComplete` — não popular `brand_colors_chosen` com cores inferidas de VS
- [ ] 6.4 Atualizar `handleContinueWithoutLogo` — hidratação respeitando null
- [ ] 6.5 Atualizar hydratação após realinhar (drift modal e botão discreto) — se `brand_colors_chosen` tem escolha, usar valores do array; senão, usar `safe_color_tokens`

## 7. Formulário — Voltar para cores sugeridas

- [ ] 7.1 Adicionar estado derivado `hasUserChosenColors = brandColorsChosen.some(c => typeof c === "string" && /^#[0-9A-Fa-f]{6}$/.test(c))`
- [ ] 7.2 Renderizar botão/link "Voltar para cores sugeridas" no bloco de cores, visível apenas quando `hasUserChosenColors` for true
- [ ] 7.3 Implementar ação de reset: se houver synced profile → PATCH `{ colors: [] }`; se não → limpar estado local
- [ ] 7.4 Após reset, pickers exibem `safe_color_tokens` ou fallback

## 8. Formulário — color picker onChange/onBlur

- [ ] 8.1 No onChange do color picker nativo: ler valor canônico de ambos os campos, montar `[primaryOuNull, accentOuNull]`
- [ ] 8.2 Se houver synced profile: disparar PATCH com o par canônico
- [ ] 8.3 Se não houver synced profile: atualizar estado local `brandColorsChosen`
- [ ] 8.4 No onBlur do input de texto: se HEX válido, mesmo fluxo; se inválido, mostrar erro e não persistir
- [ ] 8.5 Placeholder `#RRGGBB` tratado como `null` (não persistir)

## 9. Logo upload

- [ ] 9.1 No endpoint `POST /api/store/[id]/logo` (ou no response): ler `brand_colors_chosen` do profile anterior e preservar no novo profile
- [ ] 9.2 Remover `brand_colors_chosen = []` incondicional — preservar escolha manual existente
- [ ] 9.3 Não consultar `manual_color_override` para decisão de preservação

## 10. Remoção de logo

- [ ] 10.1 Em `handleRemoveLogo`: remover `setBrandColorsChosen([])` — escolha manual de cores é independente do estado do logotipo

## 11. Visual signature approval

- [ ] 11.1 Em `src/app/api/store/[id]/visual-signature/approve/route.ts`: substituir condição `manual_color_override.enabled === true` por verificação direta de `brand_colors_chosen` conter ao menos um HEX válido
- [ ] 11.2 Atualizar cenários em `brand-profiler.ts` para usar `previousBrandColors` do `brand_colors_chosen`

## 12. Validação e normalização

- [ ] 12.1 Atualizar validadores de cor para aceitar `null` como valor válido de posição (apenas posições, não o array inteiro)
- [ ] 12.2 Adicionar normalizador que converte `[null, null]` para `[]`
- [ ] 12.3 Verificar todos os acessos a `brand_colors_chosen` no código para tratamento de `null` com fallback `?? []`
