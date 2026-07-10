const fs = require("fs");
const crypto = require("crypto");
const path = require("path");
const { ethers } = require("ethers");
const { loadSampleEntities } = require("./load_samples");
const { computeBehaviorScore, computeAts, deriveTrustState } = require("../datm/formulas");
const { ROOT, loadEnv } = require("./load_env");

function requireEnv(name) {
  const value = process.env[name];
  if (value == null || value.trim() === "") {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value.trim();
}

function getPrivateKey() {
  loadEnv();

  const privateKey = process.env.PRIVATE_KEY && process.env.PRIVATE_KEY.trim() !== ""
    ? process.env.PRIVATE_KEY.trim()
    : process.env.FROM_PK && process.env.FROM_PK.trim() !== ""
      ? process.env.FROM_PK.trim()
      : "";

  if (privateKey === "") {
    throw new Error("Missing sender key: set PRIVATE_KEY or FROM_PK");
  }

  if (!privateKey.startsWith("0x")) {
    throw new Error("Sender key must be a 0x-prefixed hex string");
  }

  return privateKey;
}

function getRunConfig() {
  loadEnv();

  const runMode = (process.env.RUN_MODE || "preflight").trim() || "preflight";
  const targetVariant = (process.env.TARGET_VARIANT || "").trim().toUpperCase();
  const runLabel = (process.env.RUN_LABEL || "").trim();
  const updateIntervalSec = parseInt((process.env.UPDATE_INTERVAL_SEC || "10").trim(), 10);
  const durationSec = parseInt((process.env.DURATION_SEC || "300").trim(), 10);
  const blockPeriodSec = parseInt((process.env.BLOCK_PERIOD_SEC || "10").trim(), 10);
  const roundStaggerMs = parseInt((process.env.ROUND_STAGGER_MS || "1500").trim(), 10);
  const submitRetryMax = parseInt((process.env.SUBMIT_RETRY_MAX || "3").trim(), 10);
  const submitRetryBackoffMs = parseInt((process.env.SUBMIT_RETRY_BACKOFF_MS || "3000").trim(), 10);
  const entityLimitRaw = (process.env.ENTITY_LIMIT || "").trim();
  const roundLimitRaw = (process.env.ROUND_LIMIT || "").trim();
  const entityLimit = entityLimitRaw === "" ? null : parseInt(entityLimitRaw, 10);
  const roundLimit = roundLimitRaw === "" ? null : parseInt(roundLimitRaw, 10);

  return {
    runMode,
    targetVariant,
    runLabel,
    updateIntervalSec,
    durationSec,
    blockPeriodSec,
    roundStaggerMs,
    submitRetryMax,
    submitRetryBackoffMs,
    entityLimit,
    roundLimit,
  };
}

function getContractAddresses() {
  loadEnv();

  return {
    variantA: requireEnv("VARIANT_A_CONTRACT"),
    variantB: requireEnv("VARIANT_B_CONTRACT"),
    variantC: requireEnv("VARIANT_C_CONTRACT"),
  };
}

function createProvider() {
  loadEnv();
  return new ethers.providers.JsonRpcProvider(requireEnv("BESU_RPC_URL"));
}

function createWallet(provider) {
  return new ethers.Wallet(getPrivateKey(), provider);
}

function loadArtifact(relativePath) {
  return JSON.parse(fs.readFileSync(path.join(ROOT, relativePath), "utf8"));
}

function loadArtifacts() {
  return {
    variantA: loadArtifact("artifacts/contracts/variant-a/TrustRegistryA.sol/TrustRegistryA.json"),
    variantB: loadArtifact("artifacts/contracts/variant-b/TrustRegistryB.sol/TrustRegistryB.json"),
    variantC: loadArtifact("artifacts/contracts/variant-c/TrustRegistryC.sol/TrustRegistryC.json"),
  };
}

function loadContracts(wallet, addresses) {
  const artifacts = loadArtifacts();

  return {
    variantA: new ethers.Contract(addresses.variantA, artifacts.variantA.abi, wallet),
    variantB: new ethers.Contract(addresses.variantB, artifacts.variantB.abi, wallet),
    variantC: new ethers.Contract(addresses.variantC, artifacts.variantC.abi, wallet),
  };
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

function buildObservation(entity, sequenceNo, updateIntervalSec, runStartIso) {
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
  const timestampOffsetSec = (sequenceNo - 1) * updateIntervalSec;
  const runStart = new Date(runStartIso);
  const calcTimestamp = new Date(runStart.getTime() + timestampOffsetSec * 1000).toISOString();
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

function buildPreflightObservations(updateIntervalSec) {
  const entities = loadSampleEntities();
  const runStartIso = new Date().toISOString();
  const canonicalEntity = entities.find((entry) => entry.profile === "normal");
  const canonicalObservation = buildObservation(canonicalEntity, 1, updateIntervalSec, runStartIso);
  return {
    runStartIso,
    entities,
    observation: canonicalObservation,
  };
}

function buildRunObservations(durationSec, updateIntervalSec, entityLimit, roundLimit) {
  const allEntities = loadSampleEntities();
  const entities = entityLimit == null ? allEntities : allEntities.slice(0, Math.max(0, entityLimit));
  const runStartIso = new Date().toISOString();
  const computedRounds = Math.max(1, Math.floor(durationSec / updateIntervalSec));
  const roundCount = roundLimit == null ? computedRounds : Math.max(1, Math.min(computedRounds, roundLimit));
  const observations = [];

  for (let sequenceNo = 1; sequenceNo <= roundCount; sequenceNo += 1) {
    for (const entity of entities) {
      observations.push(buildObservation(entity, sequenceNo, updateIntervalSec, runStartIso));
    }
  }

  return {
    runStartIso,
    entities,
    roundCount,
    observations,
  };
}

function ensureOutputDir() {
  fs.mkdirSync(path.join(ROOT, "results", "raw"), { recursive: true });
}

module.exports = {
  ROOT,
  requireEnv,
  getPrivateKey,
  getRunConfig,
  getContractAddresses,
  createProvider,
  createWallet,
  loadArtifacts,
  loadContracts,
  buildPreflightObservations,
  buildRunObservations,
  ensureOutputDir,
};
