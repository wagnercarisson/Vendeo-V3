# Amostra classificada — quick 261121-k4g

Amostra de **28 achados** extraída do inventário real (373 warnings, 0 erros),
distribuída entre as duas regras que dispararam e entre aplicação, testes e
ferramentas. Classificação feita por **leitura de contexto**, sem executar a
aplicação e sem presumir que aviso = bug.

- Regra `@typescript-eslint/no-unused-vars`: **350** ocorrências em 198 arquivos.
- Regra `react-hooks/exhaustive-deps`: **23** ocorrências em 7 arquivos.
- `react-hooks/rules-of-hooks`: **0** ocorrências (nenhum hook condicional detectado).
- `fatal`: 0 · `configNotices`: 0 · `configErrors`: 0.

## Critério das classes

| Classe | Significado |
|---|---|
| **(a) limpeza de baixo risco** | Remoção/renomeação mecânica, sem leitura de estado, sem mudança de contrato observável. |
| **(b) possível efeito colateral** | Pode indicar código morto que escondia intenção (flag, label, mock); mexer exige conferir comportamento. |
| **(c) possível problema funcional** | Padrão compatível com closure obsoleta, vazamento de recurso ou caminho não reexecutado. Exige investigação antes de qualquer correção. |
| **(d) falso positivo / exige contexto** | Intencional, convenção do projeto (`_param`), API estável que a regra não reconhece, ou decisão de produto. |

**Aviso ≠ bug.** Nenhum item abaixo é correção autorizada nesta quick.

## Achados

| # | Arquivo:linha | Regra | Trecho mínimo | Classe | Leitura |
|---|---|---|---|---|---|
| 1 | `src/app/(app)/campanhas/client.tsx:111` | exhaustive-deps | `useEffect(..., [debouncedSearch])` lê `rawParams` e `router` | **d** | `router` é estável; incluir `rawParams` reexecutaria o `replace` a cada mudança de URL (loop). Sincronização intencional de busca. |
| 2 | `src/components/flow/use-campaign-form.ts:1397` | exhaustive-deps | `useEffect(..., [])` com `// eslint-disable-line` | **d** | Já existe supressão explícita na linha; restaurar 4 dependências reexecutaria a restauração de rascunho. Decisão registrada pelo time. |
| 3 | `src/components/flow/use-campaign-form.ts:1502` | exhaustive-deps | efeito revoga `imagePreviewUrl` (lido no corpo) mas não o declara | **c** | `imagePreviewUrl` capturado fica obsoleto: a revogação pode mirar URL antiga, deixando object URL vivo ou revogando a nova. Investigar ciclo de vida da imagem. |
| 4 | `src/components/flow/use-campaign-form.ts:2172` | exhaustive-deps | `useCallback` de submissão sem `consumeStream`/`persistSubmittedDraft` | **c** | Callback de submissão pode capturar versões antigas de funções usadas no fluxo de geração. Exige teste de submissão/continuação antes de mexer. |
| 5 | `src/components/flow/use-campaign-form.ts:2670` | exhaustive-deps | dependência `router` desnecessária | **a** | `router` não é lido no callback; remover é mecânico. |
| 6 | `src/components/flow/use-drift-detection.ts:174` | exhaustive-deps | `// eslint-disable-next-line` antes do array | **d** | Supressão explícita; incluir `deps` de objeto/estado provocaria refetch contínuo. |
| 7 | `src/components/flow/use-store-form.ts:154` | exhaustive-deps | `hasExistingVS` no array sem uso no `useMemo` | **a** | Dependência inócua; remoção direta. |
| 8 | `src/hooks/use-onboarding-tabs.ts:576` | exhaustive-deps | array lista `deps.formData` etc., regra pede `deps` | **d** | `deps` muda de identidade a cada render; incluir o objeto causaria autosave infinito. Supressão já presente. |
| 9 | `src/components/flow/store-identity-form.tsx:914` | exhaustive-deps | `formData.brand_color` no array sem uso no callback | **a** | Dependência desnecessária; remoção mecânica. |
| 10 | `scripts/f60.3/vertical-expansion-proof.ts:55` | unused-vars | `type TerminalIntentStatus` importado e não usado | **a** | Import somente de tipo; sem efeito em runtime. |
| 11 | `scripts/f60.3/vertical-expansion-proof.ts:605` | unused-vars | `expandModuleLoaded = true` nunca lido | **b** | Variável sugere checagem que deveria ser asserida no harness; remover pode apagar intenção de prova. Conferir com o relatório do proof. |
| 12 | `src/app/(app)/admin/metrics/page.tsx:135` | unused-vars | `modeLabel` calculado e não renderizado | **b** | Pode ser rótulo que deixou de aparecer na UI; remover sem conferir tela esconde possível regressão de copy. |
| 13 | `src/app/(app)/campanhas/[id]/client.tsx:288` | unused-vars | `const router = useRouter()` sem uso | **a** | Remoção mecânica. |
| 14 | `src/app/(app)/admin/users/page.tsx:4` | unused-vars | import `Badge` não usado | **a** | Remoção mecânica. |
| 15 | `src/components/campaign/campaign-renderer.tsx:13` | unused-vars | `VISUAL_SIGNATURE_ENABLED` lê env e nunca é usado | **b** | Flag lida sem efeito: ou a funcionalidade não está ligada neste ponto, ou a flag ficou obsoleta. Não é limpeza cega. |
| 16 | `src/components/credit/balance-display.tsx:6` | unused-vars | import `Badge` não usado | **a** | Remoção mecânica. |
| 17 | `src/components/flow/campaign-input-form.tsx:598` | unused-vars | destructuring recebe `imagePreviewUrl` sem uso | **b** | Pode indicar preview que deixou de ser exibido; conferir tela antes. |
| 18 | `src/components/auth/logout-button.tsx:32` | unused-vars | `handleSubmit(e)` não usa `e` | **a** | Parâmetro pode ser removido; assinatura do handler continua aceita. |
| 19 | `src/components/flow/drift-critical-modal.tsx:24` | unused-vars | `onOpenChange: _onOpenChange` | **d** | Renomeação com `_` é convenção para “recebido e intencionalmente ignorado”. Candidato a `argsIgnorePattern`, não a refactor. |
| 20 | `src/lib/ai-cost/image-usage-token-cost.ts:73` | unused-vars | `const { usage, model, quality } = params` | **a** | `params` inteiro segue para `buildResolution`; `model`/`quality` não são esquecidos no cálculo. |
| 21 | `src/lib/auth/store-ownership.ts:4` | unused-vars | `UnauthorizedError` importado, só `StoreNotFoundError` é reexportado | **a** | Import morto; remoção mecânica. |
| 22 | `src/lib/brand-assets/brand-director.ts:387` | unused-vars | `allClusters` montado e não usado | **b** | Cálculo descartado; se a curadoria deveria consumi-lo, há lacuna. Conferir intenção do diretor de marca. |
| 23 | `src/lib/ai/telemetry-sink.ts:368` | unused-vars | `emit(_envelope: AiCallEnvelope)` | **d** | Sink no-op: parâmetro é obrigatório pelo contrato da interface. Convenção `_`. |
| 24 | `src/app/api/admin/feature-flags/__tests__/route.test.ts:189` | unused-vars | `vi.fn((_column, _keys) => ...)` | **d** | Assinatura de mock; argumentos não são necessários ao teste. |
| 25 | `src/app/api/admin/laboratorio/bancada/__tests__/bench-api.contract.test.ts:57` | unused-vars | `mockResolveBenchPromptPoliciesActual` dentro de `vi.hoisted` | **b** | Mock montado e não referenciado; pode ser fiação obsoleta que dá falsa sensação de cobertura. |
| 26 | `src/app/api/admin/laboratorio/bancada/expand/__tests__/route.test.ts:245` | unused-vars | `const { confirmed: _confirmed, ...rest } = VALID_BODY` | **d** | Omitir campo por renomeação é o padrão correto do teste. |
| 27 | `src/lib/campaign/composition-artifacts/evidence.ts:18` | unused-vars | `PROVENANCE_KEYS` usado só em `typeof PROVENANCE_KEYS` | **d** | O valor existe para derivar tipo; a regra não conta type queries como uso. Decisão de configuração/estrutura, não bug. |
| 28 | `src/lib/campaign/composition-artifacts/__tests__/composition-artifacts.integration.test.ts:51` | unused-vars | `REQUIRED_ENV` usado só em `typeof` | **d** | Mesmo padrão do item 27. |

