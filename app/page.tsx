'use client';

import React, { useState } from 'react';
import Head from 'next/head';
import Image from 'next/image';
import { Loader2, Download, ArrowLeft } from 'lucide-react';
import {
  fetchAllTransactionsClientSide as fetchCeloTransactions,
  parseTransaction as parseCeloTransaction,
  isValidCeloAddress,
} from "./services/celo-client";
import {
  fetchAllTransactionsClientSide as fetchRoninTransactions,
  parseTransaction as parseRoninTransaction,
  isValidRoninAddress,
} from "./services/ronin-client";
import {
  fetchAllTransactionsClientSide as fetchCelestiaTransactions,
  parseTransaction as parseCelestiaTransaction,
  isValidCelestiaAddress,
} from "./services/celestia-client";
import {
  convertToAwakenCSV,
  generateCSVContent,
  downloadCSV,
} from "./utils/csvExport";
import { ParsedTransaction } from "./types";

const chains = [
  { id: 'celo', name: 'Celo', icon: '/chains/celo.svg', placeholder: '0x...', color: '#FCFF52' },
  { id: 'ronin', name: 'Ronin', icon: '/chains/ronin.svg', placeholder: '0x...', color: '#1273EA' },
  { id: 'celestia', name: 'Celestia', icon: '/chains/celestia.svg', placeholder: 'celestia...', color: '#0074E4' },
  { id: 'osmosis', name: 'Osmosis', icon: '/chains/osmosis.svg', placeholder: 'osmo...', color: '#9D4EDD' },
  { id: 'near', name: 'NEAR', icon: '/chains/near.svg', placeholder: 'alice.near', color: '#00C08B' },
  { id: 'fantom', name: 'Fantom', icon: '/chains/fantom.svg', placeholder: '0x...', color: '#1969FF' },
  { id: 'babylon', name: 'Babylon', icon: '/chains/babylon.svg', placeholder: 'bbn...', color: '#CE6533' },
];

const chainHandlers: Record<string, any> = {
  celo: { fetch: fetchCeloTransactions, parse: parseCeloTransaction, isValid: isValidCeloAddress },
  ronin: { fetch: fetchRoninTransactions, parse: parseRoninTransaction, isValid: isValidRoninAddress },
  celestia: { fetch: fetchCelestiaTransactions, parse: parseCelestiaTransaction, isValid: isValidCelestiaAddress },
  // Placeholders for others
  osmosis: { fetch: fetchCeloTransactions, parse: parseCeloTransaction, isValid: (addr: string) => addr.startsWith('osmo') },
  near: { fetch: fetchCeloTransactions, parse: parseCeloTransaction, isValid: () => true },
  fantom: { fetch: fetchCeloTransactions, parse: parseCeloTransaction, isValid: (addr: string) => addr.startsWith('0x') },
  babylon: { fetch: fetchCeloTransactions, parse: parseCeloTransaction, isValid: (addr: string) => addr.startsWith('bbn') },
};

