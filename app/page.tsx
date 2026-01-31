"use client";

import { useState } from "react";
import { WalletInput } from "./components/wallet-input";
import { TransactionTable } from "./components/transaction-table";
import { ErrorDisplay } from "./components/error-display";
import {
  fetchAllTransactionsClientSide as fetchOsmosisTransactions,
  parseTransaction as parseOsmosisTransaction,
  isValidOsmosisAddress,
} from "./services/osmosis-client";
import {
  fetchAllTransactionsClientSide as fetchBabylonTransactions,
  parseTransaction as parseBabylonTransaction,
  isValidBabylonAddress,
} from "./services/babylon-client";
import {
  fetchAllTransactionsClientSide as fetchCeloTransactions,
  parseTransaction as parseCeloTransaction,
  isValidCeloAddress,
} from "./services/celo-client";
import {
  fetchAllTransactionsClientSide as fetchTatumTransactions,
  parseTransaction as parseTatumTransaction,
  isValidEvmAddress,
} from "./services/tatum-client";
import {
  fetchAllTransactionsClientSide as fetchNearTransactions,
  parseTransaction as parseNearTransaction,
  isValidNearAddress,
} from "./services/near-client";
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
  generateFilename,
} from "./utils/csvExport";
import {
  OsmosisTransaction,
  ChainTransaction,
  ParsedTransaction,
  CSVFormat,
  ChainId,
} from "./types";
import { CHAIN_CONFIGS, DEFAULT_CHAIN } from "./config/chains";

