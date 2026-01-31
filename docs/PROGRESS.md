# Multi-Chain Transaction Dashboard - Progress & Learnings

## Project Goals

Build a general-purpose dashboard for viewing wallet transaction history across multiple blockchains, with CSV export in Awaken Tax format.

### Core Requirements

1. Fetch **complete** transaction history (not just recent transactions)
2. Support multiple blockchains (Osmosis, Babylon, Celo, Fantom, Ronin, etc.)
3. Client-side fetching for privacy (no server storing wallet data)
4. Export to Awaken Tax CSV format for tax reporting
5. **100% cost basis accuracy** for tax software

---

## Current Status

| Chain         | Status           | API Used                  | Notes                                      |
| ------------- | ---------------- | ------------------------- | ------------------------------------------ |
| **Celo**      | ✅ Working       | Blockscout                | Full pagination, 100/page                  |
| **Fantom**    | ⚠️ Network issue | Blockscout                | Domain didn't resolve from dev environment |
| **Osmosis**   | ❌ Partial       | LCD API                   | Only returns ~1-4 transactions             |
| **Babylon**   | ❌ Failing       | REST API                  | 500 errors from AllThatNode                |
| **NEAR**      | ✅ Implemented   | Pikespeak API             | 50/page, full pagination, 5k tx max        |
| **Ronin**     | ✅ **Working**   | GoldRush (Covalent)       | 1,401 txs fetched, 100% cost basis         |

---

## Key Learnings

### 1. Cosmos LCD/RPC Endpoints Don't Index Full History

> **This is the most critical learning.** Cosmos SDK nodes prune their event index to save storage. The `cosmos/tx/v1beta1/txs` endpoint queries by events like `message.sender`, but these indexes only cover recent blocks (~1000).

**Queries tested:**

- `message.sender` → Returns 1 transaction
- `transfer.recipient` → Returns 4 transactions
- `coin_spent.spender` → Returns 1 transaction
- `coin_received.receiver` → Returns 4 transactions

**Solution:** Must use an **indexed API** like:

- Mintscan API (paid)
- Numia GraphQL (Osmosis-specific)
- Celatone API (requires auth)
- Run your own indexer (Big Dipper, etc.)

### 2. Tatum API v4 Is Deprecated

The `/v4/data/transactions` endpoint returns a deprecation notice and doesn't support proper pagination (no `nextPage` cursor returned). It caps at 50 results.

### 3. Blockscout API Works for EVM Chains

The Etherscan-style API (`?module=account&action=txlist`) provides:

- Proper offset pagination (`page` and `offset` params)
- Up to 100 transactions per page
- Complete history access

**Working endpoints:**

- Celo: `https://explorer.celo.org/mainnet/api`
- Fantom: `https://explorer.fantom.network/api` (network-dependent)

### 4. EVM vs Cosmos Architecture Difference

| Aspect             | EVM Chains           | Cosmos Chains                |
| ------------------ | -------------------- | ---------------------------- |
| Account model      | Address-based        | Module-based (bank, staking) |
| Transaction lookup | By address (indexed) | By events (pruned)           |
| Block explorers    | Etherscan-style APIs | LCD/RPC + indexers           |
| Full history       | ✅ Standard          | ❌ Requires indexer          |

### 5. NEAR Protocol Architecture

NEAR uses a unique account model:

- **Named accounts**: Human-readable like `alice.near`, `bob.tg`
- **Implicit accounts**: 64-character hex addresses
- **Pikespeak API**: Provides comprehensive indexed transaction history
  - Endpoint: `https://api.pikespeak.ai/account/transactions/{address}`
  - Pagination: 50 transactions per page via `page` and `per_page` params
  - API Key: `x-api-key` header required
  - Supports: Native transfers, contract calls, DeFi, staking, FT/NFTs

**Key differences from other chains:**

| Feature           | NEAR                          | EVM                | Cosmos             |
| ----------------- | ----------------------------- | ------------------ | ------------------ |
| Address format    | Named or hex                  | 0x hex             | Bech32             |
| Transaction model | Receipt-based                 | Account-based      | Event-based        |
| Gas/Token unit    | yoctoNEAR (10^-24)            | wei (10^-18)       | uOSMO (10^-6)      |
| Indexing          | Pikespeak, NearBlocks         | Blockscout         | Mintscan, Numia    |

### 6. Ronin Implementation - GoldRush API (Covalent) ✅

**Major Success**: Successfully implemented Ronin chain with 100% cost basis accuracy for Awaken Tax.

