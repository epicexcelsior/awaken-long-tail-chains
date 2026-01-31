# Awaken Long Tail Chains

A multi-chain transaction dashboard that fetches complete blockchain history and exports to [Awaken Tax](https://awaken.tax) CSV format for accurate cost basis calculations.

**Live Demo**: [https://awaken-long-tail-chains.pages.dev](https://awaken-long-tail-chains.pages.dev)

## Quick Start

### Prerequisites
- Node.js 18+ (20+ recommended)
- npm 9+ or yarn
- Git

### Installation
```bash
# Clone the repository
git clone https://github.com/epicexcelsior/awaken-long-tail-chains.git
cd awaken-long-tail-chains

# Install dependencies
npm install

# Start development server
npm run dev
```

Visit [http://localhost:3000](http://localhost:3000) in your browser.

## Supported Chains

| Chain | Status | API Provider | Address Format | Features |
|-------|--------|--------------|----------------|----------|
| **Celo** | ✅ Live | Etherscan v2 | `0x...` (EVM) | Native transfers, ERC20 tokens, NFTs, internal transactions |
| **Ronin** | ✅ Live | GoldRush (Covalent) | `0x...` (EVM) | Gaming transactions, token transfers |
| **Celestia** | ✅ Live | Celenium | `celestia1...` | Cosmos SDK, TIA transfers, staking |
| **Tezos** | ✅ Live | TzKT | `tz1...` | XTZ transfers, contract calls, governance |
| **Osmosis** | 🚧 Coming Soon | LCD / Mintscan | `osmo1...` | DEX swaps, liquidity, IBC transfers |
| **Babylon** | 🚧 Coming Soon | AllThatNode | `bbn1...` | Bitcoin staking, Cosmos SDK |
| **NEAR** | 🚧 Coming Soon | Pikespeak | `account.near` | Fast transactions, sharding |
| **Fantom** | 🚧 Coming Soon | Tatum | `0x...` (EVM) | High-speed EVM chain |
| **Polkadot** | 🚧 Coming Soon | AllThatNode | `1...` | Multi-chain network |
| **Flow** | 🚧 Coming Soon | AllThatNode | `0x...` | NFT and gaming focused |

## Using the Dashboard

### 1. Select a Chain
Choose from the dropdown of enabled chains (Celo, Ronin, Celestia, Tezos).

### 2. Enter Wallet Address
Paste any valid wallet address for the selected chain. The dashboard will validate the format automatically.

**Test Addresses**:
- Celo: `0xD8763CBa276a3738E6DE85b4b3bF5FDed6D6cA73`
- Ronin: `0x267c406d26a4b43614df329d4f2ae6773cb630b2`
- Celestia: `celestia16na4yg4rtt4n8j72n54uy5mvxn7f08l76lxpup`
- Tezos: `tz1daLg7rrK5msfvPkxDNTdEeYdp73qmjD8t`

### 3. View Transactions
The dashboard fetches **complete transaction history** including:
- Native token transfers
- ERC20 token transfers (EVM chains)
- NFT transfers
- Internal/contract transactions
- Staking and governance operations

### 4. Export to CSV
Click "Export CSV" to download transactions in Awaken Tax format:
```
Date,Received Quantity,Received Currency,Sent Quantity,Sent Currency,Fee Amount,Fee Currency,Transaction Hash,Notes,Tag
```

**Features**:
- Proper date formatting (M/D/YY H:MM UTC)
- Complete transaction hashes in Notes
- From/To addresses in Notes
- Token symbols cached for consistency
- Cost basis optimized for 95%+ accuracy

## Custom API Keys
The dashboard includes a **Custom API Keys** dropdown to add your own API keys for higher rate limits. If left empty, it uses the default keys.

**Supported Services**:
- **Celo**: Etherscan API key
- **Ronin**: Covalent (GoldRush) API key
- **Celestia**: No API key required (public endpoint)
- **Tezos**: No API key required (public TzKT endpoint)
- **Babylon** (coming soon): AllThatNode API key
- **NEAR** (coming soon): Pikespeak API key
- **Fantom** (coming soon): Tatum API key
- **Flow/Polkadot** (coming soon): AllThatNode API key
- **Mintscan** (coming soon): Mintscan API key

Keys are saved to browser localStorage and persist across sessions.

## Deployment
### Deploy to Cloudflare Pages
```bash
# Build the project
npm run build

# Deploy (requires Wrangler CLI)
npx wrangler pages deploy dist --project-name=awaken-long-tail-chains
```

### First-Time Setup
If the project doesn't exist in Cloudflare:
```bash
npx wrangler pages project create awaken-long-tail-chains --production-branch=main
npx wrangler pages deploy dist --project-name=awaken-long-tail-chains
```

## Project Structure
```
app/
├── components/
│   ├── api-key-manager.tsx    # Custom API key UI
│   ├── error-display.tsx      # Error states
│   ├── transaction-table.tsx  # Transaction list
│   └── wallet-input.tsx       # Address input form
├── config/
│   └── chains.ts              # Chain configurations
├── hooks/
│   └── useApiKeys.ts          # API key React hook
├── services/
│   ├── celo-client.ts         # Celo/Etherscan integration
│   ├── ronin-client.ts        # Ronin/Covalent integration
│   ├── celestia-client.ts     # Celestia/Celenium integration
│   ├── tezos-client.ts        # Tezos/TzKT integration
│   └── ...                    # Other chain clients
├── types/
│   └── index.ts               # TypeScript types
├── utils/
│   ├── apiKeys.ts             # API key utilities
│   └── csvExport.ts           # CSV generation
├── page.tsx                   # Main dashboard
└── layout.tsx                 # Root layout

public/chains/                 # Chain icons
components/ui/                   # shadcn/ui components
```

## API Integrations
### Celo (Etherscan v2)
- **Endpoint**: `https://api.etherscan.io/v2/api`
- **Rate Limit**: 3 requests/second (free tier)
- **Features**: Comprehensive EVM data including ERC20, ERC721, ERC1155, and internal transactions

### Ronin (GoldRush/Covalent)
- **Endpoint**: `https://api.covalenthq.com/v1`
- **Rate Limit**: Based on API key tier
- **Features**: Gaming-focused EVM chain data, Axie Infinity transactions

### Celestia (Celenium)
- **Endpoint**: `https://api-mainnet.celenium.io/v1`
- **Rate Limit**: Public endpoint
- **Features**: Cosmos SDK data, TIA transfers, modular blockchain focus

### Tezos (TzKT)
- **Endpoint**: `https://api.tzkt.io/v1`
- **Rate Limit**: Public endpoint (generous limits)
- **Features**: XTZ transfers, contract calls, governance operations

## Adding New Chains
See [docs/QUICKSTART.md](docs/QUICKSTART.md) for detailed instructions on adding support for new blockchains.

Key requirements:
1. Comprehensive API with pagination support
2. Free tier or reasonable rate limits
3. Complete transaction history (not just recent)
4. Proper attribution in UI

## Cost Basis Best Practices
The dashboard is optimized for accurate cost basis calculations:

1. **Token Symbol Caching**: Consistent symbols across all transactions
2. **Complete History**: All transaction types fetched (not just transfers)
3. **Rich Metadata**: Transaction hashes, addresses, and token details in Notes
4. **Proper Formatting**: Dates in M/D/YY H:MM format for Awaken Tax compatibility
5. **No Missing Data**: All required CSV fields populated

## Tech Stack
- [Next.js 16](https://nextjs.org/) - React framework with static export
- [TypeScript](https://www.typescriptlang.org/) - Type safety
- [Tailwind CSS](https://tailwindcss.com/) - Styling
- [shadcn/ui](https://ui.shadcn.com/) - UI components
- [CosmJS](https://github.com/cosmos/cosmjs) - Cosmos SDK integration
- [Wrangler](https://developers.cloudflare.com/workers/wrangler/) - Cloudflare deployment

## License
MIT License - feel free to use for your own projects.

## Links
- [Live Dashboard](https://awaken-long-tail-chains.pages.dev)
- [GitHub Repository](https://github.com/epicexcelsior/awaken-long-tail-chains)
- [Awaken Tax](https://awaken.tax](https://awaken.tax/signup?ref=tp0xqrt0)

## Support
For issues or feature requests, please open an issue on GitHub.
