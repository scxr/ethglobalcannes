'use client'

import { usePrivy } from '@privy-io/react-auth'
import { Users, DollarSign, Zap, Shield } from 'lucide-react'

export function Hero() {
  const { login } = usePrivy()

  return (
    <main className="container py-16">
      <div className="max-w-4xl mx-auto text-center">
        <h1 className="text-5xl font-bold text-gray-900 mb-6">
          Pool Money Together,<br />
          <span className="text-blue-600">Buy Crypto Smarter</span>
        </h1>
        
        <p className="text-xl text-gray-600 mb-8 max-w-2xl mx-auto">
          Create pools with friends, collect contributions, and automatically purchase crypto when your goal is reached. 
          All powered by USDC with zero gas fees.
        </p>

        <div className="mb-12">
          <button
            onClick={login}
            className="btn btn-primary text-lg px-8 py-4 shadow-lg"
          >
            Get Started Now
          </button>
        </div>

        <div className="grid grid-4 mb-16">
          <div className="text-center">
            <div className="bg-blue-100 rounded-full p-4 w-16 h-16 mx-auto mb-4 flex items-center justify-center">
              <Users className="h-8 w-8 text-blue-600" />
            </div>
            <h3 className="font-semibold text-gray-900 mb-2">Create Pools</h3>
            <p className="text-sm text-gray-600">Set up shared funding goals with friends</p>
          </div>
          
          <div className="text-center">
            <div className="bg-green-100 rounded-full p-4 w-16 h-16 mx-auto mb-4 flex items-center justify-center">
              <DollarSign className="h-8 w-8 text-green-600" />
            </div>
            <h3 className="font-semibold text-gray-900 mb-2">Collect Funds</h3>
            <p className="text-sm text-gray-600">Friends contribute USDC via shared links</p>
          </div>
          
          <div className="text-center">
            <div style={{ background: '#f3e8ff' }} className="rounded-full p-4 w-16 h-16 mx-auto mb-4 flex items-center justify-center">
              <Zap className="h-8 w-8" style={{ color: '#7c3aed' }} />
            </div>
            <h3 className="font-semibold text-gray-900 mb-2">Auto Purchase</h3>
            <p className="text-sm text-gray-600">Buy crypto via uniswap when goal is met</p>
          </div>
          
          <div className="text-center">
            <div style={{ background: '#fed7aa' }} className="rounded-full p-4 w-16 h-16 mx-auto mb-4 flex items-center justify-center">
              <Shield className="h-8 w-8" style={{ color: '#ea580c' }} />
            </div>
            <h3 className="font-semibold text-gray-900 mb-2">Zero Gas Fees</h3>
            <p className="text-sm text-gray-600">All transactions powered by Circle Paymaster</p>
          </div>
        </div>

        <div className="card p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Perfect for:</h3>
          <div className="grid grid-4 text-sm text-gray-600">
            <div>💎 Group crypto investments</div>
            <div>🎁 Pooling for expensive NFTs</div>
            <div>🚀 DeFi strategy funding</div>
            <div>👥 Community token buys</div>
          </div>
        </div>
      </div>
    </main>
  )
}
