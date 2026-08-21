# Prodexa AI — Project Constitution

This document contains non-negotiable engineering rules for Prodexa AI. AI coding agents must read it before making material changes.

## 1. Source of Truth

Canonical product and architecture decisions live in `docs/`. Do not silently contradict them.

## 2. Product Boundary

Prodexa is a hosted discovery and commerce-assistance platform. WordPress/WooCommerce is a client/integration layer; the hosted backend remains authoritative for discovery orchestration, licensing, usage, and protected business logic.

## 3. Backend Domain

`prodexaai.cloud` is the canonical backend/infrastructure domain.

Do not assume subdomains such as `api.prodexaai.cloud` exist. Verify them before use or creation.

## 4. Infrastructure

Hostinger is an available infrastructure provider controlled through Hostinger MCP. Inspect before changing. Never guess DNS, server, deployment, or credential state.

Destructive infrastructure actions require explicit human authorization.

## 5. Security

Never commit or expose passwords, API keys, tokens, signing secrets, private keys, or real environment credentials.

Never bypass authentication, authorization, CAPTCHAs, paywalls, anti-bot controls, rate limits, or source access controls.

## 6. AI Boundary

AI is assistive, not authoritative, for financial values, license authorization, payment totals, security decisions, and source permissions.

## 7. Tenant Isolation

All tenant-sensitive operations must enforce explicit tenant authorization. Cross-tenant access is prohibited.

## 8. Change Discipline

Make the smallest complete change. Do not rewrite unrelated code or introduce dependencies/services without justification.

If a change conflicts with a locked business decision, stop and document the conflict instead of silently overriding it.

## 9. Verification

No task is complete without appropriate tests/checks and a concise statement of what was actually verified.

## 10. Documentation

Material changes to product behavior, architecture, security, infrastructure, APIs, plugins, or business decisions must update the relevant source-of-truth documentation.

## 11. Autonomous Loop

The engineering loop is:

`INSPECT → AUDIT → PRIORITIZE → PLAN → IMPLEMENT → TEST → REVIEW → DOCUMENT → HANDOFF`

After a safe completed loop, provide the compact `PRODEXA_LOOP_HANDOFF` format defined by the project workflow. Do not produce verbose logs.
