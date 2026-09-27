# F48.2.1 Verification — Otimização dos Prompts do Diretor (bancada manual)

**Status:** **PASSED (validação automática + isolamento)** — gates verdes (typecheck, lint, build, testes direcionados do laboratório/Planos 07/08); suíte completa com **exclusivamente** a exceção preexistente e comprovada da F50; isolamento de `prompts/` e das estruturas produtivas confirmado; nenhuma execução paga. Encerramento operacional (programa/experimento) e UAT: ver `48.2.1-UAT.md`.

**Fase:** 48.2.1 (otimizacao-prompts-diretor) — v1.5
**Plano:** `48-2-1-09` (onda 9) — Tasks 1–2 (verificação/UAT); Tasks 3–5 (decisão/encerramento) pendentes de checkpoint humano.
**Fonte da verdade:** `openspec/changes/fase-48-2-1-otimizacao-prompts-diretor/` (tasks C8–C10 / D1–D4; specs `lab-isolation`, `lab-prompt-optimization`).
**Escopo realinhado:** commit `017b8799` — bancada manual, **sem** execução paga, sem promoção, sem `db push` remoto, `prompts/` intocado.

---

## 1. Validação automática (C8)

Executada em 2026-09-27 (host local, Supabase Docker). Comandos invocados como `npm.cmd` (equivalente ao `npm` no PowerShell; o shim `npm` não é invocável em pipeline neste host).

| Gate | Comando | Resultado |
|---|---|---|
| Typecheck | `npm.cmd run typecheck` | ✅ **exit 0** |
| Lint | `npm.cmd run lint` | ✅ **exit 0** |
| Build (inclui `check:cnae`) | `npm.cmd run build` | ✅ **exit 0** — `check:cnae OK`; `Compiled successfully`; 68/68 páginas estáticas geradas |
| Testes direcionados F48.2.1/lab + Planos 07/08 | `npm.cmd test -- --run src/lib/lab "src/app/(app)/admin/laboratorio" src/app/api/admin/laboratorio src/lib/admin` | ✅ **exit 0** — `Test Files 52 passed (52)`; `Tests 1014 passed | 1 skipped (1015)` |
| Suíte completa | `npm.cmd test -- --run` | ⚠️ **exit 1** — exclusivamente a exceção preexistente da F50 (ver §2) |

### 1.1 Escopo dos testes direcionados

Os testes direcionados cobrem `src/lib/lab/**`, `src/app/(app)/admin/laboratorio/**`, `src/app/api/admin/laboratorio/**` e `src/lib/admin/**` — incluindo os arquivos modificados pelos Planos 07 (segurança financeira/revogação fail-closed) e 08 (orçamento visível/arquivamento seguro). Nenhuma falha; nenhuma rede a provider.

---

## 2. Suíte completa — exceção preexistente da F50 (fail-closed)

A suíte completa **não** retornou exit 0; retornou **exclusivamente** a exceção preexistente e comprovada da F50. Todas as condições mecânicas foram verificadas:

| # | Condição mecânica | Resultado |
|---|---|---|
| i | Exit code da suíte ≠ 0 | ✅ `exit 1` |
| ii | `Test Files  1 failed` (tolerante a espaços) | ✅ `Test Files 1 failed | 370 passed (371)` |
| iii | `Tests  1 failed` (tolerante a espaços) | ✅ `Tests 1 failed | 3964 passed | 1 skipped (3966)` |
| iv | Arquivo é `legal-document-versions.test.ts` | ✅ `FAIL src/lib/legal/__tests__/legal-document-versions.test.ts > F50 legal publication contract > keeps pending…` |
| v | Mensagem é `ENOENT` | ✅ `Error: ENOENT: no such file or directory, open '…'` |
| vi | Caminho ausente = antigo caminho ativo da F50 | ✅ `openspec\changes\fase-50-demonstracao-gratuita-e-validade-dos-creditos\legal-consolidated-pending\terms-of-service-v1-5.md` |
| vii | Nenhum teste da F48.2.1/laboratório falhou | ✅ nenhuma linha `FAIL` em `src/lib/lab`/`admin/laboratorio` |

