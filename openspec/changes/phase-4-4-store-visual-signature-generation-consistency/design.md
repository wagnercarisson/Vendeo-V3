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

### Decision 3: Abordagem de geração da assinatura visual

**Decisão: V1 implementa Abordagem A (IA descreve, renderizador monta). Abordagem B (IA gera direto) fica como alternativa futura.**

A qualidade final da assinatura visual é crítica. A Abordagem A foi escolhida para V1 por ser mais barata, mais rápida e deterministicamente controlável. Duas abordagens foram consideradas:

**Abordagem A — IA descreve, renderizador monta:**
1. Prompt `visual-signature-generator.md` envia dados da loja (nome, segmento, cor principal, tom de voz) e pede uma descrição JSON de assinatura visual simples.
2. A IA retorna JSON com parâmetros renderizáveis (símbolo, tipografia, layout, cores).
3. Um renderizador programático (SVG) executa a arte final, gerando PNG.
4. Prós: mais barato, mais rápido, deterministicamente controlável, sem risco de jailbreak visual.
5. Contras: a qualidade visual depende do renderizador — pode ficar genérica ou "técnica demais", perdendo o aspecto de marca pronta.

**Abordagem B — IA gera a imagem diretamente (futuro):**
1. Prompt envia dados da loja e pede uma imagem simples (fundo transparente, ~400×200px) contendo símbolo + nome.
2. O modelo de imagem gera o PNG diretamente.
3. Prós: maior potencial de qualidade visual com cara de marca real.
4. Contras: mais caro, menos controle, risco de inconsistência, maior latência.

**Critério de qualidade obrigatório para Abordagem A:**
A assinatura gerada precisa parecer uma marca visual simples e publicável — não apenas iniciais decoradas. Se o resultado for genérico demais ("feito por sistema"), a implementação deve parar e reavaliar antes de integrar ao pipeline de campanha. O fallback tipográfico é consistente, mas não é o padrão de qualidade esperado.

**Arquitetura:** o serviço de geração deve abstrair a abordagem (interface `VisualSignatureGenerator`) para permitir troca futura para Abordagem B sem reescrever o fluxo.

**Fallback:** renderizador local gera assinatura tipográfica com iniciais + nome da loja em círculo com fundo na cor principal. O fallback NUNCA depende de IA.

### Decision 4: Fallback tipográfico — persistido e reutilizável

**Escolhido: Renderização via SVG, convertido para PNG Server-side, sem dependências nativas.**

O fallback precisa ser um asset persistido (Storage), não um preview temporário. A campanha reutiliza a assinatura em todas as renderizações, então não basta gerar no frontend a cada exibição.

Abordagem:
1. Lógica de `getStoreInitials()` extrai iniciais da loja.
2. Um template SVG monta o círculo com iniciais + nome da loja abaixo.
3. O SVG é convertido para PNG via ferramenta que não dependa de binários nativos (ex: `sharp` via `sharp` ou `resvg-js` — validar compatibilidade com Vercel Serverless/Edge).
4. O PNG é upado para Supabase Storage como asset da assinatura.
5. A URL do Storage é salva na tabela `store_visual_signatures` como `asset_url`.

**Ressalva:** node-canvas é proibido sem validação prévia — dependências nativas (C++) são notoriously problemáticas em Vercel Serverless. Priorizar SVG → PNG via bibliotecas WASM/puramente JS. Se a conversão para PNG se mostrar problemática, o SVG pode ser servido diretamente como asset (browsers renderizam SVG nativamente).

Isso garante que a campanha nunca trava por falha na geração da assinatura visual, e o fallback fica disponível para reúso imediato.

### Decision 5: Injeção no pipeline de campanha

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

**Escolhido: Modal de escolha após salvar a loja, não etapa fixa no fluxo.**

