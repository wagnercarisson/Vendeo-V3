# Runbook de Release — F56.2b2d (Produto 1:1 Hospedado)

**Escopo:** publicação verificável do piloto hospedado do Produto 1:1 em lojas de teste.
**Regra de escopo:** este runbook **descreve** as etapas. Nenhuma etapa é executada por tooling
automatizado desta fase; cada efeito irreversível exige **checkpoint humano** explícito e autorizado.
Nenhum script desta fase executa `db push`, reset, deploy, `migration repair` ou chamada paga.

As cinco etapas são executadas em **ordens separadas e autorizadas**. Não iniciar a etapa N+1 sem
a etapa N aprovada. Cada etapa abre com um **checkpoint humano** que deve retornar `APPROVED`.

## Formato de Evidência

Cada critério registra `status` (`PASS`/`FAIL`/`INCONCLUSIVE`), `source` e `timestamp`:

```
criterio | status | fonte | timestamp
```

Regra fail-closed (ver `scripts/f56-2b2d/verify-hosted-release.mjs`):

- `APPROVED` **somente** quando **todos** os critérios obrigatórios do perfil forem `PASS` com
  **fonte** e **timestamp**.
- Qualquer ausência, `FAIL`, `INCONCLUSIVE`, `status` inválido ou documento contraditório ⇒ não
  aprovado (exit 1). A evidência fica **fora do Git**.

---

## Etapa 1 — Backup Verificável (banco + Storage)

> **CHECKPOINT HUMANO 1 — antes de qualquer migration.**
> Autorizar somente com a evidência de restauração comprovada.

Perfil de evidência: `backup` (8 critérios). Procedimento em `backup-runbook.md`, seção
*F56.2b2d — Backup Verificável Antes das Migrations*.

- Plano Free **não** tem backup restaurável gerenciado; `walg_enabled=true` e `backups=[]` **não**
  provam restaurabilidade; **PITR desabilitado** (nenhum procedimento presume point-in-time).
- Backup de banco + objetos de Storage com contagens, bytes e SHA-256.
- Restauração comprovada em **destino local separado**, sem sobrescrever `vendeo-homolog`.

Verificação: `node scripts/f56-2b2d/verify-hosted-release.mjs --check <backup.json> --profile backup`.

---

## Etapa 2 — Migrations do Conjunto Definitivo

> **CHECKPOINT HUMANO 2 — autorizar a aplicação do conjunto definitivo.**

Perfil de evidência: `migrations` (4 critérios).

1. Gerar/conferir o manifesto do conjunto definitivo:
   `node scripts/f56-2b2d/fix-migration-set.mjs --dir supabase/migrations --out <manifest.json>` e
   `--check <manifest.json>` (SHA-256 e ordem por arquivo). O manifesto é fixado **após** a
   implementação; **não presumir 129** no ledger.
2. Aplicar o conjunto **ordenado** via `supabase db push`.
3. As **duas migrations de laboratório** são explicitamente tratadas — **recomendação: aplicar no
   lote**. **Nunca** usar `migration repair` para forjá-las.
4. Confirmar o **ledger completo** cobrindo exatamente o manifesto.

Verificação: `verify-hosted-release.mjs --check <migrations.json> --profile migrations`.

---

## Etapa 3 — Deploy em `main` com Fluxo OFF

> **CHECKPOINT HUMANO 3 — autorizar o deploy. O fluxo deve subir OFF.**

- Merge para `main`; verificar via API Vercel commit/branch/plano/Fluid/`functionDefaultTimeout=300`.
- O deploy sobe com o **fluxo OFF** (nenhuma flag habilitadora), sem liberar lojas.
- Rollback de código **não** reverte banco/ledger (forward-only; `REVERT` manual).

---

## Etapa 4 — Configuração

> **CHECKPOINT HUMANO 4 — autorizar a configuração (sem habilitar lojas).**

- Catálogo de produtos e pricing (principal + fallback).
- `image_model_pair_config` definido.
- Preflight `complete`.

---

## Etapa 5 — Verificação do Legado (não regressão)

> **CHECKPOINT HUMANO 5 — autorizar o encerramento do release.**

Perfil de evidência: `release` (7 critérios).

- Novo fluxo **OFF**; autorização desabilitada (último evento por escopo `off`/`refused`).
- `all_stores=false`.
- Pausa global (`VENDEO_GENERATION_PAUSED`) **preservada** como estava.

Verificação: `verify-hosted-release.mjs --check <release.json> --profile release`.

Somente com todos os checkpoints `APPROVED` o piloto pode ser iniciado
(`f56-2b2d-pilot-runbook.md`).
