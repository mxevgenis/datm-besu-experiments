const { ethers } = require("ethers");
const { loadEnv } = require("./load_env");

function requireEnv(name) {
  const value = process.env[name];
  if (value == null || value.trim() === "") {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value.trim();
}

function getConfig() {
  return {
    rpcUrl: requireEnv("BESU_RPC_URL"),
    variantA: requireEnv("VARIANT_A_CONTRACT"),
    variantB: requireEnv("VARIANT_B_CONTRACT"),
    variantC: requireEnv("VARIANT_C_CONTRACT"),
  };
}

async function verifyContract(provider, label, address) {
  const code = await provider.getCode(address);

  if (!code || code === "0x") {
    throw new Error(`${label} has empty bytecode at ${address}`);
  }

  console.log(`[verify] ${label}: OK (${address})`);
}

async function main() {
  loadEnv();

  const config = getConfig();
  const provider = new ethers.providers.JsonRpcProvider(config.rpcUrl);
  const network = await provider.getNetwork();

  console.log(`[verify] Connected chainId=${network.chainId}`);

  await verifyContract(provider, "TrustRegistryA", config.variantA);
  await verifyContract(provider, "TrustRegistryB", config.variantB);
  await verifyContract(provider, "TrustRegistryC", config.variantC);

  console.log("[verify] Deployment verification passed");
}

main().catch((error) => {
  console.error(`[verify] Aborted: ${error.message}`);
  process.exit(1);
});
