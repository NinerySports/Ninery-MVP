# ADR: Verified External Reference Equipment

## Status

Accepted for Ticket #049.

## Context

Structured physical bat evaluation can use reference equipment before every possible comparison bat has been onboarded into the Ninery catalog. The first practical case is a 2023 Louisville Slugger Omaha USA 30/19/-11 used as comparison context for the 2023 DeMarini The Goods USA 30/20/-10.

## Decision

Physical evaluation references are explicitly typed:

- `catalog_reference`: a Ninery catalog equipment/variant reference with catalog IDs.
- `verified_external_reference`: a physically verified comparison bat that is not a Ninery recommendation product.

Verified external references require manufacturer, model, model year, certification, length, weight, drop, condition, verification source, verified timestamp, and verifier. They may include barrel diameter and product/model identifiers. They must not receive placeholder catalog IDs.

## Boundaries

Verified external references are evaluation instruments only. They do not create Equipment DNA for the reference bat, activate recommendations, onboard a catalog product, create BatMatch eligibility, or become Player/Transition Compatibility evidence.

## Consequences

The DeMarini/Omaha comparative evaluation can be prepared safely without catalog-onboarding the Omaha. The 1 oz / one-drop difference and construction difference are preserved as limitations rather than normalized away.
