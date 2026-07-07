# DATM Besu Experiment Framework

Experimental workspace for evaluating three Decentralized Adaptive Trust Manager (DATM) variants on a private Hyperledger Besu network, with offline validation, contract testing, deployment tooling, and live experiment runners kept separate from Kubernetes and Besu infrastructure management.


## Overview

This repository supports a paper-oriented comparison of three DATM architectures:

- `Variant A`: off-chain DATM, on-chain storage only
- `Variant B`: off-chain normalization, on-chain final ATS calculation
- `Variant C`: on-chain behavior-score and ATS calculation from raw indicators

The experiment workspace is intentionally isolated from:

- Kubernetes manifests
- Helm charts
- genesis files
- validator configuration
- cluster lifecycle operations

It focuses on experiment logic, smart contracts, reproducible workload definitions, CSV export, and live Besu-backed measurements.

## Scope

The baseline experiment design uses:

- `10` entities
- `4` normal entities
- `3` suspicious entities
- `3` malicious entities
- trust updates every `10` seconds
- default duration `5` minutes
- `30` rounds
- `300` logical observations

The live short-run mode also supports a compressed validation workload:

- `RUN_MODE=short`
- `DURATION_SEC=60`
- `UPDATE_INTERVAL_SEC=10`
- `6` logical rounds
- `60` logical observations
- `180` blockchain trust-update transactions across variants A/B/C

## Shared Trust Model

The shared model used across documentation, formulas, tests, and runners is:

- `subjectId`: `bytes32`
- ATS range: `0..100`
- trust states: `Unknown`, `Trusted`, `Suspicious`, `Untrusted`

Thresholds:

- `Trusted`: `ATS >= 80`
- `Suspicious`: `50 <= ATS < 80`
- `Untrusted`: `ATS < 50`

ATS is computed with integer arithmetic:

```text
ATS = wI*I + wC*C + wB*B + wH*H
```

Default weights:

- `wI = 25`
- `wC = 25`
- `wB = 30`
- `wH = 20`

Behavior score is derived from penalty-weighted behavioral indicators and then clamped to `0..100`.

## What We Measure

The framework is designed to measure:

- gas used per trust update
- transaction confirmation latency
- block inclusion latency
- DATM processing time
- end-to-end trust update latency
- trust registry read latency
- trust updates per second and per minute
- storage growth and number of on-chain events
- classification consistency across variants

## Repository Layout

```text
contracts/     Solidity contracts for Variant A/B/C and shared logic
datm/          Shared trust formulas used offline and in validation
runner/        Compile, dry-run, live-run, verification, and sample loaders
collectors/    CSV row builders and output helpers
analysis/      Validation and post-processing scripts
scenarios/     Sample entities and deterministic update fixtures
docs/          Experiment design, metrics schema, deployment and runner plans
artifacts/     Generated local Solidity artifacts
results/       Deployment records and CSV outputs
scripts/       Besu deployment scripts
test/          Contract unit tests
```

## End-To-End Workflow

The intended workflow for the paper experiment is:

1. Define the trust model, ATS formulas, workload profiles, and CSV schemas.
2. Validate sample entities, worked examples, and deterministic scenarios offline.
3. Compile and unit-test the three contract variants locally.
4. Run the offline dry-run generator to validate workload shape and CSV structure.
5. Prepare `.env` values for Besu RPC access and the deployer account.
6. Deploy `TrustRegistryA`, `TrustRegistryB`, and `TrustRegistryC`.
7. Verify that deployed bytecode exists at the configured addresses.
8. Run a live preflight using one update and one read per variant.
9. Run a longer live experiment and export raw CSV data for analysis.
10. Analyze gas, latency, throughput, storage/event growth, and cross-variant consistency.

## Current Status

Implemented:

- design and schema documents for the paper experiment
- subject ID specification and scenario examples
- Solidity contracts for Variants A, B, and C
- local compile and unit-test workflow
- deterministic offline dry-run generator
- deployment script for live Besu deployment
- read-only deployment verifier
- live preflight runner
- experimental live short-run runner

Current caveat:

- the live short-run path works logically, but successful completion depends heavily on RPC stability and throughput
- the external HTTP RPC used during development has shown intermittent `noNetwork` and `ECONNREFUSED` failures
- when publishing results, prefer a stable private/internal RPC path for the live run

## Requirements

- Node.js
- npm

Development note:

- the toolchain has been exercised in this workspace on `Node v12.22.9`
- Hardhat warns that newer Node releases are preferred
- for a cleaner standalone setup, a modern Node LTS version is recommended

## Installation

Install dependencies inside this experiment repository only:

```bash
npm install
```

## Environment Configuration

Create a local `.env` file from `.env.example`.

Expected variables:

```text
BESU_RPC_URL=
PRIVATE_KEY=
FROM_PK=
VARIANT_A_CONTRACT=
VARIANT_B_CONTRACT=
VARIANT_C_CONTRACT=
RUN_MODE=preflight
UPDATE_INTERVAL_SEC=10
DURATION_SEC=300
```

