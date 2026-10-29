# F57.3 — Smoke de API em produção (2026-10-29)

## Autorização e alvo

- Autorização específica do responsável para smoke via API autenticada, com PATCH temporário e
  restauração da preferência inicial.
- Alvo: **https://vendeo.tech** (Vercel), projeto Supabase `gvbzwihwgzujwsviufgy`.
- Sessão fornecida por cookie exportado do navegador; usada apenas em memória.
- Nenhum SQL direto, Admin API, criação de usuário, push ou deploy.
- Nenhum cookie/token foi impresso, versionado ou persistido; o arquivo temporário foi removido.

## Preferência inicial

```json
{ "uiLocale": "pt-BR", "source": "legacy_br", "version": 2 }
```

## Configurações da loja (antes e depois)

```json
{
  "countryCode": "BR",
  "countrySource": "legacy_br",
  "defaultCampaignMarket": "BR",
  "defaultCampaignMarketSource": "default",
  "defaultContentLocale": "pt-BR",
  "defaultContentLocaleSource": "default",
  "defaultCurrency": "BRL",
  "defaultCurrencySource": "default",
  "timeZone": "America/Sao_Paulo",
  "timeZoneSource": "default",
  "contextVersion": 1,
  "settingsVersion": 2
}
```

Comparação antes/depois: **idêntica**.

## Sequência executada

| Passo | Status | Resultado |
|---|---|---|
| `GET /api/preferences` inicial | 200 | `pt-BR` / `legacy_br` / v2 |
| `PATCH { uiLocale: "es-419", expectedVersion: 2 }` | 200 | `es-419` / `explicit` / v3 |
| `GET /api/preferences` | 200 | confirma `es-419` / v3 |
| `PATCH { uiLocale: "es-PY", expectedVersion: 3 }` | 400 | `validation_error` em `uiLocale`; preferência permaneceu `es-419` / v3 |
| `PATCH { uiLocale: "pt-BR", expectedVersion: 2 }` | 409 | `preferences_version_conflict`, `currentVersion: 3`; sem alteração |
| `PATCH { expectedVersion: 3 }` (omitido) | 200 | devolveu `es-419` / v3, sem escrita |
| `PATCH { uiLocale: null, expectedVersion: 3 }` | 200 | `pt-BR` / `legacy_br` / v4 |
| `GET /api/store/market-settings` | 200 | idêntico ao inicial |
| `GET /api/preferences` final | 200 | `pt-BR` / `legacy_br` / v4 |

## Restauração

- O estado final efetivo (`pt-BR` / `legacy_br`) já coincidia com o inicial após o `PATCH null`.
- Nenhuma chamada adicional de restauração foi necessária.
- A versão final é **4**, maior que a inicial (**2**); nenhum retrocesso de versão.
- Nenhuma linha foi apagada.

## Conclusões

- `es-419` aceito e persistido na interface em produção.
- `es-PY` rejeitado na interface com 400, sem escrita.
- `409` de versão e escrita omitida preservados.
- `null` limpa a escolha e incrementa a versão normalmente.
- Configurações da loja permaneceram idênticas.
- Código em produção já aceita o contrato novo.
- Nenhuma produção foi alterada fora da preferência temporária da conta de teste.
