const fs = require("fs");
const path = require("path");
const { ethers } = require("ethers");
const {
  toCsvRow,
  buildUpdatesHeader,
  buildReadsHeader,
  buildEventsStorageHeader,
  buildConsistencyHeader,
} = require("../collectors/csv_rows");
const {
  ROOT,
  getRunConfig,
  getContractAddresses,
  createProvider,
  createWallet,
  loadContracts,
  buildPreflightObservations,
  buildRunObservations,
  ensureOutputDir,
} = require("./live_common");

const OUTPUT_DIR = path.join(ROOT, "results", "raw");
const RUN_ID = `datm-live-${new Date().toISOString().replace(/[:.]/g, "-")}`;

function writeCsv(fileName, rows) {
  fs.writeFileSync(path.join(OUTPUT_DIR, fileName), rows.join("\n") + "\n");
}

function makeOutputName(baseName, config) {
  if (!config.runLabel) {
    return `${baseName}.csv`;
  }

  const safeLabel = config.runLabel.replace(/[^a-zA-Z0-9._-]/g, "_");
  return `${baseName}.${safeLabel}.csv`;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function trustStateLabel(value) {
  const labels = ["Unknown", "Trusted", "Suspicious", "Untrusted"];
  return typeof value === "number" ? labels[value] || `Unknown(${value})` : value;
}

function asNumber(value) {
  if (value != null && typeof value.toNumber === "function") {
    return value.toNumber();
  }

  return Number(value);
}

function buildTxResultRow(runMode, variant, observation, timing, receipt, result) {
  return toCsvRow([
    RUN_ID,
    variant,
    observation.entity_id,
    observation.profile,
    observation.sequence_no,
    timing.scheduledAt,
    timing.datmStartAt,
    timing.datmEndAt,
    timing.datmProcessingMs,
    timing.submitAt,
    receipt.transactionHash,
    timing.receiptAt,
    receipt.status === 1 ? "success" : "failed",
    receipt.gasUsed.toString(),
    receipt.effectiveGasPrice ? receipt.effectiveGasPrice.toString() : "",
    receipt.blockNumber,
    receipt.blockHash,
    timing.blockTimestamp,
    timing.confirmationLatencyMs,
    timing.blockInclusionLatencyMs,
    timing.endToEndLatencyMs,
    result.ats,
    result.trustState,
    observation.calc_timestamp,
    observation.input_hash,
    "",
    `${runMode} live execution`,
  ]);
}

function buildReadRow(variant, observation, timing, result) {
  return toCsvRow([
    RUN_ID,
    variant,
    observation.entity_id,
    observation.sequence_no,
    timing.readStartedAt,
    timing.readFinishedAt,
    timing.readLatencyMs,
    "latest",
    result.ats,
    result.trustState,
    result.calcTimestamp,
    true,
    "",
    `live read after ${timing.mode} update`,
  ]);
}

function buildSingleVariantComparisonRow(variant, observation, result) {
  return toCsvRow([
    `${observation.entity_id}-${observation.sequence_no}`,
    observation.entity_id,
    observation.sequence_no,
    observation.input_hash,
    variant === "A" ? result.ats : "",
    variant === "A" ? result.trustState : "",
    variant === "B" ? result.ats : "",
    variant === "B" ? result.trustState : "",
    variant === "C" ? result.ats : "",
    variant === "C" ? result.trustState : "",
    result.trustState === observation.expected_state,
    "",
    "",
    "",
    result.trustState === observation.expected_state
      ? `${variant} live result matches expected state`
      : `${variant} live result differs from expected state`,
  ]);
}

function buildConsistencyRow(observation, results) {
  const consistentState =
    results.A.trustState === results.B.trustState &&
    results.A.trustState === results.C.trustState;

  return {
    consistentState,
    row: toCsvRow([
      `${observation.entity_id}-${observation.sequence_no}`,
      observation.entity_id,
      observation.sequence_no,
      observation.input_hash,
      results.A.ats,
      results.A.trustState,
      results.B.ats,
      results.B.trustState,
      results.C.ats,
      results.C.trustState,
      consistentState,
      Math.abs(results.A.ats - results.B.ats),
      Math.abs(results.A.ats - results.C.ats),
      Math.abs(results.B.ats - results.C.ats),
      consistentState ? "preflight variants agree" : "preflight mismatch detected",
    ]),
  };
}

function normalizeError(error) {
  if (!error) {
    return { code: "UNKNOWN", message: "Unknown error" };
  }

  return {
    code: error.code || "ERROR",
    message: error.reason || error.message || String(error),
  };
}

function timingSnapshot(startMs, datmStartMs, datmEndMs, submitMs, receiptMs, readStartMs, readEndMs) {
  return {
    scheduledAt: new Date(startMs).toISOString(),
    datmStartAt: new Date(datmStartMs).toISOString(),
    datmEndAt: new Date(datmEndMs).toISOString(),
    datmProcessingMs: datmEndMs - datmStartMs,
    submitAt: new Date(submitMs).toISOString(),
    receiptAt: new Date(receiptMs).toISOString(),
    blockTimestamp: new Date(receiptMs).toISOString(),
    confirmationLatencyMs: receiptMs - submitMs,
    blockInclusionLatencyMs: receiptMs - submitMs,
    endToEndLatencyMs: receiptMs - datmStartMs,
    readStartedAt: new Date(readStartMs).toISOString(),
    readFinishedAt: new Date(readEndMs).toISOString(),
    readLatencyMs: readEndMs - readStartMs,
  };
}

function variantGasLimit(variant) {
  if (variant === "A") return 150000;
  if (variant === "B") return 180000;
  return 220000;
}

function makeTrustStateValue(trustState) {
  return ["Unknown", "Trusted", "Suspicious", "Untrusted"].indexOf(trustState);
}

async function populateVariantTx(variant, contract, observation) {
  if (variant === "A") {
    return contract.populateTransaction.updateTrust(
      observation.subjectId,
      observation.expected_ats,
      makeTrustStateValue(observation.expected_state),
      Math.floor(new Date(observation.calc_timestamp).getTime() / 1000),
      observation.input_hash
    );
  }

  if (variant === "B") {
    return contract.populateTransaction.updateTrust(
      observation.subjectId,
      observation.scores.identityScore,
      observation.scores.credentialScore,
      observation.behaviorScore,
      observation.scores.historyScore,
      Math.floor(new Date(observation.calc_timestamp).getTime() / 1000),
      observation.input_hash
    );
  }

  return contract.populateTransaction.updateTrust(
    observation.subjectId,
    observation.scores.identityScore,
    observation.scores.credentialScore,
    observation.scores.historyScore,
    observation.indicators.failedAuthCount,
    observation.indicators.unauthorizedAccessCount,
    observation.indicators.abnormalRequestCount,
    observation.indicators.cpuViolationCount,
    observation.indicators.memoryViolationCount,
    observation.indicators.slaViolationCount,
    Math.floor(new Date(observation.calc_timestamp).getTime() / 1000),
    observation.input_hash
  );
}

async function submitVariantTx(variant, contract, observation, overrides) {
  const txRequest = await populateVariantTx(variant, contract, observation);
  return contract.signer.sendTransaction(Object.assign({}, txRequest, overrides));
}

async function readTrustRecord(contract, observation) {
  const readStartMs = Date.now();
  const record = await contract.getTrustRecord(observation.subjectId);
  const readEndMs = Date.now();

  return {
    record,
    readStartMs,
    readEndMs,
  };
}

async function executeVariant(variant, contract, observation, mode) {
  const scheduledMs = Date.now();
  const datmStartMs = Date.now();
  const datmEndMs = Date.now();
  const tx = await submitVariantTx(variant, contract, observation, { gasLimit: variantGasLimit(variant) });

  const submitMs = Date.now();
  const receipt = await tx.wait();
  const receiptMs = Date.now();
  const readResult = await readTrustRecord(contract, observation);

  const timing = timingSnapshot(
    scheduledMs,
    datmStartMs,
    datmEndMs,
    submitMs,
    receiptMs,
    readResult.readStartMs,
    readResult.readEndMs
  );
  timing.mode = mode;

  const result = {
    txHash: receipt.transactionHash,
    gasUsed: receipt.gasUsed.toString(),
    ats: asNumber(readResult.record.ats),
    trustState: trustStateLabel(readResult.record.trustState),
    calcTimestamp: new Date(asNumber(readResult.record.calcTimestamp) * 1000).toISOString(),
    latencyMs: timing.confirmationLatencyMs,
  };

  return { timing, receipt, result };
}

async function executeVariantWithRetry(variant, contract, observation, config) {
  let lastError = null;

  for (let attempt = 1; attempt <= config.submitRetryMax; attempt += 1) {
    try {
      return await executeVariant(variant, contract, observation, config.runMode);
    } catch (error) {
      lastError = error;
      const normalized = normalizeError(error);

      if (attempt >= config.submitRetryMax) {
        break;
      }

      const delayMs = config.submitRetryBackoffMs * attempt;
      console.log(
        `[live] Retry ${attempt}/${config.submitRetryMax - 1} for variant ${variant} seq=${observation.sequence_no} entity=${observation.entity_id} after ${delayMs}ms (${normalized.code}: ${normalized.message})`
      );
      await sleep(delayMs);
    }
  }

  throw lastError;
}

async function runPromisePool(items, concurrency, worker) {
  const results = new Array(items.length);
  let nextIndex = 0;

  async function poolWorker() {
    while (true) {
      const currentIndex = nextIndex;
      nextIndex += 1;

      if (currentIndex >= items.length) {
        return;
      }

      results[currentIndex] = await worker(items[currentIndex], currentIndex);
    }
  }

  const workerCount = Math.max(1, Math.min(concurrency, items.length));
  const workers = [];
  for (let index = 0; index < workerCount; index += 1) {
    workers.push(poolWorker());
  }

  await Promise.all(workers);
  return results;
}

function createEventsCheckpointRows(runMode, roundCount, entityCount, perVariantStats) {
  const rows = [];
  for (const variant of ["A", "B", "C"]) {
    const stats = perVariantStats[variant];
    for (let checkpoint = 1; checkpoint <= roundCount; checkpoint += 1) {
      const cumulativeUpdates = checkpoint * entityCount;
      rows.push(
        toCsvRow([
          RUN_ID,
          variant,
          checkpoint,
          stats.lastObservedAt,
          stats.lastBlockNumber,
          cumulativeUpdates,
          Math.min(cumulativeUpdates, stats.successfulUpdates),
          Math.min(cumulativeUpdates, stats.successfulUpdates),
          entityCount,
          Math.min(cumulativeUpdates, stats.successfulUpdates),
          Math.min(cumulativeUpdates, stats.successfulUpdates) * 4,
          `${runMode} checkpoint`,
        ])
      );
    }
  }
  return rows;
}

async function runPreflight(config, contracts, entities, observation) {
  const updatesRows = [toCsvRow(buildUpdatesHeader())];
  const readsRows = [toCsvRow(buildReadsHeader())];
  const eventsRows = [toCsvRow(buildEventsStorageHeader())];
  const consistencyRows = [toCsvRow(buildConsistencyHeader())];
  const resultsByVariant = {};

  const mapping = [
    { key: "A", contract: contracts.variantA, observation: observation },
    { key: "B", contract: contracts.variantB, observation: observation },
    { key: "C", contract: contracts.variantC, observation: observation },
  ];

  for (const entry of mapping) {
    const execution = await executeVariant(entry.key, entry.contract, entry.observation, config.runMode);
    resultsByVariant[entry.key] = execution.result;

    updatesRows.push(
      buildTxResultRow(config.runMode, entry.key, entry.observation, execution.timing, execution.receipt, execution.result)
    );
    readsRows.push(buildReadRow(entry.key, entry.observation, execution.timing, execution.result));
    eventsRows.push(
      toCsvRow([
        RUN_ID,
        entry.key,
        1,
        execution.timing.receiptAt,
        execution.receipt.blockNumber,
        1,
        execution.receipt.status === 1 ? 1 : 0,
        1,
        1,
        1,
        4,
        "preflight single-update checkpoint",
      ])
    );

    console.log(
      `[live] Variant ${entry.key}: tx=${execution.result.txHash} gasUsed=${execution.result.gasUsed} latencyMs=${execution.result.latencyMs} ATS=${execution.result.ats} trustState=${execution.result.trustState}`
    );
  }

  const consistency = buildConsistencyRow(observation, {
    A: resultsByVariant.A,
    B: resultsByVariant.B,
    C: resultsByVariant.C,
  });
  consistencyRows.push(consistency.row);

  writeCsv("updates.preflight.csv", updatesRows);
  writeCsv("reads.preflight.csv", readsRows);
  writeCsv("events_storage.preflight.csv", eventsRows);
  writeCsv("consistency.preflight.csv", consistencyRows);

  console.log(`[live] Preflight entities loaded: ${entities.length}`);
  console.log(`[live] Preflight updates executed: 3`);
  console.log(`[live] Preflight consistency mismatches: ${consistency.consistentState ? 0 : 1}`);
}

function buildFailedUpdateRow(runMode, variant, observation, startedMs, error) {
  const normalized = normalizeError(error);
  const failedAt = new Date().toISOString();
  return toCsvRow([
    RUN_ID,
    variant,
    observation.entity_id,
    observation.profile,
    observation.sequence_no,
    new Date(startedMs).toISOString(),
    new Date(startedMs).toISOString(),
    failedAt,
    Date.now() - startedMs,
    "",
    "",
    failedAt,
    "failed",
    "",
    "",
    "",
    "",
    "",
    "",
    "",
    "",
    "",
    "",
    observation.calc_timestamp,
    observation.input_hash,
    normalized.code,
    normalized.message,
  ]);
}

function buildFailedReadRow(variant, observation, error) {
  const normalized = normalizeError(error);
  const now = new Date().toISOString();
  return toCsvRow([
    RUN_ID,
    variant,
    observation.entity_id,
    observation.sequence_no,
    now,
    now,
    "",
    "latest",
    "",
    "",
    "",
    false,
    normalized.code,
    normalized.message,
  ]);
}

function finalTrustStateCounts(perVariantStats) {
  const counts = { A: {}, B: {}, C: {} };
  for (const variant of ["A", "B", "C"]) {
    for (const state of Object.values(perVariantStats[variant].latestStateByEntity)) {
      counts[variant][state] = (counts[variant][state] || 0) + 1;
    }
  }
  return counts;
}

function groupObservationsByRound(observations) {
  const groups = [];
  for (const observation of observations) {
    const index = observation.sequence_no - 1;
    if (!groups[index]) {
      groups[index] = [];
    }
    groups[index].push(observation);
  }
  return groups.filter(Boolean);
}

function flushPacedOutputs(updatesRows, readsRows, eventsRows, consistencyRows) {
  writeCsv("updates.paced.csv", updatesRows);
  writeCsv("reads.paced.csv", readsRows);
  writeCsv("events_storage.paced.csv", eventsRows);
  writeCsv("consistency.paced.csv", consistencyRows);
}

function flushVariantBatchOutputs(config, updatesRows, readsRows, eventsRows, consistencyRows) {
  writeCsv(makeOutputName("updates.variant-batch", config), updatesRows);
  writeCsv(makeOutputName("reads.variant-batch", config), readsRows);
  writeCsv(makeOutputName("events_storage.variant-batch", config), eventsRows);
  writeCsv(makeOutputName("consistency.variant-batch", config), consistencyRows);
}

async function runVariantBatch(config, wallet, provider, contracts, entities, roundCount, observations) {
  const variant = config.targetVariant;
  if (!["A", "B", "C"].includes(variant)) {
    throw new Error("RUN_MODE=variant-batch requires TARGET_VARIANT=A, B, or C");
  }

  const contractMap = {
    A: contracts.variantA,
    B: contracts.variantB,
    C: contracts.variantC,
  };

  const contract = contractMap[variant];
  const updatesRows = [toCsvRow(buildUpdatesHeader())];
  const readsRows = [toCsvRow(buildReadsHeader())];
  const consistencyRows = [toCsvRow(buildConsistencyHeader())];
  const eventsRows = [toCsvRow(buildEventsStorageHeader())];
  const stats = {
    totalUpdates: 0,
    successfulUpdates: 0,
    failedUpdates: 0,
    lastObservedAt: "",
    lastBlockNumber: "",
    latestStateByEntity: {},
    totalGasUsed: 0,
    totalConfirmationLatencyMs: 0,
    totalReadLatencyMs: 0,
  };

  const roundGroups = groupObservationsByRound(observations);
  let nextNonce = await wallet.getTransactionCount("pending");
  const gasPrice = await wallet.getGasPrice();
  const chainId = await wallet.getChainId();

  for (const roundObservations of roundGroups) {
    const sequenceNo = roundObservations[0].sequence_no;
    console.log(`[live] Starting variant-batch round ${sequenceNo}/${roundCount} variant=${variant} entities=${roundObservations.length}`);

    const queue = [];
    for (const observation of roundObservations) {
      const scheduledMs = Date.now();
      const datmStartMs = Date.now();
      const datmEndMs = Date.now();
      const txRequest = await populateVariantTx(variant, contract, observation);

      queue.push({
        variant,
        contract,
        observation,
        scheduledMs,
        datmStartMs,
        datmEndMs,
        nonce: nextNonce,
        gasLimit: variantGasLimit(variant),
        gasPrice,
        chainId,
        txRequest,
      });
      nextNonce += 1;
      stats.totalUpdates += 1;
    }

    const submitted = await runPromisePool(queue, Math.min(queue.length, 10), async (item) => {
      const rawTx = await wallet.signTransaction(Object.assign({}, item.txRequest, {
        nonce: item.nonce,
        gasLimit: item.gasLimit,
        gasPrice: item.gasPrice,
        chainId: item.chainId,
      }));
      const submitStartMs = Date.now();
      const txHash = await provider.send("eth_sendRawTransaction", [rawTx]);
      const submitMs = Date.now();

      return Object.assign({}, item, {
        txHash,
        submitMs,
        submitAckLatencyMs: submitMs - submitStartMs,
      });
    });

    console.log(`[live] Submitted ${submitted.length} ${variant} transactions for round ${sequenceNo}`);

    const completed = await runPromisePool(submitted, Math.min(submitted.length, 6), async (item) => {
      const receipt = await provider.waitForTransaction(item.txHash);
      const receiptMs = Date.now();
      const readResult = await readTrustRecord(item.contract, item.observation);
      const timing = timingSnapshot(
        item.scheduledMs,
        item.datmStartMs,
        item.datmEndMs,
        item.submitMs,
        receiptMs,
        readResult.readStartMs,
        readResult.readEndMs
      );
      timing.mode = config.runMode;

      const result = {
        txHash: receipt.transactionHash,
        gasUsed: receipt.gasUsed.toString(),
        ats: asNumber(readResult.record.ats),
        trustState: trustStateLabel(readResult.record.trustState),
        calcTimestamp: new Date(asNumber(readResult.record.calcTimestamp) * 1000).toISOString(),
        latencyMs: timing.confirmationLatencyMs,
      };

      return { item, receipt, timing, result };
    });

    const blockCounts = {};
    for (const completion of completed) {
      const { item, receipt, timing, result } = completion;
      updatesRows.push(buildTxResultRow(config.runMode, variant, item.observation, timing, receipt, result));
      readsRows.push(buildReadRow(variant, item.observation, timing, result));
      consistencyRows.push(buildSingleVariantComparisonRow(variant, item.observation, result));

      stats.successfulUpdates += receipt.status === 1 ? 1 : 0;
      stats.failedUpdates += receipt.status === 1 ? 0 : 1;
      stats.lastObservedAt = timing.receiptAt;
      stats.lastBlockNumber = receipt.blockNumber;
      stats.latestStateByEntity[item.observation.entity_id] = result.trustState;
      stats.totalGasUsed += parseInt(result.gasUsed, 10);
      stats.totalConfirmationLatencyMs += timing.confirmationLatencyMs;
      stats.totalReadLatencyMs += timing.readLatencyMs;
      blockCounts[receipt.blockNumber] = (blockCounts[receipt.blockNumber] || 0) + 1;

      console.log(
        `[live] Variant-batch ${variant} seq=${item.observation.sequence_no} entity=${item.observation.entity_id} tx=${result.txHash} block=${receipt.blockNumber} gasUsed=${result.gasUsed} latencyMs=${result.latencyMs} ATS=${result.ats} trustState=${result.trustState}`
      );
    }

    const blockEntries = Object.entries(blockCounts).sort((a, b) => Number(a[0]) - Number(b[0]));
    const maxSameBlock = blockEntries.reduce((max, [, count]) => Math.max(max, count), 0);
    const blockSpread = blockEntries.length;
    eventsRows.push(
      toCsvRow([
        RUN_ID,
        variant,
        sequenceNo,
        stats.lastObservedAt,
        stats.lastBlockNumber,
        stats.totalUpdates,
        stats.successfulUpdates,
        stats.successfulUpdates,
        entities.length,
        stats.successfulUpdates,
        stats.successfulUpdates * 4,
        `variant-batch blocks=${blockSpread} max_same_block=${maxSameBlock} distribution=${blockEntries.map(([block, count]) => `${block}:${count}`).join("|")}`,
      ])
    );

    flushVariantBatchOutputs(config, updatesRows, readsRows, eventsRows, consistencyRows);

    if (sequenceNo < roundCount) {
      console.log(`[live] Waiting ${config.blockPeriodSec * 1000}ms before next variant-batch round`);
      await sleep(config.blockPeriodSec * 1000);
    }
  }

  const divisor = Math.max(1, stats.successfulUpdates);
  const stateCounts = {};
  for (const state of Object.values(stats.latestStateByEntity)) {
    stateCounts[state] = (stateCounts[state] || 0) + 1;
  }

  console.log(`[live] Variant-batch target variant: ${variant}`);
  console.log(`[live] Variant-batch entities loaded: ${entities.length}`);
  console.log(`[live] Variant-batch rounds executed: ${roundCount}`);
  console.log(`[live] Variant-batch logical observations: ${observations.length}`);
  console.log(
    `[live] Variant ${variant} summary: updates=${stats.totalUpdates} failed=${stats.failedUpdates} avgGasUsed=${Math.round(stats.totalGasUsed / divisor)} avgConfirmationLatencyMs=${Math.round(stats.totalConfirmationLatencyMs / divisor)} avgReadLatencyMs=${Math.round(stats.totalReadLatencyMs / divisor)} finalStates=${JSON.stringify(stateCounts)}`
  );
}

async function runPaced(config, contracts, entities, roundCount, observations) {
  const updatesRows = [toCsvRow(buildUpdatesHeader())];
  const readsRows = [toCsvRow(buildReadsHeader())];
  const eventsRows = [toCsvRow(buildEventsStorageHeader())];
  const consistencyRows = [toCsvRow(buildConsistencyHeader())];
  const perVariantStats = {
    A: { totalUpdates: 0, successfulUpdates: 0, failedUpdates: 0, lastObservedAt: "", lastBlockNumber: "", latestStateByEntity: {}, totalGasUsed: 0, totalConfirmationLatencyMs: 0, totalReadLatencyMs: 0 },
    B: { totalUpdates: 0, successfulUpdates: 0, failedUpdates: 0, lastObservedAt: "", lastBlockNumber: "", latestStateByEntity: {}, totalGasUsed: 0, totalConfirmationLatencyMs: 0, totalReadLatencyMs: 0 },
    C: { totalUpdates: 0, successfulUpdates: 0, failedUpdates: 0, lastObservedAt: "", lastBlockNumber: "", latestStateByEntity: {}, totalGasUsed: 0, totalConfirmationLatencyMs: 0, totalReadLatencyMs: 0 },
  };
  const roundGroups = groupObservationsByRound(observations);
  let mismatchCount = 0;

  for (const roundObservations of roundGroups) {
    const roundStartMs = Date.now();
    const sequenceNo = roundObservations[0].sequence_no;

    console.log(`[live] Starting paced round ${sequenceNo}/${roundCount} with ${roundObservations.length} entities`);

    for (const observation of roundObservations) {
      const resultsByVariant = {};

      for (const entry of [
        { key: "A", contract: contracts.variantA },
        { key: "B", contract: contracts.variantB },
        { key: "C", contract: contracts.variantC },
      ]) {
        perVariantStats[entry.key].totalUpdates += 1;
        const startedMs = Date.now();

        try {
          const execution = await executeVariantWithRetry(entry.key, entry.contract, observation, config);
          const { receipt, timing, result } = execution;

          updatesRows.push(buildTxResultRow(config.runMode, entry.key, observation, timing, receipt, result));
          readsRows.push(buildReadRow(entry.key, observation, timing, result));

          perVariantStats[entry.key].successfulUpdates += receipt.status === 1 ? 1 : 0;
          perVariantStats[entry.key].failedUpdates += receipt.status === 1 ? 0 : 1;
          perVariantStats[entry.key].lastObservedAt = timing.receiptAt;
          perVariantStats[entry.key].lastBlockNumber = receipt.blockNumber;
          perVariantStats[entry.key].latestStateByEntity[observation.entity_id] = result.trustState;
          perVariantStats[entry.key].totalGasUsed += parseInt(result.gasUsed, 10);
          perVariantStats[entry.key].totalConfirmationLatencyMs += timing.confirmationLatencyMs;
          perVariantStats[entry.key].totalReadLatencyMs += timing.readLatencyMs;
          resultsByVariant[entry.key] = result;

          console.log(
            `[live] Paced variant ${entry.key} seq=${observation.sequence_no} entity=${observation.entity_id} tx=${result.txHash} gasUsed=${result.gasUsed} latencyMs=${result.latencyMs} ATS=${result.ats} trustState=${result.trustState}`
          );
        } catch (error) {
          perVariantStats[entry.key].failedUpdates += 1;
          updatesRows.push(buildFailedUpdateRow(config.runMode, entry.key, observation, startedMs, error));
          readsRows.push(buildFailedReadRow(entry.key, observation, error));
          console.log(
            `[live] Failed variant ${entry.key} seq=${observation.sequence_no} entity=${observation.entity_id}: ${normalizeError(error).message}`
          );
        }

        flushPacedOutputs(updatesRows, readsRows, eventsRows, consistencyRows);
        await sleep(config.roundStaggerMs);
      }

      if (resultsByVariant.A && resultsByVariant.B && resultsByVariant.C) {
        const consistency = buildConsistencyRow(observation, resultsByVariant);
        consistencyRows.push(consistency.row);
        if (!consistency.consistentState) {
          mismatchCount += 1;
        }
        flushPacedOutputs(updatesRows, readsRows, eventsRows, consistencyRows);
      }
    }

    eventsRows.push(
      ...createEventsCheckpointRows(config.runMode, sequenceNo, entities.length, perVariantStats)
        .slice((sequenceNo - 1) * 3, sequenceNo * 3)
    );
    flushPacedOutputs(updatesRows, readsRows, eventsRows, consistencyRows);

    const elapsedMs = Date.now() - roundStartMs;
    const targetMs = config.blockPeriodSec * 1000;
    if (elapsedMs < targetMs) {
      const sleepMs = targetMs - elapsedMs;
      console.log(`[live] Waiting ${sleepMs}ms before next paced round`);
      await sleep(sleepMs);
    }
  }

  const stateCounts = finalTrustStateCounts(perVariantStats);

  console.log(`[live] Paced entities loaded: ${entities.length}`);
  console.log(`[live] Paced rounds executed: ${roundCount}`);
  console.log(`[live] Paced logical observations: ${observations.length}`);
  console.log(`[live] Paced consistency mismatches: ${mismatchCount}`);
  for (const variant of ["A", "B", "C"]) {
    const stats = perVariantStats[variant];
    const divisor = Math.max(1, stats.successfulUpdates);
    console.log(
      `[live] Variant ${variant} summary: updates=${stats.totalUpdates} failed=${stats.failedUpdates} avgGasUsed=${Math.round(stats.totalGasUsed / divisor)} avgConfirmationLatencyMs=${Math.round(stats.totalConfirmationLatencyMs / divisor)} avgReadLatencyMs=${Math.round(stats.totalReadLatencyMs / divisor)} finalStates=${JSON.stringify(stateCounts[variant])}`
    );
  }
}

async function runShort(config, wallet, provider, contracts, entities, roundCount, observations) {
  const updatesRows = [toCsvRow(buildUpdatesHeader())];
  const readsRows = [toCsvRow(buildReadsHeader())];
  const consistencyRows = [toCsvRow(buildConsistencyHeader())];
  const eventsRows = [toCsvRow(buildEventsStorageHeader())];
  const resultsByComparison = {};
  const perVariantStats = {
    A: { totalUpdates: 0, successfulUpdates: 0, failedUpdates: 0, lastObservedAt: "", lastBlockNumber: "", latestStateByEntity: {}, totalGasUsed: 0, totalConfirmationLatencyMs: 0, totalReadLatencyMs: 0 },
    B: { totalUpdates: 0, successfulUpdates: 0, failedUpdates: 0, lastObservedAt: "", lastBlockNumber: "", latestStateByEntity: {}, totalGasUsed: 0, totalConfirmationLatencyMs: 0, totalReadLatencyMs: 0 },
    C: { totalUpdates: 0, successfulUpdates: 0, failedUpdates: 0, lastObservedAt: "", lastBlockNumber: "", latestStateByEntity: {}, totalGasUsed: 0, totalConfirmationLatencyMs: 0, totalReadLatencyMs: 0 },
  };
  const queue = [];
  const variantEntries = [
    { key: "A", contract: contracts.variantA },
    { key: "B", contract: contracts.variantB },
    { key: "C", contract: contracts.variantC },
  ];

  let nextNonce = await wallet.getTransactionCount("pending");
  const gasPrice = await wallet.getGasPrice();
  const chainId = await wallet.getChainId();

  for (const observation of observations) {
    for (const entry of variantEntries) {
      const scheduledMs = Date.now();
      const datmStartMs = Date.now();
      const datmEndMs = Date.now();
      const txRequest = await populateVariantTx(entry.key, entry.contract, observation);
      queue.push({
        variant: entry.key,
        contract: entry.contract,
        observation,
        scheduledMs,
        datmStartMs,
        datmEndMs,
        nonce: nextNonce,
        gasLimit: variantGasLimit(entry.key),
        gasPrice,
        chainId,
        txRequest,
      });
      nextNonce += 1;
      perVariantStats[entry.key].totalUpdates += 1;
    }
  }

  const submitted = await runPromisePool(queue, 4, async (item, index) => {
    const rawTx = await wallet.signTransaction(Object.assign({}, item.txRequest, {
      nonce: item.nonce,
      gasLimit: item.gasLimit,
      gasPrice: item.gasPrice,
      chainId: item.chainId,
    }));
    const submitStartMs = Date.now();
    const txHash = await provider.send("eth_sendRawTransaction", [rawTx]);
    const submitMs = Date.now();

    if ((index + 1) === 1 || (index + 1) % 10 === 0) {
      console.log(`[live] Submitted ${index + 1}/${queue.length} transactions`);
    }

    return Object.assign({}, item, {
      txHash,
      submitMs,
      submitAckLatencyMs: submitMs - submitStartMs,
    });
  });

  const completed = await runPromisePool(submitted, 6, async (item, index) => {
    const receipt = await provider.waitForTransaction(item.txHash);
    const receiptMs = Date.now();
    const readResult = await readTrustRecord(item.contract, item.observation);
    const timing = timingSnapshot(
      item.scheduledMs,
      item.datmStartMs,
      item.datmEndMs,
      item.submitMs,
      receiptMs,
      readResult.readStartMs,
      readResult.readEndMs
    );
    timing.mode = config.runMode;

    const result = {
      txHash: receipt.transactionHash,
      gasUsed: receipt.gasUsed.toString(),
      ats: asNumber(readResult.record.ats),
      trustState: trustStateLabel(readResult.record.trustState),
      calcTimestamp: new Date(asNumber(readResult.record.calcTimestamp) * 1000).toISOString(),
      latencyMs: timing.confirmationLatencyMs,
    };

    if ((index + 1) === 1 || (index + 1) % 10 === 0) {
      console.log(`[live] Completed ${index + 1}/${submitted.length} receipts`);
    }

    return {
      item,
      receipt,
      timing,
      result,
    };
  });

  for (const completion of completed) {
    const { item, receipt, timing, result } = completion;

    updatesRows.push(buildTxResultRow(config.runMode, item.variant, item.observation, timing, receipt, result));
    readsRows.push(buildReadRow(item.variant, item.observation, timing, result));

    perVariantStats[item.variant].successfulUpdates += receipt.status === 1 ? 1 : 0;
    perVariantStats[item.variant].failedUpdates += receipt.status === 1 ? 0 : 1;
    perVariantStats[item.variant].lastObservedAt = timing.receiptAt;
    perVariantStats[item.variant].lastBlockNumber = receipt.blockNumber;
    perVariantStats[item.variant].latestStateByEntity[item.observation.entity_id] = result.trustState;
    perVariantStats[item.variant].totalGasUsed += parseInt(result.gasUsed, 10);
    perVariantStats[item.variant].totalConfirmationLatencyMs += timing.confirmationLatencyMs;
    perVariantStats[item.variant].totalReadLatencyMs += timing.readLatencyMs;

    const comparisonId = `${item.observation.entity_id}-${item.observation.sequence_no}`;
    resultsByComparison[comparisonId] = resultsByComparison[comparisonId] || {
      observation: item.observation,
      variants: {},
    };
    resultsByComparison[comparisonId].variants[item.variant] = result;

    console.log(
      `[live] Variant ${item.variant} seq=${item.observation.sequence_no} entity=${item.observation.entity_id} tx=${result.txHash} gasUsed=${result.gasUsed} latencyMs=${result.latencyMs} ATS=${result.ats} trustState=${result.trustState}`
    );
  }

  let mismatchCount = 0;
  for (const comparison of Object.values(resultsByComparison)) {
    const consistency = buildConsistencyRow(comparison.observation, comparison.variants);
    consistencyRows.push(consistency.row);
    if (!consistency.consistentState) {
      mismatchCount += 1;
    }
  }

  eventsRows.push(...createEventsCheckpointRows(config.runMode, roundCount, entities.length, perVariantStats));

  writeCsv("updates.short.csv", updatesRows);
  writeCsv("reads.short.csv", readsRows);
  writeCsv("events_storage.short.csv", eventsRows);
  writeCsv("consistency.short.csv", consistencyRows);

  console.log(`[live] Short-run entities loaded: ${entities.length}`);
  console.log(`[live] Short-run rounds executed: ${roundCount}`);
  console.log(`[live] Short-run logical observations: ${observations.length}`);
  console.log(`[live] Short-run blockchain updates: ${queue.length}`);
  console.log(`[live] Short-run consistency mismatches: ${mismatchCount}`);
  for (const variant of ["A", "B", "C"]) {
    const stats = perVariantStats[variant];
    const divisor = Math.max(1, stats.successfulUpdates);
    console.log(
      `[live] Variant ${variant} summary: updates=${stats.totalUpdates} failed=${stats.failedUpdates} avgGasUsed=${Math.round(stats.totalGasUsed / divisor)} avgConfirmationLatencyMs=${Math.round(stats.totalConfirmationLatencyMs / divisor)} avgReadLatencyMs=${Math.round(stats.totalReadLatencyMs / divisor)}`
    );
  }
}

async function main() {
  const config = getRunConfig();
  if (!["preflight", "short", "paced", "variant-batch"].includes(config.runMode)) {
    throw new Error(`Unsupported RUN_MODE: ${config.runMode}. Supported values are preflight, short, paced, and variant-batch.`);
  }

  const provider = createProvider();
  const wallet = createWallet(provider);
  const addresses = getContractAddresses();
  const contracts = loadContracts(wallet, addresses);
  const network = await provider.getNetwork();
  const senderAddress = await wallet.getAddress();

  ensureOutputDir();

  console.log(`[live] Connected chainId=${network.chainId}`);
  console.log(`[live] Sender address: ${senderAddress}`);
  console.log(`[live] RUN_MODE=${config.runMode}`);
  if (config.runMode === "preflight") {
    const { entities, observation } = buildPreflightObservations(config.updateIntervalSec);
    await runPreflight(config, contracts, entities, observation);
    return;
  }

  const { entities, roundCount, observations } = buildRunObservations(
    config.durationSec,
    config.updateIntervalSec,
    config.entityLimit,
    config.roundLimit
  );
  if (config.runMode === "paced") {
    await runPaced(config, contracts, entities, roundCount, observations);
    return;
  }
  if (config.runMode === "variant-batch") {
    await runVariantBatch(config, wallet, provider, contracts, entities, roundCount, observations);
    return;
  }
  await runShort(config, wallet, provider, contracts, entities, roundCount, observations);
}

main().catch((error) => {
  console.error(`[live] Aborted: ${error.message}`);
  process.exit(1);
});
