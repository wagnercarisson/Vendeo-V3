# Tasks — F48.2.3: Fidelidade experimental da bancada

> Áreas de trabalho (não são planos GSD). Dependência: F48.2.2 concluída e arquivada.
>
> Fronteira: sem sincronização automática/periódica; sem botão de importação na UI; sem consulta remota no runtime; sem importação de campanhas, usuários reais, créditos, billing, eventos, logs ou histórico de branding; sem captura automática de prompts; sem gerador **inteligente/IA** de prompts (o **compositor determinístico mínimo É escopo**); sem templates criativos completos, revisor automático, scoring, deduplicação semântica, múltiplas estratégias de composição ou versionamento histórico de rascunhos; sem avaliação automática/comparação cega/votação; sem promoção de modelos/prompts/pipelines; sem alterar o fluxo produtivo; sem persistência tipográfica determinística para `text_only`; sem mobile da bancada.
>
> Regra de isolamento: a origem remota é acessada **somente** pelo comando local explícito e **somente em leitura**; o runtime da bancada usa **somente** o Supabase local. Nada de `campaigns`, `campaign_images`, `generation_events`, `ai_model_selection`, `admin_audit_log`, `credit_*`, bucket `campaign-images`, `prompts/` ou providers de produção. Os blocos gerados pelo compositor **não** introduzem contexto de laboratório/experimento/baseline/comparação/avaliação (verificação por **origem**; o prompt-base é preservado integralmente e não é filtrado). Nenhum secret/URL assinada em banco/log/snapshot/artefato. Nenhuma chamada real de IA em implementação/testes/verificação/CI; o UAT é manual pelo usuário e nenhuma task autônoma gera ou avalia imagens.
>
> Specs: `lab-bench-store-import`, `lab-bench-form-parity`, `lab-bench-experimental-briefing`, `lab-bench-prompt-preflight`, `lab-generation-bench`, `lab-bench-branding`, `lab-isolation`, `lab-admin-api`, `lab-admin-ui`. Design: `design.md`.
>
> Checkpoints humanos: (A) revisão do plano de importação/allowlist antes de qualquer leitura remota; (B) UAT manual de fidelidade/composição/isolamento, **sem provider**. Nenhuma geração real de IA é critério automático de conclusão.

## 1. Limpeza e contratos de isolamento

- [x] 1.1 Confirmar que a F48.2.2 está concluída/arquivada e que não há changes ativas pendentes; registrar a conclusão.
- [x] 1.2 Delimitar o comando de importação em `scripts/lab/**` (padrão ESM, `main(argv, env)`, sem efeitos de import) e garantir que o runtime da bancada continua local-only.
- [x] 1.3 Estender os testes de isolamento (aditivo) para a fronteira de importação: allowlist de tabelas/buckets da origem, bloqueio de escrita no remoto e ausência de acesso remoto no runtime.
- [x] 1.4 Adicionar testes negativos: mutação no remoto falha; loja não marcada como teste é recusada; IDs implícitos/"importar todas" são recusados; campanhas/usuários reais/créditos/histórico não são lidos; URLs assinadas não são persistidas.
- [x] 1.5 Guarda de regressão: comprovar que formulário produtivo, `resolveStoreIdentity`, `BrandProfileSnapshot`, `art-director-briefing`, `prompts/`, `MODEL_ALLOWLIST`, `ImagesAdapter` produtivo e `campaign-images` permanecem intocados.
- [x] 1.6 Teste de isolamento: verificar por **origem** que os blocos gerados pelo compositor não introduzem contexto de laboratório/experimento/baseline/comparação/avaliação; garantir que o prompt-base é preservado e não sofre filtragem lexical.

## 2. DDL local e persistência

- [x] 2.1 Estender `supabase/lab/bench-schema.sql` (fora de `supabase/migrations/`) com `lab_bench_store_imports` (D11) e as colunas de evidência do preflight em `lab_bench_runs` (reusando `prompt_sent`/`campaign_snapshot`), com RLS/grants e bloco REVERT.
- [x] 2.2 Atualizar o bootstrap local para aplicar/reverter o DDL aditivo de forma idempotente; confirmar que `supabase db push` **não** carrega as tabelas da bancada ao remoto.
- [x] 2.3 Ajustar `BenchRunInputSchema`/`BenchRunRecord` para o payload fiel e a evidência do preflight (D14/D20), mantendo a imutabilidade do snapshot a partir de `running`.

## 3. Comando de importação

