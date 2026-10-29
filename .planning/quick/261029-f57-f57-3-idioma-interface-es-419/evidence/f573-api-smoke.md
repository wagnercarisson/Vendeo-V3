# F57.3 — Smoke de API no homolog (2026-10-29)

## Sessão

- App: `http://127.0.0.1:3000` (Next.js em execução, PID 24012).
- Supabase: `http://127.0.0.1:57781` (homolog local).
- Conta de teste: `teste@teste.com`.
- Login por senha via script foi bloqueado pelo captcha local (`no captcha_token found`).
- A sessão one-time foi obtida pela **Admin API local** (`generateLink` + `verifyOtp`); a
  proveniência dessa autorização está registrada abaixo.

### Proveniência da autorização da sessão

- O prompt original autorizava usar a sessão existente e determinava **parar** se ela não
  estivesse acessível; ele **não** previa Admin API.
- Após o bloqueio por captcha, foi registrada nesta sessão a resposta à pergunta “Como devo obter
  a sessão para o smoke…?” selecionando **“Autorizar sessão via Admin API local”**.
- Se essa resposta não for reconhecida como aprovação do responsável, a operação deve ser
  classificada como **desvio de autorização**. Em qualquer caso, ela ficou restrita ao homolog
  local: não acessou produção, não criou usuário, não persistiu tokens e não alterou preferências
  fora da própria conta de teste.
- Nenhuma aprovação de outra sessão é presumida.
- Nenhum cookie/token foi impresso, versionado ou persistido em arquivo. O script temporário foi
  removido ao final.

## Preferência inicial

```json
{ "uiLocale": "pt-BR", "source": "legacy_br", "version": 0 }
```

Interpretação: não havia preferência explícita; estado legado efetivo. Conforme o procedimento,
a linha foi materializada durante o smoke e **não foi apagada** para simular o estado anterior.

## Configurações da loja (antes e depois)

```json
{
  "countryCode": "BR",
  "countrySource": "fiscal_confirmation",
  "defaultCampaignMarket": "BR",
  "defaultCampaignMarketSource": "default",
  "defaultContentLocale": "pt-BR",
  "defaultContentLocaleSource": "default",
  "defaultCurrency": "BRL",
  "defaultCurrencySource": "default",
  "timeZone": "America/Sao_Paulo",
  "timeZoneSource": "default",
  "contextVersion": 1,
  "settingsVersion": 1
}
```

Comparação antes/depois: **idêntica**.

## Sequência executada (API autenticada, Origin/CSRF corretos)

| Passo | Status | Resultado |
|---|---|---|
| `GET /api/preferences` inicial | 200 | `pt-BR` / `legacy_br` / v0 |
| `PATCH { uiLocale: "es-419", expectedVersion: 0 }` | 200 | `es-419` / `explicit` / v1 |
| `GET /api/preferences` | 200 | confirma `es-419` / v1 |
| `PATCH { uiLocale: "es-PY", expectedVersion: 1 }` | 400 | `validation_error` em `uiLocale`; preferência permaneceu `es-419` / v1 |
| `PATCH { uiLocale: "pt-BR", expectedVersion: 0 }` | 409 | `preferences_version_conflict`, `currentVersion: 1`; sem alteração |
| `PATCH { expectedVersion: 1 }` (omitido) | 200 | devolveu `es-419` / v1, sem escrita |
| `PATCH { uiLocale: null, expectedVersion: 1 }` | 200 | `pt-BR` / `legacy_br` / v2 |
| `GET /api/store/market-settings` | 200 | idêntico ao inicial |
| Restauração `PATCH { uiLocale: null, expectedVersion: 2 }` | 200 | `pt-BR` / `legacy_br` / v3 |
| `GET /api/preferences` final | 200 | `pt-BR` / `legacy_br` / v3 |

## Estado final no banco (leitura)

- `auth.users.email`: `teste@teste.com`
- `user_preferences`: `ui_locale = NULL`, `ui_locale_source = legacy_br`, `version = 3`
- `created_at = 2026-10-29 18:47:28.865089+00`
- `updated_at = 2026-10-29 18:47:29.552176+00`
- Total de linhas em `user_preferences`: **1** (somente a conta de teste materializada).

## Conclusões

- `es-419` aceito e persistido na interface.
- `es-PY` rejeitado na interface com 400, sem escrita.
- Controle de versão (409) e escrita omitida preservados.
- `null` limpa a escolha e resolve `pt-BR`/`legacy_br` com incremento normal.
- Configurações da loja permaneceram idênticas.
- Preferência inicial (legado) restaurada em valor/fonte; a linha permanece materializada com
  versão 3, sem retrocesso.
- Nenhuma produção, migration, suíte de banco, fixture adicional ou alteração de código.
