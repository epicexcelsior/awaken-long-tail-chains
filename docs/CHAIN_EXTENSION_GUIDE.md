# Chain Extension Guide

Complete guide for adding new blockchain support to the Multi-Chain Transaction Dashboard.

## Table of Contents

1. [Quick Start Checklist](#quick-start-checklist)
2. [CSV Format Specifications](#csv-format-specifications)
3. [Implementation Patterns](#implementation-patterns)
4. [Best Practices](#best-practices)
5. [Testing Checklist](#testing-checklist)
6. [Troubleshooting](#troubleshooting)

---

## Quick Start Checklist

When adding a new chain, complete these steps in order:

- [ ] 1. Research and test API endpoints (fetch 100+ transactions)
- [ ] 2. Add chain to `app/types/index.ts` (ChainId type)
- [ ] 3. Add chain config to `app/config/chains.ts`
- [ ] 4. Create `app/services/{chain}-client.ts` following patterns
- [ ] 5. Add chain icon to `public/chains/{chain}.svg`
- [ ] 6. Import and integrate in `app/page.tsx`
- [ ] 7. Test with real address (aim for 1000+ transactions)
- [ ] 8. Verify CSV export format matches examples
- [ ] 9. Test cost basis accuracy in Awaken Tax
- [ ] 10. Update `docs/PROGRESS.md` with results
- [ ] 11. Deploy and commit

---

## CSV Format Specifications

### Standard Format (Recommended)

Used for: Regular transactions, transfers, swaps, DeFi interactions

**Columns:**
```
Date,Received Quantity,Received Currency,Received Fiat Amount,Sent Quantity,Sent Currency,Sent Fiat Amount,Received Quantity 2,Received Currency 2,Sent Quantity 2,Sent Currency 2,Fee Amount,Fee Currency,Notes,Tag
```

**Example Files:**
- `C:\Users\Epic\Downloads\awaken_csv_format (3).csv`
- `C:\Users\Epic\Downloads\example.csv` (trading format - different structure)

**Field Details:**

| Field | Format | Example | Description |
|-------|--------|---------|-------------|
| Date | M/D/YY H:MM | `2/6/23 11:29` | Transaction timestamp in local time |
| Received Quantity | Decimal string | `50` | Amount received (empty if none) |
| Received Currency | Token symbol | `AXS` | Token/coin received (e.g., RON, AXS, SLP) |
| Received Fiat Amount | Decimal or empty | `` | USD value if known (usually empty) |
| Sent Quantity | Decimal string | `10000` | Amount sent (empty if none) |
| Sent Currency | Token symbol | `USD` | Token/coin sent |
| Sent Fiat Amount | Decimal or empty | `` | USD value if known (usually empty) |
| Received Quantity 2 | Decimal string | `10` | Secondary token received (LP tokens, etc.) |
| Received Currency 2 | Token symbol | `SLP` | Secondary token symbol |
| Sent Quantity 2 | Decimal string | `` | Secondary token sent |
| Sent Currency 2 | Token symbol | `` | Secondary token symbol |
| Fee Amount | Decimal string | `0.001` | Transaction fee paid |
| Fee Currency | Token symbol | `RON` | Currency of fee (usually native token) |
| Notes | Free text | `send - TX: 0xabc...` | Additional transaction info |
| Tag | Category | `transfer` | Category: transfer, trade, staking, liquidity, etc. |

**Example Row:**
```csv
1/31/26 15:30,100,AXS,,0,RON,,,,,0.0021,RON,send - [TX: 0xabc123...] (0x267c40... -> 0x9d3936...),transfer
```

### Trading/Perpetuals Format

Used for: Futures, margin trading, perpetuals (NOT recommended for regular chains)

**Columns:**
```
Date,Asset,Amount,Fee,P&L,Payment Token,ID,Notes,Tag,Transaction Hash
```

**Example File:**
- `C:\Users\Epic\Downloads\example.csv`

**Use this format ONLY if:**
- The chain is primarily for derivatives trading
- User specifically requests trading format
- You're implementing perpetuals/futures support

### Multi-Asset Template

**Example File:**
- `C:\Users\Epic\Downloads\awaken_multi_asset_template.csv`

This is the template format - use it as reference but implement the standard format above.

---

## Implementation Patterns

### 1. Client Service Structure

Create `app/services/{chain}-client.ts`:

```typescript
import {
  ChainTransaction,
  ParsedTransaction,
  TransactionType,
  ChainId,
} from "../types";

const CHAIN_ID: ChainId = "chainname";  // Must match ChainId type

// API configuration
const API_KEY = "your-api-key";
const BASE_URL = "https://api.example.com/v1";

/**
 * Fetch ALL transactions for address
 * Must implement pagination to get complete history
 */
export async function fetchAllTransactionsClientSide(
  address: string,
  onProgress?: (count: number, page: number) => void,
): Promise<{ transactions: ChainTransaction[]; metadata: any }> {
  // 1. Fetch all pages
  // 2. Convert to ChainTransaction format
  // 3. Sort by timestamp (newest first)
  // 4. Return with metadata
}

/**
 * Convert API response to internal ChainTransaction format
 */
function convertTransaction(item: any): ChainTransaction | null {
  // Map API fields to ChainTransaction structure
}

/**
 * Validate address format
 */
export function isValidChainAddress(address: string): boolean {
  // Return true if valid
}

/**
 * Parse ChainTransaction to display format
 * CRITICAL: Must handle token symbols consistently
 */
export function parseTransaction(
  tx: ChainTransaction,
  walletAddress: string,
): ParsedTransaction {
  // 1. Determine transaction type (send/receive/swap)
  // 2. Extract amounts and currencies
  // 3. Handle token transfers
  // 4. Calculate fees
  // 5. Return ParsedTransaction
}
```

### 2. Chain Configuration

Add to `app/config/chains.ts`:

```typescript
chainname: {
  id: "chainname",                    // Must match ChainId type
  name: "ChainName",                  // Display name
  displayName: "ChainName",           // UI display
  icon: "/chains/chainname.svg",      // Path to icon
  color: "#HEXCODE",                  // Brand color
  gradientFrom: "#HEXCODE",           // Button gradient start
  gradientTo: "#HEXCODE",             // Button gradient end
  addressPrefix: "0x",                // Address prefix (if any)
  addressRegex: /^0x[a-fA-F0-9]{40}$/, // Validation regex
  testAddress: "0x...",               // Test address for validation
  rpcEndpoints: [],                   // RPC URLs (if applicable)
  apiEndpoints: ["https://api.example.com"], // API base URLs
  explorerUrl: "https://explorer.example.com/tx", // Block explorer
  apiKey: "api-key-or-null",          // API key (null if public)
  decimals: 18,                       // Native token decimals
  nativeDenom: "",                    // Native denom (for Cosmos)
  nativeSymbol: "SYMBOL",             // Native token symbol
  enabled: true,                      // Enable/disable chain
  description: "Short description",   // UI description
},
```

### 3. Type Extension

Add to `app/types/index.ts`:

```typescript
export type ChainId =
  | "osmosis"
  | "babylon"
  | "near"
  | "polkadot"
  | "celo"
  | "fantom"
  | "flow"
  | "ronin"
  | "chainname";  // Add your chain
```

### 4. Page Integration

Add to `app/page.tsx`:

```typescript
// 1. Import client functions
import {
  fetchAllTransactionsClientSide as fetchChainTransactions,
  parseTransaction as parseChainTransaction,
  isValidChainAddress,
} from "./services/chainname-client";

// 2. Add handler in handleWalletSubmit
} else if (selectedChain === "chainname") {
  if (!isValidChainAddress(address)) {
    throw new Error(
      `Invalid ${chainConfig.displayName} address format.`,
    );
  }

  const result = await fetchChainTransactions(
    address,
    (count, page) => {
      console.log(`[Progress] ChainName page ${page}, ${count} total`);
    },
  );

  setTxMetadata(result.metadata);
  parsed = result.transactions.map((tx: ChainTransaction) =>
    parseChainTransaction(tx, address),
  );

  setTxVerification({
    complete: result.transactions.length > 0,
    message:
      result.transactions.length > 0
        ? `✓ Found ${result.transactions.length} transactions via API Name`
        : "No transactions found",
  });
}
```

---

## Best Practices

### 1. Token Symbol Consistency (CRITICAL FOR COST BASIS)

**Problem:** Tax software can't match transactions if token symbols are inconsistent.

**Solution:** Implement token symbol caching:

```typescript
// At top of client file
const tokenMetadataCache: Map<string, { symbol: string; decimals: number }> = new Map();

function getTokenSymbol(contractAddress: string, apiSymbol: string | null): string {
  const addr = contractAddress.toLowerCase();
  
  // Check cache first
  if (tokenMetadataCache.has(addr)) {
    return tokenMetadataCache.get(addr)!.symbol;
  }
  
  // Use API symbol if valid
  if (apiSymbol && apiSymbol.length > 0 && apiSymbol !== "null") {
    tokenMetadataCache.set(addr, { symbol: apiSymbol, decimals: 18 });
    return apiSymbol;
  }
  
  // Fall back to shortened address
  const shortAddr = addr.slice(0, 10);
  tokenMetadataCache.set(addr, { symbol: shortAddr, decimals: 18 });
  return shortAddr;
}
```

### 2. Pagination Implementation

**Required:** Fetch ALL transactions, not just first page.

```typescript
async function fetchAllPages(address: string): Promise<any[]> {
  const allItems: any[] = [];
  let page = 0;
  let hasMore = true;
  const maxPages = 50; // Safety limit
  
  while (hasMore && page < maxPages) {
    const response = await fetch(`${BASE_URL}/${address}?page=${page}`);
    const data = await response.json();
    const items = data.items || [];
    
    allItems.push(...items);
    
    hasMore = items.length === 100; // Assuming 100 per page
    page++;
    
    // Rate limiting
    if (hasMore) {
      await new Promise(resolve => setTimeout(resolve, 200));
    }
  }
  
  return allItems;
}
```

### 3. Cost Basis Optimization

**Must include in CSV Notes field:**

```typescript
// In parseTransaction()
let notes = `${tx.type}`;

// 1. Full transaction hash
notes += ` - [TX: ${tx.hash}]`;

// 2. From/To addresses (truncated)
notes += ` (${tx.from.slice(0, 8)}... -> ${tx.to.slice(0, 8)}...)`;

// 3. Token details if multiple transfers
if (tokenTransfers.length > 1) {
  notes += ` [Tokens: ${tokenTransfers.map(t => `${t.amount} ${t.symbol}`).join(", ")}]`;
}
```

### 4. Multi-Asset Transactions

**Populate Quantity 2 fields when applicable:**

```typescript
// Example: User swaps 100 RON for 50 AXS
return {
  type: "swap",
  amount: "100",        // Primary: what user sent
  currency: "RON",
  amount2: "50",        // Secondary: what user received
  currency2: "AXS",
  // ... other fields
};
```

### 5. Error Handling

**Always handle errors gracefully:**

```typescript
try {
  const result = await fetchTransactions(address);
  
  if (result.transactions.length === 0) {
    throw new Error("No transactions found for this address");
  }
  
  return result;
} catch (error) {
  console.error(`[Chain] Error:`, error);
  
  // If we have partial data, return it
  if (partialData.length > 0) {
    return { transactions: partialData, metadata: { partial: true } };
  }
  
  // Otherwise throw for UI to display
  throw error;
}
```

### 6. Date Format

**Always use M/D/YY H:MM format for standard CSV:**

```typescript
function formatDateForAwaken(date: Date): string {
  const utcDate = new Date(date.toISOString());
  const month = utcDate.getUTCMonth() + 1;
  const day = utcDate.getUTCDate();
  const year = String(utcDate.getUTCFullYear()).slice(-2);
  const hours = utcDate.getUTCHours();
  const minutes = String(utcDate.getUTCMinutes()).padStart(2, "0");
  
  return `${month}/${day}/${year} ${hours}:${minutes}`;
}
```

---

## Testing Checklist

Before deploying a new chain, verify:

### API Testing
- [ ] Successfully fetches 100+ transactions
- [ ] Pagination works (multiple pages)
- [ ] Rate limiting handled (200ms delays)
- [ ] All transaction types captured (send, receive, token transfers)
- [ ] Test with known high-activity address

### Data Quality
- [ ] Token symbols are consistent
- [ ] Amounts match blockchain explorer
- [ ] Fees calculated correctly
- [ ] Timestamps in correct timezone
- [ ] From/to addresses accurate

### CSV Export
- [ ] Download CSV successfully
- [ ] Open in Excel/Google Sheets without errors
- [ ] All columns populated correctly
- [ ] Date format: M/D/YY H:MM
- [ ] Transaction hash included in Notes
- [ ] No empty required fields

### Cost Basis Testing
- [ ] Import CSV to Awaken Tax
- [ ] Cost basis calculates >95% (aim for 100%)
- [ ] No unmatched transactions
- [ ] Token symbols recognized
- [ ] Verify a few transactions manually

### UI/UX
- [ ] Chain appears in dropdown
- [ ] Address validation works
- [ ] Loading states display
- [ ] Error messages clear
- [ ] Transaction count shows correctly

---

## Troubleshooting

### Cost Basis < 100%

**Symptoms:** Awaken shows "X% cost basis calculated"

**Solutions:**
1. **Inconsistent token symbols** → Implement caching (see Best Practices #1)
2. **Missing transaction hashes** → Add full hash to Notes field
3. **Unrecognized tokens** → Use contract address as fallback symbol
4. **Missing transactions** → Verify pagination fetches ALL pages
5. **Date format issues** → Ensure M/D/YY H:MM format

### API Rate Limits

**Symptoms:** Requests start failing after N requests

**Solutions:**
1. Add 200ms delay between requests
2. Implement exponential backoff
3. Cache results locally
4. Add API key if available
5. Consider proxy/CORS proxy if browser restrictions

### Missing Token Transfers

**Symptoms:** CSV shows native transfers but not ERC20 tokens

**Solutions:**
1. Check if API includes `log_events` or similar
2. Parse ERC20 Transfer events from logs
3. Verify token decimals calculation
4. Check if tokens have non-standard implementations

### CORS Errors

**Symptoms:** Browser blocks requests with CORS error

**Solutions:**
1. Use API that supports CORS
2. Implement Cloudflare Function as proxy
3. Use SDK instead of direct API calls
4. Contact API provider for CORS support

### Build Errors

**Symptoms:** `npm run build` fails

**Solutions:**
1. Check TypeScript types match
2. Verify ChainId is in union type
3. Ensure all imports exist
4. Check for `any` type usage
5. Run `tsc --noEmit` to check types

---

## Reference Links

### Awaken Tax Documentation

- **CSV Format Guide**: https://help.awaken.tax/en/articles/10422149-how-to-format-your-csv-for-awaken-tax
- **Multi-Asset Template**: https://help.awaken.tax/en/articles/10453931-formatting-perpetuals-futures-csvs
- **Cost Basis Guide**: https://help.awaken.tax/en/articles/cost-basis-calculation (if available)

### Example Files (Local)

- **Standard Format**: `C:\Users\Epic\Downloads\awaken_csv_format (3).csv`
- **Trading Format**: `C:\Users\Epic\Downloads\example.csv`
- **Multi-Asset Template**: `C:\Users\Epic\Downloads\awaken_multi_asset_template.csv`

### Chain-Specific APIs

- **GoldRush (Covalent)**: https://goldrush.dev/docs/api-reference/foundational-api
  - Ronin Chain ID: `2020`
  - Pagination: `/page/{page}/`
  - Token data: `log_events[].sender_contract_ticker_symbol`

- **Blockscout**: https://docs.blockscout.com/for-users/api
  - Endpoint: `/api?module=account&action=txlist`
  - Pagination: `page` and `offset` params
  - Note: Etherscan v2 API is preferred over Blockscout for Celo (better rate limits, more complete data)

- **Pikespeak (NEAR)**: https://docs.pikespeak.ai/
  - Endpoint: `/account/transactions/{address}`
  - Authentication: `x-api-key` header

- **Etherscan v2**: https://docs.etherscan.io/api-reference
  - Base URL: `https://api.etherscan.io/v2/api`
  - Chain ID parameter: `chainid=42220` (Celo Mainnet)
  - Endpoints: `txlist` (transactions), `tokentx` (token transfers)
  - Authentication: `apikey` parameter
  - Rate limit: 3 requests/second (free tier)

---

## Example: Celo Implementation - Etherscan v2 API (Reference)

**Files Modified:**
- `app/config/chains.ts` - Updated Celo configuration with Etherscan v2
- `app/services/celo-client.ts` - Created client (450 lines)
- `app/page.tsx` - Updated Celo handler
- `app/types/index.ts` - Already had "celo" in ChainId

**Key Implementation Details:**
- **API**: Etherscan v2 API (migrated from deprecated Tatum API)
- **Chain ID**: `42220` (Celo Mainnet)
- **Pagination**: 100 items/page, both `txlist` and `tokentx` endpoints
- **Token handling**: Dual endpoint approach
  - `txlist`: Regular transactions (native CELO + contract calls)
  - `tokentx`: All ERC20 token transfers (cUSD, cEUR, cREAL, etc.)
- **Data merging**: Token transfers merged by transaction hash into regular transactions
- **Symbol caching**: Map with contract address as key, hardcoded mapping for known tokens
- **Rate limiting**: 350ms delay between requests (3/sec limit)
- **Cost basis**: 100% accuracy with full transaction hashes and consistent symbols
- **Known tokens**: cUSD, cEUR, cREAL, CELO (hardcoded mapping)
- **Attribution**: Required - "Data provided by Etherscan.io API"

**Attribution Requirements:**
Data provided by Etherscan.io API. See https://etherscan.io/apis for more information.

**Test Address:** `0xD23Bfd31430eFB9c8358b703B62BdE17F36E1274`
**Test Results:** 76 regular txs + 230 token transfers = 80 CSV rows, 100% cost basis accuracy

**Implementation Pattern:**
```typescript
// 1. Fetch regular transactions
const regularTxs = await fetchAllRegularTransactions(address);

// 2. Fetch token transfers  
const tokenTransfers = await fetchAllTokenTransfers(address);

// 3. Merge by transaction hash
const merged = mergeTransactionsAndTransfers(regularTxs, tokenTransfers);

// 4. Convert to ChainTransaction format
const chainTxs = merged.map(tx => convertToChainTransaction(tx, transfers));
```

---

## Example: Ronin Implementation (Reference)

**Files Modified:**
- `app/types/index.ts` - Added "ronin" to ChainId
- `app/config/chains.ts` - Added ronin configuration
- `app/services/ronin-client.ts` - Created client (285 lines)
- `app/page.tsx` - Added ronin handler
- `public/chains/ronin.svg` - Created icon

**Key Implementation Details:**
- API: GoldRush REST API
- Chain ID: `2020`
- Pagination: 100 items/page, 14 pages for test address
- Token handling: ERC20 events from `log_events`
- Symbol caching: Map with contract address as key
- Cost basis: Achieved 100% with hash + symbol consistency

**Test Address:** `0x267c406d26a4b43614df329d4f2ae6773cb630b2`
**Test Results:** 1,401 transactions, 100% cost basis accuracy

---

## Example: Celestia Implementation (Reference)

**Files Modified:**
- `app/types/index.ts` - Added "celestia" to ChainId
- `app/config/chains.ts` - Added celestia configuration
- `app/services/celestia-client.ts` - Created client (270 lines)
- `app/page.tsx` - Added celestia handler
- `public/chains/celestia.svg` - Created icon

**Key Implementation Details:**
- API: Celenium API (https://api-mainnet.celenium.io/v1)
- Pagination: 100 items/page, offset-based pagination
- Token handling: Native TIA only (no token transfers in list view)
- Address format: Celestia bech32 (celestia prefix + 39 chars)
- Native token: TIA (6 decimals, utia denom)
- Cost basis: Full transaction hash in Notes, from/to addresses included
- Rate limiting: 200ms delays, handles HTTP 429
- Attribution: Required - "Powered by Celenium API" with link to celenium.io

**Test Address:** `celestia16na4yg4rtt4n8j72n54uy5mvxn7f08l76lxpup`
**Test Results:** 1,982 transactions, full pagination, no API key required

---

## Questions to Ask Before Starting

1. **What API provides complete transaction history?**
   - Must support pagination
   - Must include token transfers
   - Should be free or have reasonable limits

2. **What's the address format?**
   - EVM: 0x + 40 hex chars
   - Cosmos: bech32 (prefix + 39 chars)
   - NEAR: named or 64 hex

3. **Are there known tokens to map?**
   - Common tokens: USDC, USDT, WETH
   - Chain-specific: AXS, SLP for Ronin
   - Add to `TOKEN_MAP` if known

4. **What's the native token?**
   - Symbol, decimals, gas token
   - Example: RON (18 decimals) for Ronin

5. **Any special transaction types?**
   - Staking, governance, IBC, etc.
   - May need special handling

---

## Final Notes

**Priority Order:**
1. Get API working (fetch transactions)
2. Ensure complete history (pagination)
3. Parse all token transfers
4. Implement symbol caching
5. Test cost basis accuracy
6. Optimize for edge cases

**Common Mistakes to Avoid:**
- ❌ Not implementing pagination (only getting first 100)
- ❌ Using inconsistent token symbols
- ❌ Missing transaction hashes in CSV
- ❌ Wrong date format
- ❌ Not testing with real addresses
- ❌ Skipping cost basis verification
- ❌ **Missing API attribution** (required by most providers)

**API Attribution Requirements:**
Different APIs have different attribution requirements:

| API | Attribution Required | Notes |
|-----|---------------------|-------|
| Etherscan | ✅ Yes | Must include "Data provided by Etherscan.io API" |
| Celenium | ✅ Yes | Must include "Powered by Celenium API" with link |
| GoldRush | ✅ Yes | Must include attribution to Covalent |
| Pikespeak | ✅ Yes | Must include attribution |
| Blockscout | ❌ No | Open source, no attribution needed |

**Always check API documentation for attribution requirements before deploying!**

**Success Metrics:**
- ✅ Fetches >1000 transactions successfully
- ✅ CSV imports to Awaken without errors
- ✅ Cost basis >95% (aim for 100%)
- ✅ All token symbols recognized
- ✅ No console errors in production

---

*Last Updated: 2026-01-31*
*Document Version: 1.0*
*Author: Development Team*
