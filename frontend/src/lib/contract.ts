import { createPublicClient, createWalletClient, http, parseAbi, formatEther, parseEther } from 'viem'
import { baseSepolia, arbitrumSepolia } from 'viem/chains'

export const CONTRACT_ADDRESSES = {

    [arbitrumSepolia.id]: {
      factory: '0x1f74ab8847339D7f91D049da75ceEB0f21E87827', // Deploy ChipInFactory here  
      registry: '0xbadD8B6989160f7cC56311bBFCB13C549621AFD0', // Deploy ChipInRegistry here
      usdc: '0x75faf114eafb1BDbe2F0316DF893fd58CE46AA4d' // Arbitrum Sepolia USDC
    }
  } as const