export default function Home() {
  const [transactions, setTransactions] = useState<ParsedTransaction[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentAddress, setCurrentAddress] = useState<string>("");
  const [csvFormat, setCsvFormat] = useState<CSVFormat>("standard");
  const [txMetadata, setTxMetadata] = useState<any>(null);
  const [txVerification, setTxVerification] = useState<any>(null);
  const [selectedChain, setSelectedChain] = useState<ChainId>(DEFAULT_CHAIN);

  const chainConfig = CHAIN_CONFIGS[selectedChain];

  const handleWalletSubmit = async (address: string) => {
    setIsLoading(true);
    setError(null);
    setTransactions([]);
    setTxMetadata(null);
    setTxVerification(null);

    try {
      setCurrentAddress(address);
      let parsed: ParsedTransaction[] = [];

      if (selectedChain === "osmosis") {
        if (!isValidOsmosisAddress(address)) {
          throw new Error("Invalid Osmosis address format");
        }

        const result = await fetchOsmosisTransactions(
          address,
          (count, total) => {
            console.log(
              `[Progress] Fetched ${count} of ~${total} transactions`,
            );
          },
        );

        setTxMetadata(result.metadata);
        parsed = result.transactions.map((tx: OsmosisTransaction) =>
          parseOsmosisTransaction(tx, address),
        );

        setTxVerification({
          complete: result.transactions.length > 0,
          message:
            result.transactions.length > 0
              ? `✓ Found ${result.transactions.length} transactions`
              : "No transactions found",
        });
      } else if (selectedChain === "babylon") {
        if (!isValidBabylonAddress(address)) {
          throw new Error("Invalid Babylon address format");
        }

        const result = await fetchBabylonTransactions(
          address,
          (count, query, page) => {
            console.log(`[Progress] ${query}: page ${page}, ${count} total`);
          },
        );

        setTxMetadata(result.metadata);
        parsed = result.transactions.map((tx: ChainTransaction) =>
          parseBabylonTransaction(tx, address),
        );

        setTxVerification({
          complete: result.transactions.length > 0,
          message:
            result.transactions.length > 0
              ? `✓ Found ${result.transactions.length} transactions`
              : "No transactions found",
        });
      } else if (selectedChain === "celo") {
        // Celo via Etherscan v2 API
        if (!isValidCeloAddress(address)) {
          throw new Error(
            `Invalid ${chainConfig.displayName} address format. Must be 0x followed by 40 hex characters.`,
          );
        }

        const result = await fetchCeloTransactions(
          address,
          (count, page) => {
            console.log(`[Progress] Celo page ${page}, ${count} total transactions`);
          },
        );

        setTxMetadata(result.metadata);
        parsed = result.transactions.map((tx: ChainTransaction) =>
          parseCeloTransaction(tx, address),
        );

        setTxVerification({
          complete: result.transactions.length > 0,
          message:
            result.transactions.length > 0
              ? `✓ Found ${result.transactions.length} transactions via Etherscan v2 API`
              : "No transactions found",
        });
      } else if (selectedChain === "fantom") {
        // Fantom via Tatum API (deprecated - consider migrating to Etherscan v2 when available)
        if (!isValidEvmAddress(address)) {
          throw new Error(
            `Invalid ${chainConfig.displayName} address format. Must be 0x followed by 40 hex characters.`,
          );
        }

        const result = await fetchTatumTransactions(
          selectedChain,
          address,
          (count) => {
            console.log(`[Progress] Fetched ${count} transactions`);
          },
        );

        setTxMetadata(result.metadata);
        parsed = result.transactions.map((tx: ChainTransaction) =>
          parseTatumTransaction(tx, address),
        );

        setTxVerification({
          complete: result.transactions.length > 0,
          message:
            result.transactions.length > 0
              ? `✓ Found ${result.transactions.length} transactions via Tatum API`
              : "No transactions found",
        });
      } else if (selectedChain === "near") {
        // NEAR Protocol via Pikespeak API
        if (!isValidNearAddress(address)) {
          throw new Error(
            `Invalid ${chainConfig.displayName} address format. Must be a named account (e.g., alice.near) or 64-character hex address.`,
          );
        }

        const result = await fetchNearTransactions(
          address,
          (count, page) => {
            console.log(`[Progress] NEAR page ${page}, ${count} total transactions`);
          },
        );

        setTxMetadata(result.metadata);
        parsed = result.transactions.map((tx: ChainTransaction) =>
          parseNearTransaction(tx, address),
        );

        setTxVerification({
          complete: result.transactions.length > 0,
          message:
            result.transactions.length > 0
              ? `✓ Found ${result.transactions.length} transactions via Pikespeak API`
              : "No transactions found",
        });
      } else if (selectedChain === "ronin") {
        // Ronin via GoldRush API
        if (!isValidRoninAddress(address)) {
          throw new Error(
            `Invalid ${chainConfig.displayName} address format. Must be 0x followed by 40 hex characters.`,
          );
        }

        const result = await fetchRoninTransactions(
          address,
          (count, page) => {
            console.log(`[Progress] Ronin page ${page}, ${count} total transactions`);
          },
        );

        setTxMetadata(result.metadata);
        parsed = result.transactions.map((tx: ChainTransaction) =>
          parseRoninTransaction(tx, address),
        );

        setTxVerification({
          complete: result.transactions.length > 0,
          message:
            result.transactions.length > 0
              ? `✓ Found ${result.transactions.length} transactions via GoldRush API`
              : "No transactions found",
        });
      } else if (selectedChain === "celestia") {
        // Celestia via Celenium API
        if (!isValidCelestiaAddress(address)) {
          throw new Error(
            `Invalid ${chainConfig.displayName} address format. Must start with "celestia" followed by 39 alphanumeric characters.`,
          );
        }

        const result = await fetchCelestiaTransactions(
          address,
          (count, page) => {
            console.log(`[Progress] Celestia page ${page}, ${count} total transactions`);
          },
        );

        setTxMetadata(result.metadata);
        parsed = result.transactions.map((tx: ChainTransaction) =>
          parseCelestiaTransaction(tx, address),
        );

        setTxVerification({
          complete: result.transactions.length > 0,
          message:
            result.transactions.length > 0
              ? `✓ Found ${result.transactions.length} transactions via Celenium API`
              : "No transactions found",
        });
      }

      setTransactions(parsed);

      if (parsed.length === 0) {
        setError(
          "No transactions found for this address. The wallet may be new or unused.",
        );
      }
    } catch (err) {
      console.error("Error fetching transactions:", err);
      setError(
        err instanceof Error
          ? err.message
          : "Failed to fetch transactions. Please check the address and try again.",
      );
    } finally {
      setIsLoading(false);
    }
  };

  const handleDownloadCSV = () => {
    if (transactions.length === 0 || !currentAddress) return;

    const awakenRows = convertToAwakenCSV(
      transactions,
      currentAddress,
      csvFormat,
    );
    const csvContent = generateCSVContent(awakenRows);
    const filename = `${selectedChain}-awaken-${currentAddress.slice(0, 8)}-${new Date().toISOString().split("T")[0]}.csv`;

    downloadCSV(csvContent, filename);
  };

  return (
    <main className="min-h-screen bg-gradient-to-b from-slate-50 to-slate-100 dark:from-slate-950 dark:to-slate-900">
      <div className="container mx-auto px-4 py-12 max-w-6xl">
        {/* Header */}
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold tracking-tight text-slate-900 dark:text-slate-50 mb-4">
            Multi-Chain Transaction Viewer
          </h1>
          <p className="text-lg text-slate-600 dark:text-slate-400 max-w-2xl mx-auto">
            View your blockchain transactions and export them in Awaken Tax CSV
            format for easy tax reporting.
          </p>
        </div>

        {/* Client-side Notice */}
        <div className="mb-8 p-4 bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800 rounded-lg max-w-3xl mx-auto">
          <h3 className="font-semibold text-green-900 dark:text-green-100 mb-2">
            100% Client-Side - No Server Needed!
          </h3>
          <p className="text-sm text-green-800 dark:text-green-200">
            This app fetches directly from blockchain nodes in your browser. No
            API keys needed, no server timeouts, completely free and open
            source.
          </p>
        </div>

        {/* Wallet Input with Chain Selector */}
        <WalletInput
          onSubmit={handleWalletSubmit}
          isLoading={isLoading}
          selectedChain={selectedChain}
          onChainChange={setSelectedChain}
        />

        {/* Error Display */}
        {error && !isLoading && (
          <div className="mt-8">
            <ErrorDisplay
              error={error}
              onRetry={() =>
                currentAddress && handleWalletSubmit(currentAddress)
              }
            />
          </div>
        )}

        {/* Transaction Table */}
        {!isLoading && transactions.length > 0 && (
          <div className="mt-8">
            {/* CSV Format Selector */}
            <div className="mb-6 flex items-center justify-between bg-white dark:bg-slate-800 p-4 rounded-lg border border-slate-200 dark:border-slate-700">
              <div className="flex items-center gap-4">
                <label className="font-semibold text-slate-700 dark:text-slate-300">
                  CSV Export Format:
                </label>
                <select
                  value={csvFormat}
                  onChange={(e) => setCsvFormat(e.target.value as CSVFormat)}
                  className="px-3 py-2 rounded-md border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100"
                >
                  <option value="standard">Standard (Transactions)</option>
                  <option value="trading">Trading/Perpetuals</option>
                </select>
              </div>
              <div className="text-sm text-slate-500 dark:text-slate-400">
                {csvFormat === "standard" ? (
                  <span>
                    Columns: Date, Received/Sent Qty, Currency, Fee, Notes
                  </span>
                ) : (
                  <span>Columns: Date, Asset, Amount, P&L, Fee, Tag</span>
                )}
              </div>
            </div>

            <TransactionTable
              transactions={transactions}
              onDownloadCSV={handleDownloadCSV}
              walletAddress={currentAddress}
            />

            {/* Transaction Completeness Info */}
            {txVerification && (
              <div
                className={`mt-6 p-4 rounded-lg border ${txVerification.complete ? "bg-green-50 border-green-200 dark:bg-green-950/30 dark:border-green-800" : "bg-yellow-50 border-yellow-200"}`}
              >
                <div className="flex items-start gap-3">
                  <div
                    className={`mt-0.5 ${txVerification.complete ? "text-green-600" : "text-yellow-600"}`}
                  >
                    {txVerification.complete ? "✓" : "⚠"}
                  </div>
                  <div className="flex-1">
                    <h4
                      className={`font-semibold ${txVerification.complete ? "text-green-900 dark:text-green-100" : "text-yellow-900"}`}
                    >
                      {txVerification.complete
                        ? "Transaction History Retrieved"
                        : "Partial Data"}
                    </h4>
                    <p
                      className={`text-sm mt-1 ${txVerification.complete ? "text-green-800 dark:text-green-200" : "text-yellow-800"}`}
                    >
                      {txVerification.message}
                    </p>
                    {txMetadata && (
                      <div className="mt-3 text-sm text-slate-600 dark:text-slate-400 space-y-1">
                        <p>
                          <strong>Chain:</strong> {chainConfig.displayName}
                        </p>
                        <p>
                          <strong>Total Transactions:</strong>{" "}
                          {txMetadata.totalFetched?.toLocaleString() ||
                            transactions.length}
                        </p>
                        {txMetadata.firstTransactionDate && (
                          <p>
                            <strong>Date Range:</strong>{" "}
                            {new Date(
                              txMetadata.firstTransactionDate,
                            ).toLocaleDateString()}{" "}
                            -{" "}
                            {new Date(
                              txMetadata.lastTransactionDate,
                            ).toLocaleDateString()}
                          </p>
                        )}
                        <p>
                          <strong>Data Source:</strong>{" "}
                          {txMetadata.dataSource || "LCD API"}
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Info Section */}
        {!isLoading && transactions.length === 0 && !error && (
          <div className="mt-16 grid md:grid-cols-3 gap-6 max-w-4xl mx-auto">
            <div className="p-6 bg-white dark:bg-slate-800 rounded-lg shadow-sm border border-slate-200 dark:border-slate-700">
              <h3 className="font-semibold text-lg mb-2">1. Select Chain</h3>
              <p className="text-sm text-slate-600 dark:text-slate-400">
                Choose between Osmosis, Babylon, NEAR, Celo, Fantom, Ronin, and Celestia
              </p>
            </div>
            <div className="p-6 bg-white dark:bg-slate-800 rounded-lg shadow-sm border border-slate-200 dark:border-slate-700">
              <h3 className="font-semibold text-lg mb-2">2. Enter Address</h3>
              <p className="text-sm text-slate-600 dark:text-slate-400">
                Input your wallet address to view transaction history
              </p>
            </div>
            <div className="p-6 bg-white dark:bg-slate-800 rounded-lg shadow-sm border border-slate-200 dark:border-slate-700">
              <h3 className="font-semibold text-lg mb-2">3. Export CSV</h3>
              <p className="text-sm text-slate-600 dark:text-slate-400">
                Download in Awaken Tax format for easy tax reporting
              </p>
            </div>
          </div>
        )}

        {/* API Attribution Section */}
        <div className="mt-12 p-4 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-lg max-w-3xl mx-auto">
          <p className="text-xs text-slate-500 dark:text-slate-400 text-center">
            Data Sources:
            {selectedChain === "celo" && (
              <span> Data provided by <a href="https://etherscan.io/apis" target="_blank" rel="noopener noreferrer" className="underline hover:text-slate-700 dark:hover:text-slate-300">Etherscan.io API</a>.</span>
            )}
            {selectedChain === "celestia" && (
              <span> Powered by <a href="https://celenium.io" target="_blank" rel="noopener noreferrer" className="underline hover:text-slate-700 dark:hover:text-slate-300">Celenium API</a>.</span>
            )}
            {selectedChain === "ronin" && (
              <span> Data provided by <a href="https://goldrush.dev" target="_blank" rel="noopener noreferrer" className="underline hover:text-slate-700 dark:hover:text-slate-300">GoldRush (Covalent)</a> API.</span>
            )}
            {selectedChain === "near" && (
              <span> Data provided by <a href="https://pikespeak.ai" target="_blank" rel="noopener noreferrer" className="underline hover:text-slate-700 dark:hover:text-slate-300">Pikespeak API</a>.</span>
            )}
          </p>
        </div>

        {/* Footer */}
        <footer className="mt-8 text-center text-sm text-slate-500 dark:text-slate-400">
          <p>
            Multi-chain transaction viewer. CSV format compatible with{" "}
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
