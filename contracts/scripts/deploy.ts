import { ethers } from "hardhat";

async function main() {
  console.log("🚀 Deploying ChipIn contracts...");

  // Get deployer
  const [deployer] = await ethers.getSigners();
  console.log("📝 Deploying with account:", deployer.address);
  
  const balance = await deployer.provider.getBalance(deployer.address);
  console.log("💰 Account balance:", ethers.formatEther(balance), "ETH");

  // Contract addresses for Arbitrum Sepolia
  const USDC_ADDRESS = "0x75faf114eafb1BDbe2F0316DF893fd58CE46AA4d"; 
  const ONEINCH_ROUTER = "0x1111111254eeb25477b68fb85ed929f73a960582"; // 1inch router

  // Deploy Factory with deployer as initial owner
  console.log("📄 Deploying ChipInFactory...");
  const ChipInFactory = await ethers.getContractFactory("ChipInFactory");
  const factory = await ChipInFactory.deploy(USDC_ADDRESS, ONEINCH_ROUTER, deployer.address);
  await factory.waitForDeployment();
  
  const factoryAddress = await factory.getAddress();
  console.log("✅ ChipInFactory deployed to:", factoryAddress);

  // Deploy Registry
  console.log("📄 Deploying ChipInRegistry...");
  const ChipInRegistry = await ethers.getContractFactory("ChipInRegistry");
  const registry = await ChipInRegistry.deploy();
  await registry.waitForDeployment();
  
  const registryAddress = await registry.getAddress();
  console.log("✅ ChipInRegistry deployed to:", registryAddress);

  // Wait for block confirmations
  console.log("⏳ Waiting for block confirmations...");
  
  // Test the contracts
  console.log("🧪 Testing contract functionality...");
  
  try {
    // Test pool creation
    const tx = await factory.createPool(
      "Test Pool",
      "A test pool for deployment verification",
      ethers.parseUnits("100", 6), // 100 USDC
      ethers.ZeroAddress, // ETH address
      Math.floor(Date.now() / 1000) + 86400, // 1 day from now
      10 // max contributors
    );
    
    const receipt = await tx.wait();
    console.log("✅ Test pool created successfully");
    
    // Get the pool count
    const poolCount = await factory.poolCount();
    console.log("📊 Total pools:", poolCount.toString());
    
  } catch (error) {
    console.log("❌ Contract test failed:", error);
  }

  // Save addresses to file
  const addresses = {
    factory: factoryAddress,
    registry: registryAddress,
    usdc: USDC_ADDRESS,
    oneInchRouter: ONEINCH_ROUTER,
    network: "arbitrumSepolia",
    deployer: deployer.address,
    deployedAt: new Date().toISOString(),
  };

  const fs = require("fs");
  fs.writeFileSync(
    "deployed-addresses.json",
    JSON.stringify(addresses, null, 2)
  );

  console.log("📋 Contract addresses saved to deployed-addresses.json");
  console.log("🎉 Deployment complete!");
  
  console.log("\n📋 Summary:");
  console.log("Factory:", factoryAddress);
  console.log("Registry:", registryAddress);
  console.log("USDC:", USDC_ADDRESS);
  console.log("Network: Arbitrum Sepolia");
  
  console.log("\n🔗 Next steps:");
  console.log("1. Update your Next.js app with these addresses");
  console.log("2. Get testnet USDC from https://faucet.circle.com/");
  console.log("3. Test pool creation in your frontend");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });