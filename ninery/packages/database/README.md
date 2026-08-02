# @ninery/database

Shared database package for Ninery.

This package owns the Prisma schema, Prisma Client generation, and PostgreSQL database migration workflow.

## Scripts

```bash
pnpm --filter @ninery/database prisma:generate
pnpm --filter @ninery/database prisma:migrate:dev
pnpm --filter @ninery/database prisma:studio
```

## Environment

Prisma reads the database connection from `DATABASE_URL`.

```env
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/ninery?schema=public"
```

## Importing

Other apps and packages will import database utilities from this package:

```ts
import { PrismaClient } from "@ninery/database";
```

## Identity and Family Models

### User

`User` represents an authenticated account in Ninery.

Key fields:

- `id` - UUID primary key
- `email` - unique login email address
- `passwordHash` - hashed password for credential-based authentication
- `emailVerified` - whether the email address has been verified
- `createdAt` / `updatedAt` - audit timestamps

### Family

`Family` is the ownership boundary for players, recommendations, and shared access.

Key fields:

- `id` - UUID primary key
- `name` - family display name
- `createdByUserId` - user who created the family
- `createdAt` / `updatedAt` - audit timestamps

### FamilyMember

`FamilyMember` joins users to families and controls their access level.

Roles:

- `owner` - full ownership and administration
- `guardian` - trusted adult access
- `viewer` - read-oriented access

Key fields:

- `id` - UUID primary key
- `familyId` - related family
- `userId` - related user
- `role` - family access role
- `createdAt` - membership creation timestamp

## Player Intelligence Models

### Player

`Player` represents an athlete profile owned by a family.

Key fields:

- `id` - UUID primary key
- `familyId` - owning family
- `firstName` / `lastName` / `nickname` - player identity fields
- `dateOfBirth` - optional birth date
- `graduationYear` - optional school graduation year
- `sport` - `baseball` or `softball`
- `photoUrl` - optional profile image URL
- `status` - `active` or `archived`
- `createdAt` / `updatedAt` - audit timestamps

Relationships:

- `Family` has many `Player` records
- `Player` belongs to one `Family`
- `Player` has one optional `PlayerProfile`
- `Player` has many `GrowthMeasurement` records

### PlayerProfile

`PlayerProfile` stores baseball/softball context that can change over time without changing the core player record.

Key fields:

- `id` - UUID primary key
- `playerId` - unique related player
- `throwingHand` - `left` or `right`
- `battingSide` - `left`, `right`, or `switch`
- `primaryPosition` / `secondaryPosition` - position context
- `competitionLevel` - `recreational`, `school`, `travel`, `elite`, or `unknown`
- `teamName` - optional current team
- `practiceFrequency` - optional practice cadence
- `experienceYears` - optional years of experience
- `updatedAt` - profile update timestamp

### GrowthMeasurement

`GrowthMeasurement` records historical height and weight observations for player intelligence.

Key fields:

- `id` - UUID primary key
- `playerId` - related player
- `heightCm` - optional height in centimeters
- `weightKg` - optional weight in kilograms
- `measuredAt` - date and time the measurement was taken
- `source` - optional source such as parent entry, import, or estimate
- `confidence` - optional confidence score
- `createdAt` - record creation timestamp

Growth measurements are append-only historical records. Do not overwrite an existing measurement when a player grows; create a new `GrowthMeasurement` row instead.

### PlayerDNAProfile

`PlayerDNAProfile` stores generated Player DNA snapshots for equipment-relevant recommendation intelligence.

Player DNA profiles are historical records. Do not overwrite an existing profile when PlayerHQ data, growth data, BatMatch answers, or scoring rules change; generate a new profile instead.

Key fields:

- `playerId` - related player
- `batMatchSessionId` - optional BatMatch session used as an input
- `version` - Player DNA output shape version
- `status` - generated or archived
- normalized scores from 0 to 100 for bat control, swing speed, power potential, contact consistency, physical strength, confidence, transition readiness, growth stability, equipment awareness, and profile completeness
- categorical outputs for swing feel, development stage, primary hitting goal, growth status, and confidence band
- `scoringRuleVersion` - deterministic scoring-rule registry version
- `inputSnapshot` - JSON snapshot of the inputs used to generate the profile
- `scoreBreakdown` - JSON explanation data with applied rules, source codes, and adjustments
- `generatedAt` - time the profile was generated

