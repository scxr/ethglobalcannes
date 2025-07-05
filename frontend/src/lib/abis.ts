import { parseAbi, createPublicClient, http } from "viem"
import { baseSepolia, arbitrumSepolia } from "viem/chains"
import { CONTRACT_ADDRESSES } from "./contract"


export const FACTORY_ABI = parseAbi([
    'function createPool(string title, string description, uint256 targetAmount, address targetToken, uint256 deadline, uint256 maxContributors) returns (address)',
    'function getPool(uint256 poolId) view returns (address)',
    'function getUserPools(address user) view returns (uint256[])',
    'function poolCount() view returns (uint256)',
    'event PoolCreated(uint256 indexed poolId, address indexed poolAddress, address indexed creator, string title, uint256 targetAmount, address targetToken)'
])

export const POOL_ABI = parseAbi([
    'function contribute(uint256 amount)',
    'function getPoolInfo() view returns (string title, string description, uint256 targetAmount, uint256 totalContributed, uint256 contributorCount, uint256 deadline, bool goalReached, bool executed, bool cancelled)',
    'function getContributors() view returns (address[], uint256[])',
    'function refund()',
    'function creator() view returns (address)',
    'function targetToken() view returns (address)',
    'event ContributionMade(address indexed contributor, uint256 amount)',
    'event GoalReached(uint256 totalAmount)'
])

export const USDC_ABI = parseAbi([
    'function approve(address spender, uint256 amount) returns (bool)',
    'function allowance(address owner, address spender) view returns (uint256)',
    'function balanceOf(address account) view returns (uint256)',
    'function transfer(address to, uint256 amount) returns (bool)'
])

export interface PoolData {
    id: string
    address: string
    title: string
    description: string
    targetAmount: string
    totalContributed: string
    contributorCount: number
    deadline: number
    goalReached: boolean
    executed: boolean
    cancelled: boolean
    creator: string
    targetToken: string
}

export class ChipInContracts {
    private publicClient: any
    private chainId: number

    constructor(chainId: number) {
        this.chainId = chainId
        const chain = chainId === baseSepolia.id ? baseSepolia : arbitrumSepolia
        this.publicClient = createPublicClient({
            chain,
            transport: http()
        })
    }

    private getAddresses() {
        return CONTRACT_ADDRESSES[this.chainId as keyof typeof CONTRACT_ADDRESSES]
    }

    async createPool(params: {
        title: string
        description: string
        targetAmount: string // in USDC (e.g., "100")
        targetToken: string
        deadline: Date
        maxContributors: number
        userAddress: string
    }): Promise<string> {
        const addresses = this.getAddresses()
        if (!addresses) throw new Error('Unsupported network')

        // Convert targetAmount to wei (USDC has 6 decimals)
        const targetAmountWei = BigInt(Math.floor(parseFloat(params.targetAmount) * 1e6))
        const deadlineTimestamp = BigInt(Math.floor(params.deadline.getTime() / 1000))

        const response = await fetch('/api/contracts/create-pool', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                title: params.title,
                description: params.description,
                targetAmount: targetAmountWei.toString(),
                targetToken: params.targetToken,
                deadline: deadlineTimestamp.toString(),
                maxContributors: params.maxContributors,
                userAddress: params.userAddress,
                chainId: this.chainId
            })
        })

        if (!response.ok) {
            throw new Error('Failed to create pool')
        }

        const result = await response.json()
        return result.poolAddress
    }

    async getPool(poolId: string): Promise<PoolData | null> {
        const addresses = this.getAddresses()
        if (!addresses) return null

        try {
            // Get pool address from factory
            const poolAddress = await this.publicClient.readContract({
                address: addresses.factory,
                abi: FACTORY_ABI,
                functionName: 'getPool',
                args: [BigInt(poolId)]
            })

            if (poolAddress === '0x0000000000000000000000000000000000000000') {
                return null
            }

            // Get pool info
            const poolInfo = await this.publicClient.readContract({
                address: poolAddress,
                abi: POOL_ABI,
                functionName: 'getPoolInfo'
            })

            const creator = await this.publicClient.readContract({
                address: poolAddress,
                abi: POOL_ABI,
                functionName: 'creator'
            })

            const targetToken = await this.publicClient.readContract({
                address: poolAddress,
                abi: POOL_ABI,
                functionName: 'targetToken'
            })

            return {
                id: poolId,
                address: poolAddress,
                title: poolInfo[0],
                description: poolInfo[1],
                targetAmount: (Number(poolInfo[2]) / 1e6).toString(), // Convert from wei
                totalContributed: (Number(poolInfo[3]) / 1e6).toString(),
                contributorCount: Number(poolInfo[4]),
                deadline: Number(poolInfo[5]),
                goalReached: poolInfo[6],
                executed: poolInfo[7],
                cancelled: poolInfo[8],
                creator,
                targetToken
            }
        } catch (error) {
            console.error('Failed to get pool:', error)
            return null
        }
    }

    async contributeToPool(poolAddress: string, amount: string, userAddress: string): Promise<string> {
        const amountWei = BigInt(Math.floor(parseFloat(amount) * 1e6))

        const response = await fetch('/api/contracts/contribute', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                poolAddress,
                amount: amountWei.toString(),
                userAddress,
                chainId: this.chainId
            })
        })

        if (!response.ok) {
            throw new Error('Failed to contribute to pool')
        }

        const result = await response.json()
        return result.transactionHash
    }

    async getUserPools(userAddress: string): Promise<string[]> {
        const addresses = this.getAddresses()
        if (!addresses) return []

        try {
            const poolIds = await this.publicClient.readContract({
                address: addresses.factory,
                abi: FACTORY_ABI,
                functionName: 'getUserPools',
                args: [userAddress]
            })

            return poolIds.map((id: bigint) => id.toString())
        } catch (error) {
            console.error('Failed to get user pools:', error)
            return []
        }
    }

    async getUSDCBalance(userAddress: string): Promise<string> {
        const addresses = this.getAddresses()
        if (!addresses) return '0'

        try {
            const balance = await this.publicClient.readContract({
                address: addresses.usdc,
                abi: USDC_ABI,
                functionName: 'balanceOf',
                args: [userAddress]
            })

            return (Number(balance) / 1e6).toString()
        } catch (error) {
            console.error('Failed to get USDC balance:', error)
            return '0'
        }
    }

    async approveUSDC(spenderAddress: string, amount: string, userAddress: string): Promise<string> {
        const amountWei = BigInt(Math.floor(parseFloat(amount) * 1e6))

        const response = await fetch('/api/contracts/approve-usdc', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                spenderAddress,
                amount: amountWei.toString(),
                userAddress,
                chainId: this.chainId
            })
        })

        if (!response.ok) {
            throw new Error('Failed to approve USDC')
        }

        const result = await response.json()
        return result.transactionHash
    }
}