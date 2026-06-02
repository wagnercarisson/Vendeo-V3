## Context

O Vendeo atualmente usa `resolveStoreIdentity()` em `src/lib/store.ts` para determinar o fallback visual da loja com esta prioridade: (1) logotipo se `logo_url` existe, (2) nome da loja como texto. A `Store` type reflete a tabela `stores` com colunas básicas (name, segment, brand_color, logo_url). Campanhas recebem `storeName`, `storeLogoUrl`, e `storeLogoInitials` via `CampaignRenderParams`.

O problema: sem logotipo, cada campanha renderiza apenas "Nome da Loja" em texto — não há elemento visual reconhecível que una campanhas diferentes da mesma loja. A assinatura visual proposta preenche esse gap com um ativo leve e reutilizável.

## Goals / Non-Goals

**Goals:**
- Criar capacidade de gerar, armazenar e gerenciar assinaturas visuais leves para lojas sem logotipo
- Garantir que toda campanha futura use a assinatura visual ativa da loja como identidade (apenas quando não há logotipo)
- Fornecer fallback tipográfico persistido (sem IA) quando a geração falhar
- Permitir troca controlada da assinatura ativa pelo lojista
- Manter custo baixo (geração rápida e barata) e reutilização sem recriar por campanha

**Non-Goals:**
- Criação de logotipo profissional com manual de marca
- Persistência de campanhas geradas (fase futura)
- GeminiImageProvider (fase futura)
- Dashboard ou histórico de campanhas
- Editor avançado ou variações de layout de campanha
- Compliance por segmento/subsegmento

## Decisions

### Decision 1: Tabela própria `store_visual_signatures` vs campos em `stores`

**Escolhido: Tabela separada `store_visual_signatures` com partial unique index `WHERE status = 'active'`.**

Justificativa: a proposta prevê múltiplas variações (até 3 para escolha, mais drafts futuros). Uma tabela separada com linhas por variação é mais limpa que colunas repetidas em `stores`. Para garantir no máximo uma assinatura ativa por loja, usamos uma partial unique index: `CREATE UNIQUE INDEX ON store_visual_signatures (store_id) WHERE status = 'active'`. Não será adicionada FK `active_visual_signature_id` em `stores` — a consulta por status é suficiente e evita alteração na tabela principal.

Alternativa rejeitada: colunas em `stores` não suportam múltiplas variações. FK em `stores` adiciona complexidade sem ganho real sobre a partial unique index.

### Decision 2: Armazenamento dos assets gerados

**Escolhido: Supabase Storage, bucket `visual-signatures`, pasta `{store_id}/`.**

O asset gerado será armazenado no bucket `visual-signatures`, na pasta `{store_id}/`. A tabela `store_visual_signatures` armazenará `storage_path` (caminho estável dentro do bucket, ex: `{store_id}/{uuid}.png`) e `asset_url` (URL pública resolvida no momento do salvamento). A URL pública pode mudar (troca de bucket, migração para signed URLs), mas `storage_path` é o identificador permanente do asset.

Para assinaturas tipográficas de fallback (geradas localmente sem IA), o asset também será upado para o Storage seguindo a mesma estrutura.

Alternativa rejeitada: base64 ou data URL no banco — não escalável, não indexável, não serve para renderização em campanha.

### Decision 3: Abordagem de geração da assinatura visual (revised 2026-06-01, v2)

**V1 final: IA gera imagem diretamente com retry simplificado + fallback tipográfico.**

A qualidade final da assinatura visual é crítica. O quality gate demonstrou que renderizadores intermediários (SVG a partir de descrição JSON) achatam a expressão visual da IA. Removidos da V1.

**Geração principal — IA gera imagem diretamente:**
1. Prompt `visual-signature-generator.md` envia dados da loja (nome, segmento, cor principal, tom de voz) e pede imagem de assinatura visual (~1024×1024, fundo simples, sem produto, sem preço).
2. O modelo de imagem (Responses API `image_generation` tool) gera o PNG diretamente.
3. A imagem gerada passa por validação antes de persistir.
4. Prós: qualidade visual real de marca, sem gargalo de renderizador intermediário.
5. Contras: mais caro (~$0.04-0.08 por geração), maior latência, risco de jailbreak.

**Retry simplificado (segunda tentativa):**
1. Se a primeira tentativa falhar (timeout, erro, validação rejeitar), o sistema tenta novamente com prompt simplificado e dados mínimos.
2. Único retry — não em loop.
3. Se falhar de novo, cai para fallback tipográfico.

**Cascata de geração (2 níveis de fallback):**
1. `AiImageGenerator.generate()` — IA gera imagem final diretamente
2. `AiImageGenerator.generate()` com prompt simplificado — retry único
3. `TypographicFallbackGenerator.generate()` — zero IA, iniciais + nome em círculo

**Critério de qualidade:**
A assinatura gerada precisa parecer uma marca visual simples e publicável. Se falhar, o sistema tenta o retry. Se o retry falhar, usa fallback tipográfico.

