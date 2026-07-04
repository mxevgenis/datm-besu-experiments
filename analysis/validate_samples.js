const assert = require("assert");
const { computeBehaviorScore, computeAts, deriveTrustState } = require("../datm/formulas");
const { loadSampleEntities, loadSampleUpdates } = require("../runner/load_samples");

function validateEntities(entities) {
  assert.strictEqual(entities.length, 10, "expected exactly 10 sample entities");

  const counts = entities.reduce((acc, entity) => {
    acc[entity.profile] = (acc[entity.profile] || 0) + 1;
    return acc;
  }, {});

  assert.strictEqual(counts.normal, 4, "expected 4 normal entities");
  assert.strictEqual(counts.suspicious, 3, "expected 3 suspicious entities");
  assert.strictEqual(counts.malicious, 3, "expected 3 malicious entities");
}

function validateUpdates(updates) {
  for (const update of updates) {
    const behaviorScore = computeBehaviorScore(update.indicators);
    const ats = computeAts(update.scores, behaviorScore);
    const trustState = deriveTrustState(ats);

    assert.strictEqual(
      behaviorScore,
      update.expected_behavior_score,
      `behavior score mismatch for ${update.entity_id} seq ${update.sequence_no}`
    );
    assert.strictEqual(
      ats,
      update.expected_ats,
      `ATS mismatch for ${update.entity_id} seq ${update.sequence_no}`
    );
    assert.strictEqual(
      trustState,
      update.expected_state,
      `trust state mismatch for ${update.entity_id} seq ${update.sequence_no}`
    );
  }
}

function main() {
  const entities = loadSampleEntities();
  const updates = loadSampleUpdates();

  validateEntities(entities);
  validateUpdates(updates);

  console.log(`Validated ${entities.length} entities and ${updates.length} sample updates.`);
}

main();
