# Deferred items — quick 261125-i07

Itens deliberadamente não tratados nesta quick. Nenhum foi planejado nem iniciado.

## 1. Uniformização das instruções de identidade no 9:16 e no joint 1:1+9:16

- **Contexto:** a quick 261125-i07 aplica a redação oficial do logotipo **somente**
  ao 1:1 novo com opt-in explícito (`logoInstitutionalIdentity`). O 9:16 isolado
  e a geração conjunta 1:1+9:16 continuam usando o texto reconciliado anterior
  para `logo`, `visual_signature` e `text_only`.
- **Escopo futuro separado:** avaliar e, se aprovado, uniformizar as instruções
  de identidade nesses dois caminhos, incluindo decisão sobre opt-in, congelamento
  em `identityDirective`, versionamento das regras, snapshots existentes,
  contratos de hash e cobertura de testes/spec.
- **Estado:** **não planejado e não implementado** neste fechamento. Qualquer
  execução futura exige planejamento próprio e nova autorização.
- **Validação visual:** o aceite de 261125-i07 cobre apenas uma geração 1:1 e não
  se estende a 9:16 ou joint.

## 2. `legacy-frontier.guard` — falha preexistente

- **Teste:** `src/lib/product-1-1/__tests__/legacy-frontier.guard.test.ts`.
- **Sintoma:** 13/14 PASS; `caminhos de fronteira não autorizados` inclui
  `src/lib/lab/bench/domain/form-rules.ts`.
- **Origem:** alteração do commit `65d00e75` (quick 261125-eo7), anterior a esta
  quick; a allowlist `AUTHORIZED_FRONTIER_CHANGES` não foi atualizada naquela
  entrega.
- **Estado nesta quick:** falha preexistente, independente do diff de
  `generate-image` (3 adições, 0 remoções). **Não corrigida** por estar fora do
  escopo; não alterar a allowlist neste fechamento.
- **Referência:** `.planning/quick/261125-i05-ajustar-instrucao-de-assinatura-visual-n/deferred-items.md`.
