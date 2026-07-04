# Workload Profile Specification

## Purpose

This document defines the deterministic workload profiles for the DATM experiment across Variant A, Variant B, and Variant C.

This is a design artifact only. It does not create workload files or executable code.

## Run Configuration

The default experiment workload is:

- total entities: `10`
- normal entities: `4`
- suspicious entities: `3`
- malicious entities: `3`
- duration: `5 minutes`
- update interval: `10 seconds`

Derived schedule:

- total intervals per entity: `30`
- total logical updates per run: `300`

Each variant should use the same logical workload in separate runs.

## Entity Assignment

The workload should define ten stable logical entities.

Recommended identifiers:

- `entity-01`
- `entity-02`
- `entity-03`
- `entity-04`
- `entity-05`
- `entity-06`
- `entity-07`
- `entity-08`
- `entity-09`
- `entity-10`

Recommended profile assignment:

- normal: `entity-01`, `entity-02`, `entity-03`, `entity-04`
- suspicious: `entity-05`, `entity-06`, `entity-07`
- malicious: `entity-08`, `entity-09`, `entity-10`

Each entity must map deterministically to one `subjectId` value.

## Deterministic Sequence Numbers

Each entity update uses a deterministic sequence number.

Rules:

- sequence numbering starts at `1`
- sequence numbering increments by `1` per entity update
- each entity has exactly `30` scheduled sequence numbers for the default 5-minute run

Example:

- `entity-01` uses sequence numbers `1..30`
- `entity-05` uses sequence numbers `1..30`
- `entity-10` uses sequence numbers `1..30`

The pair:

- `entity_id`
- `sequence_no`

uniquely identifies a logical update inside a run.

## Scheduling Model

The schedule should be deterministic and aligned to a single run start time.

For each entity:

- update `1` occurs at run start
- update `2` occurs at `+10s`
- update `3` occurs at `+20s`
- ...
- update `30` occurs at `+290s`

Recommended logical schedule formula:

- `scheduled_at = run_started_at + (sequence_no - 1) * 10 seconds`

All variants must use the same schedule definition.

## Shared Indicator Ranges

The following logical scores should remain in the range `0..100`:

- identity score
- credential score
- behavior score
- history score
- final ATS

Raw violation counters are non-negative integers.

## Normal Profile

### Intent

Normal entities represent stable participants with strong trust characteristics and low behavioral penalties.

### Expected Characteristics

- high identity score
- high credential score
- high history score
- very low violation counts
- stable ATS in the `Trusted` range

### Default Pattern Guidance

Recommended qualitative pattern:

- `identityScore`: consistently high
- `credentialScore`: consistently high
- `historyScore`: high and stable
- `failedAuthCount`: usually `0`, occasionally `1`
- `unauthorizedAccessCount`: `0`
- `abnormalRequestCount`: `0` or very low
- `cpuViolationCount`: `0` or low
- `memoryViolationCount`: `0` or low
- `slaViolationCount`: `0` or low

Expected outcome:

- `ATS >= 80`
- trust state `Trusted`

## Suspicious Profile

### Intent

Suspicious entities represent unstable or borderline participants with intermittent irregular behavior.

### Expected Characteristics

- moderate identity score
- moderate credential score
- mixed history score
- recurring but not catastrophic violation counts
- ATS near or within the `Suspicious` range

### Default Pattern Guidance

Recommended qualitative pattern:

- `identityScore`: medium to high
- `credentialScore`: medium
- `historyScore`: medium
- `failedAuthCount`: recurring low-to-moderate
- `unauthorizedAccessCount`: occasional
- `abnormalRequestCount`: recurring moderate
- `cpuViolationCount`: occasional
- `memoryViolationCount`: occasional
- `slaViolationCount`: occasional

Expected outcome:

- `50 <= ATS < 80`
- trust state `Suspicious`

## Malicious Profile

### Intent

Malicious entities represent persistently unsafe participants whose behavior should drive trust downward.

### Expected Characteristics

- low or degraded effective trust inputs
- repeated or severe behavioral violations
- ATS in the `Untrusted` range

### Default Pattern Guidance

Recommended qualitative pattern:

- `identityScore`: low to medium
- `credentialScore`: low to medium
- `historyScore`: declining or low
- `failedAuthCount`: recurring moderate-to-high
- `unauthorizedAccessCount`: recurring
- `abnormalRequestCount`: high
- `cpuViolationCount`: recurring
- `memoryViolationCount`: recurring
- `slaViolationCount`: recurring

Expected outcome:

- `ATS < 50`
- trust state `Untrusted`

## Cross-Variant Compatibility

The same logical update must produce compatible inputs across all variants.

### Variant A Input Shape

Variant A receives:

- final `ats`
- final `trustState`

### Variant B Input Shape

Variant B receives:

- `identityScore`
- `credentialScore`
- `behaviorScore`
- `historyScore`

### Variant C Input Shape

Variant C receives:

- `identityScore`
- `credentialScore`
- `historyScore`
- raw violation counters used to derive `behaviorScore`

### Compatibility Rule

For a given:

- `entity_id`
- `sequence_no`

the inputs must represent the same logical trust observation across all variants.

That means:

- Variant A final outputs must be derived from the same logical observation used by Variant B and Variant C
- Variant B `behaviorScore` must match the behavior score derived from Variant C raw counters under the shared penalty model

## inputHash Compatibility

Each logical update should produce one deterministic `inputHash`.

The `inputHash` should be derived from the canonical logical observation, not from variant-specific payload formatting.

This allows:

- row matching in `updates.csv`
- validation of read results
- cross-variant comparison in `consistency.csv`

## CSV Compatibility

### `updates.csv`

The workload spec defines the stable identifiers used by:

- `entity_id`
- `entity_profile`
- `sequence_no`
- `scheduled_at`

It also indirectly defines the inputs used to produce:

- `ats`
- `trust_state`
- `input_hash`

### `reads.csv`

The workload spec ensures that registry reads can be traced back to:

- a specific `entity_id`
- a specific `sequence_no`
- a specific expected trust result

### `consistency.csv`

The workload spec provides the stable matching key for comparison:

- `entity_id`
- `sequence_no`
- `input_hash`

## Recommended Validation Rules

Before implementation begins, the experiment should enforce these logical checks:

- exactly 10 entities are defined
- exactly 4 are normal
- exactly 3 are suspicious
- exactly 3 are malicious
- each entity has exactly 30 scheduled updates for the default run
- sequence numbers are contiguous per entity
- each logical update maps to exactly one deterministic `inputHash`
