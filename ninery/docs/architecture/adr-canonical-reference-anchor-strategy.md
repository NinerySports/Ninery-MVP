# ADR: Canonical Reference Anchor Strategy

Status: accepted

Ticket: #053

## Context

Ticket #052 proved that the 2023 DeMarini The Goods USA 30/20/-10 has strong directional comparative evidence against a verified external 2023 Louisville Slugger Omaha USA 30/19/-11 reference. That evidence can say the DeMarini is directionally different from Omaha. It cannot say where DeMarini belongs on an absolute canonical Equipment DNA scale unless the reference has an approved canonical anchor or another absolute evidence path exists.

The current Omaha reference is a verified external physical comparison instrument. It has no Ninery catalog authority, recommendation authority, or canonical Equipment DNA.

## Decision

Ninery now has a read-only canonical reference anchor strategy under `@ninery/equipment-intelligence`. The strategy defines:

- anchor levels: `not_anchor_eligible`, `provisional_anchor`, `ordinal_anchor`, `numeric_anchor`, `validated_anchor`
- ordinal anchors as distinct from numeric anchors
- circular lineage rejection through `canonicalAnchorSource`, `anchorLineage`, and `anchorDepth` metadata
- bounded canonical interpretation, such as `moderate` to `very_demanding`, when an approved same-attribute anchor exists
- standalone absolute, objective measurement, combined evidence, and reference-onboarding paths
- deterministic next evidence actions

The policy is analytical only. It does not persist `EquipmentDNAAttributeEvaluation` rows, create numeric references, promote DeMarini, onboard Omaha, change recommendations, change Transition v1.1, add public APIs, or add UI.

## Evidence Quality

Catalog presence does not make an anchor. Existing demo bat canonical behavioral values derived from internal seed or legacy mapping are `provisional_anchor` only. They may be useful for review, but they are not approved anchors for DeMarini inference.

Approved ordinal anchors require an active same-attribute canonical value, compatible definition version, sufficient confidence, no material conflict, and non-circular provenance. Numeric anchors additionally require a legitimate numeric reference. Validated anchors require validated-quality evidence, not synthetic fixtures or legacy-derived scores.

## Attribute Policy

`swing_effort` can benefit from objective physical measurement such as swing weight, balance point, or MOI, but still needs an approved mapping before persistence.

`forgiveness` and `sweet_spot_support` require structured contact or barrel-response evidence.

`bat_control_support` is best supported by combined swing/balance evidence and standalone control observations.

All four behavioral attributes require same-attribute anchoring. A forgiveness anchor cannot establish swing effort.

## Omaha Path

Omaha can become an anchor only through a future explicit workflow. It would require catalog or controlled-reference onboarding, exact variant identity, behavioral evaluation, at least two independent evaluations or equivalent trustworthy evidence, and an active canonical ordinal with non-circular provenance. Numeric reference evidence is optional unless a future numeric inference method requires it.

## DeMarini Result

For the current evidence state, DeMarini remains canonical-deferred:

- approved anchors: none
- demo bat candidates: provisional only
- standalone absolute evidence: none
- objective evidence: none
- gate status: `blocked_no_anchor`
- preferred next action: `collect_standalone_evaluation`

## Consequences

The system now has a trustworthy path-selection layer between comparative synthesis and canonical promotion. Strong relative evidence remains valuable, but it cannot silently become an absolute ordinal or 0-100 value.
