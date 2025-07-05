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
const MAX_GAS_USDC = BigInt(1000000) // 1 USDC for gas

// Add your deployed factory address here
const FACTORY_ADDRESS = '0x1f74ab8847339D7f91D049da75ceEB0f21E87827'

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

const factoryAbi = parseAbi([
  'function createPool(string title, string description, uint256 targetAmount, address targetToken, uint256 deadline, uint256 maxContributors) returns (address)',
  'function poolCount() view returns (uint256)',
  'event PoolCreated(uint256 indexed poolId, address indexed poolAddress, address indexed creator, string title, uint256 targetAmount, address targetToken)'
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
      chainId
    } = await request.json()

    const privateKey = process.env.PRIVATE_KEY

    console.log('Creating pool with paymaster:', {
      title,
      description,
      targetAmount,
      targetToken,
      deadline,
      maxContributors,
      userAddress,
      chainId
    })

    if (!privateKey) {
      return NextResponse.json({
        success: false,
        error: 'Private key required for smart account operations'
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
      console.log("Contract info:", { name, symbol, decimals })
    } catch (error) {
      console.error("Error reading contract info:", error)
      return NextResponse.json({
        success: false,
        error: 'Unable to read USDC contract. Contract might be incorrect.',
        details: error instanceof Error ? error.message : 'Unknown error'
      })
    }

    // EXACT same balance check as working transfer
    const balance = await usdc.read.balanceOf([account.address])
    console.log("Balance:", formatUnits(balance, 6), "USDC")
    
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
    try {
      const poolCount = await factory.read.poolCount()
      console.log("Current pool count:", poolCount.toString())
    } catch (error) {
      console.error("Error reading factory:", error)
      return NextResponse.json({
        success: false,
        error: 'Factory contract not found. Please deploy the factory first.',
        details: error instanceof Error ? error.message : 'Unknown error'
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

    // Pool creation call (only difference from transfer)
    const calls = [{
      to: factory.address,
      abi: factory.abi,
      functionName: 'createPool',
      args: [
        title,
        description,
        BigInt(targetAmount), // Target amount in USDC wei (6 decimals)
        ARBITRUM_SEPOLIA_USDC, // Default to USDC if no target token
        BigInt(deadline), // Unix timestamp
        BigInt(maxContributors)
      ]
    }]

    console.log("Factory call args:", calls[0].args)

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
    
    // Try to extract pool address from logs
    let poolAddress = 'Check transaction logs'
    try {
      // Look for PoolCreated event in logs
      const poolCreatedTopic = '0x...' // You'll need to calculate this topic hash
      // Or just parse the receipt logs to find the pool address
    } catch (e) {
      console.log("Could not extract pool address from logs")
    }
    
    return NextResponse.json({
      success: true,
      userOperationHash: userOpHash,
      transactionHash: receipt.receipt.transactionHash,
      accountAddress: account.address,
      poolAddress,
      message: 'Pool created successfully via Circle Paymaster on Arbitrum',
      gasUsed: receipt.actualGasUsed.toString(),
      operationSuccess: receipt.success
    })

  } catch (error) {
    console.error('Pool creation failed:', error)
    
    // Better error handling
    let errorMessage = 'Pool creation failed'
    if (error instanceof Error) {
      if (error.message.includes('AA33')) {
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