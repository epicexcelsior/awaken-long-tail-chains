"use client";

import React, { useState, useEffect, useMemo } from "react";
import Head from "next/head";
import Image from "next/image";
import {
  Loader2,
  Download,
  ArrowLeft,
  ChevronDown,
  Copy,
  Check,
  ExternalLink,
  AlertCircle,
} from "lucide-react";
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
  fetchAllTransactionsClientSide as fetchTezosTransactions,
  parseTransaction as parseTezosTransaction,
  isValidTezosAddress,
} from "./services/tezos-client";
import {
  convertToAwakenCSV,
  generateCSVContent,
  downloadCSV,
} from "./utils/csvExport";
import { ParsedTransaction, ChainConfig } from "./types";
import { CHAIN_CONFIGS, ENABLED_CHAINS } from "./config/chains";
import { ApiKeyManager } from "./components/api-key-manager";
import { useApiKeys } from "./hooks/useApiKeys";

// Chain handlers mapping
const chainHandlers: Record<
  string,
  {
    fetch: (
      address: string,
      onProgress?: (count: number, page?: number) => void
    ) => Promise<{ transactions: any[]; metadata: any }>;
    parse: (tx: any, address: string) => ParsedTransaction;
    isValid: (address: string) => boolean;
    attribution: { name: string; url: string };
  }
> = {
  celo: {
    fetch: fetchCeloTransactions,
    parse: parseCeloTransaction,
    isValid: isValidCeloAddress,
    attribution: { name: "Etherscan.io", url: "https://etherscan.io" },
  },
  ronin: {
    fetch: fetchRoninTransactions,
    parse: parseRoninTransaction,
    isValid: isValidRoninAddress,
    attribution: { name: "GoldRush (Covalent)", url: "https://goldrush.dev" },
  },
  celestia: {
    fetch: fetchCelestiaTransactions,
    parse: parseCelestiaTransaction,
    isValid: isValidCelestiaAddress,
    attribution: { name: "Celenium", url: "https://celenium.io" },
  },
  tezos: {
    fetch: fetchTezosTransactions,
    parse: parseTezosTransaction,
    isValid: isValidTezosAddress,
    attribution: { name: "TzKT", url: "https://tzkt.io" },
  },
};

// Types for sorting and filtering
type SortField = "date" | "type" | "amount" | "currency";
type SortDirection = "asc" | "desc";
type TransactionFilter = "all" | ParsedTransaction["type"];

