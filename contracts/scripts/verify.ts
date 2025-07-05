import { ethers, run } from "hardhat";

async function main() {
  const fs = require("fs");
  
  if (!fs.existsSync("deployed-addresses.json")) {
    console.error("❌ deployed-addresses.json not found. Deploy contracts first.");
    return;
  }
  
  const addresses = JSON.parse(fs.readFileSync("deployed-addresses.json", "utf8"));
  
  console.log("🔍 Verifying contracts...");
  
  // Verify Factory
  try {
    await run("verify:verify", {
      address: addresses.factory,
      constructorArguments: [
        addresses.usdc,
        addresses.oneInchRouter,
        addresses.deployer
      ],
    });
    console.log("✅ Factory verified");
  } catch (e) {
    console.log("❌ Factory verification failed:", e);
  }
  
  // Verify Registry
  try {
    await run("verify:verify", {
      address: addresses.registry,
      constructorArguments: [],
    });
    console.log("✅ Registry verified");
  } catch (e) {
    console.log("❌ Registry verification failed:", e);
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });