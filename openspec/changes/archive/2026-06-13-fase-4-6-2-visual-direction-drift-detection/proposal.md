## Why

Quando o lojista altera dados cadastrais sensíveis da loja — segmento, subsegmento, tom de voz, nome fantasia ou cores da marca — a direção visual existente (brand profile ativo) pode ficar desalinhada com o novo perfil da loja. Atualmente, não há detecção ou notificação desse desalinhamento: o sistema persiste os novos dados mas a direção visual continua a mesma, resultando em campanhas que não refletem mais o posicionamento atual da loja.

## What Changes

- **Detecção de drift** — ao carregar superfícies de identidade/configuração da loja, o sistema compara os dados atuais contra o `input_snapshot` armazenado no brand profile ativo; se houver divergência em campos sensíveis (segment, subsegment, tone_of_voice, name) ou cores (brand_color, accent_color), drift é detectado. Nesta fase, a superfície de identidade é o Step 2 (Logo e Cores). Superfícies globais/dashboard/configurações ficam para fase futura.
- **Input snapshot** — `store_brand_profiles.metadata.input_snapshot` armazena os valores de { segment, subsegment, tone_of_voice, name, brand_color, accent_color } no momento da última re-inferência; populado após toda inferência bem-sucedida (apenas text_only nesta fase; logo e visual_signature serão escopo de 4.6.3 e 4.6.4)
- **UX: save-time blocking modal** — ao tentar salvar o Step 2 com drift `'new'`, um modal bloqueante ([Realinhar]/[Manter]/[Cancelar]) intercepta o salvamento. "Realinhar" executa re-inferência in-place e atualiza as cores (accentColor, brand_color, brandColorsChosen) antes de salvar. "Manter" persiste dismiss e fecha o modal imediatamente. "Cancelar" aborta o salvamento. Quando o drift já foi dispensado ou realinhado, um botão discreto persistente fica visível abaixo do título do formulário.
- **Navigation guard** — cliques em `<a>` (capture phase no document), browser back (`popstate`), e refresh/close (`beforeunload`) são interceptados no Step 2 quando `driftStatus === 'new'`, redirecionando para o mesmo modal de decisão. Após resolver (Realinhar/Manter), a navegação pendente é executada.
- **Dismiss persistente** — `store_brand_profiles.metadata.drift_dismissed_snapshot` armazena `store_atual` no momento do "Ignorar". A comparação é contra `store_atual`, não contra `input_snapshot`: se `store_atual ≠ input_snapshot` (drift existe) e `store_atual == drift_dismissed_snapshot`, o drift é o mesmo que já foi ignorado → exibe botão discreto. Se `store_atual ≠ drift_dismissed_snapshot`, os dados mudaram de novo → banner reaparece. Se `store_atual == input_snapshot`, não há drift — independente do estado de dismiss
- **Realinhamento silencioso** — re-inferência in-place (sem navegação forçada) que usa dados atuais da loja + cores vigentes, persiste novo brand profile, atualiza input_snapshot, limpa dismiss
- **beforeunload** — acionado no Step 2 quando `driftStatus === 'new'` como parte do navigation guard (refresh/close); `beforeunload` nativo (dados não salvos) permanece separado
- **Geração de campanha não é alterada nesta fase** — o fluxo de campanha usa a direção visual ativa; se o usuário ignorou o drift, essa é uma escolha persistida dele. Nenhum bloqueio ou modal no fluxo de campanha.

## Capabilities

### New Capabilities

- `visual-direction-drift-detection`: Detecção de desalinhamento entre dados atuais da loja e o snapshot que gerou a última direção visual. Inclui comparação de campos sensíveis e cores, persistência de dismiss via `drift_dismissed_snapshot`, e lógica de reaparecimento condicional quando os dados mudam novamente.
- `store-form-alteration-tracking`: Rastreamento dos dados da loja no momento de cada re-inferência via `input_snapshot` em `store_brand_profiles.metadata`, servindo como baseline para detecção de drift futuro.

### Modified Capabilities

- `store-identity-ui`: Step 2 (Logo e Cores) ganha modal bloqueante no save para drift `'new'`, botão discreto persistente para qualquer drift não-nulo (`'new'` ou `'dismissed'`), e navigation guard (click capture + popstate + beforeunload). Geração de campanha permanece inalterada.
- `store-brand-profile`: Adicionar `input_snapshot` e `drift_dismissed_snapshot` ao campo `metadata`. Nenhuma coluna nova na tabela — ambos vivem dentro do JSONB existente.

## Impact

- **Código modificado**: `store-identity-form.tsx` (detecção de drift, modal de save, botão discreto, navigation guard, color hydration após realinhar), `use-store-form.ts` (dirty tracking de cores)
- **Código criado**: `src/lib/drift.ts` (tipos e lógica de detecção), `src/components/flow/use-drift-detection.ts` (hook), `src/components/flow/drift-banner.tsx`, `src/components/flow/drift-discreet-button.tsx`, `src/app/api/store/[id]/brand-profile/metadata/route.ts`
- **API**: `POST /api/store/[id]/brand-profile/infer` (já existe — recebe `userChosenColors` para realinhamento com cores alteradas); `PATCH /api/store/[id]/brand-profile/metadata` (nova — persiste `drift_dismissed_snapshot` no metadata do brand profile ativo)
- **Modelo de dados**: sem migrations — `metadata` já é `jsonb`
- **Fora de escopo**: superfícies globais/dashboard/configurações (fase futura); posicionamento do botão discreto (revisão UI/UX antes de produção); notificações em dashboard; transições entre identity_state; `positioning` como campo sensível; geração de campanha (não alterada nesta fase)
