## Why

O Vendeo entrega hoje campanhas de Produto apenas em 1:1 (fluxo novo, arte 1024 × 1024). Lojistas publicam principalmente em Stories e Reels, onde uma peça quadrada perde área e legibilidade. O produto já prevê o formato vertical 9:16 no sistema visual e no roadmap, mas não existe contrato de formato, composição, resolução, persistência nem entrega para ele. Esta mudança cria esse caminho de forma isolada, **preservando o comportamento do Produto 1:1 aprovado**.

## What Changes

- A criação de campanha do fluxo NOVO passa a oferecer **exatamente um formato** por campanha:
  - **Quadrado 1:1** — comportamento atual preservado, com a arte nova em 1024 × 1024 como hoje (o legado 1080 × 1080 não é alterado).
  - **Vertical 9:16** — caminho próprio, com entrega final **JPEG sRGB 1080 × 1920**.
- Rótulos explícitos, sem prometer vídeo nem compatibilidade irrestrita com todos os posicionamentos: “Quadrado 1:1 — feed” e “Vertical 9:16 — Stories e Reels (imagem estática)”.
- O formato é **congelado na criação** e persistido no snapshot da campanha, junto de uma versão de contrato validada em conjunto. Campanhas existentes não são alteradas, convertidas ou reformatadas; não há troca de formato depois de gerada. Versão ausente, inválida ou não suportada resulta em indisponibilidade explícita, nunca em fallback silencioso para o perfil atual.
- O caminho vertical tem **prompt, composição e pipeline de arte próprios**, derivados do Produto 1:1. O Copy Director existente é reutilizado sem alteração de prompt, regra ou contrato.
- É definida uma **política versionada de áreas seguras** para 9:16 (topo 14%, base 35%, laterais 6% e proteção adicional no canto inferior direito), separando orientação documentada, recomendação conservadora do Vendeo e validação pendente.
- A geração vertical usa o adapter produtivo real (`images.edit`), solicitando **1152 × 2048** e reduzindo proporcionalmente, sem distorção, corte de conteúdo ou faixas, para **1080 × 1920**.
- A entrega ganha paths próprios, download, recuperação de imagem, resolução administrativa, projeção da campanha, identificação persistida do formato e **miniatura vertical leve** derivada da arte final (best-effort, sem bloquear a entrega). Recuperação e resolução administrativa levam o formato e o path esperado até a projeção final, com teste de ponta a ponta até detalhe/listagem e sem nova geração.
- Crédito, reserva, entrega, falha, recuperação e estorno seguem as regras atuais do fluxo novo: **1 campanha entregue = 1 crédito**. A estimativa pré-chamada e o teto de gasto passam a considerar explicitamente a resolução vertical antes de cada chamada, incluindo retries.
- Uma única chave global `product_9_16_enabled` (OFF por padrão) controla a exposição do formato vertical e **apenas o início de novas gerações**. Campanhas já criadas permanecem consultáveis, baixáveis, recuperáveis e resolvíveis administrativamente; gerações em andamento seguem até o estado terminal. Não há nova segmentação, autorização por estágio, coorte ou mecanismo de ativação.
- O comportamento do `1:1` é preservado, mas a engine compartilhada recebe três extensões aditivas (`composePrompt`, `imageSize` e `beforeReservation`) com defaults que mantêm o contrato atual. `beforeReservation` é a guarda pré-reserva que exige estimativa vertical e teto de gasto antes da reserva/provider; ausente, a sequência 1:1 permanece idêntica. Nenhum prompt, validador, crédito, recuperação ou entrega `1:1` muda de comportamento.
- Persistência reaproveita `campaigns`, snapshots, `product_1_1_campaign_artifacts` e RPCs atuais **sem migration estrutural**. A única migration prevista é *data-only*: semear a chave global OFF, no padrão `INSERT ... ON CONFLICT DO NOTHING`. Se a prova técnica revelar qualquer outra necessidade estrutural, ela volta como decisão explícita com evidência.

## Capabilities

### New Capabilities

- `product-vertical-format-selection`: escolha de exatamente um formato na criação do fluxo novo, rótulos, formato congelado, identificação persistida e proibição de conversão/troca.
- `product-vertical-safe-area-composition`: política versionada de áreas seguras 9:16, composição vertical do prompt, preenchimento do canvas e reutilização do Copy Director.
- `product-vertical-generation-delivery`: resolução solicitada × entregue, prova de provider, pipeline JPEG 1080 × 1920, paths, metadados, miniaturas, download, recuperação, projeção e integração de crédito.
- `product-vertical-homolog-rollout`: chave global, validação em homolog com lojas de teste, sobreposições de Stories/Reels, regressão 1:1 e gates separados de produção.

### Modified Capabilities

- `campaign-input-ui`: a tela de criação do fluxo novo passa a exibir o seletor de formato e a restaurar a escolha após encerramento/estorno; o formulário legado e o **comportamento** do formulário 1:1 permanecem preservados.

## Impact

- **Rotas**: `POST /api/campaign/generate-image` ganha despacho para o caminho vertical; `GET /api/campaign/[id]/download`, `POST /api/campaign/[id]/image-recovery` e o detalhe da campanha passam a reconhecer o formato persistido; `GET /api/campaign/generation-status` permanece por identidade de operação.
- **UI**: `src/components/flow/*` (seletor de formato, payload, restauração e fingerprint) e `src/app/(app)/campanhas/nova/page.tsx` (elegibilidade server-side).
- **Domínio novo**: `src/lib/product-vertical-9-16/**` (formato, política de área segura, prompt, arte, orquestração, recuperação), isolado de `src/lib/product-1-1/**`.
- **Reutilização estável**: `CopyDirectorService`, cliente de crédito, cliente de tentativas, persistência de snapshot, engine de geração, projeção de campanha, storage privado e mecanismo de miniaturas. A engine recebe apenas extensões aditivas com defaults 1:1.
- **Persistência**: `campaigns.input_snapshot` (formato), `product_1_1_campaign_artifacts` (dimensões reais), evidência congelada (`policy_versions`). Sem migration estrutural; apenas um seed data-only da flag global, se aprovado. Constraints e RPCs atuais verificadas.
- **Provider**: `UpstreamImagesAdapter` → `openai.images.edit`; documentação local do SDK confirma dimensões arbitrárias divisíveis por 16, proporção entre 1:3 e 3:1 e máximo 3840 × 2160. A resposta real e o custo precisam de prova em homolog.
- **Design system**: `openspec/design-system/CAMPAIGN_VISUAL_SYSTEM.md` já lista Story 1080 × 1920 como formato futuro; esta mudança formaliza o contrato vertical e mantém o quadrado intacto.
- **Fora de escopo**: fluxo antigo, Serviços/Informativos, geração simultânea dos dois formatos, conversão de campanhas, novo Copy Director ou copy por plataforma, vídeo, carrossel, publicação em redes e redesenho dos cards de listagem/dashboard.
- **Hipótese futura registrada**: um prompt que produza duas artes similares (uma por formato) fica como investigação separada, sem implementação nem teste pago nesta iniciativa.
