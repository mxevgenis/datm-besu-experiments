# Paper Results Draft

## Scalability Analysis of DATM Variants

To evaluate the scalability of the three DATM architectures, we executed a batched live experiment on the private Besu QBFT network using `3`, `6`, `9`, and `10` entities. For each entity count, the experiment was repeated for `3` logical rounds per variant, enabling estimation of mean behavior and standard deviation for the selected metrics. The same deterministic workload generation logic and trust-state thresholds were used for all runs.

### Experimental Configuration

- `Variant A`: off-chain DATM with on-chain storage only
- `Variant B`: off-chain normalization with on-chain final ATS calculation
- `Variant C`: on-chain behavior-score and ATS calculation from raw indicators
- update style: batched per variant and per round
- rounds per data point: `3`
- entity counts: `3`, `6`, `9`, `10`
- measured outputs: gas used, confirmation latency, read latency, and same-block inclusion behavior

### Scalability Results

Variant A remained the lowest-cost solution in terms of gas usage across all entity counts, staying near `37.8k` gas per trust update. However, its confirmation latency increased steadily with scale, from `14.7k ms` at `3` entities to `51.2k ms` at `10` entities. Its block-packing behavior also became less stable as the workload grew, with the same-block inclusion ratio decreasing from `1.00` at `3` entities to `0.73` at `10` entities.

Variant B exhibited the most balanced scalability profile. Although it consumed slightly more gas than Variant A, its gas cost remained stable near `38.9k`. More importantly, it delivered the lowest average confirmation latency at the highest tested workload, reaching `18.5k ms` at `10` entities, while maintaining strong same-block inclusion behavior with a ratio of `0.97`. These results indicate that the hybrid design provides the best tradeoff between on-chain computation and operational efficiency.

Variant C consistently had the highest gas cost, around `40.2k` gas per update, reflecting its heavier on-chain computation. It also showed the largest latency variability, with a major spike at `9` entities where average confirmation latency reached `73.5k ms` and the standard deviation was similarly large. Despite that instability, Variant C preserved strong same-block inclusion, achieving a ratio of `1.00` at both `9` and `10` entities.

### Interpretation

The scalability results suggest that moving all trust logic on-chain increases cost and may amplify latency variability under larger workloads. In contrast, the hybrid architecture of Variant B achieves better balance by keeping part of the trust processing off-chain while retaining on-chain verifiability for the final ATS calculation. Variant A minimizes gas cost but appears more sensitive to scaling in terms of confirmation latency and block spreading.

Taken together, the results support Variant B as the most suitable architecture for the target deployment model. It preserved classification behavior, avoided failed transactions in the tested range, and provided the strongest combined performance in latency stability and near-single-block update inclusion.

### Figure References

- Gas scalability: [scalability_gas_used.svg](/home/ubuntu/besu-testbed/experiments/datm-paper/results/derived/scalability_plots/scalability_gas_used.svg)
- Confirmation latency scalability: [scalability_confirmation_latency.svg](/home/ubuntu/besu-testbed/experiments/datm-paper/results/derived/scalability_plots/scalability_confirmation_latency.svg)
- Read latency scalability: [scalability_read_latency.svg](/home/ubuntu/besu-testbed/experiments/datm-paper/results/derived/scalability_plots/scalability_read_latency.svg)
- Same-block inclusion scalability: [scalability_same_block_ratio.svg](/home/ubuntu/besu-testbed/experiments/datm-paper/results/derived/scalability_plots/scalability_same_block_ratio.svg)

### Suggested Figure Captions

1. `Average gas used per trust update across DATM variants as the number of entities increases from 3 to 10. Error bars show standard deviation across 3 rounds.`
2. `Average transaction confirmation latency across DATM variants for increasing entity counts. Error bars show standard deviation across 3 rounds.`
3. `Average trust-registry read latency across DATM variants for increasing entity counts. Error bars show standard deviation across 3 rounds.`
4. `Average maximum same-block inclusion ratio for the three DATM variants as the workload scales. Error bars show standard deviation across 3 rounds.`
