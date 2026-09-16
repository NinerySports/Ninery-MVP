# Genuine Transition Study Operator Guide

Internal extended-shadow tooling only. This is not live recommendation logic.

## Actors

Use one of the internal actor IDs:

- `transition-operator`
- `transition-admin`

Write commands require `--actor`. Do not put secrets in command arguments or JSON files.

## Workflow

0. Run first-study readiness:

```powershell
pnpm transition:genuine-study:first-study-readiness -- --player=<player-id> --current-variant=<variant-id> --proposed-variant=<variant-id> --actor=transition-operator
```

1. Find the player:

```powershell
pnpm transition:genuine-study:players -- --query="Fictional"
```

2. Find current and proposed equipment:

```powershell
pnpm transition:genuine-study:equipment -- --query="Fictional Bat"
```

3. Prepare intake from a JSON file:

```powershell
pnpm transition:genuine-study:prepare -- --file=docs/examples/transition-genuine-study-intake.example.json --actor=transition-operator
```

4. Dry-run creation:

```powershell
pnpm transition:genuine-study:create -- --file=docs/examples/transition-genuine-study-intake.example.json --actor=transition-operator --dry-run
```

5. Commit genuine study creation:

```powershell
pnpm transition:genuine-study:create -- --file=path/to/real-intake.json --actor=transition-operator --confirm-genuine-study
```

6. Preview assembled prediction input:

```powershell
pnpm transition:genuine-study:prediction-input -- --study=<study-id> --actor=transition-operator
```

7. Review provenance and dry-run v1.1 prediction:

```powershell
pnpm transition:genuine-study:prediction-provenance -- --study=<study-id> --actor=transition-operator
pnpm transition:genuine-study:prediction-dry-run -- --study=<study-id> --actor=transition-operator
```

8. Capture prediction from persisted context:

```powershell
pnpm transition:genuine-study:capture-prediction -- --study=<study-id> --actor=transition-operator --confirm
```

Manual compatibility-input files are a development override only:

```powershell
pnpm transition:genuine-study:capture-prediction -- --study=<study-id> --actor=transition-operator --file=path/to/prediction-input.json --manual-input-override
```

9. Review observation readiness:

```powershell
pnpm transition:genuine-study:observation-readiness -- --study=<study-id>
```

10. Start observations:

```powershell
pnpm transition:genuine-study:start-observation -- --study=<study-id> --actor=transition-operator --confirm
```

11. Add checkpoint observations:

```powershell
pnpm transition:genuine-study:add-observation -- --study=<study-id> --actor=transition-operator --file=path/to/first-use-observation.json
```

12. Review completion:

```powershell
pnpm transition:genuine-study:completion-review -- --study=<study-id> --actor=transition-operator
```

13. Complete:

```powershell
pnpm transition:genuine-study:complete -- --study=<study-id> --actor=transition-operator --confirm
```

## Other Commands

```powershell
pnpm transition:genuine-study:first-study-readiness -- --study=<study-id> --actor=transition-operator
pnpm transition:genuine-study:first-study-readiness-report
pnpm transition:genuine-study:first-study-validation
pnpm transition:genuine-study:checkpoints -- --study=<study-id>
pnpm transition:genuine-study:context-diagnostics -- --study=<study-id>
pnpm transition:genuine-study:context-drift -- --study=<study-id>
pnpm transition:genuine-study:show -- --study=<study-id>
pnpm transition:genuine-study:list
pnpm transition:genuine-study:audit -- --study=<study-id>
pnpm transition:genuine-study:cancel -- --study=<study-id> --actor=transition-admin --reason="No observation will occur."
pnpm transition:genuine-study:invalidate -- --study=<study-id> --actor=transition-admin --reason-code=incorrect_proposed_equipment --reason="Wrong variant."
```

## Guardrails

- No public access.
- No anonymous writes.
- No fake genuine evidence.
- No prediction after outcome is already known.
- No v1.0 fallback.
- No model calibration.
- No automatic promotion.
- No accuracy percentage.
- No normal requirement for manually authored prediction input JSON.
- No readiness command creates a genuine study or genuine evidence.
