'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { ArrowLeft, Download, Loader2 } from 'lucide-react';
import {
  fetchAllTransactionsClientSide as fetchCeloTransactions,
  parseTransaction as parseCeloTransaction,
  isValidCeloAddress,
} from "../../services/celo-client";
import {
  fetchAllTransactionsClientSide as fetchRoninTransactions,
  parseTransaction as parseRoninTransaction,
  isValidRoninAddress,
} from "../../services/ronin-client";
import {
  fetchAllTransactionsClientSide as fetchCelestiaTransactions,
  parseTransaction as parseCelestiaTransaction,
  isValidCelestiaAddress,
} from "../../services/celestia-client";
import {
  convertToAwakenCSV,
  generateCSVContent,
  downloadCSV,
} from "../../utils/csvExport";
import { ParsedTransaction } from "../../types";

// Chain configurations with validation functions
const chains = [
  { 
    id: 'celo', 
    name: 'Celo', 
    description: 'Mobile-first blockchain for DeFi', 
    color: '#FCFF52',
    fetch: fetchCeloTransactions,
    parse: parseCeloTransaction,
    isValid: isValidCeloAddress,
  },
  { 
    id: 'ronin', 
    name: 'Ronin', 
    description: 'Gaming-focused EVM chain', 
    color: '#1273EA',
    fetch: fetchRoninTransactions,
    parse: parseRoninTransaction,
    isValid: isValidRoninAddress,
  },
  { 
    id: 'celestia', 
    name: 'Celestia', 
    description: 'Data availability layer', 
    color: '#0074E4',
    fetch: fetchCelestiaTransactions,
    parse: parseCelestiaTransaction,
    isValid: isValidCelestiaAddress,
  },
  // Add other chains as they are implemented
  { 
    id: 'osmosis', 
    name: 'Osmosis', 
    description: 'Cosmos DEX and DeFi hub', 
    color: '#9D4EDD',
    fetch: fetchCeloTransactions, // Placeholder
    parse: parseCeloTransaction,
    isValid: (addr: string) => addr.startsWith('osmo'),
  },
  { 
    id: 'near', 
    name: 'NEAR Protocol', 
    description: 'Scalable L1 blockchain', 
    color: '#00C08B',
    fetch: fetchCeloTransactions, // Placeholder
    parse: parseCeloTransaction,
    isValid: () => true,
  },
  { 
    id: 'fantom', 
    name: 'Fantom', 
    description: 'High-performance EVM chain', 
    color: '#1969FF',
    fetch: fetchCeloTransactions, // Placeholder
    parse: parseCeloTransaction,
    isValid: (addr: string) => addr.startsWith('0x'),
  },
  { 
    id: 'babylon', 
    name: 'Babylon', 
    description: 'Bitcoin staking protocol on Cosmos', 
    color: '#CE6533',
    fetch: fetchCeloTransactions, // Placeholder
    parse: parseCeloTransaction,
    isValid: (addr: string) => addr.startsWith('bbn'),
  },
];

interface TransactionsClientProps {
  chainId: string;
}

