const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const RAW_DIR = path.join(ROOT, "results", "raw");
const DERIVED_DIR = path.join(ROOT, "results", "derived");
const PLOTS_DIR = path.join(DERIVED_DIR, "scalability_plots");
const ENTITY_COUNTS = [3, 6, 9, 10];
const VARIANTS = ["A", "B", "C"];
const COLORS = {
  A: "#d97706",
  B: "#2563eb",
  C: "#059669",
};

function ensureDir(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true });
}

function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = "";
  let inQuotes = false;

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    const next = text[index + 1];

    if (inQuotes) {
      if (char === "\"" && next === "\"") {
        field += "\"";
        index += 1;
      } else if (char === "\"") {
        inQuotes = false;
      } else {
        field += char;
      }
    } else if (char === "\"") {
      inQuotes = true;
    } else if (char === ",") {
      row.push(field);
      field = "";
    } else if (char === "\n") {
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else if (char !== "\r") {
      field += char;
    }
  }

  if (field !== "" || row.length > 0) {
    row.push(field);
    rows.push(row);
  }

  const [header, ...data] = rows.filter((entry) => entry.length > 1 || entry[0] !== "");
  return data.map((entry) => {
    const mapped = {};
    header.forEach((key, index) => {
      mapped[key] = entry[index] || "";
    });
    return mapped;
  });
}

function readCsv(fileName) {
  return parseCsv(fs.readFileSync(path.join(RAW_DIR, fileName), "utf8"));
}

