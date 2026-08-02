# @ninery/recommendation-intelligence

Deterministic compatibility scoring for Ninery equipment recommendations.

This package compares a versioned Player DNA profile with normalized Equipment DNA profiles and returns ranked, explainable equipment matches. It does not use generative AI for scores, rankings, filters, or trace data.

## Architecture

- Hard filters run before weighted scoring.
- Weighted scoring evaluates 14 compatibility dimensions.
- Ranking uses deterministic tie-breakers.
- Recommendation confidence is calculated separately from match score.
- Recommendation Trace preserves the scoring configuration, weights, rule IDs, source codes, dimensions, final score, confidence, rank, and generated timestamp.

## Hard Filters

Equipment is excluded before scoring when certification, category, active status, public DNA readiness, requested variant, profile completeness, evidence confidence, or required characteristic coverage fails. Filtered equipment is returned with explicit reasons.

Draft profiles are excluded from public requests. `includeInternalDraftProfiles` is development-only and must be protected before production use.

## Scoring Dimensions

MVP dimensions:

- Bat Control Fit
- Swing Feel and Balance Fit
- Swing Weight Fit
- Barrel Forgiveness Fit
- Sweet Spot Fit
- Power Potential Fit
- Confidence-Building Fit
- Transition Readiness Fit
- Development Goal Fit
- Growth and Useful-Life Fit
- Equipment Preference Fit
- Budget Fit
- Evidence Quality
- Profile Completeness

The default configuration version is `compatibility-mvp-v1`. Default weights sum to `1.00`. Goal-based adjustments are configurable and traceable.

## Missing Data

Missing data reduces confidence and is recorded in dimension traces. Missing Equipment DNA scores are not converted into zero capability.

## Score Bands

- 98-100: Exceptional Match
- 92-97.99: Excellent Match
- 85-91.99: Very Good Match
- 75-84.99: Good Match
- 65-74.99: Conditional Match
- Below 65: Not Recommended

## Confidence

Recommendation confidence considers Player DNA confidence, Player DNA completeness, Equipment DNA completeness, evidence confidence, scored dimensions, missing data, model-level versus variant-specific intelligence, and scoring configuration maturity. MVP automated recommendations are capped below `validated`.

## Ranking

Ranking uses:

1. Match score
2. Recommendation confidence
3. Development goal fit
4. Evidence confidence
5. Profile completeness
6. Equipment ID

Brand popularity is not a tie-breaker and is not a scoring factor.

## Why-Not Comparisons

Why-not explanations compare player-specific trade-offs between ranked items. They should explain why one item ranked higher without claiming the alternative is bad.

## Persistence

Recommendation runs are historical. The repository stores:

- Recommendation-level input hash, trace summary, score breakdown, confidence, and full trace.
- RecommendationItem rank, variant, match score, confidence, match band, dimension breakdown, eligibility trace, and trade-offs.
- Timeline and platform events inside the same transaction.

Identical requests return the existing recommendation unless `forceRegenerate` is true. `forceRegenerate` creates a new historical recommendation.

## Demo Recommendation Workflow

Ticket #016 adds a development scenario for end-to-end validation:

- Player: Jackson Sanders, 11-year-old travel baseball player.
- Current bat: 2026 Rawlings ICON USA, 30 inch, drop 8.
- Feedback: likes light swing, good pop, and large sweet spot.
- Goal: improve bat control.
- Equipment set: Rawlings ICON, Easton Hype Fire, and Louisville Slugger Atlas, each with USA 29/-10, 30/-10, 30/-8, and 31/-8 variants.

Seed the demo data:

```powershell
pnpm seed
```

Generate the development recommendation:

```powershell
pnpm --filter @ninery/api dev
curl http://localhost:3001/dev/demo/recommendation
```

The endpoint is development-only and intentionally unauthenticated. It loads the seeded demo player, generates Player DNA through `@ninery/player-intelligence`, reads eligible Equipment DNA through `@ninery/equipment-intelligence`, scores through this package, persists the recommendation, and returns the trace summary.

Inspect the full Recommendation Trace in:

- `Recommendation.recommendationTrace`
- `RecommendationItem.recommendationTrace`
- `RecommendationItem.scoreBreakdown`
- `RecommendationItem.eligibilityStatus`

The endpoint also prints a console summary with Player DNA, top recommendations, trade-offs, and filtered equipment.

## Warnings

1. A match score represents compatibility based on available information. It is not a guarantee of player performance.
2. Recommendation scores should be calibrated as Ninery gathers verified outcome data.
3. Popularity, sponsorship, and manufacturer marketing must not influence scoring unless explicitly represented as transparent user preferences.

## MVP Limitations

- Variant-specific DNA adjustments are not implemented yet.
- Outcome-calibrated weights are future work.
- Development authorization is not production family/player access control.
- Raw scoring explanations are structured for correctness; later AI may rewrite tone but must not invent reasoning.
