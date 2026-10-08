# Tasks — F51.1 Landing visual de produto

> **Checkpoint humano obrigatório antes da implementação:** aprovar composição visual, copy e função das imagens (design D9). Sem ativação de flags, deploy ou alteração de contratos compartilhados.

## 1. Candidata, teste de compreensão e checkpoint

- [ ] 1.1 Produzir a candidata da composição visual (mobile e desktop), a copy e o mapa/função das imagens (hero=qualidade; transformação=simplicidade; variações=flexibilidade; identidade=coerência), usando placeholders quando necessário
- [ ] 1.2 Registrar o teste de compreensão: verificar que o visitante entende o produto após hero e transformação
- [ ] 1.3 Apresentar a candidata ao responsável e obter aprovação de composição, copy e função das imagens antes de implementar
- [ ] 1.4 Registrar a fronteira de arquivos (src/app/page.tsx, src/components/landing/*, assets, testes) e justificar previamente qualquer necessidade de tocar layout global, globals.css, design system ou dependências
- [ ] 1.5 Confirmar que nenhuma campanha interna (`briefing`, `intenção`, `F56`) ou formato fora do escopo aparecerá no conteúdo público

## 2. Estrutura e narrativa da página

- [ ] 2.1 Reestruturar `src/app/page.tsx` com os blocos na ordem: hero, transformação, variações, identidade e controle, oferta, FAQ/CTA final/rodapé
- [ ] 2.2 Implementar o hero com promessa, campanha protagonista e CTA, garantindo mensagem e CTA visíveis no mobile
- [ ] 2.3 Implementar o bloco de transformação (informações preenchidas → campanha conferida → download), absorvendo "Como funciona" sem bloco duplicado
- [ ] 2.4 Implementar o bloco de variações ("Escolha como apresentar seu produto." / "Estúdio, ambientado ou mantendo o fundo original.") com oferta/destaque/exclusivo nos exemplos
- [ ] 2.5 Implementar o bloco compacto de identidade e controle, sustentado por exemplos, deixando claro que o usuário confere e decide o que publicar
- [ ] 2.6 Mover "Novidades" para posição secundária/rodapé e montar FAQ + CTA final + rodapé legal

## 3. Imagens e assets

- [ ] 3.1 Criar/ajustar os componentes de imagem com proporções estáveis e placeholders substituíveis sem refazer layout
- [ ] 3.2 Remover imagens sem função de prova; garantir que apenas campanhas protagonizam e que interface/texto são apoio
- [ ] 3.3 Selecionar no app/laboratório (sem geração paga) e submeter os exemplos finais à aprovação humana
- [ ] 3.4 Substituir placeholders pelos exemplos aprovados, sem fabricar depoimentos, resultados comerciais ou provas de identidade

## 4. Oferta e controles de acesso

- [ ] 4.1 Criar componente independente da oferta com a mensagem principal curta "Experimente o Vendeo em sua loja: 28 dias gratuitos e até 20 créditos." e a mecânica (início após onboarding, 5 + 5 nos dias 7/14/21, acúmulo, máximo 20, vencimento do gratuito restante) obrigatoriamente em informação secundária/FAQ
- [ ] 4.2 Garantir que a oferta não promete 20 campanhas/uso ilimitado e que, no beta fechado, solicitar acesso não inicia o período
- [ ] 4.3 Reutilizar `publicSignupEnabled`/`getLaunchConfig()` em todos os CTAs de aquisição (hero, oferta, final), mantendo "Entrar" como ação secundária
- [ ] 4.4 Preservar o formulário de solicitação e o contrato do `POST /api/access-requests` (flag off) e os caminhos de cadastro existentes (flag on)

## 5. Acessibilidade e preservação

- [ ] 5.1 Manter hierarquia de headings, landmarks, foco visível e alvos de toque ≥ 44px
- [ ] 5.2 Preservar links legais (`/termos`, `/privacidade`, `/uso-aceitavel`, Contato); com a chave fechada, manter o formulário presente com estados de envio/sucesso/erro; com a chave aberta, ocultar o formulário e manter os caminhos de cadastro
- [ ] 5.3 Aplicar somente estilos locais/tokens existentes; registrar qualquer alteração compartilhada que tenha sido justificada

## 6. Testes e validação

- [ ] 6.1 Estender/atualizar testes da landing cobrindo ordem dos blocos, headline/subheadline, ausência de termos internos e ausência de bloco "Como funciona" duplicado
- [ ] 6.2 Cobrir CTAs nos dois modos da flag (off → solicitação; on → Google/email), incluindo oferta e final, e "Entrar" secundário
- [ ] 6.3 Cobrir o componente de oferta (condições exibidas, sem promessa de ilimitado, beta fechado não inicia período)
- [ ] 6.4 Garantir que nenhum teste/chamada invoca a API de geração
- [ ] 6.5 Rodar typecheck, lint, build e a suíte relevante
- [ ] 6.6 Validar manualmente mobile e desktop nos modos flag off/on, sem ativar signup público
- [ ] 6.7 Registrar o teste de compreensão: visitante entende o produto após hero e transformação

## 7. Fechamento

- [ ] 7.1 Confirmar aprovação humana dos exemplos finais e da experiência pública (sem exigir geração ou rastreamento end-to-end)
- [ ] 7.2 Reconciliar tracking (STATE/ROADMAP/REQUIREMENTS) no fluxo GSD desta frente, sem sobrescrever a F56 nem artefatos históricos
- [ ] 7.3 Rodar `openspec validate fase-51-1-landing-visual-produto --strict` e registrar o resultado
- [ ] 7.4 Submeter a F51.1 à revisão humana; não antecipar instrumentação de funil, oferta implementada ou SEO (F51.2)
