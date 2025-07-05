import { useState, useCallback } from 'react'
import { usePrivy } from '@privy-io/react-auth'
import { useChainId } from 'wagmi'
import { ChipInContracts, PoolData } from '@/lib/abis'

export function useChipInContracts() {
  const { user } = usePrivy()
  const chainId = useChainId()
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const contracts = new ChipInContracts(chainId)

  const createPool = useCallback(async (params: {
    title: string
    description: string
    targetAmount: string
    targetToken: string
    deadline: Date
    maxContributors: number
  }) => {
    if (!user?.wallet?.address) throw new Error('Wallet not connected')
    
    setIsLoading(true)
    setError(null)

    try {
      const poolAddress = await contracts.createPool({
        ...params,
        userAddress: user.wallet.address
      })
      
      return poolAddress
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Failed to create pool'
      setError(errorMsg)
      throw err
    } finally {
      setIsLoading(false)
    }
  }, [user, contracts])

  const contributeToPool = useCallback(async (poolAddress: string, amount: string) => {
    if (!user?.wallet?.address) throw new Error('Wallet not connected')
    
    setIsLoading(true)
    setError(null)

    try {
      // First approve USDC spending
      await contracts.approveUSDC(poolAddress, amount, user.wallet.address)
      
      // Then contribute
      const txHash = await contracts.contributeToPool(poolAddress, amount, user.wallet.address)
      
      return txHash
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Failed to contribute'
      setError(errorMsg)
      throw err
    } finally {
      setIsLoading(false)
    }
  }, [user, contracts])

  const getPool = useCallback(async (poolId: string): Promise<PoolData | null> => {
    try {
      return await contracts.getPool(poolId)
    } catch (err) {
      console.error('Failed to get pool:', err)
      return null
    }
  }, [contracts])

  const getUserPools = useCallback(async (): Promise<string[]> => {
    if (!user?.wallet?.address) return []
    
    try {
      return await contracts.getUserPools(user.wallet.address)
    } catch (err) {
      console.error('Failed to get user pools:', err)
      return []
    }
  }, [user, contracts])

  const getUSDCBalance = useCallback(async (): Promise<string> => {
    if (!user?.wallet?.address) return '0'
    
    try {
      return await contracts.getUSDCBalance(user.wallet.address)
    } catch (err) {
      console.error('Failed to get USDC balance:', err)
      return '0'
    }
  }, [user, contracts])

  return {
    createPool,
    contributeToPool,
    getPool,
    getUserPools,
    getUSDCBalance,
    isLoading,
    error
  }
}