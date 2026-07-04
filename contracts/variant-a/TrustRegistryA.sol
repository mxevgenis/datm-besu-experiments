// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "../common/TrustTypes.sol";

/// @notice Variant A stub: off-chain DATM, on-chain storage only.
contract TrustRegistryA {
    event TrustUpdated(
        bytes32 indexed subjectId,
        uint8 ats,
        TrustTypes.TrustState trustState,
        uint64 calcTimestamp,
        bytes32 inputHash
    );

    mapping(bytes32 => TrustTypes.TrustRecord) internal records;

    function updateTrust(
        bytes32 subjectId,
        uint8 ats,
        TrustTypes.TrustState trustState,
        uint64 calcTimestamp,
        bytes32 inputHash
    ) external {
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
