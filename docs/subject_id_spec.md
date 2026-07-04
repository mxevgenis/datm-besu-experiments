# Subject ID Specification

## Purpose

This document defines how logical experiment entity names map to on-chain `bytes32` subject identifiers.

This is a design artifact only. It does not implement hashing code.

## Canonical Mapping Rule

For every logical entity name:

- `subjectId = keccak256(utf8(entityName))`

Interpretation:

- `entityName` is first encoded as UTF-8 bytes
- the UTF-8 byte string is hashed with `keccak256`
- the hash output is used directly as the `bytes32` `subjectId`

## Output Format

The resulting `subjectId` must be represented as:

- a `0x`-prefixed hexadecimal string
- exactly 32 bytes
- exactly 64 hexadecimal characters after `0x`

Example format:

- `0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef`

## Canonical Entity Names

The experiment uses the following canonical entity names:

- `entity-01-normal`
- `entity-02-normal`
- `entity-03-normal`
- `entity-04-normal`
- `entity-05-suspicious`
- `entity-06-suspicious`
- `entity-07-suspicious`
- `entity-08-malicious`
- `entity-09-malicious`
- `entity-10-malicious`

These strings must be used exactly as written when deriving `subjectId` values.

## Determinism Rules

To preserve cross-variant comparability:

- the same `entityName` must always produce the same `subjectId`
- the same entity must use the same `subjectId` in Variant A, Variant B, and Variant C
- no extra whitespace, uppercase normalization, or alternate labels may be introduced before hashing

## Mapping Table

The conceptual mapping is:

- `entity-01-normal -> keccak256(utf8("entity-01-normal"))`
- `entity-02-normal -> keccak256(utf8("entity-02-normal"))`
- `entity-03-normal -> keccak256(utf8("entity-03-normal"))`
- `entity-04-normal -> keccak256(utf8("entity-04-normal"))`
- `entity-05-suspicious -> keccak256(utf8("entity-05-suspicious"))`
- `entity-06-suspicious -> keccak256(utf8("entity-06-suspicious"))`
- `entity-07-suspicious -> keccak256(utf8("entity-07-suspicious"))`
- `entity-08-malicious -> keccak256(utf8("entity-08-malicious"))`
- `entity-09-malicious -> keccak256(utf8("entity-09-malicious"))`
- `entity-10-malicious -> keccak256(utf8("entity-10-malicious"))`

## Storage and CSV Implications

- Contracts should use the hashed `subjectId` as the on-chain identifier.
- Off-chain scenario files may keep both `entityName` and `subjectId` for readability and traceability.
- CSV outputs should continue to use stable logical `entity_id` labels, while contract interactions use the corresponding `subjectId`.

## Recommended Traceability Fields

For future sample data and scenario files, each entity entry should include:

- `entity_id`: human-readable logical name
- `profile`: `normal`, `suspicious`, or `malicious`
- `subject_id_method`: `keccak256(utf8(entityName))`
- `subject_id_source`: canonical entity name string

## Out of Scope

This document does not:

- compute concrete hash outputs
- define a specific hashing library
- define Solidity or JavaScript helper functions
