# Tasks — F48.2.4: Experimento determinístico de campanha Oferta 1:1

> Áreas de trabalho (não são planos GSD). Dependência: F48.2.2 e F48.2.3 concluídas e arquivadas.
>
> Fronteira: somente local, dentro do Admin/Laboratório; sem preview/staging/produção; sem acesso remoto no runtime; sem campanhas produtivas; sem créditos do lojista; sem escrita em tabelas produtivas; sem promoção de prompt/modelo/pipeline. Fora do recorte: Destaque, Exclusivo, formatos ≠ 1:1, serviços, informativos, temas, carrossel, mobile, comparação cega/lado a lado, avaliação automática, IA para gerar/revisar prompt, alteração de branding produtivo, mudanças no pipeline produtivo.
>
> Isolamento: o adapter `Images` produtivo, o caminho `Responses` produtivo, o `store-identity-service` produtivo, os prompts produtivos, a seleção produtiva de modelos e `supabase/migrations/**` permanecem intocados. Nenhuma chamada de IA em implementação/testes/CI; toda geração real é manual e autorizada; UAT pago precedido de checkpoint humano bloqueante; testes usam adapters gravadores/fakes.
>
> Specs: `lab-bench-prompt-policy`, `lab-bench-prompt-base`, `lab-bench-identity-transport`, `lab-bench-run-history`, `lab-bench-prompt-preflight`, `lab-bench-branding`, `lab-generation-bench`, `lab-isolation`, `lab-admin-api`, `lab-admin-ui`, `lab-bench-pricing`. Design: `design.md`.
>
> Checkpoints humanos: (A) revisão de contratos/políticas/identidade antes de qualquer chamada paga; (B) UAT manual completo. Nenhuma task autônoma executa provider.
>
> **Ações manuais exclusivas do responsável do projeto:** `/opsx-verify`, `/opsx-sync` e `/opsx-archive` **não** são preparadas, executadas nem condicionadas pelo executor. A change permanece ativa para essas ações manuais.

## 1. Limpeza, contratos e isolamento

- [x] 1.1 Confirmar que F48.2.2 e F48.2.3 estão concluídas/arquivadas e que não há change OpenSpec ativa conflitante; registrar a conclusão.
- [x] 1.2 Registrar a **Base SHA** de partida e delimitar os caminhos produtivos protegidos (adapter `Images`, `Responses`, `store-identity-service`, `prompts/`, seleção produtiva de modelos, `supabase/migrations/**`).
- [x] 1.3 Estender (aditivo) os testes de isolamento da bancada: runtime local-only, ausência de acesso remoto, ausência de chamada paga em testes e ausência de persistência de URL assinada.
- [x] 1.4 Adicionar testes negativos: combinação de políticas não habilitada falha antes da chamada paga; identidade indisponível falha antes da chamada paga; nenhuma tabela/bucket produtivo é acessado.
- [x] 1.5 Guarda de regressão por **Base SHA**: comprovar que `git diff $BASE..HEAD` dos caminhos produtivos é vazio (incluindo `supabase/migrations/**`); base ausente ⇒ falha. **(Executada no closeout: diff produtivo vazio; `base` = `f5a7fe9a27e823b64b355ec8c431d4e514d5ab99`.)**
- [x] 1.6 Garantir que o núcleo do compositor não contém regra específica de dimensão (oferta/formato/conteúdo/estrutura/tema) — teste de fronteira do núcleo.

## 2. DDL local e persistência

- [x] 2.1 Estender `supabase/lab/bench-schema.sql` (fora de `supabase/migrations/`) com colunas nullable em `lab_bench_runs` (versões das políticas, versão do prompt-base padrão, referência canônica da identidade e `attempt_of_run_id` para a linhagem de tentativas), com bloco REVERT e imutabilidade estendida.
- [x] 2.2 Atualizar o bootstrap local para aplicar/reverter o DDL aditivo de forma idempotente; confirmar que `supabase db push` **não** carrega as tabelas da bancada ao remoto.
- [x] 2.3 Estender `BenchRunInputSchema`/`BenchRunRecord`/`setBenchRunInput` para as evidências de versões, prompt-base padrão, referência canônica da identidade (sem URL assinada) e **`attempt_of_run_id`** (linhagem de tentativas), incluindo o mapeamento do campo nos contratos de persistência (`BenchRunRecord` e builders de path/insert).
- [x] 2.4 Confirmar que nenhuma tabela nova de experimentos/candidatas/revisores/avaliações é criada.

## 3. Núcleo do compositor e políticas

