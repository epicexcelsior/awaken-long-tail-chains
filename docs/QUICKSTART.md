# Quickstart Guide

This guide covers common tasks for working with the Awaken Long Tail Chains dashboard.

---

## Table of Contents

1. [Adding a New Chain](#adding-a-new-chain)
2. [Testing Chain Integration](#testing-chain-integration)
3. [Deploying to Cloudflare](#deploying-to-cloudflare)
4. [CSV Format Reference](#csv-format-reference)
5. [Troubleshooting](#troubleshooting)

---

## Adding a New Chain

### Step 1: Research the API

Find a reliable API with these requirements:

- ✅ Fetches complete transaction history (with pagination)
- ✅ Free tier or reasonable rate limits (3-5 req/sec)
- ✅ Supports token transfers (if applicable)
- ✅ Good documentation

**Recommended APIs**:
- **EVM Chains**: Etherscan, Blockscout, GoldRush (Covalent)
- **Cosmos SDK**: LCD endpoints, Celenium, Mintscan
- **Other**: TzKT (Tezos), Pikespeak (NEAR), AllThatNode (various)

### Step 2: Create the Client

Create `app/services/{chain}-client.ts`:

```typescript
import {
  ChainTransaction,
  ParsedTransaction,
  TransactionType,
  ChainId,
} from "../types";
import { getApiKey } from "../utils/apiKeys";

const CHAIN_ID: ChainId = "yourchain";
const DEFAULT_API_KEY = "your-default-key";
const BASE_URL = "https://api.example.com";
const DELAY_MS = 350; // Adjust for rate limits

export async function fetchAllTransactionsClientSide(
  address: string,
  onProgress?: (count: number, page?: number) => void
): Promise<{ transactions: ChainTransaction[]; metadata: any }> {
  const apiKey = getApiKey("yourchain") || DEFAULT_API_KEY;
  
  // Implement pagination
  const transactions: ChainTransaction[] = [];
  let page = 1;
  let hasMore = true;
  
  while (hasMore && page <= 100) {
    const response = await fetch(
      `${BASE_URL}/transactions?address=${address}&page=${page}&apikey=${apiKey}`
    );
    const data = await response.json();
    
    transactions.push(...data.result);
    hasMore = data.result.length === 100;
    page++;
    
    if (onProgress) {
      onProgress(transactions.length, page);
    }
    
    // Rate limiting
    if (hasMore) {
      await new Promise(resolve => setTimeout(resolve, DELAY_MS));
    }
  }
  
  return {
    transactions,
    metadata: {
      address,
      chain: CHAIN_ID,
      totalFetched: transactions.length,
      dataSource: "API Name",
    },
  };
}

export function parseTransaction(
  tx: ChainTransaction,
  walletAddress: string
): ParsedTransaction {
  // Implement transaction parsing
  return {
    hash: tx.hash,
    timestamp: new Date(tx.timestamp),
    type: "receive", // or "send", "swap", etc.
    from: tx.tx?.body?.messages?.[0]?.from_address || "",
    to: tx.tx?.body?.messages?.[0]?.to_address || "",
    amount: "1.0",
    currency: "TOKEN",
    fee: "0.001",
    feeCurrency: "NATIVE",
    status: tx.code === 0 ? "success" : "failed",
    chain: CHAIN_ID,
    memo: `Transaction details...`,
  };
}

export function isValidYourChainAddress(address: string): boolean {
  // Implement address validation
  return /^prefix[a-z0-9]{39}$/i.test(address);
}
```

### Step 3: Update Type Definitions

Add to `app/types/index.ts`:

```typescript
export type ChainId =
  | "celo"
  | "ronin"
  | "celestia"
  | "tezos"
  | "yourchain"; // Add here
```

### Step 4: Add Chain Configuration

Add to `app/config/chains.ts`:

```typescript
yourchain: {
  id: "yourchain",
  name: "YourChain",
  displayName: "Your Chain",
  icon: "/chains/yourchain.svg", // or external URL
  color: "#FF0000",
  gradientFrom: "#FF0000",
  gradientTo: "#FF5500",
  addressPrefix: "prefix",
  addressRegex: /^prefix[a-z0-9]{39}$/i,
  testAddress: "prefix1testaddressforusers",
  rpcEndpoints: [],
  apiEndpoints: ["https://api.example.com"],
  explorerUrl: "https://explorer.yourchain.com/tx",
  apiKey: "default-key-here", // or null for public endpoints
  decimals: 6,
  nativeDenom: "uyour",
  nativeSymbol: "YOUR",
  enabled: true, // Set to true when ready
  description: "Description of your chain",
},
```

### Step 5: Add to Dashboard

Update `app/page.tsx`:

```typescript
import {
  fetchAllTransactionsClientSide as fetchYourChainTransactions,
  parseTransaction as parseYourChainTransaction,
  isValidYourChainAddress,
} from "./services/yourchain-client";

// Add to chainHandlers
yourchain: {
  fetch: fetchYourChainTransactions,
  parse: parseYourChainTransaction,
  isValid: isValidYourChainAddress,
  attribution: { name: "API Name", url: "https://api-website.com" },
},
```

### Step 6: Add Icon

Add chain icon to `public/chains/yourchain.svg` (40x40px recommended).

### Step 7: Test

```bash
npm run dev
```

Test with the provided test address and a real high-activity address.

---

## Testing Chain Integration

### Manual API Test

Before integrating, test the API manually:

```bash
# Example: Testing Celo on Etherscan
curl "https://api.etherscan.io/v2/api?module=account&action=txlist&address=0xD8763CBa276a3738E6DE85b4b3bF5FDed6D6cA73&chainid=42220&page=1&offset=100&apikey=YourApiKey"
```

### Dashboard Test

1. Start dev server: `npm run dev`
2. Select your chain from dropdown
3. Enter a test address
4. Verify transactions load completely
5. Check CSV export works

### CSV Validation Checklist

- [ ] Opens in Excel/Sheets without errors
- [ ] Date format: `M/D/YY H:MM` (e.g., `1/15/24 14:30`)
- [ ] All transaction hashes present in Notes
- [ ] From/To addresses in Notes
- [ ] Token symbols consistent
- [ ] No empty required fields

### Cost Basis Test

1. Export CSV from dashboard
2. Import to [Awaken Tax](https://awaken.tax)
3. Check calculated cost basis percentage
4. Verify no unmatched transactions
5. Target: >95% cost basis accuracy

---

## Deploying to Cloudflare

### Prerequisites

1. Install Wrangler CLI:
```bash
npm install -g wrangler
```

2. Login to Cloudflare:
```bash
wrangler login
```

### First Deployment

```bash
# Build the project
npm run build

# Create project (if it doesn't exist)
wrangler pages project create awaken-long-tail-chains --production-branch=main

# Deploy
wrangler pages deploy dist --project-name=awaken-long-tail-chains
```

### Subsequent Deployments

```bash
npm run build && wrangler pages deploy dist --project-name=awaken-long-tail-chains
```

### Environment Variables (Optional)

If you need to set environment variables in Cloudflare:

```bash
wrangler pages secret put NEXT_PUBLIC_MINTSCAN_API_KEY
```

---

## CSV Format Reference

### Awaken Tax Standard Format

```
Date,Received Quantity,Received Currency,Sent Quantity,Sent Currency,Fee Amount,Fee Currency,Transaction Hash,Notes,Tag
```

### Example Rows

```csv
Date,Received Quantity,Received Currency,Sent Quantity,Sent Currency,Fee Amount,Fee Currency,Transaction Hash,Notes,Tag
1/15/24 14:30,100.5,USDC,,,0.001,ETH,0xabc123...,Token transfer [TX: 0xabc123...] (0x267c40... -> 0x9d3936...),receive
1/16/24 09:15,,,50.25,WETH,0.002,ETH,0xdef456...,Swap WETH to USDC [TX: 0xdef456...] (0x267c40... -> 0x9d3936...),swap
```

### Required Fields

- **Date**: Must be `M/D/YY H:MM` format
- **Received Quantity**: Amount received (if applicable)
- **Received Currency**: Token symbol
- **Sent Quantity**: Amount sent (if applicable)
- **Sent Currency**: Token symbol
- **Fee Amount**: Transaction fee
- **Fee Currency**: Fee token symbol
- **Transaction Hash**: Full transaction hash
- **Notes**: Detailed description with hash and addresses
- **Tag**: `receive`, `send`, `swap`, `staking`, etc.

### Notes Field Format

Include in Notes for best cost basis matching:
```
[Transaction Type] - [Token Details] [TX: 0x...] ([From] -> [To]) [Memo]
```

---

## Troubleshooting

### "No transactions found"

- Check address format matches chain requirements
- Verify API key is valid (check browser console for errors)
- Try the test address provided in the UI

### Rate Limiting Errors

- The dashboard respects rate limits with built-in delays
- Add your own API key via the Custom API Keys dropdown for higher limits
- Check API provider documentation for rate limits

### CSV Import Issues in Awaken Tax

- Verify date format is `M/D/YY H:MM`
- Ensure transaction hashes are complete (not truncated)
- Check for special characters in token symbols
- Make sure required fields aren't empty

### Build Errors

```bash
# Clear cache and rebuild
rm -rf dist node_modules .next
npm install
npm run build
```

### Deployment Failures

1. Verify you're logged in: `wrangler whoami`
2. Check project exists: `wrangler pages project list`
3. Ensure build succeeded before deploying

---

## Best Practices

### API Integration

- Always implement pagination for complete history
- Add rate limiting delays (typically 300-500ms between requests)
- Cache token metadata for consistent symbols
- Handle errors gracefully with partial data return

### Cost Basis Optimization

- Include full transaction hashes in Notes
- Add From/To addresses in Notes
- Use consistent token symbols (cache them)
- Parse all transaction types (not just transfers)
- Include internal transactions for DeFi chains

### UI/UX

- Provide test addresses for easy testing
- Show loading progress (transaction count + page)
- Display API attribution
- Support keyboard shortcuts (Enter to submit, Esc to go back)
- Make it mobile responsive

---

## Resources

- [Awaken Tax](https://awaken.tax) - Tax calculation platform
- [Etherscan API](https://docs.etherscan.io/) - EVM chain data
- [GoldRush API](https://goldrush.dev/docs/) - Multi-chain data
- [Celenium API](https://api-docs.celenium.io/) - Celestia data
- [TzKT API](https://api.tzkt.io/) - Tezos data

---

**Questions?** Open an issue on GitHub.
