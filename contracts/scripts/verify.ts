import { ethers, run } from "hardhat";

async function main() {
  const fs = require("fs");
  
  if (!fs.existsSync("deployed-addresses.json")) {
    console.error("❌ deployed-addresses.json not found. Deploy contracts first.");
    return;
  }
  
  const addresses = JSON.parse(fs.readFileSync("deployed-addresses.json", "utf8"));
  console.log("🔍 Verifying contracts...");
  
  // Debug: Print all addresses
  console.log("📋 Deployed addresses:", JSON.stringify(addresses, null, 2));
  
  // Verify Factory
  try {
    if (!addresses.factory) {
      throw new Error("Factory address is missing");
    }
    if (!addresses.usdc) {
      throw new Error("USDC address is missing");
    }
    if (!addresses.oneInchRouter && !addresses.uniswapRouter && !addresses.router) {
      throw new Error("Router address is missing (check key name in deployed-addresses.json)");
    }
    if (!addresses.deployer) {
      throw new Error("Deployer address is missing");
    }
    
    // Use the correct router address key
    const routerAddress = addresses.oneInchRouter || addresses.uniswapRouter || addresses.router;
    
    await run("verify:verify", {
      address: addresses.factory,
      constructorArguments: [
        addresses.usdc,
        routerAddress,
        addresses.deployer
      ],
    });
    console.log("✅ Factory verified");
  } catch (e) {
    console.log("❌ Factory verification failed:", e.message);
  }
  
  // Verify Registry
  try {
    if (!addresses.registry) {
      throw new Error("Registry address is missing");
    }
    
    await run("verify:verify", {
      address: addresses.registry,
      constructorArguments: [],
    });
    console.log("✅ Registry verified");
  } catch (e) {
    console.log("❌ Registry verification failed:", e.message);
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });