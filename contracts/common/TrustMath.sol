// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "./TrustTypes.sol";

/// @notice Shared math and classification constants for DATM contract stubs.
library TrustMath {
    uint8 internal constant WEIGHT_IDENTITY = 25;
    uint8 internal constant WEIGHT_CREDENTIAL = 25;
    uint8 internal constant WEIGHT_BEHAVIOR = 30;
    uint8 internal constant WEIGHT_HISTORY = 20;

    uint8 internal constant PENALTY_FAILED_AUTH = 2;
    uint8 internal constant PENALTY_UNAUTHORIZED_ACCESS = 10;
    uint8 internal constant PENALTY_ABNORMAL_REQUEST = 4;
    uint8 internal constant PENALTY_CPU_VIOLATION = 3;
    uint8 internal constant PENALTY_MEMORY_VIOLATION = 3;
    uint8 internal constant PENALTY_SLA_VIOLATION = 5;

    uint8 internal constant TRUSTED_MIN = 80;
    uint8 internal constant SUSPICIOUS_MIN = 50;

    function computeBehaviorScore(
        uint256 failedAuthCount,
        uint256 unauthorizedAccessCount,
        uint256 abnormalRequestCount,
        uint256 cpuViolationCount,
        uint256 memoryViolationCount,
        uint256 slaViolationCount
    ) internal pure returns (uint8) {
        uint256 totalPenalty =
            (PENALTY_FAILED_AUTH * failedAuthCount) +
            (PENALTY_UNAUTHORIZED_ACCESS * unauthorizedAccessCount) +
            (PENALTY_ABNORMAL_REQUEST * abnormalRequestCount) +
            (PENALTY_CPU_VIOLATION * cpuViolationCount) +
            (PENALTY_MEMORY_VIOLATION * memoryViolationCount) +
            (PENALTY_SLA_VIOLATION * slaViolationCount);

        if (totalPenalty >= 100) {
            return 0;
        }

        return uint8(100 - totalPenalty);
    }

    function computeAts(
        uint8 identityScore,
        uint8 credentialScore,
        uint8 behaviorScore,
        uint8 historyScore
    ) internal pure returns (uint8) {
        uint256 weightedSum =
            (uint256(WEIGHT_IDENTITY) * identityScore) +
            (uint256(WEIGHT_CREDENTIAL) * credentialScore) +
            (uint256(WEIGHT_BEHAVIOR) * behaviorScore) +
            (uint256(WEIGHT_HISTORY) * historyScore);

        uint256 ats = weightedSum / 100;
        if (ats > 100) {
            return 100;
        }

        return uint8(ats);
    }

    function deriveTrustState(uint8 ats) internal pure returns (TrustTypes.TrustState) {
        if (ats >= TRUSTED_MIN) {
            return TrustTypes.TrustState.Trusted;
        }
        if (ats >= SUSPICIOUS_MIN) {
            return TrustTypes.TrustState.Suspicious;
        }
        return TrustTypes.TrustState.Untrusted;
    }
}
