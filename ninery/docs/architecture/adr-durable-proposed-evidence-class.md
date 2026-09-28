# Durable proposed evidence class

Ticket #078 adds nullable `ExternalEvidenceNormalizedClaim.proposedEvidenceClass`
as qualification-input provenance. It is not evidence authority and is not
interchangeable with the governed `evidenceClass`.

New #076 ingestion validates one proposal through the existing six-class
contract. The same proposal feeds #070 and is persisted independently of
the governed classification. External subjective/comparative claims retain
`evidenceClass = unclassified`.

The proposal participates in new normalized semantic identities, so a changed
proposal creates new normalized and qualification history rather than replaying
the prior assessment. Historical NULL rows retain their original identity
formula and remain readable. The migration does not backfill them.

Convergence must call `requireDurableProposedEvidenceClass` on the durable
field. NULL fails with `missing_durable_proposed_evidence_class`; neither Q1
nor the governed classification is a fallback. This field alone creates no
supporting, canonical, numeric, synthesis, or recommendation authority.

The Q2 convergence operation and #077 current-Q2 projection now consume this
durable input. See [Governed Qualification Convergence](adr-reviewed-dimension-qualification-convergence.md)
for currentness, locking, history, and the #075 STOP boundary.
