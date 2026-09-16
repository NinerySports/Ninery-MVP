# @ninery/player-intelligence

Deterministic Player DNA scoring for Ninery.

Player DNA describes equipment-relevant characteristics and current development needs. It is not a medical assessment, scouting grade, or permanent label of the player.

## Purpose

The Player DNA Engine turns PlayerHQ profile data, growth history, BatMatch answers, BatMatch session metadata, and existing Decision Signals into a standardized profile that can later be compared against Equipment DNA.

## Player DNA vs Equipment DNA

Player DNA describes the player side of the match: current needs, development context, confidence, growth stability, and equipment preferences.

Equipment DNA describes the product side of the match: bat control, balance, swing weight, power potential, forgiveness, and other equipment characteristics.

The future Compatibility Engine will compare these two profiles without treating either one as a permanent truth.

## Scores

Scores are normalized from 0 to 100 and start from a neutral baseline of 50 when partial information exists.

- `batControl` - how much the player demonstrates or prioritizes controllable bat fit
- `swingSpeed` - whether inputs suggest swing-speed comfort or challenges
- `powerPotential` - whether physical and developmental context support power expression
- `contactConsistency` - whether inputs suggest contact consistency as a strength or need
- `physicalStrength` - physical context relevant to bat handling
- `confidence` - confidence in the batter's box and current equipment
- `transitionReadiness` - readiness for more demanding equipment transitions
- `growthStability` - whether recent growth is likely to make recommendations stale
- `equipmentAwareness` - how much current equipment context is known
- `profileCompleteness` - whether the system has enough information for dependable assessment

Higher is not always better. A high score means the signal is strong or important for matching, not that the player is better.

## Categories

- `preferredSwingFeel`: `light`, `balanced`, `slightly_end_loaded`, `end_loaded`, `unknown`
- `developmentStage`: `foundation`, `developing`, `competitive`, `performance`, `advanced`
- `primaryHittingGoal`: `improve_contact`, `improve_power`, `improve_bat_control`, `increase_swing_speed`, `build_confidence`, `prepare_for_transition`, `maintain_current_fit`, `unknown`
- `growthStatus`: `stable`, `moderate_growth`, `rapid_growth`, `insufficient_data`
- `profileConfidenceLevel`: `low`, `medium`, `high`, `validated`

MVP profiles are capped below `validated`; that band is reserved for future profiles supported by review, outcomes, or stronger evidence.

## Scoring Rules

Rules are typed configuration objects in `src/scoring/rules`.

Each rule includes:

- `ruleId`
- `version`
- `targetAttribute`
- `sourceType`
- `sourceCode`
- `condition`
- `scoreAdjustment`
- `weight`
- `confidenceContribution`
- `rationaleTemplate`
- `active`

Rules do not store executable JavaScript in the database. The scoring engine interprets typed condition objects so the rule system can later move into an admin-managed configuration store.

## Normalization

Every attribute starts at 50. Active matching rules contribute weighted positive or negative adjustments. Final scores are clamped between 0 and 100.

Missing information does not automatically create a zero score. It lowers profile confidence and appears in the explanation output.

## Confidence

Profile confidence is separate from individual scores. It considers:

- required profile fields completed
- BatMatch question coverage
- growth measurement freshness
- current equipment information
- answer consistency
- source data quality
- completed BatMatch status

Bands:

- 0-49: `low`
- 50-74: `medium`
- 75-94: `high`
- 95-100: `validated`

## Explainability

Each score includes:

- contributing inputs
- applied rules
- positive adjustments
- negative adjustments
- final normalized score
- confidence contribution
- human-readable reasons
- missing information that would improve confidence

This lets the service answer why an attribute received a score, which answers influenced it, which rules were applied, and how confident Ninery is in the result.

## Versioning and History

Player DNA profiles are historical. Do not overwrite existing generated profiles when meaningful PlayerHQ, growth, BatMatch, or rule information changes. Generate a new profile with the current `scoringRuleVersion`.

The Prisma model stores:

- input snapshot
- score breakdown
- generated timestamp
- scoring rule version
- optional BatMatch session reference

