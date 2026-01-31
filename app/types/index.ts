// Types for Multi-Chain transactions and Awaken Tax CSV format

// Chain IDs
export type ChainId =
  | "osmosis"
  | "babylon"
  | "near"
  | "polkadot"
  | "celo"
  | "fantom"
  | "flow"
  | "ronin"
  | "celestia"
  | "tezos";

// Chain Configuration
export interface ChainConfig {
  id: ChainId;
  name: string;
  displayName: string;
  icon: string;
  color: string;
  gradientFrom: string;
  gradientTo: string;
  addressPrefix: string;
  addressRegex: RegExp;
  testAddress: string;
  rpcEndpoints: string[];
  apiEndpoints: string[];
  explorerUrl: string;
  apiKey: string | null;
  decimals: number;
  nativeDenom: string;
  nativeSymbol: string;
  enabled: boolean;
  description: string;
}

// Generic transaction interface (chain-agnostic)
export interface ChainTransaction {
  hash: string;
  height: string;
  timestamp: string;
  code: number;
  chain: ChainId;
  logs?: TxLog[];
  tx: {
    body: {
      messages: Message[];
      memo?: string;
    };
    auth_info: {
      fee?: {
        amount?: Coin[];
      };
    };
  };
}

// Legacy Osmosis transaction (keep for backward compatibility)
export interface OsmosisTransaction {
  txhash: string;
  height: string;
  timestamp: string;
  code: number;
  logs?: TxLog[];
  tx: {
    body: {
      messages: Message[];
      memo?: string;
    };
    auth_info: {
      fee?: {
        amount?: Coin[];
      };
    };
  };
}

export interface TxLog {
  msg_index: number;
  log: string;
  events: TxEvent[];
}

export interface TxEvent {
  type: string;
  attributes: Attribute[];
}

export interface Attribute {
  key: string;
  value: string;
}

export interface Message {
  "@type": string;
  from_address?: string;
  to_address?: string;
  sender?: string;
  receiver?: string;
  delegator_address?: string;
  validator_address?: string;
  voter?: string;
  amount?: Coin[] | Coin;
  token?: Coin;
  tokens?: Coin[];
}

export interface Coin {
  denom: string;
  amount: string;
}

// Awaken Tax CSV Format - Multi-Asset Template
// Based on: Date, Received Quantity, Received Currency, Received Fiat Amount, Sent Quantity, Sent Currency, Sent Fiat Amount,
//           Received Quantity 2, Received Currency 2, Sent Quantity 2, Sent Currency 2, Fee Amount, Fee Currency, Notes, Tag
export interface AwakenTaxRow {
  Date: string; // M/D/YY H:MM format (e.g., "2/6/23 11:29")
  "Received Quantity": string;
  "Received Currency": string;
  "Received Fiat Amount": string;
  "Sent Quantity": string;
  "Sent Currency": string;
  "Sent Fiat Amount": string;
  "Received Quantity 2": string;
  "Received Currency 2": string;
  "Sent Quantity 2": string;
  "Sent Currency 2": string;
  "Fee Amount": string;
  "Fee Currency": string;
  Notes: string;
  Tag: string;
}

// Awaken Tax CSV Format (Perpetuals/Trading Format)
// Based on: example.csv
// Columns: Date, Asset, Amount, Fee, P&L, Payment Token, ID, Notes, Tag, Transaction Hash
export interface AwakenTaxTradingRow {
  Date: string; // YYYY-MM-DD format
  Asset: string;
  Amount: string;
  Fee: string;
  "P&L": string;
  "Payment Token": string;
  ID: string;
  Notes: string;
  Tag: string; // open_position, close_position, funding_payment
  "Transaction Hash": string;
}

// CSV Export format type
export type CSVFormat = "standard" | "trading";

// Simplified transaction for UI display
export interface ParsedTransaction {
  hash: string;
  timestamp: Date;
  height: number;
  type: TransactionType;
  from: string;
  to: string;
  amount: string;
  currency: string;
  amount2?: string; // For multi-asset transactions
  currency2?: string;
  fee: string;
  feeCurrency: string;
  fiatAmount?: string; // USD value of the transaction amount
  fiatCurrency?: string; // Usually "USD"
  memo: string;
  status: "success" | "failed";
  chain: ChainId;
}

export type TransactionType =
  | "send"
  | "receive"
  | "swap"
  | "ibc_transfer"
  | "delegate"
  | "undelegate"
  | "claim_rewards"
  | "pool_deposit"
  | "pool_withdraw"
  | "governance_vote"
  | "unknown";

// API Configuration
export interface ApiConfig {
  mintscanApiKey?: string;
  lcdEndpoint: string;
  rpcEndpoint: string;
}

// Component Props
export interface WalletInputProps {
  onSubmit: (address: string) => void;
  isLoading: boolean;
  chainId: ChainId;
  onChainChange?: (chainId: ChainId) => void;
}

export interface TransactionTableProps {
  transactions: ParsedTransaction[];
  onDownloadCSV: () => void;
  walletAddress: string;
  chainId: ChainId;
}
