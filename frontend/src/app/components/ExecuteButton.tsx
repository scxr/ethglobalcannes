'use client'

import { useState } from 'react'
import { Zap, Loader2, ExternalLink } from 'lucide-react'
import { usePoolExecution } from '@/hooks/usePoolExecution'

interface ExecuteButtonProps {
  poolId: string
  poolAddress: string
  targetToken: string
  usdcAmount: number
  onSuccess?: () => void
}

export function ExecuteButton({ 
  poolId, 
  poolAddress, 
  targetToken, 
  usdcAmount,
  onSuccess 
}: ExecuteButtonProps) {
  const { executePoolPurchase, isExecuting, error } = usePoolExecution()
  const [txHash, setTxHash] = useState<string | null>(null)

  const handleExecute = async () => {
    try {
      await executePoolPurchase(poolId, poolAddress, (hash) => {
        setTxHash(hash)
        onSuccess?.()
      })
    } catch (error) {
      console.error('Execution failed:', error)
    }
  }

  if (txHash) {
    return (
      <div className="p-6 bg-green-50 border-green-200 rounded-lg text-center border">
        <div className="text-green-600 text-4xl mb-2">🎉</div>
        <h4 className="text-lg font-semibold text-green-600 mb-2">Purchase Executed!</h4>
        <p className="text-green-700 mb-4">
          Successfully swapped ${usdcAmount} USDC for {targetToken} via 1inch
        </p>
        <a 
          href={`https://sepolia.arbiscan.io/tx/${txHash}`}
          target="_blank"
          rel="noopener noreferrer"
          className="btn btn-secondary"
        >
          <ExternalLink className="h-4 w-4" />
          View Transaction
        </a>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {error && (
        <div className="bg-red-50 border-red-200 rounded-lg p-3 border">
          <p className="text-sm text-red-600">{error}</p>
        </div>
      )}

      <div className="bg-purple-50 border-purple-200 rounded-lg p-4 border">
        <h4 className="font-medium text-purple-600 mb-2">🔄 Execute Purchase</h4>
        <p className="text-sm text-purple-700 mb-3">
          This will swap ${usdcAmount} USDC for {targetToken} using 1inch and distribute tokens proportionally to contributors.
        </p>
        <ul className="text-xs text-purple-600 space-y-1">
          <li>• Gas fees sponsored by Circle Paymaster</li>
          <li>• Best rates via 1inch aggregator</li>
          <li>• Tokens distributed automatically</li>
        </ul>
      </div>

      <button
        onClick={handleExecute}
        disabled={isExecuting}
        className="btn btn-primary w-full"
        style={{
          background: 'linear-gradient(45deg, #8b5cf6, #a855f7)',
          opacity: isExecuting ? 0.6 : 1,
          cursor: isExecuting ? 'not-allowed' : 'pointer'
        }}
      >
        {isExecuting ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" />
            Executing Purchase...
          </>
        ) : (
          <>
            <Zap className="h-4 w-4" />
            Execute Purchase (Gas-Free)
          </>
        )}
      </button>
    </div>
  )
}