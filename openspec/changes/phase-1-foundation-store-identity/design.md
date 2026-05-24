## Context

O projeto está em estágio inicial — sem `src/`, sem `supabase/migrations/`, sem Next.js configurado. A primeira entrega técnica é a fundação de dados da loja: tabela `stores`, API routes e fallbacks simples de identidade visual. Não há UI, upload ou storage envolvidos nesta fase.

A stack alvo é Next.js (App Router) + TypeScript + Supabase + Vercel. O Supabase será usado como banco de dados (Postgres via `supabase-js`) e futuramente para storage e auth, mas nesta fase apenas o banco relacional é necessário.

**Premissa:** A implementação das API Routes pressupõe que o scaffold mínimo do Next.js App Router exista (`src/app/`, `package.json` com Next.js, `tsconfig.json`) ou seja criado como pré-requisito operacional, sem adicionar UI, páginas ou funcionalidades fora do escopo desta spec. O scaffold é apenas infraestrutura básica do framework, não funcionalidade do produto.

## Goals / Non-Goals

**Goals:**
- Criar a tabela `stores` no Supabase via migration versionada
- Expor API routes para criar, ler e atualizar registros de loja
- Validar segmento contra lista predefinida de 10 valores
- Implementar fallback textual do nome da loja quando `logo_url` estiver ausente
- Implementar fallback simples de cor hex por segmento quando `brand_color` estiver ausente
- Garantir que campos opcionais (cidade, estado, cor, logo) nunca bloqueiem o fluxo

**Non-Goals:**
- Não criar página, formulário ou UI da store-identity
- Não implementar upload de logo ou bucket Supabase Storage
- Não implementar paleta inteligente ou sistema de brand colors
- Não implementar DELETE ou listagem de lojas
- Não implementar autenticação ou multitenancy
- Não implementar subsegmentos

## Decisions

### 1. API routes no modelo Next.js App Router com Route Handlers

Usar `src/app/api/store/route.ts` para `POST` e `src/app/api/store/[id]/route.ts` para `GET` e `PATCH`.

**Alternativa considerada:** Um único handler com switch de método. Rejeitado porque o App Router espera arquivos separados por segmento de rota, e manter handlers específicos por método é mais legível e testável.

### 2. Validação de segmento no backend com array constante

Validar segmento contra um array TypeScript `const SEGMENTS = [...]` no handler, retornando 400 se não corresponder. No banco, usar constraint `CHECK (segment = ANY(ARRAY[...]))` para proteção em nível de dados.

**Alternativa considerada:** Tabela `segments` com FK. Rejeitado porque os 10 segmentos são fixos e não faz sentido mutabilidade via UI nesta fase. Uma constraint CHECK é mais simples e evita join desnecessário.

**Alternativa considerada:** Enum Postgres. Rejeitado porque enums são difíceis de modificar em produção (requer ALTER TYPE... ADD VALUE, sem remoção fácil). O CHECK com array permite alterar a lista via migration simples.

### 3. Migration versionada com timestamp

Arquivo `supabase/migrations/YYYYMMDDHHmmss_create_stores.sql` contendo `CREATE TABLE` com todos os campos, constraint CHECK para segmento, e comentário de rollback. O Supabase CLI (ou manual) aplica as migrações em ordem de timestamp.

### 4. Store identity resolver como função utilitária

Uma função `resolveStoreIdentity(store)` no diretório `src/lib/store.ts` que centraliza os fallbacks:
- Se `logo_url` existe → retorna `logo_url`; senão → retorna `store.name`
- Se `brand_color` existe → retorna `brand_color`; senão → consulta mapa de fallback por segmento

Isolando a lógica de fallback em um módulo puro (sem IO), fica testável sem depender de API ou banco.

### 5. Sem ORM — Supabase client direto

Usar o cliente `@supabase/supabase-js` diretamente nos Route Handlers para queries SQL simples. Nesta fase não há necessidade de Prisma ou Drizzle — a tabela é única e as queries operações simples de criação, leitura e atualização.

## Risks / Trade-offs

| Risco | Mitigação |
|-------|-----------|
| **Escopo creeping**: tentação de adicionar UI "já que está mexendo" | Bloqueado pela nota de escopo explícita na proposal e spec. Próximas specs (02-04) cobrem UI, upload e paleta. |
| **Segmentos mudam antes da próxima migration**: adicionar/remover segmentos requer nova migration | O CHECK com array é atualizável via `ALTER TABLE ... DROP CONSTRAINT ... ADD CONSTRAINT ...` em migration futura. |
| **Supabase local não configurado**: sem `supabase/` directory, migrations podem ser aplicadas fora de ordem | Criar `supabase/migrations/` manualmente. O desenvolvedor deve ter Supabase CLI instalado ou aplicar o SQL diretamente. |
| **Fallback de cor por segmento vira paleta inteligente prematuramente** | A spec deixa explícito que é fallback simples temporário. O design não prevê combinações cromáticas, apenas um hex único. |

## Migration Plan

1. Criar diretório `supabase/migrations/` na raiz do projeto
2. Criar arquivo `supabase/migrations/YYYYMMDDHHmmss_create_stores.sql`
3. Executar `supabase db reset` apenas em ambiente local/dev (nunca em remoto, compartilhado ou com dados reais) ou aplicar o SQL manualmente no projeto Supabase
4. Verificar tabela criada com `SELECT * FROM public.stores;`
5. **Rollback**: executar `DROP TABLE IF EXISTS public.stores;` (declarado como comentário no migration file)

## Open Questions

- Nenhuma — decisões cobertas nas seções acima.