- [x] 3.1 Refatorar o compositor em **núcleo** (organiza blocos, omite vazios, preserva o prompt-base, saída estável) sem regra específica de dimensão.
- [x] 3.2 Criar o registry de políticas (`src/lib/lab/bench/domain/policies/**`) com `{ id, dimension, value, version, contributions }` e a versão do compositor atualizada.
- [x] 3.3 Implementar `resolveBenchPromptPolicies(config)` com resolução explícita e fail-closed (`bench_policy_not_implemented`) antes de qualquer chamada paga.
- [x] 3.4 Implementar a política `oferta` (hierarquia comercial, proibição de inventar dados, sem posições fixas) e a política de formato `1:1` (composição quadrada equilibrada).
- [x] 3.5 Implementar as políticas `produto`, `peca-unica` e tema neutro `nenhum` (omitido do prompt).
- [x] 3.6 Garantir linguagem natural ("Oferta", "quadrado 1:1"), omissão de dimensão neutra e ausência de redundância (cada condição comercial e cada texto obrigatório uma única vez).
- [x] 3.7 Manter os blocos canônicos travados e a ausência de contexto experimental gerado pelo compositor (verificação por origem; prompt-base preservado sem filtragem lexical).
- [x] 3.8 Testes determinísticos: mesma entrada ⇒ mesma saída; contribuições por bloco; versões registradas.
- [x] 3.9 Testes negativos: cada combinação não habilitada (Destaque, Exclusivo, 9:16, serviço, informativo, tema, carrossel) falha antes da chamada paga.

## 4. Prompt-base padrão versionado

- [x] 4.1 Criar `prompt-base.ts` (puro) com `BENCH_DEFAULT_PROMPT_BASE` e `BENCH_DEFAULT_PROMPT_BASE_VERSION` adequados a Oferta 1:1.
- [x] 4.2 Carregar o padrão inicialmente na bancada, mantê-lo editável e garantir preservação integral pelo compositor.
- [x] 4.3 Registrar nas evidências a versão do padrão e o conteúdo efetivamente usado.
- [x] 4.4 Testes: prompt-base editado preservado; determinismo com entrada editada; nenhuma geração/revisão por IA.

## 5. Mapeamento mínimo de branding

- [x] 5.1 Implementar a seleção determinística por prioridade dos campos de branding enviados ao prompt: sempre nome e cor resolvida; **um único** campo de direção visual pela cadeia `campaignBrief` → `campaignGuidelines` → `visualStyle` → `visualTone` → `brandPersonality`; tipografia explícita.
- [x] 5.2 Manter todos os demais campos apenas na evidência; nunca enviar os cinco campos de direção simultaneamente; não criar nova direção de marca.
- [x] 5.3 Testes: apenas um campo de direção visual; tipografia no bloco próprio; mesma entrada ⇒ mesma seleção; ausência de deduplicação semântica.

## 6. Transporte canônico da identidade

- [x] 6.1 Estender `buildBenchInvocationRequest` para incluir `identityImageUrl` (data URL) resolvido a partir da referência canônica.
- [x] 6.2 Atualizar o adapter `Images` **da bancada** para anexar a identidade como **última** referência, após as imagens do produto (ordem documentada).
- [x] 6.3 Resolver a referência exclusivamente por `identity_state` (`logo`/`visual_signature`/`text_only`), sem primeiro-asset, sem substituição e sem invenção.
- [x] 6.4 Falhar antes da chamada paga (`bench_identity_reference_unavailable`) quando o arquivo ou a URL assinada esperada não estiver disponível.
- [x] 6.5 Garantir URL assinada transitória e não persistida; snapshot apenas com `{ kind, variantType, storagePath }`.
- [x] 6.6 Testes de identidade: `logo`, `visual_signature`, `text_only` e referência indisponível (falha antes da chamada paga).
- [x] 6.7 Comprovar que o adapter `Images` produtivo, o caminho `Responses` produtivo e o registry padrão permanecem intocados (teste de regressão).

## 7. Preflight, revalidação e novas tentativas

- [x] 7.1 Reforçar a invalidação da aprovação por loja/branding, produto/campanha, imagens, condições comerciais, intenção/formato/tipo de conteúdo/estrutura/tema, textos obrigatórios, prompt-base e prompt final; a configuração de execução (preset/modelo/qualidade) invalida **somente** a estimativa e a confirmação financeira (não o prompt).
- [x] 7.2 Implementar a revalidação server-side em `POST /runs`: recompor e exigir igualdade com `preflight.promptCompiled`, senão `approval_invalidated` antes da chamada paga.
- [x] 7.3 Garantir `prompt_sent` byte a byte igual ao prompt final aprovado; recusar divergência antes da chamada paga.
- [x] 7.4 Implementar `duplicateBenchRunInputs` (novo run `draft` + cópia das entradas para `bench/{novoRunId}/inputs/...`) mantendo o guard de path e gravando `attempt_of_run_id` apontando para o run de origem.
- [x] 7.5 Implementar a listagem de tentativas por **linhagem explícita** (`attempt_of_run_id`, raiz + descendentes), sem heurística de fingerprint e sem nova tabela.
- [x] 7.6 Testes: prova byte a byte de `prompt_sent` (adapter gravador); nova tentativa cria novo run; run anterior imutável; reuso de entradas; isolamento por paths.

