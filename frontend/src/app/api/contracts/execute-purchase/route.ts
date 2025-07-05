import { NextRequest, NextResponse } from 'next/server'
import { createPublicClient, http, getContract, encodeFunctionData, encodePacked, parseAbi, parseErc6492Signature, formatUnits, hexToBigInt } from 'viem'
import { createBundlerClient } from 'viem/account-abstraction'
import { arbitrumSepolia } from 'viem/chains'
import { toEcdsaKernelSmartAccount } from 'permissionless/accounts'
import { privateKeyToAccount } from 'viem/accounts'

// SAME as working transfer & pool creation
const ARBITRUM_SEPOLIA_USDC = '0x75faf114eafb1BDbe2F0316DF893fd58CE46AA4d'
const ARBITRUM_SEPOLIA_PAYMASTER = '0x31BE08D380A21fc740883c0BC434FcFc88740b58'
const ARBITRUM_SEPOLIA_BUNDLER = `https://public.pimlico.io/v2/${arbitrumSepolia.id}/rpc`
const MAX_GAS_USDC = BigInt(2000000) // 2 USDC for gas (swap might need more)

// 1inch API configuration
const ONEINCH_API_BASE = 'https://api.1inch.dev'
const ONEINCH_API_KEY = process.env.ONEINCH_API_KEY // Get from 1inch developer portal
const ARBITRUM_SEPOLIA_CHAIN_ID = 421614

// Token addresses on Arbitrum Sepolia
const TOKEN_ADDRESSES = {
  'USDC': '0x75faf114eafb1BDbe2F0316DF893fd58CE46AA4d',
  'ETH': '0x0000000000000000000000000000000000000000', // Native ETH
  'WETH': '0x980B62Da83eFf3D4576C647993b0c1D7faf17c73', // Wrapped ETH on Arbitrum Sepolia
  'LINK': '0xb1D4538B4571d411F07960EF2838Ce337FE1E80E', // LINK on Arbitrum Sepolia
  'AAVE': '0x...', // Add other tokens as needed
}

const tokenAbi = parseAbi([
  'function balanceOf(address account) view returns (uint256)',
  'function transfer(address to, uint256 amount) returns (bool)',
  'function permit(address owner, address spender, uint256 value, uint256 deadline, uint8 v, bytes32 r, bytes32 s)',
  'function nonces(address owner) view returns (uint256)',
  'function name() view returns (string)',
  'function version() view returns (string)',
  'function approve(address spender, uint256 amount) returns (bool)'
])

const poolAbi = parseAbi([
  'function getPoolInfo() view returns (string title, string description, uint256 targetAmount, uint256 totalContributed, uint256 contributorCount, uint256 deadline, bool goalReached, bool executed, bool cancelled)',
  'function targetToken() view returns (address)',
  'function totalContributed() view returns (uint256)',
  'function goalReached() view returns (bool)',
  'function executed() view returns (bool)',
  'function executeSwap(bytes calldata swapData)',
  'function getContributors() view returns (address[], uint256[])',
  'event PoolExecuted(address indexed targetToken, uint256 amountSwapped)'
])

const factoryAbi = parseAbi([
  'function executePoolSwap(uint256 poolId, bytes calldata oneInchSwapData)',
  'event SwapExecuted(uint256 indexed poolId, address indexed targetToken, uint256 usdcAmount, uint256 tokensReceived)'
])

