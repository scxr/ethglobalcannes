'use client'

import { useState } from 'react'
import { Heart, DollarSign, Loader2 } from 'lucide-react'
import { usePoolContribution } from '@/hooks/usePoolContribution'

interface ContributionFormProps {
  poolAddress: string
  targetAmount: number
  currentAmount: number
  maxAmount?: number
  onSuccess?: () => void
}

export function ContributionForm({ 
  poolAddress, 
  targetAmount, 
  currentAmount, 
  maxAmount,
  onSuccess 
}: ContributionFormProps) {
  const [amount, setAmount] = useState('')
  const { contributeToPool, isContributing, error } = usePoolContribution()

  const remainingAmount = targetAmount - currentAmount
  const maxContribution = maxAmount ? Math.min(remainingAmount, maxAmount) : remainingAmount

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!amount || parseFloat(amount) <= 0) return

    try {
      await contributeToPool(poolAddress, amount, (txHash) => {
        console.log('Contribution successful!', txHash)
        setAmount('')
        onSuccess?.()
      })
    } catch (error) {
      console.error('Contribution failed:', error)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Contribution Amount (USDC)
        </label>
        <div style={{ position: 'relative' }}>
          <DollarSign className="h-4 w-4 text-gray-500" style={{
            position: 'absolute',
            left: '0.75rem',
            top: '50%',
            transform: 'translateY(-50%)'
          }} />
          <input
            type="number"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="Enter amount"
            step="0.01"
            min="0.01"
            max={maxContribution}
            className="form-input"
            style={{ paddingLeft: '2.5rem' }}
            required
            disabled={isContributing}
          />
        </div>
        <p className="text-xs text-gray-500 mt-1">
          Remaining needed: ${remainingAmount.toFixed(2)} • Max: ${maxContribution.toFixed(2)}
        </p>
      </div>

      {error && (
        <div className="bg-red-50 border-red-200 rounded-lg p-3 border">
          <p className="text-sm text-red-600">{error}</p>
        </div>
      )}

      <div className="bg-blue-50 border-blue-200 rounded-lg p-4 border">
        <h4 className="font-medium text-blue-600 mb-2">Gas-Free Transaction</h4>
        <p className="text-sm text-blue-600">
          Your contribution will be processed with zero gas fees using Circle Paymaster
        </p>
      </div>

      <button
        type="submit"
        disabled={isContributing || !amount || parseFloat(amount) <= 0 || parseFloat(amount) > maxContribution}
        className="btn btn-primary w-full"
        style={{
          opacity: (isContributing || !amount || parseFloat(amount) <= 0 || parseFloat(amount) > maxContribution) ? 0.6 : 1,
          cursor: (isContributing || !amount || parseFloat(amount) <= 0 || parseFloat(amount) > maxContribution) ? 'not-allowed' : 'pointer'
        }}
      >
        {isContributing ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" />
            Contributing...
          </>
        ) : (
          <>
            <Heart className="h-4 w-4" />
            Contribute ${amount || '0'} (Gas-Free)
          </>
        )}
      </button>
    </form>
  )
}