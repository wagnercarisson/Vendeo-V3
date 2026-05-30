## Why

O pipeline de geração de campanhas atingiu maturidade visual com as fases 4.3.1 e 4.3.2, mas ainda não há base objetiva para medir, comparar e evoluir a geração de imagens. Sem métricas consistentes por execução, é impossível avaliar tempo, custo, estabilidade e qualidade entre diferentes modelos/providers. Esta fase cria essa base — registrando métricas automaticamente, permitindo troca simples de provider/modelo via ambiente, e estabelecendo uma bateria controlada de benchmarks para comparação objetiva — tudo sem travar a criatividade do diretor de marketing com excesso de regras.

## What Changes

- **Registro automático de métricas por execução**: cada chamada ao pipeline de geração registra runId, timestamp, provider, modelo, durações, custo estimado, retries, resultados de validação/revisão, erros técnicos e resumo sanitizado dos inputs. Métricas automáticas incluem: provider, modelo, duração, custo estimado, retries, validação, revisão, categoria inferida, conflitos detectados, erro/timeout. Avaliação manual (qualidade visual, legibilidade, fidelidade, força comercial, publicável sim/não) é opcional e futura.
- **Armazenamento local em JSONL**: métricas persistidas em arquivo `.jsonl` — exclusivamente para ambiente local/dev/benchmark. Em produção, métricas podem ser desabilitadas ou direcionadas para stdout/logs; não assumir filesystem persistente em produção.
- **Troca de provider/modelo via `.env.local`**: novas variáveis de ambiente para selecionar provider de imagem e modelo de imagem (prioridade). Modelo de validação/revisão configurável apenas se couber sem refatoração pesada. Reutilizar abstrações existentes (`ImageProvider`); criar factory mínima apenas se necessário, evitando arquitetura pesada de provider.
- **Bateria controlada de benchmarks**: cenários fixos (ex: JBL Boombox, Heineken, 51 Ice, pantufa, moda, loja sem logo, preço de/por) para comparação entre modelos com os mesmos inputs. Incluir previsão para testar Gemini posteriormente com os mesmos cenários e formato de métricas.
- **Métricas de comparação**: tempo total, custo, taxa de erro, necessidade de retry, qualidade visual, legibilidade, fidelidade ao produto, força comercial, publicável sim/não.
- **Orientação refinada do campo "detalhes adicionais"**: o diretor deve considerar como repertório comercial sem obrigar que todo detalhe apareça na arte.
- **Ajuste leve do validador/revisor**: corrigir erros claros de ortografia, bloquear erros grotescos e conflitos fortes, preservar divergências aceitáveis quando houver contexto suficiente.
- **Commitment leve por segmento/produto**: sugestão de segmento no prompt do diretor sem poluir com regras excessivas.

## Capabilities

### New Capabilities
- `generation-metrics`: registro automático local de métricas de geração (JSONL), incluindo runId, timestamp, provider, modelo, durações, custo, retries, validação, revisão, erros, e identificador da imagem gerada.
- `provider-model-switch`: seleção simples de provider/modelo de imagem via `.env.local`; modelos de validação/revisão permanecem como estão, salvo ajuste mínimo em configuração já existente.
- `model-benchmark`: bateria controlada de cenários fixos para execução e comparação entre modelos, com saída estruturada de métricas comparativas.

### Modified Capabilities
- `ai-image-generation`: requerimento para emitir métricas de execução (timing, custo, retries) e aceitar provider/modelo configurável via ambiente.
- `generation-progress`: separar eventos técnicos de métricas dos eventos humanizados de UI. A UI principal deve exibir apenas mensagens humanas, sem provider, modelo, runId, custo ou payload técnico.
- `creative-direction-context`: orientação mais explícita sobre como "detalhes adicionais" devem ser tratados como repertório comercial (nem sempre visível na arte).
- `validation-review-alignment`: regras refinadas para o validador/revisor — corrigir ortografia, bloquear erros grotescos, preservar divergências aceitáveis.

## Impact

- **`src/lib/image-generation/config.ts`**: novas variáveis de ambiente para provider/modelo de imagem.
- **`src/lib/image-generation/services/image-generation-service.ts`**: injeção de métricas, passagem de modelo/provider configurável, emissão de dados de timing.
- **`src/lib/image-generation/providers/`**: factory mínima para seleção de provider por env var (apenas se necessário; reutilizar abstrações existentes).
- **`src/lib/image-generation/services/image-review-service.ts`**: refinamento das regras de alinhamento (divergências aceitáveis).
- **`prompts/campaign-image-director.md`**: ajuste mínimo para orientação de repertório + commitment leve.
- **`prompts/campaign-input-visual-check.md`**: se necessário para refinamento de validação.
- **`prompts/campaign-image-reviewer.md`**: se necessário para refinamento de revisão.
- **`.env.example`**: novas variáveis documentadas.
- **Novo diretório**: `metrics/` para armazenamento JSONL (apenas local/dev/benchmark).
- **Eventos de progresso da UI**: substituir mensagens técnicas por mensagens humanas, leves e profissionais (ex: "Estamos validando as informações do produto"). Eventos técnicos (runId, provider, modelo, custo) ficam exclusivos para logs/métricas/benchmark — não expostos na UI.
- **Premissa futura de produto/legal**: o lojista é responsável pelo direito de uso das imagens, marcas e materiais enviados; o Vendeo apenas usa os insumos fornecidos para gerar a arte. Não implementar termos nesta fase.
- **Sem impacto**: não cria novas tabelas no banco, não altera fluxo de preview/export, não expõe dados técnicos na UI principal.
