# Scenario Schema Specification

## Purpose

This document defines the structure of the experiment scenario data that will later drive the DATM workload.

This is a schema and semantics document only. It does not create JSON files or executable code.

## Scope

The scenario schema must support:

- 10 deterministic entities
- 4 normal profiles
- 3 suspicious profiles
- 3 malicious profiles
- 5-minute default duration
- 10-second update interval
- deterministic per-entity sequence numbers
- cross-variant compatibility for Variant A, Variant B, and Variant C

## Top-Level Scenario Object

The scenario should be represented conceptually as a single object with the following sections:

- `scenarioMeta`
- `trustModel`
- `weights`
- `penalties`
- `entities`
- `schedule`
- `observations`

## `scenarioMeta`

Purpose:

- identifies the scenario configuration

Required fields:

- `scenarioId`: unique scenario identifier
- `scenarioName`: descriptive name
- `version`: scenario version string
- `description`: short human-readable description

## `trustModel`

Purpose:

- defines the shared trust-state semantics

Required fields:

- `subjectIdType`: must be `bytes32`
- `atsMin`: must be `0`
- `atsMax`: must be `100`
- `trustStates`: ordered list
- `thresholds`: trust-state threshold object

Required threshold values:

- `trustedMin = 80`
- `suspiciousMin = 50`
- `suspiciousMaxExclusive = 80`
- `untrustedMaxExclusive = 50`

Recommended trust state order:

- `Unknown`
- `Trusted`
- `Suspicious`
- `Untrusted`

## `weights`

Purpose:

- defines ATS component weights

Required fields:

- `wI`: must default to `25`
- `wC`: must default to `25`
- `wB`: must default to `30`
- `wH`: must default to `20`
- `sum`: must equal `100`

## `penalties`

Purpose:

- defines default behavior penalty weights

Required fields:

- `failedAuthPenalty`: default `2`
- `unauthorizedAccessPenalty`: default `10`
- `abnormalRequestPenalty`: default `4`
- `cpuViolationPenalty`: default `3`
- `memoryViolationPenalty`: default `3`
- `slaViolationPenalty`: default `5`

These values are used by the shared behavior score formula:

- `totalPenalty = 2*failedAuthCount + 10*unauthorizedAccessCount + 4*abnormalRequestCount + 3*cpuViolationCount + 3*memoryViolationCount + 5*slaViolationCount`
- `behaviorScore = max(0, 100 - totalPenalty)`

## `entities`

Purpose:

- defines the 10 logical experiment entities

Required cardinality:

- exactly `10` entities

Each entity entry should include:

- `entityId`: stable logical identifier such as `entity-01`
- `subjectId`: deterministic `bytes32`-compatible identifier
- `profile`: one of `normal`, `suspicious`, `malicious`
- `profileIndex`: ordinal inside the profile group
- `description`: optional description

Required distribution:

- `4` entities with profile `normal`
- `3` entities with profile `suspicious`
- `3` entities with profile `malicious`

## `schedule`

Purpose:

- defines the timing model for the run

Required fields:

- `durationSec`: must default to `300`
- `updateIntervalSec`: must default to `10`
- `updatesPerEntity`: must default to `30`
- `sequenceStart`: must default to `1`

Recommended semantics:

- each entity receives one update at each interval
- sequence numbers are deterministic and contiguous per entity
- update `n` is scheduled at offset `(n - 1) * updateIntervalSec`

## `observations`

Purpose:

- defines the canonical logical inputs for each entity update

Required cardinality:

- one observation per `entityId` and `sequenceNo`

For the default scenario:

- `10 entities * 30 updates = 300 observations`

Each observation should include:

- `entityId`
- `sequenceNo`
- `scheduledOffsetSec`
- `calcTimestampLogical`
- `identityScore`
- `credentialScore`
- `historyScore`
- `failedAuthCount`
- `unauthorizedAccessCount`
- `abnormalRequestCount`
- `cpuViolationCount`
- `memoryViolationCount`
- `slaViolationCount`
- `derivedBehaviorScore`
- `derivedAts`
- `derivedTrustState`
- `inputHash`

## Derived Field Semantics

### `derivedBehaviorScore`

Computed from raw counters using:

- `behaviorScore = max(0, 100 - totalPenalty)`

### `derivedAts`

Computed using integer arithmetic:

- `ATS = (wI*I + wC*C + wB*B + wH*H) / 100`

Where:

- `I = identityScore`
- `C = credentialScore`
- `B = derivedBehaviorScore`
- `H = historyScore`

### `derivedTrustState`

Derived from `derivedAts`:

- `Trusted` if `ATS >= 80`
- `Suspicious` if `50 <= ATS < 80`
- `Untrusted` if `ATS < 50`

### `inputHash`

The `inputHash` must be computed from the canonical logical observation so it remains stable across all variants.

It should conceptually bind:

- `entityId`
- `subjectId`
- `sequenceNo`
- score inputs
- raw violation counters
- shared trust model version

## Variant Payload Mapping

The scenario schema must support deriving the payload for each variant from the same observation row.

### Variant A Mapping

From one observation, Variant A uses:

- `subjectId`
- `derivedAts`
- `derivedTrustState`
- `calcTimestampLogical`
- `inputHash`

### Variant B Mapping

From one observation, Variant B uses:

- `subjectId`
- `identityScore`
- `credentialScore`
- `derivedBehaviorScore`
- `historyScore`
- `calcTimestampLogical`
- `inputHash`

### Variant C Mapping

From one observation, Variant C uses:

- `subjectId`
- `identityScore`
- `credentialScore`
- `historyScore`
- `failedAuthCount`
- `unauthorizedAccessCount`
- `abnormalRequestCount`
- `cpuViolationCount`
- `memoryViolationCount`
- `slaViolationCount`
- `calcTimestampLogical`
- `inputHash`

## CSV Compatibility

### `updates.csv`

The scenario schema directly provides or derives:

- `entity_id` from `entityId`
- `sequence_no` from `sequenceNo`
- `scheduled_at` from run start plus `scheduledOffsetSec`
- `calc_timestamp` from `calcTimestampLogical`
- `ats` from `derivedAts` or contract result
- `trust_state` from `derivedTrustState` or contract result
- `input_hash` from `inputHash`

### `reads.csv`

The scenario schema provides the expected logical key for read validation:

- `entityId`
- `sequenceNo`
- `inputHash`

and the expected semantic outputs:

- final ATS
- final trust state

### `consistency.csv`

The scenario schema is the canonical source for matching equivalent updates across variants.

Comparison key:

- `entityId`
- `sequenceNo`
- `inputHash`

Comparison targets:

- Variant A final ATS and state
- Variant B final ATS and state
- Variant C final ATS and state

## Validation Constraints

Any future scenario file based on this schema should satisfy:

- exactly 10 entities
- exact profile split of `4/3/3`
- exactly 30 observations per entity for the default run
- no missing sequence numbers
- no duplicate `(entityId, sequenceNo)` pairs
- all score fields constrained to `0..100`
- all counter fields constrained to non-negative integers
- all `inputHash` values deterministic and reproducible

## Out of Scope

This document does not define:

- Solidity structs
- JavaScript or TypeScript interfaces
- hash algorithm implementation details
- contract deployment procedures
- live RPC interaction
