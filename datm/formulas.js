const WEIGHTS = Object.freeze({
  identity: 25,
  credential: 25,
  behavior: 30,
  history: 20,
});

const PENALTIES = Object.freeze({
  failedAuthCount: 2,
  unauthorizedAccessCount: 10,
  abnormalRequestCount: 4,
  cpuViolationCount: 3,
  memoryViolationCount: 3,
  slaViolationCount: 5,
});

function clampScore(value) {
  if (value < 0) return 0;
  if (value > 100) return 100;
  return value;
}

function computeTotalPenalty(indicators) {
  return (
    PENALTIES.failedAuthCount * indicators.failedAuthCount +
    PENALTIES.unauthorizedAccessCount * indicators.unauthorizedAccessCount +
    PENALTIES.abnormalRequestCount * indicators.abnormalRequestCount +
    PENALTIES.cpuViolationCount * indicators.cpuViolationCount +
    PENALTIES.memoryViolationCount * indicators.memoryViolationCount +
    PENALTIES.slaViolationCount * indicators.slaViolationCount
  );
}

function computeBehaviorScore(indicators) {
  return clampScore(100 - computeTotalPenalty(indicators));
}

function computeAts(scores, behaviorScore) {
  const weightedSum =
    WEIGHTS.identity * scores.identityScore +
    WEIGHTS.credential * scores.credentialScore +
    WEIGHTS.behavior * behaviorScore +
    WEIGHTS.history * scores.historyScore;

  return clampScore(Math.floor(weightedSum / 100));
}

function deriveTrustState(ats) {
  if (ats >= 80) return "Trusted";
  if (ats >= 50) return "Suspicious";
  return "Untrusted";
}

module.exports = {
  WEIGHTS,
  PENALTIES,
  computeTotalPenalty,
  computeBehaviorScore,
  computeAts,
  deriveTrustState,
};
