// app/api/contracts/contribute/route.ts
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
const MAX_GAS_USDC = BigInt(1000000) // 1 USDC for gas

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

const poolAbi = parseAbi([
  'function contribute(uint256 amount)',
  'function getPoolInfo() view returns (string title, string description, uint256 targetAmount, uint256 totalContributed, uint256 contributorCount, uint256 deadline, bool goalReached, bool executed, bool cancelled)',
  'function contributors(address) view returns (uint256 amount, bool exists)',
  'function targetAmount() view returns (uint256)',
  'function totalContributed() view returns (uint256)',
  'function deadline() view returns (uint256)',
  'function goalReached() view returns (bool)',
  'function executed() view returns (bool)',
  'function cancelled() view returns (bool)',
  'event ContributionMade(address indexed contributor, uint256 amount)',
  'event GoalReached(uint256 totalAmount)'
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
      poolAddress,
      amount,
      userAddress,
      chainId
    } = await request.json()

    const privateKey = process.env.PRIVATE_KEY

    console.log('Contributing to pool with paymaster:', {
      poolAddress,
      amount,
      userAddress,
      chainId
    })

    if (!privateKey) {
      return NextResponse.json({
        success: false,
        error: 'Private key required for smart account operations'
      })
    }

    if (!poolAddress || !amount) {
      return NextResponse.json({
        success: false,
        error: 'Pool address and amount are required'
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

    console.log("Account address:", account.address)

    // EXACT same contract verification as working transfer
    try {
      const name = await usdc.read.name()
      const symbol = await usdc.read.symbol()
      const decimals = await usdc.read.decimals()
      console.log("USDC Contract info:", { name, symbol, decimals })
    } catch (error) {
      console.error("Error reading USDC contract info:", error)
      return NextResponse.json({
        success: false,
        error: 'Unable to read USDC contract. Contract might be incorrect.',
        details: error instanceof Error ? error.message : 'Unknown error'
      })
    }

    // Setup pool contract
    const pool = getContract({
      client,
      address: poolAddress,
      abi: poolAbi,
    })

    // Verify pool exists and get info
    try {
      const poolInfo = await pool.read.getPoolInfo()
      console.log("Pool info:", {
        title: poolInfo[0],
        targetAmount: formatUnits(poolInfo[2], 6),
        totalContributed: formatUnits(poolInfo[3], 6),
        contributorCount: poolInfo[4].toString(),
        goalReached: poolInfo[6],
        executed: poolInfo[7],
        cancelled: poolInfo[8]
      })

      // Check if pool is still active
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

      if (poolInfo[6]) { // goalReached
        return NextResponse.json({
          success: false,
          error: 'Pool goal has already been reached'
        })
      }

      // Check if deadline passed
      const deadline = await pool.read.deadline()
      const now = Math.floor(Date.now() / 1000)
      if (Number(deadline) < now) {
        return NextResponse.json({
          success: false,
          error: 'Pool deadline has passed'
        })
      }

    } catch (error) {
      console.error("Error reading pool contract:", error)
      return NextResponse.json({
        success: false,
        error: 'Unable to read pool contract. Pool might not exist.',
        details: error instanceof Error ? error.message : 'Unknown error'
      })
    }

    // Convert contribution amount
    const contributionAmount = BigInt(amount) // Amount should be in USDC wei (6 decimals)
    const totalNeeded = contributionAmount + MAX_GAS_USDC // Need amount + gas

    // EXACT same balance check as working transfer
    const balance = await usdc.read.balanceOf([account.address])
    console.log("USDC Balance:", formatUnits(balance, 6))
    console.log("Need:", formatUnits(totalNeeded, 6), "USDC (", formatUnits(contributionAmount, 6), "contribution +", formatUnits(MAX_GAS_USDC, 6), "gas )")
    
    if (balance < totalNeeded) {
      return NextResponse.json({
        success: false,
        error: `Insufficient USDC balance. Have: ${formatUnits(balance, 6)}, Need: ${formatUnits(totalNeeded, 6)} (${formatUnits(contributionAmount, 6)} contribution + ${formatUnits(MAX_GAS_USDC, 6)} gas)`
      })
    }

    // Check current allowance to pool
    const poolAllowance = await usdc.read.allowance([account.address, poolAddress])
    console.log("Current pool allowance:", formatUnits(poolAllowance, 6), "USDC")

    // EXACT same permit construction as working transfer (for gas)
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

    // Two-step process: approve USDC to pool, then contribute
    const calls = [
      // Step 1: Approve USDC to pool contract for contribution
      {
        to: usdc.address,
        abi: usdc.abi,
        functionName: 'approve',
        args: [poolAddress, contributionAmount]
      },
      // Step 2: Contribute to pool
      {
        to: pool.address,
        abi: pool.abi,
        functionName: 'contribute',
        args: [contributionAmount]
      }
    ]

    console.log("Contribution calls:", calls.map(call => ({
      to: call.to,
      function: call.functionName,
      args: call.args
    })))

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
      accountAddress: account.address,
      poolAddress,
      contributionAmount: formatUnits(contributionAmount, 6),
      message: 'Contribution successful via Circle Paymaster on Arbitrum',
      gasUsed: receipt.actualGasUsed.toString(),
      operationSuccess: receipt.success
    })

  } catch (error) {
    console.error('Contribution failed:', error)
    
    // Better error handling
    let errorMessage = 'Contribution failed'
    if (error instanceof Error) {
      if (error.message.includes('AA33')) {
        errorMessage = 'Insufficient USDC allowance for paymaster'
      } else if (error.message.includes('AA23')) {
        errorMessage = 'Paymaster validation failed'
      } else if (error.message.includes('Max contributors reached')) {
        errorMessage = 'Pool has reached maximum contributors'
      } else if (error.message.includes('Would exceed target')) {
        errorMessage = 'Contribution would exceed pool target'
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