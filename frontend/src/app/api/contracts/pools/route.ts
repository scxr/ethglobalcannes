import { NextRequest, NextResponse } from 'next/server'
interface Pool {
  creator: string
  poolAddress: string
  id: string
  poolId: string
  targetAmount: number
  targetToken: string
  title: string
}
export async function GET(request: NextRequest) {
  try {
    // TODO: Implement actual pool fetching from your contracts
    // For now, return mock data
    
    let endpoint = "http://localhost:8080/v1/graphql"
    let query = `
    query MyQuery {
        ChipInFactory_PoolCreated {
            creator
            poolAddress
            id
            poolId
            targetAmount
            targetToken
            title
        }
    }

    `
    let response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ query })
    })

    const data = await response.json()
    console.log(data.data)
    let pools: Pool[] = (data as any).data.ChipInFactory_PoolCreated as Pool[]
    

    pools = pools.reverse()

    return NextResponse.json({
      success: true,
      pools
    })

  } catch (error) {
    console.error('Failed to fetch pools:', error)
    return NextResponse.json({
      success: false,
      error: 'Failed to fetch pools'
    }, { status: 500 })
  }
}

// Quick test URLs to verify it's working:
// http://localhost:3000/api/contracts/pool/0
// http://localhost:3000/api/contracts/pool/1  
// http://localhost:3000/api/contracts/pool/2
// http://localhost:3000/api/contracts/pools