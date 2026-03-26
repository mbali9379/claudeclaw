# AI Project Governance Baseline

## 1. Scope
This document defines minimum governance requirements for all software projects under this workspace that use AI-assisted development or autonomous/agentic workflows.

## 2. Policy Hierarchy
Policy precedence is enforced in this order:
1. Legal and regulatory obligations
2. Organization-wide security and compliance policy
3. This `GOVERNANCE.md` baseline
4. Repository-level policy (`AGENTS.md`, `SECURITY.md`, local governance addenda)
5. Task-level instructions

Lower-priority policies may tighten controls, but must not weaken higher-priority controls.

## 3. Roles and Accountability
- `Owner`: accountable for system outcomes, risk acceptance, and lifecycle decisions.
- `Maintainer`: responsible for code quality and release readiness.
- `Reviewer`: independent quality and risk control check.
- `Operator`: manages runtime systems and incident response.
- `Agent`: executes bounded tasks under policy constraints.

Each repository must declare current role assignees in machine-readable metadata.

## 4. Risk Tiers and Approval Gates
- `Low`: docs, non-runtime config, refactors with no behavior change.
  - Required: automated checks pass.
- `Medium`: feature changes, dependency updates, infra/config changes.
  - Required: one human reviewer approval + automated checks.
- `High`: auth, payment, secrets handling, production deploy, data model changes, destructive migrations.
  - Required: two human approvals (one owner/maintainer) + change plan + rollback plan + automated checks.

No agent may self-approve `Medium` or `High` risk changes.

## 5. Change Management
Each merged change must include:
- intent and scope
- affected files/services
- risk tier
- test evidence
- rollback approach
- operational impact notes (if any)

Repository PR templates should enforce this structure.

## 6. Identity, Permissions, and Secrets
- All automation identities must be unique and auditable.
- Use least privilege and short-lived credentials where possible.
- Do not store secrets in source control.
- Secret access must be scoped by environment and role.
- High-risk operations must require explicit human authorization.

## 7. Audit and Evidence
Projects must retain traceable records for:
- prompts/instructions used for significant agent actions
- commands and tool calls executed
- code diffs and reviewer decisions
- test and release evidence

Audit records must support post-incident reconstruction.

## 8. Supply Chain and Dependency Controls
- Lockfile required where applicable.
- Dependency updates must be attributable and reviewed.
- License and vulnerability scanning required in CI.
- Build artifacts should be signed/attested where supported.

## 9. Runtime Safety and Guardrails
- Constrain agent execution with explicit allow/deny command policy.
- Restrict network egress to necessary destinations.
- Require human approval for destructive or irreversible actions.
- Maintain a global kill switch for autonomous execution.

## 10. Data Governance
Data must be classified at minimum as:
- `public`
- `internal`
- `restricted`

Restricted data handling requires:
- explicit access controls
- logging
- retention and deletion policy
- redaction/sanitization in prompts and logs

## 11. Model Governance
- Maintain an approved model registry per project.
- Pin model versions for critical workflows.
- Evaluate quality/safety regressions before model upgrades.
- Record model used for high-impact changes.

## 12. Operational Resilience
- Incident response contacts and runbook required.
- Rollback procedures required for production-impacting changes.
- Monitor cost, quota, and anomalous activity.

## 13. Lifecycle Governance
Project statuses:
- `incubating`
- `active`
- `maintenance`
- `archived`

Each status must map to explicit support expectations, ownership, and retention rules.

## 14. Minimum Enforcement
No repository is compliant unless it has:
- this governance baseline (or a stricter local equivalent),
- machine-readable controls (`controls.yaml`),
- a defined owner,
- a working CI check for lint + tests.

