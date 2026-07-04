# Contracts Interface Specification

## Purpose

This document defines the shared trust data model, ATS formula, behavior score formula, and contract-level update interfaces for DATM Variant A, Variant B, and Variant C.

This is a design artifact only. It does not define Solidity code.

## Shared Trust Data Model

All three variants must use the same logical trust model so experimental results are directly comparable.

### Subject Identifier

- `subjectId`: `bytes32`

Notes:

- `subjectId` is the canonical on-chain identifier for a trust subject.
- The same logical entity must use the same `subjectId` across Variant A, Variant B, and Variant C.
- `subjectId` should be deterministically derived off-chain from the experiment entity identifier.

### Adaptive Trust Score

- `ats`: integer score in the range `0` to `100`

Notes:

- ATS must be stored and compared as an integer.
- All intermediate calculations should preserve determinism and avoid floating-point arithmetic.
- Values below `0` should be clamped to `0`.
- Values above `100` should be clamped to `100`.

### Trust State Enum

Trust states are:

- `Unknown`
- `Trusted`
- `Suspicious`
- `Untrusted`

Suggested logical enum mapping for documentation:

- `0 = Unknown`
- `1 = Trusted`
- `2 = Suspicious`
- `3 = Untrusted`

### Trust State Thresholds

The trust state must be derived from ATS using the following thresholds:

- `Trusted`: `ATS >= 80`
- `Suspicious`: `50 <= ATS < 80`
- `Untrusted`: `ATS < 50`

`Unknown` is reserved for initialization or missing-data states and should not be used for normal post-update classification when a valid ATS exists.

## Shared Indicator Model

All variants ultimately evaluate the same four top-level components:

- `I`: identity score
- `C`: credential score
- `B`: behavior score
- `H`: history score

Each component is an integer score in the range `0` to `100`.

## ATS Formula

The Adaptive Trust Score is computed using integer arithmetic only.

### Formula

`ATS = (wI*I + wC*C + wB*B + wH*H) / 100`

### Default Weights

- `wI = 25`
- `wC = 25`
- `wB = 30`
- `wH = 20`

Weight sum:

- `wI + wC + wB + wH = 100`

### Integer Arithmetic Rules

- All terms must be computed using integer arithmetic.
- Division by `100` should occur only after summing all weighted terms.
- If rounding behavior must be fixed explicitly, use floor division for consistency.
- The final ATS should be clamped to the range `0` to `100`.

### Example

If:

- `I = 90`
- `C = 80`
- `B = 70`
- `H = 60`

Then:

- weighted sum = `25*90 + 25*80 + 30*70 + 20*60`
- weighted sum = `2250 + 2000 + 2100 + 1200 = 7550`
- `ATS = 7550 / 100 = 75`
- trust state = `Suspicious`

## Behavior Score Formula

The behavior score is derived from violation counters using an integer penalty model.

### Formula

`B = 100 - totalPenalty`

Then:

- if `B < 0`, clamp to `0`
- if `B > 100`, clamp to `100`

### Raw Violation Inputs

The default raw inputs are:

- `failedAuthCount`
- `unauthorizedAccessCount`
- `abnormalRequestCount`
- `cpuViolationCount`
- `memoryViolationCount`
- `slaViolationCount`

All counters are non-negative integers.

### Default Penalty Weights

Default per-occurrence penalty weights:

- `failedAuthCount`: `2`
- `unauthorizedAccessCount`: `10`
- `abnormalRequestCount`: `4`
- `cpuViolationCount`: `3`
- `memoryViolationCount`: `3`
- `slaViolationCount`: `5`

### Default totalPenalty Formula

`totalPenalty =`

- `2 * failedAuthCount`
- `+ 10 * unauthorizedAccessCount`
- `+ 4 * abnormalRequestCount`
- `+ 3 * cpuViolationCount`
- `+ 3 * memoryViolationCount`
- `+ 5 * slaViolationCount`

Equivalent single-line form:

`totalPenalty = 2*failedAuthCount + 10*unauthorizedAccessCount + 4*abnormalRequestCount + 3*cpuViolationCount + 3*memoryViolationCount + 5*slaViolationCount`

### Interpretation

- small isolated anomalies reduce `B` moderately
- repeated unauthorized actions reduce `B` aggressively
- sustained infrastructure or SLA violations reduce `B` progressively

## Variant Interfaces

All variants expose a logically equivalent trust update operation, but the boundary between off-chain and on-chain computation differs.

### Variant A

Description:

- full ATS and final trust state are computed off-chain
- contract stores final outputs only

Interface:

- `updateTrust(subjectId, ats, trustState, calcTimestamp, inputHash)`

Field definitions:

- `subjectId`: `bytes32`
- `ats`: integer `0..100`
- `trustState`: enum value derived off-chain
- `calcTimestamp`: off-chain calculation timestamp
- `inputHash`: deterministic hash of logical experiment input for comparison across variants

On-chain responsibility:

- validate input ranges
- store final trust record
- emit trust update event

### Variant B

Description:

- normalized component scores are computed off-chain
- contract computes final ATS and trust state on-chain

Interface:

- `updateTrust(subjectId, identityScore, credentialScore, behaviorScore, historyScore, calcTimestamp, inputHash)`

Field definitions:

- `subjectId`: `bytes32`
- `identityScore`: integer `0..100`
- `credentialScore`: integer `0..100`
- `behaviorScore`: integer `0..100`
- `historyScore`: integer `0..100`
- `calcTimestamp`: off-chain preprocessing timestamp
- `inputHash`: deterministic hash of logical experiment input

On-chain responsibility:

- compute ATS using shared weights
- derive trust state from ATS thresholds
- store final trust record
- emit trust update event

### Variant C

Description:

- raw behavior counters are submitted on-chain
- contract computes behavior score, ATS, and trust state on-chain

Interface:

- `updateTrust(subjectId, identityScore, credentialScore, historyScore, failedAuthCount, unauthorizedAccessCount, abnormalRequestCount, cpuViolationCount, memoryViolationCount, slaViolationCount, calcTimestamp, inputHash)`

Field definitions:

- `subjectId`: `bytes32`
- `identityScore`: integer `0..100`
- `credentialScore`: integer `0..100`
- `historyScore`: integer `0..100`
- `failedAuthCount`: non-negative integer
- `unauthorizedAccessCount`: non-negative integer
- `abnormalRequestCount`: non-negative integer
- `cpuViolationCount`: non-negative integer
- `memoryViolationCount`: non-negative integer
- `slaViolationCount`: non-negative integer
- `calcTimestamp`: off-chain observation timestamp
- `inputHash`: deterministic hash of logical experiment input

On-chain responsibility:

- compute `totalPenalty`
- compute behavior score `B`
- compute ATS using shared weights
- derive trust state from ATS thresholds
- store final trust record
- emit trust update event

## Expected Read Model

All variants should support a logically equivalent read path so `reads.csv` remains comparable.

Minimum logical read output:

- `subjectId`
- `ats`
- `trustState`
- `calcTimestamp`
- `inputHash`

Recommended note:

- Even if variants compute different internal fields, the externally readable trust record should normalize to the same final shape.

## CSV Compatibility

### Mapping to `updates.csv`

All variants map to `updates.csv` as follows:

- `subjectId` maps to experiment-level `entity_id` through deterministic off-chain lookup
- `calcTimestamp` maps to `calc_timestamp`
- `inputHash` maps to `input_hash`
- final stored or computed `ats` maps to `ats`
- final stored or computed `trustState` maps to `trust_state`

Variant-specific notes:

- Variant A populates `ats` and `trust_state` directly from submitted values
- Variant B populates `ats` and `trust_state` from on-chain calculation based on `identityScore`, `credentialScore`, `behaviorScore`, and `historyScore`
- Variant C populates `ats` and `trust_state` from on-chain calculation based on component scores plus raw violation counters

### Mapping to `reads.csv`

Reads should return:

- final `ats`
- final `trustState`
- stored `calcTimestamp`
- stored `inputHash`

These map to:

- `returned_ats`
- `returned_trust_state`
- `returned_timestamp`

If `inputHash` is also included in the read path later, it may be used as an auxiliary verification field even if not stored in `reads.csv`.

### Mapping to `consistency.csv`

Cross-variant comparison depends on:

- same `subjectId`
- same logical sequence number
- same `inputHash`

For each logical update:

- Variant A contributes `ats_a` and `state_a`
- Variant B contributes `ats_b` and `state_b`
- Variant C contributes `ats_c` and `state_c`

Consistency is evaluated by:

- exact match on trust state
- numeric comparison of final ATS values

## Determinism Requirements

To keep the experiment paper-valid:

- all variants must use the same threshold rules
- all variants must use the same ATS weights
- all variants must use the same behavior penalty weights
- all variants must use integer arithmetic only
- all variants must use the same `inputHash` derivation rule for logically equivalent inputs
