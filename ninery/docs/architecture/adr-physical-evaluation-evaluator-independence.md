# Physical Evaluation Evaluator Independence

## Decision

Ninery distinguishes physical sessions from independent evaluator sources. The first qualifying physical session by an evaluator for an equipment item is `independent_evaluator`; every later qualifying session by that evaluator for the same equipment is `repeat_evaluator`, even when the protocol version changes.

`SESSION COUNT != INDEPENDENT SOURCE COUNT`

For four sessions performed by evaluators A, B, C, and A, the system reports four sessions, three unique evaluators, three independent evaluator sources, and one repeat-evaluator session.

## Provenance

Protocol v1.1 stores the declared relationship in raw evidence provenance beside the stable evaluator ID, session ID, and protocol version. Prepare and commit derive the expected relationship from existing evidence and block a mismatch. A returning person must retain the same evaluator ID.

Protocol v1.0 evidence is never updated. Its evaluator, session, and protocol identity are read to derive relationship classifications at report time. Dimension-level evidence records are grouped into physical sessions before counts are calculated.

## Calibration Firewall

Repeat sessions remain distinct evidence and support within-evaluator protocol comparison, repeatability analysis, and construct refinement. They do not increase independent-source counts and cannot create canonical ordinals, numeric references, recommendation inputs, ranking changes, or transition activation.

## Operations

- Generate a packet shape with `pnpm equipment:physical-evaluation:protocol-v1-1-session-template`.
- Validate relationship and packet contents with `pnpm equipment:physical-evaluation:protocol-v1-1-prepare -- --file=<file>`.
- Inspect evidence structure with `pnpm equipment:physical-evaluation:evidence-independence -- --equipment=<id>`.
- Commit only genuine observations with the established `--confirm` command.

No Prisma schema change or historical backfill is required because existing evidence rows already preserve evaluator reference, session identity, protocol version, and raw provenance.
