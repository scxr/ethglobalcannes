// app/api/contracts/create-pool/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { createPublicClient, http, getContract, encodeFunctionData, encodePacked, parseAbi, parseErc6492Signature, formatUnits, hexToBigInt } from 'viem'
import { createBundlerClient } from 'viem/account-abstraction'
import { arbitrumSepolia } from 'viem/chains'
import { toEcdsaKernelSmartAccount } from 'permissionless/accounts'
import { privateKeyToAccount } from 'viem/accounts'

// SAME as working transfer
const ARBITRUM_SEPOLIA_USDC = '0x75faf114eafb1BDbe2F0316DF893fd58CE46AA4d'
const ARBITRUM_SEPOLIA_PAYMASTER = '0x31BE08D380A21fc740883c0BC434FcFc88740b58'
const ARBITRUM_SEPOLIA_BUNDLER = `https://public.pimlico.io/v2/${arbitrumSepolia.id}/rpc`
const MAX_GAS_USDC = BigInt(1000000) // 0.4 USDC for gas

// Your NEW Mock factory address - UPDATE THIS!
const FACTORY_ADDRESS = '0x108c416A6Cb34cea4A1C93F749B347e1dE3C65e8'

const tokenAbi = parseAbi([
  'function balanceOf(address account) view returns (uint256)',
  'function transfer(address to, uint256 amount) returns (bool)',
  'function permit(address owner, address spender, uint256 value, uint256 deadline, uint8 v, bytes32 r, bytes32 s)',
  'function nonces(address owner) view returns (uint256)',
  'function name() view returns (string)',
  'function version() view returns (string)',
  'function symbol() view returns (string)',
  'function decimals() view returns (uint8)',
  'function DOMAIN_SEPARATOR() view returns (bytes32)',
  'function allowance(address owner, address spender) view returns (uint256)',
  'function approve(address spender, uint256 amount) returns (bool)'
])

// Updated factory ABI for Mock version
const factoryAbi = parseAbi([
  'function createPool(string title, string description, uint256 targetAmount, address targetToken, uint256 deadline, uint256 maxContributors) returns (address)',
  'function poolCount() view returns (uint256)',
  'function createMockToken(string name, string symbol) returns (address)',
  'function setExchangeRate(address token, uint256 rate)',
  'function exchangeRates(address token) view returns (uint256)',
  'event PoolCreated(uint256 indexed poolId, address indexed poolAddress, address indexed creator, string title, uint256 targetAmount, address targetToken)',
  'event MockTokenCreated(address indexed tokenAddress, string name, string symbol)'
])

// EXACT same permit function as working transfer
async function eip2612Permit({
  token,
  chain,
  ownerAddress,
  spenderAddress,
  value
}: {
  token: any
  chain: any
  ownerAddress: string
  spenderAddress: string
  value: bigint
}) {
  const [nonce, name, version] = await Promise.all([
    token.read.nonces([ownerAddress]),
    token.read.name(),
    token.read.version(),
  ])
  
  const domain = {
    name,
    version,
    chainId: chain.id,
    verifyingContract: token.address,
  }
  
  const types = {
    Permit: [
      { name: 'owner', type: 'address' },
      { name: 'spender', type: 'address' },
      { name: 'value', type: 'uint256' },
      { name: 'nonce', type: 'uint256' },
      { name: 'deadline', type: 'uint256' },
    ],
  }
  
  const message = {
    owner: ownerAddress,
    spender: spenderAddress,
    value,
    nonce,
    deadline: BigInt('0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff'),
  }
  
  return { domain, types, message }
}

