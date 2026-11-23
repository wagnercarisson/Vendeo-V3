# F62 — Ajustes residuais da revisão de planos

**Data:** 2026-11-23
**Origem:** revisão de aprovação dos planos (plan-check final `PASS WITH FINDINGS`: 0 blockers / 0 high / 0 medium / 5 low / 3 info) e revisão do responsável.
**Escopo:** registro documental. **Nenhum ajuste abaixo foi aplicado nesta execução**, exceto o tracking aprovado. A execução autorizada cobre **somente** o `62-01`.
**Regra de aplicação:** cada ajuste deve ser incorporado ao plano correspondente **antes** de autorizar/executar aquele plano. A aprovação do `62-01` não aprova os planos seguintes.

| # | Plano(s) | Ajuste obrigatório antes da execução | Evidência de conclusão |
|---|---|---|---|
| **R1** | `62-08` | **Autorização estruturada.** Substituir os sentinelas de texto livre (`AUTORIZADO`, `PROVIDER_AUTORIZADO`) por um bloco estruturado, com campos obrigatórios e verificáveis: ambiente/alvo (host, porta, banco, container), branch + HEAD, versão e SHA-256 da migration, ledger antes/depois, backup (arquivo + SHA-256 + `restore-list`), escopo permitido, chamadas máximas ao provider, custo máximo, validade da autorização, aprovador e data, plano de rollback. O `<verify>` deve falhar com exit code não-zero quando qualquer campo estiver ausente.
| **R2** | `62-08` | **Arquivo único da autorização paga.** Alinhar `<files>` e `<verify>` do checkpoint da prova paga ao mesmo arquivo (hoje `62-08:121` aponta `62-08-PROVIDER-PROOF.md` e `62-08:125` verifica `62-08-PREFLIGHT.md`). Adotar um único arquivo de autorização paga (por exemplo `62-08-PROVIDER-AUTHORIZATION.md`) e referenciá-lo sem duplicação. |
| **R3** | `62-07`, `62-08` | **Ordem migration → código.** Explicitar no checklist de release: backup → aplicação da migration autorizada (novo valor de CHECK, ex. `delivered_campaign_reuse`) → conferência de ledger/hash/schema → só então deploy do código que grava o novo valor → smoke. Nenhum código que dependa do CHECK novo pode ser publicado antes da migration aplicada e verificada. |
| **R4** | `62-03` | **L-A — nomear `ArtifactOrigin`.** A Task 2 manda persistir `delivered_campaign_reuse` mas não cita a extensão da união `ArtifactOrigin` em `src/lib/campaign/composition-artifacts/types.ts`. Nomear a extensão para evitar erro de typecheck e manter a autoridade única do tipo. |
| **R5** | `62-07` | **L-E — verify do checkpoint humano.** Trocar o `Get-Content ...` com `Select-String` do checklist de release (Task 5) por `if ($t -notmatch ...) { throw }`, alinhando o verify auxiliar ao restante da rodada. O gate real continua sendo a revisão humana. |
| **R6** | `62-07`, `62-08` | **L-D — notas de decomposição.** Adicionar nota curta de decomposição em `62-07` (5 tasks) e `62-08` (8 tasks), como já existe em `62-03`/`62-04`, para não sugerir plano grande demais. |
| **R7** | `62-05` | **INFO-2 — teste do chip na task.** Incluir `campaign-format-chips.test.tsx` no `<verify>` da Task 3 (task que altera o componente), e não apenas na verificação do plano. |
| **R8** | `62-03`, `62-04` | **Seleção de campanha legada.** Reconciliado em 2026-11-23: `legacy_campaign` é origem da campanha/fonte, não da seleção. A abertura nova usa a configuração atual `configured` com versão válida; não aceitar `legacy`/`legacy_sunburst_low` nem ampliar o CHECK do F60.6. Incluir teste explícito de campanha legada + seleção atual configurada antes de executar `62-03`/`62-04`. |

## Fora deste registro

- Nenhuma alteração de código, migration, banco, Storage, provider, flag, ambiente, homolog, produção, merge, push, deploy, sync ou archive.
- O `62-01` pode ser executado com o baseline atual; os itens acima não bloqueiam o `62-01`.
- A ordem de correção sugerida é `R1`–`R3` antes de `62-08`, `R4` antes de `62-03`, `R5`/`R6` antes de `62-07` e `R7` antes de `62-05`.
