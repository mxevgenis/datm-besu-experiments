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

The live paced mode is designed for QBFT networks that produce blocks every `10` seconds and cannot reliably handle burst submission.

Based on the current live validation campaign, paced mode is the recommended execution path for all Besu-backed measurements in this repository.

For paper-facing comparison and scalability analysis, the recommended execution path is now the `variant-batch` live mode, where each round submits one variant at a time for all entities in the current workload slice.

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
- same-block inclusion ratio for batched updates

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

## Current Experimental Results

Two result sets are currently derived in this workspace:

- `variant comparison` at `10` entities using `3` rounds per variant
- `scalability comparison` for `3`, `6`, `9`, and `10` entities using `3` rounds per point

Derived outputs are written under:

- [results/derived](/home/ubuntu/besu-testbed/experiments/datm-paper/results/derived)

Most relevant artifacts:

- [variant_comparison_summary.md](/home/ubuntu/besu-testbed/experiments/datm-paper/results/derived/variant_comparison_summary.md)
- [variant_scalability_summary.md](/home/ubuntu/besu-testbed/experiments/datm-paper/results/derived/variant_scalability_summary.md)
- [paper_results_scalability.md](/home/ubuntu/besu-testbed/experiments/datm-paper/docs/paper_results_scalability.md)

Scalability figures:

- [scalability_confirmation_latency.svg](/home/ubuntu/besu-testbed/experiments/datm-paper/results/derived/scalability_plots/scalability_confirmation_latency.svg)
- [scalability_gas_used.svg](/home/ubuntu/besu-testbed/experiments/datm-paper/results/derived/scalability_plots/scalability_gas_used.svg)
- [scalability_read_latency.svg](/home/ubuntu/besu-testbed/experiments/datm-paper/results/derived/scalability_plots/scalability_read_latency.svg)
- [scalability_same_block_ratio.svg](/home/ubuntu/besu-testbed/experiments/datm-paper/results/derived/scalability_plots/scalability_same_block_ratio.svg)

Current headline conclusion:

- `Variant A` is the lowest-gas option.
- `Variant B` provides the best overall balance of gas cost, confirmation latency, and scalability stability.
- `Variant C` preserves strong same-block inclusion but is the heaviest and most latency-variable option.

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
- QBFT-aware paced live runner with retries, staggered submission, and incremental CSV flushing
- batched single-variant live runner for controlled comparison and scalability campaigns
- offline comparison and scalability analysis scripts with SVG figure generation

Current caveat:

- the live short-run path works logically, but successful completion depends heavily on RPC stability and throughput
- the external HTTP RPC used during development has shown intermittent `noNetwork` and `ECONNREFUSED` failures
- when publishing results, prefer a stable private/internal RPC path for the live run

Observed live operating envelope on the current external RPC path:

- successful: `1 entity x 1 round`
- successful: `1 entity x 2 rounds`
- successful: `1 entity x 3 rounds`
- successful: `2 entities x 1 round`
- successful: `2 entities x 2 rounds`
- successful: `3 entities x 1 round`
- unstable/failing: `3 entities x 2 rounds`

Interpretation:

- the implementation itself is functioning correctly
- the dominant limitation is RPC stability under wider paced workloads
- the current safe operating envelope for repeatable live runs is at or below `2 entities x 2 rounds`

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
BLOCK_PERIOD_SEC=10
ROUND_STAGGER_MS=1500
SUBMIT_RETRY_MAX=3
SUBMIT_RETRY_BACKOFF_MS=3000
ENTITY_LIMIT=
ROUND_LIMIT=
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

Generate the variant comparison summary and plots:

```bash
npm run analyze:variants
```

Generate the scalability summary and plots:

```bash
npm run analyze:scalability
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

### Paced

Use:

- `RUN_MODE=paced`
- `BLOCK_PERIOD_SEC=10`
- `ROUND_STAGGER_MS=1500`

Optional controls:

- `ENTITY_LIMIT=1` for very small live validation
- `ROUND_LIMIT=1`, `ROUND_LIMIT=2`, or `ROUND_LIMIT=3` for progressive load testing
- `SUBMIT_RETRY_MAX` and `SUBMIT_RETRY_BACKOFF_MS` for transient RPC failures

Behavior:

- aligns submission to the chain cadence instead of bursting transactions
- staggers A/B/C updates inside each round
- retries failed submissions with backoff
- flushes CSV files incrementally so partial progress is preserved

Exports on success or partial progress:

- `results/raw/updates.paced.csv`
- `results/raw/reads.paced.csv`
- `results/raw/events_storage.paced.csv`
- `results/raw/consistency.paced.csv`

Recommended live use:

- use `paced` mode for all paper-oriented live measurements
- treat `short` mode as a stress/diagnostic path, not the default measurement path
- scale entity count and round count gradually

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

## Recommended Live Methodology

For the current RPC endpoint and QBFT configuration, the recommended methodology is:

1. Deploy fresh contracts before each formal measurement campaign.
2. Verify deployment with `npm run verify:deployment`.
3. Run `preflight` to confirm end-to-end correctness on the active contracts.
4. Use `paced` mode for live measurements.
5. Keep the current pacing defaults unless you have evidence the endpoint can support more:
   - `BLOCK_PERIOD_SEC=10`
   - `ROUND_STAGGER_MS=1500`
   - `SUBMIT_RETRY_MAX=3`
   - `SUBMIT_RETRY_BACKOFF_MS=3000`
6. Use the current proven safe live envelope as the baseline:
   - up to `2 entities`
   - up to `2 rounds`
7. Treat any larger live runs as exploratory unless they are repeated successfully.

What this means for the paper:

- use live Besu runs to support gas comparisons, latency observations, and cross-variant correctness under controlled low-to-moderate load
- use dry-run generation and scenario specifications to define the full target workload
- explicitly report that larger live workloads were constrained by RPC operational stability, not by smart-contract correctness

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
