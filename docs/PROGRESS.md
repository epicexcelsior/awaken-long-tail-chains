# Multi-Chain Transaction Dashboard - Progress & Learnings

## Project Goals

Build a general-purpose dashboard for viewing wallet transaction history across multiple blockchains, with CSV export in Awaken Tax format.

### Core Requirements

1. Fetch **complete** transaction history (not just recent transactions)
2. Support multiple blockchains (Osmosis, Babylon, Celo, Fantom, etc.)
3. Client-side fetching for privacy (no server storing wallet data)
4. Export to Awaken Tax CSV format for tax reporting

---

## Current Status

| Chain         | Status           | API Used       | Notes                                      |
| ------------- | ---------------- | -------------- | ------------------------------------------ |
| **Celo**      | ✅ Working       | Blockscout     | Full pagination, 100/page                  |
| **Fantom**    | ⚠️ Network issue | Blockscout     | Domain didn't resolve from dev environment |
| **Osmosis**   | ❌ Partial       | LCD API        | Only returns ~1-4 transactions             |
| **Babylon**   | ❌ Failing       | REST API       | 500 errors from AllThatNode                |
| **NEAR**      | ✅ Implemented   | Pikespeak API  | 50/page, full pagination, 5k tx max        |

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

---

## Files Structure

```
app/
├── services/
│   ├── osmosis-client.ts      # Cosmos LCD (limited)
│   ├── babylon-client.ts      # Cosmos REST (failing)
│   ├── tatum-client.ts        # Blockscout API (working for Celo/Fantom)
│   └── near-client.ts         # Pikespeak API for NEAR Protocol
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

### Numia GraphQL (Osmosis - TODO)

```graphql
query {
  messages(where: { sender: { _eq: "{addr}" } }, limit: 100) {
    tx_id
    message_type
  }
}
```