**Rastreamento do tier via metadata:** O campo `metadata` (jsonb) incluirá `generation_tier: "image_direct" | "image_retry" | "typographic"` registrando qual método realmente produziu o asset. O campo `type` da tabela continua representando o contexto geral (`ai_generated`, `automatic_generated`, `fallback_typographic`).

### Decision 4: Fallback tipográfico — persistido em SVG, conversão PNG opcional

**Escolhido: Fallback salvo como SVG puro no Storage. Conversão para PNG apenas se ferramenta validada já estiver instalada.**

O fallback precisa ser um asset persistido (Storage), não um preview temporário. A campanha reutiliza a assinatura em todas as renderizações, então não basta gerar no frontend a cada exibição.

Abordagem:
1. Lógica de `getStoreInitials()` extrai iniciais da loja.
2. Um template SVG monta o círculo com iniciais + nome da loja abaixo.
3. O SVG é upado **diretamente** para Supabase Storage como asset da assinatura.
4. A URL do Storage é salva na tabela `store_visual_signatures` como `asset_url`.
5. Conversão para PNG só é feita se houver uma ferramenta já instalada e testada (ex: `sharp` validado em build). Caso contrário, o SVG puro é o formato final do fallback.

**Por que SVG direto é a escolha correta:**
- O bucket `visual-signatures` já permite `image/svg+xml` como MIME type
- Navegadores renderizam SVG nativamente — funciona em toda renderização programática
- Zero dependências externas = fallback verdadeiramente confiável
- O fallback tipográfico é o último recurso — priorizar confiabilidade sobre consistência de formato
- Se no futuro houver necessidade de PNG, a conversão pode ser adicionada sem quebrar o existente

**Resumo de formatos por tier:**
- `image_direct` / `image_retry`: PNG (gerado pela IA)
- `typographic`: SVG (template inline, sem conversão)

### Decision 5: Injeção no pipeline de campanha (TECHNICALLY IMPLEMENTED — BLOCKED BY QUALITY GATE)

> ⚠️ A integração com o pipeline de campanha está implementada no código, mas **NÃO é aceita** até o quality gate visual passar (ver Decision 3 — critério de qualidade).
> Enquanto o quality gate não for aprovado, o CampaignRenderer renderiza apenas o fallback padrão (iniciais + nome), ignorando a assinatura visual.

**Escolhido: `CampaignRenderParams` estendido com `visualSignatureUrl` e `visualSignatureType`.**

O pipeline atual carrega dados da loja via `resolveStoreIdentity()`. Estenderemos essa função para também resolver a assinatura visual ativa:

```typescript
interface CampaignRenderParams {
  // ... existing fields ...
  visualSignatureUrl?: string;   // URL da assinatura visual ativa
  visualSignatureType?: 'ai_generated' | 'automatic_generated' | 'fallback_typographic';
}
```

A zona `Store Identity` no CAMPAIGN_VISUAL_SYSTEM.md seguirá esta prioridade:
1. **Logotipo da loja** (`logo_url`) — prioridade máxima. Se o lojista enviou logo, ele é usado.
2. **Assinatura visual ativa** — usada apenas quando não há logotipo.
3. **Fallback tipográfico** (iniciais + nome) — usado quando não há logo nem assinatura visual ativa.

A assinatura visual gerada NUNCA substitui um logotipo enviado pelo lojista. Ela existe para lojas SEM logotipo.

### Decision 6: UI flow pós-salvamento

**Escolhido: Modal de 4 opções sem botão de fechar, cada opção sendo um card selecionável.**

Após salvar a loja com sucesso:
1. Se `logo_url` existe → nenhuma ação (logotipo é a identidade principal)
2. Se não há logo nem assinatura visual ativa:
   - Sistema abre um modal (não uma nova página/etapa) **sem botão de fechar**, forçando escolha entre 4 cards:
     1. **Gerar 3 opções para eu escolher** — gera 3 variações via IA para o lojista selecionar
     2. **Deixar o Vendeo escolher por mim** — gera 1 assinatura automaticamente com cascade
     3. **Tenho logotipo, mas vou enviar depois** — comportamento idêntico à opção 2 (geração automática)
     4. **Tenho logotipo e quero enviar agora** — redireciona para fluxo de upload de logotipo
   - Se escolhe opção 1: gera 3 variações, exibe picker, persiste a escolhida como `active`
   - Se escolhe opção 2 ou 3: o sistema tenta gerar a assinatura via IA com timeout de 120s. Se responder a tempo, persiste como ativa. Se falhar ou exceder timeout, retorna erro controlado — fallback tipográfico não é persistido como assinatura ativa. Síncrono — sem background processing.
   - Se escolhe opção 4: redireciona para o upload de logotipo

Modal sem close button porque:
- É um momento de decisão, não de adiamento
- Todas as opções produzem um resultado (assinatura ou upload)
- O lojista nunca fica preso — cada card é uma ação válida
- O modal pode ser reaberto depois via "Criar / Alterar Assinatura Visual" na página da loja

