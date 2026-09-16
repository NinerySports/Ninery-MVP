# ADR: Standalone Physical Bat Evaluation Mode v1.0

## Status

Accepted for Ticket #048.

## Context

Ticket #047 introduced a structured physical bat protocol built around comparative observations against verified reference bats. The first real target, the 2023 DeMarini The Goods USA 30/20, currently has no suitable verified reference bat physically available. That absence is legitimate and must not force fabricated comparison evidence.

## Decision

Ninery will support two explicit physical evaluation modes:

- `comparative`: target bat plus verified reference bat, using relative observations such as `somewhat_less` or `similar`.
- `standalone`: target bat only, using absolute categorical observations: `very_low`, `low`, `moderate`, `high`, `very_high`, and `unable_to_assess`.

Standalone mode requires `referenceContext.referenceAvailable = false` and a controlled reason such as `no_suitable_verified_reference_available`. Empty references are allowed only in standalone mode with that context. Standalone evidence records preserve mode, reference context, raw observations, trial counts, limitations, and session ID in provenance.

## Trial Policy

Standalone dry-swing attributes require at least 8 dry-swing trials. Forgiveness and sweet-spot support require at least 8 contact trials and cannot be inferred from dry swings. No standalone session creates 0-100 numeric references.

## Confidence

A single standalone session is useful but bounded. It normally emits ordinal-only, estimated confidence evidence until corroborated by independent sessions, comparative evaluation, objective measurement, or other approved evidence.

## Consequences

The DeMarini is ready for a standalone structured physical evaluation even without a verified reference bat. It remains behaviorally incomplete, not canonical-ready, not genuine-study ready, and blocked from live recommendation activation until real observations are collected and reviewed.
