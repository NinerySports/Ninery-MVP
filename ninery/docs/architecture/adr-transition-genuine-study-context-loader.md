# ADR: Genuine Transition Study Context Loader

## Status

Accepted for Ticket #043.

## Context

Genuine Transition Compatibility studies previously required an operator to provide a manually authored `TransitionCompatibilityInput` JSON file at prediction capture time. That was useful for early testing, but it created avoidable operator risk because Player DNA, current equipment, proposed equipment, canonical Equipment DNA, and familiarity already exist in persisted Ninery records.

## Decision

Ticket #043 adds a service-and-CLI-only context loader that assembles the v1.1 prediction input from persisted study context by default. The loader resolves:

- the genuine transition study record
- real player identity
- latest non-archived Player DNA
- current and proposed equipment plus selected variants
- canonical Equipment DNA active evaluations
- current-equipment familiarity
- provenance and audit event references

The normal capture command is:

```powershell
pnpm transition:genuine-study:capture-prediction -- --study=<study-id> --actor=transition-operator --confirm
```

Manual compatibility-input JSON remains available only as an explicit development override:

```powershell
pnpm transition:genuine-study:capture-prediction -- --study=<study-id> --actor=transition-operator --file=path/to/input.json --manual-input-override
```

## Guardrails

- No public API or web UI is added.
- No Prisma migration is required.
- No model calibration or promotion is performed.
- Existing Transition Compatibility v1.1 scoring remains unchanged.
- Missing context produces explicit blocker codes.
- The loader reports a deterministic semantic input hash and supports drift diagnostics.

## Consequences

Operators can preview prediction input readiness, provenance, dry-run output, and context drift without hand-building a compatibility file. Captured predictions still use the existing audited admin workflow and remain prospective-only.
