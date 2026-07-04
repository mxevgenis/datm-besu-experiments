const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const { computeBehaviorScore, computeAts, deriveTrustState } = require("../datm/formulas");
const { loadSampleUpdates } = require("./load_samples");
const {
  toCsvRow,
  buildUpdatesHeader,
  buildReadsHeader,
  buildEventsStorageHeader,
  buildConsistencyHeader,
} = require("../collectors/csv_rows");

const OUTPUT_DIR = path.join(__dirname, "..", "results", "raw");
const RUN_ID = "offline-sample-run";
const RUN_START = new Date("2026-07-04T12:00:00.000Z");

function isoAtOffset(offsetSec, extraMs = 0) {
  return new Date(RUN_START.getTime() + offsetSec * 1000 + extraMs).toISOString();
}

function fakeInputHash(update) {
  return "0x" + crypto.createHash("sha256").update(JSON.stringify(update)).digest("hex");
}

function generateUpdatesCsv(updates) {
  const lines = [toCsvRow(buildUpdatesHeader())];

  for (const update of updates) {
    const inputHash = fakeInputHash(update);
    lines.push(
      toCsvRow([
        RUN_ID,
        "offline",
        update.entity_id,
        update.profile,
        update.sequence_no,
        isoAtOffset(update.timestamp_offset_sec),
        isoAtOffset(update.timestamp_offset_sec, 5),
        isoAtOffset(update.timestamp_offset_sec, 7),
        2,
        "",
        "",
        "",
        "not_submitted",
        "",
        "",
        "",
        "",
        "",
        "",
        "",
        2,
        update.expected_ats,
        update.expected_state,
        isoAtOffset(update.timestamp_offset_sec),
        inputHash,
        "",
        "",
      ])
    );
  }

  return lines.join("\n") + "\n";
}

function generateReadsCsv(updates) {
  const lines = [toCsvRow(buildReadsHeader())];

  for (const update of updates) {
    lines.push(
      toCsvRow([
        RUN_ID,
        "offline",
        update.entity_id,
        update.sequence_no,
        isoAtOffset(update.timestamp_offset_sec, 15),
        isoAtOffset(update.timestamp_offset_sec, 18),
        3,
        "latest",
        update.expected_ats,
        update.expected_state,
        isoAtOffset(update.timestamp_offset_sec),
        true,
        "",
        "",
      ])
    );
  }

  return lines.join("\n") + "\n";
}

function generateConsistencyCsv(updates) {
  const lines = [toCsvRow(buildConsistencyHeader())];

  for (const update of updates) {
    const inputHash = fakeInputHash(update);
    lines.push(
      toCsvRow([
        `${update.entity_id}-${update.sequence_no}`,
        update.entity_id,
        update.sequence_no,
        inputHash,
        update.expected_ats,
        update.expected_state,
        update.expected_ats,
        update.expected_state,
        update.expected_ats,
        update.expected_state,
        true,
        0,
        0,
        0,
        "offline sample assumes identical outputs across variants",
      ])
    );
  }

  return lines.join("\n") + "\n";
}

function generateEventsStorageCsv(updates) {
  const uniqueEntities = new Set(updates.map((update) => update.entity_id)).size;
  const lines = [toCsvRow(buildEventsStorageHeader())];

  lines.push(
    toCsvRow([
      RUN_ID,
      "offline",
      1,
      isoAtOffset(60),
      "",
      updates.length,
      updates.length,
      updates.length,
      uniqueEntities,
      uniqueEntities,
      uniqueEntities * 4,
      "offline sample checkpoint derived from local fixtures",
    ])
  );

  return lines.join("\n") + "\n";
}

function main() {
  const updates = loadSampleUpdates();

  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  fs.writeFileSync(path.join(OUTPUT_DIR, "updates.sample.csv"), generateUpdatesCsv(updates));
  fs.writeFileSync(path.join(OUTPUT_DIR, "reads.sample.csv"), generateReadsCsv(updates));
  fs.writeFileSync(path.join(OUTPUT_DIR, "events_storage.sample.csv"), generateEventsStorageCsv(updates));
  fs.writeFileSync(path.join(OUTPUT_DIR, "consistency.sample.csv"), generateConsistencyCsv(updates));

  console.log(`Wrote sample CSV files to ${OUTPUT_DIR}`);
}

main();
