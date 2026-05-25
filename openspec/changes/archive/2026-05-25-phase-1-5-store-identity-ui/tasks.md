## 1. Setup e Configuração

- [x] 1.1 Instalar Tailwind CSS, PostCSS e autoprefixer como devDependencies (`npm install -D tailwindcss@3.4 postcss autoprefixer`)
- [x] 1.2 Criar `tailwind.config.ts` com paths de conteúdo apontando para `src/**/*.{ts,tsx}`
- [x] 1.3 Criar `postcss.config.mjs` com plugin tailwindcss
- [x] 1.4 Criar `src/app/globals.css` com diretivas `@tailwind base/components/utilities` e CSS custom properties do MASTER.md
- [x] 1.5 Importar `globals.css` em `src/app/layout.tsx`
- [x] 1.6 Adicionar `BRAZILIAN_STATES` em `src/lib/constants.ts` com array de 27 UFs (AC–TO) no formato `{ value: "AC", label: "Acre" }`
- [x] 1.7 Configurar fontes Poppins e Open Sans via Google Fonts (seguir MASTER.md typography spec)

## 2. Hook de Formulário (use-store-form.ts)

- [x] 2.1 Criar `src/components/flow/use-store-form.ts` com interface `UseStoreFormReturn` expondo: `formData`, `setField`, `save`, `isLoading`, `isSaving`, `error`, `mode`
- [x] 2.2 Implementar estado `formData` com campos: `name`, `segment`, `brand_color`, `city`, `state` — iniciando com valores padrão (string vazia)
- [x] 2.3 Implementar detecção de modo (create/edit) baseada em `localStorage.getItem("store_id")`
- [x] 2.4 Implementar `useEffect` no mount: se `store_id` existir, disparar `GET /api/store/{id}` para preencher `formData`
- [x] 2.5 Implementar tratamento de 404 no GET: remover `store_id` do localStorage, setar modo criação, definir mensagem de aviso
- [x] 2.6 Implementar `save()` que decide entre `POST` (se sem `store_id`) ou `PATCH /api/store/{id}` (se editando)
- [x] 2.7 Implementar persistência de `store_id` no localStorage após POST bem-sucedido (HTTP 201)
- [x] 2.8 Implementar normalização de campos opcionais: converter string vazia → `null` para `city`, `state`, `brand_color`
- [x] 2.9 Implementar rastreamento de interação com color picker (`colorTouched`): se false, `brand_color` enviado como `null`
- [x] 2.10 Implementar estados `isLoading` (fetch inicial), `isSaving` (request em andamento), `error` (erros de API/rede)
- [x] 2.11 Implementar `clearStore` que remove `store_id` do localStorage e reseta formulário para modo criação
- [x] 2.12 Extrair função `SEGMENT_LABELS` para mapear kebab-case → label humanizado (ex: `moda-vestuario` → `Moda e Vestuário`)

## 3. Componente de Preview (store-preview.tsx)

- [x] 3.1 Criar `src/components/flow/store-preview.tsx` com props: `formData` e possivelmente `store` completo
- [x] 3.2 Renderizar card com nome da loja em destaque (Poppins 600)
- [x] 3.3 Renderizar badge com label humanizado do segmento
- [x] 3.4 Renderizar swatch de cor usando `resolveStoreIdentity({ name, segment, brand_color, logo_url: null }).color` da foundation
- [x] 3.5 Exibir placeholder quando formulário está vazio (ex: "Preencha os dados da loja para ver o preview")

## 4. Componente de Formulário (store-identity-form.tsx)

- [x] 4.1 Criar `src/components/flow/store-identity-form.tsx` consumindo `use-store-form.ts`
- [x] 4.2 Renderizar campo Nome da Loja com validação on blur (required, 2–60 chars)
- [x] 4.3 Renderizar dropdown Segmento com opções de `VALID_SEGMENTS` em formato label humanizado
- [x] 4.4 Renderizar color picker nativo (`<input type="color">`) + input hex companion, sincronizados
- [x] 4.5 Renderizar campo Cidade (text input opcional)
- [x] 4.6 Renderizar dropdown Estado usando `BRAZILIAN_STATES`
- [x] 4.7 Implementar validação inline on blur para todos os campos (seguir MASTER.md form validation)
- [x] 4.8 Implementar mensagens de erro em vermelho abaixo dos campos com ícone alert-circle
- [x] 4.9 Implementar banner de erro de API no topo do formulário (dismissível)
- [x] 4.10 Implementar loading skeleton/spinner durante fetch inicial (isLoading)
- [x] 4.11 Implementar botão "Salvar" com spinner + "Salvando..." durante save (isSaving)
- [x] 4.12 Implementar feedback de sucesso após save
- [x] 4.13 Renderizar modo de aviso 404: "Loja não encontrada. Cadastre novamente."
- [x] 4.14 Seguir tokens de cor, tipografia e spacing do MASTER.md e layout do store-identity.md

## 5. Página Principal (page.tsx)

- [x] 5.1 Substituir `src/app/page.tsx` para compor `StoreIdentityForm` + `StorePreview` lado a lado (desktop) ou empilhado (mobile)
- [x] 5.2 Usar `'use client'` diretriz
- [x] 5.3 Aplicar layout responsivo: `max-w-5xl` para desktop, full-width para mobile
- [x] 5.4 Garantir que nenhum outro conteúdo aparece na página (sem navegação, sem header)

## 6. Verificação e Validação

- [x] 6.1 Executar `npm run typecheck` e corrigir erros de TypeScript
- [x] 6.2 Executar `npm run lint` e corrigir warnings/errors de lint
- [x] 6.3 Teste manual: criar loja → HTTP 201 → store_id no localStorage → preview atualiza
- [x] 6.4 Teste manual: recarregar página → form preenchido com dados salvos → preview corresponde
- [x] 6.5 Teste manual: editar nome da loja → salvar → PATCH OK → recarregar → mudanças persistem
- [x] 6.6 Teste manual: corromper store_id no localStorage → recarregar → 404 → localStorage limpo → form em modo criação com aviso
- [x] 6.7 Teste manual: salvar com city/state vazios → API recebe null → sem erro de validação
- [x] 6.8 Teste manual: salvar sem tocar no color picker → brand_color é null no banco → preview usa fallback por segmento
- [x] 6.9 Teste manual: submeter formulário vazio → validação inline aparece nos campos obrigatórios
- [x] 6.10 Teste manual: digitar hex inválido no campo de cor → erro inline "Cor inválida. Use formato #RRGGBB"
