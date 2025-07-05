import { useState, useCallback } from 'react'
import { usePrivy } from '@privy-io/react-auth'
import { useChainId } from 'wagmi'
import { baseSepolia, arbitrumSepolia } from 'viem/chains'
import { SimplePaymaster } from '@/lib/circle-paymaster'

export function useSimplePaymaster() {
  const { user } = usePrivy()
  const chainId = useChainId()
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [balance, setBalance] = useState<string>('0')

  const isSupported = chainId === baseSepolia.id || chainId === arbitrumSepolia.id
  const paymaster = new SimplePaymaster(chainId)

  const checkBalance = useCallback(async () => {
    if (!user?.wallet?.address) return
    
    try {
      const bal = await paymaster.getUSDCBalance(user.wallet.address)
      console.log("Balance on chain" + chainId +": ", bal)
      setBalance(bal) 
    } catch (err) {
      console.error('Failed to check balance:', err)
    }
  }, [user, paymaster])

  const sponsorTransfer = useCallback(async (
    to: string,
    amount: string,
    onSuccess?: (txHash: string) => void
  ) => {
    if (!user?.wallet?.address || !isSupported) {
      setError('Wallet not connected or unsupported network')
      return
    }

    setIsLoading(true)
    setError(null)

    try {
      // Check balance first
      const currentBalance = parseFloat(await paymaster.getUSDCBalance(user.wallet.address))
      const transferAmount = parseFloat(amount)
      
      if (currentBalance < transferAmount) {
        throw new Error(`Insufficient balance: ${currentBalance} USDC`)
      }

      // Sponsor the transfer
      const txHash = await paymaster.sponsorUSDCTransfer(
        user.wallet.address,
        to,
        amount
      )

      // Update balance
      await checkBalance()
      
      onSuccess?.(txHash)
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Transfer failed'
      setError(errorMsg)
    } finally {
      setIsLoading(false)
    }
  }, [user, paymaster, isSupported, checkBalance])

  return {
    sponsorTransfer,
    checkBalance,
    isLoading,
    error,
    balance,
    isSupported,
    networkName: chainId === baseSepolia.id ? 'Base Sepolia' : 'Arbitrum Sepolia',
    chainId
  }
}