### Decision 7: Ciclo de vida dos status da assinatura visual

**Regras de status:**

| Status | Quando ocorre | Pode virar |
|--------|---------------|------------|
| `draft` | Variações geradas para escolha do lojista. Ainda não é a assinatura oficial. | `active` (se escolhida), `archived` (se preterida) |
| `active` | A assinatura escolhida pelo lojista OU o fallback automático gerado sem escolha. No máximo uma por loja (garantido pelo partial unique index). | `archived` (se substituída) |
| `archived` | Assinatura que foi desativada por substituição explícita. Nunca reativada — se o lojista quiser voltar para uma anterior, uma nova draft é gerada. | — |

A geração automática (lojista escolheu "Deixar o Vendeo Criar") nasce como `active` direto — não passa por `draft` porque não houve escolha. Se a geração falhar, nenhuma assinatura é persistida — o sistema retorna erro controlado.

Nunca pode existir mais de uma `active` por loja. O partial unique index `(store_id) WHERE status = 'active'` garante isso no banco.

### Decision 8: Troca de assinatura ativa

**Escolhido: Fluxo explícito com confirmação.**

Na página de cadastro da loja (após loja existir):
1. Seção "Identidade Visual" mostra a assinatura atual (ou "Nenhuma").
2. Botão "Criar / Alterar Assinatura Visual" → abre mesmo modal.
3. Ao escolher uma variação diferente da atual, modal de confirmação: "Tem certeza que deseja alterar a assinatura visual? As campanhas futuras usarão a nova assinatura."
4. Só após confirmação, a assinatura é salva como ativa e a anterior vai para `archived`.

### Decision 9: Upload mínimo de logotipo na fase 4.4

**Escolhido: Upload via formulário da loja, armazenamento em Supabase Storage, salvando `logo_url` em `stores`.**

O upload de logotipo estava implícito como existente, mas a fase 4.4 precisa garantir que o lojista possa enviar seu próprio logo antes de depender de assinatura visual gerada.

**Fluxo:**
1. Modal pós-salvamento oferece opção "Tenho logotipo e quero enviar agora" → direciona para upload.
2. O formulário de identidade da loja ganha um campo de upload de arquivo (imagem).
3. O upload envia o arquivo para uma API route que:
   - Valida tipo (PNG, JPEG, WebP) e tamanho (máx 2MB)
   - Faz upload para Supabase Storage (bucket `store-logos`, pasta `{store_id}/{uuid}.ext`)
   - Salva a URL pública em `stores.logo_url`
   - Se já existia assinatura visual ativa, ela permanece como `active` (logo tem prioridade no renderer)
4. O campo `logo_url` existente em `stores` é reutilizado — sem migration.

**Prioridade (inalterada):** `logo_url` > assinatura visual > fallback tipográfico

**Bucket:** `store-logos` (novo bucket, separado de `visual-signatures`)

**Escopo:** Upload via formulário apenas. Nada de drag-and-drop, crop, preview avançado ou galeria.

## Risks / Trade-offs

- [Custo de IA image] Gerar assinatura visual via imagem (Responses API) custa ~$0.04-0.08 por geração, vs ~$0.001 do texto. Para 3 variações, ~$0.12-0.24 por loja. → Gerar sob demanda, apenas quando o lojista opta por criar. Reutilizar a assinatura em todas as campanhas seguintes sem recriar.
- [Travamento de fluxo] Geração de assinatura não deve bloquear campanha. → Fallback tipográfico garante que sempre há um resultado persistido. Se até o retry falhar, o sistema persiste o fallback e continua.
- [Qualidade visual da imagem gerada] IA pode gerar arte de campanha em vez de assinatura visual — incluindo preços, produtos, CTAs. → Prompt com regras explícitas de "não fazer". Validação visual antes de persistir. Quality gate manual antes de integrar com campanha.
- [Inconsistência entre variações] Imagens geradas podem ter estilos muito diferentes. → Três prompts com tonalidades diferentes (profissional, moderno, elegante) para variedade controlada.
- [Substituição acidental] Trocar assinatura ativa sem querer. → Confirmação explícita em modal antes de alterar. Status `draft` para novas variações até escolha explícita.
- [Custo de storage] Assinaturas via imagem (~50-200KB cada PNG). Com 1000 lojas e 3 variações cada, ~150-600MB. Custo de Storage desprezível.

## Open Questions

- **Tamanho ideal para geração:** 1024×1024 é o tamanho mínimo suportado pelo Responses API `image_generation`. O asset final da assinatura visual será menor (recortado/redimensionado para ~400×200). Testar qualidade após redimensionamento.
- **Validação visual automatizada:** como validar que a imagem gerada contém o nome correto da loja e não virou arte de campanha? Usar visão computacional (GPT-4o) ou validação manual no quality gate? Para V1, validação manual no quality gate + heurísticas básicas.