- [x] 3.1 Implementar o esqueleto do comando (`main(argv, env)`, `--store`/`--stores`, `--dry-run`; sem IDs → erro; `--all` recusado) com guard local-only e sem efeitos de import.
- [x] 3.2 Implementar o cliente de origem **somente-leitura** (env `BENCH_IMPORT_SOURCE_URL`/`BENCH_IMPORT_SOURCE_SERVICE_ROLE_KEY` ou papel somente-leitura) com allowlist de tabelas/colunas e buckets; nenhuma função de mutação no caminho.
- [x] 3.3 Implementar a confirmação `is_test_store = true` por ID e a recusa de descoberta ampla.
- [x] 3.4 Implementar a leitura do estado atual: importar o **único perfil `status='synced'`** (qualquer `source`, **incluindo `text_only`**); **ausência de synced = ausência de perfil** (preserva `stores.brand_color`/segmento); **mais de um synced = ambíguo, importação recusada com erro sanitizado**; perfil não sincronizado nunca vira baseline; assets/assinatura ativos; sanitização de `metadata`/URLs; registrar `profileSource`/`profileStatus`.
- [x] 3.5 Implementar o proprietário local sintético por loja (e-mail determinístico, idempotente) e a reconstrução saneada das linhas locais, preservando IDs referenciados por FKs.
- [x] 3.6 Implementar a cópia dos assets atuais para os buckets locais em **paths versionados/content-addressed** (derivados do checksum), **sem sobrescrever** objetos ainda referenciados, **antes** da transação.
- [x] 3.7 Implementar a transação local de substituição integral (apagar linhas-filhas + upsert da loja + inserir novo conjunto com os paths novos) e a remoção dos objetos antigos sem referência **somente após o commit**; em falha antes do commit, remover **apenas** os objetos novos.
- [x] 3.8 Implementar a auditoria local (`lab_bench_store_imports`) e o upsert idempotente do manifesto (`fixtures/lab/bench/stores.json`).
- [x] 3.9 **CHECKPOINT A (humano):** antes da autorização, executar **somente** fixtures, fakes ou `--dry-run` **completamente offline**. Qualquer execução com URL ou credencial remota — **inclusive `--dry-run`** — exige aprovação humana prévia. `--dry-run` impede materialização/escrita local, mas **não** garante ausência de leitura remota.
- [x] 3.10 Testes: atualização de asset, idempotência (mesmos checksums/paths), substituição integral, falha antes do commit sem identidade parcial (só novos removidos), proprietário sintético, recusa de loja não-teste, perfil não sincronizado nunca vira baseline, múltiplos synced recusam a importação, ausência de escrita remota e de chamada de IA.

## 4. Paridade do formulário

- [x] 4.1 Criar `src/lib/lab/bench/domain/form-rules.ts` (puro) com validação/normalização fiéis (nome 60, descrição 120, imagem 1+3/5MB/tipos produtivos, dígitos→centavos, de/por, selo por intenção, intenção e derivação, **`preserveImageContext`** — exibido só em Destaque/Exclusivo e limpo ao mudar para Oferta, validade, aviso ilustrativo, informações obrigatórias).
- [x] 4.2 Reutilizar módulos puros compartilhados (`field-guidance`, `formatters`, `constants`, `campaign/brief`, `brief-schema`, `image-generation/schema`) e helpers puros exportados; documentar o que é reusado versus replicado.
- [x] 4.3 Substituir `BenchProduct`/`BenchOffer` pelo contrato fiel (incluindo `preserveImageContext`) e construir o snapshot com `buildCampaignBriefFromFlat`/`buildCampaignBriefSnapshot` + config + intenção resolvida.
- [x] 4.4 Testes explícitos de paridade (matriz de fixtures): intenção derivada, normalização monetária, selo por intenção, **`preserveImageContext` (disponibilidade, valor padrão, envio e limpeza)**, texto de validade, concatenação de avisos, papéis/limites de imagem; garantir que o produtivo não muda.
- [x] 4.5 Confirmar ausência de efeitos produtivos (sem créditos/campanhas/eventos/cobrança/escrita produtiva) no caminho da bancada.

## 5. Briefing experimental e resolução cromática

- [x] 5.1 Implementar `resolveBenchBrandColor` (puro) com a precedência produtiva efetiva (D16: único perfil synced — incluindo `text_only`; ausência de synced = ausência de perfil; sem fallback `without_logo`) e teste de paridade contra a resolução produtiva.
- [x] 5.2 Alinhar `readBrandProfile` (loader da bancada) ao comportamento produtivo: ler o **único perfil `status='synced'`**, sem fallback `without_logo`; perfil não sincronizado nunca vira baseline; ausência de synced = ausência de perfil.
- [x] 5.3 Implementar `src/lib/lab/bench/domain/experimental-briefing.ts` (puro) como **entrada estruturada** do compositor: direção visual consolidada + `typography_direction` + `brandColor`, sem tocar `art-director-briefing.ts`.
- [x] 5.4 Testes: tipografia presente no briefing; cores idênticas às produtivas; ausência de perfil synced preserva fallbacks; múltiplos synced recusam a importação; contrato produtivo de cores/tipografia intocado; `text_only` determinístico fora de escopo.

