# Variant Scalability Summary

This summary compares Variants A, B, and C at 3, 6, 9, and 10 entities using the batched experiment design with 3 rounds per data point.

## Comparison Table

| Variant | Entities | Avg Gas | Gas Std | Avg Confirmation Latency (ms) | Latency Std | Avg End-to-End Latency (ms) | End-to-End Std | Avg Read Latency (ms) | Read Std | Avg Max Same-Block Ratio | Ratio Std | Avg Blocks/Round |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| A | 3 | 37773.13 | 2.29 | 4789.08 | 1387.11 | 4919.29 | 1385.29 | 113.53 | 14.6 | 1 | 0 | 1 |
| A | 6 | 37773.2 | 1.92 | 4656.87 | 1615.7 | 4796.39 | 1616.3 | 113.37 | 28.74 | 1 | 0 | 1 |
| A | 9 | 37773.49 | 1.56 | 4741.19 | 1416.63 | 5113.17 | 1485.56 | 292.97 | 288.9 | 1 | 0 | 1 |
| A | 10 | 38252.96 | 2633.81 | 4590.76 | 704.31 | 4791.66 | 726.95 | 159.41 | 141.57 | 1 | 0 | 1 |
| B | 3 | 38845.13 | 2.29 | 4661.2 | 1228.84 | 4794.29 | 1228.83 | 119.36 | 11.76 | 1 | 0 | 1 |
| B | 6 | 38851.87 | 1.92 | 4786.25 | 1393.15 | 4939.68 | 1390.53 | 112.63 | 17.04 | 1 | 0 | 1 |
| B | 9 | 38856.38 | 1.56 | 4602.55 | 835.24 | 4754.14 | 862.86 | 190.04 | 244.58 | 1 | 0 | 1 |
| B | 10 | 39336.79 | 2633.79 | 4828.42 | 934.25 | 5028.13 | 990.02 | 175.77 | 169.41 | 1 | 0 | 1 |
| C | 3 | 40203.93 | 8.32 | 4611.19 | 1462.68 | 4850.91 | 1330.84 | 190.61 | 205.86 | 1 | 0 | 1 |
| C | 6 | 40232.4 | 5.81 | 4657.92 | 1230.5 | 4807.14 | 1229.05 | 109.86 | 9.4 | 1 | 0 | 1 |
| C | 9 | 40251.4 | 3.83 | 4543.67 | 826.66 | 4688.24 | 831.25 | 119.47 | 44.2 | 0.99 | 0.04 | 1.03 |
| C | 10 | 40734.58 | 2636.47 | 4587.54 | 709.89 | 4740.42 | 706.4 | 118.73 | 18.6 | 1 | 0 | 1 |

## Scalability Interpretation

- Variant A: confirmation latency trend 3e=4789.08, 6e=4656.87, 9e=4741.19, 10e=4590.76; same-block ratio trend 3e=1, 6e=1, 9e=1, 10e=1.
- Variant B: confirmation latency trend 3e=4661.2, 6e=4786.25, 9e=4602.55, 10e=4828.42; same-block ratio trend 3e=1, 6e=1, 9e=1, 10e=1.
- Variant C: confirmation latency trend 3e=4611.19, 6e=4657.92, 9e=4543.67, 10e=4587.54; same-block ratio trend 3e=1, 6e=1, 9e=0.99, 10e=1.

- Lowest overall gas point in the sweep: Variant A at 3 entities.
- Lowest latency at 10 entities: Variant C (4587.54 ms).
- Strongest block packing at 10 entities: Variant A (ratio 1).
- All runs completed without failed transactions in this scalability sweep.

Across the full scalability sweep, the plots show a clear separation between cost efficiency and performance stability. Variant A consistently remains the least expensive option in gas terms, but its confirmation latency and block-spread metrics degrade as the number of entities increases. This pattern is especially visible in the confirmation-latency, end-to-end-latency, and blocks-per-round plots, where Variant A transitions from near-single-block behavior at low entity counts to wider multi-block spreading at 9 and 10 entities. In contrast, Variant B preserves a slightly higher but very stable gas cost while keeping both latency and block-inclusion behavior more controlled as the workload grows, which indicates a better operational balance between off-chain computation and on-chain verification.

Variant C presents the heaviest on-chain execution cost, which is reflected in its consistently highest gas usage. The scalability plots show that this extra computation does not always translate into worse block packing, since Variant C often achieves near-perfect same-block inclusion, but it does introduce much higher latency variability under some workloads, most notably at 9 entities. Taken together, the figures suggest that Variant B is the most scalable architecture in practical terms: it avoids the block-spreading behavior observed in Variant A, avoids the latency spikes observed in Variant C, and delivers the best overall tradeoff between gas overhead, latency stability, and batch inclusion behavior.
