# Tasks — F48.2.2: Fundação da bancada de geração no Admin/Laboratório

> Áreas de trabalho (não são planos GSD). Dependência: F48.1 e F48.2.1 concluídas. Fronteira: sem montador Oferta 1:1, sem injeção de branding no prompt, sem avaliação/aprovação, sem Destaque/Exclusivo/9:16/temas/carrossel/serviços/informativas, sem mobile, sem promoção. Specs: `specs/lab-generation-bench`, `specs/lab-bench-config`, `specs/lab-bench-branding`, `specs/lab-isolation`, `specs/lab-artifacts`, `specs/lab-gateway-harness`, `specs/lab-admin-api`, `specs/lab-admin-ui`. Design: `design.md`.
>
> Regra de isolamento: nada de `campaigns`, `campaign_art_versions`, `generation_events`, `ai_model_selection`, `admin_audit_log`, `credit_*`, bucket `campaign-images`, `prompts/` oficiais ou providers de produção. Nenhum secret em banco/log/snapshot/artefato. Nenhuma chamada paga em testes/CI.
>
> Ordem dos checkpoints: (1) spike de modelos → (2) aprovação dos presets habilitados → (3) UAT local com geração real controlada.

## 1. Limpeza e contratos de isolamento

- [ ] 1.1 Confirmar que a F48.2.2 antiga (Revisor) está descartada/substituída e que `openspec list` não a apresenta como ativa; registrar a conclusão no tracking.
- [ ] 1.2 Definir o bounded context `src/lib/lab/bench/**` e confirmar que os gates arquiteturais do laboratório (`architecture-guard.test.ts`) o cobrem.
- [ ] 1.3 Estender o detector de isolamento (`lab-isolation.contract.test.ts`) com allowlist **somente leitura** de `stores`/`store_brand_profiles`/`store_brand_assets`/`store_visual_signatures` (local) e com a proibição explícita de `campaign-images`/lojas remotas para o contexto da bancada.
- [ ] 1.4 Adicionar testes negativos: acesso a tabela/bucket produtivo, loja remota ou crédito faz o teste falhar; nenhuma chamada de rede real.
- [ ] 1.5 Estender `architecture-guard` (aditivo) para o contexto da bancada: sem `generation_events`/`AiCostTracker.record`, sem provider de imagem produtivo, sem SDK/wire, sem chaves de provider, sem escrita em catálogo/`prompts/`.

## 2. Persistência mínima e storage local

- [ ] 2.1 Criar o **DDL local da bancada fora de `supabase/migrations/`** (ex.: `supabase/lab/bench-schema.sql` ou `scripts/lab/`) para `lab_bench_runs` (campos do design D9) com `operation_id` único, `status`, `created_by`, timestamps, snapshots, config, prompt, referências, provider/modelo/protocolo, formato/qualidade, dimensões, latência, usage, custo com origem/versão, erro e validação técnica. Incluir o estado inicial **`draft`** (preparação/upload) fora do índice de geração ativa.
- [ ] 2.2 Criar `lab_bench_artifacts` (`run_id`, `kind` input/output, `storage_path`, `mime_type`, `width`, `height`, `bytes`, `checksum`, `removed_at`) no mesmo DDL local.
- [ ] 2.3 Aplicar RLS/grants service-role, triggers de imutabilidade (snapshot/config) e o índice único parcial **global** de geração ativa, cobrindo **somente** `status IN ('pending','running')` (draft não ocupa slot).
- [ ] 2.4 Estender o guard de path de artefato para o esquema `bench/{runId}/...` no bucket `lab-artifacts` (anti-traversal; sem token de bucket de campanha).
- [ ] 2.5 Escrever o **bootstrap local da bancada** que aplica o DDL (com bloco REVERT) e validá-lo localmente (`npx supabase db reset` + `db lint`): reaplicação idempotente, imutabilidade e índice de geração ativa; confirmar que `supabase db push` **não** carrega as tabelas da bancada ao remoto.
- [ ] 2.6 Implementar o serviço de persistência da bancada (reservar/iniciar/finalizar, idempotência por `operation_id`, reconciliação preguiçosa de geração presa). Incluir transição **`draft → pending` compare-and-set** (violação do índice → `bench_run_already_active`) e reconciliação preguiçosa de **drafts abandonados** (além de runs ativos presos). Expor `getBenchRunByOperationId` (leitura) para a confirmação resolver o `draft` existente sem criar run.
- [ ] 2.7 Testes: idempotência, imutabilidade, recuperação de run preso, persistência de entradas/saída com checksum, falha de persistência sem órfão; e draft abandonado não bloqueia o slot.

## 3. Lojas de teste e branding completo

