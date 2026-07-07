# Live Runner Plan

## Purpose

This document describes the Besu-backed live runner and deployment verifier for the DATM experiment workspace.

The live runner is designed to use environment variables only. It does not read secrets from source files and it must not print private keys.

## Environment Variables

Required:

- `BESU_RPC_URL`
- one of:
  - `PRIVATE_KEY`
  - `FROM_PK`
- `VARIANT_A_CONTRACT`
- `VARIANT_B_CONTRACT`
- `VARIANT_C_CONTRACT`

Supported run configuration:

- `RUN_MODE=preflight`
- `UPDATE_INTERVAL_SEC=10`
- `DURATION_SEC=300`

Default expected RPC value for this project context:

- `https://snf-83472.ok-kno.grnetcloud.net/rpc`

## Verification Script

Script:

- `runner/verify_deployment.js`

Purpose:

- confirm `BESU_RPC_URL` is configured
- confirm one sender key is configured
- confirm all three contract addresses are configured
- connect to Besu
- confirm bytecode exists at each configured address
- perform read-only `getTrustRecord` calls

It does not:

- deploy contracts
- write trust updates
- touch Kubernetes resources

## Live Runner

Script:

- `runner/run_experiment_live.js`

Current supported mode:

- `preflight`

The live runner refuses to run if:

- `BESU_RPC_URL` is missing
- neither `PRIVATE_KEY` nor `FROM_PK` is set
- any contract address is missing
- `RUN_MODE` is not `preflight`

## Preflight Mode

The first live mode is intentionally small and controlled.

It performs:

- one trust update to Variant A
- one trust update to Variant B
- one trust update to Variant C
- one read from each contract after its update

It prints for each variant:

- transaction hash
- gas used
- confirmation latency
- ATS
- trust state

## CSV Outputs

Preflight mode exports:

- `results/raw/updates.preflight.csv`
- `results/raw/reads.preflight.csv`
- `results/raw/events_storage.preflight.csv`
- `results/raw/consistency.preflight.csv`

These outputs follow the same structure as the dry-run CSV family, but they contain live transaction and read results for the preflight step.

## Workload Inputs

Preflight uses deterministic sample entities and the same shared scoring logic as the dry-run path.

It selects one canonical logical observation and submits that same input to:

- Variant A
- Variant B
- Variant C

This gives a minimal end-to-end signal before attempting a longer run and makes the first consistency check meaningful across variants.

## Safety Constraints

The live runner must:

- keep secrets in environment variables only
- never print the private key
- never write the private key to files
- never read the private key from source code
- never invoke `kubectl`
- never modify Kubernetes resources
- never restart any services

## Recommended Usage Sequence

1. Set environment variables.
2. Run:
   - `npm run verify:deployment`
3. If verification passes, run:
   - `npm run experiment:live`
4. Review the preflight CSVs and logs.
5. Only after successful preflight, extend the runner to support a longer timed experiment mode.
