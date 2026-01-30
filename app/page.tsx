'use client';

import { useState } from 'react';
import { WalletInput } from './components/wallet-input';
import { TransactionTable } from './components/transaction-table';
import { ErrorDisplay } from './components/error-display';
import { fetchAllTransactions, parseTransaction, isValidOsmosisAddress } from './services/osmosis';
import { convertToAwakenCSV, generateCSVContent, downloadCSV, generateFilename } from './utils/csvExport';
import { OsmosisTransaction, ParsedTransaction } from './types';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

export default function Home() {
  const [transactions, setTransactions] = useState<ParsedTransaction[]>([]);
  const [rawTransactions, setRawTransactions] = useState<OsmosisTransaction[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentAddress, setCurrentAddress] = useState<string>('');

  const handleWalletSubmit = async (address: string) => {
    setIsLoading(true);
    setError(null);
    setTransactions([]);
    setRawTransactions([]);

    try {
      // Validate address
      if (!isValidOsmosisAddress(address)) {
        throw new Error('Invalid Osmosis address format');
      }

      setCurrentAddress(address);

      // Fetch transactions
      const txs = await fetchAllTransactions(address, 100);
      setRawTransactions(txs);

      // Parse transactions
      const parsed = txs.map((tx) => parseTransaction(tx, address));
      setTransactions(parsed);

      if (parsed.length === 0) {
        setError('No transactions found for this address. The wallet may be new or unused.');
      }
    } catch (err) {
      console.error('Error fetching transactions:', err);
      setError(
        err instanceof Error 
          ? err.message 
          : 'Failed to fetch transactions. Please check the address and try again.'
      );
    } finally {
      setIsLoading(false);
    }
  };

  const handleDownloadCSV = () => {
    if (transactions.length === 0 || !currentAddress) return;

    const awakenRows = convertToAwakenCSV(transactions, currentAddress);
    const csvContent = generateCSVContent(awakenRows);
    const filename = generateFilename(currentAddress);
    
    downloadCSV(csvContent, filename);
  };

  return (
    <main className="min-h-screen bg-gradient-to-b from-slate-50 to-slate-100 dark:from-slate-950 dark:to-slate-900">
      <div className="container mx-auto px-4 py-12 max-w-6xl">
        {/* Header */}
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold tracking-tight text-slate-900 dark:text-slate-50 mb-4">
            Osmosis Transaction Viewer
          </h1>
          <p className="text-lg text-slate-600 dark:text-slate-400 max-w-2xl mx-auto">
            View your Osmosis blockchain transactions and export them in Awaken Tax CSV format for easy tax reporting.
          </p>
        </div>

        {/* API Key Notice */}
        <div className="mb-8 p-4 bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 rounded-lg max-w-3xl mx-auto">
          <h3 className="font-semibold text-blue-900 dark:text-blue-100 mb-2">
            API Configuration
          </h3>
          <p className="text-sm text-blue-800 dark:text-blue-200">
            This app uses the free Osmosis LCD API by default. For production use with higher rate limits, 
            you can configure a Mintscan API key via environment variables: 
            <code className="bg-blue-100 dark:bg-blue-900 px-2 py-1 rounded mx-1">NEXT_PUBLIC_MINTSCAN_API_KEY</code>
          </p>
          <p className="text-sm text-blue-800 dark:text-blue-200 mt-2">
            Get your API key at:{' '}
            <a 
              href="https://api.mintscan.io" 
              target="_blank" 
              rel="noopener noreferrer"
              className="underline hover:text-blue-600"
            >
              api.mintscan.io
            </a>
          </p>
        </div>

        {/* Wallet Input */}
        <WalletInput onSubmit={handleWalletSubmit} isLoading={isLoading} />

        {/* Error Display */}
        {error && !isLoading && (
          <div className="mt-8">
            <ErrorDisplay 
              error={error} 
              onRetry={() => currentAddress && handleWalletSubmit(currentAddress)} 
            />
          </div>
        )}

        {/* Transaction Table */}
        {!isLoading && transactions.length > 0 && (
          <div className="mt-8">
            <TransactionTable 
              transactions={transactions} 
              onDownloadCSV={handleDownloadCSV}
              walletAddress={currentAddress}
            />
          </div>
        )}

        {/* Info Section */}
        {!isLoading && transactions.length === 0 && !error && (
          <div className="mt-16 grid md:grid-cols-3 gap-6 max-w-4xl mx-auto">
            <div className="p-6 bg-white dark:bg-slate-800 rounded-lg shadow-sm border border-slate-200 dark:border-slate-700">
              <h3 className="font-semibold text-lg mb-2">1. Enter Address</h3>
              <p className="text-sm text-slate-600 dark:text-slate-400">
                Input your Osmosis wallet address starting with &quot;osmo&quot;
              </p>
            </div>
            <div className="p-6 bg-white dark:bg-slate-800 rounded-lg shadow-sm border border-slate-200 dark:border-slate-700">
              <h3 className="font-semibold text-lg mb-2">2. View Transactions</h3>
              <p className="text-sm text-slate-600 dark:text-slate-400">
                Browse your transaction history with detailed information
              </p>
            </div>
            <div className="p-6 bg-white dark:bg-slate-800 rounded-lg shadow-sm border border-slate-200 dark:border-slate-700">
              <h3 className="font-semibold text-lg mb-2">3. Export CSV</h3>
              <p className="text-sm text-slate-600 dark:text-slate-400">
                Download your transactions in Awaken Tax CSV format
              </p>
            </div>
          </div>
        )}

        {/* Footer */}
        <footer className="mt-16 text-center text-sm text-slate-500 dark:text-slate-400">
          <p>
            Built for the Osmosis ecosystem. CSV format compatible with{' '}
            <a 
              href="https://awaken.tax" 
              target="_blank" 
              rel="noopener noreferrer"
              className="underline hover:text-slate-700 dark:hover:text-slate-300"
            >
              Awaken Tax
            </a>
          </p>
          <p className="mt-2">
            <a 
              href="https://github.com/epicexcelsior/osmosis-awaken-tax" 
              target="_blank" 
              rel="noopener noreferrer"
              className="underline hover:text-slate-700 dark:hover:text-slate-300"
            >
              View on GitHub
            </a>
          </p>
        </footer>
      </div>
    </main>
  );
}