## 8. API e UI

- [x] 8.1 Estender `POST /compose` para retornar políticas habilitadas, versões e prompt-base padrão (fail-closed para combinação não suportada).
- [x] 8.2 Estender `POST /runs` para transportar a identidade, revalidar a composição e persistir as novas evidências.
- [x] 8.3 Criar `POST /runs/[id]/attempts` (nova tentativa) e a listagem de tentativas por linhagem explícita.
- [x] 8.4 Estender `GET /runs/[id]` com versões, referência canônica da identidade e custo calculado/reportado separados.
- [x] 8.5 UI: exibir políticas/versões e prompt-base padrão, a identidade transportada, as tentativas anteriores e a ação "Nova tentativa" (desktop-only; sem comparação lado a lado/votação).
- [x] 8.6 Manter o estado de ambiente desabilitado sem acessar tabelas/storage/providers e conformidade com `openspec/design-system/MASTER.md` (dark OLED, `lucide-react`, sem emojis/light mode).
- [x] 8.7 Testes de rota/componente: guards, manifesto antes da leitura, prompt compilado visível, aprovação exigida, ausência de secrets, sem efeitos produtivos.

## 9. Testes, UAT manual e reconciliação

- [x] 9.1 Rodar typecheck, lint, build e a suíte completa; garantir que nenhum teste faz chamada real de IA.
- [x] 9.2 **CHECKPOINT A (humano):** revisar contratos de políticas, mapeamento de branding, ordem das imagens e revalidação do preflight **antes de qualquer chamada paga**. Nenhuma geração real ocorre antes da aprovação. **(Aprovado em 2026-09-30.)**
- [x] 9.3 **CHECKPOINT B (humano) — UAT manual completo:** (a) técnico — compor/editar/aprovar; verificar determinismo das políticas, combinações não habilitadas (negativos), prova byte a byte de `prompt_sent`, identidade (`logo`/`visual_signature`/`text_only`/indisponível), nova tentativa/imutabilidade, evidências/versões e isolamento; (b) **comercial/visual (humano, sem automação, registrado no documento de UAT):** fidelidade do produto; fidelidade do logo/assinatura; aderência às cores e à direção tipográfica; preço "de/por" correto e legível; selo, validade e textos obrigatórios; hierarquia comercial de oferta; ausência de informação inventada; qualidade visual e publicabilidade; modelo, qualidade, latência e custo; decisão humana (**aprovado / rejeitado / requer ajuste**) e observações sobre o prompt para a próxima tentativa. O UAT pago exige autorização humana explícita no checkpoint; o número de gerações reais é decidido pelo usuário. Se o UAT for recusado, a fase NÃO é marcada como concluída. **(Técnico 8/8; comercial/visual registrado — Flare low `requer ajuste`; Sunburst low `aprovado com follow-up`. Atribuição ao projeto Vendeo Lab: pendente de confirmação.)**
- [x] 9.4 Confirmar produção intocada por **Base SHA**: `git diff $BASE..HEAD` dos caminhos produtivos vazio (incluindo `supabase/migrations/**`); base ausente ⇒ falha. **(Executada: `base..HEAD` vazio; `supabase/migrations` limpo.)**
- [x] 9.5 Confirmar que nenhuma task autônoma executou provider e que nenhum crédito de lojista foi consumido. **(Confirmado: 0 chamadas ao provider pelo executor; nenhum crédito do executor; as duas gerações pagas — Flare e Sunburst — foram manuais.)**
- [x] 9.6 Gerar `48-2-4-VERIFICATION.md` e `48.2.4-UAT.md`. **Nenhuma chamada real de IA como critério automático de conclusão.** O arquivamento OpenSpec (`/opsx-verify`, `/opsx-sync`, `/opsx-archive`) é ação **manual exclusiva do responsável do projeto**; o executor **não** o prepara, executa nem condiciona.

## 10. Correção de UAT — seleção explícita de imagem principal + adicionais

> Descoberta no UAT: o uploader substituía a seleção ao escolher uma segunda imagem e não diferenciava principal de adicionais, impedindo validar a ordem principal → adicionais → identidade. Correção sem alterar o contrato multipart existente.

