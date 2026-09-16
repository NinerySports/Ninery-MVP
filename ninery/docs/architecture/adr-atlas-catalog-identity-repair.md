# ADR: Atlas Catalog Identity Repair

## Status

Accepted for Ticket #071B.

## Context

Ticket #071 stopped when public product identity did not support the seeded `2026 Louisville Slugger Atlas USA 30/20 -10`. Ticket #071A confirmed that the historical Equipment `66f59356-029f-4df7-9177-0d0f36ef3e9c` and Variant `a485a596-ea15-4622-ac2e-452b7fd9c934` already participate in legacy DNA, canonical evaluation, recommendation, and transition-study history. Reclassifying those UUIDs would reinterpret that history.

Public identity references establish a distinct 2026 Louisville Slugger Atlas USSSA `-10`, including a 30-inch/20-ounce variant, a 2 3/4-inch barrel, and one-piece alloy construction. `WBL4121010` is retained as the external family/model identifier and `WBL41210102030` as the secondary-source size identifier. The current schema has no appropriate fields for either identifier.

## Decision

Create a separate catalog-only Equipment and Variant:

- Louisville Slugger Atlas, model year 2026
- certification `USSSA`
- material `alloy`
- construction `one-piece`
- nominal barrel diameter `2.75` inches
- variant 30 inches / 20 ounces / drop `-10`
- internal SKU `LS-ATLAS-USSSA-30-20`

The confirmed repair created Equipment `748ae67e-0b10-40d6-8ef6-28d6953d1d40` and Variant `0844a8e0-8b9a-42ba-9b6f-50f288832e58`. These new UUIDs are the clean target for the resumed Ticket #071 acquisition pilot.

Creation is dry-run by default, requires `--confirm`, runs in one Prisma transaction, and is idempotent. It creates only the Equipment, Variant, and factual EquipmentSpecification rows.

The historical USA Equipment and all attached variants, evidence, evaluations, DNA scores, recommendations, and studies remain unchanged. Its status remains `active`: changing status could alter current recommendation eligibility and historical operational behavior. A future catalog-lifecycle policy must provide explicit invalid/superseded/historical-only states before isolation is safe.

The sample seed no longer creates the mixed Atlas USA identity in a clean database. A dedicated catalog seed creates only the corrected USSSA catalog identity and does not create behavioral intelligence.

## Consequences

The new USSSA product begins with no DNA profile, evidence, canonical evaluations, fits, personality, recommendations, or studies. Ticket #071 may acquire real-source claims against this clean identity after the repair is verified.

Existing operational reports that target `LS-ATLAS-USA-30-22` remain historical/demo behavior and are not rebound. The Ticket #062 cross-equipment candidate and physical-measurement defaults also remain unchanged until a separately reviewed operational migration defines how their historical USA semantics should evolve.

Ticket #069 Atlas fixtures remain synthetic identity-firewall and claim-provenance tests; they are not representations of the repaired retail product and are intentionally unchanged. The Ticket #062 and physical-measurement references are calibration/history defaults rather than the Ticket #071 acquisition target, so rebinding them would reinterpret prior workflows rather than repair catalog identity.

The old mixed Atlas variants remain catalog debt. They are preserved because correcting them would require product-by-product identity evidence and historical-reference policy.

No Prisma schema or migration change is required.
