'use client'

import { useState } from 'react'
import { usePrivy } from '@privy-io/react-auth'
import { parseEther, formatUnits } from 'viem'

export default function CirclePaymasterDemo() {
  const { user, authenticated } = usePrivy()
  const [recipient, setRecipient] = useState('')
  const [amount, setAmount] = useState('')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<any>(null)
  const [error, setError] = useState('')

  const handleTransfer = async () => {
    if (!authenticated || !user?.wallet?.address) {
      setError('Please connect your wallet first')
      return
    }

    if (!recipient || !amount) {
      setError('Please fill in all fields')
      return
    }

    setLoading(true)
    setError('')
    setResult(null)

    try {
      // Convert amount to USDC units (6 decimals)
      const amountInUsdc = BigInt(parseFloat(amount) * 1000000)

      const response = await fetch('/api/paymaster/sponsor', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: user.wallet.address,
          to: recipient,
          amount: amountInUsdc.toString(),
          chainId: 84532, // Base Sepolia
          privateKey: process.env.NEXT_PUBLIC_DEMO_PRIVATE_KEY || '0x' + '0'.repeat(64) // Demo key
        }),
      })

      const data = await response.json()
      
      if (data.success) {
        setResult(data)
      } else {
        setError(data.error || 'Transaction failed')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error occurred')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="max-w-2xl mx-auto p-6 bg-white rounded-lg shadow-lg">
      <h2 className="text-2xl font-bold mb-6 text-center">Circle Paymaster Demo</h2>
      
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Recipient Address
          </label>
          <input
            type="text"
            value={recipient}
            onChange={(e) => setRecipient(e.target.value)}
            placeholder="0x..."
            className="w-full p-3 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
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
            placeholder="0.0"
            step="0.000001"
            className="w-full p-3 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>

        <button
          onClick={handleTransfer}
          disabled={loading || !authenticated}
          className="w-full bg-blue-600 text-white py-3 px-4 rounded-md hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
        >
          {loading ? 'Processing...' : 'Transfer with Circle Paymaster'}
        </button>

        {!authenticated && (
          <p className="text-center text-gray-600">
            Please connect your wallet to use the paymaster
          </p>
        )}

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-md p-4">
            <p className="text-red-800">{error}</p>
          </div>
        )}

        {result && (
          <div className="bg-green-50 border border-green-200 rounded-md p-4">
            <h3 className="font-semibold text-green-800 mb-2">Transaction Successful!</h3>
            <div className="text-sm text-green-700 space-y-1">
              <p><strong>User Operation Hash:</strong> {result.userOperationHash}</p>
              <p><strong>Transaction Hash:</strong> {result.transactionHash}</p>
              <p><strong>Smart Account:</strong> {result.accountAddress}</p>
              <p><strong>Gas Used:</strong> {result.gasUsed}</p>
              <p><strong>Status:</strong> {result.operationSuccess ? 'Success' : 'Failed'}</p>
              <p><strong>Message:</strong> {result.message}</p>
            </div>
          </div>
        )}
      </div>

      <div className="mt-8 p-4 bg-gray-50 rounded-md">
        <h3 className="font-semibold mb-2">How it works:</h3>
        <ul className="text-sm text-gray-600 space-y-1">
          <li>• Creates a smart account using your wallet as the owner</li>
          <li>• Signs an EIP-2612 permit to authorize Circle Paymaster to spend USDC</li>
          <li>• Submits the transaction through a bundler with gas sponsored by Circle</li>
          <li>• You pay gas fees in USDC instead of ETH</li>
        </ul>
      </div>
    </div>
  )
} 