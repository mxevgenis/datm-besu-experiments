// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "../common/TrustMath.sol";
import "../common/TrustTypes.sol";

/// @notice Variant C stub: raw counters on-chain, behavior score and ATS on-chain.
contract TrustRegistryC {
    event TrustUpdated(
        bytes32 indexed subjectId,
        uint8 ats,
        TrustTypes.TrustState trustState,
        uint64 calcTimestamp,
        bytes32 inputHash
    );

    mapping(bytes32 => TrustTypes.TrustRecord) internal records;

    function calculateBehaviorScore(
        uint256 failedAuthCount,
        uint256 unauthorizedAccessCount,
        uint256 abnormalRequestCount,
        uint256 cpuViolationCount,
        uint256 memoryViolationCount,
        uint256 slaViolationCount
    ) external pure returns (uint8) {
        return TrustMath.computeBehaviorScore(
            failedAuthCount,
            unauthorizedAccessCount,
            abnormalRequestCount,
            cpuViolationCount,
            memoryViolationCount,
            slaViolationCount
        );
    }

    function calculateAtsFromRaw(
        uint8 identityScore,
        uint8 credentialScore,
        uint8 historyScore,
        uint256 failedAuthCount,
        uint256 unauthorizedAccessCount,
        uint256 abnormalRequestCount,
        uint256 cpuViolationCount,
        uint256 memoryViolationCount,
        uint256 slaViolationCount
    ) external pure returns (uint8) {
        uint8 behaviorScore = TrustMath.computeBehaviorScore(
            failedAuthCount,
            unauthorizedAccessCount,
            abnormalRequestCount,
            cpuViolationCount,
            memoryViolationCount,
            slaViolationCount
        );

        return TrustMath.computeAts(identityScore, credentialScore, behaviorScore, historyScore);
    }

    function updateTrust(
        bytes32 subjectId,
        uint8 identityScore,
        uint8 credentialScore,
        uint8 historyScore,
        uint256 failedAuthCount,
        uint256 unauthorizedAccessCount,
        uint256 abnormalRequestCount,
        uint256 cpuViolationCount,
        uint256 memoryViolationCount,
        uint256 slaViolationCount,
        uint64 calcTimestamp,
        bytes32 inputHash
    ) external {
        uint8 behaviorScore = TrustMath.computeBehaviorScore(
            failedAuthCount,
            unauthorizedAccessCount,
            abnormalRequestCount,
            cpuViolationCount,
            memoryViolationCount,
            slaViolationCount
        );
        uint8 ats = TrustMath.computeAts(identityScore, credentialScore, behaviorScore, historyScore);
        TrustTypes.TrustState trustState = TrustMath.deriveTrustState(ats);

        records[subjectId] = TrustTypes.TrustRecord({
            subjectId: subjectId,
            ats: ats,
            trustState: trustState,
            calcTimestamp: calcTimestamp,
            inputHash: inputHash
        });

        emit TrustUpdated(subjectId, ats, trustState, calcTimestamp, inputHash);
    }

    function getTrustRecord(bytes32 subjectId) external view returns (TrustTypes.TrustRecord memory) {
        return records[subjectId];
    }
}
