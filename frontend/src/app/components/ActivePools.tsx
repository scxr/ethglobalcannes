'use client'

import { useState, useEffect } from 'react'
import { Share2, Users, Clock, DollarSign, ExternalLink } from 'lucide-react'
import Link from 'next/link'
import { formatUnits } from 'viem'

interface Pool {
  creator: string
  poolAddress: string
  id: string
  poolId: string
  targetAmount: number
  targetToken: string
  title: string
}

export function ActivePools() {
  const [pools, setPools] = useState<Pool[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchPools()
  }, [])

  const fetchPools = async () => {
    try {
      // Replace with your actual API endpoint
      const response = await fetch('/api/contracts/pools')
      const data = await response.json()
      
      if (data.success) {
        setPools(data.pools)
      }
    } catch (error) {
      console.error('Failed to fetch pools:', error)
      // For now, show mock data
      setPools([
        {
          creator: '0x1234...5678',
          poolAddress: '0x123...',
          id: '0',
          poolId: '0',
          targetAmount: 500,
          targetToken: 'ETH',
          title: 'ETH Investment Group'
        },
        {
          creator: '0x9876...4321',
          poolAddress: '0x456...',
          id: '1',
          poolId: '1',
          targetAmount: 200,
          targetToken: 'LINK',
          title: 'LINK Accumulation'
        }
      ])
    } finally {
      setLoading(false)
    }
  }

  const sharePool = (poolId: string) => {
    const url = `${window.location.origin}/pool/${poolId}`
    navigator.clipboard.writeText(url)
    alert('Pool link copied to clipboard!')
  }

  if (loading) {
    return (
      <div className="text-center py-8">
        <div className="animate-spin rounded-full w-8 h-8 border border-blue-600 border-t-transparent mx-auto mb-4"></div>
        <p className="text-gray-600">Loading pools...</p>
      </div>
    )
  }

  return (
    <div>
      <div className="text-center mb-6">
        <h2 className="text-2xl font-bold text-gray-900 mb-2">Active Pools</h2>
        <p className="text-gray-600">Manage your pools and track contributions</p>
      </div>

      {pools.length === 0 ? (
        <div className="text-center py-8">
          <Users className="h-12 w-12 text-gray-500 mx-auto mb-4" />
          <p className="text-gray-600">No active pools yet. Create your first pool!</p>
        </div>
      ) : (
        <div className="space-y-4">
          {pools.map(pool => (
            <div key={pool.id} className="bg-gray-50 rounded-xl p-6 border">
              <div className="flex justify-between items-start mb-4">
                <div className="flex-1">
                  <div className="flex items-center space-x-3 mb-2">
                    <h3 className="text-lg font-semibold text-gray-900">{pool.title}</h3>
                  </div>
                  <p className="text-sm text-gray-600 mb-3">Created by: {pool.creator}</p>
                </div>
                <div className="flex items-center space-x-2">
                  <button
                    onClick={() => sharePool(pool.id)}
                    className="p-2 hover:bg-gray-200 rounded-lg transition-colors"
                    title="Share pool"
                  >
                    <Share2 className="h-4 w-4 text-gray-600" />
                  </button>
                  <Link 
                    href={`/pool/${pool.id}`}
                    className="p-2 hover:bg-blue-100 rounded-lg transition-colors text-blue-600"
                    title="View pool details"
                  >
                    <ExternalLink className="h-4 w-4" />
                  </Link>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 text-sm">
                <div className="flex items-center space-x-2">
                  <DollarSign className="h-4 w-4 text-gray-500" />
                  <span className="text-gray-600">Target: {formatUnits(BigInt(pool.targetAmount), 6)} USDC</span>
                </div>
                <div className="flex items-center space-x-2">
                  <span className="text-gray-600">Pool ID: {pool.poolId}</span>
                </div>
                <div className="flex items-center space-x-2">
                  <span className="text-gray-600 text-xs">Pool Address: {pool.poolAddress}</span>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <Link 
                    href={`/pool/${pool.poolId}`}
                    className="text-blue-600 hover:text-blue-700 text-sm font-medium"
                  >
                    View Details →
                  </Link>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

