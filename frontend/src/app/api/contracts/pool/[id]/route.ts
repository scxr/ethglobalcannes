import { NextRequest, NextResponse } from 'next/server'
import { createPublicClient, http } from 'viem'
import { arbitrumSepolia } from 'viem/chains'
import poolAbi from '@/app/api/contracts/abis/pool.json'
import facAbi from '@/app/api/contracts/abis/fac.json'
import { formatUnits } from 'viem'

const client = createPublicClient({
  chain: arbitrumSepolia,
  transport: http('https://sepolia-rollup.arbitrum.io/rpc')
})

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = await params
    const poolId = id

    console.log('Fetching pool:', poolId)

    // TODO: Implement actual pool fetching from your contracts
    // For now, return mock data based on the ID
    
    const mockPools: { [key: string]: any } = {
      '0': {
        id: '0',
        address: '0x123456789abcdef123456789abcdef1234567890',
        title: 'ETH Investment Group',
        description: 'Pooling money to buy ETH before the next pump. Join our community of DeFi enthusiasts!',
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
        creator: '0x1234567890abcdef1234567890abcdef12345678',
        goalReached: false,
        executed: false,
        cancelled: false
      },
      '1': {
        id: '1', 
        address: '0x987654321fedcba987654321fedcba9876543210',
        title: 'LINK Accumulation',
        description: 'DCA into LINK with the squad. Chainlink to the moon! 🚀',
        targetAmount: 200,
        currentAmount: 85,
        targetToken: 'LINK',
        contributors: [
          { address: '0x9876...4321', amount: 50 },
          { address: '0xdef1...2345', amount: 35 }
        ],
        maxContributors: 5,
        deadline: '2024-01-10',
        creator: '0x9876543210fedcba9876543210fedcba98765432',
        goalReached: false,
        executed: false,
        cancelled: false
      },
      '2': {
        id: '2',
        address: '0xabcdef123456789abcdef123456789abcdef1234',
        title: 'AAVE Yield Strategy',
        description: 'Pool funds to maximize AAVE lending yields',
        targetAmount: 1000,
        currentAmount: 1000,
        targetToken: 'AAVE',
        contributors: [
          { address: '0xabc1...2345', amount: 300 },
          { address: '0xdef4...5678', amount: 250 },
          { address: '0x9871...1234', amount: 200 },
          { address: '0x5551...9999', amount: 250 }
        ],
        maxContributors: 8,
        deadline: '2024-01-20',
        creator: '0xabcdef123456789abcdef123456789abcdef1234',
        goalReached: true,
        executed: false,
        cancelled: false
      }
    }

    let poolInfo = await fetch(`http://localhost:8080/v1/graphql`, {
      method: 'POST',
      body: JSON.stringify({
        query:`
        query MyQuery {
  ChipInFactory_PoolCreated(where: {poolId: {_eq: "${poolId}"}}) {
    creator
    poolAddress
    id
    poolId
    targetAmount
    targetToken
    title
  }
}`
      })})
    let poolDataReq = await poolInfo.json()
    let data = poolDataReq.data.ChipInFactory_PoolCreated[0]
    console.log(data)
    let poolData: any = await client.readContract({
      address: data.poolAddress as `0x${string}`,
      abi: poolAbi,
      functionName: 'getPoolInfo'
    })
    let poolContributors = await client.readContract({
      address: data.poolAddress as `0x${string}`,
      abi: poolAbi,
      functionName: 'getContributors'
    })

    let contributors = []
    if ((poolContributors as any).length > 0) {
      for (let i = 0; i < (poolContributors as any).length; i += 2) {
        console.log((poolContributors as any)[i])
        if ((poolContributors as any)[i+1] != "0") {
        contributors.push({ address: (poolContributors as any)[i].toString(), amount: formatUnits((poolContributors as any)[i + 1], 6).toString() })
      }
    }
  }
    let poolStruct= {
      id: poolId,
      address: data.poolAddress as `0x${string}`,
      title: poolData[0].toString(),
      description: poolData[1].toString(),
      targetAmount: formatUnits(poolData[2], 6).toString(),
      currentAmount: formatUnits(poolData[3], 6).toString(),
      targetToken: data.targetToken,
      contributors: contributors,
      maxContributors: 0,
      deadline: poolData[5].toString(),
      creator: data.creator,
      goalReached: false,
      executed: poolData[7].toString(),
      cancelled: poolData[8].toString()
    }
    if (!poolStruct) {
      return NextResponse.json({
        success: false,
        error: 'Pool not found'
      }, { status: 404 })
    }


    
    return NextResponse.json({
      success: true,
      pool: poolStruct
    })

  } catch (error) {
    console.error('Failed to fetch pool:', error)
    return NextResponse.json({
      success: false,
      error: 'Failed to fetch pool'
    }, { status: 500 })
  }
}