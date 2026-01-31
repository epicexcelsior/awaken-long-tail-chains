'use client';

import React, { useState } from 'react';
import Head from 'next/head';
import Link from 'next/link';

const chains = [
  { id: 'osmosis', name: 'Osmosis', description: 'Cosmos DEX and DeFi hub' },
  { id: 'babylon', name: 'Babylon', description: 'Bitcoin staking protocol on Cosmos' },
  { id: 'near', name: 'NEAR Protocol', description: 'Scalable L1 blockchain' },
  { id: 'celo', name: 'Celo', description: 'Mobile-first blockchain for DeFi' },
  { id: 'fantom', name: 'Fantom', description: 'High-performance EVM chain' },
  { id: 'ronin', name: 'Ronin', description: 'Gaming-focused EVM chain' },
  { id: 'celestia', name: 'Celestia', description: 'Data availability layer' },
];

export default function Home() {
  const [selectedChain, setSelectedChain] = useState('celo');

  return (
    <>
      <Head>
        <title>Multi-Chain Transaction Dashboard</title>
      </Head>
      
      <div className="min-h-screen bg-[#1a1a1a] text-white">
        {/* Header */}
        <header className="border-b border-gray-800 bg-[#1a1a1a]">
          <div className="container mx-auto px-4 py-4">
            <h1 className="text-2xl font-bold text-orange-500">
              Multi-Chain Transaction Dashboard
            </h1>
          </div>
        </header>

        {/* Main Content */}
        <main className="container mx-auto px-4 py-12">
          <div className="max-w-2xl mx-auto">
            <h2 className="text-4xl font-bold mb-4 text-white">
              View Your Blockchain Transactions
            </h2>
            <p className="text-gray-400 mb-8 text-lg">
              Export to Awaken Tax CSV format for easy tax reporting.
            </p>

            {/* Chain Selector */}
            <div className="mb-8">
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Select Blockchain
              </label>
              <select
                value={selectedChain}
                onChange={(e) => setSelectedChain(e.target.value)}
                className="w-full bg-[#2a2a2a] border border-gray-700 rounded-lg px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-orange-500"
              >
                {chains.map((chain) => (
                  <option key={chain.id} value={chain.id}>
                    {chain.name} - {chain.description}
                  </option>
                ))}
              </select>
            </div>

            {/* Action Buttons */}
            <div className="space-y-4">
              <Link
                href={`/transactions/${selectedChain}`}
                className="block w-full bg-orange-600 hover:bg-orange-700 text-white font-semibold py-4 px-6 rounded-lg text-center transition-colors"
              >
                View {chains.find(c => c.id === selectedChain)?.name} Transactions
              </Link>
              
              <Link
                href="/about"
                className="block w-full bg-gray-800 hover:bg-gray-700 text-gray-300 font-semibold py-4 px-6 rounded-lg text-center transition-colors"
              >
                Learn More
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
        <footer className="border-t border-gray-800 bg-[#1a1a1a] mt-auto">
          <div className="container mx-auto px-4 py-6 text-center text-gray-500 text-sm">
            <p>Data provided by Etherscan.io API • Powered by various blockchain APIs</p>
          </div>
        </footer>
      </div>
    </>
  );
}
