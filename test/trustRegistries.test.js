const assert = require("assert");
const hre = require("hardhat");

describe("DATM contract stubs", function () {
  async function deploy(contractName) {
    const factory = await hre.ethers.getContractFactory(contractName);
    const contract = await factory.deploy();
    await contract.deployed();
    return contract;
  }

  it("Variant A stores ATS and trust state correctly", async function () {
    const registry = await deploy("TrustRegistryA");
    const subjectId = hre.ethers.utils.formatBytes32String("entity-a");
    const inputHash = hre.ethers.utils.hexZeroPad("0x1234", 32);

    await registry.updateTrust(subjectId, 93, 1, 1000, inputHash);
    const record = await registry.getTrustRecord(subjectId);

    assert.strictEqual(record.subjectId, subjectId);
    assert.strictEqual(record.ats, 93);
    assert.strictEqual(record.trustState, 1);
    assert.strictEqual(record.calcTimestamp.toNumber(), 1000);
    assert.strictEqual(record.inputHash, inputHash);
  });

  it("Variant B calculates ATS correctly from component scores", async function () {
    const registry = await deploy("TrustRegistryB");
    const subjectId = hre.ethers.utils.formatBytes32String("entity-b");
    const inputHash = hre.ethers.utils.hexZeroPad("0x2345", 32);

    await registry.updateTrust(subjectId, 90, 80, 70, 60, 2000, inputHash);
    const record = await registry.getTrustRecord(subjectId);

    assert.strictEqual(record.ats, 75);
    assert.strictEqual(record.trustState, 2);
  });

  it("Variant B classifies Trusted, Suspicious, and Untrusted correctly", async function () {
    const registry = await deploy("TrustRegistryB");

    assert.strictEqual(await registry.classifyAts(80), 1);
    assert.strictEqual(await registry.classifyAts(50), 2);
    assert.strictEqual(await registry.classifyAts(49), 3);
  });

  it("Variant C calculates behaviorScore from raw indicators", async function () {
    const registry = await deploy("TrustRegistryC");

    const behaviorScore = await registry.calculateBehaviorScore(4, 1, 3, 1, 1, 1);
    assert.strictEqual(behaviorScore, 59);
  });

  it("Variant C calculates ATS and classification correctly", async function () {
    const registry = await deploy("TrustRegistryC");
    const subjectId = hre.ethers.utils.formatBytes32String("entity-c");
    const inputHash = hre.ethers.utils.hexZeroPad("0x3456", 32);

    const ats = await registry.calculateAtsFromRaw(72, 68, 60, 4, 1, 3, 1, 1, 1);
    assert.strictEqual(ats, 64);

    await registry.updateTrust(subjectId, 72, 68, 60, 4, 1, 3, 1, 1, 1, 3000, inputHash);
    const record = await registry.getTrustRecord(subjectId);

    assert.strictEqual(record.ats, 64);
    assert.strictEqual(record.trustState, 2);
  });

  it("Boundary thresholds work: 80 = Trusted, 50 = Suspicious, 49 = Untrusted", async function () {
    const registry = await deploy("TrustRegistryB");

    await registry.updateTrust(hre.ethers.utils.formatBytes32String("trusted"), 80, 80, 80, 80, 1, hre.ethers.utils.hexZeroPad("0x01", 32));
    await registry.updateTrust(hre.ethers.utils.formatBytes32String("suspicious"), 50, 50, 50, 50, 2, hre.ethers.utils.hexZeroPad("0x02", 32));
    await registry.updateTrust(hre.ethers.utils.formatBytes32String("untrusted"), 49, 49, 49, 49, 3, hre.ethers.utils.hexZeroPad("0x03", 32));

    const trusted = await registry.getTrustRecord(hre.ethers.utils.formatBytes32String("trusted"));
    const suspicious = await registry.getTrustRecord(hre.ethers.utils.formatBytes32String("suspicious"));
    const untrusted = await registry.getTrustRecord(hre.ethers.utils.formatBytes32String("untrusted"));

    assert.strictEqual(trusted.ats, 80);
    assert.strictEqual(trusted.trustState, 1);
    assert.strictEqual(suspicious.ats, 50);
    assert.strictEqual(suspicious.trustState, 2);
    assert.strictEqual(untrusted.ats, 49);
    assert.strictEqual(untrusted.trustState, 3);
  });
});
