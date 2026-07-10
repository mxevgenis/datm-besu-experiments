# Variant Scalability Summary

This summary compares Variants A, B, and C at 3, 6, 9, and 10 entities using the batched experiment design with 3 rounds per data point.

## Comparison Table

| Variant | Entities | Avg Gas | Gas Std | Avg Confirmation Latency (ms) | Latency Std | Avg Read Latency (ms) | Read Std | Avg Max Same-Block Ratio | Ratio Std | Avg Blocks/Round |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| A | 3 | 37771 | 0 | 14721.44 | 2310.38 | 22.44 | 6.95 | 1 | 0 | 1 |
| A | 6 | 37771.67 | 1.15 | 32749 | 23725.05 | 27.39 | 5.75 | 0.94 | 0.1 | 1.33 |
| A | 9 | 37772.33 | 1.33 | 43349.96 | 16895.26 | 21.74 | 4.9 | 0.67 | 0.29 | 2.33 |
| A | 10 | 37771.4 | 1.2 | 51174.7 | 15221.82 | 27.7 | 8.25 | 0.73 | 0.21 | 2 |
| B | 3 | 38843 | 0 | 18727.11 | 2305.75 | 19 | 3.18 | 0.78 | 0.19 | 1.67 |
| B | 6 | 38850.33 | 1.15 | 20740.17 | 6430.66 | 31.67 | 14.29 | 0.83 | 0.29 | 1.33 |
| B | 9 | 38855.22 | 1.33 | 27210.63 | 15934.19 | 26.52 | 2.31 | 0.93 | 0.13 | 1.33 |
| B | 10 | 38855.1 | 1.2 | 18483.3 | 2119.57 | 23.5 | 1.31 | 0.97 | 0.06 | 1.33 |
| C | 3 | 40211 | 20.78 | 17391.44 | 6114.43 | 23 | 6.36 | 1 | 0 | 1 |
| C | 6 | 40237 | 14.47 | 28527.06 | 7352.58 | 30.94 | 4.89 | 0.94 | 0.1 | 1.33 |
| C | 9 | 40254.33 | 10.1 | 73464.89 | 71764.83 | 26.78 | 3.86 | 1 | 0 | 1 |
| C | 10 | 40256.7 | 9.09 | 21431.63 | 8337.57 | 28.5 | 6.62 | 1 | 0 | 1 |

## Scalability Interpretation

- Variant A: confirmation latency trend 3e=14721.44, 6e=32749, 9e=43349.96, 10e=51174.7; same-block ratio trend 3e=1, 6e=0.94, 9e=0.67, 10e=0.73.
- Variant B: confirmation latency trend 3e=18727.11, 6e=20740.17, 9e=27210.63, 10e=18483.3; same-block ratio trend 3e=0.78, 6e=0.83, 9e=0.93, 10e=0.97.
- Variant C: confirmation latency trend 3e=17391.44, 6e=28527.06, 9e=73464.89, 10e=21431.63; same-block ratio trend 3e=1, 6e=0.94, 9e=1, 10e=1.

- Lowest overall gas point in the sweep: Variant A at 3 entities.
- Lowest latency at 10 entities: Variant B (18483.3 ms).
- Strongest block packing at 10 entities: Variant C (ratio 1).
- All runs completed without failed transactions in this scalability sweep.
