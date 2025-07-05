import { NextRequest, NextResponse } from 'next/server'
import { createPublicClient, http, getContract, encodeFunctionData, encodePacked, parseAbi, parseErc6492Signature, formatUnits, hexToBigInt, parseUnits } from 'viem'
import { createBundlerClient } from 'viem/account-abstraction'
import { arbitrumSepolia } from 'viem/chains'
import { toEcdsaKernelSmartAccount } from 'permissionless/accounts'
import { privateKeyToAccount } from 'viem/accounts'

// Arbitrum Sepolia USDC contract address - try alternative if the main one fails
const ARBITRUM_SEPOLIA_USDC = '0x75faf114eafb1BDbe2F0316DF893fd58CE46AA4d'
// Alternative USDC contracts to try if the main one fails:
// const ARBITRUM_SEPOLIA_USDC = '0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238' // Ethereum Sepolia USDC (sometimes works cross-chain)
// const ARBITRUM_SEPOLIA_USDC = '0xbc47901f4d2c5fc871ae0037ea05c3f614690781' // Another USDC on Arbitrum Sepolia
// Circle Paymaster contract address for Arbitrum Sepolia
const ARBITRUM_SEPOLIA_PAYMASTER = '0x31BE08D380A21fc740883c0BC434FcFc88740b58'
// Pimlico bundler for Arbitrum Sepolia
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

// EIP-2612 permit helper function
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
    let { from, to, data, chainId, amount } = await request.json()
    const privateKey = process.env.PRIVATE_KEY

    console.log('Sponsoring transaction:', { from, to, amount, chainId })

    if (!privateKey) {
      return NextResponse.json({
        success: false,
        error: 'Private key required for smart account operations'
      })
    }

    // Create clients with specific RPC URL for better reliability
    const client = createPublicClient({
      chain: arbitrumSepolia,
      transport: http('https://sepolia-rollup.arbitrum.io/rpc') // Official Arbitrum Sepolia RPC
    })

    const bundlerClient = createBundlerClient({
      client,
      transport: http(ARBITRUM_SEPOLIA_BUNDLER)
    })

    // Create accounts
    const owner = privateKeyToAccount(privateKey as `0x${string}`)
    const account = await toEcdsaKernelSmartAccount({
      client,
      owners: [owner],
      version: '0.3.1'
    })

    // Setup USDC contract
    const usdc = getContract({
      client,
      address: ARBITRUM_SEPOLIA_USDC,
      abi: tokenAbi,
    })

    // Verify USDC balance first
    console.log("Account address:", account.address)
    console.log("Account pk:", privateKey)

    // First test if we can read basic contract info
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

    const balance = await usdc.read.balanceOf([account.address])
    console.log("Balance: ", balance)
    const amountInWei = BigInt(amount.toString())
    
    if (balance < amountInWei) {
      return NextResponse.json({
        success: false,
        error: `Insufficient USDC balance. Have: ${formatUnits(balance, 6)}, Need: ${formatUnits(amountInWei, 6)}`
      })
    }

    // Construct and sign permit
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

    // Prepare transfer calls using the new format
    const calls = [{
      to: usdc.address,
      abi: usdc.abi,
      functionName: 'transfer',
      args: [to, amountInWei]
    }]

    // Specify the USDC Token Paymaster with proper data encoding
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

    // Get additional gas charge from paymaster
    const callResult = await client.call({
      to: paymaster,
      data: encodeFunctionData({
        abi: parseAbi(['function additionalGasCharge() returns (uint256)']),
        functionName: 'additionalGasCharge'
      })
    })
    const additionalGasCharge = hexToBigInt(callResult?.data ?? '0x0')

    // Get current gas prices
    const { standard: fees } = await bundlerClient.request({
      method: 'pimlico_getUserOperationGasPrice' as any
    }) as { standard: { maxFeePerGas: `0x${string}`, maxPriorityFeePerGas: `0x${string}` } }

    const maxFeePerGas = hexToBigInt(fees.maxFeePerGas)
    const maxPriorityFeePerGas = hexToBigInt(fees.maxPriorityFeePerGas)

    // Estimate gas limits
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

    // Send user operation with updated parameters
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

    // Wait for transaction receipt
    const receipt = await bundlerClient.waitForUserOperationReceipt({
      hash: userOpHash
    })
    
    return NextResponse.json({
      success: true,
      userOperationHash: userOpHash,
      transactionHash: receipt.receipt.transactionHash,
      accountAddress: account.address,
      message: 'Transaction submitted via Circle Paymaster on Arbitrum',
      gasUsed: receipt.actualGasUsed.toString(),
      operationSuccess: receipt.success
    })

  } catch (error) {
    console.error('Paymaster error:', error)
    
    return NextResponse.json({
      success: false,
      error: 'Paymaster error',
      details: error instanceof Error ? error.message : 'Unknown error'
    })
  }
}