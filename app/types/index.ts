// Types for Osmosis transactions and Awaken Tax CSV format

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
  '@type': string;
  from_address?: string;
  to_address?: string;
  sender?: string;
  receiver?: string;
  amount?: Coin[];
  token?: Coin;
  tokens?: Coin[];
}

export interface Coin {
  denom: string;
  amount: string;
}

// Awaken Tax CSV Format
export interface AwakenTaxRow {
  'Date': string; // MM/DD/YYYY HH:MM:SS UTC
  'Received Quantity': string;
  'Received Currency': string;
  'Received Fiat Amount': string;
  'Sent Quantity': string;
  'Sent Currency': string;
  'Sent Fiat Amount': string;
  'Fee Amount': string;
  'Fee Currency': string;
  'Transaction Hash': string;
  'Notes': string;
  'Tag': string; // buy, sell, transfer, etc.
}

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
  fee: string;
  feeCurrency: string;
  memo: string;
  status: 'success' | 'failed';
}

export type TransactionType = 
  | 'send'
  | 'receive'
  | 'swap'
  | 'ibc_transfer'
  | 'delegate'
  | 'undelegate'
  | 'claim_rewards'
  | 'pool_deposit'
  | 'pool_withdraw'
  | 'governance_vote'
  | 'unknown';

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
}

export interface TransactionTableProps {
  transactions: ParsedTransaction[];
  onDownloadCSV: () => void;
}
