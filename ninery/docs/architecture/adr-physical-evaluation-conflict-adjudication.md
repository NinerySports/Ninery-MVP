Status: accepted for internal tooling

Ticket #056 adds Physical Evaluation Conflict Resolution and Adjudication Protocol v1.0.

## Context

Ninery now has multiple independent standalone physical evaluations for the 2023 DeMarini The Goods. Some attributes show genuine disagreement. Earlier standalone synthesis correctly blocks promotion when ordinals disagree materially, but operators need to know what kind of conflict exists and what evidence to collect next.

## Decision

Conflict analysis is a read-only policy layer. It analyzes standalone evidence at both the derived-ordinal level and raw rubric-dimension level. It classifies disagreement, identifies target dimensions, and produces an adjudication plan. It does not create canonical evaluations, numeric references, migrations, recommendation inputs, API changes, or UI changes.

## Why Disagreement Is Preserved

Evaluator disagreement is evidence. Majority vote is insufficient because a material outlier can reveal protocol sensitivity, construct ambiguity, or a real bat behavior that only appears under certain contact or swing conditions. Values such as `low`, `low`, and `very_high` must not be averaged into `moderate` or promoted through a 2-of-3 rule.

## Dimension-Level Evidence

The protocol inspects preserved raw dimensions, evaluator identity, session identity, ordinal value, evaluator confidence, limitations, mode, and provenance. This distinguishes whole-attribute disagreement from dimension-specific disagreement.

`response_degradation` is inverse-direction for forgiveness: higher raw degradation means lower forgiveness support. Conflict analysis normalizes that dimension before comparing sources.

## Targeted Adjudication

The next step is not automatically "another evaluator." The report prescribes targeted adjudicating evidence: disputed dimensions, minimum dry-swing/contact trials, controls, and success criteria. Comparative Omaha evidence may shape the protocol as contextual corroboration, but remains non-dispositive because Omaha is not an approved canonical anchor.

## Evaluator Blinding

Prior evaluator ordinals, raw observations, comparative synthesis, and current canonical candidates are hidden before evaluation. Bat identity may be known because physical identity must be verified. Reference bat identity may be known only when reference comparison is intentionally part of the protocol.

## Construct Conflation

Sweet-spot support can show internal divergence between `usable_contact_region` and response-consistency dimensions. A narrow usable contact region with highly consistent response inside that region may indicate possible construct conflation. Ticket #056 flags that for future review but does not split the Equipment DNA registry.

## Canonical Promotion Boundary

Conflict analysis may report a resolution candidate when no adjudication is needed, but persistence remains behind the existing controlled canonical promotion workflow. No automatic canonical writes occur.
