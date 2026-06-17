## Why

O ciclo de vida do logo atualmente tem três problemas críticos: (1) o upload marca o profile anterior como `outdated` **antes** de executar o BrandDirector — se a análise falha, a loja fica sem direção visual ativa; (2) a remoção do logo arquiva o brand profile e anula `logo_status`, destruindo a direção visual e o vínculo de proveniência com o asset original; (3) não há mecanismo para restaurar logos anteriores. Esta fase resolve os três ao estabelecer um lifecycle íntegro com estado transicional, proveniência preservada e restore com validação de drift.

## What Changes

- **POST /api/store/[id]/logo**: Reordena o fluxo — upload do arquivo e variantes primeiro, BrandDirector executa **antes** de qualquer mutação no profile. Sucesso: compensação controlada no handler (marca synced→outdated, insere novo synced; se insert falhar, restaura o anterior para synced). Não há migration nova — o índice único parcial `(store_id) WHERE status = 'synced'` age como safety net, e a compensação no código cobre o rollback. Falha: profile anterior preservado como fallback, identity_state='logo' e logo_status='uploaded' (upload OK mesmo sem análise), novo profile 'failed' com `metadata.attempt_snapshot` dos 6 campos para auditoria (input_snapshot reservado exclusivamente para profiles synced — baseline de drift). Captura `input_snapshot` no novo profile synced. Sincroniza `identity_state` + `logo_status` no mesmo UPDATE via mapping `IDENTITY_TO_LOGO_STATUS`.
- **DELETE /api/store/[id]/logo**: Assets→archived, profile **permanece synced** (direção visual preservada), `active_logo_asset_id` **preservado** (proveniência), `identity_state`→text_only, `logo_status`→explicit_none.
- **GET /api/store/[id]/logo/history** (NOVO): Lista assets archived (variant_type='original') com seus profiles associados via FK `active_logo_asset_id` e drift_status computado server-side por versão.
- **POST /api/store/[id]/logo/restore** (NOVO): Restaura versão histórica com validação de drift (input_snapshot vs store atual). Se o profile escolhido já é o profile synced ativo (caso pós-remove), não marcá-lo como outdated — reativa diretamente os assets escolhidos. Se houver drift: executa BrandDirector com dados atuais e cria NOVO profile synced (reativa assets, mas não reativa o profile histórico — ele permanece com seu status atual ou é marcado como outdated se coincidir com o ativo anterior).
- **UI Step 2**: Estado `logo` ativo com análise OK → preview + "Remover logotipo" (únicos visíveis). Estado `logo` ativo com análise **failed** → preview do logo + aviso "Análise de direção falhou, usando direção anterior". Após remover: drop zone, botões de upload/assinatura, e link "Logotipos anteriores" (se houver archived) reaparecem. Modal de restore com badge de drift por versão. Matriz de decisão de UX por estado no alinhamento.
- `previous_identity_snapshot` **não será populado** — campo morto, candidato a remoção futura.
- `brand_colors_chosen` populado **apenas** pelo picker manual do usuário. Fluxos inferidos (logo_analysis, text_only, without_logo) usam `safe_color_tokens` + `inferred_*`. O upload de logo **não** deve popular `brand_colors_chosen` com `logo_colors_detected` — as cores detectadas continuam em `logo_colors_detected`, e a paleta final fica em `safe_color_tokens`. Esta fase implementa essa separação.

## Capabilities

### New Capabilities
- `logo-restore`: Restore de logos históricos a partir de assets archived com validação de drift. Inclui GET /logo/history (listagem com join asset+profile via FK) e POST /logo/restore (reativação com ou sem realinhamento). Edge case: se o profile escolhido já é o synced ativo (pós-remove), não marcá-lo como outdated — reativar apenas os assets.

### Modified Capabilities
- `logo-upload`: Ordenação corrigida (BrandDirector antes de mutação do profile), outdated+insert com compensação controlada no handler (restaura previous se insert falhar), identity_state sync, input_snapshot populado em profiles synced, attempt_snapshot populado em profiles failed (auditoria), brand_colors_chosen não recebe logo_colors_detected (separação explícita implementada nesta fase).
- `store-brand-profile`: Profile NUNCA é arquivado por remoção de logo — permanece synced. `active_logo_asset_id` muda de semântica para campo de proveniência (nunca nullado após definido). Estado visual decidido por `identity_state` + existência de asset active. Profile 'failed' pode coexistir com profile anterior 'synced' (fallback de direção).
- `store-identity-state`: `identity_state` como campo canônico; `logo_status` como derivado com mapping `IDENTITY_TO_LOGO_STATUS` ('text_only'→'explicit_none', 'logo'→'uploaded', 'visual_signature'→'generated'). Código novo lê identity_state. Dual-population expandido para todos os estados, não apenas text_only.
- `store-identity-ui`: Quatro cenários visuais no Step 2: (a) logo ativo com análise OK — preview + "Remover logotipo" apenas; (b) logo ativo com análise failed — preview + aviso "usando direção anterior"; (c) após remover — drop zone + botões + "Logotipos anteriores" (se houver archived); (d) modal de restore com badge de drift por versão. Matriz de decisão de UX documentada no alinhamento.

## Impact

- **Routes**: `src/app/api/store/[id]/logo/route.ts` — POST e DELETE reescritos. Novos arquivos `logo/history/route.ts` e `logo/restore/route.ts`.
- **Services**: BrandDirectorService inalterado (já executa análise). Nenhum service novo — lógica de compensação controlada e validação de drift no próprio handler.
- **UI Components**: `store-identity-form.tsx` ou componente de logo no Step 2 — novos estados condicionais (logo ativo, logo ativo com análise failed, pós-remove, modal de restore).
- **Types**: `BrandProfileRecord` — `active_logo_asset_id` semanticamente como proveniência (nunca null). `BrandProfileStatus` — 'archived' removido do caminho de remove logo (profile nunca archived por remove).
- **Database**: Nenhuma migration nova. `identity_state` e `logo_status` já existem. `input_snapshot` já existe no metadata. `previous_identity_snapshot` não será populado.
- **Delta specs**: `logo-upload`, `store-brand-profile`, `store-identity-state`, `store-identity-ui` e `logo-restore` (novo) — capturando as mudanças contratuais desta fase (attempt_snapshot, input_snapshot reservado para synced, falha com identity_state='logo', transição transacional/compensável, brand_colors_chosen isolado, restore com drift validation + edge case de profile já synced, archive de assets ativos antes de restore, drift_status no history).
