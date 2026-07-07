const fs = require("fs");
const path = require("path");
const { ethers } = require("ethers");
const { ROOT, loadEnv } = require("../runner/load_env");

const OUTPUT_PATH = path.join(ROOT, "results", "raw", "deployed_contracts.json");

function requireEnv(name) {
  const value = process.env[name];
  if (value == null || value.trim() === "") {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value.trim();
}

function loadArtifact(relativePath) {
  const filePath = path.join(ROOT, relativePath);
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function ensureOutputDir() {
  fs.mkdirSync(path.dirname(OUTPUT_PATH), { recursive: true });
}

async function deployContract(wallet, label, artifactPath) {
  const artifact = loadArtifact(artifactPath);

  if (!artifact.bytecode || artifact.bytecode === "0x") {
    throw new Error(`Artifact for ${label} has no deployable bytecode: ${artifactPath}`);
  }

  const factory = new ethers.ContractFactory(artifact.abi, artifact.bytecode, wallet);
  const contract = await factory.deploy();

  console.log(`[deploy] ${label}: submitted tx ${contract.deployTransaction.hash}`);

  const receipt = await contract.deployTransaction.wait();
  console.log(
    `[deploy] ${label}: deployed at ${contract.address} in block ${receipt.blockNumber} (gasUsed=${receipt.gasUsed.toString()})`
  );

  return {
    address: contract.address,
    deployTxHash: contract.deployTransaction.hash,
    blockNumber: receipt.blockNumber,
    gasUsed: receipt.gasUsed.toString(),
  };
}

async function main() {
  loadEnv();

  const rpcUrl = requireEnv("BESU_RPC_URL");
  const privateKey = process.env.PRIVATE_KEY && process.env.PRIVATE_KEY.trim() !== ""
    ? process.env.PRIVATE_KEY.trim()
    : process.env.FROM_PK && process.env.FROM_PK.trim() !== ""
      ? process.env.FROM_PK.trim()
      : "";

  if (privateKey === "") {
    throw new Error("Missing sender key in .env: set PRIVATE_KEY or FROM_PK");
  }

  if (!privateKey.startsWith("0x")) {
    throw new Error("Sender key must be a 0x-prefixed hex string");
  }

  console.log("[safety] This script deploys contracts to the RPC endpoint you provide.");
  console.log("[safety] It does not interact with Kubernetes resources.");
  console.log(`[deploy] Target RPC URL: ${rpcUrl}`);

  const provider = new ethers.providers.JsonRpcProvider(rpcUrl);
  const wallet = new ethers.Wallet(privateKey, provider);

  const chain = await provider.getNetwork();
  const deployerAddress = await wallet.getAddress();

  console.log(`[deploy] Connected to chainId=${chain.chainId}`);
  console.log(`[deploy] Deployer address: ${deployerAddress}`);

  const deployments = {};

  deployments.variantA = await deployContract(
    wallet,
    "TrustRegistryA",
    "artifacts/contracts/variant-a/TrustRegistryA.sol/TrustRegistryA.json"
  );
  deployments.variantB = await deployContract(
    wallet,
    "TrustRegistryB",
    "artifacts/contracts/variant-b/TrustRegistryB.sol/TrustRegistryB.json"
  );
  deployments.variantC = await deployContract(
    wallet,
    "TrustRegistryC",
    "artifacts/contracts/variant-c/TrustRegistryC.sol/TrustRegistryC.json"
  );

  const output = {
    deployedAt: new Date().toISOString(),
    rpcUrl: rpcUrl,
    chainId: chain.chainId,
    deployerAddress: deployerAddress,
    contracts: {
      VARIANT_A_CONTRACT: deployments.variantA.address,
      VARIANT_B_CONTRACT: deployments.variantB.address,
      VARIANT_C_CONTRACT: deployments.variantC.address,
    },
    deploymentMeta: deployments,
  };

  ensureOutputDir();
  fs.writeFileSync(OUTPUT_PATH, JSON.stringify(output, null, 2));

  console.log("[deploy] Contract addresses:");
  console.log(`VARIANT_A_CONTRACT=${deployments.variantA.address}`);
  console.log(`VARIANT_B_CONTRACT=${deployments.variantB.address}`);
  console.log(`VARIANT_C_CONTRACT=${deployments.variantC.address}`);
  console.log(`[deploy] Wrote deployment record to ${OUTPUT_PATH}`);
}

main().catch((error) => {
  console.error(`[deploy] Aborted: ${error.message}`);
  process.exit(1);
});