Player DNA describes equipment-relevant characteristics and current development needs. It is not a medical assessment, scouting grade, or permanent label of the player.

When Ticket #013 schema changes are ready to sync to local Supabase, run:

```bash
pnpm --filter @ninery/database exec prisma db push --schema=./prisma/schema.prisma
pnpm --filter @ninery/database prisma:generate
```

## Equipment Catalog Models

### Equipment

`Equipment` represents a catalog-level product model.

Key fields:

- `manufacturer` and `model` - product identity
- `modelYear` - optional model year
- `category` - `bat`, `glove`, `cleat`, `helmet`, or `catcher_gear`
- `certification` - `USA`, `USSSA`, `BBCOR`, `none`, or `unknown`
- `material`, `construction`, and `barrelDiameter` - product specs
- `status` - `active`, `coming_soon`, `legacy`, or `archived`

### EquipmentVariant

`EquipmentVariant` captures purchasable size/weight/SKU options for an equipment model.

Key fields:

- `equipmentId` - parent equipment model
- `lengthInches`, `weightOunces`, and `dropWeight` - bat sizing data
- `msrp` - optional manufacturer suggested retail price
- `sku` - optional unique stock keeping unit

### EquipmentCharacteristic

`EquipmentCharacteristic` defines reusable DNA dimensions used to score equipment.

The initial seed creates:

- `Bat Control™`
- `Balance™`
- `Swing Weight™`
- `Barrel Forgiveness™`
- `Sweet Spot Size™`
- `Power Potential™`
- `Confidence Building™`
- `Transition Friendliness™`

### EquipmentDNAProfile

`EquipmentDNAProfile` stores a versioned scoring profile for a piece of equipment.

Key fields:

- `equipmentId` - related equipment model
- `version` - profile version
- `certificationLevel` - `bronze`, `silver`, `gold`, or `platinum`
- `confidenceScore` - `low`, `medium`, `high`, or `validated`
- `status` - `draft`, `active`, or `archived`
- `publishedAt` - optional publication timestamp

### EquipmentDNAScore

`EquipmentDNAScore` connects a DNA profile to a characteristic with scoring evidence.

Key fields:

- `dnaProfileId` - related DNA profile
- `characteristicId` - related characteristic
- `score` - numeric score for the characteristic
- `confidence` - `low`, `medium`, `high`, or `validated`
- `evidenceLevel` - `internal_review`, `manufacturer_specs`, `field_testing`, or `validated_outcomes`
- `rationale` - optional explanation

## Equipment Intelligence Expansion

Equipment intelligence is organized into four layers:

1. Catalog facts - `Equipment`, `EquipmentVariant`, and `EquipmentSpecification`
2. DNA scoring - `EquipmentDNAProfile`, `EquipmentDNAScore`, and `EquipmentCharacteristic`
3. Evidence and fit intelligence - `EquipmentEvidence`, `EquipmentFitProfile`, and `EquipmentPersonality`
4. Comparison intelligence - `EquipmentComparison`

### EquipmentSpecification

`EquipmentSpecification` stores structured product facts for an existing equipment model.

Examples include barrel diameter, connection type, grip style, warranty terms, or other facts that should be queryable without adding one-off columns to `Equipment`.

Ownership rules:

- belongs to `Equipment`
- uses `specificationCode` as the stable fact key
- stores either text or numeric values, plus optional unit and source
- uses `verifiedAt` when a fact has been checked against a trusted source

There is one canonical specification row per equipment/specification code. If multiple sources disagree, resolve the canonical value and preserve supporting source detail in `EquipmentEvidence`.

### EquipmentEvidence

`EquipmentEvidence` stores the source material behind equipment intelligence decisions.

Evidence can attach to:

- `Equipment` for model-level claims
- `EquipmentDNAProfile` for profile-level support
- `EquipmentDNAScore` for score-level support

This lets a DNA score link directly to the manufacturer spec, internal review, field test, user feedback, performance data, or validated outcome that supports it.

Publishing rules:

- collect evidence first with `status = collected`
- move to `in_review` while a reviewer checks reliability
- use `approved` evidence for published DNA profiles and fit outputs
- keep rejected or archived evidence for auditability instead of deleting it during normal review

### EquipmentFitProfile

`EquipmentFitProfile` connects a published DNA profile to structured fit signals.

Supported fit types:

