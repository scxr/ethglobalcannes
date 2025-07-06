'use client'

import { usePrivy } from '@privy-io/react-auth'
import { Wallet, LogOut } from 'lucide-react'

export function Header() {
  const { ready, authenticated, user, login, logout } = usePrivy()

  return (
    <header className="bg-white shadow-sm border">
      <div className="container py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <div className="bg-blue-600 rounded-lg p-2">
              <Wallet className="h-6 w-6 text-white" />
            </div>
            <h1 className="text-2xl font-bold text-gray-900">ChipIn</h1>
          </div>

          <div className="flex items-center space-x-4">
            {ready && authenticated && user ? (
              <div className="flex items-center space-x-4">
                <div className="text-sm text-gray-600">
                  {user.wallet?.address && (
                    <span style={{ fontFamily: 'monospace' }} onClick={() => {
                      navigator.clipboard.writeText(user?.wallet?.address || '')
                    }}>
                      {user.wallet.address.slice(0, 6)}...{user.wallet.address.slice(-4)}
                    </span>
                  )}
                </div>
                <button
                  onClick={logout}
                  className="btn btn-secondary"
                >
                  <LogOut className="h-4 w-4" />
                  <span>Logout</span>
                </button>
              </div>
            ) : (
              <button
                onClick={login}
                className="btn btn-primary"
              >
                Connect Wallet
              </button>
            )}
          </div>
        </div>
      </div>
    </header>
  )
}