// Get 1inch swap data
async function get1inchSwapData(
  fromToken: string,
  toToken: string,
  amount: string,
  fromAddress: string,
  slippage: number = 1
) {
  if (!ONEINCH_API_KEY) {
    throw new Error('1inch API key not configured')
  }

  try {
    // First, get quote to check if swap is possible
    const quoteUrl = `${ONEINCH_API_BASE}/swap/v6.0/${ARBITRUM_SEPOLIA_CHAIN_ID}/quote`
    const quoteParams = new URLSearchParams({
      src: fromToken,
      dst: toToken,
      amount: amount
    })

    const quoteResponse = await fetch(`${quoteUrl}?${quoteParams}`, {
      headers: {
        'Authorization': `Bearer ${ONEINCH_API_KEY}`,
        'accept': 'application/json'
      }
    })

    if (!quoteResponse.ok) {
      throw new Error(`1inch quote failed: ${quoteResponse.statusText}`)
    }

    const quote = await quoteResponse.json()
    console.log('1inch quote:', quote)

    // Get actual swap transaction data
    const swapUrl = `${ONEINCH_API_BASE}/swap/v6.0/${ARBITRUM_SEPOLIA_CHAIN_ID}/swap`
    const swapParams = new URLSearchParams({
      src: fromToken,
      dst: toToken,
      amount: amount,
      from: fromAddress,
      slippage: slippage.toString(),
      disableEstimate: 'true'
    })

    const swapResponse = await fetch(`${swapUrl}?${swapParams}`, {
      headers: {
        'Authorization': `Bearer ${ONEINCH_API_KEY}`,
        'accept': 'application/json'
      }
    })

    if (!swapResponse.ok) {
      throw new Error(`1inch swap failed: ${swapResponse.statusText}`)
    }

    const swap = await swapResponse.json()
    console.log('1inch swap data:', swap)

    return {
      toAmount: swap.toAmount,
      tx: swap.tx
    }

  } catch (error) {
    console.error('1inch API error:', error)
    throw error
  }
}

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

    console.log('Executing purchase for pool:', {
      poolId,
      poolAddress,
      userAddress,
      chainId
    })

    if (!privateKey) {
      return NextResponse.json({
        success: false,
        error: 'Private key required for smart account operations'
      })
    }

    if (!poolAddress) {
      return NextResponse.json({
        success: false,
        error: 'Pool address is required'
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

    const pool = getContract({
      client,
      address: poolAddress,
      abi: poolAbi,
    })

    console.log("Executor account address:", account.address)

    // Verify pool state
    try {
      const poolInfo = await pool.read.getPoolInfo()
      const targetTokenAddress = await pool.read.targetToken()
      const totalContributed = await pool.read.totalContributed()

      console.log("Pool info:", {
        title: poolInfo[0],
        totalContributed: formatUnits(totalContributed, 6),
        goalReached: poolInfo[6],
        executed: poolInfo[7],
        cancelled: poolInfo[8],
        targetToken: targetTokenAddress
      })

      // Check if pool can be executed
      if (poolInfo[7]) { // executed
        return NextResponse.json({
          success: false,
          error: 'Pool has already been executed'
        })
      }

      if (poolInfo[8]) { // cancelled
        return NextResponse.json({
          success: false,
          error: 'Pool has been cancelled'
        })
      }

      if (!poolInfo[6]) { // goalReached
        return NextResponse.json({
          success: false,
          error: 'Pool goal has not been reached yet'
        })
      }

      // Determine target token symbol
      let targetTokenSymbol = 'ETH'
      if (targetTokenAddress === ARBITRUM_SEPOLIA_USDC) {
        return NextResponse.json({
          success: false,
          error: 'Cannot swap USDC to USDC'
        })
      }

      // Find target token symbol
      for (const [symbol, address] of Object.entries(TOKEN_ADDRESSES)) {
        if (address.toLowerCase() === targetTokenAddress.toLowerCase()) {
          targetTokenSymbol = symbol
          break
        }
      }

      console.log("Target token:", targetTokenSymbol, targetTokenAddress)
      console.log("Amount to swap:", formatUnits(totalContributed, 6), "USDC")

      // Get 1inch swap data
      const swapData = await get1inchSwapData(
        ARBITRUM_SEPOLIA_USDC, // from USDC
        targetTokenAddress === '0x0000000000000000000000000000000000000000' 
          ? TOKEN_ADDRESSES.WETH // Use WETH for ETH swaps
          : targetTokenAddress, // to target token
        totalContributed.toString(), // amount in wei
        account.address, // from address (our executor account)
        2 // 2% slippage
      )

      console.log("1inch swap data obtained:", {
        expectedOutput: formatUnits(swapData.toAmount, 18), // Most tokens have 18 decimals
        txData: swapData.tx.data.slice(0, 20) + "..."
      })

    } catch (error) {
      console.error("Error verifying pool or getting swap data:", error)
      return NextResponse.json({
        success: false,
        error: 'Unable to verify pool state or get swap data',
        details: error instanceof Error ? error.message : 'Unknown error'
      })
    }

    // Check executor has enough USDC for gas
    const balance = await usdc.read.balanceOf([account.address])
    console.log("Executor USDC Balance:", formatUnits(balance, 6))
    
    if (balance < MAX_GAS_USDC) {
      return NextResponse.json({
        success: false,
        error: `Executor needs ${formatUnits(MAX_GAS_USDC, 6)} USDC for gas. Current balance: ${formatUnits(balance, 6)}`
      })
    }

    // Get fresh swap data for execution
    const totalContributed = await pool.read.totalContributed()
    const targetTokenAddress = await pool.read.targetToken()
    
    const finalSwapData = await get1inchSwapData(
      ARBITRUM_SEPOLIA_USDC,
      targetTokenAddress === '0x0000000000000000000000000000000000000000' 
        ? TOKEN_ADDRESSES.WETH 
        : targetTokenAddress,
      totalContributed.toString(),
      account.address,
      2
    )

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

    // Execute the pool swap
    const calls = [{
      to: pool.address,
      abi: pool.abi,
      functionName: 'executeSwap',
      args: [finalSwapData.tx.data] // Pass 1inch transaction data
    }]

    console.log("Executing swap with 1inch data...")

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

    // EXACT same receipt handling as working transfer
    const receipt = await bundlerClient.waitForUserOperationReceipt({
      hash: userOpHash
    })
    
    return NextResponse.json({
      success: true,
      userOperationHash: userOpHash,
      transactionHash: receipt.receipt.transactionHash,
      executorAddress: account.address,
      poolAddress,
      usdcSwapped: formatUnits(totalContributed, 6),
      expectedTokens: formatUnits(finalSwapData.toAmount, 18),
      message: 'Pool purchase executed successfully via 1inch + Circle Paymaster',
      gasUsed: receipt.actualGasUsed.toString(),
      operationSuccess: receipt.success
    })

  } catch (error) {
    console.error('Pool execution failed:', error)
    
    // Better error handling
    let errorMessage = 'Pool execution failed'
    if (error instanceof Error) {
      if (error.message.includes('1inch')) {
        errorMessage = '1inch swap failed: ' + error.message
      } else if (error.message.includes('AA33')) {
        errorMessage = 'Insufficient USDC allowance for paymaster'
      } else if (error.message.includes('AA23')) {
        errorMessage = 'Paymaster validation failed'
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