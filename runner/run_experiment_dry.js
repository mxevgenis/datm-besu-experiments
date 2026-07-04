const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const { ethers } = require("ethers");
const { loadSampleEntities } = require("./load_samples");
const { computeBehaviorScore, computeAts, deriveTrustState } = require("../datm/formulas");
const {
  toCsvRow,
  buildUpdatesHeader,
  buildReadsHeader,
  buildEventsStorageHeader,
  buildConsistencyHeader,
} = require("../collectors/csv_rows");

const ROOT = path.join(__dirname, "..");
const OUTPUT_DIR = path.join(ROOT, "results", "raw");
const RUN_ID = "datm-dry-run-001";
const RUN_START = new Date("2026-07-04T12:00:00.000Z");
const ROUND_COUNT = 30;
const INTERVAL_SEC = 10;

function ensureOutputDir() {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}

function isoAtOffset(offsetSec, extraMs) {
  return new Date(RUN_START.getTime() + offsetSec * 1000 + (extraMs || 0)).toISOString();
}

function profileBase(profile) {
  if (profile === "normal") {
    return {
      identity: 93,
      credential: 91,
      history: 88,
      indicators: {
        failedAuthCount: 0,
        unauthorizedAccessCount: 0,
        abnormalRequestCount: 0,
        cpuViolationCount: 0,
        memoryViolationCount: 0,
        slaViolationCount: 0,
      },
    };
  }

  if (profile === "suspicious") {
    return {
      identity: 72,
      credential: 68,
      history: 61,
      indicators: {
        failedAuthCount: 3,
        unauthorizedAccessCount: 1,
        abnormalRequestCount: 2,
        cpuViolationCount: 1,
        memoryViolationCount: 1,
        slaViolationCount: 1,
      },
    };
  }

  return {
    identity: 43,
    credential: 38,
    history: 35,
    indicators: {
      failedAuthCount: 6,
      unauthorizedAccessCount: 2,
      abnormalRequestCount: 5,
      cpuViolationCount: 2,
      memoryViolationCount: 2,
      slaViolationCount: 2,
    },
  };
}

function parseEntityOrdinal(entityId) {
  const match = entityId.match(/entity-(\d+)-/);
  return match ? parseInt(match[1], 10) : 0;
}

function clampIndicator(value) {
  return value < 0 ? 0 : value;
}

function buildObservation(entity, sequenceNo) {
  const ordinal = parseEntityOrdinal(entity.entity_id);
  const phase = sequenceNo - 1;
  const base = profileBase(entity.profile);
  const entityOffset = (ordinal - 1) % 3;
  const wave = phase % 4;

  let identityScore = base.identity;
  let credentialScore = base.credential;
  let historyScore = base.history;
  const indicators = Object.assign({}, base.indicators);

  if (entity.profile === "normal") {
    identityScore -= wave % 2;
    credentialScore -= (phase + entityOffset) % 2;
    historyScore = Math.max(82, base.history - Math.floor(phase / 12));
    indicators.abnormalRequestCount = (phase + entityOffset) % 3 === 0 ? 1 : 0;
    indicators.cpuViolationCount = phase % 10 === 0 ? 1 : 0;
    indicators.memoryViolationCount = phase % 15 === 0 ? 1 : 0;
    indicators.slaViolationCount = phase % 20 === 0 ? 1 : 0;
  } else if (entity.profile === "suspicious") {
    identityScore = base.identity - ((phase + entityOffset) % 5);
    credentialScore = base.credential - ((phase + 1 + entityOffset) % 5);
    historyScore = Math.max(52, base.history - Math.floor(phase / 10));
    indicators.failedAuthCount = 3 + ((phase + entityOffset) % 3);
    indicators.unauthorizedAccessCount = 1 + (((phase + entityOffset) % 6) === 0 ? 1 : 0);
    indicators.abnormalRequestCount = 2 + ((phase + entityOffset) % 4);
    indicators.cpuViolationCount = 1 + ((phase + entityOffset) % 2);
    indicators.memoryViolationCount = 1 + (((phase + 1) + entityOffset) % 2);
    indicators.slaViolationCount = 1 + (((phase + entityOffset) % 5) === 0 ? 1 : 0);
  } else {
    identityScore = Math.max(20, base.identity - Math.floor(phase / 4) - entityOffset);
    credentialScore = Math.max(15, base.credential - Math.floor(phase / 5) - entityOffset);
    historyScore = Math.max(12, base.history - Math.floor(phase / 3));
    indicators.failedAuthCount = 6 + ((phase + entityOffset) % 4);
    indicators.unauthorizedAccessCount = 2 + (((phase + entityOffset) % 3) === 0 ? 1 : 0);
    indicators.abnormalRequestCount = 5 + ((phase + entityOffset) % 3);
    indicators.cpuViolationCount = 2 + ((phase + entityOffset) % 2);
    indicators.memoryViolationCount = 2 + (((phase + 1) + entityOffset) % 2);
    indicators.slaViolationCount = 2 + (((phase + entityOffset) % 4) === 0 ? 1 : 0);
  }

  const normalizedIndicators = {
    failedAuthCount: clampIndicator(indicators.failedAuthCount),
    unauthorizedAccessCount: clampIndicator(indicators.unauthorizedAccessCount),
    abnormalRequestCount: clampIndicator(indicators.abnormalRequestCount),
    cpuViolationCount: clampIndicator(indicators.cpuViolationCount),
    memoryViolationCount: clampIndicator(indicators.memoryViolationCount),
    slaViolationCount: clampIndicator(indicators.slaViolationCount),
  };

  const scores = {
    identityScore: Math.max(0, Math.min(100, identityScore)),
    credentialScore: Math.max(0, Math.min(100, credentialScore)),
    historyScore: Math.max(0, Math.min(100, historyScore)),
  };

  const behaviorScore = computeBehaviorScore(normalizedIndicators);
  const ats = computeAts(scores, behaviorScore);
  const trustState = deriveTrustState(ats);
  const timestampOffsetSec = (sequenceNo - 1) * INTERVAL_SEC;
  const calcTimestamp = isoAtOffset(timestampOffsetSec);
  const subjectId = ethers.utils.keccak256(ethers.utils.toUtf8Bytes(entity.entity_id));
  const inputHash = "0x" + crypto.createHash("sha256").update(JSON.stringify({
    subjectId,
    sequenceNo,
    scores,
    normalizedIndicators,
  })).digest("hex");

  return {
    entity_id: entity.entity_id,
    profile: entity.profile,
    subjectId,
    sequence_no: sequenceNo,
    timestamp_offset_sec: timestampOffsetSec,
    scores,
    indicators: normalizedIndicators,
    behaviorScore,
    expected_ats: ats,
    expected_state: trustState,
    calc_timestamp: calcTimestamp,
    input_hash: inputHash,
  };
}

function generateObservations(entities) {
  const observations = [];
  for (let sequenceNo = 1; sequenceNo <= ROUND_COUNT; sequenceNo += 1) {
    for (const entity of entities) {
      observations.push(buildObservation(entity, sequenceNo));
    }
  }
  return observations;
}

function simulateVariants(observation) {
  const variantA = {
    variant: "A",
    ats: observation.expected_ats,
    trustState: observation.expected_state,
  };

  const variantBBehaviorScore = computeBehaviorScore(observation.indicators);
  const variantBAts = computeAts(observation.scores, variantBBehaviorScore);
  const variantB = {
    variant: "B",
    ats: variantBAts,
    trustState: deriveTrustState(variantBAts),
    behaviorScore: variantBBehaviorScore,
  };

  const variantCBehaviorScore = computeBehaviorScore(observation.indicators);
  const variantCAts = computeAts(observation.scores, variantCBehaviorScore);
  const variantC = {
    variant: "C",
    ats: variantCAts,
    trustState: deriveTrustState(variantCAts),
    behaviorScore: variantCBehaviorScore,
  };

  return { variantA, variantB, variantC };
}

function syntheticTiming(observation, variant) {
  const variantOffset = variant === "A" ? 0 : variant === "B" ? 3 : 6;
  const baseOffsetSec = observation.timestamp_offset_sec;
  return {
    scheduledAt: isoAtOffset(baseOffsetSec),
    datmStartAt: isoAtOffset(baseOffsetSec, 10 + variantOffset),
    datmEndAt: isoAtOffset(baseOffsetSec, 12 + variantOffset),
    submitAt: isoAtOffset(baseOffsetSec, 20 + variantOffset),
    receiptAt: isoAtOffset(baseOffsetSec, 80 + variantOffset),
    blockTimestamp: isoAtOffset(baseOffsetSec, 70 + variantOffset),
    readStartedAt: isoAtOffset(baseOffsetSec, 120 + variantOffset),
    readFinishedAt: isoAtOffset(baseOffsetSec, 126 + variantOffset),
    datmProcessingMs: 2 + variantOffset,
    confirmationLatencyMs: 60 + variantOffset,
    blockInclusionLatencyMs: 50 + variantOffset,
    endToEndLatencyMs: 70 + variantOffset,
    readLatencyMs: 6 + variantOffset,
  };
}

function buildUpdatesCsvRows(observations) {
  const rows = [toCsvRow(buildUpdatesHeader())];

  for (const observation of observations) {
    const simulations = simulateVariants(observation);
    for (const variantResult of [simulations.variantA, simulations.variantB, simulations.variantC]) {
      const timing = syntheticTiming(observation, variantResult.variant);
      rows.push(
        toCsvRow([
          RUN_ID,
          variantResult.variant,
          observation.entity_id,
          observation.profile,
          observation.sequence_no,
          timing.scheduledAt,
          timing.datmStartAt,
          timing.datmEndAt,
          timing.datmProcessingMs,
          timing.submitAt,
          "",
          timing.receiptAt,
          "dry_run_simulated",
          variantResult.variant === "A" ? 48000 : variantResult.variant === "B" ? 62000 : 79000,
          0,
          "",
          "",
          timing.blockTimestamp,
          timing.confirmationLatencyMs,
          timing.blockInclusionLatencyMs,
          timing.endToEndLatencyMs,
          variantResult.ats,
          variantResult.trustState,
          observation.calc_timestamp,
          observation.input_hash,
          "",
          "dry-run synthetic timing and offline calculations",
        ])
      );
    }
  }

  return rows.join("\n") + "\n";
}