Notes:

- `.env` is intentionally gitignored
- use either `PRIVATE_KEY` or `FROM_PK`
- never commit private keys

## Useful Commands

Compile contracts:

```bash
npm run compile
```

Run unit tests:

```bash
npm test
```

Validate worked examples and sample scenarios:

```bash
npm run validate:samples
```

Generate sample CSV fixtures:

```bash
npm run generate:csv
```

Run the offline dry-run experiment:

```bash
npm run experiment:dry
```

Deploy contracts to Besu:

```bash
npm run deploy:contracts
```

Verify deployed contracts:

```bash
npm run verify:deployment
```

Run the live experiment runner:

```bash
npm run experiment:live
```

## Live Execution Modes

### Preflight

Use:

- `RUN_MODE=preflight`

Behavior:

- one update transaction per variant
- one read per variant
- exports:
  - `results/raw/updates.preflight.csv`
  - `results/raw/reads.preflight.csv`
  - `results/raw/events_storage.preflight.csv`
  - `results/raw/consistency.preflight.csv`

Purpose:

- verify deployed contracts
- verify end-to-end transaction path
- compare live outputs against expected dry-run values

### Short

Use:

- `RUN_MODE=short`
- `DURATION_SEC=60`
- `UPDATE_INTERVAL_SEC=10`

Behavior:

- 10 entities
- 6 logical rounds
- 60 logical observations
- 180 update transactions across variants A/B/C

Exports on success:

- `results/raw/updates.short.csv`
- `results/raw/reads.short.csv`
- `results/raw/events_storage.short.csv`
- `results/raw/consistency.short.csv`

Important note:

- this mode is intended for a live measurement run, not just a syntax check
- if the RPC endpoint is unstable, the run may fail before CSV export completes

## Output Files

### Dry Run

- `results/raw/updates.dry.csv`
- `results/raw/reads.dry.csv`
- `results/raw/events_storage.dry.csv`
- `results/raw/consistency.dry.csv`

These contain synthetic timing values and offline calculations only.

### Deployment

- `results/raw/deployed_contracts.json`

This stores:

- deployment timestamp
- RPC URL
- chainId
- deployer address
- contract addresses
- deployment transaction metadata

### Live Run

Depending on mode, the runner exports:

- `updates.*.csv`
- `reads.*.csv`
- `events_storage.*.csv`
- `consistency.*.csv`

These CSVs are designed to support gas, latency, throughput, storage, and consistency analysis for the paper.

## How To Use This Repository

### 1. Read The Design

Start with:

- [docs/experiment_spec.md](docs/experiment_spec.md)
- [docs/contracts_interface_spec.md](docs/contracts_interface_spec.md)
- [docs/workload_profile_spec.md](docs/workload_profile_spec.md)
- [docs/scenario_schema.md](docs/scenario_schema.md)
- [docs/metrics_schema.md](docs/metrics_schema.md)

### 2. Validate Offline Logic

```bash
npm run validate:samples
```

### 3. Compile And Test

```bash
npm run compile
npm test
```

This verifies:

- Variant A storage behavior
- Variant B ATS calculation and classification
- Variant C behavior-score and ATS calculation
- trust-state threshold boundaries

### 4. Run The Offline Dry Run

```bash
npm run experiment:dry
```

### 5. Deploy And Verify Live Contracts

```bash
npm run deploy:contracts
npm run verify:deployment
```

### 6. Run Live Preflight

Set:

```text
RUN_MODE=preflight
```

Then run:

```bash
npm run experiment:live
```

### 7. Run A Live Measurement Workload

Set either:

- the default 5-minute configuration
- or the short-run configuration for quicker validation

Then run:

```bash
npm run experiment:live
```

## Key Documentation

- [docs/experiment_spec.md](docs/experiment_spec.md)
- [docs/contracts_interface_spec.md](docs/contracts_interface_spec.md)
- [docs/workload_profile_spec.md](docs/workload_profile_spec.md)
- [docs/scenario_schema.md](docs/scenario_schema.md)
- [docs/metrics_schema.md](docs/metrics_schema.md)
- [docs/runner_plan.md](docs/runner_plan.md)
- [docs/live_runner_plan.md](docs/live_runner_plan.md)
- [docs/deployment_plan.md](docs/deployment_plan.md)
- [docs/subject_id_spec.md](docs/subject_id_spec.md)
- [docs/scenario_examples.md](docs/scenario_examples.md)
- [docs/csv_examples.md](docs/csv_examples.md)

## Safety Principles

This repository should not be used to:

- modify Kubernetes resources
- modify Helm charts
- manage validator keys
- alter genesis configuration
- restart cluster services

The Besu RPC endpoint is treated as an external service interface for experiment execution only.

## License

No license file has been added yet.
