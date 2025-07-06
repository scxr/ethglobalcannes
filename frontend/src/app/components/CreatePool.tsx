'use client'

import { useState } from 'react'
import { Plus, DollarSign, Users, Target, CheckCircle, AlertCircle } from 'lucide-react'
import { useChipInContracts } from '@/hooks/useChipInContracts'

export function CreatePool() {
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    targetAmount: '',
    targetToken: 'ETH',
    deadline: '',
    maxContributors: '10'
  })
  const [successMessage, setSuccessMessage] = useState('')
  const [createdPoolAddress, setCreatedPoolAddress] = useState('')
  const { createPool, isLoading, error } = useChipInContracts()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    // Clear previous messages
    setSuccessMessage('')
    setCreatedPoolAddress('')
    
    try {
      console.log('Creating pool:', formData)
      const poolAddress = await createPool({
        title: formData.title,
        description: formData.description,
        targetAmount: formData.targetAmount,
        targetToken: formData.targetToken,
        deadline: new Date(formData.deadline),
        maxContributors: parseInt(formData.maxContributors)
      })

      console.log("Pool address: ", poolAddress)
      
      if (poolAddress) {
        setSuccessMessage('Pool created successfully!')
        setCreatedPoolAddress(poolAddress)
        // Reset form
        setFormData({
          title: '',
          description: '',
          targetAmount: '',
          targetToken: 'ETH',
          deadline: '',
          maxContributors: '10'
        })
      }
    } catch (err) {
      console.error('Error creating pool:', err)
    }
  }

  const tokens = [
    { symbol: 'ETH', name: 'Ethereum' },
    { symbol: 'WBTC', name: 'Wrapped Bitcoin' },
    { symbol: 'LINK', name: 'Chainlink' },
    { symbol: 'UNI', name: 'Uniswap' },
    { symbol: 'AAVE', name: 'Aave' },
  ]

  return (
    <div className="max-w-2xl mx-auto">
      <div className="text-center mb-6">
        <Plus className="h-8 w-8 text-blue-600 mx-auto mb-2" />
        <h2 className="text-2xl font-bold text-gray-900">Create New Pool</h2>
        <p className="text-gray-600">Set up a shared funding goal with friends</p>
      </div>

      {/* Success Message */}
      {successMessage && (
        <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-lg">
          <div className="flex items-center">
            <CheckCircle className="h-5 w-5 text-green-600 mr-2" />
            <div>
              <h3 className="text-sm font-medium text-green-800">{successMessage}</h3>
              {createdPoolAddress && (
                <p className="text-xs text-green-700 mt-1">
                  Pool Address: <span className="font-mono">{createdPoolAddress}</span>
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Error Message */}
      {error && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
          <div className="flex items-center">
            <AlertCircle className="h-5 w-5 text-red-600 mr-2" />
            <div>
              <h3 className="text-sm font-medium text-red-800">Error creating pool</h3>
              <p className="text-xs text-red-700 mt-1">{error}</p>
            </div>
          </div>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Pool Title
          </label>
          <input
            type="text"
            value={formData.title}
            onChange={(e) => setFormData({...formData, title: e.target.value})}
            placeholder="e.g., Let's buy ETH together!"
            className="form-input"
            required
            disabled={isLoading}
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Description
          </label>
          <textarea
            value={formData.description}
            onChange={(e) => setFormData({...formData, description: e.target.value})}
            placeholder="Why are we pooling money for this?"
            rows={3}
            className="form-input"
            style={{ resize: 'vertical' }}
            disabled={isLoading}
          />
        </div>

        <div className="grid grid-2">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Target Amount (USDC)
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
                value={formData.targetAmount}
                onChange={(e) => setFormData({...formData, targetAmount: e.target.value})}
                placeholder="200"
                className="form-input"
                style={{ paddingLeft: '2.5rem' }}
                required
                disabled={isLoading}
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Target Token
            </label>
            <input
              type="text"
              value={formData.targetToken}
              onChange={(e) => setFormData({...formData, targetToken: e.target.value})}
              className="form-input"
              required
              disabled={isLoading}
            />
            {/* <select
              value={formData.targetToken}
              onChange={(e) => setFormData({...formData, targetToken: e.target.value})}
              className="form-input"
            >
              {tokens.map(token => (
                <option key={token.symbol} value={token.symbol}>
                  {token.symbol} - {token.name}
                </option>
              ))}
            </select> */}
          </div>
        </div>

        <div className="grid grid-2">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Deadline
            </label>
            <input
              type="date"
              value={formData.deadline}
              onChange={(e) => setFormData({...formData, deadline: e.target.value})}
              className="form-input"
              required
              disabled={isLoading}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Max Contributors
            </label>
            <div style={{ position: 'relative' }}>
              <Users className="h-4 w-4 text-gray-500" style={{
                position: 'absolute',
                left: '0.75rem',
                top: '50%',
                transform: 'translateY(-50%)'
              }} />
              <input
                type="number"
                value={formData.maxContributors}
                onChange={(e) => setFormData({...formData, maxContributors: e.target.value})}
                min="2"
                max="50"
                className="form-input"
                style={{ paddingLeft: '2.5rem' }}
                required
                disabled={isLoading}
              />
            </div>
          </div>
        </div>

        <button
          type="submit"
          className="btn btn-primary w-full"
          disabled={isLoading}
        >
          <Target className="h-5 w-5" />
          <span>{isLoading ? 'Creating Pool...' : 'Create Pool'}</span>
        </button>
      </form>
    </div>
  )
}
