---
task: 261003-mne
type: execute
autonomous: true
files_modified:
  - src/app/api/admin/laboratorio/bancada/compose/route.ts
  - src/app/api/admin/laboratorio/bancada/runs/route.ts
  - src/app/api/admin/laboratorio/bancada/__tests__/bench-api.contract.test.ts
---

<objective>
Corrigir a resolução de intenção nas rotas POST `/compose` e `/runs` para que intenção UI explícita selecione a política de bancada correspondente, e provar que composição e revalidação server-side permanecem coerentes.

Purpose: Hoje ambas as rotas resolvem a configuração a partir de `DEFAULT_BENCH_CONFIG` (`intencao: oferta`), embora recebam `campaignIntent` explicitamente.
Output: Rotas alinhadas ao mapeamento canônico, teste contratual no-provider para as três intenções e verificação de recomposição local Destaque.
</objective>

<execution_context>
@C:/Users/wagne/.config/opencode/get-shit-done/workflows/execute-plan.md
@C:/Users/wagne/.config/opencode/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md
@.planning/HANDOFF.json
@openspec/changes/fase-48-2-6-validacao-experimental-produto-intencoes-1-1/specs/lab-bench-intent-validation/spec.md
@openspec/changes/fase-48-2-6-validacao-experimental-produto-intencoes-1-1/specs/lab-bench-prompt-policy/spec.md
@openspec/changes/fase-48-2-6-validacao-experimental-produto-intencoes-1-1/specs/lab-bench-prompt-preflight/spec.md
@src/lib/lab/bench/domain/campaign-snapshot.ts
@src/lib/lab/bench/domain/config-registry.ts
@src/app/api/admin/laboratorio/bancada/compose/route.ts
@src/app/api/admin/laboratorio/bancada/runs/route.ts
@src/app/api/admin/laboratorio/bancada/__tests__/bench-api.contract.test.ts

User scope: preserve the UI contract (`offer`/`spotlight`/`exclusive`) and existing validation. Resolve them respectively to policy config values `oferta`/`destaque`/`exclusivo` before policies, prompt composition, and run-side evidence revalidation. Inspect canonical `resolveBenchIntent`/domain mappings and reuse if suitable; do not add a competing mapping. No provider calls or image generation.

Boundaries: do not alter policy texts/versions, prompt-base, pricing, adapters, production behavior, credits, migrations, or any UAT evaluation. Do not begin/alter Plan 10, CHECKPOINT B, or manual comparisons; HANDOFF records these as blocked on human review.
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: Provar seleção de política pelas três intenções nas APIs</name>
  <files>src/app/api/admin/laboratorio/bancada/__tests__/bench-api.contract.test.ts</files>
  <behavior>
    - POST /compose recebe `offer`, `spotlight` e `exclusive`, passa config `intencao` `oferta`, `destaque`, `exclusivo` ao resolver, e expõe texto compilado e `policyVersions.intencao` correspondentes.
    - POST /runs, com evidência/preflight coerente de cada intenção, recompõe com a mesma config e valida/persiste as versões correspondentes no servidor antes de confirmação/provider.
    - Spotlight e Exclusive nunca incluem instrução nem versão Oferta; todas as chamadas são mocks/no-provider.
    - Verificação local de recomposição Spotlight afirma texto exato `Destaque: priorize a apresentação do produto; preço informado é secundário.` e versão `48.2.6-destaque-v1` antes de qualquer geração futura.
  </behavior>
  <action>Amplie os casos contratuais próximos às coberturas existentes (~1337/~1741 e revalidação ~1986), usando cenários válidos pela matriz comercial e respostas mockadas que variem segundo a config recebida (sem mascarar o valor de configuração sob teste). Para `/runs`, forneça evidência de aprovação que corresponda à intenção enviada e inspecione `recomposeBenchPrompt`, `resolveServerResolvedEvidence` e argumentos persistidos; asserte que não há execução/provider call necessária para provar o mapeamento. Inclua asserts negativos explícitos contra texto/versão Oferta nos casos Spotlight/Exclusive. Acrescente a recomposição local solicitada: use o resolver/compositor puro real ou fixture determinística com o contrato real, nunca chamada externa; afirme conteúdo Destaque e versão antes de qualquer expectativa de execução. Preserve testes de rejeição de preço/validade e demais contratos existentes.</action>
  <verify>
    <automated>npx vitest run src/app/api/admin/laboratorio/bancada/__tests__/bench-api.contract.test.ts</automated>
  </verify>
  <done>O teste de contrato verifica os três valores UI em `/compose` e `/runs`, texto+versão por intenção, ausência de Oferta em Destaque/Exclusivo e recomposição local Spotlight; nenhum provider é invocado.</done>
</task>

