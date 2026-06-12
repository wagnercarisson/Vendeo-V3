## 1. Constants e Tipos

- [x] 1.1 Substituir `VALID_SEGMENTS`, `SEGMENT_LABELS` e tipo `Segment` por `STORE_SEGMENTS` (13 entradas com value/label), `STORE_SUBSEGMENTS` (Record com listas hierárquicas) e tipo `StoreSegment` em `src/lib/constants.ts`
- [x] 1.2 Atualizar `SEGMENT_COLOR_FALLBACK` em `src/lib/store.ts` com as 13 novas chaves e cores contextualmente alinhadas
- [x] 1.3 Atualizar `SEGMENT_PALETTES` em `src/components/campaign/types.ts` com as 13 novas chaves (background + accent)
- [x] 1.4 Atualizar `SEGMENT_HOOKS` e `SEGMENT_CTAS` em `src/lib/campaign-intelligence/providers/mock.ts` com os 13 novos valores

## 2. Banco de Dados

- [x] 2.1 Criar migration `supabase/migrations/20260611000001_update_stores_segment_check.sql` que dropa a CHECK constraint antiga e cria nova com os 13 segmentos
- [x] 2.2 Criar script SQL de limpeza da base (TRUNCATE 5 tabelas + DELETE 3 buckets de storage)

## 3. Server-side / API

- [x] 3.1 Atualizar `src/app/api/store/route.ts` com validação de segmento usando `STORE_SEGMENTS`
- [x] 3.2 Atualizar `src/app/api/store/[id]/route.ts` com validação de segmento usando `STORE_SEGMENTS`
- [x] 3.3 Adicionar validação server-side de subsegmento em ambas as API routes: rejeitar `outro` literal, vazio quando obrigatório, tamanho (3-30), regex (letras/acentos/espaços), valores genéricos (`outro`, `loja`, `comercio`, `comércio`, `varejo`)
- [x] 3.4 Aplicar sanitização server-side no subsegmento ao salvar: trim + reduzir espaços + capitalize palavras

## 4. Compatibilidade com Geração/IA

- [x] 4.1 Atualizar `src/lib/image-generation/services/image-generation-service.ts`: substituir referências a `SEGMENT_LABELS` por `STORE_SEGMENTS` (persona criativa, creative context guidance, mappings de categoria/conflito)
- [x] 4.2 Atualizar `scripts/benchmark-scenarios.ts` com os novos segmentos nos cenários de teste

## 5. Frontend — Store Identity Form

- [x] 5.1 Em `src/components/flow/store-identity-form.tsx`: substituir imports de `VALID_SEGMENTS`/`SEGMENT_LABELS` por `STORE_SEGMENTS`/`STORE_SUBSEGMENTS`; adaptar dropdown de segmento para 13 opções
- [x] 5.2 Implementar dropdown condicional de subsegmento com 3 modos: dropdown rico (subsegmentos + "Outro"), dropdown travado (desabilitado, auto-selecionado), campo aberto (segmento `outros`)
- [x] 5.3 Implementar comportamento "Outro": ao selecionar `{ value: "outro" }`, abrir campo de texto livre obrigatório com validação client-side (3-30 chars, letras/espaços, rejeitar genéricos) e placeholder `"Digite o seu subsegmento"`
- [x] 5.4 Implementar reset de subsegmento ao trocar de segmento: limpar valor e fechar campo "Outro"
- [x] 5.5 Em `src/components/flow/store-identity-block.tsx`: atualizar resolução de label com `STORE_SEGMENTS`
- [x] 5.6 Em `src/components/flow/store-preview.tsx`: atualizar resolução de label e fallback de cor com os 13 segmentos

## 6. Limpeza e Verificação

- [x] 6.1 **[DADOS DESTRUTIVOS — apenas dev]** Executar script de limpeza na base de desenvolvimento primeiro, depois aplicar a migration
- [x] 6.2 Verificar TypeScript (tsc --noEmit), lint e build
- [x] 6.3 Verificar fluxo completo: criar loja com cada modo de segmento (rico, travado, outros) e validar salvamento de subsegmento
