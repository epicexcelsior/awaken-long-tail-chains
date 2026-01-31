"use client";

import { useState } from "react";
import { Search, AlertCircle, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { ChainId } from "../types";
import { CHAIN_CONFIGS, ENABLED_CHAINS } from "../config/chains";

interface WalletInputProps {
  onSubmit: (address: string) => void;
  isLoading: boolean;
  selectedChain: ChainId;
  onChainChange: (chain: ChainId) => void;
}

export function WalletInput({
  onSubmit,
  isLoading,
  selectedChain,
  onChainChange,
}: WalletInputProps) {
  const [address, setAddress] = useState("");
  const [error, setError] = useState<string | null>(null);

  const chainConfig = CHAIN_CONFIGS[selectedChain];

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!address.trim()) {
      setError("Please enter a wallet address");
      return;
    }

    // Validate address format based on selected chain
    if (!chainConfig.addressRegex.test(address.trim())) {
      const errorMsg = chainConfig.addressPrefix
        ? `Invalid ${chainConfig.displayName} address. Should start with "${chainConfig.addressPrefix}"`
        : `Invalid ${chainConfig.displayName} address format. Please check the example below.`;
      setError(errorMsg);
      return;
    }

    onSubmit(address.trim());
  };

  return (
    <Card className="w-full max-w-2xl mx-auto">
      <CardHeader>
        <CardTitle className="text-2xl font-bold text-center">
          Multi-Chain Transaction Viewer
        </CardTitle>
        <CardDescription className="text-center">
          View transactions and export to Awaken Tax CSV format
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Chain Selector */}
          <div className="flex gap-2 justify-center flex-wrap">
            {ENABLED_CHAINS.map((chain) => (
              <button
                key={chain.id}
                type="button"
                onClick={() => {
                  onChainChange(chain.id);
                  setAddress("");
                  setError(null);
                }}
                className={`px-4 py-2 rounded-lg font-medium transition-all border-2 ${
                  selectedChain === chain.id
                    ? "border-current shadow-lg"
                    : "border-transparent hover:border-gray-300 dark:hover:border-gray-600"
                }`}
                style={{
                  backgroundColor:
                    selectedChain === chain.id
                      ? chain.color + "20"
                      : "transparent",
                  color: selectedChain === chain.id ? chain.color : "inherit",
                }}
              >
                {chain.displayName}
              </button>
            ))}
          </div>

          <div className="relative">
            <Input
              placeholder={`${chainConfig.addressPrefix}...`}
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              className="pr-12 h-14 text-lg"
              disabled={isLoading}
            />
            <Search className="absolute right-4 top-1/2 transform -translate-y-1/2 text-muted-foreground h-5 w-5" />
          </div>

          {error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <Button
            type="submit"
            className="w-full h-12 text-lg font-semibold"
            disabled={isLoading}
            style={{
              background: `linear-gradient(135deg, ${chainConfig.gradientFrom}, ${chainConfig.gradientTo})`,
            }}
          >
            {isLoading ? (
              <>
                <div className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-background border-t-foreground" />
                Fetching Transactions...
              </>
            ) : (
              <>
                <Search className="mr-2 h-5 w-5" />
                View {chainConfig.displayName} Transactions
              </>
            )}
          </Button>
        </form>

        <div className="mt-6 text-sm text-muted-foreground text-center">
          <p>Example: {chainConfig.testAddress.slice(0, 20)}...</p>
          <p className="mt-2">{chainConfig.description}</p>
        </div>
      </CardContent>
    </Card>
  );
}