- [ ] 3.1 Implementar o loader de lojas **de teste** locais (somente leitura, service role), identificadas por **allowlist/manifesto local** da bancada, sem sincronização remota e sem depender de campo produtivo novo. Expor `assertBenchTestStore` para uso em **todos** os pontos de entrada.
- [ ] 3.2 Implementar o contrato completo de branding (`stores` + `store_brand_profiles` com fallback `without_logo` + `store_brand_assets` + `store_visual_signatures`), expondo `typography_direction` e os demais campos. Verificar o manifesto **antes** de qualquer leitura de branding.
- [ ] 3.3 Resolver logo/assinatura por URL assinada de curta duração a partir dos buckets locais `store-logos`/`store-brand-assets`/`visual-signatures` por um **signer local restrito** (`createBenchBrandingSignedUrl`) com allowlist estrita de bucket/path, sem aceitar bucket/path do cliente e sem reutilizar `lab-artifacts`.
- [ ] 3.4 Confirmar que o contrato de branding **não** altera `BrandProfileSnapshot`, `resolveStoreIdentity`, a montagem do prompt do diretor nem o pipeline produtivo (testes de regressão verdes).
- [ ] 3.5 Implementar o snapshot de campanha compatível (produto/oferta) com intenção resolvida registrada explicitamente; sem chamar serviços de crédito/entrega/correção/publicação.
- [ ] 3.6 Testes: branding completo inclui tipografia; nenhuma escrita em branding; loja remota recusada; snapshot compatível e determinístico; e o signer de branding recusa bucket produtivo, traversal e loja fora do manifesto.

## 4. Registry extensível e spike de modelos

- [ ] 4.1 Implementar o registry de dimensões em código (`pipeline`, `formato`, `modelo`, `qualidade`, `intenção`, `tipo de conteúdo`, `estrutura`, `tema`) com o primeiro recorte habilitado e os demais valores desabilitados com motivo.
- [ ] 4.2 Implementar o registry de presets `{ capability, provider, model, protocol, quality, size }` validado contra a **allowlist própria da bancada** (`BENCH_MODEL_ALLOWLIST`, alimentada apenas pelos modelos/qualidades confirmados pelo spike) e o catálogo ativo, sem alterar `MODEL_ALLOWLIST`, em modo leitura.
- [ ] 4.3 **Spike bloqueante (checkpoint 1)** — confirmar em documentação oficial e/ou chamada controlada: ID exato, protocolo/endpoints, edição com referências, qualidades, formato/tamanho, limites de entrada, disponibilidade da conta, estrutura de usage e regra de pricing de `gpt-image-2` e `gpt-image-2.5-flare`.
- [ ] 4.4 Registrar o resultado do spike; habilitar **apenas os presets confirmados** e somente o caminho direto confirmado (o protocolo `responses` só entra se algum modelo exigir).
- [ ] 4.5 Adicionar **apenas linhas de catálogo** (`ai_model_catalog`) **localmente** pelo bootstrap da bancada (somente se o spike confirmar modelos/qualidades novos); o **pricing fica somente em código** (`bench-pricing.ts`), **sem tabela de pricing**. Registrar o **modo confirmado pelo spike** (`per_image`/`token_based`). Nenhuma promoção ao remoto e nenhuma alteração de comportamento produtivo.
- [ ] 4.6 **Checkpoint 2 — aprovação dos presets habilitados** antes de qualquer geração paga.
- [ ] 4.7 Testes: preset válido aceito; preset fora do catálogo recusado; preset não confirmado desabilitado com motivo; catálogo não é mutado; expansão sem migration; e um modelo confirmado fora da allowlist de produção é aceito na bancada sem alterar o `MODEL_ALLOWLIST`.

## 5. Invocação isolada e tracking

- [ ] 5.1 Generalizar o harness da bancada para resolver **capability + alvo do preset**, habilitando no primeiro recorte apenas o caminho direto confirmado; single-shot, sem fallback e sem consultar `ai_model_selection`.
- [ ] 5.2 Implementar o **adapter `Images` dedicado à bancada** (novo arquivo em `src/lib/ai/adapters/**`, registrado apenas no runtime da bancada) com propagação de `quality`; o `ImagesAdapter` produtivo e o registry padrão permanecem intocados (comprovar por regressão).
- [ ] 5.3 Implementar o controle explícito de modelo, qualidade, tamanho, prompt, referências (ordem/papel — **apenas imagens de produto enviadas por upload; logo/assinatura não é enviado**), timeout/cancelamento e single-shot.
- [ ] 5.4 Integrar o `LabTelemetrySink` (read-only) e a resolução de custo por um **resolvedor local da bancada** chaveado por `modelo + qualidade + tamanho/protocolo` (mantendo o usage/custo reportado pelo provider separado; `resolveAiCost` produtivo não é a fonte da estimativa da bancada), distinguindo usage do provider, custo calculado e custo estimado, com `cost_source`/`cost_rule_version`.
- [ ] 5.5 Persistir latência, usage, custo, provider/modelo/protocolo e erro sanitizado (`sanitizeAiErrorMessage`) — nunca secrets.
- [ ] 5.6 Testes: exatamente uma chamada paga; nenhum fallback/segunda chamada; custo estimado não apresentado como faturado; erro sanitizado; regressão do caminho produtivo; e o custo distingue qualidades.

