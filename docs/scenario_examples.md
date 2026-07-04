# Scenario Examples

## Purpose

This document provides fully worked trust-update examples for one normal entity, one suspicious entity, and one malicious entity.

These examples use the shared formulas and default weights already defined in the DATM experiment specifications.

## Shared Formulas

### Behavior Score

`behaviorScore = max(0, 100 - totalPenalty)`

Where:

`totalPenalty =`

- `2 * failedAuthCount`
- `+ 10 * unauthorizedAccessCount`
- `+ 4 * abnormalRequestCount`
- `+ 3 * cpuViolationCount`
- `+ 3 * memoryViolationCount`
- `+ 5 * slaViolationCount`

### ATS

`ATS = (25*I + 25*C + 30*B + 20*H) / 100`

Where:

- `I = identityScore`
- `C = credentialScore`
- `B = behaviorScore`
- `H = historyScore`

### Trust State Thresholds

- `Trusted` if `ATS >= 80`
- `Suspicious` if `50 <= ATS < 80`
- `Untrusted` if `ATS < 50`

## Example 1: Normal Entity

Entity:

- `entity_id = entity-01-normal`
- `profile = normal`

Inputs:

- `identityScore = 95`
- `credentialScore = 92`
- `historyScore = 88`

Behavior indicators:

- `failedAuthCount = 0`
- `unauthorizedAccessCount = 0`
- `abnormalRequestCount = 1`
- `cpuViolationCount = 0`
- `memoryViolationCount = 0`
- `slaViolationCount = 0`

Behavior score calculation:

- `totalPenalty = 2*0 + 10*0 + 4*1 + 3*0 + 3*0 + 5*0`
- `totalPenalty = 4`
- `behaviorScore = 100 - 4 = 96`

ATS calculation:

- `ATS = (25*95 + 25*92 + 30*96 + 20*88) / 100`
- `ATS = (2375 + 2300 + 2880 + 1760) / 100`
- `ATS = 9315 / 100`
- `ATS = 93`

Final classification:

- `trustState = Trusted`

Summary:

- `identityScore = 95`
- `credentialScore = 92`
- `behaviorScore = 96`
- `historyScore = 88`
- `ATS = 93`
- `trustState = Trusted`

## Example 2: Suspicious Entity

Entity:

- `entity_id = entity-05-suspicious`
- `profile = suspicious`

Inputs:

- `identityScore = 72`
- `credentialScore = 68`
- `historyScore = 60`

Behavior indicators:

- `failedAuthCount = 4`
- `unauthorizedAccessCount = 1`
- `abnormalRequestCount = 3`
- `cpuViolationCount = 1`
- `memoryViolationCount = 1`
- `slaViolationCount = 1`

Behavior score calculation:

- `totalPenalty = 2*4 + 10*1 + 4*3 + 3*1 + 3*1 + 5*1`
- `totalPenalty = 8 + 10 + 12 + 3 + 3 + 5`
- `totalPenalty = 41`
- `behaviorScore = 100 - 41 = 59`

ATS calculation:

- `ATS = (25*72 + 25*68 + 30*59 + 20*60) / 100`
- `ATS = (1800 + 1700 + 1770 + 1200) / 100`
- `ATS = 6470 / 100`
- `ATS = 64`

Final classification:

- `trustState = Suspicious`

Summary:

- `identityScore = 72`
- `credentialScore = 68`
- `behaviorScore = 59`
- `historyScore = 60`
- `ATS = 64`
- `trustState = Suspicious`

## Example 3: Malicious Entity

Entity:

- `entity_id = entity-08-malicious`
- `profile = malicious`

Inputs:

- `identityScore = 40`
- `credentialScore = 35`
- `historyScore = 30`

Behavior indicators:

- `failedAuthCount = 8`
- `unauthorizedAccessCount = 3`
- `abnormalRequestCount = 6`
- `cpuViolationCount = 3`
- `memoryViolationCount = 2`
- `slaViolationCount = 3`

Behavior score calculation:

- `totalPenalty = 2*8 + 10*3 + 4*6 + 3*3 + 3*2 + 5*3`
- `totalPenalty = 16 + 30 + 24 + 9 + 6 + 15`
- `totalPenalty = 100`
- `behaviorScore = 100 - 100 = 0`

ATS calculation:

- `ATS = (25*40 + 25*35 + 30*0 + 20*30) / 100`
- `ATS = (1000 + 875 + 0 + 600) / 100`
- `ATS = 2475 / 100`
- `ATS = 24`

Final classification:

- `trustState = Untrusted`

Summary:

- `identityScore = 40`
- `credentialScore = 35`
- `behaviorScore = 0`
- `historyScore = 30`
- `ATS = 24`
- `trustState = Untrusted`