- [x] 10.1 Fonte OpenSpec: adicionar o requisito "Seleção explícita de imagem principal e imagens adicionais" (`lab-admin-ui`), reforçar a ordem principal → adicionais (`lab-bench-identity-transport`), o upload ordenado (`lab-admin-api`) e a persistência ordenada (`lab-generation-bench`); atualizar `design.md` (D19) e `proposal.md`.
- [x] 10.2 UI: campo explícito de imagem principal (obrigatória) + campo separado de até três adicionais opcionais; adicionar sem substituir a seleção; remover/substituir antes do envio; exibir principal, adicionais e ordem.
- [x] 10.3 Fingerprint por `storeId + principal + adicionais em ordem` (sem ordenação alfabética); multipart único ordenado (principal → adicionais); resposta `references` na mesma ordem; identidade anexada por último pelo runtime.
- [x] 10.4 Testes (sem provider): principal + segunda mantém ambas; adicionais não apagam a principal; remover/substituir antes do envio; >3 adicionais recusado; multipart preserva a ordem; `references` na ordem; trocar papéis altera o fingerprint; reenvio idempotente; alterar imagens invalida o prompt; identidade por último; nenhuma chamada real de IA.
- [x] 10.5 Refletir a correção nos artefatos GSD (planos 08/09, `48.2.4-CONTEXT.md`, `48.2.4-UI-SPEC.md`) e em `48.2.4-UAT.md` (descoberta + correção; geração real = 0; custo US$ 0; CHECKPOINT B comercial/visual pendente).

## 11. Correção cirúrgica — pricing local v2 + gpt-image-2.5-sunburst

> Pricing oficial atualizado (Standard, por 1M tokens): texto US$5, imagem de entrada US$8, imagem de saída US$30. Nova versão de regra; histórico preservado.

- [x] 11.1 Fonte OpenSpec: novo spec `lab-bench-pricing`, D20 no `design.md` e bullet/capability no `proposal.md`.
- [x] 11.2 Pricing local v2 (`2026-09-bench-2`): tarifas oficiais 5/8/30 para `gpt-image-2`, `gpt-image-2.5-flare` e `gpt-image-2.5-sunburst`; estimativa prévia do `gpt-image-2` revisada (sem reaproveitar os tokens derivados da tarifa antiga) com `coverage: partial`; `2026-09-bench-1` não reescrita (histórico por `cost_rule_version`).
- [x] 11.3 Sunburst no caminho isolado: `BENCH_MODEL_ALLOWLIST`, catálogo/bootstrap local, presets `gpt-image-2.5-sunburst-low`/`-medium`, resolver de capability/protocolo e pricing local; `MODEL_ALLOWLIST` produtivo, adapter produtivo e `supabase/migrations/**` intocados; `responses` permanece desabilitado.
- [x] 11.4 Testes: pricing unitário; cálculo pós-usage dos três modelos; cobertura `partial`/`missing`; presets Sunburst; allowlist exclusiva da bancada; resolução de capability/protocolo; adapter com referências na ordem correta; mesmo prompt aprovado aceito por modelos diferentes; troca de modelo preserva a aprovação e invalida só estimativa/confirmação; API/UI dos novos presets; isolamento e architecture guard.
- [x] 11.5 Registrar no UAT o resultado do Flare low (`requer ajuste`; latência 14,6 s; US$ 0,03) e os follow-ups da **F48.2.5** (principal × referências; revisão ortográfica/acentuação/números; preservação literal; ciclos de refinamento/comparação) — **sem implementar** os refinamentos. Sunburst permanece **PENDENTE** de UAT manual.

## 12. Correção — chave de API exclusiva da bancada

- [x] 12.1 Fonte OpenSpec: requisito "Chave de API exclusiva da bancada" (`lab-isolation`) e D21 no `design.md`.
- [x] 12.2 Resolvedor dedicado `bench-api-key.ts`: lê **somente** `OPENAI_BENCH_API_KEY`; **nunca** fallback para `OPENAI_API_KEY`; ausente/vazia ⇒ falha antes de criar o cliente/chamar o provider; `BenchImagesAdapter` usa `getBenchApiKey`; `getApiKey` produtivo intocado; chave nunca registrada/persistida/exibida.
- [x] 12.3 Gate arquitetural: a bancada lê apenas `OPENAI_BENCH_API_KEY` (nunca `OPENAI_API_KEY`/`GEMINI_API_KEY`); o adapter da bancada não usa o resolvedor produtivo `getApiKey`.
- [x] 12.4 Testes: ambas as chaves ⇒ usa exclusivamente a da bancada; só `OPENAI_API_KEY` ⇒ bancada recusa; só `OPENAI_BENCH_API_KEY` ⇒ funciona; chave vazia ⇒ nenhuma chamada ao provider.