## 6. Compositor determinístico e preflight

- [x] 6.1 Implementar `src/lib/lab/bench/domain/prompt-composer.ts` (puro, **sem IA**) com os blocos canônicos e uma **versão estática do compositor**.
- [x] 6.2 Implementar o mapeamento canônico (um dado → um bloco), a omissão de blocos vazios, a preservação do prompt-base e a ausência de deduplicação semântica (D19).
- [x] 6.3 Garantir que o compositor e os blocos gerados não introduzam contexto experimental (sem bloco "Objetivo experimental"), **preservando integralmente o prompt-base e sem filtragem lexical sobre ele** (verificação por origem).
- [x] 6.4 Implementar o preflight: "Compor prompt" → prompt compilado visível → edição manual → **aprovação explícita** → habilita estimativa/confirmação; confirmação financeira separada da aprovação do prompt.
- [x] 6.5 Implementar a invalidação do prompt compilado/aprovado por mudança de entradas e por edição do prompt após a aprovação.
- [x] 6.6 Garantir que a execução envia exatamente o texto aprovado (`prompt_sent`), sem concatenação/instrução/transformação após a aprovação.
- [x] 6.7 Persistir a evidência mínima (prompt-base, blocos, prompt compilado, prompt final aprovado, versão do compositor) reusando `lab_bench_runs`; sem tabela de versões, histórico de rascunhos ou novo estado do run.
- [x] 6.8 Testes: blocos corretos; tipografia no bloco `[DIREÇÃO TIPOGRÁFICA]`; `preserveImageContext` no bloco `[PRODUTO E IMAGENS DE REFERÊNCIA]`; blocos vazios omitidos; prompt-base preservado; sem contexto experimental; invalidação; `prompt_sent` idêntico ao aprovado via adapter gravador.

## 7. API e UI

- [x] 7.1 Expor `GET /api/admin/laboratorio/bancada/briefing` (admin → ambiente → manifesto → briefing estruturado) sem secrets.
- [x] 7.2 Expor a composição/preview do prompt compilado e a aprovação explícita; rejeitar a geração sem preflight aprovado.
- [x] 7.3 Ajustar `POST /runs` e `GET /runs/[id]` para o payload fiel (incluindo `preserveImageContext`) e para persistir a evidência do preflight.
- [x] 7.4 Implementar na UI o formulário fiel (campos/validações/estados, incluindo "Preservar imagem original") e a exibição do `brandColor` resolvido, mantendo desktop-only.
- [x] 7.5 Implementar na UI a etapa de preflight (compor/editar/aprovar) com invalidação por mudança de entradas/prompt; confirmação financeira separada da aprovação; sem comparação lado a lado nem votação.
- [x] 7.6 Manter o estado de ambiente desabilitado sem acessar tabelas/storage/providers e conformidade com `openspec/design-system/MASTER.md` (dark OLED, `lucide-react`, sem emojis/light mode).
- [x] 7.7 Testes de rota/componente: guards, manifesto antes da leitura, prompt compilado visível, aprovação exigida, ausência de secrets, sem efeitos produtivos.

## 8. Testes, UAT manual e reconciliação

- [x] 8.1 Rodar typecheck, lint, build e a suíte completa; garantir que nenhum teste faz chamada real de IA.
- [x] 8.2 Executar os testes negativos de fronteira/importação, os testes de paridade e os testes do compositor.
- [x] 8.3 **CHECKPOINT B (humano) — UAT manual sem provider:** importar as duas lojas de teste por comando explícito e verificar fidelidade da identidade, paridade dos campos, composição/preview/edição/aprovação, blocos corretos, ausência de contexto experimental **gerado pelo compositor** (prompt-base preservado), tipografia presente, cor produtiva preservada, invalidação após mudança das entradas, `prompt_sent` idêntico ao aprovado (via adapter gravador), isolamento e ausência de alteração em produção. **Geração real é opcional** (só se iniciada manualmente pelo usuário com autorização explícita) e **não** é critério de conclusão desta fase. Se o UAT for recusado, a fase NÃO é marcada como concluída.
- [x] 8.4 Confirmar produção intocada: registrar o SHA inicial e comparar `base..HEAD` (incluindo `supabase/migrations/**`), além dos testes negativos de fronteira; base ausente ⇒ falha.
- [x] 8.5 Gerar `48-2-3-VERIFICATION.md` e `48.2.3-UAT.md`; preparar o arquivamento OpenSpec. **Nenhuma chamada real de IA como critério automático de conclusão.**
