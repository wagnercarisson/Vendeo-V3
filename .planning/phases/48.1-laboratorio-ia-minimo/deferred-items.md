# Deferred Items — Phase 48.1 (Laboratório Mínimo de IA)

Itens encontrados durante a execução que estão **fora do escopo** da task corrente
(scope boundary: não auto-corrigir problemas pré-existentes ou de arquivos não
relacionados). Registrados para avaliação futura.

## 48-1-05 — Harness de gateway isolado

### 1. `campaign_image_edit` como literal em teste negativo pré-existente

- **Arquivo:** `src/lib/lab/domain/__tests__/schemas.test.ts:231`
- **Origem:** commit `6cf418c7` (48-1-04) — pré-existente, não modificado pelo 48-1-05.
- **Contexto:** a verificação plan-level do 48-1-05 exige
  `rg "OpenAIImageProvider|providers/openai|campaign_image_edit" src/lib/lab` → 0
  ocorrências. Esse arquivo contém 1 linha com o literal `campaign_image_edit`:
  `validInput({ primaryCapability: "campaign_image_edit" })` — um teste **negativo**
  que afirma a rejeição da capacidade pelo schema (`expect(result.success).toBe(false)`).
- **Impacto:** nenhum. Não abre caminho de fallback nem instancia provider de imagem;
  ao contrário, **reforça** a fence de `campaign_image` como capacidade única.
- **Ação recomendada:** nenhuma. Se o grep literal precisar ficar estritamente em 0
  no futuro, substituir o literal por uma constante compartilhada de capacidade
  proibida — decisão de outro plano (não do 48-1-05).
