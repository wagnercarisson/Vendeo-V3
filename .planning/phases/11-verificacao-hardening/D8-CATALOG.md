# D8 — Catálogo de Verificação da Milestone v1.2

**Instruções:** Para cada item, execute o procedimento descrito e registre PASS ou FAIL ao lado. Se FAIL, anote o comportamento observado. Ao final, me entregue o resultado de todos os itens.

---

## Checklist rápido (já coberto por testes automatizados)

Estes itens têm cobertura automatizada no `vitest` (465 testes, 51 files). Pule a menos que queira revalidar.

- [ ] A-001: Página protegida sem sessão → redirect `/login`
- [ ] A-002: API route sem sessão → 401 JSON
- [ ] A-003: `?redirect=` inválido → sanitizado para fallback
- [ ] B-001: Signup com email válido → redireciona `/check-email`
- [ ] B-002: Confirmar token → sessão criada
- [ ] B-003: Login com credenciais corretas → sessão criada
- [ ] B-004: Forgot password → email enviado
- [ ] B-005: Reset password → nova senha funcional
- [ ] C-001: Usuário sem loja → redirect `/store` (create)
- [ ] C-002: Criar loja → store vinculada ao `user_id`
- [ ] C-003: Segunda loja → 409 Conflict
- [ ] F-001: POST cross-origin sem Origin → 403
- [ ] F-002: POST com Origin diferente do Host → 403
- [ ] F-003: GET com Origin diferente → 200 (GET não valida)

---

## D — Isolamento Cross-Tenant

**Setup:** Tenha dois usuários (A e B) com sessões ativas em browsers/navegadores diferentes OU abas anônimas diferentes. Capture o `store_id` do usuário A.

### D8-004: GET de store alheia retorna 404

```
Procedimento:
1. Como usuário B, faça GET em /api/store/{store_id_do_A}
2. Verifique: resposta JSON com status 404

Resultado: [  ] PASS  [  ] FAIL
Observação: ____________________
```

### D8-005: PATCH de store alheia retorna 404

```
Procedimento:
1. Como usuário B, faça PATCH em /api/store/{store_id_do_A}
   com body: { "name": "hacked" }
2. Verifique: resposta JSON com status 404 (nunca 403, nunca 200)

Resultado: [  ] PASS  [  ] FAIL
Observação: ____________________
```

### D8-006: GET brand-profile de store alheia retorna 404

```
Procedimento:
1. Como usuário B, faça GET em /api/store/{store_id_do_A}/brand-profile
2. Verifique: resposta JSON com status 404

Resultado: [  ] PASS  [  ] FAIL
Observação: ____________________
```

### D8-007: GET visual-signature de store alheia retorna 404

```
Procedimento:
1. Como usuário B, faça GET em /api/store/{store_id_do_A}/visual-signature
2. Verifique: resposta JSON com status 404

Resultado: [  ] PASS  [  ] FAIL
Observação: ____________________
```

### D8-008: POST generate-image com store alheia retorna 404

```
Procedimento:
1. Como usuário B, faça POST em /api/campaign/generate-image
   com body: { "storeId": "{store_id_do_A}", "product": "teste", "offer": "teste" }
2. Verifique: resposta JSON com status 404

Resultado: [  ] PASS  [  ] FAIL
Observação: ____________________
```

### D8-009: POST logo em store alheia retorna 404

```
Procedimento:
1. Como usuário B, faça POST em /api/store/{store_id_do_A}/logo
2. Verifique: resposta JSON com status 404

Resultado: [  ] PASS  [  ] FAIL
Observação: ____________________
```

### D8-010: DELETE logo de store alheia retorna 404

```
Procedimento:
1. Como usuário B, faça DELETE em /api/store/{store_id_do_A}/logo
2. Verifique: resposta JSON com status 404

Resultado: [  ] PASS  [  ] FAIL
Observação: ____________________
```

---

## E — Sessão

### D8-011: Refresh (F5) mantém sessão

```
Procedimento:
1. Faça login no browser
2. Pressione F5 (recarregar página)
3. Verifique: você continua autenticado na mesma rota

Resultado: [  ] PASS  [  ] FAIL
Observação: ____________________
```

### D8-012: Fechar e reabrir aba mantém sessão

```
Procedimento:
1. Faça login
2. Copie a URL, feche a aba
3. Abra nova aba, cole a URL
4. Verifique: você continua autenticado (sessão via cookie, não via sessionStorage)

Resultado: [  ] PASS  [  ] FAIL
Observação: ____________________
```

### D8-013: Logout efetivamente destrói sessão

```
Procedimento:
1. Faça login
2. Clique em "Sair"
3. Verifique: foi redirecionado para /login
4. Tente acessar / (dashboard) diretamente
5. Verifique: redirecionou para /login

Resultado: [  ] PASS  [  ] FAIL
Observação: ____________________
```

---

## G — Storage

Estes itens exigem acesso ao Supabase Dashboard (SQL Editor + Storage).