<task type="auto" tdd="true">
  <name>Task 2: Alimentar a intenção UI à configuração em compose e runs</name>
  <files>src/app/api/admin/laboratorio/bancada/compose/route.ts, src/app/api/admin/laboratorio/bancada/runs/route.ts</files>
  <behavior>
    - `offer` resolve `config.intencao = oferta`, `spotlight` resolve `destaque`, `exclusive` resolve `exclusivo` nas duas rotas.
    - A configuração de `/runs` é usada pelo snapshot/briefing, recomposição do prompt e evidência de políticas revalidada antes do CAS e provider.
    - Validações de payload, preço/intenção, validade e ausência de chamada paga permanecem intactas.
  </behavior>
  <action>Inspecione `resolveBenchIntent` em `campaign-snapshot.ts` e o tipo/registry de `config-registry.ts` primeiro. `resolveBenchIntent` atualmente retorna `offer`/`spotlight`/`exclusive`, sem converter aos identificadores de policy `oferta`/`destaque`/`exclusivo`; logo, prefira o mapping de domínio/config já existente se encontrado. Se não existir conversão canônica, introduza uma conversão única no domínio de config reutilizável por ambas as rotas e testes, não lógica duplicada nas rotas. Construa `resolveBenchConfig` a partir de `DEFAULT_BENCH_CONFIG` substituindo `intencao` conforme a intenção validada antes de `resolveBenchPromptPolicies` em compose e antes de snapshot/briefing/recompose/evidência em runs. No runs, garanta que a mesma config e intenção orientem todos os passos da revalidação; não altere os contratos públicos `campaignIntent`, política, texto, versão, base ou adaptadores.</action>
  <verify>
    <automated>npx vitest run src/app/api/admin/laboratorio/bancada/__tests__/bench-api.contract.test.ts</automated>
  </verify>
  <done>As duas rotas usam a intenção explicitamente selecionada para todas as resoluções/revalidações pertinentes, mantendo validação e guardas existentes; os testes da Task 1 passam sem executar provider.</done>
</task>

<task type="auto">
  <name>Task 3: Validar tipagem, lint e especificações ativas sem operações externas</name>
  <files>src/app/api/admin/laboratorio/bancada/compose/route.ts, src/app/api/admin/laboratorio/bancada/runs/route.ts, src/app/api/admin/laboratorio/bancada/__tests__/bench-api.contract.test.ts</files>
  <action>Execute gates locais de typecheck e lint; valide OpenSpec estritamente e os checks arquiteturais relevantes existentes para rotas/API da bancada. Confirme diff limitado às três áreas listadas e aos ajustes de teste exigidos; não execute UAT, POST de geração, provider, geração de imagem, operações de banco, pricing, migração, deploy, nem modifique os artefatos UAT.</action>
  <verify>
    <automated>npm run typecheck; npm run lint; npx openspec validate --strict; npx vitest run src/app/api/admin/laboratorio/bancada/__tests__/bench-api.contract.test.ts</automated>
  </verify>
  <done>Typecheck, lint, OpenSpec strict e testes contratuais passam; checks arquiteturais relacionados passam; diff não toca fronteiras proibidas e nenhuma chamada provider/geração foi feita.</done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| Admin client → `/compose` e `/runs` | Payload e intenção recebidos são entrada não confiável; schema/compatibilidade validam antes de operar. |
| `/runs` → aprovação persistida/provider | Prompt e evidência de política são revalidados server-side antes do CAS e execução. |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-261003-mne-01 | Tampering | compose config e política | mitigate | Validar a intenção via contrato atual e derivar identificador de policy corretamente antes da resolução; cobrir os três casos no teste API. |
| T-261003-mne-02 | Tampering | runs preflight revalidation | mitigate | Usar intenção selecionada na mesma configuração para snapshot, recomposição e comparação de versões, recusando evidência divergente antes do CAS/provider. |
| T-261003-mne-SC | Tampering | installs de dependências | accept | Nenhuma dependência é instalada ou alterada nesta tarefa. |
</threat_model>

<verification>
- `npx vitest run src/app/api/admin/laboratorio/bancada/__tests__/bench-api.contract.test.ts`
- `npm run typecheck`
- `npm run lint`
- `npx openspec validate --strict`
- Check arquitetural local existente para rotas/contratos da bancada, sem operações externas.
</verification>

<success_criteria>
`offer → oferta`, `spotlight → destaque` e `exclusive → exclusivo` são comprovados em ambos caminhos API; prompt, `policyVersions.intencao` e revalidação batem com a intenção escolhida; Destaque comprova texto/versionamento exatos localmente; Spotlight/Exclusive não exibem instrução/versão Oferta; todo teste é sem provider e nenhuma fronteira explicitamente proibida é modificada.
</success_criteria>

<output>
Create `.planning/quick/261003-mne-corrigir-a-resolu-o-da-inten-o-nas-rotas/261003-mne-SUMMARY.md` when executed.
</output>
