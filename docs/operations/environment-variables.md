# Environment Variables Catalog

## Launch Config Flags

| Variável | Obrigatória | Default | Descrição | Exemplo |
|----------|-------------|---------|-----------|---------|
| `VENDEO_V15_ENABLED` | Não | `true` | Master switch v1.5. Quando `false`, desativa crédito, Copy Director e rate limit | `true` |
| `VENDEO_CREDITS_CHARGING_ENABLED` | Não | `true` | Habilita cobrança de créditos. Ignorada quando V15_ENABLED=false | `true` |
| `VENDEO_COPY_DIRECTOR_ENABLED` | Não | `true` | Habilita Copy Director IA. Quando `false`, usa fallback determinístico | `true` |
| `VENDEO_RATE_LIMIT_ENABLED` | Não | `true` | Habilita rate limiting. Quando `false`, registra tentativas sem bloquear | `true` |
| `VENDEO_GENERATION_PAUSED` | Não | `false` | Emergency brake. Quando `true`, POST /generate-image retorna 503 | `false` |

## IA / Providers

| Variável | Obrigatória | Default | Descrição | Exemplo |
|----------|-------------|---------|-----------|---------|
| `OPENAI_API_KEY` | Sim | — | Chave da API OpenAI para geração de texto e imagem | `sk-...` |
| `GEMINI_API_KEY` | Não | — | Chave da API Gemini para fallback de texto | `AIza...` |
| `TEXT_FALLBACK_PROVIDER` | Não | — | Provedor fallback para Copy Director (`gemini`) | `gemini` |

## Supabase

| Variável | Obrigatória | Default | Descrição | Exemplo |
|----------|-------------|---------|-----------|---------|
| `NEXT_PUBLIC_SUPABASE_URL` | Sim | — | URL do projeto Supabase | `https://xxx.supabase.co` |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Sim | — | Chave anônima Supabase (pública) | `eyJ...` |
| `SUPABASE_SERVICE_ROLE_KEY` | Sim | — | Chave service_role (backend apenas) | `eyJ...` |

## Operacionais

| Variável | Obrigatória | Default | Descrição | Exemplo |
|----------|-------------|---------|-----------|---------|
| `SUPPORT_EMAIL` | Não | — | Email de suporte para CTAs de crédito e orientação de convite | `suporte@exemplo.com` |
| `VENDEO_USD_BRL_RATE` | Não | `5.50` | Taxa de conversão USD→BRL para dashboard | `5.50` |
| `NEXT_PUBLIC_SITE_URL` | Sim | — | URL pública do app; base do link de convite e dos redirects de auth | `https://vendeo.tech` |
| `VENDEO_EMAIL_ENABLED` | Não | `false` | Habilita envio de e-mail pelo app (convite do beta e notificações) | `true` |
| `RESEND_API_KEY` | Não | — | Chave da API Resend (backend apenas) | `re_...` |
| `VENDEO_EMAIL_FROM` | Não | `noreply@vendeo.tech` | Remetente verificado no Resend | `noreply@vendeo.tech` |
| `RESEND_API_URL` | Não | `https://api.resend.com/emails` | **Somente teste isolado** — endpoint de captura; nunca usar em produção | `http://127.0.0.1:3101/emails` |