## Distribuição da amostra

| Classe | Itens |
|---|---|
| (a) limpeza de baixo risco | 10 |
| (b) possível efeito colateral | 6 |
| (c) possível problema funcional | 2 |
| (d) falso positivo / exige contexto | 10 |

| Área | Itens |
|---|---|
| aplicação (`src/app`) | 4 |
| componentes (`src/components`) | 13 |
| hooks (`src/hooks`) | 1 |
| biblioteca (`src/lib`) | 4 |
| ferramentas (`scripts`) | 2 |
| testes (colocados ou em `__tests__`) | 4 |

## Dependências de supressão existentes

Dois achados da amostra (2 e 6) estão sob diretivas `react-hooks/exhaustive-deps`
já existentes. Como o diagnóstico roda com inline config desligada, essas
ocorrências aparecem justamente porque a supressão **não** é aplicada. Nenhuma
diretiva foi removida ou alterada nesta quick.

## Proposta de lotes futuros (não executar aqui)

| Lote | Escopo | Justificativa | Pré-requisito |
|---|---|---|---|
| L1 | Investigar os 2 achados (c) em `use-campaign-form.ts` (1502 e 2172) | Únicos com padrão compatível com problema funcional real (ciclo de vida de imagem e closure de submissão) | Teste focado reproduzindo o cenário antes de mudar código |
| L2 | Revisar os 23 `exhaustive-deps`, separando “já suprimido com motivo” de “nunca avaliado” | Só os não avaliados podem virar correção; os suprimidos exigem decisão de produto | Aceite humano das supressões existentes |
| L3 | Limpeza mecânica de imports/variáveis (a) em `app`/`components`/`lib` | Baixo risco, volume alto; um commit por área | L1/L2 não precisam estar prontos |
| L4 | Convenção `_param`/type-only (`d`): decidir `argsIgnorePattern`/`varsIgnorePattern` ou renomeações | Evita perseguir falso positivo e reduz ruído sem tocar comportamento | Decisão explícita; separada de qualquer correção de código |
| L5 | Variáveis de prova/mock possivelmente perdidas (b): #11, #12, #15, #17, #22, #25 | Podem esconder prova/asserção ou trecho de UI removido | Conferência caso a caso, sem `--fix` |
| L6 | Somente depois de L1–L5: avaliar promoção do diagnóstico a gate | Hoje ele não bloqueia nada; promover exige baseline de falhas zerada e decisão de release | Aceite formal, fora desta quick |

Regras dos lotes: um lote = um objetivo; nunca misturar correção de código com
mudança de configuração; nunca usar `--fix` em massa; cada lote com validação
completa (lint vigente, typecheck, build, suíte).
