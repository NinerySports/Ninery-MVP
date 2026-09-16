# Real-World Equipment Behavioral Evaluation Operator Guide

Use this workflow after a real-world bat has catalog identity and objective specifications but lacks behavioral Equipment DNA.

## Commands

- `pnpm equipment:behavioral-evaluation:prepare -- --equipment=<equipment-id>`
- `pnpm equipment:behavioral-evaluation:evidence -- --equipment=<equipment-id>`
- `pnpm equipment:behavioral-evaluation:validate -- --equipment=<equipment-id>`
- `pnpm equipment:behavioral-evaluation:readiness -- --equipment=<equipment-id>`
- `pnpm equipment:behavioral-evaluation:commit -- --equipment=<equipment-id> --confirm`

Prepare, evidence, validate, and readiness are read-only. Commit requires explicit confirmation and should persist only supported behavioral evaluations.

## Evidence To Collect

For `swing_effort`, collect measured swing-weight, balance point, MOI, independent comparative swing-demand review, or structured Ninery physical evaluation.

For `forgiveness`, collect controlled off-center contact testing, independent mishit-response review, or structured Ninery barrel-response evaluation.

For `sweet_spot_support`, collect controlled usable-hitting-region evidence, independent sweet-spot review, or structured comparative barrel evaluation.

For `bat_control_support`, collect structured barrel-control evaluation, measured balance/swing-demand evidence paired with design review, or independent comparative control evaluation.

## Prohibited Inputs

Do not use Jackson Pilot Study #1 observations, Jackson feedback, transition outcomes, post-use performance, confidence compatibility, transition compatibility, or retrospective validation evidence as prospective Equipment DNA.

## Marketing Claims

Claims such as easy swinging, massive sweet spot, maximum control, or unmatched forgiveness may be retained as claims. They do not create exact numeric references or high-confidence values by themselves.

## Current DeMarini State

The 2023 DeMarini The Goods (-10) USA is catalog/specification ready but behavioral evidence is incomplete. Canonical profile readiness and genuine-study readiness remain blocked until legitimate behavioral evidence is collected.
