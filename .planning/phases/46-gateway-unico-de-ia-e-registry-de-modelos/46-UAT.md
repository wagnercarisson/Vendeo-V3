# Phase 46: Gateway Único de IA e Registry de Modelos — UAT Humano

**Contexto:** UAT local/preview pós-implementação da F46. A fase **reorganiza e concentra** as chamadas de IA (registry de modelos por capacidade + gateway único + adapters por protocolo + telemetria obrigatória) e **remove as 14 env-vars de modelo/provider**, com a promessa central de **preservação integral do comportamento atual**. Por isso, o critério de aceite humano é: **cada fluxo de IA deve se comportar de forma idêntica ao que o lojista já conhece** — mesma arte, mesmo texto, mesmo fluxo, mesmos erros — e a telemetria call-level deve registrar o **modelo real** de cada etapa.
**Pré-requisito:** rodar o app local (`npm run dev`) ou usar um deploy de preview com uma loja de teste (dados + direção visual/legal + saldo). Migration `20260912000001_f46_generation_events_type.sql` aplicada no remoto (já confirmada no 46-01).
**Como avaliar:** para cada cenário, percorrer o fluxo e comparar com o comportamento pré-F46 (o comportamento atual conhecido). Marcar `[x]`, registrar `PASS`/`FAIL` e observação. A telemetria pode ser conferida no painel admin de custos (`/admin/ai-operation-costs` ou apuração equivalente) ou no banco (`generation_events`).

---

## Checklist

### Cenário 46.1 — Geração de campanha completa (produto + oferta) — comportamento idêntico

- [ ] Preencher o form (`/campanhas/nova`): produto, preço original/desconto, badge, 1 imagem primary, sem avisos adicionais.
- [ ] "Revisar e gerar" → "Confirmar e gerar campanha" → geração conclui e navega para `/campanhas/[id]`.
- [ ] A arte final é **publicável e equivalente** à pré-F46 (produto, preço, badge, assinatura, composição) — sem erro novo, sem regressão visual perceptível.
- [ ] O kit/publicação e o download funcionam como antes.
- **Evidência de telemetria:** os eventos call-level aparecem com o **modelo real** — copy `gpt-4o` (`campaign_copy`), visão de validação/revisão `gpt-4o` (`campaign_input_validation`/`campaign_image_review`), imagem `gpt-5.5` (`campaign_image`, protocolo `responses`).
- Resultado: [ ] PASS / [ ] FAIL — Observação:

### Cenário 46.2 — Fallback de imagem (`images.edit`) — duas chamadas, dois eventos

- [ ] Provocar/observar um caso de fallback de imagem (retry explícito `attempt >= 1` **ou** erro de capability do Responses com imagem primary) — ex.: reenviar/regenerar quando aplicável.
- [ ] A arte resultante é equivalente ao comportamento atual (referências em ordem determinística preservadas).
- [ ] Auth/safety/rate-limit **não** acionam o fallback (o erro propaga como antes).
- **Evidência de telemetria:** **dois** eventos call-level (falha + fallback), cada um com seu **modelo real** — `gpt-5.5` no caminho Responses e `gpt-image-2` no fallback de edição (`campaign_image_edit` gravado como `campaign_image`, com `capability`/`protocol` no metadata).
- Resultado: [ ] PASS / [ ] FAIL — Observação:

### Cenário 46.3 — Geração/variações de assinatura visual — comportamento idêntico

- [ ] Abrir o fluxo de assinatura visual (loja sem logo, quando aplicável) e gerar as variações.
- [ ] Aprovar uma variação e conferir que a assinatura ativa aparece corretamente.
- [ ] Gerar novamente / variar e conferir que o resultado e a ordem dos eventos são os de sempre.
- **Evidência de telemetria:** `visual_signature_validation` (visão, `gpt-4o-mini`) e `visual_signature_image` (`gpt-5.5`) com modelo real; quando a tool `image_generation` é usada, a estimativa soma o componente da tool **também** em `visual_signature_image`; o evento é bufferizado até o `visual_signature_id` ser conhecido (ordem preservada).
- Resultado: [ ] PASS / [ ] FAIL — Observação:

### Cenário 46.4 — Brand profile: upload de logo + approve + restore — comportamento idêntico

