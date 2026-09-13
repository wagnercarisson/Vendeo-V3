# Phase 46: Gateway Único de IA e Registry de Modelos — UAT Humano

**Contexto:** UAT local/preview pós-implementação da F46. A fase **reorganiza e concentra** as chamadas de IA (registry de modelos por capacidade + gateway único + adapters por protocolo + telemetria obrigatória) e **remove as 14 env-vars de modelo/provider**, com a promessa central de **preservação integral do comportamento atual**. Por isso, o critério de aceite humano é: **cada fluxo de IA deve manter comportamento, contrato, estrutura e qualidade equivalentes ao que o lojista já conhece — sem regressão observável** — e a telemetria call-level deve registrar o **modelo real** de cada etapa. Como a IA é **não determinística**, **não se exige igualdade literal** de texto nem de pixels: o aceite é equivalência de comportamento/estrutura/qualidade.
**Pré-requisito:** rodar o app local (`npm run dev`) ou usar um deploy de preview com uma loja de teste (dados + direção visual/legal + saldo). Migration `20260912000001_f46_generation_events_type.sql` aplicada no remoto (já confirmada no 46-01).
**Como avaliar:** para cada cenário, percorrer o fluxo e comparar com o comportamento pré-F46 (o comportamento atual conhecido). Marcar `[x]`, registrar `PASS`/`FAIL` e observação. A telemetria pode ser conferida no painel admin de custos (`/admin/ai-operation-costs` ou apuração equivalente) ou no banco (`generation_events`).

---

## Checklist

### Cenário 46.1 — Geração de campanha completa (produto + oferta) — comportamento equivalente

- [x] Preencher o form (`/campanhas/nova`): produto, preço original/desconto, badge, 1 imagem primary, sem avisos adicionais.
- [x] "Revisar e gerar" → "Confirmar e gerar campanha" → geração conclui e navega para `/campanhas/[id]`.
- [x] A arte final é **publicável e equivalente** à pré-F46 (produto, preço, badge, assinatura, composição) — sem erro novo, sem regressão visual perceptível.
- [x] O kit/publicação e o download funcionam como antes.
- **Evidência de telemetria:** os eventos call-level aparecem com o **modelo real** — copy `gpt-4o` (`campaign_copy`), visão de validação/revisão `gpt-4o` (`campaign_input_validation`/`campaign_image_review`), imagem `gpt-5.5` (`campaign_image`, protocolo `responses`).
- Resultado: [x] PASS / [ ] FAIL — Observação:

### Cenário 46.2 — Fallback de imagem (`images.edit`) — um envelope por chamada HTTP realizada

O fallback tem **dois gatilhos legítimos e distintos** — valide cada um conforme reproduzível. O critério de telemetria é **um envelope por chamada HTTP realmente realizada** (nunca um envelope por "intenção").

**46.2a — Erro de capability do Responses (com imagem primary):** a chamada primária (`campaign_image`, `responses`) falha por capability; o orquestrador faz a segunda `invoke` (`campaign_image_edit`, `images`) e ela sucede.
- [x] A arte resultante é equivalente ao comportamento atual (referências em ordem determinística preservadas).
- **Evidência de telemetria:** **dois** envelopes call-level — `failed` no Responses (`gpt-5.5`) + `success` no fallback (`gpt-image-2`; `campaign_image_edit` gravado como `campaign_image`, com `capability`/`protocol` no metadata).
- Resultado: [x] PASS / [ ] FAIL — Observação: PASS por teste automatizado

**46.2b — Retry explícito (`attempt >= 1`, com imagem primary):** a retentativa chama **diretamente** o adapter `images`; **não há** necessariamente uma falha Responses nessa tentativa.
- [x] A arte resultante é equivalente ao comportamento atual.
- **Evidência de telemetria:** **um** envelope para a chamada HTTP realizada (`gpt-image-2`). Se a tentativa anterior (`attempt 0`) também executou uma chamada real, ela tem o seu próprio envelope.
- Resultado: [x] PASS / [ ] FAIL — Observação: PASS por teste automatizado

- [x] Auth/safety/rate-limit **não** acionam o fallback (o erro propaga como antes).
- Resultado geral: [x] PASS / [ ] FAIL — Observação: PASS por teste automatizado

### Cenário 46.3 — Geração/variações de assinatura visual — comportamento equivalente

- [x] Abrir o fluxo de assinatura visual (loja sem logo, quando aplicável) e gerar as variações.
- [x] Aprovar uma variação e conferir que a assinatura ativa aparece corretamente.
- [x] Gerar novamente / variar e conferir que o resultado e a ordem dos eventos são os de sempre.
- **Evidência de telemetria:** `visual_signature_validation` (visão, `gpt-4o-mini`) e `visual_signature_image` (`gpt-5.5`) com modelo real; quando a tool `image_generation` é usada, a estimativa soma o componente da tool **também** em `visual_signature_image`; o evento é bufferizado até o `visual_signature_id` ser conhecido (ordem preservada).
- Resultado: [x] PASS / [ ] FAIL — Observação:

### Cenário 46.4 — Brand profile: upload de logo + approve + restore — comportamento equivalente

- [x] **Upload de logo** (`POST /api/store/[id]/logo`) → análise conclui como antes.
- [x] **Retry do Brand Director** (`retry-brand-director`) → reanálise conclui como antes.
- [x] **Approve** de uma assinatura visual (2 call sites) → aprovação conclui como antes.
- [x] **Restore** de uma assinatura arquivada → restauração conclui como antes.
- [x] Nenhum desses fluxos apresenta erro novo nem muda de comportamento observável.
- **Evidência de telemetria:** todos esses caminhos (antes **sem** `onCall`) agora emitem **evento call-level com custo e duração** — logo e retry com visão `gpt-4o` (`brand_profile_vision`); approve/restore com o modelo real; `brand_profile_text` com `gpt-4o`.
- Resultado: [x] PASS / [ ] FAIL — Observação:

