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
    icon: '/chains/celo.svg'
  },
  { 
    id: 'ronin', 
    name: 'Ronin', 
    description: 'Gaming-focused EVM chain',
    icon: '/chains/ronin.svg'
  },
  { 
    id: 'celestia', 
    name: 'Celestia', 
    description: 'Data availability layer',
    icon: '/chains/celestia.svg'
  },
  { 
    id: 'osmosis', 
    name: 'Osmosis', 
    description: 'Cosmos DEX and DeFi hub',
    icon: '/chains/osmosis.svg'
  },
  { 
    id: 'near', 
    name: 'NEAR Protocol', 
    description: 'Scalable L1 blockchain',
    icon: '/chains/near.svg'
  },
  { 
    id: 'fantom', 
    name: 'Fantom', 
    description: 'High-performance EVM chain',
    icon: '/chains/fantom.svg'
  },
  { 
    id: 'babylon', 
    name: 'Babylon', 
    description: 'Bitcoin staking protocol',
    icon: '/chains/babylon.svg'
  },
];

export default function Home() {
  const [selectedChain, setSelectedChain] = useState<string | null>(null);

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
            <div className="text-center mb-12">
              <h2 className="text-4xl font-bold mb-4 text-white">
                View Your Blockchain Transactions
              </h2>
              <p className="text-gray-400 text-lg">
                Select a blockchain to view transactions and export to Awaken Tax CSV format.
              </p>
            </div>

            {/* Chain Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-12">
              {chains.map((chain) => (
                <button
                  key={chain.id}
                  onClick={() => setSelectedChain(chain.id)}
                  className={`p-6 rounded-lg border text-left transition-all ${
                    selectedChain === chain.id
                      ? 'border-orange-500 bg-orange-500/10'
                      : 'border-gray-700 bg-[#2a2a2a] hover:border-gray-600'
                  }`}
                >
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 relative flex-shrink-0">
                      <Image
                        src={chain.icon}
                        alt={`${chain.name} logo`}
                        fill
                        className="rounded-full"
                      />
                    </div>
                    <div>
                      <h3 className="font-semibold text-white">{chain.name}</h3>
                      <p className="text-sm text-gray-400">{chain.description}</p>
                    </div>
                  </div>
                </button>
              ))}
            </div>

            {/* Action Button */}
            {selectedChain && (
              <div className="text-center">
                <Link
                  href={`/transactions/${selectedChain}`}
                  className="inline-block bg-orange-600 hover:bg-orange-700 text-white font-semibold py-4 px-8 rounded-lg transition-colors"
                >
                  View {chains.find(c => c.id === selectedChain)?.name} Transactions
                </Link>
              </div>
            )}

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
