# Phase 40: Campos Comerciais e Avisos do Brief — UAT Local

**Contexto:** UAT local pós-implementação da F40 (constante única, checkbox ilustrativo, texto obrigatório, validade da oferta em 6 modos, reframe dos prompts).
**Pré-requisito:** rodar o app local (`npm run dev`) e abrir `http://localhost:3000/campanhas/nova` com uma loja de teste.

---

## Checklist

### Item 1 — Form: seção "Avisos e texto obrigatório" (D3/D8)

- [ ] Seção "Avisos e texto obrigatório" visível com checkbox "Exibir 'Imagem meramente ilustrativa'" **MARCADO por default**.
- [ ] Campo texto obrigatório com placeholder "Ex: Imagem meramente ilustrativa" (singular).
- [ ] Resultado: **PASS/FAIL** — Observação:

### Item 2 — Arte: aviso ilustrativo conforme checkbox (D3)

- [ ] Gerar oferta com checkbox MARCADO sem texto livre → arte contém "Imagem meramente ilustrativa".
- [ ] Gerar oferta com checkbox MARCADO + texto livre → arte contém "Imagem meramente ilustrativa" + texto.
- [ ] Gerar oferta com checkbox DESMARCADO + texto livre → arte contém **SOMENTE** o texto livre.
- [ ] Resultado: **PASS/FAIL** — Observação:

### Item 3 — Validade da oferta por modo (D4/D5)

- [ ] Seletor "Validade da oferta" visível **APENAS** quando intenção = oferta.
- [ ] Modo "Até uma data" (ex.: 30/09) → arte mostra "até 30/09".
- [ ] Modo "Somente hoje" → arte mostra "somente hoje".
- [ ] Modo "Enquanto durarem os estoques" → arte mostra "enquanto durarem os estoques".
- [ ] Modo custom com "Oferta válida: ..." → arte SEM prefixo duplicado ("Oferta válida" aparece 1x, montado pela superfície do prompt).
- [ ] Resultado: **PASS/FAIL** — Observação:

### Item 4 — Persistência do draft (D4)

- [ ] Trocar intenção offer → spotlight → offer NÃO limpa validade/aviso.
- [ ] Recarregar a página restaura o draft (sessionStorage) com validade/aviso.
- [ ] Resultado: **PASS/FAIL** — Observação:

### Item 5 — Migração de draft legado (F40)

- [ ] Draft antigo (com texto de aviso salvo no campo legado) restaura o texto no campo livre.
- [ ] Resultado: **PASS/FAIL** — Observação:

### Item 6 — Ausência de aviso fixo (D6/prompt reframe)

- [ ] Campanha sem aviso informado (checkbox desmarcado, sem texto) → arte SEM aviso fixo ("Imagem meramente ilustrativa" não entra por padrão; antes da F40 o SEMPRE forçava o aviso).
- [ ] Resultado: **PASS/FAIL** — Observação:

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
| 1 | PENDENTE | — |
| 2 | PENDENTE | — |
| 3 | PENDENTE | — |
| 4 | PENDENTE | — |
| 5 | PENDENTE | — |
| 6 | PENDENTE | — |
