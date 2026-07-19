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
| `SUPPORT_EMAIL` | Não | — | Email de suporte para CTAs de crédito | `suporte@exemplo.com` |
| `VENDEO_USD_BRL_RATE` | Não | `5.50` | Taxa de conversão USD→BRL para dashboard | `5.50` |
