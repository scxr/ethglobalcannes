// scripts/deploy-mock.ts
import { ethers } from "hardhat";

async function main() {
    console.log("🚀 Deploying ChipIn with Mock Swap...");
    
    const [deployer] = await ethers.getSigners();
    console.log("📝 Deploying with account:", deployer.address);
    
    const USDC_ADDRESS = "0x75faf114eafb1BDbe2F0316DF893fd58CE46AA4d";
    
    // Deploy Factory
    console.log("📄 Deploying ChipInFactory (Mock)...");
    const ChipInFactory = await ethers.getContractFactory("ChipInFactory");
    const factory = await ChipInFactory.deploy(USDC_ADDRESS, deployer.address);
    await factory.waitForDeployment();
    
    const factoryAddress = await factory.getAddress();
    console.log("✅ Factory deployed:", factoryAddress);
    
    // Deploy mock tokens directly instead of using factory function
    console.log("🎭 Creating mock tokens...");
    
    const MockERC20 = await ethers.getContractFactory("MockERC20");
    
    const mockETH = await MockERC20.deploy("Mock Ethereum", "mETH");
    await mockETH.waitForDeployment();
    const mockETHAddress = await mockETH.getAddress();
    
    const mockBTC = await MockERC20.deploy("Mock Bitcoin", "mBTC");
    await mockBTC.waitForDeployment();
    const mockBTCAddress = await mockBTC.getAddress();
    
    console.log("✅ Mock tokens created:");
    console.log("  mETH:", mockETHAddress);
    console.log("  mBTC:", mockBTCAddress);
    
    // Set realistic exchange rates
    console.log("💱 Setting exchange rates...");
    await factory.setExchangeRate(mockETHAddress, ethers.parseEther("0.0006")); // 1 USDC = 0.0006 mETH
    await factory.setExchangeRate(mockBTCAddress, ethers.parseEther("0.000025")); // 1 USDC = 0.000025 mBTC
    
    // Create a test pool
    console.log("🏊 Creating test pool...");
    const testPoolTx = await factory.createPool(
        "Mock ETH Pool",
        "Buy ETH together with mock swapping",
        ethers.parseUnits("100", 6), // 100 USDC
        mockETHAddress,
        Math.floor(Date.now() / 1000) + 86400, // 1 day
        10 // max contributors
    );
    await testPoolTx.wait();
    
    const testPoolAddress = await factory.getPool(0);
    console.log("✅ Test pool created:", testPoolAddress);
    
    // Preview the swap
    const previewAmount = await factory.previewSwap(mockETHAddress, ethers.parseUnits("100", 6));
    console.log("💰 Preview: 100 USDC =", ethers.formatEther(previewAmount), "mETH");
    
    // Save addresses
    const addresses = {
        factory: factoryAddress,
        usdc: USDC_ADDRESS,
        network: "arbitrumSepolia",
        version: "Mock",
        deployer: deployer.address,
        deployedAt: new Date().toISOString(),
        testPool: testPoolAddress,
        mockTokens: {
            mETH: mockETHAddress,
            mBTC: mockBTCAddress
        },
        exchangeRates: {
            mETH: "0.0006 mETH per USDC",
            mBTC: "0.000025 mBTC per USDC"
        }
    };
    
    const fs = require("fs");
    fs.writeFileSync("deployed-addresses-mock.json", JSON.stringify(addresses, null, 2));
    
    console.log("🎉 Mock deployment complete!");
    console.log("\n📋 Summary:");
    console.log("Factory:", factoryAddress);
    console.log("Test Pool:", testPoolAddress);
    console.log("Mock ETH:", mockETHAddress);
    console.log("Mock BTC:", mockBTCAddress);
    
    console.log("\n🧪 Test the contribution flow:");
    console.log("1. Get testnet USDC from https://faucet.circle.com/");
    console.log("2. Contribute to the pool via your frontend");
    console.log("3. When goal is reached, execute the swap:");
    console.log(`   curl -X POST http://localhost:3000/api/contracts/execute-purchase \\`);
    console.log(`     -H "Content-Type: application/json" \\`);
    console.log(`     -d '{"poolId": 0, "poolAddress": "${testPoolAddress}"}'`);
    
    console.log("\n✨ What happens in the mock swap:");
    console.log("- Collects USDC from pool");
    console.log("- Takes 0.5% factory fee");
    console.log("- Mints mock tokens at set exchange rate");
    console.log("- Distributes tokens proportionally to contributors");
    console.log("- Perfect for demos and testing!");
}

main().then(() => process.exit(0)).catch(console.error);