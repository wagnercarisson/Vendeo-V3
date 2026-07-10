---
status: testing
uat_type: manual
phase: 17-edicao-publication-copy
source: 17-01-SUMMARY.md, 17-02-SUMMARY.md
started: "2026-07-10T17:29:29Z"
updated: "2026-07-10T17:29:29Z"
---

## Current Test

number: 2
name: Badge "Editado" quando publication_copy_current existe
expected: |
  Quando a campanha tem publication_copy_current salvo, o badge "Editado" aparece ao lado do título "Kit de Publicação".
awaiting: user response

## Tests

### 1. Visualizar Kit de Publicação
expected: Na página /campanha/[id], o lojista vê a seção "Kit de Publicação" com caption, hashtags (badges azuis) e CTA exibidos em modo visualização.
result: pass
note: CTA não aparece porque está vazio no BD — comportamento esperado (renderização condicional)

### 2. Badge "Editado" quando publication_copy_current existe
expected: Quando a campanha tem publication_copy_current salvo, o badge "Editado" aparece ao lado do título "Kit de Publicação".
result: [pending]

### 3. Entrar em modo edição
expected: Clicar em "✏️ Editar" transforma caption em textarea, hashtags em textarea (uma por linha), CTA em input, e mostra botões Salvar/Restaurar/Cancelar. Os campos são pré-preenchidos com os valores atuais.
result: [pending]

### 4. Salvar edição com sucesso
expected: Preencher novos valores, clicar "💾 Salvar". O PATCH é enviado para /api/campaign/[id]/publication-copy. Após resposta 200, a UI volta ao modo visualização refletindo os novos valores. Badge "Editado" aparece.
result: [pending]

### 5. Restaurar texto original da IA
expected: Clicar "↩️ Restaurar original" abre confirmação. Confirmar envia PATCH com { restore: true }. UI volta ao modo visualização com caption/hashtags/CTA originais da IA. Badge "Editado" some.
result: [pending]

### 6. Cancelar edição
expected: Entrar em modo edição, modificar campos, clicar "Cancelar". A UI volta ao modo visualização com os valores ORIGINAIS (anteriores à edição), descartando as alterações.
result: [pending]

### 7. Estado de loading durante salvamento
expected: Clicar "💾 Salvar" mostra "Salvando..." no botão, desabilita Salvar/Restaurar/Cancelar. Botões voltam ao normal após resposta.
result: [pending]

### 8. Estado de erro no salvamento
expected: Se o PATCH falhar (ex: 400 validation), a UI mostra a mensagem de erro em vermelho e permanece em modo edição — o lojista pode corrigir e tentar novamente.
result: [pending]

## Summary

total: 8
passed: 1
issues: 2
pending: 7
skipped: 0
skipped: 0

## Gaps

- truth: "Campos de edição têm contraste visível (texto legível sobre fundo)"
  status: failed
  reason: "User reported: cor de fundo das caixas de edição está igual a cor do texto (tudo branco) = impossível editar"
  severity: major
  test: 3
  root_cause: "client.tsx textareas/inputs sem classes de cor explícitas — tema dark herda color: white do body, mas inputs não têm bg definido, ficando fundo branco com texto branco"
  artifacts:
    - path: "src/app/campanha/[id]/client.tsx"
      issue: "Campos textarea/input sem bg/text-color classes em tema dark"
  missing:
    - "Adicionar bg-gray-800 text-gray-100 border-gray-600 aos inputs/textarea"
  fix: "✅ Corrigido — bg-gray-800 text-gray-100 border-gray-600 adicionado aos 3 campos"

- truth: "Hashtags com acentos do português são aceitas pela validação"
  status: failed
  reason: "User reported: validation failed (400) ao tentar salvar — hashtag #pãofrancêskg com acentos rejeitada"
  severity: major
  test: 3 (save attempt)
  root_cause: "publication-copy.ts usa regex /^#\\w+$/ onde \\w = [a-zA-Z0-9_] — não aceita caracteres acentuados (ã, ê, ç) comuns em hashtags brasileiras"
  artifacts:
    - path: "src/lib/campaign/publication-copy.ts"
      issue: "Regex /^#\\w+$/ não suporta Unicode (acentos portugueses)"
  missing:
    - "Trocar /^#\\w+$/ por /^#[\\p{L}\\p{N}_]+$/u (Unicode property escapes)"
  fix: "✅ Corrigido — regex atualizada para /^#[\\p{L}\\p{N}_]+$/u"
