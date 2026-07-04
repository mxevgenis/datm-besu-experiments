# DATM Experiment Specification

## Objective

Design a controlled experiment for a paper that compares three Decentralized Adaptive Trust Manager (DATM) deployment variants on an already running private Hyperledger Besu network without modifying the current Kubernetes, Helm, genesis, key, or service configuration during the design phase.

The experiment will evaluate tradeoffs among:

- on-chain computation cost
- off-chain processing cost
- update latency
- read latency
- storage and event growth
- classification consistency

## Variants

### Variant A: Off-Chain DATM, On-Chain Storage Only

Behavior:

- DATM computes the full Adaptive Trust Score (ATS) off-chain.
- The smart contract stores only the final ATS, trust state, and timestamp.
- The contract acts as a trust registry and audit log.

Expected characteristics:

- lowest on-chain computation cost
- lowest gas usage among the three variants
- strongest dependence on off-chain correctness

### Variant B: Hybrid DATM, On-Chain Final Calculation

Behavior:

- DATM computes normalized indicators off-chain.
- The smart contract computes the final ATS and trust state.
- This is the proposed architecture for the paper.

Expected characteristics:

- moderate gas usage
- reduced off-chain trust assumptions compared with Variant A
- better on-chain verifiability than Variant A

### Variant C: On-Chain DATM

Behavior:

- DATM submits raw behavioral indicators.
- The smart contract computes behavior score, ATS, and trust state.
- The chain records the most complete trust-calculation path.

Expected characteristics:

- highest gas usage
- strongest on-chain transparency
- highest on-chain processing and storage footprint

## Experimental Workload

### Entity Set

The workload uses 10 logical entities:

- 4 normal entities
- 3 suspicious entities
- 3 malicious entities

Each entity represents one trust subject whose behavior is updated repeatedly during the run.

### Update Schedule

- trust update interval: every 10 seconds per entity
- initial experiment duration: 5 minutes
- total scheduled intervals per entity: 30

If all entities are updated at every interval, the initial workload target is:

- 300 total trust updates per variant
- 900 total trust updates across all three variants if executed in separate but equivalent runs

### Execution Strategy

To avoid interference across variants, each variant should be run independently using the same workload definition, timing schedule, and entity profiles.

Recommended run order:

1. Variant A
2. Variant B
3. Variant C

Recommended repetition:

- at least 3 repeated runs per variant for paper-quality summary statistics

## Behavioral Profiles

The exact DATM formula can be finalized later, but the workload should use deterministic profile templates so all variants receive semantically equivalent inputs.

### Normal Profile

Expected behavior:

- stable and compliant behavior over time
- low anomaly rate
- high participation success
- low policy violation count

Expected trust outcome:

- ATS remains high
- trust state remains trusted or equivalent

### Suspicious Profile

Expected behavior:

- intermittent irregular behavior
- moderate anomaly rate
- occasional failures or deviations
- recoverable trust fluctuations

Expected trust outcome:

- ATS stays in a middle band
- trust state may oscillate near a warning threshold

### Malicious Profile

Expected behavior:

- repeated anomalies or policy violations
- high failure or attack-indicative rates
- persistent adverse behavior

Expected trust outcome:

- ATS trends low
- trust state becomes untrusted or equivalent

## Timing Parameters

- update interval: 10 seconds
- run duration: 5 minutes
- per-variant entity count: 10
- run cadence should be deterministic and timestamped by the experiment harness

The experiment harness should record:

- scheduled update time
- DATM processing start and end time
- transaction submission time
- transaction receipt time
- trust read start and end time

## Metrics

The experiment should collect the following metrics for each variant.

### Transaction and Chain Metrics

- gas used per trust update
- transaction confirmation latency
- block inclusion latency
- trust updates per second
- trust updates per minute

### Off-Chain Processing Metrics

- DATM processing time
- end-to-end trust update latency

### Read and Query Metrics

- trust registry read latency

### Storage and Audit Metrics

- storage growth
- number of on-chain events emitted

### Correctness and Comparison Metrics

- classification consistency across variants

## Expected Outputs

The experiment should export CSV outputs for later analysis:

- `runs.csv`
- `updates.csv`
- `reads.csv`
- `events_storage.csv`
- `consistency.csv`

The experiment should also support derived analysis such as:

- per-variant latency distribution summaries
- average and percentile gas cost
- throughput comparison
- event and storage growth comparison
- classification agreement rates

## Safety Constraints

This design phase must not alter the current Besu testbed or observability stack.

The experiment implementation must remain isolated from:

- `k8s/`
- `helm/`
- `genesis/`
- `keys/`
- existing deployment scripts

## Risks

### Measurement Risks

- Prometheus scrape intervals may be too coarse for per-update latency analysis.
- Block timestamp resolution may not fully capture sub-second timing.
- End-to-end latency may include client-side queueing effects if updates are bursty.

### Validity Risks

- Differences in ATS formulas across implementations can invalidate comparison.
- Floating-point style normalization must be avoided or standardized because on-chain arithmetic will use integer math.
- Threshold definitions for trust state must be identical across all variants.

### Operational Risks

- Running experiments against the live testbed may affect shared node load.
- Contract deployment and repeated writes will increase chain state and event volume.
- Existing uncommitted workspace changes in deployment-related files should remain untouched.

### Interpretation Risks

- Lower gas usage does not automatically imply better security or verifiability.
- Higher on-chain transparency may come at significant scalability cost.
- Classification agreement must be evaluated alongside latency and gas tradeoffs.

## Out of Scope For This Documentation Step

This documentation step does not:

- create smart contracts
- create DATM services
- create scripts or manifests
- deploy contracts
- query the live Besu RPC endpoint
- modify any running Kubernetes resources
