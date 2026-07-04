# CSV Examples

## Purpose

This document provides sample rows for the experiment CSV outputs.

The examples are illustrative and use a small offline scenario. They are not pulled from a live Besu run.

## `updates.csv`

Example header:

```text
run_id,variant,entity_id,entity_profile,sequence_no,scheduled_at,datm_start_at,datm_end_at,datm_processing_ms,submit_at,tx_hash,receipt_at,tx_status,gas_used,effective_gas_price,block_number,block_hash,block_timestamp,confirmation_latency_ms,block_inclusion_latency_ms,end_to_end_latency_ms,ats,trust_state,calc_timestamp,input_hash,error_code,error_message
```

Example row:

```text
run-a-001,A,entity-01-normal,normal,1,2026-07-04T12:00:00.000Z,2026-07-04T12:00:00.005Z,2026-07-04T12:00:00.007Z,2,2026-07-04T12:00:00.020Z,0xaaaabbbbccccddddeeeeffff0000111122223333444455556666777788889999,2026-07-04T12:00:02.120Z,success,48211,0,101,0x111122223333444455556666777788889999aaaabbbbccccddddeeeeffff0000,2026-07-04T12:00:02.000Z,2100,1980,2115,93,Trusted,2026-07-04T12:00:00.000Z,0xinputhash00000000000000000000000000000000000000000000000000000001,,
```

## `reads.csv`

Example header:

```text
run_id,variant,entity_id,sequence_no,read_started_at,read_finished_at,read_latency_ms,block_tag,returned_ats,returned_trust_state,returned_timestamp,read_success,error_code,error_message
```

Example row:

```text
run-a-001,A,entity-01-normal,1,2026-07-04T12:00:03.000Z,2026-07-04T12:00:03.018Z,18,latest,93,Trusted,2026-07-04T12:00:00.000Z,true,,
```

## `events_storage.csv`

Example header:

```text
run_id,variant,checkpoint_no,observed_at,block_number,cumulative_updates,cumulative_successful_updates,cumulative_events,unique_entities_seen,estimated_storage_records,estimated_storage_slots,notes
```

Example row:

```text
run-a-001,A,1,2026-07-04T12:01:00.000Z,110,60,60,60,10,10,40,one trust record per entity after first minute
```

## `consistency.csv`

Example header:

```text
comparison_id,entity_id,sequence_no,input_hash,ats_a,state_a,ats_b,state_b,ats_c,state_c,consistent_state,ats_delta_ab,ats_delta_ac,ats_delta_bc,comparison_notes
```

Example row:

```text
cmp-entity-01-normal-001,entity-01-normal,1,0xinputhash00000000000000000000000000000000000000000000000000000001,93,Trusted,93,Trusted,93,Trusted,true,0,0,0,all variants agree for the canonical logical update
```

## Compatibility Notes

- `entity_id`, `sequence_no`, and `input_hash` are the main keys for traceability.
- `ats` and `trust_state` should match the shared formulas and thresholds.
- Example `tx_hash` and `block_hash` values here are placeholders for documentation only.
