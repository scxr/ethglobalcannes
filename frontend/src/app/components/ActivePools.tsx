'use client'

import { useState } from 'react'
import { Share2, Users, Clock, DollarSign } from 'lucide-react'

export function ActivePools() {
  // Mock data - replace with real data
  const [pools] = useState([
    {
      id: '1',
      title: 'ETH Investment Group',
      description: 'Pooling money to buy ETH before the next pump',
      targetAmount: 500,
      currentAmount: 320,
      targetToken: 'ETH',
      contributors: 8,
      maxContributors: 10,
      deadline: '2024-01-15',
      creator: '0x1234...5678',
      isOwner: true
    },
    {
      id: '2',
      title: 'LINK Accumulation',
      description: 'DCA into LINK with the squad',
      targetAmount: 200,
      currentAmount: 85,
      targetToken: 'LINK',
      contributors: 3,
      maxContributors: 5,
      deadline: '2024-01-10',
      creator: '0x9876...4321',
      isOwner: false
    }
  ])

  const sharePool = (poolId: string) => {
    const url = `${window.location.origin}/pool/${poolId}`
    navigator.clipboard.writeText(url)
    alert('Pool link copied to clipboard!')
  }

  const getProgressPercentage = (current: number, target: number) => {
    return Math.min((current / target) * 100, 100)
  }

  const getDaysRemaining = (deadline: string) => {
    const now = new Date()
    const end = new Date(deadline)
    const diff = end.getTime() - now.getTime()
    return Math.ceil(diff / (1000 * 60 * 60 * 24))
  }

  return (
    <div>
      <div className="text-center mb-6">
        <h2 className="text-2xl font-bold text-gray-900 mb-2">Active Pools</h2>
        <p className="text-gray-600">Manage your pools and track contributions</p>
      </div>

      {pools.length === 0 ? (
        <div className="text-center py-8">
          <Users className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <p className="text-gray-600">No active pools yet. Create your first pool!</p>
        </div>
      ) : (
        <div className="space-y-4">
          {pools.map(pool => (
            <div key={pool.id} className="bg-gray-50 rounded-xl p-6 border border-gray-200">
              <div className="flex justify-between items-start mb-4">
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">{pool.title}</h3>
                  <p className="text-sm text-gray-600">{pool.description}</p>
                </div>
                <div className="flex items-center space-x-2">
                  {pool.isOwner && (
                    <span className="bg-blue-100 text-blue-800 text-xs px-2 py-1 rounded-full">
                      Owner
                    </span>
                  )}
                  <button
                    onClick={() => sharePool(pool.id)}
                    className="p-2 hover:bg-gray-200 rounded-lg transition-colors"
                    title="Share pool"
                  >
                    <Share2 className="h-4 w-4 text-gray-600" />
                  </button>
                </div>
              </div>

              <div className="mb-4">
                <div className="flex justify-between items-center mb-2">
                  <span className="text-sm font-medium text-gray-700">
                    Progress: ${pool.currentAmount} / ${pool.targetAmount} USDC
                  </span>
                  <span className="text-sm text-gray-600">
                    {getProgressPercentage(pool.currentAmount, pool.targetAmount).toFixed(1)}%
                  </span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div
                    className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                    style={{
                      width: `${getProgressPercentage(pool.currentAmount, pool.targetAmount)}%`
                    }}
                  ></div>
                </div>
              </div>

              <div className="grid grid-cols-4 gap-4 text-sm">
                <div className="flex items-center space-x-2">
                  <DollarSign className="h-4 w-4 text-gray-500" />
                  <span className="text-gray-600">Target: {pool.targetToken}</span>
                </div>
                <div className="flex items-center space-x-2">
                  <Users className="h-4 w-4 text-gray-500" />
                  <span className="text-gray-600">
                    {pool.contributors}/{pool.maxContributors} people
                  </span>
                </div>
                <div className="flex items-center space-x-2">
                  <Clock className="h-4 w-4 text-gray-500" />
                  <span className="text-gray-600">
                    {getDaysRemaining(pool.deadline)} days left
                  </span>
                </div>
                <div className="text-right">
                  <span className="text-xs text-gray-500">
                    by {pool.creator}
                  </span>
                </div>
              </div>

              {pool.currentAmount >= pool.targetAmount && (
                <div className="mt-4 p-3 bg-green-50 border border-green-200 rounded-lg">
                  <p className="text-sm text-green-800 font-medium">
                    🎉 Goal reached! Ready to purchase {pool.targetToken}
                  </p>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
