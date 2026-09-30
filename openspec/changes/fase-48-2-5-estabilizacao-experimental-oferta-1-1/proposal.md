## Why

A F48.2.4 entregou um primeiro candidato de Oferta 1:1, mas o papel semântico de imagem principal versus referências auxiliares e a integridade dos textos de entrada ainda precisam de contratos determinísticos, testáveis e visíveis ao operador. A F48.2.5 estabiliza esses contratos e conduz ciclos manuais de prompt/modelo até formar um candidato experimental aprovado e reproduzível, sem promover qualquer conteúdo ou configuração para produção.

## What Changes

- Definir uma política de imagens pertencente ao tipo de conteúdo `produto`: a imagem principal é obrigatória, protagonista e referência canônica; até três imagens adicionais opcionais são referências do mesmo produto, subordinadas, sem obrigação de aparecer. Preservar o transporte ordenado principal → adicionais → identidade da loja.
- Adicionar um preflight local e determinístico para possíveis problemas nos textos livres do usuário antes de compor o prompt. Alertas exibem campo, trecho e motivo; o usuário pode corrigir ou autorizar manter exatamente os textos da revisão atual. Alterações subsequentes invalidam a autorização. Sem IA, correção automática ou alteração silenciosa.
- Estender as políticas determinísticas para diferenciar: nome do produto integral e literal conforme informado/aprovado; descrição como complemento que pode ser selecionado/resumido/adaptado sem mudar significado ou inventar conteúdo; informações obrigatórias reproduzidas literalmente. A qualidade linguística geral e a integridade comercial permanecem atribuídas às políticas apropriadas, sem regras ligadas a exemplos específicos. Presença/fidelidade visual são avaliadas por humanos, não garantidas tecnicamente.
- Conduzir experimentos manuais de prompt e de modelo em rodadas controladas, com uma variável alterada por vez, registro de hipótese/entradas/run/avaliação/decisão, comparações humanas e evidências de custo/latência/usage/pricing. A matriz inicial é `gpt-image-2`, `gpt-image-2.5-flare` e `gpt-image-2.5-sunburst`, todos em `low`.
- Definir manifesto documental/JSON versionável do candidato Oferta 1:1 que congela prompt-base reutilizável e versões determinísticas. O prompt compilado/aprovado completo varia por loja/produto/oferta e permanece associado a cada run, referenciado no manifesto por run ID; nenhum prompt específico de caso é tratado como universal. O manifesto inclui modelo/preset, protocolo, pricing, evidências, avaliações, limitações e decisão humana, sem ativação produtiva.
- Manter o escopo local e experimental: sem geração automática de candidatas, otimização automática, avaliação por IA, revisor visual, promoção, canário, mudanças produtivas ou migrations remotas. Toda geração real é manual e exige autorização humana explícita.

## Capabilities

### New Capabilities

- `lab-bench-image-roles`: semântica de imagem principal obrigatória e imagens adicionais opcionais subordinadas para conteúdo de produto, preservando ordem canônica até o modelo.
- `lab-bench-text-integrity`: detector determinístico e testável de alertas em textos livres, decisão explícita por revisão e invalidação da autorização após alteração.
- `lab-bench-candidate`: protocolo manual de experimentação Oferta 1:1 e manifesto versionável de handoff do candidato aprovado, sem promoção.

### Modified Capabilities

- `lab-bench-prompt-policy`: política de produto reforça papéis das imagens; integridade linguística/literal geral fica separada da integridade comercial, atribuída exclusivamente à política Oferta.
- `lab-admin-api`: `/compose` e `/runs` compartilham evidência versionada e vinculada aos valores textuais da revisão atual; respostas de alerta/obsolescência são explícitas e fail-closed.
- `lab-bench-prompt-preflight`: composição fica bloqueada até resolver alertas de integridade da revisão atual, sem IA ou correção automática.
- `lab-generation-bench`: protocolo de UAT manual inclui matriz controlada de modelos, critérios humanos e preservação de evidências técnicas/financeiras, com checkpoints explícitos.
- `lab-bench-run-history`: documentos de experimento referenciam runs/linhagem existente e preservam avaliações humanas sem nova tabela ou workflow de avaliação automatizada.

## Impact

- Código provável: `src/lib/lab/bench/domain/policies/**`, compositor/preflight e schemas; componentes da bancada de formulário, imagens e composição; rotas `/api/admin/laboratorio/bancada/compose` e execução; testes de contrato.
- Evidências: infraestrutura existente `lab_bench_runs`, linhagem, snapshots e `prompt_sent`, complementada por documentos versionáveis de UAT/experimento e manifesto do candidato. Nenhuma tabela nova prevista.
- Operação experimental exclusivamente local. Modelo/preset produtivo, prompts produtivos, pipeline de produção, migrations remotas, campanhas reais e créditos de usuários permanecem fora do escopo.
