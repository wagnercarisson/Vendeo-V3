## ADDED Requirements

### Requirement: SMTP Hostinger configured for UAT

The system SHALL have SMTP Hostinger configured in the Supabase Dashboard for the UAT preview environment.

- SMTP Host: `smtp.hostinger.com`
- SMTP Port: `465` (SSL/TLS)
- Username: full sender email address
- Password: email account password
- SPF, DKIM and DMARC SHALL be verified in the sender domain's DNS
- SMTP SHALL be configured per Supabase project (dev and production have independent settings)
- Daily sending limit of the Hostinger Business plan SHALL be verified (1,000 or 3,000 messages/day)

#### Scenario: SMTP delivers confirmation email

- **WHEN** a user signs up in the UAT environment
- **THEN** the confirmation email SHALL be delivered to the user's inbox via SMTP Hostinger

#### Scenario: SMTP delivers recovery email

- **WHEN** a user requests password reset in the UAT environment
- **THEN** the recovery email SHALL be delivered to the user's inbox via SMTP Hostinger

### Requirement: Vercel Preview for UAT

The system SHALL have a Vercel Preview Deployment for closed UAT of the email confirmation flows.

- Preview Deployment SHALL have Standard Protection enabled (Vercel Deployment Protection)
- Access restricted to authorized testers via Vercel account or shareable link
- `NEXT_PUBLIC_SITE_URL` of the Preview environment SHALL be set to the Preview URL
- Preview URL SHALL be registered in Supabase Dashboard Redirect URLs
- Email confirmation SHALL be enabled in the UAT Supabase project
- SMTP Hostinger SHALL be active in the UAT Supabase project

#### Scenario: Protected preview accessible by tester

- **WHEN** an authorized tester navigates to the Preview URL
- **THEN** the Vendeo application SHALL load (Deployment Protection passes for authorized users)

#### Scenario: Signup link points back to same preview

- **WHEN** a tester signs up via the Preview URL
- **THEN** the confirmation link in the email SHALL point to the same Preview URL (not production or localhost)

#### Scenario: Recovery link points back to same preview

- **WHEN** a tester requests password reset via the Preview URL
- **THEN** the recovery link in the email SHALL point to the same Preview URL with `next=/update-password`

### Requirement: Email deliverability verified

The sent emails (signup confirmation and password recovery) SHALL be tested for deliverability and spam classification.

- SHALL be tested with Gmail inbox
- SHALL be tested with Outlook inbox
- SHALL land in the primary inbox (not spam folder) for both providers

#### Scenario: Confirmation email not flagged as spam in Gmail

- **WHEN** a confirmation email is sent via SMTP Hostinger
- **THEN** it SHALL arrive in Gmail's primary inbox (not spam)

#### Scenario: Confirmation email not flagged as spam in Outlook

- **WHEN** a confirmation email is sent via SMTP Hostinger
- **THEN** it SHALL arrive in Outlook's primary inbox (not spam)

#### Scenario: Recovery email not flagged as spam in Gmail

- **WHEN** a recovery email is sent via SMTP Hostinger
- **THEN** it SHALL arrive in Gmail's primary inbox (not spam)

#### Scenario: Recovery email not flagged as spam in Outlook

- **WHEN** a recovery email is sent via SMTP Hostinger
- **THEN** it SHALL arrive in Outlook's primary inbox (not spam)