Após salvar a loja com sucesso:
1. Se `logo_url` existe → nenhuma ação (logotipo é a identidade principal)
2. Se não há logo nem assinatura visual ativa:
   - Sistema abre um modal (não uma nova página/etapa) com:
     - "Sua loja ainda não tem uma identidade visual. Quer criar uma?"
     - Botão "Criar Agora" (gera 3 variações) | "Deixar o Vendeo Criar" (gera 1 automaticamente)
   - Se escolhe "Criar Agora": gera 3, exibe para escolha, persiste a escolhida
   - Se escolhe "Deixar Criar": o sistema tenta gerar a assinatura via IA com timeout curto. Se a IA responder a tempo, a assinatura gerada é persistida como ativa. Se falhar ou exceder o timeout, o fallback tipográfico é gerado imediatamente e persistido como ativo. Nada de background processing real (filas/jobs) nesta fase — a resposta é síncrona com fallback imediato.

Modal (não etapa fixa) porque:
- É um momento de delight, não de obrigação
- O lojista pode pular e deixar o fallback tipográfico agir
- O modal pode ser reaberto depois do cadastro via botão "Criar Assinatura Visual" na página da loja

### Decision 7: Ciclo de vida dos status da assinatura visual

**Regras de status:**

| Status | Quando ocorre | Pode virar |
|--------|---------------|------------|
| `draft` | Variações geradas para escolha do lojista. Ainda não é a assinatura oficial. | `active` (se escolhida), `archived` (se preterida) |
| `active` | A assinatura escolhida pelo lojista OU o fallback automático gerado sem escolha. No máximo uma por loja (garantido pelo partial unique index). | `archived` (se substituída) |
| `archived` | Assinatura que foi desativada por substituição explícita. Nunca reativada — se o lojista quiser voltar para uma anterior, uma nova draft é gerada. | — |

O fallback automático (lojista escolheu "Deixar o Vendeo Criar" ou a geração falhou) nasce como `active` direto — não passa por `draft` porque não houve escolha.

Nunca pode existir mais de uma `active` por loja. O partial unique index `(store_id) WHERE status = 'active'` garante isso no banco.

### Decision 8: Troca de assinatura ativa

**Escolhido: Fluxo explícito com confirmação.**

Na página de cadastro da loja (após loja existir):
1. Seção "Identidade Visual" mostra a assinatura atual (ou "Nenhuma").
2. Botão "Criar / Alterar Assinatura Visual" → abre mesmo modal.
3. Ao escolher uma variação diferente da atual, modal de confirmação: "Tem certeza que deseja alterar a assinatura visual? As campanhas futuras usarão a nova assinatura."
4. Só após confirmação, a assinatura é salva como ativa e a anterior vai para `archived`.

## Risks / Trade-offs

- [Custo de IA] Gerar assinatura visual via prompt de texto (não imagem) é barato. Mesmo assim, chamadas desnecessárias (lojista que nunca vai escolher) devem ser evitadas. → Gerar sob demanda, apenas quando o lojista opta por criar.
- [Travamento de fluxo] Geração de assinatura não deve bloquear campanha. → Fallback tipográfico persistido é sempre uma opção. Se a IA falha ou excede timeout, o sistema gera o fallback e continua.
- [Substituição acidental] Trocar assinatura ativa sem querer. → Confirmação explícita em modal antes de alterar. Status `draft` para novas variações até escolha explícita.
- [Custo de storage] Assinaturas são leves (~5-10KB cada PNG). Mesmo com muitas lojas, o custo é desprezível.
- [Qualidade visual] A assinatura gerada por IA pode ser genérica. → O prompt deve ser específico sobre segmento, tom de voz e identidade. Fallback tipográfico é sempre uma alternativa consistente.

## Open Questions

- **Server-side SVG→PNG:** `sharp` (via `@img/sharp`) funciona em Vercel Serverless? `resvg-js` é uma alternativa WASM viável? Testar antes de cravar a implementação. Se a conversão for problemática, assets SVG podem ser servidos diretamente.
- **Qualidade visual da Abordagem A:** a assinatura gerada parece uma marca visual publicável? Se o resultado for genérico demais, a fase precisa parar e reavaliar antes de integrar ao pipeline de campanha.