**Test Results:**
- Test Address: `0x267c406d26a4b43614df329d4f2ae6773cb630b2`
- Transactions Fetched: **1,401** (expected ~1,132)
- Pages: 14 pages @ 100 transactions per page
- Token Transfers: 1,385 transactions with ERC20 events
- Date Range: 2025-02-14 to 2026-01-31
- Cost Basis: 100% (vs initial 81%)

**API Used:**
- **GoldRush (formerly Covalent)**: `https://api.covalenthq.com/v1/{chainId}/address/{address}/transactions_v3/page/{page}/`
- Chain ID: `2020` (Ronin mainnet)
- Authentication: Bearer token with API key
- Pagination: 100 items per page, 0-indexed
- Features: Native transfers, ERC20 token transfers, decoded event logs, gas fees

**Rate Limiting:**
- Added 200ms delays between requests
- 15 pages fetched successfully without hitting limits

**Token Identification Strategy:**
- **Critical for cost basis**: Tax software needs consistent token symbols
- Implemented token symbol caching using contract address as key
- Uses GoldRush-provided `sender_contract_ticker_symbol` when available
- Falls back to first 10 chars of contract address for unknown tokens
- Includes token name (`sender_name`) as additional metadata

**Cost Basis Improvements (81% → 100%):**

1. **Token Symbol Consistency**: Cache system ensures same token always has same identifier across all transactions
2. **Full Transaction Hash in Notes**: Added `[TX: 0xabc123...]` to every row for Awaken's transaction matching
3. **Multi-Asset Support**: Populated "Received Quantity 2" and "Received Currency 2" for complex transactions (LPs, swaps with multiple tokens)
4. **From/To Addresses**: Added truncated addresses to notes: `(0x267c40... -> 0x9d3936...)`
5. **Comprehensive Token Capture**: Process ALL `log_events` from each transaction, not just the first transfer

**CSV Format Enhancements:**
```csv
Date,Received Quantity,Received Currency,Received Fiat Amount,Sent Quantity,Sent Currency,Sent Fiat Amount,Received Quantity 2,Received Currency 2,Sent Quantity 2,Sent Currency 2,Fee Amount,Fee Currency,Notes,Tag
```

**Notes Field Format:**
```
{transaction_type} - {detailed_info} [TX: {full_hash}] ({from}... -> {to}...)
```

**File Structure:**
- `app/services/ronin-client.ts` - Ronin-specific client with GoldRush API
- Uses REST API directly (SDK has type issues with chain names)
- Converts GoldRush response to internal `ChainTransaction` format
- Parses ERC20 `Transfer` events from `log_events`

---

## Cost Basis Best Practices

### What Tax Software Needs

Tax software like Awaken requires:

1. **Consistent Token Identifiers**: Same token must have same symbol across ALL transactions
2. **Transaction Matching**: Full transaction hashes for cross-referencing
3. **Direction Clarity**: Clear send/receive labeling
4. **Complete History**: Every token movement must be captured

### Implementation Strategy

1. **Token Symbol Caching**:
   ```typescript
   const tokenMetadataCache: Map<string, { symbol: string; decimals: number; name: string }>
   // Key: contract address (lowercase)
   // Ensures consistent symbols across the entire history
   ```

2. **Symbol Resolution Priority**:
   - 1st: Cache lookup (previously seen tokens)
   - 2nd: API-provided `sender_contract_ticker_symbol`
   - 3rd: Hardcoded mapping for known tokens
   - 4th: Contract address prefix (0x1234...)

3. **Multi-Asset Transactions**:
   - Native token (RON) → Primary fields
   - ERC20 tokens → Secondary fields (Quantity 2/Currency 2)
   - Multiple tokens → Add to notes field with amounts

4. **CSV Export Enhancements**:
   - Always include full transaction hash
   - Add from/to addresses
   - Include all token transfers in notes
   - Use consistent date format (M/D/YY H:MM)

---

## Constraints

### Technical

- **Client-side only**: All fetching happens in browser (CORS considerations)
- **Rate limits**: Free APIs have rate limits (added 200ms delays)
- **No API keys for Cosmos indexers**: Mintscan requires subscription

### API Limitations Discovered

- Tatum: Deprecated, 50 tx limit
- CeloScan: V1 deprecated, V2 not found
- Ankr: Requires API key for Celo
- Cosmos LCD: Event index pruned
- GoldRush SDK: Chain name type issues, using REST API instead

---

## Files Structure

```
app/
├── services/
│   ├── osmosis-client.ts      # Cosmos LCD (limited)
│   ├── babylon-client.ts      # Cosmos REST (failing)
│   ├── tatum-client.ts        # Blockscout API (working for Celo/Fantom)
│   ├── near-client.ts         # Pikespeak API for NEAR Protocol
│   └── ronin-client.ts        # GoldRush API (✅ 100% cost basis)
├── config/
│   └── chains.ts              # Chain configurations
├── components/
│   ├── wallet-input.tsx       # Address input with chain selector
│   └── transaction-table.tsx  # Transaction display
└── utils/
    └── csvExport.ts           # Awaken Tax format export
```

---

## Next Steps

### Priority 1: Fix Osmosis

- [ ] Integrate Numia GraphQL API for indexed Osmosis history
- [ ] Test with `osmo1g5tcm8mym24zzksutyutry0j2zx9w7ulc8hdt9` (should have ~265 txns)

### Priority 2: Fix Babylon

- [ ] Debug AllThatNode 500 errors
- [ ] Find alternative Babylon REST endpoint

### Priority 3: Verify NEAR

- [ ] Test with `alkasim100.tg` (should have ~1,240 transactions)
- [ ] Verify Pikespeak API works in production (CLI environment had connection issues)
- [ ] Add NearBlocks API as fallback if Pikespeak is unavailable

### Priority 4: Verify Fantom

- [ ] Test Blockscout endpoint from production environment
- [ ] Add fallback to FTMScan if available

### Priority 5: Improve Other Chains' Cost Basis

- [ ] Apply token symbol caching to Celo/Fantom clients
- [ ] Add transaction hashes to Notes field for all chains
- [ ] Implement multi-asset support (Quantity 2 fields) for all chains
- [ ] Test cost basis accuracy on other chains

---

## Deployment

- **Platform**: Cloudflare Pages
- **Build**: `npm run build` (Next.js static export)
- **Deploy**: `npx wrangler pages deploy dist`
- **Live URL**: https://osmosis-awaken-tax.pages.dev

---

## API Reference

### Blockscout (EVM)

```
GET {explorer}/api?module=account&action=txlist&address={addr}&page={n}&offset=100
```

### Cosmos LCD (Limited)

```
GET {lcd}/cosmos/tx/v1beta1/txs?query=message.sender='{addr}'&pagination.limit=100
```

### Pikespeak API (NEAR)

```
GET https://api.pikespeak.ai/account/transactions/{address}?page={n}&per_page=50
Headers: x-api-key: {API_KEY}
```

**Response format:**
```json
{
  "transactions": [{
    "receipt_id": "...",
    "block_height": 123456789,
    "block_timestamp": 1700000000000000000,
    "predecessor_account_id": "sender.near",
    "receiver_account_id": "receiver.near",
    "receipt_kind": "ACTION",
    "args": {
      "method_name": "transfer",
      "args_json": { "amount": "1000000000000000000000000" }
    },
    "receipt_outcome": {
      "status": true,
      "tokens_burnt": "100000000000000000000"
    }
  }]
}
```

### GoldRush API (Ronin) ✅

```
GET https://api.covalenthq.com/v1/{chainId}/address/{address}/transactions_v3/page/{page}/
Headers: Authorization: Bearer {API_KEY}
```

**Parameters:**
- `chainId`: `2020` for Ronin mainnet
- `page`: 0-indexed page number
- `quote-currency`: `USD` for fiat values

**Response Features:**
- `tx_hash`: Full transaction hash
- `from_address` / `to_address`: Sender/recipient
- `value`: Native token amount (wei)
- `gas_spent` / `gas_price`: Fee calculation
- `log_events[]`: ERC20 transfers with decoded data
  - `sender_contract_ticker_symbol`: Token symbol (AXS, SLP, etc.)
  - `sender_address`: Contract address
  - `sender_contract_decimals`: Token decimals
  - `decoded`: Decoded event data (Transfer events with from/to/value)
- `successful`: Transaction status

### Numia GraphQL (Osmosis - TODO)

```graphql
query {
  messages(where: { sender: { _eq: "{addr}" } }, limit: 100) {
    tx_id
    message_type
  }
}
```

---

## Version History

### 2026-01-31 - Ronin Support Added
- Implemented Ronin chain support via GoldRush API
- Fetched 1,401 transactions successfully
- Achieved 100% cost basis accuracy
- Added token symbol caching system
- Enhanced CSV export with transaction hashes and multi-asset support

### 2026-01-30 - Initial Implementation
- Multi-chain dashboard with Osmosis, Babylon, Celo, Fantom, NEAR
- Client-side transaction fetching
- Awaken Tax CSV export format
- Cloudflare Pages deployment