## Future API Endpoints

The package remains independent from HTTP controllers. The API app now exposes controller endpoints that call `PlayerDNAApplicationService`:

- `POST /players/{playerId}/player-dna/generate`
- `GET /players/{playerId}/player-dna`
- `GET /players/{playerId}/player-dna/history`
- `GET /player-dna/{profileId}/explanations/{attribute}`

### Endpoint Contracts

Generate:

```http
POST /players/{playerId}/player-dna/generate
```

Optional body:

```json
{
  "batMatchSessionId": "uuid",
  "forceRegenerate": false,
  "regenerationReason": "manual_review"
}
```

Latest:

```http
GET /players/{playerId}/player-dna
```

History:

```http
GET /players/{playerId}/player-dna/history
```

Profile by ID:

```http
GET /player-dna/{profileId}
```

Attribute explanation:

```http
GET /player-dna/{profileId}/explanations/{attribute}
```

## Repository Architecture

`PrismaPlayerDNARepository` owns database persistence and maps Prisma records back into typed Player DNA domain objects.

Repository responsibilities:

- create historical profiles
- fetch latest and historical profiles
- map Prisma Decimal values to numbers
- preserve `inputSnapshot` and `scoreBreakdown`
- archive profiles when needed
- find existing profiles by player, session, scoring-rule version, and input hash

Prisma-specific details stay inside the repository layer.

## Input Loading

`PlayerDNAInputLoader` gathers:

- `Player`
- `PlayerProfile`
- `GrowthMeasurement`
- latest completed or requested `BatMatchSession`
- `BatMatchAnswer`
- `BatMatchQuestion`
- `DecisionSignal`

If no session is provided, the loader uses the latest completed BatMatch session. If a requested session belongs to another player, generation is rejected.

The loader does not contain scoring logic.

## Idempotency

Duplicate generation is prevented by hashing the reproducible input snapshot plus scoring-rule version.

If the same player, source BatMatch session, scoring-rule version, and input hash already exist, `generatePlayerDNA` returns the existing profile.

Use `forceRegenerate: true` to intentionally create a new historical profile.

## Transactions and Events

Profile generation writes occur in one transaction:

1. create `PlayerDNAProfile`
2. create `PlayerTimelineEvent`
3. create `PlatformEvent`

If event creation fails, the profile write rolls back with the transaction.

## Authorization Boundary

Authentication is not ready yet. The API includes a development-only guard and the package exposes a `PlayerDNAAuthorizer` interface.

Before public launch:

- replace `DevelopmentPlayerDNAAuthorizer`
- verify the authenticated user belongs to the player's family
- prevent cross-family profile generation and reads
- add request-user context to the API layer

## Development

## Current Equipment Familiarity

Ticket #038 adds the Current Equipment Familiarity model under `src/equipment-familiarity`.

- Model version: `CURRENT_EQUIPMENT_FAMILIARITY_MODEL_VERSION = "1.0"`
- Levels: `new_or_unfamiliar`, `limited_familiarity`, `developing_familiarity`, `established_familiarity`, `highly_established_familiarity`, `unknown`
- Inputs may include first and most recent use dates, estimated sessions and weeks, regular use frequency, usage contexts, primary-equipment status, direct familiarity report, source, and capture time.
- Equipment ownership alone is not familiarity. If ownership is the only signal, the model returns `unknown` with estimated confidence.
- The ordinal level is authoritative. The optional 0-100 numeric reference is exposed only for diagnostics and does not use a hidden midpoint for missing data.
- Conflicting reports reduce confidence and preserve a warning for downstream validation.

```bash
pnpm --filter @ninery/player-intelligence build
pnpm --filter @ninery/player-intelligence test
```

After pushing the schema to the development database:

```bash
pnpm --filter @ninery/database prisma:generate
pnpm --filter @ninery/database exec prisma db push --schema=./prisma/schema.prisma
```

Known MVP limitations:

- the authorization guard is a development placeholder
- idempotency is input-hash based, not backed by a unique database constraint yet
- PlayerTimeline and Platform events are simple audit entries
- the Prisma repository is tested with mocks in this phase
