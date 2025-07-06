// app/api/contracts/execute-purchase/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { createPublicClient, http, getContract, encodeFunctionData, encodePacked, parseAbi, parseErc6492Signature, formatUnits, hexToBigInt } from 'viem'
import { createBundlerClient } from 'viem/account-abstraction'
import { arbitrumSepolia } from 'viem/chains'
import { toEcdsaKernelSmartAccount } from 'permissionless/accounts'
import { privateKeyToAccount } from 'viem/accounts'

// Contract addresses
const ARBITRUM_SEPOLIA_USDC = '0x75faf114eafb1BDbe2F0316DF893fd58CE46AA4d'
const ARBITRUM_SEPOLIA_PAYMASTER = '0x31BE08D380A21fc740883c0BC434FcFc88740b58'
const ARBITRUM_SEPOLIA_BUNDLER = `https://public.pimlico.io/v2/${arbitrumSepolia.id}/rpc`
const MAX_GAS_USDC = BigInt(500000) // 0.5 USDC for gas

// Your NEW Mock factory address - UPDATE THIS!
const FACTORY_ADDRESS = '0x108c416A6Cb34cea4A1C93F749B347e1dE3C65e8' // From your deployment

const tokenAbi = parseAbi([
  'function balanceOf(address account) view returns (uint256)',
  'function approve(address spender, uint256 amount) returns (bool)',
  'function transfer(address to, uint256 amount) returns (bool)',
  'function nonces(address owner) view returns (uint256)',
  'function name() view returns (string)',
  'function version() view returns (string)',
  'function decimals() view returns (uint8)',
  'function symbol() view returns (string)'
])

// Updated factory ABI for Mock version
const factoryAbi = parseAbi([
  'function executePoolSwap(uint256 poolId)',
  'function getPool(uint256 poolId) view returns (address)',
  'function poolCount() view returns (uint256)',
  'function pools(uint256) view returns (address)',
  'function previewSwap(address targetToken, uint256 usdcAmount) view returns (uint256)',
  'function exchangeRates(address token) view returns (uint256)',
  'event MockSwapExecuted(uint256 indexed poolId, address indexed targetToken, uint256 usdcAmount, uint256 tokensReceived, uint256 exchangeRate)'
])

