'use client'

import { useState, useEffect } from 'react'
import { usePrivy } from '@privy-io/react-auth'
import { useSwitchChain } from 'wagmi'
import { Shield, Send, RefreshCw } from 'lucide-react'
import { useSimplePaymaster } from '@/hooks/useCirclePaymaster'
import { baseSepolia } from 'viem/chains'

export function PaymasterDemo() {
  const { authenticated, user } = usePrivy()
  const { switchChain } = useSwitchChain()
  const { 
    sponsorTransfer, 
    checkBalance, 
    isLoading, 
    error, 
    balance, 
    isSupported,
    networkName,
    chainId
  } = useSimplePaymaster()
  
  const [recipient, setRecipient] = useState('')
  const [amount, setAmount] = useState('')
  const [isSwitching, setIsSwitching] = useState(false)
  const [switchError, setSwitchError] = useState('')

  useEffect(() => {
    if (authenticated && isSupported) {
      checkBalance()
    }
  }, [authenticated, isSupported, checkBalance])

  // Handle network switching with proper error handling and timeout
  const handleSwitchToBaseSepolia = async () => {
    if (isSwitching) return // Prevent multiple simultaneous switches
    
    setIsSwitching(true)
    setSwitchError('')
    
    try {
      console.log('Switching to Base Sepolia...')
      
      // Add a timeout to prevent indefinite switching
      console.log("Current chainid: ", chainId)
      const switchPromise = switchChain({ chainId: baseSepolia.id })
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Switch network timeout')), 10000)
      )
      
      await Promise.race([switchPromise, timeoutPromise])
      
      console.log('Network switch completed')
      
    } catch (error) {
      console.error('Failed to switch network:', error)
      setSwitchError(error instanceof Error ? error.message : 'Failed to switch network')
    } finally {
      // Reset switching state after a delay to allow network to settle
      setTimeout(() => {
        setIsSwitching(false)
      }, 2000)
    }
  }

  const handleTransfer = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!recipient || !amount) return

    await sponsorTransfer(recipient, amount, (txHash) => {
      alert(`Transfer successful! TX: ${txHash}`)
      setRecipient('')
      setAmount('')
    })
  }

  if (!authenticated) {
    return (
      <div className="card p-6 text-center">
        <p>Connect wallet to test gas-free transfers</p>
      </div>
    )
  }

  if (!isSupported) {
    return (
      <div className="card p-6 text-center">
        <p className="mb-4">Current network: {networkName}</p>
        <p className="mb-4">This network is not supported by the paymaster.</p>
        
        {switchError && (
          <div className="bg-red-50 border-red-200 rounded-lg p-3 mb-4 border">
            <p className="text-sm text-red-600">{switchError}</p>
          </div>
        )}
        
        <div className="space-y-2">
          <button
            onClick={handleSwitchToBaseSepolia}
            disabled={isSwitching}
            className="btn btn-primary"
          >
            {isSwitching ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border border-white border-t-transparent mr-2"></div>
                Switching...
              </>
            ) : (
              'Switch to Base Sepolia'
            )}
          </button>
          
          {isSwitching && (
            <p className="text-sm text-gray-600">
              This may take a few seconds. Please check your wallet for prompts.
            </p>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className="card p-6">
      <div className="flex items-center space-x-2 mb-4">
        <Shield className="h-5 w-5 text-blue-600" />
        <h3 className="text-lg font-semibold">Gas-Free USDC Transfer</h3>
      </div>

      <div className="bg-green-50 border-green-200 rounded-lg p-3 mb-4 border">
        <div className="flex justify-between items-center">
          <span className="text-sm text-green-600">
            Balance: {balance} USDC on {networkName}
          </span>
          <button
            onClick={checkBalance}
            className="text-green-600 hover:text-green-700"
            disabled={isLoading}
          >
            <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {parseFloat(balance) === 0 && (
        <div className="bg-yellow-50 border-yellow-200 rounded-lg p-3 mb-4 border">
          <p className="text-sm text-yellow-600">
            Need testnet USDC? Get some from: <br />
            <a 
              href="https://faucet.circle.com/" 
              target="_blank" 
              className="underline"
            >
              Circle Faucet\nYour address: {user?.wallet?.address}      
            </a>
          </p>
        </div>
      )}

      <form onSubmit={handleTransfer} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Recipient Address
          </label>
          <input
            type="text"
            value={recipient}
            onChange={(e) => setRecipient(e.target.value)}
            placeholder="0x..."
            className="form-input"
            required
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Amount (USDC)
          </label>
          <input
            type="number"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="10"
            step="0.01"
            min="0"
            max={balance}
            className="form-input"
            required
          />
        </div>

        {error && (
          <div className="bg-red-50 border-red-200 rounded-lg p-3 border">
            <p className="text-sm text-red-600">{error}</p>
          </div>
        )}

        <button
          type="submit"
          disabled={isLoading || parseFloat(balance) === 0}
          className="btn btn-primary w-full"
        >
          {isLoading ? (
            <>
              <div className="animate-spin rounded-full h-4 w-4 border border-white border-t-transparent"></div>
              Sponsoring Transfer...
            </>
          ) : (
            <>
              <Send className="h-4 w-4" />
              Send USDC (Gas-Free)
            </>
          )}
        </button>
      </form>

      <p className="text-xs text-gray-500 mt-3 text-center">
        Powered by Circle Paymaster - No gas fees required!
      </p>
    </div>
  )
}