export default function TransactionsClient({ chainId }: TransactionsClientProps) {
  const searchParams = useSearchParams();
  const [address, setAddress] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [transactions, setTransactions] = useState<ParsedTransaction[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [metadata, setMetadata] = useState<any>(null);
  
  const chain = chains.find(c => c.id === chainId);

  // Read address from URL query params
  useEffect(() => {
    const addressFromUrl = searchParams.get('address');
    if (addressFromUrl) {
      setAddress(addressFromUrl);
    }
  }, [searchParams]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!chain) return;
    
    setIsLoading(true);
    setError(null);
    setTransactions([]);
    
    try {
      // Validate address
      if (!chain.isValid(address.trim())) {
        throw new Error(`Invalid ${chain.name} address format`);
      }

      // Fetch transactions with progress callback
      const result = await chain.fetch(
        address.trim(),
        (count: number, _page?: number) => {
          console.log(`[${chain.name}] Fetched ${count} transactions`);
        }
      );

      setMetadata(result.metadata);

      // Parse transactions - handle different return types
      const parsed = result.transactions.map((tx: any) =>
        chain.parse(tx, address.trim())
      );

      setTransactions(parsed);
    } catch (err: any) {
      console.error('Error fetching transactions:', err);
      setError(err.message || 'Failed to fetch transactions');
    } finally {
      setIsLoading(false);
    }
  };

  const handleExportCSV = () => {
    if (transactions.length === 0 || !chain) return;
    
    const csvRows = convertToAwakenCSV(transactions, address, 'standard');
    const csvContent = generateCSVContent(csvRows);
    const filename = `${chain.id}-transactions-${address.slice(0, 8)}-${new Date().toISOString().split('T')[0]}.csv`;
    
    downloadCSV(csvContent, filename);
  };

  if (!chain) {
    return (
      <div className="min-h-screen bg-[#1a1a1a] text-white flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-4">Chain Not Found</h1>
          <Link href="/" className="text-orange-500 hover:text-orange-400">
            Return to Home
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#1a1a1a] text-white">
      {/* Header */}
      <header className="border-b border-gray-800 bg-[#1a1a1a]">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <Link href="/" className="flex items-center text-gray-400 hover:text-white transition-colors">
            <ArrowLeft className="w-5 h-5 mr-2" />
            Back
          </Link>
          <h1 className="text-xl font-bold text-orange-500">
            {chain.name} Transactions
          </h1>
          <div className="w-20"></div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-8">
        <div className="max-w-4xl mx-auto">
          {/* Address Input */}
          <div className="bg-[#2a2a2a] rounded-lg p-6 mb-8 border border-gray-800">
            <form onSubmit={handleSubmit}>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Wallet Address
              </label>
              <div className="flex gap-4">
                <input
                  type="text"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  placeholder={`Enter ${chain.name} address...`}
                  className="flex-1 bg-[#1a1a1a] border border-gray-700 rounded-lg px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-orange-500"
                />
                <button
                  type="submit"
                  disabled={isLoading}
                  className="bg-orange-600 hover:bg-orange-700 disabled:bg-gray-700 text-white font-semibold py-3 px-6 rounded-lg transition-colors flex items-center"
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                      Loading...
                    </>
                  ) : (
                    'Fetch Transactions'
                  )}
                </button>
              </div>
              {error && (
                <p className="mt-2 text-red-400 text-sm">{error}</p>
              )}
            </form>
          </div>

          {/* Results Section */}
          {transactions.length > 0 && (
            <div className="bg-[#2a2a2a] rounded-lg p-6 border border-gray-800">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h2 className="text-xl font-semibold">
                    Transactions ({transactions.length})
                  </h2>
                  {metadata && (
                    <p className="text-sm text-gray-400 mt-1">
                      Fetched via {metadata.dataSource || 'API'}
                      {metadata.firstTransactionDate && (
                        <span> • {new Date(metadata.firstTransactionDate).toLocaleDateString()} - {new Date(metadata.lastTransactionDate).toLocaleDateString()}</span>
                      )}
                    </p>
                  )}
                </div>
                <button 
                  onClick={handleExportCSV}
                  className="flex items-center bg-gray-800 hover:bg-gray-700 text-white py-2 px-4 rounded-lg transition-colors"
                >
                  <Download className="w-4 h-4 mr-2" />
                  Export CSV
                </button>
              </div>
              
              {/* Transaction Table */}
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-700">
                      <th className="text-left py-3 px-4 text-gray-400 font-medium">Date</th>
                      <th className="text-left py-3 px-4 text-gray-400 font-medium">Type</th>
                      <th className="text-left py-3 px-4 text-gray-400 font-medium">Amount</th>
                      <th className="text-left py-3 px-4 text-gray-400 font-medium">Currency</th>
                      <th className="text-left py-3 px-4 text-gray-400 font-medium">Status</th>
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
                            tx.status === 'success' 
                              ? 'bg-green-900 text-green-300' 
                              : 'bg-red-900 text-red-300'
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

          {/* Empty State */}
          {!isLoading && transactions.length === 0 && !error && (
            <div className="text-center py-12 text-gray-500">
              <p>Enter a wallet address above to view transactions</p>
            </div>
          )}
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-gray-800 bg-[#1a1a1a] mt-auto">
        <div className="container mx-auto px-4 py-6 text-center text-gray-500 text-sm">
          <p>Data provided by {chain.name} API • Export to Awaken Tax format</p>
        </div>
      </footer>
    </div>
  );
}
