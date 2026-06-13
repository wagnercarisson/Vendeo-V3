## Why

Quando o lojista altera dados cadastrais sensíveis da loja — segmento, subsegmento, tom de voz, nome fantasia ou cores da marca — a direção visual existente (brand profile ativo) pode ficar desalinhada com o novo perfil da loja. Atualmente, não há detecção ou notificação desse desalinhamento: o sistema persiste os novos dados mas a direção visual continua a mesma, resultando em campanhas que não refletem mais o posicionamento atual da loja.

## What Changes

- **Detecção de drift** — ao carregar o Step 2, o sistema compara os dados atuais da loja (`store_atual`) contra o `input_snapshot` armazenado no brand profile ativo; se houver divergência em campos sensíveis (segment, subsegment, tone_of_voice, name) ou cores (brand_color, accent_color), drift é detectado. A detecção roda também em retorno futuro (qualquer tela), mas a UI de banner/botão (Gatilhos 1 e 4) está escopada ao Step 2 nesta fase
- **Input snapshot** — `store_brand_profiles.metadata.input_snapshot` armazena os valores de { segment, subsegment, tone_of_voice, name, brand_color, accent_color } no momento da última re-inferência; populado após toda inferência bem-sucedida (apenas text_only nesta fase; logo e visual_signature serão escopo de 4.6.3 e 4.6.4)
- **UX não intrusiva** — banner sutil no Step 2 informa o desalinhamento, com opções [Realinhar] e [Ignorar]; ao ignorar, vira botão discreto `[↻ Realinhar direção visual]` persistente no Step 2; salvar e sair do Step 2 não são interrompidos
- **Dismiss persistente** — `store_brand_profiles.metadata.drift_dismissed_snapshot` armazena `store_atual` no momento do "Ignorar". A comparação é contra `store_atual`, não contra `input_snapshot`: se `store_atual ≠ input_snapshot` (drift existe) e `store_atual == drift_dismissed_snapshot`, o drift é o mesmo que já foi ignorado → exibe botão discreto. Se `store_atual ≠ drift_dismissed_snapshot`, os dados mudaram de novo → banner reaparece. Se `store_atual == input_snapshot`, não há drift — independente do estado de dismiss
- **Único modal em ação de alto impacto** — ao Gerar Campanha com drift ativo, modal pergunta se o usuário quer realinhar antes ou prosseguir com a direção atual (exportar fica para fase futura)
- **Realinhamento silencioso** — re-inferência in-place (sem navegação forçada) que usa dados atuais da loja + cores vigentes, persiste novo brand profile, atualiza input_snapshot, limpa dismiss
- **beforeunload nativo** — acionado apenas para dados não salvos no formulário, nunca por drift isoladamente

## Capabilities

### New Capabilities

- `visual-direction-drift-detection`: Detecção de desalinhamento entre dados atuais da loja e o snapshot que gerou a última direção visual. Inclui comparação de campos sensíveis e cores, persistência de dismiss via `drift_dismissed_snapshot`, e lógica de reaparecimento condicional quando os dados mudam novamente.
- `store-form-alteration-tracking`: Rastreamento dos dados da loja no momento de cada re-inferência via `input_snapshot` em `store_brand_profiles.metadata`, servindo como baseline para detecção de drift futuro.

### Modified Capabilities

- `store-identity-ui`: Step 2 (Logo e Cores) ganha banner de drift não-bloqueante, botão discreto de realinhamento, e modal de confirmação ao gerar campanha com drift ativo (exportar fica para fase futura). Não há interrupção em salvar ou sair do formulário.
- `store-brand-profile`: Adicionar `input_snapshot` e `drift_dismissed_snapshot` ao campo `metadata`. Nenhuma coluna nova na tabela — ambos vivem dentro do JSONB existente.

## Impact

- **Código modificado**: `store-identity-form.tsx` (detecção de drift, banner, botão discreto), `campaign-page-client.tsx` (gatilho 5 — modal ao gerar campanha), `campaign-input-form.tsx` (gatilho 5 — interceptação do clique "Gerar"), `use-store-form.ts` (dirty tracking de cores)
- **Exportação**: modal de confirmação em exportação será inserido quando o componente de exportação for criado (escopo futuro — nesta fase, o modal existe apenas para "Gerar Campanha")
- **API**: `POST /api/store/[id]/brand-profile/infer` (já existe — recebe `userChosenColors` para realinhamento com cores alteradas); `PATCH /api/store/[id]/brand-profile/metadata` (nova — persiste `drift_dismissed_snapshot` no metadata do brand profile ativo); `PATCH /api/store/[id]` (pode retornar flag de drift detectado no futuro, se necessário)
- **Modelo de dados**: sem migrations — `metadata` já é `jsonb`
- **Fora de escopo**: posicionamento do botão discreto (revisão UI/UX antes de produção), dashboard notifications, transições entre identity_state, `positioning` como campo sensível