export default function Home() {
  const [selectedChain, setSelectedChain] = useState('celo');
  const [address, setAddress] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [transactions, setTransactions] = useState<ParsedTransaction[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [metadata, setMetadata] = useState<any>(null);
  const [showResults, setShowResults] = useState(false);

  const currentChain = chains.find(c => c.id === selectedChain);
  const handler = chainHandlers[selectedChain];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!handler) return;

    setIsLoading(true);
    setError(null);
    setTransactions([]);
    setShowResults(true);

    try {
      if (!handler.isValid(address.trim())) {
        throw new Error(`Invalid address format for ${currentChain?.name}. Expected: ${currentChain?.placeholder}`);
      }

      const result = await handler.fetch(address.trim(), (count: number) => {
        console.log(`Fetched ${count} transactions`);
      });

      setMetadata(result.metadata);
      const parsed = result.transactions.map((tx: any) => handler.parse(tx, address.trim()));
      setTransactions(parsed);
    } catch (err: any) {
      setError(err.message || 'Failed to fetch transactions');
    } finally {
      setIsLoading(false);
    }
  };

  const handleExportCSV = () => {
    if (transactions.length === 0) return;
    const csvRows = convertToAwakenCSV(transactions, address, 'standard');
    const csvContent = generateCSVContent(csvRows);
    const filename = `${selectedChain}-transactions-${address.slice(0, 8)}-${new Date().toISOString().split('T')[0]}.csv`;
    downloadCSV(csvContent, filename);
  };

  const handleBack = () => {
    setShowResults(false);
    setTransactions([]);
    setError(null);
  };

  if (showResults) {
    return (
      <div className="min-h-screen bg-[#1a1a1a] text-white">
        <header className="border-b border-gray-800 bg-[#1a1a1a]">
          <div className="container mx-auto px-4 py-4 flex items-center">
            <button onClick={handleBack} className="flex items-center text-gray-400 hover:text-white">
              <ArrowLeft className="w-5 h-5 mr-2" /> Back
            </button>
            <h1 className="text-xl font-bold text-orange-500 ml-4">{currentChain?.name} Transactions</h1>
          </div>
        </header>

        <main className="container mx-auto px-4 py-8">
          <div className="max-w-4xl mx-auto">
            {isLoading && (
              <div className="text-center py-12">
                <Loader2 className="w-8 h-8 animate-spin mx-auto mb-4 text-orange-500" />
                <p>Loading transactions...</p>
              </div>
            )}

            {error && (
              <div className="bg-red-900/50 border border-red-700 rounded-lg p-4 mb-6">
                <p className="text-red-400">{error}</p>
              </div>
            )}

            {transactions.length > 0 && (
              <div className="bg-[#2a2a2a] rounded-lg p-6 border border-gray-800">
                <div className="flex items-center justify-between mb-6">
                  <div>
                    <h2 className="text-xl font-semibold">Transactions ({transactions.length})</h2>
                    {metadata && (
                      <p className="text-sm text-gray-400 mt-1">
                        Via {metadata.dataSource} • {new Date(metadata.firstTransactionDate).toLocaleDateString()} - {new Date(metadata.lastTransactionDate).toLocaleDateString()}
                      </p>
                    )}
                  </div>
                  <button onClick={handleExportCSV} className="flex items-center bg-gray-800 hover:bg-gray-700 text-white py-2 px-4 rounded-lg">
                    <Download className="w-4 h-4 mr-2" /> Export CSV
                  </button>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-gray-700">
                        <th className="text-left py-3 px-4 text-gray-400">Date</th>
                        <th className="text-left py-3 px-4 text-gray-400">Type</th>
                        <th className="text-left py-3 px-4 text-gray-400">Amount</th>
                        <th className="text-left py-3 px-4 text-gray-400">Currency</th>
                        <th className="text-left py-3 px-4 text-gray-400">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {transactions.map((tx, idx) => (
                        <tr key={idx} className="border-b border-gray-800 hover:bg-[#333]">
                          <td className="py-3 px-4">{tx.timestamp.toLocaleString()}</td>
                          <td className="py-3 px-4 capitalize">{tx.type}</td>
                          <td className="py-3 px-4">{tx.amount || tx.amount2 || '-'}</td>
                          <td className="py-3 px-4">{tx.currency || tx.currency2 || '-'}</td>
                          <td className="py-3 px-4">
                            <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                              tx.status === 'success' ? 'bg-green-900 text-green-300' : 'bg-red-900 text-red-300'
                            }`}>
                              {tx.status}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {!isLoading && transactions.length === 0 && !error && (
              <div className="text-center py-12 text-gray-500">
                <p>No transactions found for this address.</p>
              </div>
            )}
          </div>
        </main>
      </div>
    );
  }

  return (
    <>
      <Head>
        <title>Multi-Chain Transaction Dashboard</title>
      </Head>
      
      <div className="min-h-screen bg-[#1a1a1a] text-white flex flex-col">
        <header className="border-b border-gray-800 bg-[#1a1a1a]">
          <div className="container mx-auto px-4 py-4">
            <h1 className="text-2xl font-bold text-orange-500">Multi-Chain Transaction Dashboard</h1>
          </div>
        </header>

        <main className="container mx-auto px-4 py-12 flex-grow">
          <div className="max-w-4xl mx-auto">
            <div className="text-center mb-12">
              <h2 className="text-4xl font-bold mb-4">View Your Blockchain Transactions</h2>
              <p className="text-gray-400 text-lg">Select a blockchain and enter your wallet address to view transactions.</p>
            </div>

            {/* Chain Selection */}
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
                    <Image src={chain.icon} alt={chain.name} fill className="rounded-full" />
                  </div>
                  <h3 className="font-semibold text-sm">{chain.name}</h3>
                </button>
              ))}
            </div>

            {/* Address Input */}
            <div className="bg-[#2a2a2a] rounded-lg p-6 border border-gray-800 max-w-2xl mx-auto">
              <form onSubmit={handleSubmit}>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  {currentChain?.name} Wallet Address
                </label>
                <input
                  type="text"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  placeholder={`Enter ${currentChain?.placeholder || 'address'}...`}
                  className="w-full bg-[#1a1a1a] border border-gray-700 rounded-lg px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-orange-500 mb-4"
                />
                <button
                  type="submit"
                  disabled={isLoading || !address}
                  className="w-full bg-orange-600 hover:bg-orange-700 disabled:bg-gray-700 text-white font-semibold py-3 px-6 rounded-lg transition-colors flex items-center justify-center"
                >
                  {isLoading ? (
                    <><Loader2 className="w-5 h-5 mr-2 animate-spin" /> Loading...</>
                  ) : (
                    `View ${currentChain?.name} Transactions`
                  )}
                </button>
              </form>
            </div>

            {/* Info */}
            <div className="mt-12 p-6 bg-[#2a2a2a] rounded-lg border border-gray-800 max-w-2xl mx-auto">
              <h3 className="font-semibold text-orange-500 mb-2">100% Client-Side</h3>
              <p className="text-gray-400 text-sm">
                This app fetches directly from blockchain nodes in your browser. 
                No API keys needed, no server timeouts, completely free and open source.
              </p>
            </div>
          </div>
        </main>

        <footer className="border-t border-gray-800 bg-[#1a1a1a]">
          <div className="container mx-auto px-4 py-6 text-center text-gray-500 text-sm">
            <p>Data provided by Etherscan.io API • Powered by various blockchain APIs</p>
          </div>
        </footer>
      </div>
    </>
  );
}
