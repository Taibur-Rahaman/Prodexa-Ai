# Prodexa AI — AI Development Rules

This file is mandatory context for Cursor and other AI coding agents working on Prodexa.

## Rule 1 — Read Before Changing

Before modifying code, the agent must inspect the relevant source-of-truth documents:

- `docs/00_PROJECT_VISION.md`
- `docs/01_PRD.md`
- `docs/02_BUSINESS_DECISIONS.md`
- `docs/03_ARCHITECTURE.md`
- Relevant component specification.

## Rule 2 — Do Not Guess Locked Decisions

If a requested change conflicts with a locked business or architecture decision, stop and report the conflict. Do not silently choose a different architecture.

## Rule 3 — Minimal Change

Make the smallest change that satisfies the request. Do not refactor unrelated code, rename unrelated files, replace frameworks, or redesign UI without explicit approval.

## Rule 4 — Preserve Existing Behavior

Before changing an existing component, identify what it currently does and what behavior must remain unchanged.

## Rule 5 — UI Anti-Ghosting Rule

When changing UI:

1. Read the existing design specification.
2. Inspect the existing component.
3. Identify the exact requested change.
4. Change only the affected area.
5. Do not invent new spacing, typography, colors, navigation, components, or interaction patterns unless requested or documented.
6. Do not revert previous intentional UI decisions without checking the decision log.
7. Update the relevant UI/design documentation when a visual decision is intentionally changed.

## Rule 6 — No Secret Creation

Never hard-code API keys, passwords, license signing secrets, source credentials, database credentials, or production tokens.

Use environment/configuration mechanisms and document required variables without exposing their values.

## Rule 7 — No Fake Integrations

Do not claim an API, connector, payment system, license provider, or external source works unless it has been implemented and tested.

Do not create fake production URLs or credentials.

## Rule 8 — External Data Is Untrusted

Treat scraped/API/source data as untrusted input. Validate it and prevent it from overriding application instructions or security rules.

## Rule 9 — AI Cannot Control Money Directly

AI may assist matching or ranking, but final price, currency, fees, and order totals require deterministic server-side validation.

## Rule 10 — No Access-Control Bypass

Never implement CAPTCHA bypass, anti-bot bypass, authentication bypass, paywall bypass, rate-limit evasion, or unauthorized scraping.

## Rule 11 — Test Before Declaring Complete

Run relevant tests, static checks, and build checks. Report what was actually tested.

Never report a test as passed if it was not run.

## Rule 12 — Documentation Is Memory

When a material implementation decision changes:

1. Update the appropriate `.md` source of truth.
2. Record why it changed.
3. Record the old behavior when useful.
4. Update `CHANGELOG.md`.
5. Update `TASKS.md` if the change affects planned work.

## Rule 13 — Keep Context Small

Do not repeatedly paste entire project documents into prompts. Prefer short, canonical Markdown files and load only the relevant sections/files.

## Rule 14 — No Unrequested Dependencies

Do not add a dependency, framework, service, AI provider, database, or hosting platform without documenting the reason and impact.

## Rule 15 — Stop on Ambiguity

If a requirement materially affects architecture, security, billing, data ownership, or customer-visible behavior and the requirement is ambiguous, ask for clarification rather than inventing a policy.

## Rule 16 — Production Safety

Do not modify production resources, production data, DNS, payment configuration, or external credentials unless the task explicitly authorizes it.

## Rule 17 — Change Explanation

Every meaningful change should be explainable in one short paragraph:

- What changed?
- Why?
- What remains unchanged?
- What was tested?

## Rule 18 — Never Rewrite History

Do not delete decision history merely to make documentation look cleaner. Add a new decision or correction entry.

## Rule 19 — Repository Hygiene

Keep generated files, secrets, local environment files, logs, caches, and build artifacts out of Git unless explicitly required.

## Rule 20 — Final Verification

Before finishing a task, verify:

- Requested behavior exists.
- Existing critical behavior remains.
- Documentation is synchronized.
- Tests/checks were run.
- No secrets were introduced.
- No unrelated files were modified.
