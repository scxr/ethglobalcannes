'use client'

import { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'
import { usePrivy } from '@privy-io/react-auth'
import { Share2, Users, Clock, DollarSign, Heart, ArrowLeft } from 'lucide-react'
import Link from 'next/link'
import { ContributionForm } from '@/app/components/ContributionForm'
import { createPublicClient, http } from 'viem'
import { arbitrumSepolia } from 'viem/chains'
import { ExecuteButton } from '@/app/components/ExecuteButton'

const client = createPublicClient({
  chain: arbitrumSepolia,
  transport: http('https://arbitrum-sepolia.gateway.tenderly.co')
})
interface Pool {
  id: string
  address: string
  title: string
  description: string
  targetAmount: number
  currentAmount: number
  targetToken: string
  contributors: Array<{
    address: string
    amount: number
  }>
  maxContributors: number
  deadline: string
  creator: string
}

export default function PoolPage() {
  const { id } = useParams()
  const { ready, authenticated, login } = usePrivy()
  const [pool, setPool] = useState<Pool | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (ready) {
      fetchPool()
    }
  }, [ready, id])

  const fetchPool = async () => {
    try {
      const response = await fetch(`/api/contracts/pool/${id}`)
      const data = await response.json()
      
      if (data.success) {
        setPool(data.pool)
      } else {
        // Mock data for development
        setPool({
          id: id as string,
          address: '0x123456789...',
          title: 'ETH Investment Group',
          description: 'Pooling money to buy ETH before the next pump',
          targetAmount: 500,
          currentAmount: 320,
          targetToken: 'ETH',
          contributors: [
            { address: '0x1234...5678', amount: 100 },
            { address: '0x9876...4321', amount: 150 },
            { address: '0xabcd...efgh', amount: 70 }
          ],
          maxContributors: 10,
          deadline: '2024-01-15',
          creator: '0x1234...5678'
        })
      }
    } catch (error) {
      console.error('Failed to fetch pool:', error)
    } finally {
      setLoading(false)
    }
  }

  if (!ready || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full w-12 h-12 border mx-auto mb-4" style={{
            borderColor: '#e5e7eb',
            borderTopColor: '#3b82f6',
            borderWidth: '2px'
          }}></div>
          <p className="text-gray-600">Loading pool...</p>
        </div>
      </div>
    )
  }

  if (!pool) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Pool Not Found</h1>
          <p className="text-gray-600 mb-4">The pool you're looking for doesn't exist.</p>
          <Link href="/" className="text-blue-600 hover:text-blue-700 font-medium">
            ← Back to Dashboard
          </Link>
        </div>
      </div>
    )
  }

  const progressPercentage = Math.min((pool.currentAmount / pool.targetAmount) * 100, 100)
  const daysRemaining = Math.ceil((new Date(pool.deadline).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24))

  return (
    <div className="min-h-screen">
      <div className="container py-8">
        <div className="max-w-4xl mx-auto">
          {/* Back button */}
          <div className="mb-6">
            <Link href="/" className="text-blue-600 hover:text-blue-700 font-medium flex items-center space-x-2">
              <ArrowLeft className="h-4 w-4" />
              <span>Back to Dashboard</span>
            </Link>
          </div>

          <div className="card overflow-hidden">
            {/* Pool Header */}
            <div className="gradient-bg text-white p-6">
              <div className="flex justify-between items-start mb-4">
                <div>
                  <h1 className="text-3xl font-bold mb-2">{pool.title}</h1>
                  <p style={{ color: '#bfdbfe' }}>{pool.description}</p>
                </div>
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(window.location.href)
                    alert('Pool link copied!')
                  }}
                  className="p-2 rounded-lg transition-colors"
                  style={{ background: 'rgba(255,255,255,0.2)' }}
                  title="Share pool"
                >
                  <Share2 className="h-5 w-5" />
                </button>
              </div>

              <div className="grid grid-4 text-sm">
                <div>
                  <div style={{ color: '#bfdbfe' }}>Target Token</div>
                  <div className="font-semibold">{pool.targetToken}</div>
                </div>
                <div>
                  <div style={{ color: '#bfdbfe' }}>Contributors</div>
                  <div className="font-semibold">{pool.contributors.length}/{pool.maxContributors}</div>
                </div>
                <div>
                  <div style={{ color: '#bfdbfe' }}>Days Left</div>
                  <div className="font-semibold">{daysRemaining}</div>
                </div>
                <div>
                  <div style={{ color: '#bfdbfe' }}>Creator</div>
                  <div className="text-sm" style={{ fontFamily: 'monospace' }}>{pool.creator}</div>
                </div>
              </div>
            </div>

            {/* Pool Content */}
            <div className="p-6">
              {/* Progress */}
              <div className="mb-6">
                <div className="flex justify-between items-center mb-2">
                  <span className="text-lg font-semibold text-gray-900">
                    ${pool.currentAmount} / ${pool.targetAmount} USDC
                  </span>
                  <span className="text-sm text-gray-600">
                    {progressPercentage.toFixed(1)}% complete
                  </span>
                </div>
                <div className="progress-bar">
                  <div
                    className="progress-fill"
                    style={{ width: `${progressPercentage}%` }}
                  ></div>
                </div>
              </div>

              <div className="grid grid-2">
                {/* Contributors */}
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                    <Users className="h-5 w-5 mr-2" />
                    Contributors ({pool.contributors.length})
                  </h3>
                  <div className="space-y-4">
                    {pool.contributors.map((contributor, index) => (
                      <div key={index} className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
                        <div className="flex items-center space-x-2">
                          <div 
                            className="w-8 h-8 rounded-full flex items-center justify-center text-white text-sm font-bold"
                            style={{ background: 'linear-gradient(45deg, #3b82f6, #8b5cf6)' }}
                          >
                            {contributor.address.slice(2, 4).toUpperCase()}
                          </div>
                          <span className="text-sm text-gray-700" style={{ fontFamily: 'monospace' }}>
                            {contributor.address}
                          </span>
                        </div>
                        <span className="font-semibold text-gray-900">
                          ${contributor.amount}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Contribution Form */}
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                    <Heart className="h-5 w-5 mr-2" />
                    Contribute to Pool
                  </h3>
                  
                  {!authenticated ? (
                    <div className="text-center p-6 bg-gray-50 rounded-lg">
                      <p className="text-gray-600 mb-4">Connect your wallet to contribute</p>
                      <button
                        onClick={login}
                        className="btn btn-primary"
                      >
                        Connect Wallet
                      </button>
                    </div>
                  ) : pool.currentAmount >= pool.targetAmount ? (
                    <ExecuteButton
                    poolId={pool.id}
                    poolAddress={pool.address}
                    targetToken={pool.targetToken}
                    usdcAmount={pool.currentAmount}
                    onSuccess={() => {
                      // Refresh pool data
                      fetchPool()
                    }}
                  />
                  ) : (
                    <ContributionForm
                      poolAddress={pool.address}
                      targetAmount={pool.targetAmount}
                      currentAmount={pool.currentAmount}
                      onSuccess={() => {
                        // Refresh pool data
                        fetchPool()
                      }}
                    />
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
