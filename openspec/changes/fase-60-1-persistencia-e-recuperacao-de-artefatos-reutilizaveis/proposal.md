## Why

A F60 encerrou o controle da operação 9:16 em duas etapas, mas não persistiu nem recuperou os artefatos da composição. Sem um módulo independente, cada orquestração futura (9:16 somente, ambos os formatos, aquisição do quadrado de uma composição que já entregou vertical e expansão de uma composição quadrada existente) tenderia a criar seu próprio armazenamento, duplicar metadados e expor artefatos internos ao lojista. Esta é uma nova fatia da iniciativa 60; a change original da F60 permanece encerrada e publicada.

## What Changes

- Cria um **módulo compartilhado de artefatos de composição**, sem orquestrador, rota, UI ou flag, responsável por persistir, localizar, recuperar e validar artefatos.
- Define **identidade explícita** do artefato por loja, campanha, operação e papel (`square_original`, `square_prepared`, `vertical`), com vínculo validado server-side.
- Distingue **quadrado original**, **cópia preparada 1152** e **vertical 1080×1920**, com política de dimensão, MIME e decodificação completa por papel.
- Persiste **dimensões reais, MIME, bytes, checksum SHA-256 e proveniência**, sempre derivados dos bytes gravados e nunca de metadados declarados pelo cliente.
- Torna a repetição **idempotente**: mesma identidade + mesmo conteúdo + mesma proveniência reutiliza o resultado; mesma identidade + conteúdo diferente é conflito explícito; upload disputado converge por releitura, sem duplicação nem sobrescrita. A adoção de objeto órfão exige **evidência durável gravada nos metadados do próprio objeto**; bytes sozinhos não comprovam origem.
- Recusa explicitamente **conflito de conteúdo, de identidade, de metadados e de proveniência** (linha persistida divergente dos bytes, mesma imagem com origem incompatível ou evidência de órfão ausente/incompatível).
- Exige **contexto de autorização derivado pelo servidor** (`owner`/`system`) em toda operação que lê ou grava bytes, e revalida a origem de derivados por artefato interno ou descritor de campanha entregue com checksum.
- Mantém **artefatos internos privados por política**, não por nome de path: bucket dedicado, sem leitura para `anon`/`authenticated`, sem URL assinada e sem URL pública nesta fatia. A imutabilidade da linha é garantida por grants/trigger; a não sobrescrita do objeto pelo comportamento do módulo (`upsert:false`, sem delete), pois `service_role` ignora RLS.
- Separa **fonte de campanha já entregue** (valida status, formato e path canônico) de **base interna** (valida identidade, autorização, papel e integridade, sem exigir campanha `ready` ou formato global 1:1). Uma campanha vertical em processamento com quadrado interno íntegro é fonte reutilizável.
- Reconhece uma **campanha quadrada legada** (e a arte 1:1 do novo fluxo já projetada em `campaigns.storage_path`) como fonte reutilizável, sempre por leitura validada de propriedade, vínculo, integridade e compatibilidade. As duas origens de campanha entregue são aceitas na persistência do derivado, com revalidação específica. Nenhum arquivo ou registro legado é migrado, renomeado ou reclassificado.
- Propõe, mas **não autoriza nem aplica nesta rodada**, uma migration aditiva com nova tabela, novo bucket privado, policies e vínculo composto loja↔campanha. A migration futura seguirá `YYYYMMDDHHmmss_descricao.sql`, com timestamp real e unicidade verificada.
- Preserva integralmente o fluxo 1:1 atual, o 9:16 direto da F59, o controle da F60, os serviços financeiros, o bucket `campaign-images`, as tabelas existentes e a UI.

## Capabilities

### New Capabilities

- `campaign-composition-artifacts`: identidade e vínculo loja/campanha/operação; autorização server-side; papéis e dimensões; persistência imutável com bytes, checksum e proveniência; idempotência e conflito, incluindo corrida de upload, proveniência incompatível e evidência durável de órfão; recuperação e validação server-side; privacidade de artefatos internos separada da imutabilidade; reconhecimento seguro de fonte de campanha entregue (legado e 1:1 atual) e de base interna; separação entre persistência e entrega.

### Modified Capabilities

<!-- Nenhuma capability existente muda de requisito. O módulo é aditivo e não altera contratos do 1:1, do 9:16 direto ou do controle da F60. -->

## Impact

- **Código novo**: biblioteca em `src/lib/campaign/composition-artifacts/**`, separando contratos puros (identidade, papéis, paths, políticas, resultados tipados) de implementação server-only (persistência, leitura, validação por conteúdo e resolução de fonte). Nenhum orquestrador é criado e nenhum orquestrador existente é extraído ou reescrito.
- **Banco (proposto, não autorado/aplicado)**: nova tabela aditiva `campaign_composition_artifacts`, novo bucket privado `campaign-internal-artifacts`, políticas de `SELECT`/`INSERT` para `service_role`, trigger de imutabilidade e vínculo composto `(campaign_id, store_id) → campaigns(id, store_id)`. Nenhum SQL executável é criado nesta rodada.
- **Reutilização**: `resolveCampaignFormat` para distinguir 1:1/9:16; `campaigns.storage_path` como caminho canônico da arte 1:1 já projetada; `stores.user_id` para propriedade; `campaign-images` somente como leitura de fonte; padrão de decodificação completa com `sharp` já usado pelos stores 1:1/vertical; cliente Supabase `service_role` injetável.
- **Intocado**: `product_1_1_campaign_artifacts`, policies do bucket `campaign-images`, `src/lib/product-1-1/artifact/**`, `src/lib/product-vertical-9-16/artifact/**`, tabelas/RPCs de crédito e de duas etapas, `campaigns` (sem alteração de colunas, dados ou contrato; eventual índice único e FK composta aditivos para integridade do vínculo são explicitados no design), `campaign_art_versions`, UI, flags e ativação.
- **Fora de escopo**: geração de copy ou imagem; redimensionamento 1024→1152; expansão por IA; reserva, confirmação, estorno ou compra de créditos; autorização comercial por formato; download público; seletor; apresentação de duas versões; TTL, purge ou limpeza automática; chamadas pagas; escrita em banco; deploy, merge ou push.
- **Testes**: contratos offline com Storage/DB simulados e **decodificador real** com imagens determinísticas, sem rede, banco ou IA; cobertura de evidência durável de órfão e do fluxo campanha 1:1 atual → preparado; integração real somente em etapa autorizada, incluindo leitura negada a usuário autenticado da própria loja; promoção produtiva em gate separado. Nenhuma conclusão local será apresentada como aprovação de produção.
- **Design system**: não afetado; esta fatia não altera UI, tema, tipografia, ícones ou páginas.
