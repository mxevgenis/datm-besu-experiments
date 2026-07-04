# Metrics Schema

## Purpose

This document defines the CSV outputs for the DATM experiment so data collection is consistent across Variant A, Variant B, and Variant C.

All timestamps should use UTC in ISO 8601 format with millisecond precision where possible.

## runs.csv

One row per experiment run.

### Columns

- `run_id`: unique identifier for the run
- `variant`: `A`, `B`, or `C`
- `started_at`: run start timestamp
- `ended_at`: run end timestamp
- `duration_sec`: configured run duration in seconds
- `update_interval_sec`: configured update interval in seconds
- `entity_count`: total number of logical entities in the run
- `normal_count`: number of normal entities
- `suspicious_count`: number of suspicious entities
- `malicious_count`: number of malicious entities
- `scheduled_updates`: total planned updates for the run
- `completed_updates`: total successful updates recorded
- `failed_updates`: total failed updates recorded
- `rpc_endpoint_label`: logical label only, not necessarily the raw endpoint URL
- `contract_name`: contract used by the run
- `contract_address`: deployed contract address used by the run
- `algorithm_version`: trust algorithm version identifier
- `notes`: optional free-text notes

## updates.csv

One row per trust update transaction attempt.

### Columns

- `run_id`: foreign key to `runs.csv`
- `variant`: `A`, `B`, or `C`
- `entity_id`: logical entity identifier
- `entity_profile`: `normal`, `suspicious`, or `malicious`
- `sequence_no`: update sequence number for the entity
- `scheduled_at`: planned update timestamp
- `datm_start_at`: off-chain DATM processing start time
- `datm_end_at`: off-chain DATM processing end time
- `datm_processing_ms`: DATM processing duration in milliseconds
- `submit_at`: transaction submission timestamp from the client
- `tx_hash`: transaction hash
- `receipt_at`: receipt observation timestamp
- `tx_status`: transaction status such as `success` or `reverted`
- `gas_used`: gas used from the receipt
- `effective_gas_price`: effective gas price if available
- `block_number`: included block number
- `block_hash`: included block hash
- `block_timestamp`: block timestamp
- `confirmation_latency_ms`: elapsed time from `submit_at` to `receipt_at`
- `block_inclusion_latency_ms`: elapsed time from `submit_at` to block inclusion observation
- `end_to_end_latency_ms`: elapsed time from `datm_start_at` to `receipt_at`
- `ats`: final Adaptive Trust Score recorded for the update
- `trust_state`: final trust state recorded for the update
- `calc_timestamp`: trust-calculation timestamp carried in the update payload
- `input_hash`: deterministic hash of the logical input set for cross-variant comparison
- `error_code`: optional machine-readable error code
- `error_message`: optional short error detail

## reads.csv

One row per trust registry read measurement.

### Columns

- `run_id`: foreign key to `runs.csv`
- `variant`: `A`, `B`, or `C`
- `entity_id`: logical entity identifier
- `sequence_no`: related update sequence number if applicable
- `read_started_at`: read start timestamp
- `read_finished_at`: read end timestamp
- `read_latency_ms`: read duration in milliseconds
- `block_tag`: block tag used for the read such as `latest`
- `returned_ats`: ATS returned by the read
- `returned_trust_state`: trust state returned by the read
- `returned_timestamp`: timestamp stored in the registry record
- `read_success`: boolean success indicator
- `error_code`: optional machine-readable error code
- `error_message`: optional short error detail

## events_storage.csv

One row per observation window or checkpoint that tracks on-chain growth.

### Columns

- `run_id`: foreign key to `runs.csv`
- `variant`: `A`, `B`, or `C`
- `checkpoint_no`: sequential checkpoint number
- `observed_at`: observation timestamp
- `block_number`: chain height at observation time
- `cumulative_updates`: cumulative number of submitted updates observed so far
- `cumulative_successful_updates`: cumulative successful updates observed so far
- `cumulative_events`: cumulative number of trust-update events observed so far
- `unique_entities_seen`: number of unique entities with at least one update
- `estimated_storage_records`: estimated number of active trust records
- `estimated_storage_slots`: optional estimated storage slot count
- `notes`: optional notes about estimation method

## consistency.csv

One row per logically equivalent cross-variant comparison item.

### Columns

- `comparison_id`: unique identifier for the comparison row
- `entity_id`: logical entity identifier
- `sequence_no`: logical update sequence number
- `input_hash`: deterministic hash of the logical input set
- `ats_a`: final ATS for Variant A
- `state_a`: final trust state for Variant A
- `ats_b`: final ATS for Variant B
- `state_b`: final trust state for Variant B
- `ats_c`: final ATS for Variant C
- `state_c`: final trust state for Variant C
- `consistent_state`: boolean indicating whether all final states match
- `ats_delta_ab`: numeric difference between Variant A and Variant B ATS
- `ats_delta_ac`: numeric difference between Variant A and Variant C ATS
- `ats_delta_bc`: numeric difference between Variant B and Variant C ATS
- `comparison_notes`: optional notes about divergence or rounding effects

## Conventions

- `entity_id` should be stable across all variants.
- `sequence_no` should map to the same logical update across all variants.
- `input_hash` should be identical for logically equivalent updates across variants.
- Integer scaling for ATS and indicators should be documented and applied consistently.
- If a field is not available for a row, use an empty value rather than inventing a placeholder unless the implementation explicitly standardizes one.

## Recommended Derived Metrics

These do not need to be stored as separate raw CSVs but should be computable from the schemas above:

- average gas used per variant
- p50, p95, and p99 confirmation latency per variant
- average DATM processing time per variant
- average end-to-end latency per variant
- read latency distribution per variant
- updates per second and per minute
- event growth rate
- classification agreement rate
