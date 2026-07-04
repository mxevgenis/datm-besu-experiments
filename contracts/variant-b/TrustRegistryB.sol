// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "../common/TrustMath.sol";
import "../common/TrustTypes.sol";

/// @notice Variant B stub: off-chain normalization, on-chain ATS and state.
contract TrustRegistryB {
    event TrustUpdated(
        bytes32 indexed subjectId,
        uint8 ats,
        TrustTypes.TrustState trustState,
        uint64 calcTimestamp,
        bytes32 inputHash
    );

    mapping(bytes32 => TrustTypes.TrustRecord) internal records;

    function calculateAts(
        uint8 identityScore,
        uint8 credentialScore,
        uint8 behaviorScore,
        uint8 historyScore
    ) external pure returns (uint8) {
        return TrustMath.computeAts(identityScore, credentialScore, behaviorScore, historyScore);
    }

    function classifyAts(uint8 ats) external pure returns (TrustTypes.TrustState) {
        return TrustMath.deriveTrustState(ats);
    }

    function updateTrust(
        bytes32 subjectId,
        uint8 identityScore,
        uint8 credentialScore,
        uint8 behaviorScore,
        uint8 historyScore,
        uint64 calcTimestamp,
        bytes32 inputHash
    ) external {
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
