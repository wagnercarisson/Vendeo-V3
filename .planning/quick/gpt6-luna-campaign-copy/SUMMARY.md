# Quick — gpt-6-luna em `campaign_copy` (seletor admin) — SUMMARY

**Escopo:** adicionar `gpt-6-luna` como modelo de `campaign_copy` na tela admin, reutilizando o seletor
dirigido por catálogo; sem seletor paralelo/env/modelo fixo. **Entrega de implementação local.**

## Arquivos / commits
- `supabase/migrations/20261018000001_quick_gpt6_luna_campaign_copy.sql` — **autorada, NÃO aplicada**.
  **SHA-256:** `0723C8916C5747893470019DBEAF9966D783D1C76EF8D44C433B4C111828B0F7` (forward-only; confere
  divergência; sem `ON CONFLICT DO NOTHING`; `validated_at NULL`).
- `src/lib/ai/model-registry.ts` — allowlist `openai: gpt-6-luna` (default gpt-4o intacto).
- `src/lib/ai/adapters/chat-completions.ts` — 2b: `gpt-6-luna` usa **`reasoning_effort:"none"` (escolha nossa)**,
  **`max_completion_tokens`**, **sem `temperature`**; GPT-4o/Gemini preservados.
- `src/lib/ai/gateway.ts` — `prepare`/`invokePrepared` + `PreparedInvocation` (`resolved` **congelado**);
  legado via `prepare→invokePrepared`.
- `src/lib/product-1-1/pilot/copy-estimate.ts` — helper puro (saída **1.000** tokens + premissa de entrada
  **documentada**; `code_default`/inválido ⇒ `null`).
- `src/lib/product-1-1/copy/default-copy-runner.ts` — prepare + pricing **por alvo** + **versionId registrado**
  + `invokePrepared` + bloqueio sem prepare/pricing.
- Removido o contrato env concorrente (`resolvePilotCopyEstimatedUsd`/`pilotCopyEstimatedUsd`).
- Commits: `0b72ad99`, `8ba2ec8e`, `7d08a068`, `1b1520d4`, `85d4e2eb`, `322809d0`, `72c67291`, `9934fc30`.

## Gates (código final)
- **`typecheck` 0** · **`lint` (completo) 0** · **`build` 0** (dev parado para não disputar `.next`).
- Suítes afetadas: **130/130 verde** (7 suítes + behavioral 18/18), incluindo:
  - pinning Luna→GPT-4o; adapter Luna vs GPT-4o; cadeia `pricing/versão→gate→invokePrepared→end/markUnknown`;
    **bloqueio** sem `prepare` e com pricing `null` (sem provider); **fallback com MODELO distinto** (gemini) —
    reader recebe `provider/model` do fallback e o MESMO alvo chega a `invokePrepared`; **rastreabilidade**
    (versão de pricing + modelo + estimativa vinculados a `campaignId/operationId` e `callId` após aquisição).
  - **Recuperação REAL** via `ProductOneToOneCopyRecoveryClient.recoverCopyAttempt` (fronteiras simuladas):
    vencedor (adquire → prepara alvo → estima pelo pricing → `invokePrepared`), pricing inválido **bloqueia** sem
    provider, e **perdedor** NÃO chama provider nem o gate.
- **Falhas PRÉ-EXISTENTES (discriminadas):** `copy-recovery.contract` **10** + `copy-wiring-gaps.contract`
  **3** = **13** — idênticas no baseline (verificado por `stash`), **não** substituem os testes novos.

## Pacote para aplicação local (NÃO executado)
1. **Migration** (catálogo) só na `vendeo-homolog` via `migration up --local`.
2. **Pricing:** `admin_set_ai_model_price(openai/gpt-6-luna, input 0.10, output 0.50, cached 0.01,
   source_url=platform.openai.com/docs/pricing)`.
3. **Seleção:** UI admin (`admin_set_ai_model_selection`, `campaign_copy` → `openai/gpt-6-luna`), na sessão.

## Fora da autorização atual
Aplicar migration, cadastrar pricing, selecionar Luna, ligar flags ou chamadas pagas. Sem produção/deploy.