### Cenário 46.5 — Copy da campanha — texto/estrutura equivalentes

- [x] Gerar/observar a copy de uma campanha (título, legenda, CTA, hook).
- [x] O texto e a estrutura são **equivalentes** ao comportamento atual — mesmo contrato/estrutura/qualidade, sem regressão observável (a IA é não determinística; **não se exige texto literal idêntico**).
- [x] Quando o primário falha de forma retryable, o fallback configurado é acionado como **segunda chamada explícita**, sem o serviço conhecer o provider.
- **Evidência de telemetria:** `campaign_copy` com `gpt-4o` (primary `chat-completions`); no fallback, segundo envelope com `gemini-3.1-flash-lite` (protocolo `gemini`).
- Resultado: [x] PASS / [ ] FAIL — Observação: Fallback validado por cobertura automatizada (`copy-director-service.test.ts` — dois envelopes: primary `gpt-4o` + fallback `gemini-3.1-flash-lite`)

### Cenário 46.6 — Caminho de logo (e correção/não-conformidade) — nenhum erro novo

- [x] Testar o caminho de logo completo (upload → análise → uso na campanha) e confirmar que nenhum erro novo aparece.
- [x] Quando aplicável, testar o fluxo de correção/não-conformidade (`correction-reports`) e confirmar que a IA é executada normalmente.
- **Evidência de telemetria:** eventos call-level com modelo real e duração; nenhum caminho produtivo de IA fica fora da camada única (inventário coberto).
- Resultado: [x] PASS / [ ] FAIL — Observação: fluxo de correção não reproduzido manualmente; validado por cobertura automatizada (`correction-intent-service.test.ts` + `correction-reports-persistence.test.ts`/`correction-v2-persistence.test.ts` — 35 testes verdes)

### Cenário 46.7 — Legado `campaign_spec` (quando acessível) — comportamento preservado

- [x] Se o endpoint legado `POST /api/campaign/generate` for acessível, exercitá-lo e confirmar que o contrato de saída (`CampaignSpec`) e o structured output são preservados.
- [x] O fallback `json_schema` → `json_object` continua disponível em erro de capability do modelo.
- **Evidência de telemetria:** evento com `generation_type = campaign_spec` aceito pelo CHECK, com modelo real `gpt-4o-mini` e usage.
- Resultado: [x] PASS / [ ] FAIL — Observação: endpoint legado exercitado via POST autenticado. Retornou CampaignSpec completo e válido, preservando o contrato. Telemetria persistida com campaign_spec, OpenAI/gpt-4o-mini, protocolo chat-completions, status success, attempt 1, 757 tokens, duração de 3.637 ms e custo estimado de US$ 0,000203. Fallback json_schema → json_object validado pela cobertura automatizada, sem indução manual de falha.

### Cenário 46.8 — Configuração sem env-vars de modelo — nenhuma quebra

- [x] Confirmar que o app roda apenas com as chaves de API (`OPENAI_API_KEY`, `GEMINI_API_KEY`) + operacionais, **sem** nenhuma das 14 envs de modelo/provider.
- [x] Nenhuma geração quebra por env-var de modelo ausente; todas as capacidades resolvem provider/modelo pelo registry.
- **Evidência de telemetria:** eventos continuam registrando o modelo real por capacidade (nenhum cai em default silencioso errado).
- Resultado: [x] PASS / [ ] FAIL — Observação: as 14 envs foram comentadas em env.local antes da execução dos testes

---

## Instruções de preenchimento

1. Preencha cada cenário com `[x]` nos itens e `PASS`/`FAIL` + observação em "Resultado".
2. O critério transversal é **comportamento/contrato/estrutura/qualidade equivalentes ao atual, sem regressão observável** — **não se exige igualdade literal** de texto/pixels (IA não determinística). Qualquer regressão observável em arte, copy, fluxo ou erro deve ser registrada como FAIL com descrição.
3. A telemetria é evidência de apoio: confirme o **modelo real** por etapa (copy `gpt-4o`; visão `gpt-4o`/`gpt-4o-mini`; imagem `gpt-5.5` + fallback `gpt-image-2`).
4. Após o preenchimento, atualizar o resumo abaixo e registrar a decisão final ("aprovado" ou problemas encontrados).

## Summary

- total: 8
- passed: 8
- issues: 0
- pending: 0
- skipped: 0
- blocked: 0

**Decisão final: APROVADO (2026-09-12)** — todos os 8 cenários PASS, sem regressão observável. Os itens não reproduzíveis manualmente foram validados por cobertura automatizada: fallback de imagem (`images.edit`) e fallback de copy (`copy-director-service.test.ts` — dois envelopes); fluxo de correção/não-conformidade (`correction-intent-service.test.ts` + `correction-*-persistence.test.ts`). Achado do UAT (snapshot econômico em `brand_profile_vision`) corrigido em `529a69c5` e revalidado.

> **Nota:** cenários que dependem de infraestrutura (fallback de imagem forçado, endpoint legado) podem ser validados por testes automatizados quando não reproduzíveis manualmente — registrar a observação no próprio cenário. A fase só fecha com a aprovação humana explícita (Task 3, `gate="blocking"`).
