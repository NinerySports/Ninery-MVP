# Equipment Claim Qualification Contract

## Status

Accepted for Ticket #070 as a domain-only trust gate. It creates in-memory proposals and performs no persistence, synthesis, or recommendation work.

## Decision

Acquisition is permissive; qualification is conservative. `qualifyEquipmentClaim()` evaluates one normalized claim under `EQUIPMENT_CLAIM_QUALIFICATION_CONTRACT_VERSION = "1.0"` and returns `qualified`, `context_only`, `review_required`, or `not_eligible` with deterministic reasons, gaps, blockers, warnings, limitations, and firewalls.

Qualification is distinct from verification, human review, evidence class, construct role, synthesis readiness, canonicalization, and recommendation eligibility. None implies another.

## Decision table

| Claim | Source and method | Identity/review | v1.0 result | Evidence class |
|---|---|---|---|---|
| Factual nominal specification | Authoritative manufacturer/certification/official document | Exact model or variant; source confirmed; review sufficient | `qualified` | `verified_catalog_fact` |
| Syndicated retailer specification | Known manufacturer dependency | Exact; lineage known | `context_only` | None proposed; repetition stays in upstream group |
| Retailer-only fact | Secondary retailer; dependency unknown | Exact | `review_required` | None until authority and dependency review |
| Marketing behavior claim | Any source | Any review | `not_eligible` | None |
| Unstructured expert observation | Independent review article/video | Exact and reviewed | `context_only` | No existing class is broadened |
| Structured human observation | Known evaluator, survey/rubric and source | Exact; source confirmed; reviewed | `qualified` | `structured_human_evaluation` |
| Structured field observation | Known instrument/context | Exact; source confirmed; reviewed | `qualified` | `structured_field_observation` |
| Physical measurement | Known Ninery method and specimen scope | Exact; source confirmed; reviewed | `qualified` | `direct_physical_measurement` |
| Controlled test | Known protocol, conditions and test source | Exact; source confirmed; reviewed | `qualified` | `controlled_mechanical_test` |
| Modeled output | Known model/version and immutable input lineage | Exact; source confirmed; reviewed | `qualified` | `modeled_estimate` only |
| Unreviewed AI extraction | Any underlying source | Extraction review incomplete | `review_required` | None |

An AI-extracted manufacturer fact may qualify after review because of the underlying manufacturer claim, not because AI extracted it.

## Reasons, gaps, and blockers

Stable reason codes explain positive facts such as exact scope, factual claim type, authoritative claim-specific source, source confirmation, structured method, inherited dependency, model lineage, and underlying-source authority.

Gaps identify remediable incompleteness: authority review, unknown dependency, extraction review, absent construct policy, or incomplete structured-method metadata. Blockers identify disqualifying state: unresolved/mismatched identity, conflict, supersession, rejected review, marketing behavior, evidence-class mismatch, missing model lineage, or missing claim.

Warnings and all source, normalized-claim, relationship, and model limitations survive qualification. Arrays are deduplicated and sorted for deterministic output.

## Qualification examples

```text
Claim: nominal_weight = 20 oz
State: qualified
Class: verified_catalog_fact
Reasons: exact identity, factual specification, authoritative source, source confirmed
Limitation: nominal catalog specification; not actual specimen mass
Independence: lineage-manufacturer
Contract: 1.0
Proposed evidence: yes, in memory only
```

```text
Claim: "Massive sweet spot"
State: not_eligible
Reason: marketing claim; source is not behavioral authority
Blocked target: usable_contact_region_breadth
Raw acquisition claim retained: yes
Proposed evidence: no
```

```text
Claim: "Easy to get through the zone"
Source: independent unstructured reviewer
State: context_only
Descriptor: easy_to_swing
Candidate: startup_demand
Construct value: none
Reason: unstructured-observation qualification policy is not established
```

## Authority, identity, dependency, and conflict

Authority is assessed as source x claim type x target. Manufacturer behavioral marketing cannot reuse its catalog authority. Source confirmation, independence, or human acceptance alone is insufficient.

