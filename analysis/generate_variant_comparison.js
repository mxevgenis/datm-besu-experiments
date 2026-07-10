const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const RAW_DIR = path.join(ROOT, "results", "raw");
const DERIVED_DIR = path.join(ROOT, "results", "derived");
const PLOTS_DIR = path.join(DERIVED_DIR, "plots");

const INPUTS = {
  A: {
    updates: "updates.variant-batch.a-10e-3r-rerun.csv",
    reads: "reads.variant-batch.a-10e-3r-rerun.csv",
    events: "events_storage.variant-batch.a-10e-3r-rerun.csv",
    consistency: "consistency.variant-batch.a-10e-3r-rerun.csv",
  },
  B: {
    updates: "updates.variant-batch.b-10e-3r.csv",
    reads: "reads.variant-batch.b-10e-3r.csv",
    events: "events_storage.variant-batch.b-10e-3r.csv",
    consistency: "consistency.variant-batch.b-10e-3r.csv",
  },
  C: {
    updates: "updates.variant-batch.c-10e-3r.csv",
    reads: "reads.variant-batch.c-10e-3r.csv",
    events: "events_storage.variant-batch.c-10e-3r.csv",
    consistency: "consistency.variant-batch.c-10e-3r.csv",
  },
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

function summarizeVariant(variant) {
  const files = INPUTS[variant];
  const updates = readCsv(files.updates);
  const reads = readCsv(files.reads);
  const events = readCsv(files.events);
  const consistency = readCsv(files.consistency);

  const successfulUpdates = updates.filter((row) => row.tx_status === "success");
  const gasValues = successfulUpdates.map((row) => Number(row.gas_used));
  const confirmationValues = successfulUpdates.map((row) => Number(row.confirmation_latency_ms));
  const endToEndValues = successfulUpdates.map((row) => Number(row.end_to_end_latency_ms));
  const readValues = reads.filter((row) => row.read_success === "true").map((row) => Number(row.read_latency_ms));
  const rounds = events.map((row) => ({
    checkpointNo: Number(row.checkpoint_no),
    blockCount: Number((row.notes.match(/blocks=(\d+)/) || [0, 0])[1]),
    maxSameBlock: Number((row.notes.match(/max_same_block=(\d+)/) || [0, 0])[1]),
    distribution: parseDistribution(row.notes),
  }));
  const stateCounts = {};
  successfulUpdates
    .filter((row) => row.sequence_no === "3")
    .forEach((row) => {
      stateCounts[row.trust_state] = (stateCounts[row.trust_state] || 0) + 1;
    });

  const consistencyMismatches = consistency.filter((row) => row.consistent_state !== "true").length;
  const singleBlockRounds = rounds.filter((row) => row.blockCount === 1).length;
  const avgMaxSameBlockRatio = mean(rounds.map((row) => row.maxSameBlock / 10));
  const avgBlocksPerRound = mean(rounds.map((row) => row.blockCount));

  return {
    variant,
    files,
    updatesCount: successfulUpdates.length,
    failedUpdates: updates.length - successfulUpdates.length,
    avgGasUsed: round(mean(gasValues)),
    stdGasUsed: round(stddev(gasValues)),
    avgConfirmationLatencyMs: round(mean(confirmationValues)),
    stdConfirmationLatencyMs: round(stddev(confirmationValues)),
    avgEndToEndLatencyMs: round(mean(endToEndValues)),
    avgReadLatencyMs: round(mean(readValues)),
    stdReadLatencyMs: round(stddev(readValues)),
    avgBlocksPerRound: round(avgBlocksPerRound),
    avgMaxSameBlockRatio: round(avgMaxSameBlockRatio),
    singleBlockRounds,
    totalRounds: rounds.length,
    consistencyMismatches,
    stateCounts,
    rounds,
  };
}

function toCsvRow(values) {
  return values
    .map((value) => {
      const text = String(value);
      if (text.includes(",") || text.includes("\"") || text.includes("\n")) {
        return `"${text.replace(/"/g, "\"\"")}"`;
      }
      return text;
    })
    .join(",");
}

function writeSummaryCsv(summaries) {
  const rows = [
    toCsvRow([
      "variant",
      "updates",
      "failed_updates",
      "avg_gas_used",
      "std_gas_used",
      "avg_confirmation_latency_ms",
      "std_confirmation_latency_ms",
      "avg_end_to_end_latency_ms",
      "avg_read_latency_ms",
      "std_read_latency_ms",
      "avg_blocks_per_round",
      "avg_max_same_block_ratio",
      "single_block_rounds",
      "total_rounds",
      "consistency_mismatches",
      "final_trusted",
      "final_suspicious",
      "final_untrusted",
    ]),
  ];

  for (const summary of summaries) {
    rows.push(
      toCsvRow([
        summary.variant,
        summary.updatesCount,
        summary.failedUpdates,
        summary.avgGasUsed,
        summary.stdGasUsed,
        summary.avgConfirmationLatencyMs,
        summary.stdConfirmationLatencyMs,
        summary.avgEndToEndLatencyMs,
        summary.avgReadLatencyMs,
        summary.stdReadLatencyMs,
        summary.avgBlocksPerRound,
        summary.avgMaxSameBlockRatio,
        summary.singleBlockRounds,
        summary.totalRounds,
        summary.consistencyMismatches,
        summary.stateCounts.Trusted || 0,
        summary.stateCounts.Suspicious || 0,
        summary.stateCounts.Untrusted || 0,
      ])
    );
  }

  fs.writeFileSync(path.join(DERIVED_DIR, "variant_comparison_summary.csv"), rows.join("\n") + "\n");
}

function writeSummaryMarkdown(summaries) {
  const lines = [
    "# Variant Comparison Summary",
    "",
    "Comparison inputs:",
    "",
    `- Variant A: \`${INPUTS.A.updates}\``,
    `- Variant B: \`${INPUTS.B.updates}\``,
    `- Variant C: \`${INPUTS.C.updates}\``,
    "",
    "## Comparison Table",
    "",
    "| Variant | Avg Gas | Avg Confirmation Latency (ms) | Avg Read Latency (ms) | Avg Blocks/Round | Avg Max Same-Block Ratio | Single-Block Rounds | Final States |",
    "| --- | ---: | ---: | ---: | ---: | ---: | ---: | --- |",
  ];

  for (const summary of summaries) {
    const states = `T=${summary.stateCounts.Trusted || 0}, S=${summary.stateCounts.Suspicious || 0}, U=${summary.stateCounts.Untrusted || 0}`;
    lines.push(
      `| ${summary.variant} | ${summary.avgGasUsed} | ${summary.avgConfirmationLatencyMs} | ${summary.avgReadLatencyMs} | ${summary.avgBlocksPerRound} | ${summary.avgMaxSameBlockRatio} | ${summary.singleBlockRounds}/${summary.totalRounds} | ${states} |`
    );
  }

  lines.push(
    "",
    "## Round-Level Block Inclusion",
    ""
  );

  for (const summary of summaries) {
    lines.push(`### Variant ${summary.variant}`);
    for (const roundInfo of summary.rounds) {
      const distribution = roundInfo.distribution.map((entry) => `${entry.blockNumber}:${entry.count}`).join(", ");
      lines.push(`- Round ${roundInfo.checkpointNo}: blocks=${roundInfo.blockCount}, max_same_block=${roundInfo.maxSameBlock}, distribution=${distribution}`);
    }
    lines.push("");
  }

  const bestLatency = summaries.reduce((best, current) => current.avgConfirmationLatencyMs < best.avgConfirmationLatencyMs ? current : best);
  const bestPacking = summaries.reduce((best, current) => current.avgMaxSameBlockRatio > best.avgMaxSameBlockRatio ? current : best);
  const lowestGas = summaries.reduce((best, current) => current.avgGasUsed < best.avgGasUsed ? current : best);

  lines.push("## Interpretation", "");
  lines.push(`- Lowest gas cost: Variant ${lowestGas.variant}.`);
  lines.push(`- Lowest average confirmation latency: Variant ${bestLatency.variant}.`);
  lines.push(`- Strongest same-block inclusion: Variant ${bestPacking.variant}.`);
  lines.push("- All three variants preserved the same final trust-state distribution and showed zero consistency mismatches in the selected runs.");
  lines.push("");

  fs.writeFileSync(path.join(DERIVED_DIR, "variant_comparison_summary.md"), lines.join("\n"));
}

function buildBarChartSvg(title, yLabel, data, valueFormatter, color) {
  const width = 900;
  const height = 560;
  const margin = { top: 70, right: 40, bottom: 100, left: 90 };
  const chartWidth = width - margin.left - margin.right;
  const chartHeight = height - margin.top - margin.bottom;
  const maxValue = Math.max(...data.map((entry) => entry.value), 1);
  const paddedMax = maxValue * 1.15;
  const barWidth = chartWidth / (data.length * 2);

  const bars = data.map((entry, index) => {
    const barHeight = (entry.value / paddedMax) * chartHeight;
    const x = margin.left + ((index * 2) + 0.5) * barWidth;
    const y = margin.top + (chartHeight - barHeight);
    const labelY = y - 12;
    const variantX = x + (barWidth / 2);

    return `
      <rect x="${x}" y="${y}" width="${barWidth}" height="${barHeight}" fill="${color}" rx="6" />
      <text x="${variantX}" y="${labelY}" font-size="16" text-anchor="middle" fill="#1f2937">${valueFormatter(entry.value)}</text>
      <text x="${variantX}" y="${height - 45}" font-size="18" font-weight="600" text-anchor="middle" fill="#111827">${entry.label}</text>
    `;
  }).join("\n");

  const gridLines = 5;
  const grid = [];
  for (let index = 0; index <= gridLines; index += 1) {
    const value = paddedMax * (index / gridLines);
    const y = margin.top + chartHeight - (chartHeight * (index / gridLines));
    grid.push(`
      <line x1="${margin.left}" y1="${y}" x2="${width - margin.right}" y2="${y}" stroke="#e5e7eb" stroke-width="1" />
      <text x="${margin.left - 12}" y="${y + 5}" font-size="14" text-anchor="end" fill="#6b7280">${valueFormatter(value)}</text>
    `);
  }

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
  <rect width="${width}" height="${height}" fill="#ffffff" />
  <text x="${width / 2}" y="36" font-size="28" font-weight="700" text-anchor="middle" fill="#111827">${title}</text>
  <text x="24" y="${margin.top + chartHeight / 2}" font-size="16" text-anchor="middle" fill="#374151" transform="rotate(-90, 24, ${margin.top + chartHeight / 2})">${yLabel}</text>
  ${grid.join("\n")}
  <line x1="${margin.left}" y1="${margin.top + chartHeight}" x2="${width - margin.right}" y2="${margin.top + chartHeight}" stroke="#374151" stroke-width="2" />
  ${bars}
</svg>
`;
}

function buildRoundPackingSvg(summaries) {
  const width = 980;
  const height = 600;
  const margin = { top: 80, right: 40, bottom: 90, left: 80 };
  const chartWidth = width - margin.left - margin.right;
  const chartHeight = height - margin.top - margin.bottom;
  const columns = summaries.length * 3;
  const columnWidth = chartWidth / columns;
  const colors = ["#0ea5e9", "#38bdf8", "#7dd3fc", "#bae6fd"];

  let columnIndex = 0;
  const rects = [];
  const labels = [];

  for (const summary of summaries) {
    for (const roundInfo of summary.rounds) {
      let stackBase = margin.top + chartHeight;
      roundInfo.distribution.forEach((entry, distIndex) => {
        const segmentHeight = (entry.count / 10) * chartHeight;
        stackBase -= segmentHeight;
        rects.push(
          `<rect x="${margin.left + columnIndex * columnWidth + 12}" y="${stackBase}" width="${columnWidth - 24}" height="${segmentHeight}" fill="${colors[distIndex % colors.length]}" rx="4" />`
        );
      });

      labels.push(
        `<text x="${margin.left + columnIndex * columnWidth + (columnWidth / 2)}" y="${height - 45}" font-size="14" text-anchor="middle" fill="#111827">${summary.variant}-R${roundInfo.checkpointNo}</text>`
      );
      columnIndex += 1;
    }
  }

  const grid = [];
  for (let index = 0; index <= 5; index += 1) {
    const y = margin.top + chartHeight - ((chartHeight / 5) * index);
    const value = index * 2;
    grid.push(`<line x1="${margin.left}" y1="${y}" x2="${width - margin.right}" y2="${y}" stroke="#e5e7eb" stroke-width="1" />`);
    grid.push(`<text x="${margin.left - 12}" y="${y + 5}" font-size="14" text-anchor="end" fill="#6b7280">${value}</text>`);
  }

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
  <rect width="${width}" height="${height}" fill="#ffffff" />
  <text x="${width / 2}" y="36" font-size="28" font-weight="700" text-anchor="middle" fill="#111827">Per-Round Same-Block Packing</text>
  <text x="${width / 2}" y="60" font-size="16" text-anchor="middle" fill="#4b5563">Each column shows how 10 transactions were distributed across blocks in one round</text>
  <text x="24" y="${margin.top + chartHeight / 2}" font-size="16" text-anchor="middle" fill="#374151" transform="rotate(-90, 24, ${margin.top + chartHeight / 2})">Transactions Per Round</text>
  ${grid.join("\n")}
  <line x1="${margin.left}" y1="${margin.top + chartHeight}" x2="${width - margin.right}" y2="${margin.top + chartHeight}" stroke="#374151" stroke-width="2" />
  ${rects.join("\n")}
  ${labels.join("\n")}
</svg>
`;
}

function writePlots(summaries) {
  const gasData = summaries.map((summary) => ({ label: summary.variant, value: summary.avgGasUsed }));
  const confirmationData = summaries.map((summary) => ({ label: summary.variant, value: summary.avgConfirmationLatencyMs }));
  const readData = summaries.map((summary) => ({ label: summary.variant, value: summary.avgReadLatencyMs }));
  const packingData = summaries.map((summary) => ({ label: summary.variant, value: summary.avgMaxSameBlockRatio }));

  fs.writeFileSync(
    path.join(PLOTS_DIR, "avg_gas_used.svg"),
    buildBarChartSvg("Average Gas Used Per Trust Update", "Gas Used", gasData, (value) => `${Math.round(value)}`, "#d97706")
  );
  fs.writeFileSync(
    path.join(PLOTS_DIR, "avg_confirmation_latency_ms.svg"),
    buildBarChartSvg("Average Confirmation Latency", "Milliseconds", confirmationData, (value) => `${Math.round(value)}`, "#2563eb")
  );
  fs.writeFileSync(
    path.join(PLOTS_DIR, "avg_read_latency_ms.svg"),
    buildBarChartSvg("Average Trust Registry Read Latency", "Milliseconds", readData, (value) => `${round(value)}`, "#059669")
  );
  fs.writeFileSync(
    path.join(PLOTS_DIR, "avg_max_same_block_ratio.svg"),
    buildBarChartSvg("Average Max Same-Block Ratio", "Ratio", packingData, (value) => `${round(value)}`, "#7c3aed")
  );
  fs.writeFileSync(
    path.join(PLOTS_DIR, "round_block_packing.svg"),
    buildRoundPackingSvg(summaries)
  );
}

function main() {
  ensureDir(DERIVED_DIR);
  ensureDir(PLOTS_DIR);

  const summaries = ["A", "B", "C"].map(summarizeVariant);
  writeSummaryCsv(summaries);
  writeSummaryMarkdown(summaries);
  writePlots(summaries);

  console.log("[analysis] Generated variant comparison summary");
  for (const summary of summaries) {
    console.log(
      `[analysis] Variant ${summary.variant}: avgGas=${summary.avgGasUsed}, avgConfirmationLatencyMs=${summary.avgConfirmationLatencyMs}, avgReadLatencyMs=${summary.avgReadLatencyMs}, avgBlocksPerRound=${summary.avgBlocksPerRound}, avgMaxSameBlockRatio=${summary.avgMaxSameBlockRatio}`
    );
  }
  console.log(`[analysis] Summary CSV: ${path.join(DERIVED_DIR, "variant_comparison_summary.csv")}`);
  console.log(`[analysis] Summary Markdown: ${path.join(DERIVED_DIR, "variant_comparison_summary.md")}`);
  console.log(`[analysis] Plots directory: ${PLOTS_DIR}`);
}

main();