## 6. API administrativa

- [ ] 6.1 Criar `GET /api/admin/laboratorio/bancada/stores` e `GET /.../branding` (somente leitura, sem diagnóstico/secrets).
- [ ] 6.2 Criar `GET /.../presets` e `GET /.../estimate` (presets habilitados com motivo dos desabilitados; estimativa com cobertura de pricing).
- [ ] 6.3 Criar `POST /.../runs` com confirmação explícita, `operation_id` idempotente e stream NDJSON; mapear 403/400/409/422 (`confirmation_required`, `bench_run_already_active`, `preset_not_enabled`). A confirmação adquire o slot por `draft → pending` compare-and-set; violação → `bench_run_already_active` (409). A confirmação SHALL resolver o `draft` existente por `operation_id` (sem criar run), validando `runId`/autoria/estado antes de preencher/confirmar.
- [ ] 6.4 Criar `GET /.../runs/[id]` (detalhe com evidência) e leitura de artefatos por URL assinada.
- [ ] 6.5 Aplicar `requireAdmin()` + `assertLabEnvironment()` em todas as rotas, na ordem correta. Validar o manifesto (`assertBenchTestStore`) antes de qualquer leitura de branding/tabela/storage em todas as rotas com `storeId`.
- [ ] 6.6 Testes de rota: 403/400/409/422, confirmação obrigatória, geração ativa, idempotência, um evento terminal, sem exposição de secrets.

## 7. UI da bancada

- [ ] 7.1 Criar a página `/admin/laboratorio/bancada` e adicionar a entrada na navegação interna do laboratório (sem segundo link na navegação principal).
- [ ] 7.2 Implementar seleção de loja de teste e exibição do branding completo (incluindo direção tipográfica).
- [ ] 7.3 Implementar formulário mínimo produto/oferta, upload de imagens e editor de prompt manual.
- [ ] 7.4 Implementar seleção de formato/modelo/qualidade e as dimensões travadas no primeiro recorte.
- [ ] 7.5 Implementar estimativa, confirmação explícita, estado de execução (progresso) e recuperação de run preso/draft abandonado por reconciliação, resultado, download e painel de evidências.
- [ ] 7.6 Implementar o estado de ambiente desabilitado (motivo) sem acessar tabelas/storage/providers.
- [ ] 7.7 Garantir conformidade com `openspec/design-system/MASTER.md` (dark OLED, `lucide-react`, sem emojis/light mode) e acessibilidade básica; desktop-only.
- [ ] 7.8 Testes de componente: fluxo mínimo, estimativa/confirmação, evidências, download, estado desabilitado, ausência de comparação/votação.

## 8. Testes, UAT e reconciliação do tracking

- [ ] 8.1 Rodar typecheck, lint, build e a suíte completa; garantir que nenhum teste faz chamada paga.
- [ ] 8.2 Executar os testes negativos de fronteira (ausência de acesso remoto/produção) e de concorrência.
- [ ] 8.3 Condicionado à aprovação humana do UAT: se o UAT for recusado, a fase NÃO é marcada como concluída. **UAT local (checkpoint 3)** com Docker + chave/projeto de desenvolvimento: selecionar loja de teste, carregar branding completo, enviar imagens, prompt manual, preset confirmado, confirmar, gerar e inspecionar evidência + download.
- [ ] 8.4 Confirmar que a produção permaneceu inalterada (pipeline, `ImagesAdapter`, `prompts/`, `campaign-images`, créditos) e que nenhuma linha produtiva foi tocada. Registrar o **SHA inicial da execução** e comparar `base..HEAD` (não apenas `git diff` do working tree), além dos testes negativos de fronteira. **Base SHA ausente ⇒ falha** (nunca recriar; a captura é exclusiva do início do Plano 01); incluir `supabase/migrations/**` no `git diff $BASE..HEAD`.
- [ ] 8.5 Gerar `48-2-2-VERIFICATION.md` e `48.2.2-UAT.md`; atualizar `.planning/STATE.md`, `.planning/ROADMAP.md`, `ROADMAP.md` e `.planning/HANDOFF.json`; preparar o arquivamento OpenSpec.