- `player_stage`
- `swing_profile`
- `opportunity_profile`
- `preference`
- `transition`

Strength is an application-enforced 1 to 5 value. Prisma does not define a database check constraint in the schema file, so application code and any SQL migration checks should preserve that rule.

Fit profiles belong to an equipment model and a DNA profile. They should be regenerated as new versions when the fit logic changes.

### EquipmentPersonality

`EquipmentPersonality` stores derived equipment archetypes, such as balanced confidence builder, power-first barrel, or transition-friendly BBCOR option.

Ownership rules:

- belongs to `Equipment`
- belongs to the DNA profile used for derivation
- stores `derivationVersion` so personality outputs remain reproducible
- allows one or more personality rows, with `isPrimary` marking the leading personality for display

### EquipmentComparison

`EquipmentComparison` stores directional comparisons between two existing equipment models.

It records:

- a similarity score
- shared strengths as JSON
- primary differences as JSON
- optional best-fit summaries for each side
- confidence and version metadata

Comparisons should explain both why two items are similar and why a family might choose one over the other.

### Model-Level Versus Variant-Level Scoring

Current DNA, evidence, fit, personality, and comparison records are model-level and attach to `Equipment`.

`EquipmentVariant` remains the purchasable size/SKU layer. Variant-level scoring should only be added when Ninery needs intelligence that truly changes by length, weight, drop, or SKU. Until then, model-level scoring prevents duplicate DNA profiles across equivalent variants.

### Publishing Rules

- Draft DNA profiles may be edited freely.
- Active DNA profiles should rely on approved or high-reliability evidence.
- Published fit profiles and personalities should reference the DNA profile version that produced them.
- Do not overwrite historical published outputs when scoring logic changes; create new versions.
- Evidence records should remain available for audit and should not be removed merely because an interpretation changed.

Seed equipment characteristics with:

```bash
pnpm seed
```

## BatMatch Interview Models

BatMatch(TM) is an adaptive interview flow. The question set is versioned and can change over time while preserving reproducibility for past sessions.

### BatMatchSession

`BatMatchSession` represents one interview run for a player.

Key fields:

- `playerId` - related player
- `status` - `started`, `completed`, or `abandoned`
- `type` - `first_batmatch`, `follow_up`, `growth_review`, or `annual_review`
- `version` - session logic version used for reproducibility
- `confidenceScore` - optional overall confidence score
- `startedAt` / `completedAt` - interview timing

### BatMatchQuestion

`BatMatchQuestion` stores reusable adaptive questions.

Key fields:

- `code` - unique stable question identifier
- `section` - interview section such as `player_goals`, `swing_feel`, or `preferences`
- `questionText` and `helperText` - user-facing prompt content
- `answerType` - `single_select`, `multi_select`, `text`, `number`, `boolean`, or `scale`
- `options` - JSON answer options when applicable
- `confidenceWeight` - how strongly the answer should influence downstream signals
- `version` and `active` - support repeatable historical sessions and question lifecycle management

### BatMatchAnswer

`BatMatchAnswer` stores a player's answer to a BatMatch question within a session.

Answers are JSON so each answer type can retain its native shape without forcing early product assumptions.

### DecisionSignal

`DecisionSignal` stores generated evidence from BatMatch answers.

Decision Signals(TM):

- belong to a player and a BatMatch session
- may reference the source answer that generated them
- feed Opportunity Profiles(TM)
- feed the Recommendation Engine

Seed initial BatMatch questions with:

```bash
pnpm seed
```

## Recommendation and Decision Book Models

Recommendations are versioned for reproducibility. Each generated recommendation records the decision matrix, equipment DNA, and knowledge graph versions that produced it.

### OpportunityProfile

`OpportunityProfile` describes a reusable player need or opportunity that can drive a recommendation.

The initial seed creates:

- `Improve Bat Control™`
- `Build Swing Confidence™`
- `First BBCOR Transition™`
- `Growth Spurt Equipment Review™`
- `Increase Barrel Impact™`
- `Increase Swing Speed™`
- `Current Equipment Still Fits™`

### PlayerOpportunityProfile

`PlayerOpportunityProfile` connects a player to an opportunity profile, optionally scoped to a specific recommendation.

These records explain which player needs drove a recommendation and store priority and confidence scores for the match.

### Recommendation

`Recommendation` stores one generated recommendation event for a player.

