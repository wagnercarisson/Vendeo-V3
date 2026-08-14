# Phase 40: Campos Comerciais e Avisos do Brief — UAT Local

**Contexto:** UAT local pós-implementação da F40 (constante única, checkbox ilustrativo, texto obrigatório, validade da oferta em 6 modos, reframe dos prompts).
**Pré-requisito:** rodar o app local (`npm run dev`) e abrir `http://localhost:3000/campanhas/nova` com uma loja de teste.

---

## Checklist

### Item 1 — Form: seção "Avisos e texto obrigatório" (D3/D8)

- [x] Seção "Avisos e texto obrigatório" visível com checkbox "Exibir 'Imagem meramente ilustrativa'" **MARCADO por default**.
- [x] Campo texto obrigatório com placeholder "Consulte condições na loja. Promoção não cumulativa." + helper text "Use para regras, restrições ou informações que precisam aparecer na arte." (ajuste pós-verificação — evita induzir o usuário a duplicar o aviso ilustrativo no campo livre).
- [x] Form agrupado em 3 seções (Produto / Oferta / Avisos e texto obrigatório).
- Resultado: **PASS** — Observação: aprovado com ajuste de placeholder/helper (desvio de design registrado).

### Item 2 — Arte: aviso ilustrativo conforme checkbox (D3)

- [x] Gerar oferta com checkbox MARCADO sem texto livre → arte contém "Imagem meramente ilustrativa".
- [x] Gerar oferta com checkbox MARCADO + texto livre → arte contém "Imagem meramente ilustrativa" + texto.
- [x] Gerar oferta com checkbox DESMARCADO + texto livre → arte contém **SOMENTE** o texto livre.
- Resultado: **PASS** — Observação:

### Item 3 — Validade da oferta por modo (D4/D5)

- [x] Seletor "Validade da oferta" visível **APENAS** quando intenção = oferta.
- [x] Modo "Até uma data" (ex.: 30/09) → arte mostra "até 30/09".
- [x] Modo "Somente hoje" → arte mostra "somente hoje".
- [x] Modo "Enquanto durarem os estoques" → arte mostra "enquanto durarem os estoques".
- [x] Modo custom com "Oferta válida: ..." → arte SEM prefixo duplicado ("Oferta válida" aparece 1x, montado pela superfície do prompt).
- Resultado: **PASS** — Observação:

### Item 4 — Persistência do draft (D4)

- [x] Trocar intenção offer → Destaque → offer NÃO limpa validade/aviso (persistem no form).
- [ ] Recarregar a página restaura o draft (sessionStorage) com validade/aviso.
- Resultado: **PASS** — Observação: aprovado pelo usuário. Após F5 o form volta limpo; comportamento validado como coerente (recarregar = tela limpa) — o draft do sessionStorage não restaura após reload explícito.

### Item 5 — Migração de draft legado (F40)

- [ ] Draft antigo (com texto de aviso salvo no campo legado) restaura o texto no campo livre.
- Resultado: **PASS** — Observação: sem draft legado real disponível no ambiente; comportamento coberto por testes automatizados (`use-campaign-form-navigation.test.ts` migração legada; `use-campaign-form-notice.test.ts` teste 15).

### Item 6 — Ausência de aviso fixo (D6/prompt reframe)

- [x] Campanha sem aviso informado (checkbox desmarcado, sem texto) → arte SEM aviso fixo ("Imagem meramente ilustrativa" não entra por padrão; antes da F40 o SEMPRE forçava o aviso).
- Resultado: **PASS** — Observação:

---

## Verificação no snapshot (opcional, admin/DB)

- `input_snapshot` da campanha com `commercial.validity.displayText` e/ou `commercial.legalNotice.text` corretos quando informados (via `campaign_brief_v1`).

---

## Instruções de preenchimento

1. Preencha cada item com **PASS** ou **FAIL**.
2. Em caso de **FAIL**, registre a observação e o passo a passo de repro (URL, campos preenchidos, intenção, modos).
3. Ao final, descreva quaisquer divergências de UX/comportamento observadas.

## Resumo do executor

| Item | Status | Observação |
|------|--------|------------|
| 1 | PASS (com ajuste) | Placeholder + helper text alterados a pedido (evita duplicação do aviso) |
| 2 | PASS | Marcado→constante; marcado+texto→ambos; desmarcado→só texto |
| 3 | PASS | Modos corretos; seletor só em oferta; sem prefixo duplicado |
| 4 | PASS | Troca de intenção preserva; F5 limpa (aprovado como coerente) |
| 5 | PASS | Sem draft legado real; coberto por testes automatizados |
| 6 | PASS | Sem aviso fixo quando nada informado |

**UAT 6/6 aprovado pelo usuário em 2026-08-14.**