**Conclusão:** o gate fail-closed passa com a exceção exata da F50 (1 arquivo / 1 teste), sem nenhuma falha do laboratório/F48.2.1.

### 2.1 Follow-up externo à F48.2.1 — teste F50 (não corrigido nesta fase)

- **Arquivo:** `src/lib/legal/__tests__/legal-document-versions.test.ts` — teste `"keeps pending consolidated documents outside public and the catalog"`.
- **Falha:** `ENOENT` ao abrir `openspec/changes/fase-50-demonstracao-gratuita-e-validade-dos-creditos/legal-consolidated-pending/terms-of-service-v1-5.md` (o diretório não existe; a change F50 foi arquivada).
- **Atribuição:** **não** causada pela F48.2.1; pertence à linha da F50.
- **Ação nesta fase:** **não corrigido** (fora de escopo). Registrado em `deferred-items.md` como follow-up externo.

> **Nota de robustez de data (test-only, autorizada):** durante a validação, um segundo conjunto de falhas preexistentes e **não relacionadas** foi detectado em `src/components/flow/__tests__/use-campaign-form-validity.test.ts` (3 testes que usavam `2026-09-25` como data futura, agora passada). Por autorização humana explícita, foi aplicado um ajuste **exclusivamente de teste** (congelamento de relógio no bloco `D2/D5`, espelhando o bloco `Q-P3U`) — **sem** alterar código produtivo. Detalhes em `deferred-items.md`; commit `test(48-2-1-09): freeze clock in D2/D5 validity block (date-robust, authorized)`. Com o ajuste, a suíte completa volta a conter **apenas** a exceção da F50.

---

## 3. Isolamento (C9)

### 3.1 `prompts/` intocado

- `git status --porcelain prompts/` → **vazio** (nenhum prompt produtivo alterado byte a byte).

### 3.2 Fronteira local (sem `db push` remoto)

- Nenhum `db push` remoto foi executado nesta fase; a migration dos Planos 07/08 foi aplicada apenas localmente (`npx supabase migration up`), preservando os registros locais.
- A migration da F48.2.1 **não** é aplicada no remoto nesta fase (F48.2.3 é a fatia de promoção/`db push`).

### 3.3 Allowlist das referências históricas do Revisor

Enumerados mecanicamente os arquivos que contêm `reviewer`/`campaign_image_review` em `src/lib/lab/**` e nas superfícies do laboratório. Resultado — **exatamente** os três arquivos preexistentes:

| Arquivo (allowlist) |
|---|
| `src/lib/lab/gateway/__tests__/lab-model-resolver.test.ts` |
| `src/lib/lab/gateway/__tests__/lab-gateway-harness.contract.test.ts` |
| `src/lib/lab/gateway/__tests__/lab-prompt-loader.test.ts` |

- **Arquivos adicionais:** nenhum (`extra` vazio).
- **Novas estruturas do Revisor:** nenhuma (sem modo `reviewer`, sem casos de revisão, sem API/UI do Revisor, sem `campaign_image_review` novo). As três referências históricas **não** são escopo implementado pela F48.2.1 (pertencem à F48.2.2).

### 3.4 Estruturas produtivas

- Nenhuma escrita do laboratório em `campaigns`, `campaign_art_versions`, `generation_events`, `ai_model_selection`, `admin_audit_log` ou bucket `campaign-images`.
- As únicas referências do laboratório a `ai_model_catalog` são **leitura** (allowlist read-only): `src/lib/lab/domain/model-target.ts` e `src/lib/lab/api/experiment-queries.ts`.

---

## 4. Execução paga

- **Nenhuma chamada paga** foi executada para produzir esta verificação (gates usam fakes; nenhuma rede a provider).
- **Nenhum run**, nenhuma reserva/consumo de orçamento, nenhuma promoção.

---

*Última atualização: Task 1 do Plano 48-2-1-09. As fronteiras F48.2.2/F48.2.3/F48.6, o registro C10 (primeira operação paga futura) e a UAT estão em `48.2.1-UAT.md` / nas seções seguintes, adicionadas pela Task 2.*
