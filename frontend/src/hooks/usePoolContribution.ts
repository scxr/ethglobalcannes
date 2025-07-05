import { useState, useCallback } from 'react'
import { usePrivy } from '@privy-io/react-auth'
import { useChainId } from 'wagmi'

export function usePoolContribution() {
  const { user } = usePrivy()
  const chainId = useChainId()
  const [isContributing, setIsContributing] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const contributeToPool = useCallback(async (
    poolAddress: string,
    amount: string, // Amount in USDC (e.g., "10.50")
    onSuccess?: (txHash: string) => void
  ) => {
    if (!user?.wallet?.address) {
      setError('Wallet not connected')
      return
    }

    setIsContributing(true)
    setError(null)

    try {
      // Convert amount to wei (6 decimals for USDC)
      const amountWei = BigInt(Math.floor(parseFloat(amount) * 1e6))

      const response = await fetch('/api/contracts/contribute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          poolAddress,
          amount: amountWei.toString(),
          userAddress: user.wallet.address,
          chainId
        })
      })

      const result = await response.json()

      if (!result.success) {
        throw new Error(result.error || 'Contribution failed')
      }

      console.log('Contribution successful:', result)
      onSuccess?.(result.transactionHash)

    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Contribution failed'
      setError(errorMsg)
      throw err
    } finally {
      setIsContributing(false)
    }
  }, [user, chainId])

  return {
    contributeToPool,
    isContributing,
    error
  }
}