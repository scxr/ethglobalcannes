'use client'

import { useState } from 'react'
import { Plus, DollarSign, Users, Target } from 'lucide-react'

export function CreatePool() {
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    targetAmount: '',
    targetToken: 'ETH',
    deadline: '',
    maxContributors: '10'
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    // TODO: Implement pool creation
    console.log('Creating pool:', formData)
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
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Target Token
            </label>
            <select
              value={formData.targetToken}
              onChange={(e) => setFormData({...formData, targetToken: e.target.value})}
              className="form-input"
            >
              {tokens.map(token => (
                <option key={token.symbol} value={token.symbol}>
                  {token.symbol} - {token.name}
                </option>
              ))}
            </select>
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
              />
            </div>
          </div>
        </div>

        <button
          type="submit"
          className="btn btn-primary w-full"
        >
          <Target className="h-5 w-5" />
          <span>Create Pool</span>
        </button>
      </form>
    </div>
  )
}
