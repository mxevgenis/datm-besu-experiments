# Deployment Plan

## Purpose

This document explains how to prepare and deploy the DATM contract stubs from the isolated `experiments/datm-paper/` workspace without touching Kubernetes resources.

This plan is deployment-ready documentation only. It does not execute deployment.

## Prerequisites

Before deployment:

- work only inside `experiments/datm-paper/`
- ensure the contracts compile locally
- ensure you have a valid Besu JSON-RPC endpoint URL
- ensure you have a funded deployer private key for the target network
- ensure you understand which network you are targeting before sending any transactions

Required environment variables:

- `BESU_RPC_URL`
- `PRIVATE_KEY`

Optional reference fields for later reuse:

- `VARIANT_A_CONTRACT`
- `VARIANT_B_CONTRACT`
- `VARIANT_C_CONTRACT`

Recommended setup:

1. Copy `.env.example` to a local environment file you manage privately.
2. Fill in `BESU_RPC_URL` and `PRIVATE_KEY`.
3. Do not commit secrets.

## How To Compile

From `experiments/datm-paper/`:

```bash
npm run compile
```

Expected result:

- artifacts are generated under `artifacts/contracts/...`
- contract stubs are ready for deployment by the local deployment script

## How To Deploy

From `experiments/datm-paper/`:

```bash
npm run deploy:contracts
```

What the script does:

- reads `BESU_RPC_URL` and `PRIVATE_KEY` from environment variables
- refuses to run if either value is missing
- connects to the target JSON-RPC endpoint
- deploys `TrustRegistryA`
- deploys `TrustRegistryB`
- deploys `TrustRegistryC`
- waits for deployment receipts
- prints contract addresses
- writes a deployment record to `results/raw/deployed_contracts.json`

What the script does not do:

- it does not use `kubectl`
- it does not edit manifests
- it does not restart pods
- it does not modify `k8s/`, `helm/`, `genesis/`, `keys/`, or repository-root deployment files

## How To Verify Deployed Contracts

After a future deployment run, verify:

1. The script prints:
   - deployer address
   - target chain ID
   - deployment transaction hashes
   - deployed contract addresses
2. `results/raw/deployed_contracts.json` exists and includes:
   - `VARIANT_A_CONTRACT`
   - `VARIANT_B_CONTRACT`
   - `VARIANT_C_CONTRACT`
3. The deployment transaction receipts show success on the target chain.
4. Later, once you intentionally allow RPC interaction, you can verify basic read behavior by calling:
   - `getTrustRecord(subjectId)` on each contract

## How To Avoid Touching Kubernetes Resources

Keep deployment isolated by following these rules:

- run commands only from `experiments/datm-paper/`
- use the contract deployment script only
- do not run `kubectl`
- do not run Helm commands
- do not edit any files under:
  - `k8s/`
  - `helm/`
  - `genesis/`
  - `keys/`
- treat the Besu RPC endpoint as an external interface rather than a cluster-management task

If you later need to verify the contracts on-chain, do so through the RPC endpoint only, not by changing Kubernetes resources.

## Safety Notes

- Deployment sends real transactions to whatever RPC endpoint you configure.
- Confirm the target chain before running the deployment script.
- Confirm the deployer account has sufficient funds.
- Use a dedicated deployment key where possible.
- Keep `.env`-style secrets out of version control.
