---
id: 261016-nst
part: apply-app-validation
status: executed
date: 2026-10-16
---

# Apply da troca + validação da aplicação (vendeo-homolog)

## Troca aplicada
- `scripts/switch-env-homolog.ps1 -Action apply` executado (revalidação de instância/loopback:57781/chaves/artefato OK). `.env.local` passou a apontar para **`http://127.0.0.1:57781`**. `VENDEO_GENERATION_PAUSED=true`; providers/deploy/OAuth neutralizados. `.env.local.pre-homolog.bak` preserva o estado anterior (f562a) para rollback.

## Servidor Next
- Reiniciado com `next dev -H 127.0.0.1`: log `Local: http://127.0.0.1:3000` e `Environments: .env.local`; `netstat` → **127.0.0.1:3000** (não 0.0.0.0). Homepage `/` → **200**; `/login` → **200**; `/campanhas` e `/loja` → **302 → /login** (middleware/auth server-side funcionando).
- **Destino confirmado sem imprimir chaves:** `.env.local` `SUPABASE_URL`/`NEXT_PUBLIC_SUPABASE_URL = http://127.0.0.1:57781` (fonte de runtime) + chamadas server-side ao auth/DB do homolog bem-sucedidas.

## Validação funcional (backend do homolog)
| Verificação | Resultado |
|---|---|
| Login por senha — owner Adega (`wagnercarisson@…`) | **200** (access_token) |
| Login por senha — owner NovaTek (`saraswagner72@…`) | **200** (access_token) |
| Ownership/lojas (RLS com token do usuário) | 1 loja por usuário: **Adega** e **NovaTek** |
| Listagem de campanhas | **Adega 52** + **NovaTek 7** = **59** (bate com o baseline) |
| Acesso às imagens (URL assinada server-side, como a app faz) | **200 / 279.999 bytes**; 62 objetos no prefixo da Adega |

- Senhas: definidas temporariamente via **Admin API** (a app real usa captcha) e **hash original restaurado** (`password_restored=true`) ao final de cada teste.

## Métodos e limites
- **Captcha:** o GoTrue do homolog exige Turnstile e subiu com segredo vazio; o `grant_type=password` foi recusado por captcha. Para validar o **login por senha** headless, o captcha foi **desativado temporariamente** no homolog, o stack reiniciado, a validação executada e, em seguida, **captcha reativado** (`[auth.captcha] enabled=true`) e stack reiniciado. Nada disso tocou produção.
- **Não testado:** geração de campanha, Google OAuth, migrations pendentes (nenhuma aplicada).
- **Divergência registrada:** o schema `storage` local **não possui policies de RLS** (o dump reproduziu apenas `public`; as políticas de storage vêm de migrations aplicadas que **não** foram re-executadas). Consequência: listagem/leitura de objetos com **token de usuário** retorna vazio; o acesso do app segue OK porque ele usa **URL assinada server-side**. Correção fica fora do escopo desta rodada.
- `apply`/validação **não** alteraram produção, providers, `.env.local` de outros alvos, nem recriaram a base.

## Estado do servidor
- Next dev em execução em **127.0.0.1:3000** (background, log `logs/homolog-next.log`); Supabase homolog em **127.0.0.1:57781**.

---

## Correção 1 — Policies de Storage reproduzidas (rodada 5)

- Fonte autoritativa: `supabase db dump --linked --schema storage` (remoto). O dump revelou **15 policies** em `storage.objects` (0 em `storage.buckets`); grants são da base.
- Aplicadas **somente** as 15 policies (`drop policy if exists` + `create policy`) no homolog — **sem** reexecutar as 99 migrations. `storage_policies.sql` (evidência fora do Git).
- Verificação: local `pg_policy` em `storage.objects` = **15** com os **mesmos nomes** do remoto; `storage.objects` com RLS habilitado; grants de `authenticated`/`anon` presentes.
- **Acesso autenticado equivalente comprovado** (não mais só URL assinada): com JWT de usuário (assinado com o JWT secret local), a listagem de `campaign-images` retorna **Adega 62** e **NovaTek 14**, e o **cruzado** (NovaTek → prefixo da Adega) = **0** (isolamento por tenant).

## Correção 2 — Login real com CAPTCHA habilitado (rodada 5)

- Site key do widget estava **real** (`0x4AAA…`) com **segredo de teste** no auth → widget falharia no localhost. Corrigido: `NEXT_PUBLIC_TURNSTILE_SITE_KEY` = chave de **teste** (`1x00000000000000000000AA`), mantendo `VENDEO_CAPTCHA_ENABLED=true` e o segredo de teste. `/login` já serve a site key de teste.
- CAPTCHA **habilitado** durante toda a validação (sem desativar). Validado o **mesmo caminho do cliente do navegador** via `@supabase/supabase-js` → `auth.signInWithPassword({ email, password, options: { captchaToken } })`: **Adega OK** e **NovaTek OK** (senhas temporárias via Admin API; hashes originais restaurados).
- **Limitação de método:** não há browser automation instalada (sem Playwright/Puppeteer); a comprovação é pelo **caminho de código do cliente** + página `/login` servindo a site key de teste. Login manual no navegador pelo usuário é recomendável para evidência visual.

## Correção 3 — BOM no `.env.local` (rodada 5)

- O `.env.local` gerado pelo script tinha **BOM** (bug do `Set-Content -Encoding UTF8` no PS 5.1), que quebrava o parser do CLI (`failed to parse environment file`). Corrigido: gravação **UTF-8 sem BOM** (`.env.local` e backups). Reaplicado.
