# Atlas USSSA Real-Source Acquisition Pilot

## Status

Ticket #071 controlled research artifact. Real sources, non-persisted, and not qualified production Equipment DNA.

## Target

- Equipment: `748ae67e-0b10-40d6-8ef6-28d6953d1d40`
- Variant: `0844a8e0-8b9a-42ba-9b6f-50f288832e58`
- 2026 Louisville Slugger Atlas USSSA, 30 inches, nominal 20 ounces, drop -10
- Manufacturer family ID: `WBL4121010`
- Size identifier retained only in this audit: `WBL41210102030`

The historical Atlas USA UUIDs are explicitly excluded.

## Sources

The fixture uses the official Louisville Slugger product page, Direct Sports and Academy retailer listings, and bounded editorial observations from BatDigest and BatReviews. Retailer product copy is conservatively grouped with the manufacturer lineage where its facts and language track the upstream page. BatDigest is represented as an independent editorial observation; BatReviews remains unknown-dependency and pending review. Neither is treated as measurement or structured evaluation.

Only paraphrases and normalized facts needed for auditability are stored. No long source passage is retained.

## Results

The pilot contains 5 sources, 5 documents, 27 raw claims, and 27 normalized claims. The unchanged #070 contract produces:

- Qualified: 11 (40.7%)
- Context only: 12 (44.4%)
- Review required: 0 (0%)
- Not eligible: 4 (14.8%)

The 11 proposed evidence inputs are in-memory `verified_catalog_fact` candidates. They are not persisted. Manufacturer factual specifications qualify; syndicated retailer facts remain context; marketing is ineligible for behavioral evidence; all six editorial observations remain context only.

Extraction is recorded as AI-assisted. Objective source transcription is marked `review_not_required`; uncertain BatReviews observations remain `review_pending`. No human reviewer or human acceptance is represented.

Catalog identity, model year, certification, dimensions, drop, barrel diameter, material, and construction agree. No core identity conflict was observed.

## Construct Coverage

External prose offers context-only candidate relationships for startup demand, barrel-path repeatability, center-response baseline, and response degradation. Marketing phrases mention usable-contact-region breadth and vibration response, but remain ineligible rather than construct evidence. The remaining Protocol v1.1 behavioral constructs receive no useful pilot information. No relationship creates a construct value.

## Assessment

Taxonomy conclusion: `SIX_CLASSES_SUFFICIENT_POLICY_NEEDS_EXPANSION`. A seventh evidence class is not justified, but unstructured expert observations need a future, calibrated policy if they are to contribute beyond context.

Qualification conclusion: `QUALIFICATION_POLICY_REQUIRES_TARGETED_REFINEMENT`. The factual and marketing firewalls behave appropriately. The open question is whether independently attributable, identity-bound editorial observations can earn a bounded supporting role after calibration against structured Ninery evidence.

## Scalability And Trust

Qualification, conflict detection, and proposed-input generation are deterministic and automation-ready. Discovery, capture, extraction, normalization, marketing detection, identity binding, dependency analysis, and construct mapping are suitable for AI assistance with review. Claim-specific authority remains human-review dependent.

Automation risks false confidence when copied retailer pages are counted independently, family claims are relabeled as variant claims, promotional adjectives become ordinal values, or AI review is mistaken for source authority.

Without physical possession, the pilot cannot establish actual specimen mass, balance point, barrel geometry, mechanical response, or structured Protocol v1.1 behavior. Physical measurement could establish specimen facts; controlled testing could establish repeatable mechanical response; structured human evaluation could produce rubric-bound observations. None is implied by this source pilot.

## Persistence Gaps

Production persistence would require durable source/publisher identities, document revisions and fingerprints, raw and normalized claims, identity assertions, dependencies and independence groups, review decisions, extraction runs, and construct relationships. Ticket #071 does not propose or apply a Prisma change.

## Reproduction

```cmd
pnpm --filter @ninery/database equipment:intelligence:acquisition-pilot:atlas-usssa
```

Recommended next work: refine #070 treatment of external expert observations through calibration, without changing the six evidence classes or granting canonical authority.