export async function POST(request: NextRequest) {
  try {
    const {
      title,
      description,
      targetAmount,
      targetToken,
      deadline,
      maxContributors,
      userAddress,
      chainId,
      createMockToken = false,
      mockTokenName,
      mockTokenSymbol
    } = await request.json()

    const privateKey = process.env.PRIVATE_KEY

    console.log('🏊 Creating pool with Mock factory:', {
      title,
      description,
      targetAmount,
      targetToken,
      deadline,
      maxContributors,
      createMockToken,
      mockTokenName,
      mockTokenSymbol,
      userAddress,
      chainId
    })

    if (!privateKey) {
      return NextResponse.json({
        success: false,
        error: 'Private key required for smart account operations'
      })
    }

    // Validate inputs
    if (!title || !description || !targetAmount || !deadline || !maxContributors) {
      return NextResponse.json({
        success: false,
        error: 'Missing required fields: title, description, targetAmount, deadline, maxContributors'
      })
    }

    // EXACT same client setup as working transfer
    const client = createPublicClient({
      chain: arbitrumSepolia,
      transport: http('https://sepolia-rollup.arbitrum.io/rpc')
    })

    const bundlerClient = createBundlerClient({
      client,
      transport: http(ARBITRUM_SEPOLIA_BUNDLER)
    })

    // EXACT same account setup as working transfer
    const owner = privateKeyToAccount(privateKey as `0x${string}`)
    const account = await toEcdsaKernelSmartAccount({
      client,
      owners: [owner],
      version: '0.3.1'
    })

    // EXACT same USDC setup as working transfer
    const usdc = getContract({
      client,
      address: ARBITRUM_SEPOLIA_USDC,
      abi: tokenAbi,
    })

    console.log("💳 Account address:", account.address)

    // EXACT same contract verification as working transfer
    try {
      const name = await usdc.read.name()
      const symbol = await usdc.read.symbol()
      const decimals = await usdc.read.decimals()
      console.log("📄 USDC Contract info:", { name, symbol, decimals })
    } catch (error) {
      console.error("❌ Error reading USDC contract info:", error)
      return NextResponse.json({
        success: false,
        error: 'Unable to read USDC contract. Contract might be incorrect.',
        details: error instanceof Error ? error.message : 'Unknown error'
      })
    }

    // EXACT same balance check as working transfer
    const balance = await usdc.read.balanceOf([account.address])
    console.log("💰 Balance:", formatUnits(balance, 6), "USDC")
    
    if (balance < MAX_GAS_USDC) {
      return NextResponse.json({
        success: false,
        error: `Insufficient USDC balance. Have: ${formatUnits(balance, 6)}, Need: ${formatUnits(MAX_GAS_USDC, 6)}`
      })
    }

    // Setup factory contract
    const factory = getContract({
      client,
      address: FACTORY_ADDRESS,
      abi: factoryAbi,
    })

    // Check factory exists
    let currentPoolCount = BigInt(0)
    try {
      currentPoolCount = await factory.read.poolCount()
      console.log("📊 Current pool count:", currentPoolCount.toString())
    } catch (error) {
      console.error("❌ Error reading factory:", error)
      return NextResponse.json({
        success: false,
        error: 'Mock factory contract not found. Please deploy the factory first.',
        details: error instanceof Error ? error.message : 'Unknown error'
      })
    }

    // Handle mock token creation if requested
    let finalTargetToken = targetToken
    let mockTokenCreated = false

    if (createMockToken && mockTokenName && mockTokenSymbol) {
      console.log("🎭 Creating mock token first...")
      // We'll create the mock token in the same transaction as the pool
      // For now, just use a placeholder - the frontend should create tokens separately
      console.log("⚠️  Mock token creation should be done separately via /api/contracts/create-mock-token")
    }

    // Use default target token if none provided
    if (!finalTargetToken || finalTargetToken === '0x0000000000000000000000000000000000000000') {
      // Use one of the mock tokens from deployment or a test address
      finalTargetToken = '0x1111111111111111111111111111111111111111' // Placeholder - frontend should provide real token
      console.log("⚠️  Using placeholder target token. Frontend should provide a valid mock token address.")
    }

    // EXACT same permit construction as working transfer
    const permitData = await eip2612Permit({
      token: usdc,
      chain: arbitrumSepolia,
      ownerAddress: account.address,
      spenderAddress: ARBITRUM_SEPOLIA_PAYMASTER,
      value: MAX_GAS_USDC
    })

    const signData = { ...permitData, primaryType: 'Permit' as const }
    const wrappedPermitSignature = await account.signTypedData(signData)
    const { signature: permitSignature } = parseErc6492Signature(wrappedPermitSignature)

    // Pool creation call (updated for mock factory)
    const calls = [{
      to: factory.address,
      abi: factory.abi,
      functionName: 'createPool',
      args: [
        title,
        description,
        BigInt(targetAmount), // Target amount in USDC wei (6 decimals)
        finalTargetToken, // Target token address
        BigInt(deadline), // Unix timestamp
        BigInt(maxContributors)
      ]
    }]

    console.log("🔄 Factory call args:", {
      title,
      description,
      targetAmount: targetAmount.toString(),
      targetToken: finalTargetToken,
      deadline: deadline.toString(),
      maxContributors: maxContributors.toString()
    })

    // EXACT same paymaster setup as working transfer
    const paymaster = ARBITRUM_SEPOLIA_PAYMASTER
    const paymasterData = encodePacked(
      ['uint8', 'address', 'uint256', 'bytes'],
      [
        0, // Reserved for future use
        usdc.address, // Token address
        MAX_GAS_USDC, // Max spendable gas in USDC
        permitSignature // EIP-2612 permit signature
      ]
    )

    // EXACT same gas estimation as working transfer
    const callResult = await client.call({
      to: paymaster,
      data: encodeFunctionData({
        abi: parseAbi(['function additionalGasCharge() returns (uint256)']),
        functionName: 'additionalGasCharge'
      })
    })
    const additionalGasCharge = hexToBigInt(callResult?.data ?? '0x0')

    const { standard: fees } = await bundlerClient.request({
      method: 'pimlico_getUserOperationGasPrice' as any
    }) as { standard: { maxFeePerGas: `0x${string}`, maxPriorityFeePerGas: `0x${string}` } }

    const maxFeePerGas = hexToBigInt(fees.maxFeePerGas)
    const maxPriorityFeePerGas = hexToBigInt(fees.maxPriorityFeePerGas)

    const {
      callGasLimit,
      preVerificationGas,
      verificationGasLimit,
      paymasterPostOpGasLimit,
      paymasterVerificationGasLimit
    } = await bundlerClient.estimateUserOperationGas({
      account,
      calls,
      paymaster,
      paymasterData,
      paymasterPostOpGasLimit: additionalGasCharge,
      maxFeePerGas: BigInt(1),
      maxPriorityFeePerGas: BigInt(1)
    })

    console.log("⛽ Gas estimates:", {
      callGasLimit: callGasLimit.toString(),
      verificationGasLimit: verificationGasLimit.toString()
    })

    // EXACT same user operation as working transfer
    const userOpHash = await bundlerClient.sendUserOperation({
      account,
      calls,
      callGasLimit,
      preVerificationGas,
      verificationGasLimit,
      paymaster,
      paymasterData,
      paymasterVerificationGasLimit,
      paymasterPostOpGasLimit: BigInt(Math.max(
        Number(paymasterPostOpGasLimit),
        Number(additionalGasCharge)
      )),
      maxFeePerGas,
      maxPriorityFeePerGas
    })

    console.log("📤 User operation sent:", userOpHash)

    // EXACT same receipt handling as working transfer
    const receipt = await bundlerClient.waitForUserOperationReceipt({
      hash: userOpHash
    })
    
    console.log("✅ Pool creation completed:", {
      hash: receipt.receipt.transactionHash,
      success: receipt.success,
      gasUsed: receipt.actualGasUsed.toString()
    })

    // Try to get the new pool address by checking the new pool count
    let poolAddress = 'Check transaction logs'
    let poolId = currentPoolCount
    
    try {
      const newPoolCount = await factory.read.poolCount()
      if (newPoolCount > currentPoolCount) {
        poolId = currentPoolCount // The new pool ID
        // Try to get pool address from factory
        // Note: This might fail if the transaction hasn't been fully processed yet
        setTimeout(async () => {
          try {
            const poolAddr = await factory.read.getPool([poolId])
            console.log("🏊 New pool address:", poolAddr)
          } catch (e) {
            console.log("Could not get pool address immediately")
          }
        }, 1000)
      }
    } catch (e) {
      console.log("Could not determine new pool address immediately")
    }
    
    return NextResponse.json({
      success: true,
      userOperationHash: userOpHash,
      transactionHash: receipt.receipt.transactionHash,
      accountAddress: account.address,
      factoryAddress: FACTORY_ADDRESS,
      poolId: poolId.toString(),
      poolAddress,
      title,
      description,
      targetAmount: formatUnits(BigInt(targetAmount), 6) + " USDC",
      targetToken: finalTargetToken,
      deadline: new Date(deadline * 1000).toISOString(),
      maxContributors,
      mockTokenCreated,
      message: 'Pool created successfully via Mock Factory with Circle Paymaster',
      gasUsed: receipt.actualGasUsed.toString(),
      operationSuccess: receipt.success
    })

  } catch (error) {
    console.error('❌ Pool creation failed:', error)
    
    // Better error handling
    let errorMessage = 'Pool creation failed'
    if (error instanceof Error) {
      if (error.message.includes('AA33')) {
        errorMessage = 'Insufficient USDC allowance for paymaster'
      } else if (error.message.includes('AA23')) {
        errorMessage = 'Paymaster validation failed'
      } else if (error.message.includes('Invalid target amount')) {
        errorMessage = 'Target amount must be greater than 0'
      } else if (error.message.includes('Invalid deadline')) {
        errorMessage = 'Deadline must be in the future'
      } else {
        errorMessage = error.message
      }
    }
    
    return NextResponse.json({
      success: false,
      error: errorMessage,
      details: error instanceof Error ? error.message : 'Unknown error'
    })
  }
}