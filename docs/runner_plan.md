# Runner Plan

## Purpose

This document describes the offline dry-run experiment runner for the DATM paper workspace.

The dry-run runner does not connect to Besu, does not deploy contracts, and does not touch Kubernetes resources. It exists to validate workload generation, cross-variant consistency, and CSV export shape before any live execution phase.

## Scope

The dry-run runner:

- loads `scenarios/sample_entities.json`
- generates a deterministic 10-entity workload
- expands the workload to 30 update rounds per entity
- produces 300 logical observations
- simulates Variant A, Variant B, and Variant C offline
- exports CSV outputs under `results/raw/`
- checks consistency across variants for each logical observation
- prints a concise experiment summary

## Workload Shape

Default dry-run parameters:

- entity count: `10`
- duration: `5 minutes`
- interval: `10 seconds`
- rounds: `30`
- logical observations: `10 * 30 = 300`

Variants simulated per logical observation:

- Variant A
- Variant B
- Variant C

Total variant update records in `updates.dry.csv`:

- `300 * 3 = 900`

## Deterministic Generation Strategy

Each entity is assigned a stable profile:

- `normal`
- `suspicious`
- `malicious`

For each profile, the runner uses deterministic score and indicator patterns based on:

- entity index
- sequence number
- profile type

This ensures:

- the same local input always produces the same outputs
- no randomness is required
- all variants receive semantically identical logical observations

## Variant Simulation

Variant A:

- computes ATS and trust state entirely offline
- exports the final ATS and trust state as if the contract stored them directly

Variant B:

- computes behavior score offline
- computes ATS from `identityScore`, `credentialScore`, `behaviorScore`, and `historyScore`

Variant C:

- computes behavior score from raw indicators
- computes ATS from `identityScore`, `credentialScore`, `historyScore`, and raw indicators

Consistency expectation:

- Variant A, Variant B, and Variant C should produce the same final trust state for the same logical input

## CSV Outputs

The dry-run runner exports:

- `results/raw/updates.dry.csv`
- `results/raw/reads.dry.csv`
- `results/raw/events_storage.dry.csv`
- `results/raw/consistency.dry.csv`

All timing and chain fields are synthetic dry-run placeholders and should be treated as simulation-only values.

## Synthetic Timing

The runner uses clearly synthetic timestamps and durations for:

- DATM processing time
- receipt time
- confirmation latency
- block inclusion latency
- end-to-end latency
- read latency

These values exist to validate CSV shape and downstream analysis, not to represent live blockchain performance.

## Summary Output

At the end of a run, the runner prints:

- number of entities
- number of logical updates
- number of consistency mismatches
- final trust state counts

## Safety

The dry-run runner:

- does not create network connections
- does not read `BESU_RPC_URL`
- does not use private keys
- does not invoke deployment scripts
- does not use `kubectl`
- does not modify files outside `experiments/datm-paper/`
