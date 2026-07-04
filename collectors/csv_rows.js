function toCsvRow(values) {
  return values
    .map((value) => {
      if (value == null) return "";
      const text = String(value);
      if (text.includes(",") || text.includes("\"") || text.includes("\n")) {
        return `"${text.replace(/"/g, "\"\"")}"`;
      }
      return text;
    })
    .join(",");
}

function buildUpdatesHeader() {
  return [
    "run_id",
    "variant",
    "entity_id",
    "entity_profile",
    "sequence_no",
    "scheduled_at",
    "datm_start_at",
    "datm_end_at",
    "datm_processing_ms",
    "submit_at",
    "tx_hash",
    "receipt_at",
    "tx_status",
    "gas_used",
    "effective_gas_price",
    "block_number",
    "block_hash",
    "block_timestamp",
    "confirmation_latency_ms",
    "block_inclusion_latency_ms",
    "end_to_end_latency_ms",
    "ats",
    "trust_state",
    "calc_timestamp",
    "input_hash",
    "error_code",
    "error_message",
  ];
}

function buildReadsHeader() {
  return [
    "run_id",
    "variant",
    "entity_id",
    "sequence_no",
    "read_started_at",
    "read_finished_at",
    "read_latency_ms",
    "block_tag",
    "returned_ats",
    "returned_trust_state",
    "returned_timestamp",
    "read_success",
    "error_code",
    "error_message",
  ];
}

function buildConsistencyHeader() {
  return [
    "comparison_id",
    "entity_id",
    "sequence_no",
    "input_hash",
    "ats_a",
    "state_a",
    "ats_b",
    "state_b",
    "ats_c",
    "state_c",
    "consistent_state",
    "ats_delta_ab",
    "ats_delta_ac",
    "ats_delta_bc",
    "comparison_notes",
  ];
}

function buildEventsStorageHeader() {
  return [
    "run_id",
    "variant",
    "checkpoint_no",
    "observed_at",
    "block_number",
    "cumulative_updates",
    "cumulative_successful_updates",
    "cumulative_events",
    "unique_entities_seen",
    "estimated_storage_records",
    "estimated_storage_slots",
    "notes",
  ];
}

module.exports = {
  toCsvRow,
  buildUpdatesHeader,
  buildReadsHeader,
  buildEventsStorageHeader,
  buildConsistencyHeader,
};
