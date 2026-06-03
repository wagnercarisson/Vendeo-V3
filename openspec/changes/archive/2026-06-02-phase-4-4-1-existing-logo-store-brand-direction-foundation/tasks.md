> **Notas de implementação:**
> - **Bucket `store-brand-assets`**: Criado via migration `20260602000004_create_brand_assets_storage.sql` com políticas públicas de leitura e escrita service_role. Bucket público, 5MB limit, PNG/JPG/WEBP apenas.
> - **`resolveStoreIdentity`**: Esta função consulta store_brand_profiles e store_brand_assets ativos, resolve variante de logo (normalized → original → on_dark) e retorna `StoreIdentitySnapshot` com `brandProfile` populado. Usada por `CampaignPageClient` e `StoreIdentityBlock`.

## 1. Database Migrations

**Ordem obrigatória**: store_brand_assets antes de store_brand_profiles, pois profiles tem FK → store_brand_assets(id).

**Todas as migrations foram criadas e aplicadas ao Supabase.**
- `20260602000001_create_store_brand_assets.sql` ✅
- `20260602000002_create_store_brand_profiles.sql` ✅
- `20260602000003_add_store_direction_fields.sql` ✅
- `20260602000004_create_brand_assets_storage.sql` (bucket + policies) ✅
- `20260602000005_grant_service_role_on_brand_assets.sql` ✅

- [x] 1.1 Create migration `supabase/migrations/*_create_store_brand_assets.sql`
- [x] 1.2 Create migration `supabase/migrations/*_create_store_brand_profiles.sql`
- [x] 1.3 Create migration `supabase/migrations/*_add_store_direction_fields.sql`
- [x] 1.4 Apply all migrations → `supabase db push` executado. Status: aplicadas.

## 2. Storage Setup

- [x] 2.1 Bucket `store-brand-assets` criado via migration 00004. Público (leitura), escrita service_role.
- [x] 2.2 CORS configurado via dashboard (não necessário para service_role interno)

## 3. Image Processing Utilities

- [x] 3.1 `sharp` instalado como dependência do projeto
- [x] 3.2 `src/lib/brand-assets/image-processing.ts` com `validateImage`, `getImageDimensions`, `checkMinimumDimensions`, `computeChecksum`
- [x] 3.3 `generateAllVariants` implementado com `generateNormalized`, `generateOnLight`, `generateOnDark`, `generateSquareSafe`, `generateHorizontalSafe` via sharp

## 4. Store Brand Assets API — Logo Upload

- [x] 4.1 `POST /api/store/[id]/logo` — aceita multipart/form-data, valida extensão, rejeita SVG
- [x] 4.2 Server-side MIME validation via sharp, 5MB limit, 200x200px min, integridade
- [x] 4.3 Original persistido em `store-brand-assets/{store_id}/original/{uuid}.{ext}`
- [x] 4.4 Version calculado via max(version) + 1
- [x] 4.5 Assets anteriores archived + profile anterior outdated antes do insert
- [x] 4.6 Original record criado com variant_type='original', source='user_upload'
- [x] 4.7 5 variantes técnicas geradas via sharp, upload + records com source='system_generated'
- [x] 4.8 Brand Director analysis executada inline, profile criado como 'synced' ou 'failed'
- [x] 4.9 HTTP 201 com originalAsset, variants[], profile
- [x] 4.10 `GET /api/store/[id]/logo` retorna assets agrupados + profile
- [x] 4.11 `GET /api/store/[id]/logo/versions` — `src/app/api/store/[id]/logo/versions/route.ts`
- [x] 4.12 `DELETE /api/store/[id]/logo` — soft delete (archives assets + profile)

## 5. Store Brand Profile API

- [x] 5.1 `GET /api/store/[id]/brand-profile` — retorna active synced profile ou null
- [x] 5.2 `POST /api/store/[id]/brand-profile/generate` — regenera análise IA, marca anterior outdated
- [x] 5.3 `PATCH /api/store/[id]/brand-profile/colors` — atualiza brand_colors_chosen in-place
- [x] 5.4 `POST /api/store/[id]/brand-profile/archive` — seta status='archived'

## 6. Store Brand Director — AI Analysis Integration

- [x] 6.1 `prompts/store-brand-director-with-logo.md` — análise visual, extração de cores, estilo, tom, personalidade, guidelines, brief. Diretiva de preservação do logo.
- [x] 6.2 `BrandDirectorService.analyze()` — envia logo + store data para GPT-4o via OpenAI
- [x] 6.3 Parseia JSON estruturado para campos do brand profile
- [x] 6.4 Integrado em POST /api/store/[id]/logo — análise inline, profile synced/failed
- [x] 6.5 LLM failure → profile 'failed' com metadata do erro, upload mantido

## 7. Store API Extensions

- [x] 7.1 `PATCH /api/store/[id]` aceita subsegment, tone_of_voice, positioning, short_description, slogan
- [x] 7.2 `resolveStoreIdentity` consulta store_brand_assets + profile, resolve variante de logo, popula snapshot

## 8. Store Identity UI

- [x] 8.1 Upload section com drag-and-drop, formatos aceitos, 5MB limit
- [x] 8.2 Client-side validation, upload automático, preview circular, status "Enviando...", "Processando...", "Pronto"
- [x] 8.3 Swatches de cores detectadas com P/S buttons, sem modal de conflito
- [x] 8.4 Subsegmento, Tom de Voz, Posicionamento, Descrição Curta, Slogan — todos opcionais
- [x] 8.5 Novos campos conectados ao PATCH /api/store/[id] via save()
- [x] 8.6 StorePreview mostra logo (circular) quando upload feito, fallback para cor/inicial

## 9. Campaign Integration — Brand Profile Consumption

- [x] 9.1 `brandProfile` enviado no corpo da requisição de campanha → `buildBrandProfileSection` cria tabela markdown com guidelines, brief, personalidade, estilo, cores
- [x] 9.2 Resolução de cor: `brand_colors_chosen[0]` > `safe_color_tokens.primary` > `brand_color` > segment fallback
- [x] 9.3 Variante de logo: `normalized` > `original` > `on_dark` (resolvido em `resolveStoreIdentity`)
- [x] 9.4 Sem brand profile → campos vazios, fallback por segmento intacto

## 10. Verification

- [x] 10.1 `npx next build` — type check passa
- [x] 10.2 Lint — sem issues (ESLint com Next.js plugin)
- [x] 10.3 Build passa (`npm run build`)
- [x] 10.4 Manual test: upload valid PNG logo ✅ Validado. Upload funcionando, logo persistido/reidratado após F5, nova loja não herda dados visuais da anterior, cores lidas do logo e preenchidas no form, cores salvas e reidratadas. Artes geradas para bebidas, padaria e moda com identidade preservada.
- [ ] 10.5 Manual test: upload SVG rejected (manual pending)
- [ ] 10.6 Manual test: upload >5MB rejected (manual pending)
- [ ] 10.7 Manual test: upload corrupted file (manual pending)
- [ ] 10.8 Manual test: second upload archives previous (manual pending)
- [ ] 10.9 Manual test: soft delete logo (manual pending)
- [x] 10.10 Manual test: campaign with brand profile ✅ Validado. Cores da loja usadas, logo real recebido como referência visual do diretor de campanha, variante resolvida corretamente (normalized > original > on_dark), ReviewDiagnostic registrando runId/attempts/reviewPassed/severity/presença de logo/brandProfile/productImage.
- [ ] 10.11 Manual test: campaign without brand profile (code coverage verified — fallback por segmento intacto; manual pending)
