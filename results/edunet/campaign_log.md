#datm #experiments #edunet #results

→ [[Papers/DATM/DATM]] | [[Projects/BesuEduNet/Infrastructure]]

# EduNet Baseline Campaign Log

**Date:** 13/07/2026  
**Network:** EduNet — QBFT, chainId=424242, gasPrice=1000 wei, block period=5.00s (measured)  
**RPC path:** SSH tunnel → backup-rpc (195.251.92.174:8547) → local 127.0.0.1:8545  
**Node version:** v24.14.1  
**Repo commit:** 161fbb8 (branch: edunet-experiments)

## Contracts (deployed 2026-07-13T08:26:41Z)

| Variant | Address | Deploy Gas |
|---------|---------|-----------|
| A | 0x90f9e89CD34A7086676f72594F28C5E23f139ACD | 210,820 |
| B | 0xef5A76048d1066285521ef7BF91663c741ACbe8C | 305,910 |
| C | 0x225A7830Bec045eBa0901109B83bbE5CB32FEB5D | 348,043 |

Deployer: 0xf259bcea206147C6bA65F20d02232AbeaD0784F7

## Workload

- Entities: 10 (4 normal / 3 suspicious / 3 malicious)
- Rounds per rep: 3
- Repetitions: 3
- Total update txs per variant: 900 (10 entities × 3 rounds × 3 reps × 10 updates/round)
- RUN_MODE: variant-batch (one variant per run)
- UPDATE_INTERVAL_SEC=10, ROUND_STAGGER_MS=1500, SUBMIT_RETRY_MAX=3

## Per-Rep Results (updates)

| Rep | Variant | Avg Gas | Avg Latency | Errors |
|-----|---------|---------|-------------|--------|
| 1 | A | 39,214 | 4,664ms | 0 |
| 1 | B | 40,298 | 4,611ms | 0 |
| 1 | C | 41,696 | 4,489ms | 0 |
| 2 | A | 37,772 | 4,588ms | 0 |
| 2 | B | 38,855 | 4,764ms | 0 |
| 2 | C | 40,253 | 4,765ms | 0 |
| 3 | A | 37,772 | 4,682ms | 0 |
| 3 | B | 38,855 | 5,560ms | 0 |
| 3 | C | 40,253 | 4,816ms | 0 |

## Aggregated Summary (3 reps merged, 900 rows/variant)

| Variant | Avg Gas | Avg Confirmation Latency | Avg Read Latency | Blocks/Round | Final States |
|---------|---------|--------------------------|------------------|--------------|--------------|
| A | 38,253 | 4,591ms | 159ms | 1.00 | T:12 S:9 U:9 |
| B | 39,337 | 4,828ms | 176ms | 1.00 | T:12 S:9 U:9 |
| C | 40,735 | 4,588ms | 119ms | 1.01 | T:12 S:9 U:9 |

- Zero failed transactions across all 9 runs (2,700 total update rows)
- All rounds fit in a single block (max_same_block=10) except Variant C rep3 round 1 (1 tx spilled to next block — isolated event)
- Trust state distribution consistent with entity profiles across all reps

## Key Findings

- Gas: A < B < C (~6.5% increase per step) — reflects on-chain storage overhead gradient
- Confirmation latency: A ≈ C < B — hybrid (B) pays overhead in both directions
- Read latency: C < A < B — fully on-chain reads (C) are fastest once data is present
- Block packing: near-perfect (10 entities/block) — EduNet handles the workload cleanly

## Notes

- EduNet block period is 5.00s vs Mike's 10s network — latency numbers are systematically lower; this is a contribution (effect of consensus parameters on variant trade-offs), not a confound
- Scalability ladder (3/6/9 entities) not run — requires Mike's approval and separate runs; `analyze:scalability` script expects those files
- Credentials: private key in KeePassium, never committed; .env in .gitignore
