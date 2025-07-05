import { createPublicClient, http, parseAbi, encodeFunctionData } from 'viem'
import { baseSepolia, arbitrumSepolia } from 'viem/chains'

export const TESTNET_USDC_ADDRESSES = {
  [baseSepolia.id]: '0x036CbD53842c5426634e7929541eC2318f3dCF7e',
  [arbitrumSepolia.id]: '0x75faf114eafb1BDbe2F0316DF893fd58CF46854E'
} as const

export const USDC_ABI = parseAbi([
  'function transfer(address to, uint256 amount) returns (bool)',
  'function balanceOf(address account) view returns (uint256)',
  'function decimals() view returns (uint8)'
])

export class SimplePaymaster {
  private chainId: number
  private publicClient: any

  constructor(chainId: number) {
    this.chainId = chainId
    const chain = chainId === baseSepolia.id ? baseSepolia : arbitrumSepolia
    this.publicClient = createPublicClient({
      chain,
      transport: http()
    })
  }

  async getUSDCBalance(address: string): Promise<string> {
    const usdcAddress = TESTNET_USDC_ADDRESSES[this.chainId as keyof typeof TESTNET_USDC_ADDRESSES]
    if (!usdcAddress) return '0'

    try {
      const balance = await this.publicClient.readContract({
        address: usdcAddress,
        abi: USDC_ABI,
        functionName: 'balanceOf',
        args: [address]
      })
      
      // Convert from 6 decimals to readable format
      return (Number(balance) / 1e6).toFixed(2)
    } catch (error) {
      console.error('Failed to get balance:', error)
      return '0'
    }
  }

  async sponsorUSDCTransfer(from: string, to: string, amount: string): Promise<string> {
    const usdcAddress = TESTNET_USDC_ADDRESSES[this.chainId as keyof typeof TESTNET_USDC_ADDRESSES]
    if (!usdcAddress) throw new Error('USDC not supported on this network')

    // Convert amount to proper decimals (USDC has 6 decimals)
    const amountWei = BigInt(Math.floor(parseFloat(amount) * 1e6))

    // Encode the transfer function call
    const transferData = encodeFunctionData({
      abi: USDC_ABI,
      functionName: 'transfer',
      args: [to as `0x${string}`, amountWei]
    })

    // Call our API to sponsor the transaction
    const response = await fetch('/api/paymaster/sponsor', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from,
        to: usdcAddress, // Contract address
        data: transferData,
        chainId: this.chainId,
        amount
      })
    })

    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.message || 'Failed to sponsor transaction')
    }

    const result = await response.json()
    return result.transactionHash
  }
}
