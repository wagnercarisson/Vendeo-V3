## MODIFIED Requirements

### Requirement: CTA da landing conforme a flag

A landing pública (`src/app/page.tsx` + `src/components/landing/*`) SHALL apresentar **todos** os CTAs de aquisição — inclusive os dos blocos de oferta e final, além do hero — conforme `VENDEO_PUBLIC_SIGNUP_ENABLED` — D4/D5:

- **Flag on:** CTA principal "Continuar com Google" (→ `signInWithOAuth('google')`) + CTA secundário "Continuar com email" (→ `/signup`).
- **Flag off (estado atual):** "Solicitar acesso free" + formulário de solicitação, comportamento idêntico ao atual.
- A flag SHALL ser lida **server-side** na rota/página que controla (não só no cliente) e reutilizada em todos os CTAs de aquisição.
- O contrato do `POST /api/access-requests` e o formulário de solicitação SHALL permanecer inalterados.
- "Entrar" SHALL ser ação secundária destinada a quem já possui conta, nunca a ação universal de aquisição.

#### Scenario: Flag on renderiza CTAs de signup

- **WHEN** `VENDEO_PUBLIC_SIGNUP_ENABLED=true` está configurado
- **THEN** a landing exibe "Continuar com Google" (principal) e "Continuar com email" (secundário)

#### Scenario: Flag off preserva solicitação de acesso

- **WHEN** `VENDEO_PUBLIC_SIGNUP_ENABLED` está desligado (default)
- **THEN** a landing exibe "Solicitar acesso free" + formulário de solicitação (comportamento atual idêntico)

#### Scenario: CTAs de oferta e final respeitam a flag

- **WHEN** a landing renovada é renderizada
- **THEN** os CTAs de aquisição do hero, da oferta e do bloco final obedecem ao mesmo modo da flag
- **AND** o contrato do `POST /api/access-requests` permanece inalterado
