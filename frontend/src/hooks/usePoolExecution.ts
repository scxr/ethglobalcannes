import { useState, useCallback } from 'react'
import { usePrivy } from '@privy-io/react-auth'
import { useChainId } from 'wagmi'

export function usePoolExecution() {
  const { user } = usePrivy()
  const chainId = useChainId()
  const [isExecuting, setIsExecuting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const executePoolPurchase = useCallback(async (
    poolId: string,
    poolAddress: string,
    onSuccess?: (txHash: string) => void
  ) => {
    if (!user?.wallet?.address) {
      setError('Wallet not connected')
      return
    }

    setIsExecuting(true)
    setError(null)

    try {
      const response = await fetch('/api/contracts/execute-purchase', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          poolId,
          poolAddress,
          userAddress: user.wallet.address,
          chainId
        })
      })

      const result = await response.json()

      if (!result.success) {
        throw new Error(result.error || 'Execution failed')
      }

      console.log('Pool execution successful:', result)
      onSuccess?.(result.transactionHash)

    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Execution failed'
      setError(errorMsg)
      throw err
    } finally {
      setIsExecuting(false)
    }
  }, [user, chainId])

  return {
    executePoolPurchase,
    isExecuting,
    error
  }
}