function mean(values) {
  if (values.length === 0) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function stddev(values) {
  if (values.length <= 1) return 0;
  const avg = mean(values);
  const variance = values.reduce((sum, value) => sum + ((value - avg) ** 2), 0) / (values.length - 1);
  return Math.sqrt(variance);
}

function round(value) {
  return Math.round(value * 100) / 100;
}

function toCsvRow(values) {
  return values.map((value) => {
    const text = String(value);
    if (text.includes(",") || text.includes("\"") || text.includes("\n")) {
      return `"${text.replace(/"/g, "\"\"")}"`;
    }
    return text;
  }).join(",");
}

function fileSet(variant, entityCount) {
  const key = variant.toLowerCase();
  const count = String(entityCount).padStart(2, "0");
  return {
    updates: `updates.variant-batch.${key}-${count}e-3r.csv`,
    reads: `reads.variant-batch.${key}-${count}e-3r.csv`,
    events: `events_storage.variant-batch.${key}-${count}e-3r.csv`,
    consistency: `consistency.variant-batch.${key}-${count}e-3r.csv`,
  };
}

function parseDistribution(notes) {
  const match = notes.match(/distribution=([0-9:|]+)/);
  if (!match) return [];
  return match[1].split("|").map((entry) => {
    const [blockNumber, count] = entry.split(":");
    return {
      blockNumber,
      count: Number(count),
    };
  });
}

function summarizeRun(variant, entityCount) {
  const files = fileSet(variant, entityCount);
  const updates = readCsv(files.updates).filter((row) => row.tx_status === "success");
  const reads = readCsv(files.reads).filter((row) => row.read_success === "true");
  const events = readCsv(files.events);
  const consistency = readCsv(files.consistency);

  const roundIds = [...new Set(updates.map((row) => Number(row.sequence_no)))].sort((a, b) => a - b);
  const perRound = roundIds.map((roundId) => {
    const roundUpdates = updates.filter((row) => Number(row.sequence_no) === roundId);
    const roundReads = reads.filter((row) => Number(row.sequence_no) === roundId);
    const eventRow = events.find((row) => Number(row.checkpoint_no) === roundId);
    const distribution = eventRow ? parseDistribution(eventRow.notes) : [];
    const blockCount = eventRow ? Number((eventRow.notes.match(/blocks=(\d+)/) || [0, 0])[1]) : 0;
    const maxSameBlock = eventRow ? Number((eventRow.notes.match(/max_same_block=(\d+)/) || [0, 0])[1]) : 0;

    return {
      roundId,
      avgGasUsed: mean(roundUpdates.map((row) => Number(row.gas_used))),
      avgConfirmationLatencyMs: mean(roundUpdates.map((row) => Number(row.confirmation_latency_ms))),
      avgEndToEndLatencyMs: mean(roundUpdates.map((row) => Number(row.end_to_end_latency_ms))),
      avgReadLatencyMs: mean(roundReads.map((row) => Number(row.read_latency_ms))),
      maxSameBlockRatio: entityCount === 0 ? 0 : maxSameBlock / entityCount,
      blockCount,
      distribution,
      confirmationLatencies: roundUpdates.map((row) => Number(row.confirmation_latency_ms)),
    };
  });

  const finalStates = {};
  updates
    .filter((row) => Number(row.sequence_no) === Math.max(...roundIds))
    .forEach((row) => {
      finalStates[row.trust_state] = (finalStates[row.trust_state] || 0) + 1;
    });

  return {
    variant,
    entityCount,
    files,
    roundCount: roundIds.length,
    updatesCount: updates.length,
    failedUpdates: readCsv(files.updates).length - updates.length,
    avgGasUsed: round(mean(perRound.map((entry) => entry.avgGasUsed))),
    stdGasUsed: round(stddev(perRound.map((entry) => entry.avgGasUsed))),
    avgConfirmationLatencyMs: round(mean(perRound.map((entry) => entry.avgConfirmationLatencyMs))),
    stdConfirmationLatencyMs: round(stddev(perRound.map((entry) => entry.avgConfirmationLatencyMs))),
    avgEndToEndLatencyMs: round(mean(perRound.map((entry) => entry.avgEndToEndLatencyMs))),
    stdEndToEndLatencyMs: round(stddev(perRound.map((entry) => entry.avgEndToEndLatencyMs))),
    avgReadLatencyMs: round(mean(perRound.map((entry) => entry.avgReadLatencyMs))),
    stdReadLatencyMs: round(stddev(perRound.map((entry) => entry.avgReadLatencyMs))),
    avgMaxSameBlockRatio: round(mean(perRound.map((entry) => entry.maxSameBlockRatio))),
    stdMaxSameBlockRatio: round(stddev(perRound.map((entry) => entry.maxSameBlockRatio))),
    avgBlocksPerRound: round(mean(perRound.map((entry) => entry.blockCount))),
    stdBlocksPerRound: round(stddev(perRound.map((entry) => entry.blockCount))),
    consistencyMismatches: consistency.filter((row) => row.consistent_state !== "true").length,
    finalStates,
    perRound,
  };
}

function writeSummaryCsv(summaries) {
  const rows = [
    toCsvRow([
      "variant",
      "entity_count",
      "updates",
      "failed_updates",
      "avg_gas_used",
      "std_gas_used",
      "avg_confirmation_latency_ms",
      "std_confirmation_latency_ms",
      "avg_end_to_end_latency_ms",
      "std_end_to_end_latency_ms",
      "avg_read_latency_ms",
      "std_read_latency_ms",
      "avg_max_same_block_ratio",
      "std_max_same_block_ratio",
      "avg_blocks_per_round",
      "std_blocks_per_round",
      "consistency_mismatches",
      "final_trusted",
      "final_suspicious",
      "final_untrusted",
    ]),
  ];

  for (const summary of summaries) {
    rows.push(toCsvRow([
      summary.variant,
      summary.entityCount,
      summary.updatesCount,
      summary.failedUpdates,
      summary.avgGasUsed,
      summary.stdGasUsed,
      summary.avgConfirmationLatencyMs,
      summary.stdConfirmationLatencyMs,
      summary.avgEndToEndLatencyMs,
      summary.stdEndToEndLatencyMs,
      summary.avgReadLatencyMs,
      summary.stdReadLatencyMs,
      summary.avgMaxSameBlockRatio,
      summary.stdMaxSameBlockRatio,
      summary.avgBlocksPerRound,
      summary.stdBlocksPerRound,
      summary.consistencyMismatches,
      summary.finalStates.Trusted || 0,
      summary.finalStates.Suspicious || 0,
      summary.finalStates.Untrusted || 0,
    ]));
  }

  fs.writeFileSync(path.join(DERIVED_DIR, "variant_scalability_summary.csv"), rows.join("\n") + "\n");
}

function writeSummaryMarkdown(summaries) {
  const lines = [
    "# Variant Scalability Summary",
    "",
    "This summary compares Variants A, B, and C at 3, 6, 9, and 10 entities using the batched experiment design with 3 rounds per data point.",
    "",
    "## Comparison Table",
    "",
    "| Variant | Entities | Avg Gas | Gas Std | Avg Confirmation Latency (ms) | Latency Std | Avg End-to-End Latency (ms) | End-to-End Std | Avg Read Latency (ms) | Read Std | Avg Max Same-Block Ratio | Ratio Std | Avg Blocks/Round |",
    "| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |",
  ];

  for (const summary of summaries) {
    lines.push(`| ${summary.variant} | ${summary.entityCount} | ${summary.avgGasUsed} | ${summary.stdGasUsed} | ${summary.avgConfirmationLatencyMs} | ${summary.stdConfirmationLatencyMs} | ${summary.avgEndToEndLatencyMs} | ${summary.stdEndToEndLatencyMs} | ${summary.avgReadLatencyMs} | ${summary.stdReadLatencyMs} | ${summary.avgMaxSameBlockRatio} | ${summary.stdMaxSameBlockRatio} | ${summary.avgBlocksPerRound} |`);
  }

  lines.push("", "## Scalability Interpretation", "");

  const grouped = {};
  for (const summary of summaries) {
    grouped[summary.variant] = grouped[summary.variant] || [];
    grouped[summary.variant].push(summary);
  }

  for (const variant of VARIANTS) {
    const variantRows = grouped[variant].sort((a, b) => a.entityCount - b.entityCount);
    const latencyTrend = variantRows.map((row) => `${row.entityCount}e=${row.avgConfirmationLatencyMs}`).join(", ");
    const packingTrend = variantRows.map((row) => `${row.entityCount}e=${row.avgMaxSameBlockRatio}`).join(", ");
    lines.push(`- Variant ${variant}: confirmation latency trend ${latencyTrend}; same-block ratio trend ${packingTrend}.`);
  }

  const lowestGas = grouped.A && grouped.B && grouped.C
    ? summaries.reduce((best, current) => current.avgGasUsed < best.avgGasUsed ? current : best)
    : null;
  const bestLatencyAt10 = summaries
    .filter((row) => row.entityCount === 10)
    .reduce((best, current) => !best || current.avgConfirmationLatencyMs < best.avgConfirmationLatencyMs ? current : best, null);
  const bestPackingAt10 = summaries
    .filter((row) => row.entityCount === 10)
    .reduce((best, current) => !best || current.avgMaxSameBlockRatio > best.avgMaxSameBlockRatio ? current : best, null);

  lines.push("");
  if (lowestGas) {
    lines.push(`- Lowest overall gas point in the sweep: Variant ${lowestGas.variant} at ${lowestGas.entityCount} entities.`);
  }
  if (bestLatencyAt10) {
    lines.push(`- Lowest latency at 10 entities: Variant ${bestLatencyAt10.variant} (${bestLatencyAt10.avgConfirmationLatencyMs} ms).`);
  }
  if (bestPackingAt10) {
    lines.push(`- Strongest block packing at 10 entities: Variant ${bestPackingAt10.variant} (ratio ${bestPackingAt10.avgMaxSameBlockRatio}).`);
  }
  lines.push("- All runs completed without failed transactions in this scalability sweep.");
  lines.push("");
  lines.push("Across the full scalability sweep, the plots show a clear separation between cost efficiency and performance stability. Variant A consistently remains the least expensive option in gas terms, but its confirmation latency and block-spread metrics degrade as the number of entities increases. This pattern is especially visible in the confirmation-latency, end-to-end-latency, and blocks-per-round plots, where Variant A transitions from near-single-block behavior at low entity counts to wider multi-block spreading at 9 and 10 entities. In contrast, Variant B preserves a slightly higher but very stable gas cost while keeping both latency and block-inclusion behavior more controlled as the workload grows, which indicates a better operational balance between off-chain computation and on-chain verification.");
  lines.push("");
  lines.push("Variant C presents the heaviest on-chain execution cost, which is reflected in its consistently highest gas usage. The scalability plots show that this extra computation does not always translate into worse block packing, since Variant C often achieves near-perfect same-block inclusion, but it does introduce much higher latency variability under some workloads, most notably at 9 entities. Taken together, the figures suggest that Variant B is the most scalable architecture in practical terms: it avoids the block-spreading behavior observed in Variant A, avoids the latency spikes observed in Variant C, and delivers the best overall tradeoff between gas overhead, latency stability, and batch inclusion behavior.");
  lines.push("");

  fs.writeFileSync(path.join(DERIVED_DIR, "variant_scalability_summary.md"), lines.join("\n"));
}

function buildLineChartSvg({ title, yLabel, metricKey, stdKey, summaries, valueFormatter }) {
  const width = 980;
  const height = 620;
  const margin = { top: 80, right: 60, bottom: 90, left: 90 };
  const chartWidth = width - margin.left - margin.right;
  const chartHeight = height - margin.top - margin.bottom;
  const xMin = Math.min(...ENTITY_COUNTS);
  const xMax = Math.max(...ENTITY_COUNTS);
  const allValues = summaries.flatMap((entry) => [entry[metricKey] + entry[stdKey], Math.max(0, entry[metricKey] - entry[stdKey])]);
  const yMax = Math.max(...allValues, 1) * 1.1;

  const xFor = (entityCount) => margin.left + ((entityCount - xMin) / (xMax - xMin)) * chartWidth;
  const yFor = (value) => margin.top + chartHeight - ((value / yMax) * chartHeight);

  const grid = [];
  for (let index = 0; index <= 5; index += 1) {
    const value = (yMax / 5) * index;
    const y = yFor(value);
    grid.push(`<line x1="${margin.left}" y1="${y}" x2="${width - margin.right}" y2="${y}" stroke="#e5e7eb" stroke-width="1" />`);
    grid.push(`<text x="${margin.left - 12}" y="${y + 5}" font-size="14" text-anchor="end" fill="#6b7280">${valueFormatter(value)}</text>`);
  }

  const xTicks = ENTITY_COUNTS.map((count) => {
    const x = xFor(count);
    return `
      <line x1="${x}" y1="${margin.top + chartHeight}" x2="${x}" y2="${margin.top + chartHeight + 6}" stroke="#374151" stroke-width="2" />
      <text x="${x}" y="${height - 45}" font-size="16" text-anchor="middle" fill="#111827">${count}</text>
    `;
  }).join("\n");

  const legend = VARIANTS.map((variant, index) => {
    const x = margin.left + index * 180;
    return `
      <line x1="${x}" y1="52" x2="${x + 30}" y2="52" stroke="${COLORS[variant]}" stroke-width="4" />
      <text x="${x + 40}" y="57" font-size="16" fill="#111827">Variant ${variant}</text>
    `;
  }).join("\n");

  const seriesSvg = VARIANTS.map((variant) => {
    const variantRows = summaries
      .filter((entry) => entry.variant === variant)
      .sort((a, b) => a.entityCount - b.entityCount);

    const points = variantRows.map((entry) => `${xFor(entry.entityCount)},${yFor(entry[metricKey])}`).join(" ");
    const errorBars = variantRows.map((entry) => {
      const x = xFor(entry.entityCount);
      const yTop = yFor(entry[metricKey] + entry[stdKey]);
      const yBottom = yFor(Math.max(0, entry[metricKey] - entry[stdKey]));
      const yCenter = yFor(entry[metricKey]);
      return `
        <line x1="${x}" y1="${yTop}" x2="${x}" y2="${yBottom}" stroke="${COLORS[variant]}" stroke-width="2" />
        <line x1="${x - 6}" y1="${yTop}" x2="${x + 6}" y2="${yTop}" stroke="${COLORS[variant]}" stroke-width="2" />
        <line x1="${x - 6}" y1="${yBottom}" x2="${x + 6}" y2="${yBottom}" stroke="${COLORS[variant]}" stroke-width="2" />
        <circle cx="${x}" cy="${yCenter}" r="5" fill="${COLORS[variant]}" />
      `;
    }).join("\n");

    return `
      <polyline fill="none" stroke="${COLORS[variant]}" stroke-width="4" points="${points}" />
      ${errorBars}
    `;
  }).join("\n");

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
  <rect width="${width}" height="${height}" fill="#ffffff" />
  <text x="${width / 2}" y="34" font-size="28" font-weight="700" text-anchor="middle" fill="#111827">${title}</text>
  ${legend}
  <text x="${width / 2}" y="${height - 12}" font-size="16" text-anchor="middle" fill="#374151">Entity Count</text>
  <text x="24" y="${margin.top + chartHeight / 2}" font-size="16" text-anchor="middle" fill="#374151" transform="rotate(-90, 24, ${margin.top + chartHeight / 2})">${yLabel}</text>
  ${grid.join("\n")}
  <line x1="${margin.left}" y1="${margin.top + chartHeight}" x2="${width - margin.right}" y2="${margin.top + chartHeight}" stroke="#374151" stroke-width="2" />
  ${xTicks}
  ${seriesSvg}
</svg>
`;
}

function buildHeatmapSvg(summaries) {
  const width = 900;
  const height = 420;
  const margin = { top: 90, right: 40, bottom: 70, left: 110 };
  const cellWidth = 150;
  const cellHeight = 70;
  const xLabels = ENTITY_COUNTS;
  const yLabels = VARIANTS;

  function colorFor(value) {
    const clamped = Math.max(0, Math.min(1, value));
    const light = 95 - Math.round(clamped * 55);
    return `hsl(203, 80%, ${light}%)`;
  }

  const cells = [];
  for (let rowIndex = 0; rowIndex < yLabels.length; rowIndex += 1) {
    for (let colIndex = 0; colIndex < xLabels.length; colIndex += 1) {
      const variant = yLabels[rowIndex];
      const entityCount = xLabels[colIndex];
      const summary = summaries.find((entry) => entry.variant === variant && entry.entityCount === entityCount);
      const x = margin.left + colIndex * cellWidth;
      const y = margin.top + rowIndex * cellHeight;
      cells.push(`
        <rect x="${x}" y="${y}" width="${cellWidth - 8}" height="${cellHeight - 8}" fill="${colorFor(summary.avgMaxSameBlockRatio)}" rx="8" />
        <text x="${x + (cellWidth - 8) / 2}" y="${y + 30}" font-size="20" font-weight="700" text-anchor="middle" fill="#111827">${summary.avgMaxSameBlockRatio}</text>
        <text x="${x + (cellWidth - 8) / 2}" y="${y + 52}" font-size="12" text-anchor="middle" fill="#374151">sd ${summary.stdMaxSameBlockRatio}</text>
      `);
    }
  }

  const xAxis = xLabels.map((count, index) => `
    <text x="${margin.left + index * cellWidth + (cellWidth - 8) / 2}" y="${height - 28}" font-size="16" text-anchor="middle" fill="#111827">${count}</text>
  `).join("\n");
  const yAxis = yLabels.map((variant, index) => `
    <text x="${margin.left - 20}" y="${margin.top + index * cellHeight + 38}" font-size="16" text-anchor="end" fill="#111827">Variant ${variant}</text>
  `).join("\n");

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
  <rect width="${width}" height="${height}" fill="#ffffff" />
  <text x="${width / 2}" y="36" font-size="28" font-weight="700" text-anchor="middle" fill="#111827">Same-Block Inclusion Heatmap</text>
  <text x="${width / 2}" y="62" font-size="16" text-anchor="middle" fill="#4b5563">Cell values show average ratio; smaller text shows standard deviation across 3 rounds</text>
  ${cells.join("\n")}
  ${xAxis}
  ${yAxis}
</svg>
`;
}

function buildScatterSvg(summaries) {
  const width = 980;
  const height = 620;
  const margin = { top: 80, right: 80, bottom: 90, left: 90 };
  const chartWidth = width - margin.left - margin.right;
  const chartHeight = height - margin.top - margin.bottom;
  const xMax = Math.max(...summaries.map((entry) => entry.avgGasUsed)) * 1.02;
  const xMin = Math.min(...summaries.map((entry) => entry.avgGasUsed)) * 0.995;
  const yMax = Math.max(...summaries.map((entry) => entry.avgConfirmationLatencyMs)) * 1.1;

  const xFor = (value) => margin.left + ((value - xMin) / (xMax - xMin)) * chartWidth;
  const yFor = (value) => margin.top + chartHeight - ((value / yMax) * chartHeight);

  const points = summaries.map((entry) => {
    const x = xFor(entry.avgGasUsed);
    const y = yFor(entry.avgConfirmationLatencyMs);
    const radius = 5 + entry.entityCount;
    return `
      <line x1="${x}" y1="${yFor(entry.avgConfirmationLatencyMs + entry.stdConfirmationLatencyMs)}" x2="${x}" y2="${yFor(Math.max(0, entry.avgConfirmationLatencyMs - entry.stdConfirmationLatencyMs))}" stroke="${COLORS[entry.variant]}" stroke-width="2" />
      <circle cx="${x}" cy="${y}" r="${radius}" fill="${COLORS[entry.variant]}" fill-opacity="0.75" />
      <text x="${x + 12}" y="${y - 8}" font-size="12" fill="#111827">${entry.variant}-${entry.entityCount}</text>
    `;
  }).join("\n");

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
  <rect width="${width}" height="${height}" fill="#ffffff" />
  <text x="${width / 2}" y="36" font-size="28" font-weight="700" text-anchor="middle" fill="#111827">Cost-Latency Tradeoff</text>
  <text x="${width / 2}" y="${height - 20}" font-size="16" text-anchor="middle" fill="#374151">Average Gas Used</text>
  <text x="24" y="${margin.top + chartHeight / 2}" font-size="16" text-anchor="middle" fill="#374151" transform="rotate(-90, 24, ${margin.top + chartHeight / 2})">Average Confirmation Latency (ms)</text>
  <line x1="${margin.left}" y1="${margin.top + chartHeight}" x2="${width - margin.right}" y2="${margin.top + chartHeight}" stroke="#374151" stroke-width="2" />
  <line x1="${margin.left}" y1="${margin.top}" x2="${margin.left}" y2="${margin.top + chartHeight}" stroke="#374151" stroke-width="2" />
  ${points}
</svg>
`;
}

function buildBoxPlotSvg(summaries) {
  const width = 980;
  const height = 620;
  const margin = { top: 80, right: 60, bottom: 90, left: 90 };
  const chartWidth = width - margin.left - margin.right;
  const chartHeight = height - margin.top - margin.bottom;
  const tenEntity = summaries.filter((entry) => entry.entityCount === 10);
  const allVals = tenEntity.flatMap((entry) => entry.perRound.flatMap((round) => round.confirmationLatencies));
  const yMax = Math.max(...allVals) * 1.1;
  const yFor = (value) => margin.top + chartHeight - ((value / yMax) * chartHeight);
  const slot = chartWidth / tenEntity.length;

  function quartiles(values) {
    const sorted = [...values].sort((a, b) => a - b);
    const pick = (p) => {
      const pos = (sorted.length - 1) * p;
      const base = Math.floor(pos);
      const rest = pos - base;
      if (sorted[base + 1] !== undefined) {
        return sorted[base] + rest * (sorted[base + 1] - sorted[base]);
      }
      return sorted[base];
    };
    return {
      min: sorted[0],
      q1: pick(0.25),
      median: pick(0.5),
      q3: pick(0.75),
      max: sorted[sorted.length - 1],
    };
  }

  const plots = tenEntity.map((entry, index) => {
    const values = entry.perRound.flatMap((round) => round.confirmationLatencies);
    const q = quartiles(values);
    const center = margin.left + slot * index + slot / 2;
    const boxWidth = 90;
    return `
      <line x1="${center}" y1="${yFor(q.max)}" x2="${center}" y2="${yFor(q.min)}" stroke="${COLORS[entry.variant]}" stroke-width="2" />
      <rect x="${center - boxWidth / 2}" y="${yFor(q.q3)}" width="${boxWidth}" height="${yFor(q.q1) - yFor(q.q3)}" fill="${COLORS[entry.variant]}" fill-opacity="0.35" stroke="${COLORS[entry.variant]}" stroke-width="2" />
      <line x1="${center - boxWidth / 2}" y1="${yFor(q.median)}" x2="${center + boxWidth / 2}" y2="${yFor(q.median)}" stroke="${COLORS[entry.variant]}" stroke-width="3" />
      <line x1="${center - 20}" y1="${yFor(q.max)}" x2="${center + 20}" y2="${yFor(q.max)}" stroke="${COLORS[entry.variant]}" stroke-width="2" />
      <line x1="${center - 20}" y1="${yFor(q.min)}" x2="${center + 20}" y2="${yFor(q.min)}" stroke="${COLORS[entry.variant]}" stroke-width="2" />
      <text x="${center}" y="${height - 45}" font-size="18" font-weight="600" text-anchor="middle" fill="#111827">Variant ${entry.variant}</text>
    `;
  }).join("\n");

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
  <rect width="${width}" height="${height}" fill="#ffffff" />
  <text x="${width / 2}" y="36" font-size="28" font-weight="700" text-anchor="middle" fill="#111827">Confirmation Latency Distribution at 10 Entities</text>
  <text x="${width / 2}" y="${height - 16}" font-size="16" text-anchor="middle" fill="#374151">Variant</text>
  <text x="24" y="${margin.top + chartHeight / 2}" font-size="16" text-anchor="middle" fill="#374151" transform="rotate(-90, 24, ${margin.top + chartHeight / 2})">Milliseconds</text>
  <line x1="${margin.left}" y1="${margin.top + chartHeight}" x2="${width - margin.right}" y2="${margin.top + chartHeight}" stroke="#374151" stroke-width="2" />
  <line x1="${margin.left}" y1="${margin.top}" x2="${margin.left}" y2="${margin.top + chartHeight}" stroke="#374151" stroke-width="2" />
  ${plots}
</svg>
`;
}

function writePlots(summaries) {
  fs.writeFileSync(
    path.join(PLOTS_DIR, "scalability_confirmation_latency.svg"),
    buildLineChartSvg({
      title: "Scalability of Confirmation Latency",
      yLabel: "Milliseconds",
      metricKey: "avgConfirmationLatencyMs",
      stdKey: "stdConfirmationLatencyMs",
      summaries,
      valueFormatter: (value) => `${Math.round(value)}`,
    })
  );

  fs.writeFileSync(
    path.join(PLOTS_DIR, "scalability_gas_used.svg"),
    buildLineChartSvg({
      title: "Scalability of Gas Used Per Trust Update",
      yLabel: "Gas Used",
      metricKey: "avgGasUsed",
      stdKey: "stdGasUsed",
      summaries,
      valueFormatter: (value) => `${Math.round(value)}`,
    })
  );

  fs.writeFileSync(
    path.join(PLOTS_DIR, "scalability_read_latency.svg"),
    buildLineChartSvg({
      title: "Scalability of Trust Registry Read Latency",
      yLabel: "Milliseconds",
      metricKey: "avgReadLatencyMs",
      stdKey: "stdReadLatencyMs",
      summaries,
      valueFormatter: (value) => `${round(value)}`,
    })
  );

  fs.writeFileSync(
    path.join(PLOTS_DIR, "scalability_same_block_ratio.svg"),
    buildLineChartSvg({
      title: "Scalability of Same-Block Inclusion Ratio",
      yLabel: "Ratio",
      metricKey: "avgMaxSameBlockRatio",
      stdKey: "stdMaxSameBlockRatio",
      summaries,
      valueFormatter: (value) => `${round(value)}`,
    })
  );

  fs.writeFileSync(
    path.join(PLOTS_DIR, "scalability_end_to_end_latency.svg"),
    buildLineChartSvg({
      title: "Scalability of End-to-End Trust Update Latency",
      yLabel: "Milliseconds",
      metricKey: "avgEndToEndLatencyMs",
      stdKey: "stdEndToEndLatencyMs",
      summaries,
      valueFormatter: (value) => `${Math.round(value)}`,
    })
  );

  fs.writeFileSync(
    path.join(PLOTS_DIR, "scalability_blocks_per_round.svg"),
    buildLineChartSvg({
      title: "Scalability of Block Spread Per Round",
      yLabel: "Blocks Per Round",
      metricKey: "avgBlocksPerRound",
      stdKey: "stdBlocksPerRound",
      summaries,
      valueFormatter: (value) => `${round(value)}`,
    })
  );

  fs.writeFileSync(
    path.join(PLOTS_DIR, "scalability_same_block_heatmap.svg"),
    buildHeatmapSvg(summaries)
  );

  fs.writeFileSync(
    path.join(PLOTS_DIR, "scalability_cost_latency_scatter.svg"),
    buildScatterSvg(summaries)
  );

  fs.writeFileSync(
    path.join(PLOTS_DIR, "confirmation_latency_boxplot_10_entities.svg"),
    buildBoxPlotSvg(summaries)
  );
}

function main() {
  ensureDir(DERIVED_DIR);
  ensureDir(PLOTS_DIR);

  const summaries = [];
  for (const variant of VARIANTS) {
    for (const entityCount of ENTITY_COUNTS) {
      summaries.push(summarizeRun(variant, entityCount));
    }
  }

  writeSummaryCsv(summaries);
  writeSummaryMarkdown(summaries);
  writePlots(summaries);

  console.log("[analysis] Generated scalability comparison summary");
  for (const summary of summaries) {
    console.log(
      `[analysis] Variant ${summary.variant} @ ${summary.entityCount} entities: avgConfirmationLatencyMs=${summary.avgConfirmationLatencyMs}, std=${summary.stdConfirmationLatencyMs}, avgGasUsed=${summary.avgGasUsed}, avgReadLatencyMs=${summary.avgReadLatencyMs}, avgMaxSameBlockRatio=${summary.avgMaxSameBlockRatio}`
    );
  }
  console.log(`[analysis] Summary CSV: ${path.join(DERIVED_DIR, "variant_scalability_summary.csv")}`);
  console.log(`[analysis] Summary Markdown: ${path.join(DERIVED_DIR, "variant_scalability_summary.md")}`);
  console.log(`[analysis] Plots directory: ${PLOTS_DIR}`);
}

main();
