# Physical Evaluation Protocol v1.1 Preview

Protocol v1.1 is an operator-preview and calibration design derived from the five-evaluator DeMarini pilot. It does not replace Protocol v1.0, persist evidence, perform Evaluation #6, or authorize canonical interpretation.

The protocol separates dry-swing tasks into startup, sustained rotation, and redirect blocks. Bat-control questions isolate directional adjustment, path repeatability, and start/check/redirect control. Forgiveness uses six centered contacts, six intentional modest near-center handle-side misses, and six intentional modest near-center end-side misses. The same 18 swings support response degradation and apparent breadth; no duplicate swings are created for overlapping dimensions.

Sweet Spot Breadth and Sweet Spot Response Quality are candidate subconstructs under the existing `sweet_spot_support` analysis area. They are not registry additions or canonical Equipment DNA attributes. Future calibration observations must retain candidate-only status until a separate architecture decision approves a model change.

Any future v1.1 evidence must use version-distinct raw provenance and source references while preserving evaluator, session, trial-block, and contact-location information. Protocol v1.0 evidence remains immutable and is never migrated or reinterpreted.

Ticket #059 adds explicitly confirmed calibration persistence. Each dimension receives a deterministic UUID and `physical-bat-evaluation:1.1:<session>:<dimension>` source reference. The complete packet is written transactionally. Repeating identical content is a no-op; conflicting content under an existing identity is blocked because persisted calibration evidence is immutable.

The evaluator is blinded from prior observations, ordinals, synthesis, conflict/adjudication results, canonical values, and recommendations. The operator may identify the work as protocol calibration.

Protocol v1.1 records contain no normalized value and carry explicit false canonical, numeric-reference, and recommendation eligibility flags in raw provenance. Existing standalone/canonical synthesis requires different provenance and therefore cannot consume these records. The current Prisma evidence model already supports this distinction, so no schema change is required.

Protocol v1.1 must not be declared production-valid merely because a sixth evaluation can be performed. Future production consideration requires completed calibration sessions, construct-coherence review, stable operator execution, firewall verification, and a separate architecture decision.
