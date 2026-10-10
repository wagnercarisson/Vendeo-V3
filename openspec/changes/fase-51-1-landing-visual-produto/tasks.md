# Tasks — F51.1 Landing visual de produto

> **Checkpoint humano obrigatório antes da implementação:** aprovar composição visual, copy e função das imagens (design D9). Sem ativação de flags, deploy ou alteração de contratos compartilhados.
> **Aprovação humana do checkpoint (Plano 01) registrada em 2026-10-08** — implementação liberada (Planos 02–08).

## 1. Candidata, teste de compreensão e checkpoint

- [x] 1.1 Produzir a candidata da composição visual (mobile e desktop), a copy e o mapa/função das imagens (hero=qualidade; transformação=simplicidade; apresentação=flexibilidade visual; identidade=coerência; abordagens=diferentes formas de comunicar), usando placeholders quando necessário
- [x] 1.2 Registrar o teste de compreensão: verificar que o visitante entende o produto após hero e transformação
- [x] 1.3 Apresentar a candidata ao responsável e obter aprovação de composição, copy e função das imagens antes de implementar
- [x] 1.4 Registrar a fronteira de arquivos (src/app/page.tsx, src/components/landing/*, assets, testes) e justificar previamente qualquer necessidade de tocar layout global, globals.css, design system ou dependências
- [x] 1.5 Confirmar que nenhuma campanha interna (`briefing`, `intenção`, `F56`) ou formato fora do escopo aparecerá no conteúdo público

## 2. Estrutura e narrativa da página

- [x] 2.1 Reestruturar `src/app/page.tsx` com os blocos na ordem: hero, transformação, apresentação do produto, identidade e controle, abordagens de divulgação, oferta, FAQ/rodapé
- [x] 2.2 Implementar o hero com promessa, campanha protagonista e CTA, garantindo mensagem e CTA visíveis no mobile
- [x] 2.3 Implementar o bloco de transformação (informações preenchidas → campanha conferida → download), absorvendo "Como funciona" sem bloco duplicado
- [x] 2.4 Implementar o bloco de apresentação do produto ("Escolha como apresentar seu produto." / "Estúdio, ambientado ou mantendo o fundo original.") com três campanhas do mesmo produto (estúdio, ambientado, fundo original), mantendo a mesma abordagem comercial e informações equivalentes para isolar a diferença de apresentação
- [x] 2.4b Implementar o bloco de abordagens de divulgação ("Uma campanha para cada jeito de divulgar." / "Mostre uma oferta, valorize um produto ou apresente algo especial.") com três campanhas do mesmo produto (oferta, destaque, exclusivo), mantendo o mesmo cenário e a identidade da loja, variando as informações necessárias; peso editorial menor; sem cartões explicativos extras nem CTAs
- [x] 2.5 Implementar o bloco compacto de identidade e controle, sustentado por exemplos, deixando claro que o usuário confere e decide o que publicar
- [x] 2.6 Mover "Novidades" para posição secundária/rodapé e montar FAQ + rodapé legal

## 3. Imagens e assets

- [x] 3.1 Criar/ajustar os componentes de imagem com proporções estáveis e placeholders substituíveis sem refazer layout
- [x] 3.2 Remover imagens sem função de prova; garantir que apenas campanhas protagonizam e que interface/texto são apoio
- [x] 3.3 As artes de demonstração foram **selecionadas/geradas por geração humana autorizada** (fora da execução automática; o agente, a landing e os testes **não** geram nem chamam provider) e **aprovadas individualmente** pelo responsável, bloco a bloco (hero, apresentação, abordagens, identidade e transformação — esta com dados + miniatura). **Nota:** aprovação **por arte**, distinta da **aprovação final da página** (ainda pendente).
- [x] 3.4 Placeholders de arte **substituídos** pelas artes aprovadas na landing, sem fabricar depoimentos, resultados comerciais ou provas de identidade. **Nota:** não restam placeholders de arte; a aprovação final da página permanece pendente (Plano 08).

## 4. Oferta e controles de acesso

- [x] 4.1 Criar componente independente da oferta com a mensagem principal curta "Experimente o Vendeo em sua loja: 28 dias gratuitos e até 20 créditos." e a mecânica (início após onboarding, 5 + 5 nos dias 7/14/21, acúmulo, máximo 20, vencimento do gratuito restante) obrigatoriamente em informação secundária/FAQ
- [x] 4.2 Garantir que a oferta não promete 20 campanhas/uso ilimitado e que, no beta fechado, solicitar acesso não inicia o período
- [x] 4.3 Reutilizar `publicSignupEnabled`/`getLaunchConfig()` em todos os CTAs de aquisição (hero, transformação, identidade, oferta), mantendo "Entrar" como ação secundária
- [x] 4.4 Preservar o formulário de solicitação e o contrato do `POST /api/access-requests` (flag off) e os caminhos de cadastro existentes (flag on)

## 5. Acessibilidade e preservação

- [x] 5.1 Manter hierarquia de headings, landmarks, foco visível e alvos de toque ≥ 44px
- [x] 5.2 Preservar links legais (`/termos`, `/privacidade`, `/uso-aceitavel`, Contato); com a chave fechada, manter o formulário presente com estados de envio/sucesso/erro; com a chave aberta, ocultar o formulário e manter os caminhos de cadastro
- [x] 5.3 Aplicar somente estilos locais/tokens existentes; registrar qualquer alteração compartilhada que tenha sido justificada

## 6. Testes e validação

- [x] 6.1 Estender/atualizar testes da landing cobrindo ordem dos blocos, headline/subheadline, ausência de termos internos e ausência de bloco "Como funciona" duplicado
- [x] 6.2 Cobrir CTAs nos dois modos da flag (off → solicitação; on → Google/email), incluindo transformação, identidade e oferta, e "Entrar" secundário
- [x] 6.3 Cobrir o componente de oferta (condições exibidas, sem promessa de ilimitado, beta fechado não inicia período)
- [x] 6.4 Garantir que nenhum teste/chamada invoca a API de geração
- [x] 6.5 Rodar typecheck, lint, build e a suíte relevante
- [ ] 6.6 Validar manualmente mobile e desktop nos modos flag off/on, sem ativar signup público
- [x] 6.7 Registrar o teste de compreensão: visitante entende o produto após hero e transformação

> **Nota (6.5):** `npx vitest run src/components/landing/__tests__` = **6 arquivos / 35 testes verdes** (cobre ordem/copy, ausência de termos internos, CTAs nos 2 modos em hero/transformação/identidade/oferta, ausência de CTA após a FAQ, seta decorativa, FAQ fechada por padrão, `RevealOnView` — disparo único/reduced-motion/sem `IntersectionObserver` — e a distinção de carregamento hero(`eager`)/demais(`lazy`)); `npm run lint` exit 0. O `typecheck` foi corrigido excluindo a junção `node_modules.*` (`node_modules.shared-link`), que injetava ~5.569 arquivos e produzia erros **espúrios** de `searchParams`; após a exclusão, **resta apenas o erro real pré-existente `ssl`/`pg`** fora da F51.1 (`image-generation-operations-repository.integration.test.ts`) — **nenhum erro na F51.1**. O `build` compila e passa o type/lint do Next, mas **falha na coleta de páginas por env ausente** (`NEXT_PUBLIC_SUPABASE_ANON_KEY`). **O gate completo ainda NÃO está aprovado** (typecheck/build não fecham verdes por causas externas à F51.1).

## 7. Fechamento

- [ ] 7.1 Confirmar aprovação humana dos exemplos finais e da experiência pública (sem exigir geração ou rastreamento end-to-end)
- [ ] 7.2 Reconciliar tracking (STATE/ROADMAP/REQUIREMENTS) no fluxo GSD desta frente, sem sobrescrever a F56 nem artefatos históricos
- [ ] 7.3 Rodar `openspec validate fase-51-1-landing-visual-produto --strict` e registrar o resultado
- [ ] 7.4 Submeter a F51.1 à revisão humana; não antecipar instrumentação de funil, oferta implementada ou SEO (F51.2)
- [ ] 7.5 (Critério de aceite) O bloco de abordagens de divulgação só SHALL permanecer na entrega final se as campanhas demonstrarem diferenças comerciais claras e acrescentarem prova nova; sendo redundantes ou apenas estéticas, reapresentar enxugamento/remoção para aprovação humana
