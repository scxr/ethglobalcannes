'use client'

import { usePrivy } from '@privy-io/react-auth'
import { Header } from './components/Header'
import { Hero } from './components/Hero'
import { CreatePool } from './components/CreatePool'
import { ActivePools } from './components/ActivePools'
import { useState } from 'react'

export default function Home() {
  const { ready, authenticated } = usePrivy()
  const [activeTab, setActiveTab] = useState<'create' | 'pools'>('create')

  if (!ready) {
    return (
      <div style={{ 
        minHeight: '100vh', 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'center' 
      }}>
        <div className="text-center">
          <div className="animate-spin rounded-full w-12 h-12 border" style={{
            borderColor: '#e5e7eb',
            borderTopColor: '#3b82f6',
            borderWidth: '2px',
            margin: '0 auto 1rem'
          }}></div>
          <p className="text-gray-600">Loading ChipIn...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen">
      <Header />
      
      {!authenticated ? (
        <Hero />
      ) : (
        <main className="container py-8">
          <div className="max-w-4xl mx-auto">
            <div className="text-center mb-8">
              <h1 className="text-4xl font-bold text-gray-900 mb-2">
                Pool Money Together
              </h1>
              <p className="text-lg text-gray-600">
                Create pools, invite friends, and buy crypto together
              </p>
            </div>

            <div className="card mb-8">
              <div style={{ borderBottom: '1px solid #e5e7eb' }}>
                <nav className="flex">
                  <button
                    onClick={() => setActiveTab('create')}
                    className="px-6 py-3 font-medium text-sm"
                    style={{
                      color: activeTab === 'create' ? '#2563eb' : '#6b7280',
                      borderBottom: activeTab === 'create' ? '2px solid #2563eb' : 'none'
                    }}
                  >
                    Create Pool
                  </button>
                  <button
                    onClick={() => setActiveTab('pools')}
                    className="px-6 py-3 font-medium text-sm"
                    style={{
                      color: activeTab === 'pools' ? '#2563eb' : '#6b7280',
                      borderBottom: activeTab === 'pools' ? '2px solid #2563eb' : 'none'
                    }}
                  >
                    Active Pools
                  </button>
                </nav>
              </div>

              <div className="p-6">
                {activeTab === 'create' ? <CreatePool /> : <ActivePools />}
              </div>
            </div>
          </div>
        </main>
      )}
    </div>
  )
}
