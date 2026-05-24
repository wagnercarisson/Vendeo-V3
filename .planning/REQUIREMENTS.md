# Requirements: Vendeo V3

**Defined:** 2026-05-24
**Core Value:** Gerar uma campanha profissional de Produto + Oferta que o lojista tenha confiança de publicar e que ajude a vender mais.

## v1 Requirements

Requirements for initial release. Each maps to roadmap phases.

### Campaign Input

- [ ] **INPT-01**: User can enter product name, price/offer, and short description
- [ ] **INPT-02**: User can upload a product image
- [ ] **INPT-03**: User can provide/store minimal store info (name, segment/subsegment)
- [ ] **INPT-04**: User can set basic visual identity (colors, logo, name style)

### AI Intelligence

- [ ] **AI-01**: AI interprets product/offer/store context and generates structured campaign specification
- [ ] **AI-02**: AI generates commercial copy (title, subtitle, CTA) tailored to product and offer
- [ ] **AI-03**: AI output includes visual parameters: palette, hierarchy, layout direction, badge style
- [ ] **AI-04**: AI provider abstraction layer allows swapping between OpenAI/Anthropic
- [ ] **AI-05**: AI output is structured JSON, validated before rendering

### Visual Rendering

- [ ] **REND-01**: Programmatic renderer composes final image from structured spec (HTML/CSS/SVG/Canvas)
- [ ] **REND-02**: Template system provides safe, professional layout variations for Produto + Oferta
- [ ] **REND-03**: Store identity tokens (name, logo, colors, fonts) applied to campaign
- [ ] **REND-04**: Campaign maintains minimum visual quality (hierarchy, readability, contrast, balance)
- [ ] **REND-05**: Identity fallback: name-based identity with safe defaults when logo/colors not provided

### Review & Export

- [ ] **REVW-01**: User can preview generated campaign before export
- [ ] **REVW-02**: Guided adjustments: palette, font style, badge style/position, layout variation
- [ ] **REVW-03**: User can regenerate campaign with adjusted parameters
- [ ] **REVW-04**: Campaign exportable as PNG/JPG for social media posting

### Design Constraints

- [ ] **DSGN-01**: No free-form visual editor — adjustments via predefined controls and presets only
- [ ] **DSGN-02**: UI/UX Pro Max used for design exploration, not as runtime rendering dependency
- [ ] **DSGN-03**: Campaign composition rules derived from Vendeo's own templates and tokens
- [ ] **DSGN-04**: V1 scope guardrail — focused solely on Produto + Oferta campaign core; auth, dashboard, plans, analytics, multi-format, and full SaaS structure excluded

## v2 Requirements

Deferred to future release. Tracked but not in current roadmap.

### Campaign Input

- **INPT-05**: AI-assisted field completion and suggestions

### Future Capabilities

- **AUTH-01**: User authentication (email/password, session management)
- **DASH-01**: Dashboard with campaign history and store overview
- **DASH-02**: Navigation menus and full SaaS layout
- **PLAN-01**: Weekly campaign plan and smart calendar
- **PLAN-02**: Automated posting schedule
- **ANAL-01**: Analytics and conversion metrics
- **ANAL-02**: Campaign performance learning and recommendations
- **BILL-01**: Subscription plans (Free, Basic, Premium)
- **CAMP-02**: Multiple campaign types (services, informative, seasonal)
- **CAMP-03**: Reels and video generation
- **CAMP-04**: Multi-format export variants

## Out of Scope

Explicitly excluded. Documented to prevent scope creep.

| Feature | Reason |
|---------|--------|
| Free-form visual editor | Product must be guided, not a Canva clone |
| Auth/login | Core validation first, SaaS later |
| Dashboard | Not needed before core campaign validation |
| Weekly plan / smart calendar | Phase 5+ capability |
| Analytics | Phase 6+ capability |
| Billing / plans | Usage free during validation |
| Reels / video | High complexity, not in core scope |
| Multiple campaign types | Focus on Produto + Oferta validation |
| Multiple stores / team | Enterprise features, future phases |
| AI image generation (DALL-E, etc) | Reduces text control, consistency, and predictability |

## Traceability

Which phases cover which requirements. Updated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| INPT-01 | | Pending |
| INPT-02 | | Pending |
| INPT-03 | | Pending |
| INPT-04 | | Pending |
| AI-01 | | Pending |
| AI-02 | | Pending |
| AI-03 | | Pending |
| AI-04 | | Pending |
| AI-05 | | Pending |
| REND-01 | | Pending |
| REND-02 | | Pending |
| REND-03 | | Pending |
| REND-04 | | Pending |
| REND-05 | | Pending |
| REVW-01 | | Pending |
| REVW-02 | | Pending |
| REVW-03 | | Pending |
| REVW-04 | | Pending |
| DSGN-01 | | Pending |
| DSGN-02 | | Pending |
| DSGN-03 | | Pending |

**Coverage:**
- v1 requirements: 22 total
- Mapped to phases: 0
- Unmapped: 22 ⚠️

---
*Requirements defined: 2026-05-24*
*Last updated: 2026-05-24 after initial definition*