Key reproducibility fields:

- `decisionMatrixVersion`
- `equipmentDnaVersion`
- `knowledgeGraphVersion`
- `overallConfidence`

### RecommendationItem

`RecommendationItem` stores ranked equipment choices for a recommendation.

Each item belongs to one recommendation and one equipment record, with rank, match score, equipment readiness score, recommendation confidence, summary reasoning, and structured tradeoffs.

### DecisionBook

`DecisionBook` is generated from a recommendation for a player.

Decision Books should be treated as historical artifacts. Do not overwrite a historical Decision Book when regenerating; create a new version so past recommendations remain reproducible.

### DecisionBookSection

`DecisionBookSection` stores the structured content blocks that make up a Decision Book.

Sections use typed `sectionType` values such as `executive_summary`, `recommended_equipment`, `equipment_dna`, `tradeoffs`, `development_roadmap`, and `ai_assistant`.

## Timeline and Platform Event Models

### PlayerTimelineEvent

`PlayerTimelineEvent` powers PlayerHQ(TM) timeline history and the visible player journey.

Timeline events belong to a player and may be displayed to users. They can point back to related records through `relatedEntityType` and `relatedEntityId`, such as a growth measurement, BatMatch session, recommendation, or Decision Book.

Common event types include:

- `player_created`
- `profile_updated`
- `growth_measurement_added`
- `batmatch_started`
- `batmatch_completed`
- `recommendation_generated`
- `decision_book_created`
- `milestone_added`

### PlatformEvent

`PlatformEvent` is an internal append-only event log for analytics, auditing, and future event-driven workflows.

Platform events are not intended for user display. They should not be edited after creation; if new information arrives, create a new event instead of mutating historical event data.

Platform events include an `eventType`, generic entity reference, JSON payload, and creation timestamp.

## Seed System

Seeds live in `prisma/seeds` and are organized by domain:

- `manufacturers.seed.ts`
- `equipment-characteristics.seed.ts`
- `opportunity-profiles.seed.ts`
- `batmatch-questions.seed.ts`
- `positions.seed.ts`
- `certifications.seed.ts`
- `equipment-categories.seed.ts`
- `development-stages.seed.ts`
- `demo-family.seed.ts`
- `demo-player.seed.ts`
- `sample-equipment.seed.ts`

Each seed file exports:

- `seed()` - creates or updates its data
- `clear()` - removes only the data owned by that seed

`prisma/seeds/index.ts` orchestrates execution.

### Commands

```bash
pnpm seed
pnpm seed:clear
pnpm seed:demo
pnpm seed:reference
pnpm seed:equipment
```

### Execution Order

`pnpm seed` runs in this order:

1. Reference data: manufacturers, positions, certifications, equipment categories, development stages
2. Intelligence reference data: Equipment DNA characteristics, Opportunity Profiles, BatMatch questions
3. Sample equipment: demo bats, variants, DNA profiles, and DNA scores
4. Demo data: Sanders Family, owner account, Jackson Sanders, growth history, PlayerHQ timeline, and sample player opportunity profiles

`pnpm seed:clear` runs the reverse order so dependent data is removed before reference data.

### Idempotency Rules

Seeds are safe to run multiple times:

- Reference data uses stable `code` values.
- Demo user uses the stable email `demo@ninerysports.com`.
- Demo family and demo player are matched by stable identity fields.
- Equipment variants use stable SKUs.
- Equipment DNA scores use the unique DNA profile and characteristic pair.
- Growth measurements are historical and are never overwritten; demo growth measurements are only inserted when the same player/date/source row does not already exist.

### Adding New Seed Files

1. Create a new `*.seed.ts` file in `prisma/seeds`.
2. Export `seed()` and `clear()`.
3. Use stable natural keys or unique codes for idempotency.
4. Add the seed module to `prisma/seeds/index.ts` in the correct dependency order.
5. Keep `clear()` scoped to records owned by that seed.

### Development Workflow

After schema changes:

```bash
pnpm prisma format
pnpm prisma generate
pnpm prisma migrate dev
pnpm seed
```

When creating the development migration for the equipment intelligence expansion, run:

```bash
pnpm --filter @ninery/database prisma:migrate:dev -- --name add_equipment_intelligence_schema
```

For quick demo setup:

```bash
pnpm seed:reference
pnpm seed:equipment
pnpm seed:demo
```