### D8-014: store-brand-assets — URL pública acessível

```
Procedimento:
1. No Supabase Dashboard > Storage, localize um objeto em store-brand-assets
2. Copie a URL pública
3. Abra em janela anônima (sem sessão)
4. Verifique: a imagem carrega (public-read)

Resultado: [  ] PASS  [  ] FAIL
Observação: ____________________
```

### D8-015: store-brand-assets — listagem bloqueada

```
Procedimento:
1. No SQL Editor, execute como usuário autenticado (RLS):
   SELECT * FROM storage.objects WHERE bucket_id = 'store-brand-assets';
2. Verifique: retorna apenas objetos do próprio path (store_id)
   OU 0 registros se não houver permissão de listagem

Resultado: [  ] PASS  [  ] FAIL
Observação: ____________________
```

### D8-016: visual-signatures — URL pública acessível

```
Procedimento: (mesmo procedimento do D8-014, bucket visual-signatures)

Resultado: [  ] PASS  [  ] FAIL
Observação: ____________________
```

### D8-017: visual-signatures — listagem bloqueada

```
Procedimento: (mesmo procedimento do D8-015, bucket visual-signatures)

Resultado: [  ] PASS  [  ] FAIL
Observação: ____________________
```

### D8-018: store-logos — inventário

```
Procedimento:
1. No SQL Editor, execute:
   SELECT * FROM storage.objects WHERE bucket_id = 'store-logos';
2. Liste quantos objetos existem e de quais stores
3. Decisão: [  ] Pode remover (0 objetos ou só lixo)
               [  ] Migrar para store-brand-assets e depois remover
               [  ] Manter como está

Objetos encontrados: ____________________
Decisão: ________________________________
```

---

## H — Vazamento Cross-Session

### D8-019: Logout não deixa resquícios de preview/draft para o próximo usuário

```
Procedimento:
1. Como usuário A, faça login, preencha o formulário de campanha
   (isso salva "campaign_draft" no sessionStorage)
2. Clique em "Sair"
3. Abra o DevTools > Application > Storage > Session Storage
4. Verifique: não há mais chaves "campaign_draft", "campaign_draft_image", "campaign_preview"
5. Faça login como usuário B (mesmo browser)
6. Acesse a dashboard (/)
7. Verifique: não aparece preview/draft do usuário A

Resultado: [  ] PASS  [  ] FAIL
Observação: ____________________
```

---

## RLS — Banco (SQL Editor do Supabase)

### D8-020: RLS habilitado nas 5 tabelas

```
Procedimento:
1. No SQL Editor, execute:
   SELECT schemaname, tablename, rowsecurity
   FROM pg_tables
   WHERE schemaname = 'public'
     AND tablename IN ('stores','store_brand_assets','store_brand_profiles','store_visual_signatures','generation_events')
   ORDER BY tablename;
2. Verifique: todas as 5 têm rowsecurity = true

Resultado: [  ] PASS  [  ] FAIL
Observação: ____________________
```

### D8-021: generation_events — default-deny (authenticated não vê nada)

```
Procedimento:
1. No SQL Editor, obtenha um JWT de um usuário autenticado
   (ou use a função auth.uid() se disponível)
2. Execute:
   SELECT * FROM public.generation_events LIMIT 1;
3. Verifique: retorna 0 registros (RLS bloqueia SELECT)
   OU erro de permissão

Resultado: [  ] PASS  [  ] FAIL
Observação: ____________________
```

### D8-022: Isolamento real na tabela stores

```
Procedimento:
1. Crie/obtenha IDs de dois usuários diferentes (U1, U2)
2. Como U1, execute:
   SELECT * FROM public.stores WHERE user_id = 'ID-DO-U2';
3. Verifique: retorna 0 registros

Resultado: [  ] PASS  [  ] FAIL
Observação: ____________________
```

### D8-023: Isolamento real na tabela store_brand_assets

```
Procedimento:
1. Como U1, tente SELECT em store_brand_assets de U2
2. Verifique: retorna 0 registros

Resultado: [  ] PASS  [  ] FAIL
Observação: ____________________
```

### D8-024: Isolamento real na tabela store_visual_signatures

```
Procedimento: (mesmo procedimento, tabela store_visual_signatures)

Resultado: [  ] PASS  [  ] FAIL
Observação: ____________________
```

---

## Resumo

| Item | Status | 
|------|--------|
| A-001 a C-003 | Coberto por testes automatizados (pular) |
| D8-004 a D8-010 | ___ / 7 |
| D8-011 a D8-013 | ___ / 3 |
| D8-014 a D8-018 | ___ / 5 |
| D8-019 | ___ / 1 |
| D8-020 a D8-024 | ___ / 5 |
| **Total verificações** | **___ / 21** |

**Condição de fechamento da milestone:** Todos os itens marcados como PASS.

---

*Documento criado: 2026-07-08*
*Fase: 11 — Verificação e Hardening*
