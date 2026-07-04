# Proposed Experiment File Tree

## Goal

This file proposes a safe, isolated folder structure for implementing the DATM experiment without modifying the current Besu testbed deployment assets.

## Proposed Structure

```text
experiments/
└── datm-paper/
    ├── docs/
    │   ├── experiment_spec.md
    │   ├── file_tree.md
    │   └── metrics_schema.md
    ├── contracts/
    │   ├── common/
    │   │   ├── TrustTypes.sol
    │   │   └── TrustMath.sol
    │   ├── variant-a/
    │   │   └── TrustRegistryA.sol
    │   ├── variant-b/
    │   │   └── TrustRegistryB.sol
    │   └── variant-c/
    │       └── TrustRegistryC.sol
    ├── abi/
    │   ├── TrustRegistryA.json
    │   ├── TrustRegistryB.json
    │   └── TrustRegistryC.json
    ├── scenarios/
    │   ├── entity_profiles.json
    │   ├── workload_10_entities_5m.json
    │   └── thresholds.json
    ├── runner/
    │   ├── run_variant_a.js
    │   ├── run_variant_b.js
    │   ├── run_variant_c.js
    │   ├── shared_runner.js
    │   └── time_utils.js
    ├── datm/
    │   ├── indicator_builder.js
    │   ├── normalization.js
    │   ├── trust_formula.js
    │   └── profile_generators.js
    ├── collectors/
    │   ├── receipt_collector.js
    │   ├── read_benchmarker.js
    │   ├── event_storage_collector.js
    │   └── consistency_checker.js
    ├── analysis/
    │   ├── derive_metrics.js
    │   ├── summarize_results.js
    │   └── plot_inputs.md
    ├── results/
    │   ├── raw/
    │   │   ├── runs.csv
    │   │   ├── updates.csv
    │   │   ├── reads.csv
    │   │   ├── events_storage.csv
    │   │   └── consistency.csv
    │   └── derived/
    │       ├── summary_by_variant.csv
    │       ├── latency_percentiles.csv
    │       └── consistency_summary.csv
    └── README.md
```

## Directory Roles

### `docs/`

Design-time documentation and experiment definitions for the paper.

### `contracts/`

Solidity contracts for the three DATM variants plus shared trust types and math helpers.

### `abi/`

Compiled contract interfaces used by the experiment runner.

### `scenarios/`

Static workload definitions, entity-role assignments, thresholds, and trust-profile inputs.

### `runner/`

The execution harness that schedules updates, sends transactions, timestamps actions, and coordinates CSV output.

### `datm/`

Off-chain DATM logic, including indicator generation, normalization, and variant-specific preprocessing.

### `collectors/`

Modules for receipts, reads, event counting, storage estimation, and cross-variant comparison.

### `analysis/`

Post-processing scripts that convert raw CSV outputs into paper-ready summaries.

### `results/raw/`

Raw run outputs exported directly from the experiment harness.

### `results/derived/`

Derived summaries produced from the raw CSVs.

## Isolation Rules

The experiment implementation should remain isolated from:

- `k8s/`
- `helm/`
- `genesis/`
- `keys/`
- existing deployment and cleanup scripts

The experiment should treat the existing testbed as an external platform and keep all new logic within `experiments/datm-paper/`.
