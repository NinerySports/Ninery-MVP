# Ninery Physical Measurement Protocol v1.0

This protocol records objective observations about one identified physical bat. It does not determine swing effort, bat control, forgiveness, sweet spot, performance, or recommendation quality.

## Minimum kit

- A digital scale with gram-level resolution when practical
- A rigid measuring rule with millimeter markings
- Digital calipers with sufficient jaw capacity
- A stable, narrow balance fixture
- A flat measurement surface
- Optional level, camera, and specimen labels

Record each instrument's stable reference, type, available resolution, calibration state, and notes. `operator_checked` means the operator performed the documented zero/reference check; it is not certified calibration.

## Before measuring

1. Assign a stable specimen reference to the physical bat. This is not the equipment ID, variant UUID, or SKU.
2. Verify the equipment and variant identity, manufacturer, model, model year, certification, and nominal length, weight, and drop.
3. Record the operator, session ID, date, condition, modifications, environment, and limitations.
4. Do not represent a damaged specimen as factory-standard. Describe grip tape, aftermarket grips, knob accessories, sensors, weights, end-cap damage, and other modifications.

## Measurements

Perform at least three trials for every measurement. Remove and reposition the bat before each trial. Preserve every raw value and its original unit. The system derives the median because it is deterministic and less sensitive to a single unstable reading; the acceptance threshold remains `calibration_pending` until Ninery has empirical repeatability data.

### Actual mass

Place a zeroed digital scale on a stable, level surface. Center the entire unsupported bat on it, remove operator contact, wait for a stable reading, and record grams when available. Document non-standard removable accessories. Nominal catalog weight remains unchanged.

### Overall length

Place the bat on a flat surface along a rigid rule. Measure along the longitudinal axis from the furthest physical knob endpoint to the furthest barrel or end-cap endpoint. Use tangent endpoints consistently despite curved geometry. Record millimeters when available.

### Balance point

Place the bat horizontally on a narrow stable fulcrum and locate neutral balance. Measure from the furthest knob endpoint to the balance location along the longitudinal axis. Remove the bat and relocate balance for each trial. This is not swing weight, moment of inertia, swing effort, or bat control.

### Barrel diameter

Using suitable digital calipers, search longitudinally for the maximum external barrel diameter and repeat at different rotational orientations. Record the location and direct-caliper method. If jaw capacity is insufficient, use the separately identified circumference-derived method or record a deviation. Diameter does not establish forgiveness or sweet spot.

When calipers are impractical, select `circumference_derived_diameter`. At the widest observed barrel location, wrap a flexible measuring tape perpendicular to the bat axis without visible slack, compression, or angled wrapping. Remove and reposition it for every trial. Record circumference in inches or millimeters. Ninery takes the median circumference and derives diameter using `circumference / Math.PI`; the circumference remains the direct observation and the diameter is not an independent measurement.

### Handle diameter

Measure 152.4 mm (6.0 in) from the furthest knob endpoint. This is a Ninery operational convention, not an industry standard. Do not destructively remove a factory grip. Record `factory_grip_outer_diameter`, `aftermarket_grip_outer_diameter`, or `bare_handle` truthfully.

When using a flexible tape, select `circumference_derived_outer_diameter`. Keep the tape perpendicular at the same 152.4 mm location, avoid slack or compression, and reposition it for every trial. Record circumference in inches or millimeters; the system derives outer diameter from the median using `circumference / Math.PI`. A result measured over a factory grip remains `factory_grip_outer_diameter` and never represents the bare handle.

## Quality and deviations

Quality states are descriptive: complete repeatable, complete with variation observed, incomplete, instrument uncertain, method deviation, physical identity uncertain, or blocked. Complete repeatable means only that the protocol was followed consistently; it is not a claim of laboratory validation. Record unstable instruments, insufficient caliper capacity, grip interference, unstable fixtures, damage, and uneven surfaces.

## Persistence

Validation and commit without `--confirm` are read-only. A confirmed eligible packet writes all five immutable evidence records in one transaction. The same session is idempotent; conflicting content at the same deterministic identity blocks rather than overwrites. A later session for the same specimen creates additional evidence.

## Commands

```cmd
pnpm equipment:physical-measurement:prepare -- --equipment=<equipment-uuid> --variant=<variant-uuid>
pnpm equipment:physical-measurement:prepare -- --equipment=<equipment-uuid> --variant=<variant-uuid> --barrel-method=circumference-derived --handle-method=circumference-derived
pnpm equipment:physical-measurement:validate -- --file=<packet.json>
pnpm equipment:physical-measurement:status -- --file=<packet.json>
pnpm equipment:physical-measurement:commit -- --file=<packet.json>
pnpm equipment:physical-measurement:commit -- --file=<packet.json> --confirm
pnpm equipment:physical-measurement:report -- --file=<packet.json>
```

Never infer behavioral Equipment DNA or recommendation conclusions from these measurements. Measure first, preserve the raw observation, interpret later.

The read-only `status` command compares a packet with persisted evidence using semantic JSON equality. Object key order and omitted `undefined` properties do not matter. Finite numbers are canonicalized to 15 significant digits to absorb JSONB/IEEE-754 serialization noise. Identity, date, units, methods, raw trial order and values, specimen/operator/instrument provenance, measured surface/location, and derivation metadata must otherwise match exactly. Any meaningful difference remains an immutable-evidence conflict.