- [ ] **Upload de logo** (`POST /api/store/[id]/logo`) → análise conclui como antes.
- [ ] **Retry do Brand Director** (`retry-brand-director`) → reanálise conclui como antes.
- [ ] **Approve** de uma assinatura visual (2 call sites) → aprovação conclui como antes.
- [ ] **Restore** de uma assinatura arquivada → restauração conclui como antes.
- [ ] Nenhum desses fluxos apresenta erro novo nem muda de comportamento observável.
- **Evidência de telemetria:** todos esses caminhos (antes **sem** `onCall`) agora emitem **evento call-level com custo e duração** — logo e retry com visão `gpt-4o` (`brand_profile_vision`); approve/restore com o modelo real; `brand_profile_text` com `gpt-4o`.
- Resultado: [ ] PASS / [ ] FAIL — Observação:

### Cenário 46.5 — Copy da campanha — texto/estrutura idênticos

- [ ] Gerar/observar a copy de uma campanha (título, legenda, CTA, hook).
- [ ] O texto e a estrutura são **idênticos** ao comportamento atual (sem mudança de prompt/parâmetros).
- [ ] Quando o primário falha de forma retryable, o fallback configurado é acionado como **segunda chamada explícita**, sem o serviço conhecer o provider.
- **Evidência de telemetria:** `campaign_copy` com `gpt-4o` (primary `chat-completions`); no fallback, segundo envelope com `gemini-3.1-flash-lite` (protocolo `gemini`).
- Resultado: [ ] PASS / [ ] FAIL — Observação:

### Cenário 46.6 — Caminho de logo (e correção/não-conformidade) — nenhum erro novo

- [ ] Testar o caminho de logo completo (upload → análise → uso na campanha) e confirmar que nenhum erro novo aparece.
- [ ] Quando aplicável, testar o fluxo de correção/não-conformidade (`correction-reports`) e confirmar que a IA é executada normalmente.
- **Evidência de telemetria:** eventos call-level com modelo real e duração; nenhum caminho produtivo de IA fica fora da camada única (inventário coberto).
- Resultado: [ ] PASS / [ ] FAIL — Observação:

### Cenário 46.7 — Legado `campaign_spec` (quando acessível) — comportamento preservado

- [ ] Se o endpoint legado `POST /api/campaign/generate` for acessível, exercitá-lo e confirmar que o contrato de saída (`CampaignSpec`) e o structured output são preservados.
- [ ] O fallback `json_schema` → `json_object` continua disponível em erro de capability do modelo.
- **Evidência de telemetria:** evento com `generation_type = campaign_spec` aceito pelo CHECK, com modelo real `gpt-4o-mini` e usage.
- Resultado: [ ] PASS / [ ] FAIL — Observação:

### Cenário 46.8 — Configuração sem env-vars de modelo — nenhuma quebra

- [ ] Confirmar que o app roda apenas com as chaves de API (`OPENAI_API_KEY`, `GEMINI_API_KEY`) + operacionais, **sem** nenhuma das 14 envs de modelo/provider.
- [ ] Nenhuma geração quebra por env-var de modelo ausente; todas as capacidades resolvem provider/modelo pelo registry.
- **Evidência de telemetria:** eventos continuam registrando o modelo real por capacidade (nenhum cai em default silencioso errado).
- Resultado: [ ] PASS / [ ] FAIL — Observação:

---

## Instruções de preenchimento

1. Preencha cada cenário com `[x]` nos itens e `PASS`/`FAIL` + observação em "Resultado".
2. O critério transversal é **comportamento idêntico ao atual** — qualquer regressão observável em arte, copy, fluxo ou erro deve ser registrada como FAIL com descrição.
3. A telemetria é evidência de apoio: confirme o **modelo real** por etapa (copy `gpt-4o`; visão `gpt-4o`/`gpt-4o-mini`; imagem `gpt-5.5` + fallback `gpt-image-2`).
4. Após o preenchimento, atualizar o resumo abaixo e registrar a decisão final ("aprovado" ou problemas encontrados).

## Summary

- total: 8
- passed: 0
- issues: 0
- pending: 8
- skipped: 0
- blocked: 0

> **Nota:** cenários que dependem de infraestrutura (fallback de imagem forçado, endpoint legado) podem ser validados por testes automatizados quando não reproduzíveis manualmente — registrar a observação no próprio cenário. A fase só fecha com a aprovação humana explícita (Task 3, `gate="blocking"`).