function buildReadsCsvRows(observations) {
  const rows = [toCsvRow(buildReadsHeader())];

  for (const observation of observations) {
    const simulations = simulateVariants(observation);
    for (const variantResult of [simulations.variantA, simulations.variantB, simulations.variantC]) {
      const timing = syntheticTiming(observation, variantResult.variant);
      rows.push(
        toCsvRow([
          RUN_ID,
          variantResult.variant,
          observation.entity_id,
          observation.sequence_no,
          timing.readStartedAt,
          timing.readFinishedAt,
          timing.readLatencyMs,
          "dry-run-latest",
          variantResult.ats,
          variantResult.trustState,
          observation.calc_timestamp,
          true,
          "",
          "dry-run read benchmark value",
        ])
      );
    }
  }

  return rows.join("\n") + "\n";
}

function buildEventsStorageCsvRows(observations) {
  const rows = [toCsvRow(buildEventsStorageHeader())];
  const variants = ["A", "B", "C"];
  const entityCount = new Set(observations.map((entry) => entry.entity_id)).size;

  for (const variant of variants) {
    for (let checkpoint = 1; checkpoint <= ROUND_COUNT; checkpoint += 1) {
      const cumulativeUpdates = checkpoint * entityCount;
      rows.push(
        toCsvRow([
          RUN_ID,
          variant,
          checkpoint,
          isoAtOffset((checkpoint - 1) * INTERVAL_SEC + 5),
          "",
          cumulativeUpdates,
          cumulativeUpdates,
          cumulativeUpdates,
          entityCount,
          entityCount,
          entityCount * 4,
          "dry-run synthetic storage checkpoint",
        ])
      );
    }
  }

  return rows.join("\n") + "\n";
}

function buildConsistencyCsvRows(observations) {
  const rows = [toCsvRow(buildConsistencyHeader())];
  let mismatchCount = 0;

  for (const observation of observations) {
    const simulations = simulateVariants(observation);
    const consistentState =
      simulations.variantA.trustState === simulations.variantB.trustState &&
      simulations.variantA.trustState === simulations.variantC.trustState;

    if (!consistentState) {
      mismatchCount += 1;
    }

    rows.push(
      toCsvRow([
        `${observation.entity_id}-${observation.sequence_no}`,
        observation.entity_id,
        observation.sequence_no,
        observation.input_hash,
        simulations.variantA.ats,
        simulations.variantA.trustState,
        simulations.variantB.ats,
        simulations.variantB.trustState,
        simulations.variantC.ats,
        simulations.variantC.trustState,
        consistentState,
        Math.abs(simulations.variantA.ats - simulations.variantB.ats),
        Math.abs(simulations.variantA.ats - simulations.variantC.ats),
        Math.abs(simulations.variantB.ats - simulations.variantC.ats),
        consistentState ? "dry-run variants agree" : "dry-run mismatch detected",
      ])
    );
  }

  return {
    csv: rows.join("\n") + "\n",
    mismatchCount,
  };
}

function finalTrustStateCounts(observations) {
  const latestByEntity = {};
  for (const observation of observations) {
    latestByEntity[observation.entity_id] = observation.expected_state;
  }

  return Object.values(latestByEntity).reduce((acc, state) => {
    acc[state] = (acc[state] || 0) + 1;
    return acc;
  }, { Trusted: 0, Suspicious: 0, Untrusted: 0 });
}

function writeFile(fileName, contents) {
  fs.writeFileSync(path.join(OUTPUT_DIR, fileName), contents);
}

function main() {
  const entities = loadSampleEntities();
  const observations = generateObservations(entities);
  const consistency = buildConsistencyCsvRows(observations);

  ensureOutputDir();
  writeFile("updates.dry.csv", buildUpdatesCsvRows(observations));
  writeFile("reads.dry.csv", buildReadsCsvRows(observations));
  writeFile("events_storage.dry.csv", buildEventsStorageCsvRows(observations));
  writeFile("consistency.dry.csv", consistency.csv);

  const stateCounts = finalTrustStateCounts(observations);

  console.log(`Dry-run entities: ${entities.length}`);
  console.log(`Dry-run logical updates: ${observations.length}`);
  console.log(`Dry-run consistency mismatches: ${consistency.mismatchCount}`);
  console.log(
    `Dry-run final trust states: Trusted=${stateCounts.Trusted}, Suspicious=${stateCounts.Suspicious}, Untrusted=${stateCounts.Untrusted}`
  );
}

main();
