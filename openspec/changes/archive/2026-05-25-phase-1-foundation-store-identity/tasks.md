## 1. Scaffold e Configuração

- [ ] 1.1 Inicializar projeto Next.js com App Router e TypeScript (`npx create-next-app@latest`)
- [ ] 1.2 Configurar Supabase client (`src/lib/supabase.ts`) com variáveis de ambiente
- [ ] 1.3 Criar diretório `supabase/migrations/` na raiz do projeto

## 2. Migration da Tabela Stores

- [ ] 2.1 Criar migration versionada `supabase/migrations/YYYYMMDDHHmmss_create_stores.sql` com tabela `stores`
- [ ] 2.2 Incluir colunas: `id` (uuid), `name` (text), `segment` (text), `city` (text), `state` (text), `brand_color` (text), `logo_url` (text), `created_at` (timestamptz), `updated_at` (timestamptz)
- [ ] 2.3 Adicionar constraint CHECK para validar segmento contra os 10 valores predefinidos
- [ ] 2.4 Adicionar comentário de rollback (`-- REVERT: DROP TABLE IF EXISTS public.stores;`)
- [ ] 2.5 Aplicar migration em ambiente local/dev via `supabase db reset` e verificar tabela criada

## 3. API — Criar Loja

- [ ] 3.1 Criar `src/app/api/store/route.ts` com handler `POST`
- [ ] 3.2 Validar campos obrigatórios (`name`, `segment`) e segmento contra array de valores permitidos
- [ ] 3.3 Inserir registro no Supabase e retornar HTTP 201 com o registro criado
- [ ] 3.4 Retornar HTTP 400 com erro descritivo para campos inválidos ou ausentes

## 4. API — Ler Loja

- [ ] 4.1 Criar `src/app/api/store/[id]/route.ts` com handler `GET`
- [ ] 4.2 Buscar store por UUID no Supabase e retornar HTTP 200 com o registro
- [ ] 4.3 Retornar HTTP 404 quando store não for encontrada

## 5. API — Atualizar Loja

- [ ] 5.1 Adicionar handler `PATCH` em `src/app/api/store/[id]/route.ts`
- [ ] 5.2 Atualizar apenas campos fornecidos no body, preservando os demais
- [ ] 5.3 Atualizar `updated_at` automaticamente e retornar HTTP 200 com o registro atualizado
- [ ] 5.4 Retornar HTTP 404 quando store não for encontrada

## 6. Store Identity Resolver

- [ ] 6.1 Criar `src/lib/store.ts` com função `resolveStoreIdentity`
- [ ] 6.2 Implementar fallback textual: retornar `store.name` quando `logo_url` for null/empty
- [ ] 6.3 Implementar fallback de cor: retornar hex por segmento quando `brand_color` for null/empty
- [ ] 6.4 Definir mapa constante de fallback de cores para os 10 segmentos

## 7. Verificação e Validação

- [ ] 7.1 Verificar build TypeScript sem erros (`npm run typecheck` ou `tsc --noEmit`)
- [ ] 7.2 Verificar lint sem erros (`npm run lint`)
- [ ] 7.3 Testar fluxo completo: criar loja → ler loja → atualizar loja
- [ ] 7.4 Verificar que campos opcionais (city, state, brand_color, logo_url) não bloqueiam criação
- [ ] 7.5 Verificar que segmento inválido retorna 400
