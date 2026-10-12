# Ticket #083: Stronger Evidence Dependence v1.0

The pure assessment consumes #082 decisions and provenance captured by the #081 protected snapshot. A separate wrapper returns the unchanged construct projection alongside relationship diagnostics. No new reads, tables, migrations, or authority are introduced.

Human v1.1 records use persisted sessionId and evaluator identities. Physical measurement v1.0 records use measurementSessionId, operatorId, specimenReference and instrument.instrumentReference. Conflicting actor fields, duplicate record IDs and malformed references fail closed. Shared specimen/instrument relationships mean common acquisition context, not identical observations or complete source dependence. Different dimensions in one session are not duplicates. Relationships are pairwise only; no transitive grouping or positive independence is inferred.

Optional upstreamClaimId has no established stronger-evidence endpoint type and remains unresolved. inputEvidenceReferences may explicitly identify existing writer source references in physical-measurement:1.0 or physical-bat-evaluation:1.1 namespaces. A directed link requires a unique endpoint captured in the same snapshot whose source type and protocol/session/dimension reconstruct that exact reference. Bare IDs, external claim IDs and unsupported namespaces never resolve. Shared supported upstream references indicate a documented common input, not independence. The acquisition writers do not normally populate these optional links; none are fabricated.

Excluded, unresolved, inactive and out-of-scope records are diagnostic only. Supporting context is not assessed as stronger evidence. Both independentGroups and knownIndependentStrongerGroups remain empty. Legacy evaluator-derived counts are not inputs. Direct evidence counts, calibration restrictions, current/historical support and all zero-authority flags remain unchanged.

The wrapper uses one existing read-only RepeatableRead snapshot, including runtime settings verification. The standalone #080 boolean bypass remains outside scope and requires separate remediation; the wrapper never invokes that unsafe root-client entry path.

Tests cover authentic writer shapes, shared acquisition references, unknown upstream endpoints, duplicate/conflicting identity, invalid statuses, input immutability, deterministic ordering and non-transitive edges. Positive source independence, cross-record comparability, empirical sufficiency, aggregation, synthesis and downstream recommendation authority remain prohibited.

## Local verification

After acquisition-identity remediation, Equipment Intelligence: 446 tests passed, including 43 focused dependence tests; database unit suite: 86 tests passed. Both packages built and passed explicit no-emit typechecks. Recommendation Intelligence typecheck, Prisma schema validation and git diff checks passed.

The original PostgreSQL attempt was blocked by intermittent localhost connectivity, schema-engine errors and ultimately P1001; that attempt was not a passing integration run. Recovery used the isolated PostgreSQL 16.15 cluster under the temporary ninery-ticket083-pg directory on localhost port 55438 and a newly created ticket_079_disposable_083_recovery database. Server identity and database isolation were verified through SQL. With connect_timeout=30, all eight existing migrations applied and all 52 integration tests passed, with zero failures or skips. The recovery database was dropped and the server stopped. Development and production databases were not used. The exact host component responsible for the original connection interruptions remains unconfirmed.

Normal dependence assessment verifies each supported record's source reference against the writer-defined acquisition session and dimension: physical-measurement:1.0:<measurementSessionId>:<measurementType> or physical-bat-evaluation:1.1:<sessionId>:<dimensionKey>. Contradictions remain diagnostic with conflicting_provenance and cannot produce trusted acquisition relationships. This does not change #082 dispositions or direct-evidence counts.

The corrective patch was also verified against a newly created ticket_079_disposable_083_patch database in the same verified disposable PostgreSQL 16.15 cluster. All eight migrations applied and the complete serial integration suite again passed 52 tests, with zero failures or skips, including the populated upgrade and #083 concurrent snapshot regression.
