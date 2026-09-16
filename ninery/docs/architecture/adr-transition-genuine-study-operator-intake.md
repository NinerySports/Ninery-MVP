# Transition Genuine Study Operator Intake

Ticket #042 makes the Ticket #041 genuine-study framework operational through guarded internal CLI/service tooling.

## Status

Accepted for internal extended-shadow operations.

## Decision

Delivery remains `service_and_cli_only`. The repository still does not contain a verified authenticated internal admin web framework, so this ticket adds no public form, public API, internal web route, parent portal, coach portal, or player portal.

## Authorization

Write commands require `--actor`. Actors are resolved through the existing Ticket #039 role/capability model. The CLI does not accept arbitrary capability strings and does not support `--admin=true`.

The initial development actor IDs are:

- `transition-operator`
- `transition-admin`

Unknown or missing actors fail closed.

## Environment Guard

Write commands require a permitted internal environment: `development`, `test`, or `internal`. Unsupported environments fail closed.

## Two-Step Commit

Operators first run `prepare` to receive a pre-commit review. `prepare` performs validation and persists nothing.

Creation requires `create` plus `--confirm-genuine-study`. Dry runs use `--dry-run` and persist nothing.

## Persistence and Audit Atomicity

Lifecycle writes delegate to the Ticket #039 admin service and Ticket #041 genuine intake service. The CLI does not write study lifecycle rows directly. Required audit events are written through the shared repository abstraction. If a write path throws, the CLI reports failure and does not print a success message.

## Prediction Immutability

Prediction capture uses Transition Compatibility v1.1 only. It requires a genuine draft study and no existing observations. Duplicate prediction capture is blocked by the admin service.

## Observation Protocol

Observations reuse the Ticket #038 structured observation contract. First-use, early-session, and acclimation-period entries are captured as append-only records. Corrections require a reason and are also append-only.

## Genuine Data Protection

Ticket #042 does not seed genuine evidence. Fixture cleanup must target fixture classifications explicitly and must not bulk-delete genuine studies.

## Limitations

Prediction capture currently requires a file containing the compatibility input. A future internal UI or loader can reduce operator burden once authenticated internal administration exists.
