# Tasks — F49 Ativação e Orientação Contextual de Campos

> Fonte da verdade: `openspec/changes/fase-49-ativacao-orientacao-contextual-campos/` (proposal.md, design.md, specs/). Restrições de execução: **sem** alteração de prompts, gateway/modelos, pipeline, schemas públicos, snapshot, domínio, contrato HTTP, banco/storage; **sem** novas chamadas de IA; **sem** validadores semânticos. Trackings/roadmap **não** são atualizados durante a elaboração/execução; a atualização normal no **fechamento autorizado** da fase segue o workflow do projeto.

## 1. Baseline, inventário e fences

- [x] 1.1 Registrar o **estado inicial** do repositório (`git status --short` + `git diff` dos arquivos protegidos) e identificar alterações **pré-existentes** (não rastreadas) para **preservá-las** — sem exigir árvore limpa e sem commitar arquivos pré-existentes sem decisão explícita
- [x] 1.2 Inventariar os consumidores reais dos campos (tabela do `design.md` — Context) e confirmar em código: `Nome da Loja`→brief/copy/identidade; `Tom de Voz`→`computeTabUnlock`/brief/copy/`art-director-briefing`; `Posicionamento`/`Descrição Curta`→brief/copy/**perfil-diretção visual** (`brand-director`/`brand-profiler`/`identity-art-director`/`text-only-inference`)/drift; `Slogan`→brief/copy/assinatura visual/drift; `product.description`→`CopyDirectorInput.description` e **ausente** no `art-director-briefing`; preços→`inferIntent`/copy/arte; `mandatoryArtworkText`→prompt do diretor/snapshot
- [x] 1.3 Confirmar a regra real de desbloqueio (`computeTabUnlock` → `needs_tone_of_voice`) e a fonte do texto (`src/lib/store-onboarding/reason-text.ts`) para ancorar a orientação do tom de voz
- [x] 1.4 Registrar o baseline de não-mudança: hashes de `prompts/**`, `src/lib/ai/**`, `src/lib/campaign/brief.ts`, `src/lib/campaign/brief-schema.ts`, `src/lib/image-generation/services/art-director-briefing.ts` e `src/components/flow/use-campaign-form.ts` (helpers) — confirmar que a F49 não os tocará

## 2. Conteúdo de orientação em módulos puros (D14)

- [x] 2.1 Criar `src/lib/store-onboarding/field-guidance.ts` (puro, sem JSX/side-effects) com: microcopy de `Nome da Loja` (nome público), rótulo/helper dos dados fiscais, hint do `Tom de Voz`, descrições contextuais das 8 opções (`profissional`, `moderno`, `elegante`, `divertido`, `acolhedor`, `jovem`, `tradicional`, `luxuoso`), label/hint/placeholder/termo secundário de `Posicionamento` + exemplo expansível + microcopy reconhecendo o efeito na identidade (copy + perfil/direção visual, sem prometer transformação visual), e microcopy de `Descrição Curta` (recomendada) e `Slogan` (**opcional**, "se sua loja já utiliza um")
- [x] 2.2 Criar `src/lib/campaign/field-guidance.ts` (puro) com: label/microcopy/placeholder de `Descrição do produto`; labels/hints de `Preço de venda (final)`/`Preço anterior (original)`; conteúdo da ajuda expansível "Como os preços mudam a campanha?" (3 regras); função pura de **feedback dinâmico** derivada de `inferIntent`/opções disponíveis, cobrindo **4 estados** (dois preços, só venda, **só anterior → mensagem neutra**, sem preço); label/microcopy/placeholder multi-linha de `Informações obrigatórias na arte`
- [x] 2.3 Garantir que os módulos exportam as strings usadas por componentes e testes (fonte única — nenhuma cópia divergente)
- [x] 2.4 Escrever testes unitários dos módulos de conteúdo: feedback dinâmico para os 4 estados de preço coerente com `inferIntent`/`availableOptions` (incluindo o estado neutro "só preço anterior"); presença de descrição para todas as 8 opções de tom de voz; strings não vazias

## 3. Primitivos de ajuda de campo (D2/D13)

- [x] 3.1 Criar primitivo local de **hint inline** (`FieldHint`) com `id` associável e classes de design system (sem tocar `src/components/ui/` além do necessário)
- [x] 3.2 Criar primitivo local de **ajuda expansível** (`ExpandableHelp`) acessível: `<button aria-expanded>` + região revelada (ou `<details>/<summary>`), colapsado por padrão, acionável por teclado, foco visível, touch target ≥ 44px
- [x] 3.3 Definir o padrão de associação `aria-describedby` (ids via `useId`) reutilizável nos campos com hint/erro/feedback (precedente `lab-textarea.tsx`)
- [x] 3.4 Criar helper/indicador textual de estado **"Recomendado"** (D3) sem depender de cor, reutilizável nos campos recomendados
- [x] 3.5 Escrever testes dos primitivos: hint associado, disclosure abre/fecha com `aria-expanded` correto e navegação por teclado, indicador "Recomendado" acessível
- [x] 3.6 Definir o tratamento acessível de obrigatoriedade: `aria-required="true"` nos campos obrigatórios, **sem** adicionar o atributo nativo `required` (preserva `noValidate` + validação controlada + mensagens)

## 4. Aplicação — campos da loja (`/loja`) (D3/D4/D5/D6/D7)

- [x] 4.1 Aba Dados: agrupar `CNPJ`/`Razão Social`/`Nome Fantasia` como subseção de dados fiscais/oficiais e adicionar a microcopy de identidade pública ao `Nome da Loja`; preservar atalhos "Usar nome fantasia/razão social como nome da loja"
- [x] 4.2 Aba Posicionamento: adicionar hint do `Tom de Voz` e a **descrição contextual da opção selecionada** (8 opções), refletindo a regra real de desbloqueio
- [x] 4.3 Aba Posicionamento: renomear o label de `Posicionamento` para "Como você quer que sua loja seja percebida?" (termo secundário "Posicionamento da marca"), novo hint (público/proposta/diferencial) + microcopy reconhecendo o efeito na identidade (copy + perfil/direção visual, sem prometer transformação visual) e exemplo positivo em **ajuda expansível**; substituir o placeholder atual
- [x] 4.4 Aba Posicionamento: adicionar microcopy de distinção a `Descrição Curta` e `Slogan`; marcar **Posicionamento** e **Descrição Curta** como **recomendados** e deixar **Slogan** como **opcional** ("se sua loja já utiliza um"), **sem** o indicador "Recomendado"
- [x] 4.5 Garantir que nenhuma mudança toca validação, auto-save, draft, drift, `POST/PATCH /api/store` ou `computeTabUnlock`/`reason-text`; campos obrigatórios recebem `aria-required` sem `required` nativo

## 5. Aplicação — campos da campanha (`/campanhas/nova`) (D8/D9/D10/D11)

- [x] 5.1 Seção Produto: renomear o campo para "Descrição do produto" e aplicar microcopy/placeholder reais (mesmo campo `fields.description`, `maxLength 120`, contador)
- [x] 5.2 Seção Oferta: aplicar labels "Preço de venda (final)" / "Preço anterior (original)" + hint curto por campo (mesmos campos/body)
- [x] 5.3 Seção Oferta: substituir o bloco permanente de 3 regras pela **ajuda expansível** "Como os preços mudam a campanha?" (colapsada por padrão) preservando o conteúdo das regras
- [x] 5.4 Seção Oferta: adicionar o **feedback dinâmico** das combinações de preço (função pura de 2.2), incluindo o estado intermediário **"só preço anterior"** com mensagem neutra ("Informe o preço de venda para completar a oferta.") — sem alterar `inferIntent`/`IntentSelector`/`availableOptions` e sem validação nova
- [x] 5.5 Seção Avisos: aplicar label "Informações obrigatórias na arte", microcopy positiva e placeholder multi-linha no `MandatoryArtworkField`; manter o campo diretamente visível e sem advertências negativas
- [x] 5.6 Confirmar que o body/validação/fluxo de revisão permanecem idênticos (nenhum campo novo de estado; helpers de `use-campaign-form.ts` intocados)

## 6. Revisão do brief com categorias separáveis (D11/D12)

- [x] 6.1 Em `campaign-brief-review.tsx`, apresentar **aviso ilustrativo** e **informações obrigatórias na arte** como itens distintos e rotulados (derivados de `showIllustrativeNotice`/`mandatoryArtworkTextFree`), sem concatenar em um único bloco
- [x] 6.2 Alinhar os rótulos de preço da revisão ("Preço anterior"/"Preço de venda") e manter validade em item próprio
- [x] 6.3 Garantir que `buildMandatoryArtworkText`, o body, o snapshot e o contrato HTTP **não** mudam (apresentação apenas)

## 7. Testes automatizados (D14/D15)

- [x] 7.1 Testes de labels/hints/microcopy dos campos da loja e da campanha (strings vêm dos módulos de conteúdo — fonte única)
- [x] 7.2 Testes de associação acessível: `aria-describedby` ligando campo↔hint/erro/feedback; `aria-invalid` preservado nos erros; campos obrigatórios com `aria-required="true"` e **sem** `required` nativo
- [x] 7.3 Testes de **descrição contextual** do tom de voz selecionado (8 opções; sem seleção → sem descrição)
- [x] 7.4 Testes de **ajuda expansível**: colapsada por padrão; abre/fecha; `aria-expanded`; acessível por teclado
- [x] 7.5 Testes de **feedback dinâmico de preços** para os 4 estados (dois preços, só venda, **só anterior → neutro**, sem preço), coerentes com as opções reais do seletor de intenção
- [x] 7.6 Testes de **persistência e restauração** dos valores existentes (incluindo descrição e informações obrigatórias multi-linha) sem interferência da orientação
- [x] 7.7 Teste de **texto obrigatório multilinha**: placeholder com múltiplas linhas e envio do valor multi-linha no mesmo contrato
- [x] 7.8 Testes de **categorias preservadas na revisão**: aviso ilustrativo e informações obrigatórias como itens separáveis; rótulos de preço coerentes
- [x] 7.9 Testes de **não-divergência microcopy ↔ comportamento**: feedback de preço × `inferIntent`/`availableOptions` (incluindo o estado "só anterior"); hint do tom de voz × `computeTabUnlock`; microcopy de identidade × consumidores reais (copy + perfil/direção visual)
- [x] 7.10 Teste de **fence do Diretor de Arte**: `product.description` presente no `CopyDirectorInput` e **ausente** no briefing do diretor
- [x] 7.11 Testes de **não-mudança** de prompts/pipeline/body/snapshot (goldens existentes + ausência de alteração em `prompts/**` e no body)

## 8. Co-migração e regressão (D15)

- [x] 8.1 Co-migrar asserções de teste que consultam labels/placeholders/microcopy alterados: `campaign-input-form.test.tsx`, `campaign-brief-review.test.tsx`, `use-campaign-form-*.test.ts`; **`validity-field.test.tsx` entra apenas como regressão** (`validity-field.tsx` não é modificado)
- [x] 8.2 Co-migrar testes da loja que consultam labels/microcopy: `store-identity-form.aceite-legal.test.tsx`, `store-identity-form.drift*.test.ts`, `store-identity-form.redirect-messages.test.ts`, `store-page-client.test.tsx`, `store-tabs.test.tsx`
- [x] 8.3 Rodar a regressão de auto-save, drafts, navegação por abas e montagem do body (suites de F36/F40/F41/F43) e confirmar zero regressões de comportamento
- [x] 8.4 Revisar o diff completo contra o baseline do grupo 1 e confirmar ausência de alterações em prompts, gateway/modelos, pipeline, schemas, snapshot, domínio, rotas HTTP e banco

## 9. Gates e UAT humana

- [x] 9.1 Rodar `npx vitest run` (suíte completa) sem falhas
- [x] 9.2 Rodar `npm run typecheck` sem erros
- [x] 9.3 Rodar `npm run lint` sem erros
- [x] 9.4 Rodar `npm run build` sem erros
- [ ] 9.5 Escrever o checklist de UAT humana com tarefas de **compreensão** (não apenas presença de textos), em desktop e mobile (320px/375px), avaliando também **ausência de poluição visual**:
  - diferenciar razão social, nome fantasia e nome da loja;
  - explicar para que serve o tom de voz;
  - preencher posicionamento com proposta, público e diferencial;
  - diferenciar posicionamento, descrição curta e slogan;
  - preencher uma descrição real de produto;
  - compreender como os preços afetam a intenção;
  - usar informações obrigatórias com múltiplos detalhes do produto;
  - identificar corretamente onde informar validade e aviso ilustrativo;
  - revisar o brief antes da geração reconhecendo as categorias separadas
- [ ] 9.6 Executar a UAT humana (desktop + mobile) e registrar evidências; confirmar a escolha editorial "Informações obrigatórias na arte" × "Detalhes obrigatórios na arte" e a redação final das descrições de tom de voz — **PENDENTE DE RE-UAT (49-14)**: o cenário 7 ("Informações obrigatórias na arte") reprovou parcialmente na UAT (placeholder sem restrição; microcopy sem "restrições"/"preferencialmente"); a correção foi aplicada no plano corretivo **49-14** (apresentação/conteúdo apenas, fonte única `src/lib/campaign/field-guidance.ts`) e os 4 gates + 59 hashes de não-mudança foram revalidados. A re-UAT humana (49-13 Task 2/3) deve ser reexecutada antes de marcar 9.5–9.7.
- [ ] 9.7 Registrar o resultado (SUMMARY/verificação da fase) confirmando: 4 gates verdes, UAT aprovada e fences de não-mudança cumpridos; **quando autorizado o fechamento da fase**, atualizar trackings/roadmap conforme o workflow do projeto
