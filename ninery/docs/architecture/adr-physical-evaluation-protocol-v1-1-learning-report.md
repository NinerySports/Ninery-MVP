# Protocol v1.1 Calibration Learning Report

## Status

Accepted for Ticket #061 as a development-only, read-only diagnostic.

## Decision

Ninery analyzes Protocol v1.1 calibration observations through a pure Equipment Intelligence service. The database CLI loads active structured physical evidence and passes immutable snapshots to that service. The service has no repository or persistence dependency.

The report separates four construct areas: swing demand, bat control, forgiveness, and sweet spot. Sweet Spot Breadth and Sweet Spot Response Quality remain candidate subconstructs. `response_degradation` retains inverse semantics: higher degradation means less forgiveness.

Protocol v1.0 rows retain their original meaning. A repeat evaluator's v1.0 and v1.1 sessions may be compared descriptively, but the comparison is explicitly noncausal and contributes no additional independent source. Results from one equipment model cannot be generalized across equipment archetypes.

## Safety Boundary

The report performs no writes and cannot create or modify canonical evaluations, numeric references, registry attributes, live Equipment DNA, recommendation scores, or rankings. It reports weaknesses and future evidence needs without manufacturing an evaluator, evaluation, or validation claim.

## Commands

```cmd
pnpm equipment:physical-evaluation:protocol-v1-1-learning-report -- --equipment=<id>
pnpm equipment:physical-evaluation:protocol-v1-1-learning-report-validation
```
