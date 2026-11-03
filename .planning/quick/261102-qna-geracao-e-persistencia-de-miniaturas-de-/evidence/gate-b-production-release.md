# Liberação controlada do script para produção — preparação local

**Data:** 2026-11-03
**Continuidade operacional:** quick `261102-qna` (script/backfill), vinculada à `261102-tnu` (consumidores).
**Branch:** `perf/miniaturas-campanhas`
**Status:** guardas ajustadas e testadas localmente. **Produção NÃO acessada.**

## 1. Diff resumido das guardas

### Antes
- `homolog` e `production` bloqueados por `target_env_blocked`.
- `--write` só era permitido com `--env local`.

### Depois
- `homolog` continua bloqueado (`target_env_blocked`) — fora desta autorização.
- `production` permitido somente com:
  - `--env production`;
  - `--expected-url` com origem exata (protocolo + host + porta);
  - origem efetiva **não loopback** (`127.0.0.1`/`localhost`/`::1` bloqueados);
  - dry-run por padrão;
  - `--write` exige `--confirm-env production`.
- `local` continua exigindo loopback.
- `validateBackfillPreflight` é chamado pelo CLI **antes de criar o client**; bloqueios retornam exit 2 sem chamadas externas.
- Runner revalida guardas completas antes de qualquer dependência; testes provam deps com zero chamadas.
- Mantidos: inventário `ready`, allowlist de caminhos, isolamento por loja, skip-existing/`upsert:false`, limites, concorrência, cursor keyset com precisão integral e relatórios.

**Arquivos alterados**
- `src/lib/campaign/thumbnail/backfill-runner.ts`
- `scripts/campaign-thumbnails/backfill.ts`
- `src/lib/campaign/thumbnail/__tests__/backfill-runner.test.ts`
- documentação/evidência (este arquivo, SUMMARY/STATE)

## 2. Testes

| Gate | Resultado |
|---|---|
| Módulo thumbnail/backfill | **51/51** (`backfill-runner` 18/18) |
| Typecheck | 0 |
| Lint | 0 (limitação conhecida sem TS) |
| `git diff --check` | limpo |

Casos cobertos:
- produção em **dry-run** permitida (origem não loopback);
- produção com **write confirmado** permitida;
- produção **sem confirmação** ⇒ `write_not_confirmed`, zero chamadas;
- produção em **loopback** ⇒ `production_loopback_blocked`, zero chamadas;
- produção com **endpoint divergente** ⇒ `endpoint_mismatch`, zero chamadas;
- `homolog` ⇒ `target_env_blocked`, zero chamadas;
- `local` não loopback ⇒ `local_requires_loopback`, zero chamadas;
- guards de contexto/limites/cursor preservados.

Teste manual do CLI (sem rede; envs dummy):
- `production + loopback` ⇒ exit 2 `production_loopback_blocked`;
- `homolog + write` ⇒ exit 2 `target_env_blocked`;
- `production + endpoint divergente` ⇒ exit 2 `endpoint_mismatch`.

## 3. Comando proposto — dry-run remoto (placeholders)

```powershell
$env:NEXT_PUBLIC_SUPABASE_URL = "https://<project-ref>.supabase.co"
# chave fornecida sem eco/histórico — ver §4

node node_modules/tsx/dist/cli.mjs scripts/campaign-thumbnails/backfill.ts `
  --env production `
  --expected-url "https://<project-ref>.supabase.co" `
  --dry-run `
  --limit 10 --batch-size 5 --concurrency 2 `
  --report ".planning/quick/261102-qna-.../evidence/production-dry-run-01.json"
```

Depois da amostra: ampliar somente leitura com `--after <cursor>` até `cursor: null`, mantendo `--report` por lote.

## 4. Credenciais sem exposição

- Preferir variáveis de ambiente na sessão, nunca argumentos de linha de comando.
- Prompt sem eco (PowerShell):

```powershell
$secure = Read-Host "SUPABASE_SERVICE_ROLE_KEY (produção)" -AsSecureString
$ptr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure)
$env:SUPABASE_SERVICE_ROLE_KEY = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($ptr)
[Runtime.InteropServices.Marshal]::ZeroFreeBSTR($ptr)
```

- Não usar `Write-Host`/`echo` da chave; não colar em evidências, relatórios ou histórico shell.
- Evitar `--env-file` dentro do repositório. Se necessário, usar arquivo temporário **fora** do repo, com ACL restrita, e apagar ao final.
- Ao terminar: `Remove-Item Env:NEXT_PUBLIC_SUPABASE_URL,Env:SUPABASE_SERVICE_ROLE_KEY`.
- A URL de projeto não é segredo, mas a chave de service role é.

## 5. Plano operacional

1. **Dry-run remoto** (10 itens) com `--env production --expected-url` exato; revisar relatório: `would_create/already_exists/missing_original/access_error/invalid_format/ineligible/failed`.
2. Ampliar leitura em lotes (cursor keyset) até `cursor: null`; registrar total `ready` e caminhos.
3. **Piloto com escrita**: 10 itens, `--write --confirm-env production`, lote 5, concorrência 2; conferir WebP 288, privacidade, originais/campanhas/créditos.
4. Reexecutar os 10 ⇒ `already_exists`, sem sobrescrita.
5. **Restante**: lotes de 25 com os cursores, até `cursor: null`; relatório por lote.
6. Conferência final: 100% `already_exists` em dry-run, nenhuma falha, originais/campanhas/créditos íntegros.
7. Publicar o código das duas quicks juntas (gate separado).

## 6. Critérios de parada

Parar imediatamente e não ampliar se:
- qualquer guarda bloquear (`target_env_blocked`, `endpoint_mismatch`, `production_loopback_blocked`, `write_not_confirmed`, `context_endpoint_mismatch`);
- `failed`, `access_error`, `missing_original` ou `invalid_format` > 0 na amostra;
- contagem de `ready`/caminhos divergir do esperado ou houver path fora da allowlist;
- miniatura criada não for WebP ≤288 ou o bucket não estiver privado;
- qualquer original/campanha/crédito mudar;
- reexecução não retornar `already_exists`;
- qualquer dúvida sobre o ambiente/endpoint.

## 7. Limites desta rodada

- Nenhum acesso a produção, dry-run remoto, escrita em banco/Storage, commit, merge, push ou deploy.
- Homolog segue bloqueado.
- A autorização de leitura remota será dada separadamente.
