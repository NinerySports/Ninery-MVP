# First Genuine Transition Study Runbook

## Purpose

Use this runbook before Ninery conducts a genuine Transition Compatibility v1.1 extended-shadow study.

## What This Study Is

The study evaluates how well Transition Compatibility v1.1 describes a player's observed adjustment from a verified current bat to a verified proposed bat.

## What This Study Is NOT

It does not prove the bat is better, prove performance improvement, prove the recommendation engine is correct, promote Transition v1.1, or tell a player to purchase a bat.

## Before You Begin

Confirm you are using an internal actor:

- `transition-operator`
- `transition-admin`

Do not collect names, phone numbers, emails, medical details, school details, precise location, or unrelated family information for observer planning. Source role is enough.

## Step 1 - Run Readiness

```powershell
pnpm transition:genuine-study:first-study-readiness -- --player=<player-id> --current-variant=<variant-id> --proposed-variant=<variant-id> --actor=transition-operator
```

For machine-readable output:

```powershell
pnpm transition:genuine-study:first-study-readiness -- --player=<player-id> --current-variant=<variant-id> --proposed-variant=<variant-id> --actor=transition-operator --json
```

## Step 2 - Resolve Blockers

Follow the recovery domain in readiness output.

- Player identity issue: verify the player.
- Equipment identity issue: verify catalog equipment and variant.
- Equipment specification issue: correct Equipment Intelligence/catalog data.
- Player DNA issue: update or regenerate Player DNA.
- Equipment DNA issue: repair canonical Equipment DNA evidence/evaluations.
- Familiarity issue: capture current-equipment familiarity through approved intake.
- Context issue: rerun readiness after source data is fixed.

Do not manually enter normalized model values.

## Step 3 - Review Or Prepare Intake

```powershell
pnpm transition:genuine-study:prepare -- --file=path/to/intake.json --actor=transition-operator
```

Dry-run creation:

```powershell
pnpm transition:genuine-study:create -- --file=path/to/intake.json --actor=transition-operator --dry-run
```

## Step 4 - Capture Acknowledgement

The operational acknowledgement belongs in genuine-study intake. It is not model evidence, Player DNA, compatibility evidence, or proof of outcome.

## Step 5 - Create Genuine Study

```powershell
pnpm transition:genuine-study:create -- --file=path/to/intake.json --actor=transition-operator --confirm-genuine-study
```

## Step 6 - Review Prediction Context

```powershell
pnpm transition:genuine-study:prediction-input -- --study=<study-id> --actor=transition-operator
pnpm transition:genuine-study:prediction-provenance -- --study=<study-id> --actor=transition-operator
```

## Step 7 - Run Prediction Dry-Run

```powershell
pnpm transition:genuine-study:prediction-dry-run -- --study=<study-id> --actor=transition-operator
```

## Step 8 - Capture Immutable Prediction

Capture before any observation or outcome knowledge.

```powershell
pnpm transition:genuine-study:capture-prediction -- --study=<study-id> --actor=transition-operator --confirm
```

## Step 9 - Begin Observation

```powershell
pnpm transition:genuine-study:observation-readiness -- --study=<study-id>
pnpm transition:genuine-study:start-observation -- --study=<study-id> --actor=transition-operator --confirm
```

## Step 10 - Record First-Use Observation

```powershell
pnpm transition:genuine-study:add-observation -- --study=<study-id> --actor=transition-operator --file=path/to/first-use-observation.json
```

## Step 11 - Record Early-Session Observation

```powershell
pnpm transition:genuine-study:add-observation -- --study=<study-id> --actor=transition-operator --file=path/to/early-session-observation.json
```

## Step 12 - Record Acclimation Observation

```powershell
pnpm transition:genuine-study:add-observation -- --study=<study-id> --actor=transition-operator --file=path/to/acclimation-observation.json
```

## Step 13 - Correct An Observation

Corrections are append-only and require a reason.

```powershell
pnpm transition:genuine-study:correct-observation -- --study=<study-id> --actor=transition-operator --file=path/to/correction-observation.json --reason="Equipment-specific correction."
```

## Step 14 - Completion Review

```powershell
pnpm transition:genuine-study:completion-review -- --study=<study-id> --actor=transition-operator
```

## Step 15 - Complete Study

```powershell
pnpm transition:genuine-study:complete -- --study=<study-id> --actor=transition-operator --confirm
```

## Audit And Review

```powershell
pnpm transition:genuine-study:show -- --study=<study-id>
pnpm transition:genuine-study:audit -- --study=<study-id>
pnpm transition:genuine-study:context-drift -- --study=<study-id>
```

## Cancellation

```powershell
pnpm transition:genuine-study:cancel -- --study=<study-id> --actor=transition-admin --reason="No observation will occur."
```

## Invalidation

```powershell
pnpm transition:genuine-study:invalidate -- --study=<study-id> --actor=transition-admin --reason-code=incorrect_proposed_equipment --reason="Wrong proposed variant."
```

## Common Errors

- `UNAUTHORIZED_OPERATOR`: use an authorized internal actor.
- `MISSING_PLAYER_DNA`: update or regenerate Player DNA.
- `MISSING_CURRENT_SPECIFICATIONS`: correct Equipment Intelligence/catalog data.
- `MISSING_PROPOSED_EQUIPMENT_DNA`: repair canonical Equipment DNA evidence/evaluations.
- `MISSING_FAMILIARITY`: capture genuine current-equipment familiarity.
- `PREDICTION_NOT_READY`: resolve context-loader blockers before capture.

## Stop Conditions

Stop if player identity, current equipment, proposed equipment, or variant identity is uncertain. Stop if Player DNA is unsupported, required readiness data is missing, Equipment DNA admission fails, familiarity is ambiguous, context loader is blocked, the observer source is unreliable, prediction would happen after outcome knowledge, or the equipment changed from the frozen study definition.

## First Study Checklist

- [ ] Player identity verified
- [ ] Current bat verified
- [ ] Proposed bat verified
- [ ] Player DNA supported
- [ ] Equipment DNA ready/admitted
- [ ] Familiarity captured
- [ ] Acknowledgement complete
- [ ] Observer plan complete
- [ ] Study created
- [ ] Prediction context reviewed
- [ ] Dry-run reviewed
- [ ] Prediction captured before observation
- [ ] Observation started
- [ ] First-use checkpoint completed
- [ ] Early-session checkpoint completed
- [ ] Acclimation checkpoint completed
- [ ] Completion review passed
- [ ] Study completed
- [ ] Audit reviewed
