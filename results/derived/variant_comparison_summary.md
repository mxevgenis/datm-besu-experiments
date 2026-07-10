# Variant Comparison Summary

Comparison inputs:

- Variant A: `updates.variant-batch.a-10e-3r-rerun.csv`
- Variant B: `updates.variant-batch.b-10e-3r.csv`
- Variant C: `updates.variant-batch.c-10e-3r.csv`

## Comparison Table

| Variant | Avg Gas | Avg Confirmation Latency (ms) | Avg Read Latency (ms) | Avg Blocks/Round | Avg Max Same-Block Ratio | Single-Block Rounds | Final States |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | --- |
| A | 37771.4 | 46094.97 | 25.53 | 2.33 | 0.67 | 1/3 | T=4, S=3, U=3 |
| B | 38855.1 | 38799.57 | 39.77 | 1 | 1 | 3/3 | T=4, S=3, U=3 |
| C | 40256.7 | 216387.73 | 25.27 | 1.33 | 0.97 | 2/3 | T=4, S=3, U=3 |

## Round-Level Block Inclusion

### Variant A
- Round 1: blocks=2, max_same_block=6, distribution=867280:4, 867281:6
- Round 2: blocks=4, max_same_block=4, distribution=867283:1, 867284:3, 867285:4, 867286:2
- Round 3: blocks=1, max_same_block=10, distribution=867289:10

### Variant B
- Round 1: blocks=1, max_same_block=10, distribution=867255:10
- Round 2: blocks=1, max_same_block=10, distribution=867257:10
- Round 3: blocks=1, max_same_block=10, distribution=867258:10

### Variant C
- Round 1: blocks=1, max_same_block=10, distribution=867262:10
- Round 2: blocks=1, max_same_block=10, distribution=867264:10
- Round 3: blocks=2, max_same_block=9, distribution=867265:9, 867266:1

## Interpretation

- Lowest gas cost: Variant A.
- Lowest average confirmation latency: Variant B.
- Strongest same-block inclusion: Variant B.
- All three variants preserved the same final trust-state distribution and showed zero consistency mismatches in the selected runs.
