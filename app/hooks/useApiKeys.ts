"use client";

import { useState, useEffect } from "react";

export type ApiKeyConfig = {
  celo?: string; // Etherscan API key
  ronin?: string; // Covalent/GoldRush API key
  babylon?: string; // AllThatNode API key
  near?: string; // Pikespeak API key
  fantom?: string; // Tatum API key
  flow?: string; // AllThatNode API key
  polkadot?: string; // AllThatNode API key
  mintscan?: string; // Mintscan API key
};

const STORAGE_KEY = "custom-api-keys";

export function useApiKeys() {
  const [apiKeys, setApiKeys] = useState<ApiKeyConfig>(() => {
    if (typeof window !== "undefined") {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        try {
          return JSON.parse(stored);
        } catch (_e) {
          console.error("Failed to parse stored API keys:", _e);
        }
      }
    }
    return {};
  });
  // Since we initialize from localStorage synchronously, we're always loaded
  const isLoaded = true;

  // Save API keys to localStorage whenever they change
  useEffect(() => {
    if (isLoaded && typeof window !== "undefined") {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(apiKeys));
    }
  }, [apiKeys, isLoaded]);

  const setApiKey = (service: keyof ApiKeyConfig, key: string) => {
    setApiKeys((prev) => ({
      ...prev,
      [service]: key.trim() || undefined,
    }));
  };

  const removeApiKey = (service: keyof ApiKeyConfig) => {
    setApiKeys((prev) => {
      const newKeys = { ...prev };
      delete newKeys[service];
      return newKeys;
    });
  };

  const getApiKey = (
    service: keyof ApiKeyConfig,
    fallbackKey?: string
  ): string | undefined => {
    return apiKeys[service] || fallbackKey;
  };

  const clearAllKeys = () => {
    setApiKeys({});
    if (typeof window !== "undefined") {
      localStorage.removeItem(STORAGE_KEY);
    }
  };

  return {
    apiKeys,
    isLoaded,
    setApiKey,
    removeApiKey,
    getApiKey,
    clearAllKeys,
  };
}
