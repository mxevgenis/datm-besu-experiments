const fs = require("fs");
const path = require("path");
const solc = require("solc");

const ROOT = path.join(__dirname, "..");
const CONTRACTS_DIR = path.join(ROOT, "contracts");
const ARTIFACTS_DIR = path.join(ROOT, "artifacts", "contracts");

function findSolidityFiles(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...findSolidityFiles(fullPath));
    } else if (entry.isFile() && entry.name.endsWith(".sol")) {
      files.push(fullPath);
    }
  }

  return files;
}

function toSourceName(filePath) {
  return path.relative(ROOT, filePath).replace(/\\/g, "/");
}

function ensureDir(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true });
}

function writeArtifact(sourceName, contractName, output) {
  const outDir = path.join(ROOT, "artifacts", sourceName);
  ensureDir(outDir);

  const artifact = {
    _format: "hh-sol-artifact-1",
    contractName,
    sourceName,
    abi: output.abi,
    bytecode: output.evm.bytecode.object ? `0x${output.evm.bytecode.object}` : "0x",
    deployedBytecode: output.evm.deployedBytecode.object ? `0x${output.evm.deployedBytecode.object}` : "0x",
    linkReferences: output.evm.bytecode.linkReferences || {},
    deployedLinkReferences: output.evm.deployedBytecode.linkReferences || {},
  };

  fs.writeFileSync(path.join(outDir, `${contractName}.json`), JSON.stringify(artifact, null, 2));
}

function main() {
  const files = findSolidityFiles(CONTRACTS_DIR);
  const sources = {};

  for (const filePath of files) {
    sources[toSourceName(filePath)] = {
      content: fs.readFileSync(filePath, "utf8"),
    };
  }

  const input = {
    language: "Solidity",
    sources,
    settings: {
      evmVersion: "paris",
      optimizer: {
        enabled: true,
        runs: 200,
      },
      viaIR: true,
      outputSelection: {
        "*": {
          "*": ["abi", "evm.bytecode", "evm.deployedBytecode"],
        },
      },
    },
  };

  const result = JSON.parse(solc.compile(JSON.stringify(input)));

  if (result.errors) {
    const fatal = result.errors.filter((entry) => entry.severity === "error");
    for (const entry of result.errors) {
      console.log(entry.formattedMessage);
    }
    if (fatal.length > 0) {
      process.exit(1);
    }
  }

  const artifactsRoot = path.join(ROOT, "artifacts");
  if (fs.existsSync(artifactsRoot)) {
    fs.rmdirSync(artifactsRoot, { recursive: true });
  }
  ensureDir(ARTIFACTS_DIR);

  for (const [sourceName, contracts] of Object.entries(result.contracts)) {
    for (const [contractName, output] of Object.entries(contracts)) {
      writeArtifact(sourceName, contractName, output);
    }
  }

  console.log(`Compiled ${files.length} Solidity source files.`);
}

main();
