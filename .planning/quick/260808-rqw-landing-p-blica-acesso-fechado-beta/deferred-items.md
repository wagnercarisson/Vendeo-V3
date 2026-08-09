# Deferred Items — Quick 260808-rqw

Descobertas fora de escopo desta quick, registradas conforme a regra de limite de escopo
(não corrigidas; não são causadas pelas mudanças da task).

1. **Teste de integração real-DB do F38 falha sem `.env.local`**
   - Arquivo: `src/lib/credit/__tests__/operation-cost-service.integration.test.ts`
   - Sintoma: import-time throw `Missing NEXT_PUBLIC_SUPABASE_URL` (via `src/lib/supabase/server.ts` → `operation-cost-service.ts`); suite falha em checkout sem `.env.local`.
   - Natureza: pré-existente e ambiental (teste exige credenciais reais de banco; F38 rodava com `.env.local` presente). Não relacionado às mudanças desta quick (nenhum arquivo tocado).
   - Próximo passo: rodar a suíte com `.env.local` real presente, ou mover o teste para um runner/exclusão com gate de env.

2. **`.env.example` não documenta as 3 vars do Supabase**
   - Arquivo: `.env.example`
   - Sintoma: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` não aparecem no exemplo; build e testes de integração exigem `.env.local` real.
   - Próximo passo: adicionar as 3 vars ao `.env.example` (com placeholders) para que checkouts frescos tenham instrução clara.
