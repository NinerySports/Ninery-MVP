# Equipment DNA Attribute Registry

The Equipment DNA MVP Attribute Registry is the canonical, versioned definition layer for baseball bat attributes. It does not replace the existing Equipment DNA scores, Prisma models, seed data, or recommendation formulas.

Registry version: `1.0`

## Why This Exists

The current recommendation engine consumes normalized score attributes such as `batControl`, `swingWeight`, `barrelForgiveness`, and `sweetSpotSize`. The registry adds a stable vocabulary around those capabilities so product, data, API, and recommendation work can agree on:

- which attributes exist
- which domain owns them
- which values are valid
- which attributes are required before an item is recommendation-ready
- which existing score or catalog field each attribute maps to

## Domains

- `physical`: catalog and variant facts such as length, weight, drop, certification, barrel diameter, construction, and material
- `performance`: evaluated bat behavior such as swing effort, forgiveness, sweet spot support, power potential, balance profile, and barrel stability
- `compatibility`: candidate fit signals that may depend on player context
- `development`: attributes that explain how a bat supports player development goals

## Data Types

The registry uses a discriminated union:

- `number`: bounded numeric values with unit and integer rules
- `boolean`: true or false values
- `enum`: unordered controlled vocabulary
- `ordinal`: ordered controlled vocabulary where order is meaningful

`validateEquipmentDNAAttributeValue()` checks known keys, null values, allowed values, numeric bounds, and integer requirements. String enum and ordinal values are trimmed and case-normalized only when they match an allowed value exactly after casing.

## MVP Recommendation-Ready Attributes

The focused MVP recommendation-ready set is:

- `length`
- `weight`
- `drop`
- `certification`
- `barrel_diameter`
- `swing_effort`
- `forgiveness`
- `sweet_spot_support`
- `bat_control_support`

These are exposed through `getRequiredEquipmentDNAAttributeDefinitions()`. Experimental and deprecated attributes are excluded even if a future definition accidentally marks them as required.

## Existing Characteristic Mapping

The registry keeps canonical snake_case keys while preserving current scoring and seed behavior:

- `bat_control_support` maps to `BAT_CONTROL`, seeded as `bat-control`, and score attribute `batControl`
- `balance_profile` maps to `SWING_BALANCE`, seeded as `swing-balance`, and score attribute `balance`
- `swing_effort` maps to `SWING_WEIGHT`, seeded as `swing-weight`, and score attribute `swingWeight`
- `forgiveness` maps to `BARREL_FORGIVENESS`, seeded as `barrel-forgiveness`, and score attribute `barrelForgiveness`
- `sweet_spot_support` maps to `SWEET_SPOT_SIZE`, seeded as `sweet-spot-size`, and score attribute `sweetSpotSize`
- `power_potential` maps to `POWER_POTENTIAL`, seeded as `power-potential`, and score attribute `powerPotential`
- `confidence_building_potential` maps to `CONFIDENCE_BUILDING`, seeded as `confidence-building`, and score attribute `confidenceBuilding`
- `transition_difficulty` is related to the current `TRANSITION_FRIENDLINESS` score but is not a direct replacement

## Transition Difficulty Decision

`transition_difficulty` is marked `experimental` with `attributeNature: "relational_candidate"` and is not recommendation-ready in version `1.0`.

The reason is intentional: transition is partly about the bat, but also partly about the player. A drop change, BBCOR move, growth spurt, or confidence gap can make the same bat feel easy for one player and difficult for another. The existing `transitionFriendliness` score remains untouched for current recommendation behavior. Full transition fit should be owned by Compatibility Intelligence when player-relative scoring is ready.

## Physical Fact Conventions

- `length` uses `EquipmentVariant.lengthInches`
- `weight` uses `EquipmentVariant.weightOunces`
- `drop` uses the existing signed `EquipmentVariant.dropWeight` convention, such as `-8`
- `certification` reuses the current Equipment DNA filter and Prisma enum values: `USA`, `USSSA`, `BBCOR`, `none`, `unknown`
- `barrel_diameter` uses `Equipment.barrelDiameter`
- `construction` and `material` are currently free-text catalog fields but validated by the registry when used as canonical attributes

## No Scoring Changes

Ticket 019 is intentionally metadata-only. It adds definitions, lookup helpers, validation helpers, and tests. It does not change:

- recommendation formulas
- scoring weights
- ranking behavior
- API contracts
- Prisma schema
- seed data
- BatMatch behavior
- demo recommendation output