const poolAbi = parseAbi([
  'function getPoolInfo() view returns (string title, string description, uint256 targetAmount, uint256 totalContributed, uint256 contributorCount, uint256 deadline, bool goalReached, bool executed, bool cancelled)',
  'function targetToken() view returns (address)',
  'function totalContributed() view returns (uint256)',
  'function goalReached() view returns (bool)',
  'function executed() view returns (bool)',
  'function getContributors() view returns (address[], uint256[])'
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
      poolId,
      poolAddress,
      userAddress,
      chainId
    } = await request.json()

    const privateKey = process.env.PRIVATE_KEY

    console.log('🎭 Executing purchase via Mock Swap:', {
      poolId,
      poolAddress,
      factoryAddress: FACTORY_ADDRESS,
      userAddress,
      chainId
    })

    if (!privateKey) {
      return NextResponse.json({
        success: false,
        error: 'Private key required for smart account operations'
      })
    }

    if (poolId === undefined || !poolAddress) {
      return NextResponse.json({
        success: false,
        error: 'Pool ID and address are required'
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

    // Setup contracts
    const usdc = getContract({
      client,
      address: ARBITRUM_SEPOLIA_USDC,
      abi: tokenAbi,
    })

    const factory = getContract({
      client,
      address: FACTORY_ADDRESS,
      abi: factoryAbi,
    })

    const pool = getContract({
      client,
      address: poolAddress,
      abi: poolAbi,
    })

    console.log("💳 Executor account address:", account.address)

    // Verify pool state
    let totalContributed: bigint = BigInt(0)
    let targetTokenAddress: string = '0x0000000000000000000000000000000000000000'
    let targetTokenSymbol = 'UNKNOWN'

    try {
      const poolInfo = await pool.read.getPoolInfo()
      targetTokenAddress = await pool.read.targetToken()
      totalContributed = await pool.read.totalContributed()

      console.log("📊 Pool info:", {
        title: poolInfo[0],
        totalContributed: formatUnits(totalContributed, 6) + ' USDC',
        goalReached: poolInfo[6],
        executed: poolInfo[7],
        cancelled: poolInfo[8],
        targetToken: targetTokenAddress
      })

      // Check if pool can be executed
      if (poolInfo[7]) {
        return NextResponse.json({
          success: false,
          error: 'Pool has already been executed'
        })
      }

      if (poolInfo[8]) {
        return NextResponse.json({
          success: false,
          error: 'Pool has been cancelled'
        })
      }

      if (!poolInfo[6]) {
        return NextResponse.json({
          success: false,
          error: 'Pool goal has not been reached yet'
        })
      }

      // Get target token info and preview swap
      try {
        const targetToken = getContract({
          client,
          address: targetTokenAddress,
          abi: tokenAbi,
        })
        
        const [symbol, exchangeRate, previewAmount] = await Promise.all([
          targetToken.read.symbol().catch(() => 'MOCK'),
          factory.read.exchangeRates([targetTokenAddress]).catch(() => BigInt(0)),
          factory.read.previewSwap([targetTokenAddress, totalContributed]).catch(() => BigInt(0))
        ])
        
        targetTokenSymbol = symbol
        
        console.log("🎯 Target token:", {
          symbol: targetTokenSymbol,
          address: targetTokenAddress,
          exchangeRate: formatUnits(exchangeRate, 18),
          expectedTokens: formatUnits(previewAmount, 18)
        })

      } catch (error) {
        console.log("⚠️ Could not get target token info:", error)
        targetTokenSymbol = 'MOCK'
      }

    } catch (error) {
      console.error("❌ Error verifying pool:", error)
      return NextResponse.json({
        success: false,
        error: 'Unable to verify pool state',
        details: error instanceof Error ? error.message : 'Unknown error'
      })
    }

    // Check executor balance
    const balance = await usdc.read.balanceOf([account.address])
    console.log("💳 Executor USDC Balance:", formatUnits(balance, 6))
    
    if (balance < MAX_GAS_USDC) {
      return NextResponse.json({
        success: false,
        error: `Executor needs ${formatUnits(MAX_GAS_USDC, 6)} USDC for gas. Current: ${formatUnits(balance, 6)}`
      })
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

    // Call factory.executePoolSwap with Mock parameters (just poolId)
    const calls = [{
      to: factory.address,
      abi: factory.abi,
      functionName: 'executePoolSwap',
      args: [
        BigInt(poolId)
      ]
    }]

    console.log("🔄 Calling factory.executePoolSwap (Mock) with:")
    console.log("  poolId:", poolId)

    // EXACT same paymaster setup as working transfer
    const paymaster = ARBITRUM_SEPOLIA_PAYMASTER
    const paymasterData = encodePacked(
      ['uint8', 'address', 'uint256', 'bytes'],
      [
        0,
        usdc.address,
        MAX_GAS_USDC,
        permitSignature
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
    
    console.log("✅ Mock swap completed:", {
      hash: receipt.receipt.transactionHash,
      success: receipt.success,
      gasUsed: receipt.actualGasUsed.toString()
    })

    // Get final token amounts from the transaction logs
    let tokensReceived = "0"
    let exchangeRateUsed = "0"
    
    try {
      // Try to get swap details from preview again
      const previewAmount = await factory.read.previewSwap([targetTokenAddress, totalContributed])
      tokensReceived = formatUnits(previewAmount, 18)
      
      const exchangeRate = await factory.read.exchangeRates([targetTokenAddress])
      exchangeRateUsed = formatUnits(exchangeRate, 18)
    } catch (error) {
      console.log("Could not get final token amounts:", error)
    }
    
    return NextResponse.json({
      success: true,
      userOperationHash: userOpHash,
      transactionHash: receipt.receipt.transactionHash,
      executorAddress: account.address,
      poolId,
      poolAddress,
      factoryAddress: FACTORY_ADDRESS,
      usdcSwapped: formatUnits(totalContributed, 6),
      targetToken: targetTokenSymbol,
      targetTokenAddress,
      tokensReceived,
      exchangeRate: exchangeRateUsed,
      swapMethod: 'Mock Swap',
      message: `Pool executed via Mock Swap: ${formatUnits(totalContributed, 6)} USDC → ${tokensReceived} ${targetTokenSymbol}`,
      gasUsed: receipt.actualGasUsed.toString(),
      operationSuccess: receipt.success,
      explanation: "Mock swap minted tokens at predetermined exchange rate and distributed them to contributors proportionally"
    })

  } catch (error) {
    console.error('❌ Mock swap failed:', error)
    
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Mock swap failed',
      details: error instanceof Error ? error.stack : 'Unknown error'
    })
  }
}