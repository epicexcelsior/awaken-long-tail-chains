import {
  ChainTransaction,
  ParsedTransaction,
  TransactionType,
  ChainId,
} from "../types";

const CHAIN_ID: ChainId = "celo";
const CHAIN_ID_NUM = "42220"; // Celo Mainnet chain ID for Etherscan v2
const API_KEY = "39SMAR4FE2B41TQI5MDQ4PNDM5BG4HSP7J";
const BASE_URL = "https://api.etherscan.io/v2/api";

// Rate limiting: 3 requests/sec = 333ms minimum, using 350ms for safety
const DELAY_MS = 350;
const PAGE_SIZE = 100;
const MAX_PAGES = 100; // Safety limit

// Common Celo token address to symbol mapping
const CELO_TOKEN_MAP: Record<string, string> = {
  "0x765DE816845861e75A25fCA122bb6898B8B1282a": "cUSD", // Celo Dollar
  "0xD8763CBa276a3738E6DE85b4b3bF5FDed6D6cA73": "cEUR", // Celo Euro
  "0xe8537a3d056BA44681E743195C4bC1a6a8F4b93C": "cREAL", // Celo Brazilian Real
  "0x471EcE3750Da237f93B8E339c536989b8978a438": "CELO", // Native CELO
};

// Cache for token metadata to ensure consistent symbol usage
const tokenMetadataCache: Map<string, { symbol: string; decimals: number; name: string }> = new Map();

/**
 * Fetch ALL transactions from Celo using Etherscan v2 API
 * Comprehensive pagination to ensure we get complete history
 */
