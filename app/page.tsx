'use client';

import React, { useState } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import Image from 'next/image';

const chains = [
  { 
    id: 'celo', 
    name: 'Celo', 
    description: 'Mobile-first blockchain for DeFi',
    icon: '/chains/celo.svg',
    addressPlaceholder: '0x...'
  },
  { 
    id: 'ronin', 
    name: 'Ronin', 
    description: 'Gaming-focused EVM chain',
    icon: '/chains/ronin.svg',
    addressPlaceholder: '0x...'
  },
  { 
    id: 'celestia', 
    name: 'Celestia', 
    description: 'Data availability layer',
    icon: '/chains/celestia.svg',
    addressPlaceholder: 'celestia...'
  },
  { 
    id: 'osmosis', 
    name: 'Osmosis', 
    description: 'Cosmos DEX and DeFi hub',
    icon: '/chains/osmosis.svg',
    addressPlaceholder: 'osmo...'
  },
  { 
    id: 'near', 
    name: 'NEAR Protocol', 
    description: 'Scalable L1 blockchain',
    icon: '/chains/near.svg',
    addressPlaceholder: 'alice.near or 64-char hex'
  },
  { 
    id: 'fantom', 
    name: 'Fantom', 
    description: 'High-performance EVM chain',
    icon: '/chains/fantom.svg',
    addressPlaceholder: '0x...'
  },
  { 
    id: 'babylon', 
    name: 'Babylon', 
    description: 'Bitcoin staking protocol',
    icon: '/chains/babylon.svg',
    addressPlaceholder: 'bbn...'
  },
];

export default function Home() {
  const [selectedChain, setSelectedChain] = useState<string>('celo');
  const [address, setAddress] = useState('');

  const selectedChainData = chains.find(c => c.id === selectedChain);

  return (
    <>
      <Head>
        <title>Multi-Chain Transaction Dashboard</title>
      </Head>
      
      <div className="min-h-screen bg-[#1a1a1a] text-white flex flex-col">
        {/* Header */}
        <header className="border-b border-gray-800 bg-[#1a1a1a]">
          <div className="container mx-auto px-4 py-4">
            <h1 className="text-2xl font-bold text-orange-500">
              Multi-Chain Transaction Dashboard
            </h1>
          </div>
        </header>

        {/* Main Content */}
        <main className="container mx-auto px-4 py-12 flex-grow">
          <div className="max-w-4xl mx-auto">
            <div className="text-center mb-8">
              <h2 className="text-4xl font-bold mb-4 text-white">
                View Your Blockchain Transactions
              </h2>
              <p className="text-gray-400 text-lg">
                Enter your wallet address and select a blockchain to view transactions and export to CSV.
              </p>
            </div>

            {/* Address Input Section */}
            <div className="bg-[#2a2a2a] rounded-lg p-6 mb-8 border border-gray-800">
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Wallet Address
              </label>
              <input
                type="text"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder={selectedChainData?.addressPlaceholder || 'Enter wallet address...'}
                className="w-full bg-[#1a1a1a] border border-gray-700 rounded-lg px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-orange-500 mb-4"
              />
              
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Select Blockchain
              </label>
              <select
                value={selectedChain}
                onChange={(e) => setSelectedChain(e.target.value)}
                className="w-full bg-[#1a1a1a] border border-gray-700 rounded-lg px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-orange-500"
              >
                {chains.map((chain) => (
                  <option key={chain.id} value={chain.id}>
                    {chain.name} - {chain.description}
                  </option>
                ))}
              </select>
            </div>

            {/* Chain Grid */}
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4 mb-8">
              {chains.map((chain) => (
                <button
                  key={chain.id}
                  onClick={() => setSelectedChain(chain.id)}
                  className={`p-4 rounded-lg border text-center transition-all ${
                    selectedChain === chain.id
                      ? 'border-orange-500 bg-orange-500/10'
                      : 'border-gray-700 bg-[#2a2a2a] hover:border-gray-600'
                  }`}
                >
                  <div className="w-10 h-10 relative mx-auto mb-2">
                    <Image
                      src={chain.icon}
                      alt={`${chain.name} logo`}
                      fill
                      className="rounded-full"
                    />
                  </div>
                  <h3 className="font-semibold text-white text-sm">{chain.name}</h3>
                </button>
              ))}
            </div>

            {/* Action Button */}
            <div className="text-center">
              <Link
                href={address ? `/transactions/${selectedChain}?address=${encodeURIComponent(address)}` : `/transactions/${selectedChain}`}
                className="inline-block bg-orange-600 hover:bg-orange-700 text-white font-semibold py-4 px-8 rounded-lg transition-colors"
              >
                View {selectedChainData?.name} Transactions
              </Link>
            </div>

            {/* Info */}
            <div className="mt-12 p-6 bg-[#2a2a2a] rounded-lg border border-gray-800">
              <h3 className="font-semibold text-orange-500 mb-2">100% Client-Side</h3>
              <p className="text-gray-400 text-sm">
                This app fetches directly from blockchain nodes in your browser. 
                No API keys needed, no server timeouts, completely free and open source.
              </p>
            </div>
          </div>
        </main>

        {/* Footer */}
        <footer className="border-t border-gray-800 bg-[#1a1a1a]">
          <div className="container mx-auto px-4 py-6 text-center text-gray-500 text-sm">
            <p>Data provided by Etherscan.io API • Powered by various blockchain APIs</p>
          </div>
        </footer>
      </div>
    </>
  );
}
