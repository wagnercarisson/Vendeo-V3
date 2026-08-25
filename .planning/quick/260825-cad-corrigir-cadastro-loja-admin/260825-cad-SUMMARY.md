phase: quick-260825-cad
quick_id: 260825-cad
status: completed
date: 2026-08-25

# Summary

Corrigido o cadastro de loja em dois pontos:

- `/loja` e `/api/store/update-cnpj` agora convertem a decisao interna
  `reject` para o status persistido `rejected`, compatível com a constraint
  `stores_verification_status_check`.
- `POST /api/admin/stores` deixou de chamar a RPC legada
  `admin_create_store_for_user` e agora retorna `410` com
  `admin_store_creation_disabled`.
- A tela de detalhe do usuario admin removeu a criacao normal de loja e manteve
  apenas o CTA para `Criar store de teste`.

# Decision

Nao manter criacao de loja de producao via admin neste momento. Loja de producao
deve passar pelo onboarding do usuario para preservar aceite legal, CNPJ e
elegibilidade freemium. O admin continua podendo criar stores de teste.

# Verification

- `node_modules\.bin\vitest.cmd run src/app/api/store/__tests__/route.test.ts src/app/api/store/update-cnpj/__tests__/route.test.ts src/app/api/admin/__tests__/stores.test.ts`
  - PASS: 3 files, 35 tests
- `node_modules\.bin\tsc.cmd -p tsconfig.typecheck.json --noEmit`
  - PASS

# Follow-up

- Suporte a CNPJ alfanumerico deve entrar em quick/proposta separada, pois exige
  mudancas em validacao, mascara, schema, constraints SQL, root hash e providers.
