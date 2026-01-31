// Centralized API key management with localStorage fallback
// This module provides synchronous access to custom API keys stored in localStorage

export type ApiKeyService = 
  | "celo"      // Etherscan
  | "ronin"     // Covalent/GoldRush
  | "babylon"   // AllThatNode
  | "near"      // Pikespeak
  | "fantom"    // Tatum
  | "flow"      // AllThatNode
  | "polkadot"  // AllThatNode
  | "mintscan"; // Mintscan

const STORAGE_KEY = "custom-api-keys";

// Default API keys for each service
export const DEFAULT_API_KEYS: Record<ApiKeyService, string | undefined> = {
  celo: "39SMAR4FE2B41TQI5MDQ4PNDM5BG4HSP7J",
  ronin: "cqt_rQX6pj3BJWcjjPWd7pWwgTDvk8PQ",
  babylon: "edb5b9348fb34b33855da007fcafebae",
  near: "3847be2e-2f13-48ec-86fd-e5d1751fcb09",
  fantom: "t-697d4031ace70350f2245030-4a6be09c40b84989bb00c1c8",
  flow: "edb5b9348fb34b33855da007fcafebae",
  polkadot: "edb5b9348fb34b33855da007fcafebae",
  mintscan: undefined, // Set via env var or user input
};

/**
 * Get API key for a service with fallback to default
 * This is synchronous and can be used anywhere
 */
export function getApiKey(service: ApiKeyService): string | undefined {
  if (typeof window === "undefined") {
    // Server-side: return default only
    return DEFAULT_API_KEYS[service];
  }

  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      // Return custom key if set, otherwise fall back to default
      return parsed[service] || DEFAULT_API_KEYS[service];
    }
  } catch (e) {
    console.error(`[API Keys] Error reading key for ${service}:`, e);
  }

  return DEFAULT_API_KEYS[service];
}

/**
 * Set a custom API key for a service
 */
export function setApiKey(service: ApiKeyService, key: string): void {
  if (typeof window === "undefined") return;

  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    const keys = stored ? JSON.parse(stored) : {};
    
    if (key.trim()) {
      keys[service] = key.trim();
    } else {
      delete keys[service];
    }
    
    localStorage.setItem(STORAGE_KEY, JSON.stringify(keys));
  } catch (e) {
    console.error(`[API Keys] Error saving key for ${service}:`, e);
  }
}

/**
 * Remove a custom API key (revert to default)
 */
export function removeApiKey(service: ApiKeyService): void {
  if (typeof window === "undefined") return;

  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const keys = JSON.parse(stored);
      delete keys[service];
      localStorage.setItem(STORAGE_KEY, JSON.stringify(keys));
    }
  } catch (e) {
    console.error(`[API Keys] Error removing key for ${service}:`, e);
  }
}

/**
 * Get all custom API keys
 */
export function getAllCustomKeys(): Partial<Record<ApiKeyService, string>> {
  if (typeof window === "undefined") return {};

  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored ? JSON.parse(stored) : {};
  } catch (_e) {
    return {};
  }
}

/**
 * Clear all custom API keys
 */
export function clearAllKeys(): void {
  if (typeof window === "undefined") return;
  localStorage.removeItem(STORAGE_KEY);
}
