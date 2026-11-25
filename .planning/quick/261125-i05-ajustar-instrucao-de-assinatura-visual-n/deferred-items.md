# Deferred items — quick 261125-i05

Itens descobertos durante a execução e **deliberadamente não corrigidos** (fora do escopo da quick).

## 1. `legacy-frontier.guard` falha por caminho de fronteira de outra quick

- **Teste:** `src/lib/product-1-1/__tests__/legacy-frontier.guard.test.ts` → `legacy-frontier guard — F56.2a > reconhece EXATAMENTE o conjunto autorizado de mudanças de fronteira`
- **Sintoma:** `caminhos de fronteira não autorizados` inclui `src/lib/lab/bench/domain/form-rules.ts`.
- **Causa:** o guard compara `git diff --name-only BASE_SHA..HEAD -- <frontier paths>`; `form-rules.ts` foi alterado pelo commit `65d00e75` (`feat(261125-eo7): limitar campanha a 2 arquivos e desacoplar bancada`), antes desta quick, e a allowlist `AUTHORIZED_FRONTIER_CHANGES` não foi atualizada naquela entrega.
- **Estado nesta quick:** falha **preexistente**, independente das mudanças de 261125-i05. O teste específico desta quick (`a rota generate-image evolui para o wiring b1b preservando o fluxo legado`) passa; o arquivo fica 13 PASS / 1 FAIL.
- **Por que não foi corrigido:** exigiria editar a allowlist de fronteira (arquivo/teste pertencente ao escopo de 261125-eo7), ampliando silenciosamente o escopo autorizado desta quick.
- **Encaminhamento sugerido:** a quick 261125-eo7 (ou uma correção própria) deve registrar `src/lib/lab/bench/domain/form-rules.ts` em `AUTHORIZED_FRONTIER_CHANGES`, com a justificativa da redução do limite de imagens, e revalidar o guard.