export default function Home() {
  // API Keys management
  const { getApiKey } = useApiKeys();

  // UI State
  const [selectedChain, setSelectedChain] = useState("celo");
  const [address, setAddress] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [loadingProgress, setLoadingProgress] = useState({
    count: 0,
    page: 1,
  });
  const [transactions, setTransactions] = useState<ParsedTransaction[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [metadata, setMetadata] = useState<any>(null);
  const [showResults, setShowResults] = useState(false);
  const [copiedTestAddress, setCopiedTestAddress] = useState(false);

  // Sorting and Filtering State
  const [sortField, setSortField] = useState<SortField>("date");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");
  const [filter, setFilter] = useState<TransactionFilter>("all");
  const [searchQuery, setSearchQuery] = useState("");

  // Dropdown state
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);

  // Current chain config
  const currentChain = CHAIN_CONFIGS[selectedChain as keyof typeof CHAIN_CONFIGS];
  const handler = chainHandlers[selectedChain];

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && showResults) {
        handleBack();
      }
      if (e.key === "Enter" && !showResults && !isLoading && address) {
        handleSubmit(e as any);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [showResults, isLoading, address]);

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 50; // Show 50 transactions per page to avoid memory issues

  // Filter and sort transactions
  const processedTransactions = useMemo(() => {
    let filtered = transactions;

    // Apply filter
    if (filter !== "all") {
      filtered = filtered.filter((tx) => tx.type === filter);
    }

    // Apply search
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (tx) =>
          tx.hash.toLowerCase().includes(query) ||
          tx.currency?.toLowerCase().includes(query) ||
          tx.type.toLowerCase().includes(query) ||
          tx.from.toLowerCase().includes(query) ||
          tx.to.toLowerCase().includes(query)
      );
    }

    // Apply sorting
    const sorted = [...filtered].sort((a, b) => {
      let comparison = 0;

      switch (sortField) {
        case "date":
          comparison =
            new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime();
          break;
        case "type":
          comparison = a.type.localeCompare(b.type);
          break;
        case "amount":
          const amountA = parseFloat(a.amount) || 0;
          const amountB = parseFloat(b.amount) || 0;
          comparison = amountA - amountB;
          break;
        case "currency":
          comparison = (a.currency || "").localeCompare(b.currency || "");
          break;
      }

      return sortDirection === "asc" ? comparison : -comparison;
    });

    return sorted;
  }, [transactions, filter, searchQuery, sortField, sortDirection]);

  // Paginated transactions for display (only show current page)
  const paginatedTransactions = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    return processedTransactions.slice(startIndex, endIndex);
  }, [processedTransactions, currentPage]);

  // Total pages calculation
  const totalPages = Math.ceil(processedTransactions.length / itemsPerPage);

  // Reset to page 1 when filters/sorting change
  useEffect(() => {
    setCurrentPage(1);
  }, [filter, searchQuery, sortField, sortDirection]);

  // Handle sort toggle
  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortDirection("desc");
    }
  }; const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!handler || isLoading) return;

    setIsLoading(true);
    setError(null);
    setTransactions([]);
    setLoadingProgress({ count: 0, page: 1 });
    setShowResults(true);

    try {
      if (!handler.isValid(address.trim())) {
        throw new Error(
          `Invalid address format for ${currentChain?.name}. Expected format: ${currentChain?.addressPrefix}...`
        );
      }

      const result = await handler.fetch(address.trim(), (count, page) => {
        setLoadingProgress({ count, page: page || 1 });
      });

      setMetadata(result.metadata);
      const parsed = result.transactions
        .map((tx: any) => {
          try {
            return handler.parse(tx, address.trim());
          } catch (parseErr) {
            console.error("[Dashboard] Error parsing transaction:", parseErr, tx);
            return null;
          }
        })
        .filter((tx): tx is ParsedTransaction => tx !== null && tx !== undefined);
      setTransactions(parsed);

      if (parsed.length === 0) {
        setError("No transactions found for this address.");
      }
    } catch (err: any) {
      setError(err.message || "Failed to fetch transactions");
    } finally {
      setIsLoading(false);
      setLoadingProgress({ count: 0, page: 1 });
    }
  };

  const handleExportCSV = () => {
    if (transactions.length === 0) return;
    const csvRows = convertToAwakenCSV(transactions, address, "standard");
    const csvContent = generateCSVContent(csvRows);
    const filename = `${selectedChain}-transactions-${address.slice(
      0,
      8
    )}-${new Date().toISOString().split("T")[0]}.csv`;
    downloadCSV(csvContent, filename);
  };

  const handleBack = () => {
    setShowResults(false);
    setTransactions([]);
    setError(null);
    setFilter("all");
    setSearchQuery("");
  };

  const handleUseTestAddress = () => {
    if (currentChain?.testAddress) {
      setAddress(currentChain.testAddress);
      setCopiedTestAddress(true);
      setTimeout(() => setCopiedTestAddress(false), 2000);
    }
  };

  const handleCopyTestAddress = () => {
    if (currentChain?.testAddress) {
      navigator.clipboard.writeText(currentChain.testAddress);
      setCopiedTestAddress(true);
      setTimeout(() => setCopiedTestAddress(false), 2000);
    }
  };

  // Get unique transaction types for filter dropdown
  const transactionTypes = useMemo(() => {
    const types = new Set(transactions.map((tx) => tx.type));
    return Array.from(types);
  }, [transactions]);

  // Results View
  if (showResults) {
    return (
      <div className="min-h-screen bg-[#1a1a1a] text-white">
        <Head>
          <title>{currentChain?.name} Transactions | Multi-Chain Dashboard</title>
        </Head>

        <header className="border-b border-gray-800 bg-[#1a1a1a]">
          <div className="container mx-auto px-4 py-4 flex flex-col sm:flex-row items-start sm:items-center gap-4">
            <button
              onClick={handleBack}
              className="flex items-center text-gray-400 hover:text-white transition-colors"
            >
              <ArrowLeft className="w-5 h-5 mr-2" /> Back
            </button>
            <div className="flex items-center gap-3">
              {currentChain && (
                <div className="w-8 h-8 relative">
                  <Image
                    src={currentChain.icon}
                    alt={currentChain.name}
                    fill
                    className="rounded-full"
                  />
                </div>
              )}
              <div>
                <h1 className="text-xl font-bold text-orange-500">
                  {currentChain?.name} Transactions
                </h1>
                <p className="text-sm text-gray-400 hidden sm:block">
                  {address.slice(0, 12)}...
                  {address.slice(-8)}
                </p>
              </div>
            </div>
          </div>
        </header>

        <main className="container mx-auto px-4 py-8">
          <div className="max-w-6xl mx-auto">
            {isLoading && (
              <div className="text-center py-12 bg-[#2a2a2a] rounded-lg border border-gray-800">
                <Loader2 className="w-12 h-12 animate-spin mx-auto mb-4 text-orange-500" />
                <p className="text-lg font-semibold mb-2">
                  Loading transactions...
                </p>
                <p className="text-gray-400">
                  Fetched {loadingProgress.count} transactions (page{" "}
                  {loadingProgress.page})
                </p>
                <div className="mt-4 w-64 mx-auto bg-gray-700 rounded-full h-2">
                  <div
                    className="bg-orange-500 h-2 rounded-full transition-all duration-300"
                    style={{
                      width: `${Math.min(
                        (loadingProgress.count / 1000) * 100,
                        100
                      )}%`,
                    }}
                  />
                </div>
              </div>
            )}

            {error && (
              <div className="bg-red-900/50 border border-red-700 rounded-lg p-4 mb-6 flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-red-400 font-semibold">Error</p>
                  <p className="text-red-300 text-sm">{error}</p>
                  <button
                    onClick={handleBack}
                    className="mt-2 text-sm text-red-400 hover:text-red-300 underline"
                  >
                    Go back and try again
                  </button>
                </div>
              </div>
            )}

            {transactions.length > 0 && !isLoading && (
              <div className="space-y-4">
                {/* Stats and Export Bar */}
                <div className="bg-[#2a2a2a] rounded-lg p-4 border border-gray-800 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                  <div>
                    <h2 className="text-lg font-semibold">
                      {processedTransactions.length} Transactions
                      {processedTransactions.length !== transactions.length && (
                        <span className="text-sm text-gray-400 ml-2">
                          (filtered from {transactions.length})
                        </span>
                      )}
                    </h2>
                    {metadata && (
                      <p className="text-sm text-gray-400">
                        Via {metadata.dataSource} •{" "}
                        {new Date(
                          metadata.firstTransactionDate
                        ).toLocaleDateString()}{" "}
                        -{" "}
                        {new Date(
                          metadata.lastTransactionDate
                        ).toLocaleDateString()}
                      </p>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button
                      onClick={handleExportCSV}
                      className="flex items-center bg-orange-600 hover:bg-orange-700 text-white py-2 px-4 rounded-lg transition-colors"
                    >
                      <Download className="w-4 h-4 mr-2" /> Export CSV
                    </button>
                  </div>
                </div>

                {/* API Attribution */}
                {handler?.attribution && (
                  <div className="text-sm text-gray-500 bg-[#2a2a2a]/50 rounded-lg p-3 border border-gray-800">
                    Data provided by{" "}
                    <a
                      href={handler.attribution.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-orange-400 hover:text-orange-300 inline-flex items-center"
                    >
                      {handler.attribution.name} API
                      <ExternalLink className="w-3 h-3 ml-1" />
                    </a>
                  </div>
                )}

                {/* Filters and Search */}
                <div className="bg-[#2a2a2a] rounded-lg p-4 border border-gray-800 flex flex-col sm:flex-row gap-4">
                  {/* Search */}
                  <div className="flex-1">
                    <input
                      type="text"
                      placeholder="Search transactions..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="w-full bg-[#1a1a1a] border border-gray-700 rounded-lg px-4 py-2 text-white focus:outline-none focus:ring-2 focus:ring-orange-500"
                    />
                  </div>

                  {/* Type Filter */}
                  <select
                    value={filter}
                    onChange={(e) =>
                      setFilter(e.target.value as TransactionFilter)
                    }
                    className="bg-[#1a1a1a] border border-gray-700 rounded-lg px-4 py-2 text-white focus:outline-none focus:ring-2 focus:ring-orange-500"
                  >
                    <option value="all">All Types</option>
                    {transactionTypes.map((type) => (
                      <option key={type} value={type}>
                        {type.charAt(0).toUpperCase() + type.slice(1)}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Transactions Table */}
                <div className="bg-[#2a2a2a] rounded-lg border border-gray-800 overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-gray-700 bg-[#333]">
                          {[
                            { field: "date", label: "Date" },
                            { field: "type", label: "Type" },
                            { field: "amount", label: "Amount" },
                            { field: "currency", label: "Currency" },
                          ].map(({ field, label }) => (
                            <th
                              key={field}
                              onClick={() => handleSort(field as SortField)}
                              className="text-left py-3 px-4 text-gray-300 cursor-pointer hover:text-white transition-colors select-none"
                            >
                              <div className="flex items-center gap-1">
                                {label}
                                {sortField === field && (
                                  <span className="text-orange-500">
                                    {sortDirection === "asc" ? "↑" : "↓"}
                                  </span>
                                )}
                              </div>
                            </th>
                          ))}
                          <th className="text-left py-3 px-4 text-gray-300">
                            From/To
                          </th>
                          <th className="text-left py-3 px-4 text-gray-300">
                            Status
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {paginatedTransactions.map((tx, idx) => (
                          <tr
                            key={idx}
                            className="border-b border-gray-800 hover:bg-[#333] transition-colors"
                          >
                            <td className="py-3 px-4 whitespace-nowrap">
                              {new Date(tx.timestamp).toLocaleString()}
                            </td>
                            <td className="py-3 px-4">
                              <span
                                className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium capitalize ${
                                  tx.type === "receive"
                                    ? "bg-green-900 text-green-300"
                                    : tx.type === "send"
                                    ? "bg-red-900 text-red-300"
                                    : tx.type === "swap"
                                    ? "bg-blue-900 text-blue-300"
                                    : "bg-gray-700 text-gray-300"
                                }`}
                              >
                                {tx.type}
                              </span>
                            </td>
                            <td className="py-3 px-4 font-mono">
                              {tx.amount || tx.amount2 || "-"}
                            </td>
                            <td className="py-3 px-4">
                              {tx.currency || tx.currency2 || "-"}
                            </td>
                            <td className="py-3 px-4 text-gray-400">
                              <div className="flex flex-col">
                                <span className="text-xs">
                                  {tx.from.slice(0, 8)}...{tx.from.slice(-6)} →{" "}
                                  {tx.to.slice(0, 8)}...{tx.to.slice(-6)}
                                </span>
                                <span className="text-xs mt-1 text-gray-500">
                                  {tx.hash.slice(0, 12)}...{tx.hash.slice(-8)}
                                </span>
                              </div>
                            </td>
                            <td className="py-3 px-4">
                              <span
                                className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                                  tx.status === "success"
                                    ? "bg-green-900 text-green-300"
                                    : "bg-red-900 text-red-300"
                                }`}
                              >
                                {tx.status}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {/* Pagination Controls */}
                  {processedTransactions.length > 0 && (
                    <div className="flex flex-col sm:flex-row items-center justify-between gap-4 px-4 py-4 border-t border-gray-800">
                      <div className="text-sm text-gray-400">
                        Showing {(currentPage - 1) * itemsPerPage + 1} -
                        {Math.min(currentPage * itemsPerPage, processedTransactions.length)} of{" "}
                        {processedTransactions.length} transactions
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                          disabled={currentPage === 1}
                          className="px-3 py-1.5 text-sm bg-gray-800 hover:bg-gray-700 disabled:bg-gray-900 disabled:text-gray-600 rounded transition-colors"
                        >
                          Previous
                        </button>

                        <div className="flex items-center gap-1">
                          {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                            // Show window of 5 pages around current page
                            let pageNum = i + 1;
                            if (totalPages > 5) {
                              if (currentPage > 3) {
                                pageNum = currentPage - 2 + i;
                              }
                              if (pageNum > totalPages) {
                                pageNum = totalPages - 4 + i;
                              }
                            }
                            if (pageNum < 1 || pageNum > totalPages) return null;
                            
                            return (
                              <button
                                key={pageNum}
                                onClick={() => setCurrentPage(pageNum)}
                                className={`w-8 h-8 text-sm rounded transition-colors ${
                                  currentPage === pageNum
                                    ? "bg-orange-600 text-white"
                                    : "bg-gray-800 hover:bg-gray-700 text-gray-300"
                                }`}
                              >
                                {pageNum}
                              </button>
                            );
                          })}
                        </div>

                        <button
                          onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                          disabled={currentPage === totalPages}
                          className="px-3 py-1.5 text-sm bg-gray-800 hover:bg-gray-700 disabled:bg-gray-900 disabled:text-gray-600 rounded transition-colors"
                        >
                          Next
                        </button>
                      </div>
                    </div>
                  )}

                  {processedTransactions.length === 0 && (
                    <div className="text-center py-12 text-gray-500">
                      <p>No transactions match your filters.</p>
                      <button
                        onClick={() => {
                          setFilter("all");
                          setSearchQuery("");
                        }}
                        className="mt-2 text-orange-400 hover:text-orange-300"
                      >
                        Clear filters
                      </button>
                    </div>
                  )}
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

  // Main Dashboard View
  return (
    <>
      <Head>
        <title>Multi-Chain Transaction Dashboard | Export to Awaken Tax</title>
        <meta
          name="description"
          content="Fetch your complete blockchain transaction history and export to Awaken Tax CSV format. Supports Celo, Ronin, Celestia, and Tezos."
        />
      </Head>

      <div className="min-h-screen bg-[#1a1a1a] text-white flex flex-col">
        {/* Header */}
        <header className="border-b border-gray-800 bg-[#1a1a1a]">
          <div className="container mx-auto px-4 py-4">
            <h1 className="text-xl sm:text-2xl font-bold text-orange-500">
              Multi-Chain Transaction Dashboard
            </h1>
          </div>
        </header>

        <main className="container mx-auto px-4 py-8 sm:py-12 flex-grow">
          <div className="max-w-4xl mx-auto">
            {/* Hero Section */}
            <div className="text-center mb-8 sm:mb-12">
              <h2 className="text-3xl sm:text-4xl font-bold mb-4">
                View Your Blockchain Transactions
              </h2>
              <p className="text-gray-400 text-lg max-w-2xl mx-auto">
                Fetch your complete transaction history from supported
                blockchains and export to{" "}
                <a
                  href="https://awaken.tax/signup?ref=tp0xqrt0"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-orange-400 hover:text-orange-300 underline"
                >
                  Awaken Tax CSV format
                </a>{" "}
                for easy tax reporting.
              </p>
            </div>

            {/* API Key Manager */}
            <div className="mb-6">
              <ApiKeyManager />
            </div>

            {/* Main Form */}
            <div className="bg-[#2a2a2a] rounded-lg p-6 border border-gray-800">
              <form onSubmit={handleSubmit} className="space-y-6">
                {/* Chain Selector */}
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Select Blockchain
                  </label>
                  <div className="relative">
                    <button
                      type="button"
                      onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                      className="w-full bg-[#1a1a1a] border border-gray-700 rounded-lg px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-orange-500 flex items-center justify-between"
                    >
                      <div className="flex items-center gap-3">
                        {currentChain && (
                          <div className="w-8 h-8 relative">
                            <Image
                              src={currentChain.icon}
                              alt={currentChain.name}
                              fill
                              className="rounded-full"
                            />
                          </div>
                        )}
                        <span className="font-semibold">
                          {currentChain?.name}
                        </span>
                      </div>
                      <ChevronDown
                        className={`w-5 h-5 text-gray-400 transition-transform ${
                          isDropdownOpen ? "rotate-180" : ""
                        }`}
                      />
                    </button>

                    {isDropdownOpen && (
                      <div className="absolute z-10 w-full mt-2 bg-[#1a1a1a] border border-gray-700 rounded-lg shadow-xl max-h-60 overflow-auto">
                        {ENABLED_CHAINS.map((chain) => (
                          <button
                            key={chain.id}
                            type="button"
                            onClick={() => {
                              setSelectedChain(chain.id);
                              setIsDropdownOpen(false);
                              setAddress("");
                            }}
                            className={`w-full flex items-center gap-3 px-4 py-3 hover:bg-[#333] transition-colors ${
                              selectedChain === chain.id
                                ? "bg-orange-500/10 border-l-2 border-orange-500"
                                : ""
                            }`}
                          >
                            <div className="w-8 h-8 relative">
                              <Image
                                src={chain.icon}
                                alt={chain.name}
                                fill
                                className="rounded-full"
                              />
                            </div>
                            <div className="text-left">
                              <span className="font-semibold block">
                                {chain.name}
                              </span>
                              <span className="text-xs text-gray-400">
                                {chain.description.replace(" (via", " via")}
                              </span>
                            </div>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                {/* Address Input */}
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    {currentChain?.name} Wallet Address
                  </label>
                  <input
                    type="text"
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                    placeholder={`Enter ${currentChain?.addressPrefix}... address`}
                    className="w-full bg-[#1a1a1a] border border-gray-700 rounded-lg px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-orange-500"
                  />

                  {/* Test Address Helper */}
                  <div className="mt-3 flex flex-col sm:flex-row items-start sm:items-center gap-2 text-sm">
                    <span className="text-gray-400">Test with:</span>
                    <button
                      type="button"
                      onClick={handleUseTestAddress}
                      className="text-orange-400 hover:text-orange-300 flex items-center gap-1"
                    >
                      {currentChain?.testAddress?.slice(0, 20)}...
                      <Copy className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      onClick={handleCopyTestAddress}
                      className="text-gray-400 hover:text-gray-300 flex items-center gap-1 text-xs"
                    >
                      {copiedTestAddress ? (
                        <>
                          <Check className="w-3 h-3 text-green-400" /> Copied!
                        </>
                      ) : (
                        <>
                          <Copy className="w-3 h-3" /> Copy
                        </>
                      )}
                    </button>
                  </div>
                </div>

                {/* Submit Button */}
                <button
                  type="submit"
                  disabled={isLoading || !address}
                  className="w-full bg-orange-600 hover:bg-orange-700 disabled:bg-gray-700 disabled:cursor-not-allowed text-white font-semibold py-3 px-6 rounded-lg transition-colors flex items-center justify-center"
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                      Loading...
                    </>
                  ) : (
                    `View ${currentChain?.name} Transactions`
                  )}
                </button>
              </form>
            </div>

            {/* Coming Soon Section */}
            <div className="mt-8 bg-[#2a2a2a]/50 rounded-lg p-6 border border-gray-800">
              <h3 className="text-lg font-semibold text-gray-300 mb-4">
                Coming Soon
              </h3>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                {Object.values(CHAIN_CONFIGS)
                  .filter((chain) => !chain.enabled)
                  .map((chain) => (
                    <div
                      key={chain.id}
                      className="flex items-center gap-2 opacity-50 grayscale"
                    >
                      <div className="w-6 h-6 relative">
                        <Image
                          src={chain.icon}
                          alt={chain.name}
                          fill
                          className="rounded-full"
                        />
                      </div>
                      <span className="text-sm text-gray-400">
                        {chain.name}
                      </span>
                    </div>
                  ))}
              </div>
            </div>

            {/* Info Section */}
            <div className="mt-8 space-y-4">
              <div className="p-6 bg-[#2a2a2a] rounded-lg border border-gray-800">
                <div className="flex items-start gap-3">
                  <Download className="w-5 h-5 text-orange-500 flex-shrink-0 mt-0.5" />
                  <div>
                    <h3 className="font-semibold text-orange-500 mb-2">
                      Export to Awaken Tax
                    </h3>
                    <p className="text-gray-400 text-sm">
                      Download your transactions in Awaken Tax CSV format for
                      accurate cost basis calculations and tax reporting.
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Keyboard Shortcuts Hint */}
            <div className="mt-8 text-center text-xs text-gray-500">
              <p>
                Keyboard shortcuts: <kbd className="px-1 py-0.5 bg-gray-800 rounded">Enter</kbd> to submit,{" "}
                <kbd className="px-1 py-0.5 bg-gray-800 rounded">Esc</kbd> to go back
              </p>
            </div>
          </div>
        </main>

        {/* Footer */}
        <footer className="border-t border-gray-800 bg-[#1a1a1a]">
          <div className="container mx-auto px-4 py-6 text-center">
            <p className="text-gray-500 text-sm">
              Data provided by Etherscan.io, GoldRush, Celenium, and TzKT APIs
            </p>
          </div>
        </footer>
      </div>
    </>
  );
}