export async function fetchAllTransactionsClientSide(
  address: string,
  onProgress?: (count: number, page: number) => void,
): Promise<{ transactions: ChainTransaction[]; metadata: any }> {
  console.log(`[Celo] Starting comprehensive fetch for ${address}`);

  // Fetch both regular transactions and token transfers
  const [regularTransactions, tokenTransfers] = await Promise.all([
    fetchAllRegularTransactions(address, onProgress),
    fetchAllTokenTransfers(address),
  ]);

  console.log(`[Celo] Fetched ${regularTransactions.length} regular transactions`);
  console.log(`[Celo] Fetched ${tokenTransfers.length} token transfers`);

  // Merge token transfers into regular transactions
  const mergedTransactions = mergeTransactionsAndTransfers(regularTransactions, tokenTransfers);

  // Sort by timestamp (newest first)
  mergedTransactions.sort(
    (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime(),
  );

  const dates = mergedTransactions.map((tx) => new Date(tx.timestamp));
  const firstDate =
    dates.length > 0
      ? new Date(Math.min(...dates.map((d) => d.getTime())))
      : null;
  const lastDate =
    dates.length > 0
      ? new Date(Math.max(...dates.map((d) => d.getTime())))
      : null;

  console.log(`[Celo] FINAL: ${mergedTransactions.length} unique transactions`);

  return {
    transactions: mergedTransactions,
    metadata: {
      address,
      chain: CHAIN_ID,
      totalFetched: mergedTransactions.length,
      regularTxCount: regularTransactions.length,
      tokenTransferCount: tokenTransfers.length,
      firstTransactionDate: firstDate?.toISOString(),
      lastTransactionDate: lastDate?.toISOString(),
      dataSource: "Etherscan v2 API",
      chainId: CHAIN_ID_NUM,
    },
  };
}

/**
 * Fetch all regular transactions using txlist endpoint
 */
async function fetchAllRegularTransactions(
  address: string,
  onProgress?: (count: number, page: number) => void,
): Promise<EtherscanTransaction[]> {
  const allTransactions: EtherscanTransaction[] = [];
  let page = 1;
  let hasMore = true;

  while (hasMore && page <= MAX_PAGES) {
    const url = `${BASE_URL}?module=account&action=txlist&address=${address}&chainid=${CHAIN_ID_NUM}&page=${page}&offset=${PAGE_SIZE}&sort=desc&apikey=${API_KEY}`;

    console.log(`[Celo] Fetching txlist page ${page}...`);

    try {
      const response = await fetch(url);
      const data = await response.json();

      if (data.status !== "1") {
        console.error(`[Celo] Page ${page} error:`, data.message || data.result);
        break;
      }

      const transactions: EtherscanTransaction[] = data.result || [];

      if (transactions.length === 0) {
        hasMore = false;
        break;
      }

      allTransactions.push(...transactions);

      if (onProgress) {
        onProgress(allTransactions.length, page);
      }

      console.log(`[Celo] Page ${page}: +${transactions.length} | Total: ${allTransactions.length}`);

      hasMore = transactions.length === PAGE_SIZE;
      page++;

      // Rate limiting
      if (hasMore) {
        await new Promise((resolve) => setTimeout(resolve, DELAY_MS));
      }
    } catch (error) {
      console.error(`[Celo] Page ${page} exception:`, error);
      break;
    }
  }

  return allTransactions;
}

/**
 * Fetch all token transfers using tokentx endpoint
 */
async function fetchAllTokenTransfers(address: string): Promise<EtherscanTokenTransfer[]> {
  const allTransfers: EtherscanTokenTransfer[] = [];
  let page = 1;
  let hasMore = true;

  while (hasMore && page <= MAX_PAGES) {
    const url = `${BASE_URL}?module=account&action=tokentx&address=${address}&chainid=${CHAIN_ID_NUM}&page=${page}&offset=${PAGE_SIZE}&sort=desc&apikey=${API_KEY}`;

    console.log(`[Celo] Fetching tokentx page ${page}...`);

    try {
      const response = await fetch(url);
      const data = await response.json();

      if (data.status !== "1") {
        console.log(`[Celo] tokentx page ${page}:`, data.message || data.result);
        break;
      }

      const transfers: EtherscanTokenTransfer[] = data.result || [];

      if (transfers.length === 0) {
        hasMore = false;
        break;
      }

      allTransfers.push(...transfers);

      console.log(`[Celo] tokentx page ${page}: +${transfers.length} | Total: ${allTransfers.length}`);

      hasMore = transfers.length === PAGE_SIZE;
      page++;

      // Rate limiting
      if (hasMore) {
        await new Promise((resolve) => setTimeout(resolve, DELAY_MS));
      }
    } catch (error) {
      console.error(`[Celo] tokentx page ${page} exception:`, error);
      break;
    }
  }

  return allTransfers;
}

/**
 * Merge regular transactions with token transfers
 */
function mergeTransactionsAndTransfers(
  transactions: EtherscanTransaction[],
  transfers: EtherscanTokenTransfer[]
): ChainTransaction[] {
  // Group transfers by transaction hash
  const transfersByHash = new Map<string, EtherscanTokenTransfer[]>();
  
  transfers.forEach(transfer => {
    if (!transfersByHash.has(transfer.hash)) {
      transfersByHash.set(transfer.hash, []);
    }
    transfersByHash.get(transfer.hash)!.push(transfer);
  });

  // Convert regular transactions to ChainTransaction format
  const chainTransactions: ChainTransaction[] = transactions.map(tx => {
    const txTransfers = transfersByHash.get(tx.hash) || [];
    return convertToChainTransaction(tx, txTransfers);
  });

  // Add transfers that don't have a matching regular transaction
  const txHashes = new Set(transactions.map(t => t.hash));
  const orphanedTransfers = transfers.filter(t => !txHashes.has(t.hash));
  
  if (orphanedTransfers.length > 0) {
    // Group orphaned transfers by hash
    const orphanedByHash = new Map<string, EtherscanTokenTransfer[]>();
    orphanedTransfers.forEach(t => {
      if (!orphanedByHash.has(t.hash)) {
        orphanedByHash.set(t.hash, []);
      }
      orphanedByHash.get(t.hash)!.push(t);
    });

    // Convert orphaned transfers to ChainTransaction format
    orphanedByHash.forEach((transfers, hash) => {
      const representative = transfers[0];
      chainTransactions.push(convertTransferToChainTransaction(hash, representative, transfers));
    });
  }

  return chainTransactions;
}

/**
 * Convert Etherscan transaction to ChainTransaction format
 */
function convertToChainTransaction(
  tx: EtherscanTransaction,
  tokenTransfers: EtherscanTokenTransfer[]
): ChainTransaction {
  const fee = (BigInt(tx.gasUsed || 0) * BigInt(tx.gasPrice || 0)).toString();

  // Build token transfer events
  const tokenEvents: TxEvent[] = tokenTransfers.map((transfer, idx) => {
    const metadata = getTokenMetadata(
      transfer.contractAddress,
      transfer.tokenSymbol,
      transfer.tokenName,
      transfer.tokenDecimal
    );

    return {
      type: "token_transfer",
      attributes: [
        { key: "sender_address", value: transfer.contractAddress },
        { key: "token_symbol", value: metadata.symbol },
        { key: "token_name", value: metadata.name },
        { key: "decimals", value: String(metadata.decimals) },
        { key: "value", value: transfer.value },
        { key: "from", value: transfer.from },
        { key: "to", value: transfer.to },
      ],
    };
  });

  return {
    hash: tx.hash,
    height: tx.blockNumber,
    timestamp: new Date(parseInt(tx.timeStamp) * 1000).toISOString(),
    code: tx.isError === "1" ? 1 : 0,
    chain: CHAIN_ID,
    logs: tokenEvents.length > 0 ? [{
      msg_index: 0,
      log: "Token transfers",
      events: tokenEvents,
    }] : undefined,
    tx: {
      body: {
        messages: [
          {
            "@type": "/cosmos.bank.v1beta1.MsgSend",
            from_address: tx.from,
            to_address: tx.to || "0x0000000000000000000000000000000000000000",
            amount: [
              {
                amount: tx.value,
                denom: "wei",
              },
            ],
          },
        ],
        memo: tx.input && tx.input !== "0x" ? `Input: ${tx.input.slice(0, 30)}...` : "",
      },
      auth_info: {
        fee: {
          amount: [
            {
              amount: fee,
              denom: "wei",
            },
          ],
        },
      },
    },
  };
}

/**
 * Convert orphaned token transfer to ChainTransaction format
 */
function convertTransferToChainTransaction(
  hash: string,
  representative: EtherscanTokenTransfer,
  allTransfers: EtherscanTokenTransfer[]
): ChainTransaction {
  // Build token transfer events
  const tokenEvents: TxEvent[] = allTransfers.map((transfer) => {
    const metadata = getTokenMetadata(
      transfer.contractAddress,
      transfer.tokenSymbol,
      transfer.tokenName,
      transfer.tokenDecimal
    );

    return {
      type: "token_transfer",
      attributes: [
        { key: "sender_address", value: transfer.contractAddress },
        { key: "token_symbol", value: metadata.symbol },
        { key: "token_name", value: metadata.name },
        { key: "decimals", value: String(metadata.decimals) },
        { key: "value", value: transfer.value },
        { key: "from", value: transfer.from },
        { key: "to", value: transfer.to },
      ],
    };
  });

  return {
    hash,
    height: representative.blockNumber,
    timestamp: new Date(parseInt(representative.timeStamp) * 1000).toISOString(),
    code: 0,
    chain: CHAIN_ID,
    logs: [{
      msg_index: 0,
      log: "Token transfers",
      events: tokenEvents,
    }],
    tx: {
      body: {
        messages: [
          {
            "@type": "/cosmos.bank.v1beta1.MsgSend",
            from_address: representative.from,
            to_address: representative.to,
            amount: [
              {
                amount: "0",
                denom: "wei",
              },
            ],
          },
        ],
        memo: "Token transfer",
      },
      auth_info: {
        fee: {
          amount: [],
        },
      },
    },
  };
}

/**
 * Get standardized token symbol from various sources
 * Ensures consistent token identification for cost basis matching
 */
function getTokenSymbol(contractAddress: string, apiSymbol: string, apiName: string): string {
  const address = contractAddress?.toLowerCase() || "";
  
  // Check cache first for consistency
  if (tokenMetadataCache.has(address)) {
    return tokenMetadataCache.get(address)!.symbol;
  }
  
  // Check hardcoded mapping
  if (CELO_TOKEN_MAP[address]) {
    tokenMetadataCache.set(address, {
      symbol: CELO_TOKEN_MAP[address],
      decimals: 18,
      name: apiName || CELO_TOKEN_MAP[address],
    });
    return CELO_TOKEN_MAP[address];
  }
  
  // Use provided symbol if available and valid
  if (apiSymbol && apiSymbol.length > 0 && apiSymbol !== "null" && apiSymbol !== "undefined") {
    tokenMetadataCache.set(address, {
      symbol: apiSymbol,
      decimals: 18,
      name: apiName || apiSymbol,
    });
    return apiSymbol;
  }
  
  // Fall back to shortened address with 0x prefix for traceability
  const shortAddr = address.slice(0, 10);
  tokenMetadataCache.set(address, {
    symbol: shortAddr,
    decimals: 18,
    name: apiName || shortAddr,
  });
  return shortAddr;
}

/**
 * Get token metadata with caching
 */
function getTokenMetadata(
  contractAddress: string,
  apiSymbol: string,
  apiName: string,
  apiDecimals: string
): { symbol: string; decimals: number; name: string } {
  const address = contractAddress?.toLowerCase() || "";
  
  // Check cache first
  if (tokenMetadataCache.has(address)) {
    return tokenMetadataCache.get(address)!;
  }
  
  // Check hardcoded mapping
  if (CELO_TOKEN_MAP[address]) {
    const metadata = {
      symbol: CELO_TOKEN_MAP[address],
      decimals: parseInt(apiDecimals) || 18,
      name: apiName || CELO_TOKEN_MAP[address],
    };
    tokenMetadataCache.set(address, metadata);
    return metadata;
  }
  
  // Use API data
  const symbol = apiSymbol && apiSymbol.length > 0 && apiSymbol !== "null"
    ? apiSymbol
    : address.slice(0, 10);
  
  const metadata = {
    symbol,
    decimals: parseInt(apiDecimals) || 18,
    name: apiName || symbol,
  };
  
  tokenMetadataCache.set(address, metadata);
  return metadata;
}

export function isValidCeloAddress(address: string): boolean {
  return /^0x[a-fA-F0-9]{40}$/.test(address);
}

export function parseTransaction(
  tx: ChainTransaction,
  walletAddress: string,
): ParsedTransaction {
  const messages = tx.tx?.body?.messages || [];
  const message = messages[0];
  const walletLower = walletAddress.toLowerCase();

  let type: TransactionType = "unknown";
  let from = "";
  let to = "";
  let amount = "";
  let currency = "CELO";
  let amount2 = "";
  let currency2 = "";
  let fee = "";
  let feeCurrency = "CELO";
  const tokenTransfers: Array<{ symbol: string; amount: string; from: string; to: string }> = [];

  if (message) {
    from = message.from_address || "";
    to = message.to_address || "";
    const fromLower = from.toLowerCase();
    const toLower = to.toLowerCase();

    // Determine transaction type based on wallet involvement
    const isOutgoing = fromLower === walletLower;
    const isIncoming = toLower === walletLower;

    // Handle native CELO transfer
    if (message.amount && Array.isArray(message.amount) && message.amount.length > 0) {
      const rawAmount = message.amount[0].amount;
      if (rawAmount && rawAmount !== "0") {
        // Convert from wei (10^18) to CELO
        const num = parseFloat(rawAmount) / 1e18;
        amount = num.toFixed(6);
        
        if (isOutgoing) {
          type = "send";
        } else if (isIncoming) {
          type = "receive";
        }
      }
    }

    // Handle token transfers from logs
    if (tx.logs && tx.logs.length > 0) {
      for (const log of tx.logs) {
        if (log.events && Array.isArray(log.events)) {
          for (const event of log.events) {
            if (event.type === "token_transfer" && event.attributes) {
              const attrs: Record<string, string> = {};
              for (const attr of event.attributes) {
                attrs[attr.key] = attr.value;
              }

              const tokenSymbol = attrs["token_symbol"] || "";
              const decimals = parseInt(attrs["decimals"] || "18");
              const value = attrs["value"] || "0";
              const fromAddr = attrs["from"] || "";
              const toAddr = attrs["to"] || "";

              // Calculate token amount
              const tokenAmount = parseFloat(value) / Math.pow(10, decimals);
              const formattedAmount = tokenAmount.toFixed(6);

              // Determine direction for this token transfer
              const tokenIsOutgoing = fromAddr.toLowerCase() === walletLower;
              const tokenIsIncoming = toAddr.toLowerCase() === walletLower;

              tokenTransfers.push({
                symbol: tokenSymbol,
                amount: formattedAmount,
                from: fromAddr,
                to: toAddr,
              });

              // Update transaction type based on token transfers
              if (tokenTransfers.length === 1) {
                // First token transfer - use as primary if no CELO amount
                if (!amount || amount === "" || amount === "0") {
                  amount = formattedAmount;
                  currency = tokenSymbol;
                  from = fromAddr;
                  to = toAddr;
                  type = tokenIsOutgoing ? "send" : tokenIsIncoming ? "receive" : "unknown";
                } else {
                  // We have CELO amount, use token as secondary
                  amount2 = formattedAmount;
                  currency2 = tokenSymbol;
                }
              } else if (tokenTransfers.length === 2 && amount2 === "") {
                // Second token transfer - use as secondary
                amount2 = formattedAmount;
                currency2 = tokenSymbol;
                
                // If we have both incoming and outgoing tokens, it's likely a swap
                const firstTransfer = tokenTransfers[0];
                const firstIsOutgoing = firstTransfer.from.toLowerCase() === walletLower;
                const secondIsIncoming = toAddr.toLowerCase() === walletLower;
                
                if ((firstIsOutgoing && secondIsIncoming) || (tokenIsOutgoing && firstTransfer.to.toLowerCase() === walletLower)) {
                  type = "swap";
                }
              }
            }
          }
        }
      }
    }

    // If no amount set and no token transfers, check if it's a contract interaction
    if ((!amount || amount === "") && tokenTransfers.length === 0) {
      if (isOutgoing) {
        type = "send";
      } else if (isIncoming) {
        type = "receive";
      }
    }
  }

  // Extract fee (convert from wei to CELO)
  const feeAmount = tx.tx?.auth_info?.fee?.amount?.[0];
  if (feeAmount && feeAmount.amount && feeAmount.amount !== "0") {
    const feeNum = parseFloat(feeAmount.amount) / 1e18;
    fee = feeNum.toFixed(8);
  }

  // Build comprehensive notes for cost basis tracking
  let notes = type;
  
  // Add token transfer details to notes
  if (tokenTransfers.length > 0) {
    const transferSummary = tokenTransfers.map(t => `${t.amount} ${t.symbol}`).join(", ");
    notes += ` - ${transferSummary}`;
  }
  
  // Add full transaction hash
  notes += ` - [TX: ${tx.hash}]`;
  
  // Add from/to addresses
  notes += ` (${from.slice(0, 8)}... -> ${to.slice(0, 8)}...)`;
  
  // Add memo if present
  if (tx.tx?.body?.memo && tx.tx.body.memo.length > 0) {
    notes += ` (${tx.tx.body.memo})`;
  }

  return {
    hash: tx.hash,
    timestamp: new Date(tx.timestamp),
    height: parseInt(tx.height, 10) || 0,
    type,
    from,
    to,
    amount,
    currency,
    amount2,
    currency2,
    fee,
    feeCurrency,
    memo: notes,
    status: tx.code === 0 ? "success" : "failed",
    chain: CHAIN_ID,
  };
}

// Type definitions for Etherscan API responses
interface EtherscanTransaction {
  blockNumber: string;
  timeStamp: string;
  hash: string;
  nonce: string;
  blockHash: string;
  transactionIndex: string;
  from: string;
  to: string;
  value: string;
  gas: string;
  gasPrice: string;
  isError: string;
  txreceipt_status: string;
  input: string;
  contractAddress: string;
  cumulativeGasUsed: string;
  gasUsed: string;
  confirmations: string;
  methodId?: string;
  functionName?: string;
}

interface EtherscanTokenTransfer {
  blockNumber: string;
  timeStamp: string;
  hash: string;
  nonce: string;
  blockHash: string;
  from: string;
  contractAddress: string;
  to: string;
  value: string;
  tokenName: string;
  tokenSymbol: string;
  tokenDecimal: string;
  transactionIndex: string;
  gas: string;
  gasPrice: string;
  gasUsed: string;
  cumulativeGasUsed: string;
  input: string;
  confirmations: string;
}

interface TxEvent {
  type: string;
  attributes: { key: string; value: string }[];
}
