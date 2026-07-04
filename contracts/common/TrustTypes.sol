// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

/// @notice Shared trust types for the DATM experiment variants.
library TrustTypes {
    enum TrustState {
        Unknown,
        Trusted,
        Suspicious,
        Untrusted
    }

    struct TrustRecord {
        bytes32 subjectId;
        uint8 ats;
        TrustState trustState;
        uint64 calcTimestamp;
        bytes32 inputHash;
    }
}