Only exact variant and equipment-model scopes can qualify. Family-only, ambiguous, conflicting, unresolved, wrong-year, wrong-certification, and wrong-variant claims fail closed. The adapter never invents a target.

Known retailer syndication retains its upstream group and remains context only. Unknown dependency requires review. A model output inherits all input lineage and cannot corroborate an input.

Current independent disagreements trigger `review_required`. No winner, averaging, tolerance, or materiality threshold is created. Superseded claims remain historical and cannot qualify as current.

## Proposed evidence adapter

A qualified result may contain an in-memory `ProposedEquipmentDNAEvidenceInput`. It preserves source/document/raw/normalized/extraction IDs, authority, verification, review, dependency, independence group, contract version, raw and normalized values, limitations, and conservative evidence role.

Known nominal keys map explicitly: `nominal_length -> length` and `nominal_weight -> weight`. Nominal weight remains distinct from actual specimen mass. Construct roles default to `supporting_context`; only an explicitly accepted relationship can retain direct or calibration role.

No proposed input is persisted. Qualification grants neither canonical value, synthesis eligibility, nor recommendation eligibility.

## Six-class semantic audit

| Evidence class | Truthful scalable fit | Does not fit | Assessment |
|---|---|---|---|
| `verified_catalog_fact` | Source-confirmed identity/specifications from claim-authoritative sources | Marketing or behavioral opinion | Name remains precise; broadening is dangerous |
| `direct_physical_measurement` | Instrumented specimen observations with method/provenance | Catalog nominal values or perceived behavior | Precise and unchanged |
| `controlled_mechanical_test` | Results from a disclosed controlled fixture/protocol | Casual review or human feel | Precise; calibration meaning remains downstream |
| `structured_human_evaluation` | Defined rubric/survey/protocol with evaluator and context | Unstructured review article/video | Must not be broadened |
| `structured_field_observation` | Defined field instrument with player/session/context provenance | Public anecdote or forum comment | Must not be broadened |
| `modeled_estimate` | Versioned inference with immutable input lineage | Observation, measurement, or independent corroboration | Precise and unchanged |

**Unstructured expert reviews cannot truthfully fit an existing qualified evidence class under v1.0.** They remain acquisition-layer `context_only`. A future additive class such as unstructured observational claim may be considered only after governance review; Ticket #070 does not add one.

## EquipmentDNAEvidenceRecord compatibility audit

The current record can carry equipment/variant target, source name/type/reference, dates, raw and normalized JSON, unit, method, notes, status, and evaluator fields. Qualification provenance can therefore be proposed without destructive schema change.

Limitations:

- Document, raw claim, normalized claim, extraction run, independence group, verification/review, role, and qualification version are JSON/reference metadata rather than first-class foreign keys.
- Ticket #066 currently derives independence primarily from evaluator, specimen, or session fields; it does not consume acquisition `independenceGroupId` directly.
- Controlled tests require the existing `sourceType: other` plus `instrument_measurement` projection so #066 classifies them as `controlled_mechanical_test`; source origin remains in provenance JSON.
- The Ticket #020 evidence validator is canonical-attribute/registry oriented. Candidate construct claims and some specimen-targeted facts require a future qualified-evidence ingestion validator rather than weakening that validator.

These are future schema/adapter/read-model concerns, not a fundamental boundary failure. Ticket #069's additive source/document/claim proposal still stands; it should add an explicit qualification decision/version and qualified-evidence link when persistence is authorized.

## Compatibility and next work

Ticket #069 provenance semantics, physical and human evidence architecture, Ticket #066, and Ticket #067 remain unchanged. No real Atlas claim is created.

Ticket #071 should design the smallest persistence proposal for source/document/claim records and append-only qualification decisions, including an explicit link to a subsequently created `EquipmentDNAEvidenceRecord`. It must require migration approval and should not begin external ingestion, scraping, production AI, synthesis, or recommendation integration.
