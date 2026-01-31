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
 * Fetch COMPREHENSIVE transaction history from Celo using Etherscan v2 API
 * 
 * Fetches ALL transaction types:
 * 1. Regular transactions (txlist) - native transfers, contract calls
 * 2. Internal transactions (txlistinternal) - DeFi, contract interactions, proxy transfers
 * 3. ERC20 token transfers (tokentx) - all ERC20 tokens
 * 4. ERC721 (NFT) transfers (tokennfttx) - NFTs
 * 5. ERC1155 transfers (token1155tx) - multi-token standard
 * 
 * This ensures complete cost basis accuracy by capturing every single transaction.
 */
export async function fetchAllTransactionsClientSide(
  address: string,
  onProgress?: (count: number, page: number) => void,
): Promise<{ transactions: ChainTransaction[]; metadata: any }> {
  console.log(`[Celo] Starting COMPREHENSIVE fetch for ${address}`);

  // Fetch ALL transaction types concurrently
  const [
    regularTransactions,
    internalTransactions,
    tokenTransfers,
    nftTransfers,
    erc1155Transfers
  ] = await Promise.all([
    fetchAllRegularTransactions(address, onProgress),
    fetchAllInternalTransactions(address),
    fetchAllTokenTransfers(address),
    fetchAllNFTTransfers(address),
    fetchAllERC1155Transfers(address),
  ]);

  console.log(`[Celo] Fetched ${regularTransactions.length} regular transactions`);
  console.log(`[Celo] Fetched ${internalTransactions.length} internal transactions`);
  console.log(`[Celo] Fetched ${tokenTransfers.length} ERC20 token transfers`);
  console.log(`[Celo] Fetched ${nftTransfers.length} ERC721 (NFT) transfers`);
  console.log(`[Celo] Fetched ${erc1155Transfers.length} ERC1155 transfers`);

  // Merge all transaction types into a comprehensive list
  const mergedTransactions = mergeAllTransactions(
    regularTransactions,
    internalTransactions,
    tokenTransfers,
    nftTransfers,
    erc1155Transfers
  );

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

  console.log(`[Celo] FINAL: ${mergedTransactions.length} unique transactions (comprehensive)`);

  return {
    transactions: mergedTransactions,
    metadata: {
      address,
      chain: CHAIN_ID,
      totalFetched: mergedTransactions.length,
      regularTxCount: regularTransactions.length,
      internalTxCount: internalTransactions.length,
      tokenTransferCount: tokenTransfers.length,
      nftTransferCount: nftTransfers.length,
      erc1155TransferCount: erc1155Transfers.length,
      firstTransactionDate: firstDate?.toISOString(),
      lastTransactionDate: lastDate?.toISOString(),
      dataSource: "Etherscan v2 API (Comprehensive)",
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
  return fetchWithPagination<EtherscanTransaction>(
    address,
    'txlist',
    'regular',
    onProgress
  );
}

/**
 * Fetch all internal transactions using txlistinternal endpoint
 * 
 * Internal transactions are CRITICAL for DeFi and contract interactions.
 * They capture:
 * - Contract-to-contract calls
 * - DeFi protocol interactions (swaps, liquidity, etc.)
 * - Proxy contract transfers
 * - Multi-sig operations
 */
async function fetchAllInternalTransactions(
  address: string
): Promise<EtherscanInternalTransaction[]> {
  return fetchWithPagination<EtherscanInternalTransaction>(
    address,
    'txlistinternal',
    'internal'
  );
}

/**
 * Fetch all ERC20 token transfers using tokentx endpoint
 */
async function fetchAllTokenTransfers(
  address: string
): Promise<EtherscanTokenTransfer[]> {
  return fetchWithPagination<EtherscanTokenTransfer>(
    address,
    'tokentx',
    'token'
  );
}

/**
 * Fetch all ERC721 (NFT) transfers using tokennfttx endpoint
 */
async function fetchAllNFTTransfers(
  address: string
): Promise<EtherscanNFTTransfer[]> {
  return fetchWithPagination<EtherscanNFTTransfer>(
    address,
    'tokennfttx',
    'nft'
  );
}

/**
 * Fetch all ERC1155 token transfers using token1155tx endpoint
 */
async function fetchAllERC1155Transfers(
  address: string
): Promise<EtherscanERC1155Transfer[]> {
  return fetchWithPagination<EtherscanERC1155Transfer>(
    address,
    'token1155tx',
    'erc1155'
  );
}

/**
 * Generic pagination function for all Etherscan endpoints
 */
async function fetchWithPagination<T>(
  address: string,
  action: string,
  typeLabel: string,
  onProgress?: (count: number, page: number) => void
): Promise<T[]> {
  const allItems: T[] = [];
  let page = 1;
  let hasMore = true;

  while (hasMore && page <= MAX_PAGES) {
    const url = `${BASE_URL}?module=account&action=${action}&address=${address}&chainid=${CHAIN_ID_NUM}&page=${page}&offset=${PAGE_SIZE}&sort=desc&apikey=${API_KEY}`;

    console.log(`[Celo] Fetching ${typeLabel} page ${page}...`);

    try {
      const response = await fetch(url);
      const data = await response.json();

      if (data.status !== "1") {
        // Some endpoints return "No transactions found" as status "0" but it's not an error
        if (data.result === "No transactions found") {
          console.log(`[Celo] No ${typeLabel} transactions found`);
          hasMore = false;
          break;
        }
        console.error(`[Celo] ${typeLabel} page ${page} error:`, data.message || data.result);
        break;
      }

      const items: T[] = data.result || [];

      if (items.length === 0) {
        hasMore = false;
        break;
      }

      allItems.push(...items);

      if (onProgress && typeLabel === 'regular') {
        onProgress(allItems.length, page);
      }

      console.log(`[Celo] ${typeLabel} page ${page}: +${items.length} | Total: ${allItems.length}`);

      hasMore = items.length === PAGE_SIZE;
      page++;

      // Rate limiting
      if (hasMore) {
        await new Promise((resolve) => setTimeout(resolve, DELAY_MS));
      }
    } catch (error) {
      console.error(`[Celo] ${typeLabel} page ${page} exception:`, error);
      break;
    }
  }

  return allItems;
}

/**
 * Merge ALL transaction types into comprehensive ChainTransaction list
 */
function mergeAllTransactions(
  regularTransactions: EtherscanTransaction[],
  internalTransactions: EtherscanInternalTransaction[],
  tokenTransfers: EtherscanTokenTransfer[],
  nftTransfers: EtherscanNFTTransfer[],
  erc1155Transfers: EtherscanERC1155Transfer[]
): ChainTransaction[] {
  const chainTransactions: ChainTransaction[] = [];
  const processedHashes = new Set<string>();

  // Group all transfers by transaction hash for merging
  const transfersByHash = new Map<string, TransferGroup>();
  
  // Group ERC20 transfers
  tokenTransfers.forEach(transfer => {
    if (!transfersByHash.has(transfer.hash)) {
      transfersByHash.set(transfer.hash, { erc20: [], nft: [], erc1155: [] });
    }
    transfersByHash.get(transfer.hash)!.erc20.push(transfer);
  });

  // Group NFT transfers
  nftTransfers.forEach(transfer => {
    if (!transfersByHash.has(transfer.hash)) {
      transfersByHash.set(transfer.hash, { erc20: [], nft: [], erc1155: [] });
    }
    transfersByHash.get(transfer.hash)!.nft.push(transfer);
  });

  // Group ERC1155 transfers
  erc1155Transfers.forEach(transfer => {
    if (!transfersByHash.has(transfer.hash)) {
      transfersByHash.set(transfer.hash, { erc20: [], nft: [], erc1155: [] });
    }
    transfersByHash.get(transfer.hash)!.erc1155.push(transfer);
  });

  // Convert regular transactions
  regularTransactions.forEach(tx => {
    const transfers = transfersByHash.get(tx.hash);
    chainTransactions.push(convertRegularTransaction(tx, transfers));
    processedHashes.add(tx.hash);
  });

  // Convert internal transactions (these might not have matching regular transactions)
  internalTransactions.forEach(tx => {
    if (!processedHashes.has(tx.hash)) {
      chainTransactions.push(convertInternalTransaction(tx));
      processedHashes.add(tx.hash);
    }
  });

  // Add orphaned transfers (transfers without matching regular transactions)
  transfersByHash.forEach((transfers, hash) => {
    if (!processedHashes.has(hash)) {
      // Find a representative transfer to get timestamp/block info
      const representative = transfers.erc20[0] || transfers.nft[0] || transfers.erc1155[0];
      if (representative) {
        chainTransactions.push(convertTransferToChainTransaction(hash, representative, transfers));
      }
    }
  });

  return chainTransactions;
}

/**
 * Convert regular Etherscan transaction to ChainTransaction
 */
function convertRegularTransaction(
  tx: EtherscanTransaction,
  transfers?: TransferGroup
): ChainTransaction {
  const fee = (BigInt(tx.gasUsed || 0) * BigInt(tx.gasPrice || 0)).toString();

  // Build token events from all transfer types
  const tokenEvents: TxEvent[] = [];
  
  if (transfers) {
    // ERC20 transfers
    transfers.erc20.forEach((transfer, idx) => {
      const metadata = getTokenMetadata(
        transfer.contractAddress,
        transfer.tokenSymbol,
        transfer.tokenName,
        transfer.tokenDecimal
      );

      tokenEvents.push({
        type: "token_transfer",
        attributes: [
          { key: "sender_address", value: transfer.contractAddress },
          { key: "token_symbol", value: metadata.symbol },
          { key: "token_name", value: metadata.name },
          { key: "decimals", value: String(metadata.decimals) },
          { key: "value", value: transfer.value },
          { key: "from", value: transfer.from },
          { key: "to", value: transfer.to },
          { key: "token_type", value: "ERC20" },
        ],
      });
    });

    // NFT transfers
    transfers.nft.forEach((transfer, idx) => {
      const metadata = getTokenMetadata(
        transfer.contractAddress,
        transfer.tokenSymbol,
        transfer.tokenName,
        "0"
      );

      tokenEvents.push({
        type: "nft_transfer",
        attributes: [
          { key: "sender_address", value: transfer.contractAddress },
          { key: "token_symbol", value: metadata.symbol },
          { key: "token_name", value: metadata.name },
          { key: "token_id", value: transfer.tokenID },
          { key: "from", value: transfer.from },
          { key: "to", value: transfer.to },
          { key: "token_type", value: "ERC721" },
        ],
      });
    });

    // ERC1155 transfers
    transfers.erc1155.forEach((transfer, idx) => {
      const metadata = getTokenMetadata(
        transfer.contractAddress,
        transfer.tokenSymbol,
        transfer.tokenName,
        transfer.tokenDecimal
      );

      tokenEvents.push({
        type: "erc1155_transfer",
        attributes: [
          { key: "sender_address", value: transfer.contractAddress },
          { key: "token_symbol", value: metadata.symbol },
          { key: "token_name", value: metadata.name },
          { key: "decimals", value: String(metadata.decimals) },
          { key: "value", value: transfer.tokenValue },
          { key: "token_id", value: transfer.tokenID },
          { key: "from", value: transfer.from },
          { key: "to", value: transfer.to },
          { key: "token_type", value: "ERC1155" },
        ],
      });
    });
  }

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
 * Convert internal transaction to ChainTransaction
 */
function convertInternalTransaction(tx: EtherscanInternalTransaction): ChainTransaction {
  return {
    hash: tx.hash,
    height: tx.blockNumber,
    timestamp: new Date(parseInt(tx.timeStamp) * 1000).toISOString(),
    code: tx.isError === "1" ? 1 : 0,
    chain: CHAIN_ID,
    logs: [{
      msg_index: 0,
      log: "Internal transaction",
      events: [{
        type: "internal_transaction",
        attributes: [
          { key: "type", value: tx.type || "call" },
          { key: "trace_id", value: tx.traceId || "0" },
          { key: "contract_address", value: tx.contractAddress || "" },
          { key: "err_code", value: tx.errCode || "" },
        ],
      }],
    }],
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
        memo: `Internal transaction: ${tx.type || "call"}`,
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
 * Convert orphaned transfers to ChainTransaction
 */
function convertTransferToChainTransaction(
  hash: string,
  representative: EtherscanTokenTransfer | EtherscanNFTTransfer | EtherscanERC1155Transfer,
  transfers: TransferGroup
): ChainTransaction {
  const tokenEvents: TxEvent[] = [];

  // ERC20 transfers
  transfers.erc20.forEach(transfer => {
    const metadata = getTokenMetadata(
      transfer.contractAddress,
      transfer.tokenSymbol,
      transfer.tokenName,
      transfer.tokenDecimal
    );

    tokenEvents.push({
      type: "token_transfer",
      attributes: [
        { key: "sender_address", value: transfer.contractAddress },
        { key: "token_symbol", value: metadata.symbol },
        { key: "token_name", value: metadata.name },
        { key: "decimals", value: String(metadata.decimals) },
        { key: "value", value: transfer.value },
        { key: "from", value: transfer.from },
        { key: "to", value: transfer.to },
        { key: "token_type", value: "ERC20" },
      ],
    });
  });

  // NFT transfers
  transfers.nft.forEach(transfer => {
    const metadata = getTokenMetadata(
      transfer.contractAddress,
      transfer.tokenSymbol,
      transfer.tokenName,
      "0"
    );

    tokenEvents.push({
      type: "nft_transfer",
      attributes: [
        { key: "sender_address", value: transfer.contractAddress },
        { key: "token_symbol", value: metadata.symbol },
        { key: "token_name", value: metadata.name },
        { key: "token_id", value: transfer.tokenID },
        { key: "from", value: transfer.from },
        { key: "to", value: transfer.to },
        { key: "token_type", value: "ERC721" },
      ],
    });
  });

  // ERC1155 transfers
  transfers.erc1155.forEach(transfer => {
    const metadata = getTokenMetadata(
      transfer.contractAddress,
      transfer.tokenSymbol,
      transfer.tokenName,
      transfer.tokenDecimal
    );

    tokenEvents.push({
      type: "erc1155_transfer",
      attributes: [
        { key: "sender_address", value: transfer.contractAddress },
        { key: "token_symbol", value: metadata.symbol },
        { key: "token_name", value: metadata.name },
        { key: "decimals", value: String(metadata.decimals) },
        { key: "value", value: transfer.tokenValue },
        { key: "token_id", value: transfer.tokenID },
        { key: "from", value: transfer.from },
        { key: "to", value: transfer.to },
        { key: "token_type", value: "ERC1155" },
      ],
    });
  });

  // Get from/to from first available transfer
  const firstTransfer = transfers.erc20[0] || transfers.nft[0] || transfers.erc1155[0];

  return {
    hash,
    height: (representative as any).blockNumber || "0",
    timestamp: new Date(parseInt((representative as any).timeStamp) * 1000).toISOString(),
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
            from_address: firstTransfer?.from || "",
            to_address: firstTransfer?.to || "",
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
  const tokenTransfers: Array<{ symbol: string; amount: string; from: string; to: string; tokenType: string }> = [];

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
            if ((event.type === "token_transfer" || event.type === "nft_transfer" || event.type === "erc1155_transfer") && event.attributes) {
              const attrs: Record<string, string> = {};
              for (const attr of event.attributes) {
                attrs[attr.key] = attr.value;
              }

              const tokenSymbol = attrs["token_symbol"] || "";
              const decimals = parseInt(attrs["decimals"] || "0");
              const value = attrs["value"] || "0";
              const tokenId = attrs["token_id"];
              const tokenType = attrs["token_type"] || "ERC20";
              const fromAddr = attrs["from"] || "";
              const toAddr = attrs["to"] || "";

              // Calculate token amount
              let formattedAmount: string;
              if (tokenType === "ERC721") {
                // NFTs don't have decimals
                formattedAmount = tokenId ? `1 (ID: ${tokenId})` : "1";
              } else {
                const tokenAmount = parseFloat(value) / Math.pow(10, decimals || 18);
                formattedAmount = tokenAmount.toFixed(6);
              }

              tokenTransfers.push({
                symbol: tokenSymbol,
                amount: formattedAmount,
                from: fromAddr,
                to: toAddr,
                tokenType,
              });

              // Update transaction type based on token transfers
              const tokenIsOutgoing = fromAddr.toLowerCase() === walletLower;
              const tokenIsIncoming = toAddr.toLowerCase() === walletLower;

              if (tokenTransfers.length === 1) {
                if (!amount || amount === "" || amount === "0") {
                  amount = formattedAmount;
                  currency = tokenSymbol;
                  from = fromAddr;
                  to = toAddr;
                  type = tokenIsOutgoing ? "send" : tokenIsIncoming ? "receive" : "unknown";
                } else if (!amount2) {
                  amount2 = formattedAmount;
                  currency2 = tokenSymbol;
                }
              } else if (tokenTransfers.length === 2 && amount2 === "") {
                amount2 = formattedAmount;
                currency2 = tokenSymbol;
                
                const firstTransfer = tokenTransfers[0];
                const firstIsOutgoing = firstTransfer.from.toLowerCase() === walletLower;
                const secondIsIncoming = tokenIsIncoming;
                
                if ((firstIsOutgoing && secondIsIncoming) || (tokenIsOutgoing && firstTransfer.to.toLowerCase() === walletLower)) {
                  type = "swap";
                }
              }
            }
          }
        }
      }
    }

    // Check if this is an internal transaction
    if (tx.tx?.body?.memo?.includes("Internal transaction")) {
      if (type === "unknown") {
        type = isOutgoing ? "send" : isIncoming ? "receive" : "unknown";
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
    const transferSummary = tokenTransfers.map(t => {
      if (t.tokenType === "ERC721") {
        return `${t.symbol} ${t.amount}`;
      }
      return `${t.amount} ${t.symbol}`;
    }).join(", ");
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

interface EtherscanInternalTransaction {
  blockNumber: string;
  timeStamp: string;
  hash: string;
  from: string;
  to: string;
  value: string;
  contractAddress: string;
  input: string;
  type: string;
  gas: string;
  gasUsed: string;
  traceId: string;
  isError: string;
  errCode: string;
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

interface EtherscanNFTTransfer {
  blockNumber: string;
  timeStamp: string;
  hash: string;
  nonce: string;
  blockHash: string;
  from: string;
  contractAddress: string;
  to: string;
  tokenID: string;
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

interface EtherscanERC1155Transfer {
  blockNumber: string;
  timeStamp: string;
  hash: string;
  nonce: string;
  blockHash: string;
  from: string;
  contractAddress: string;
  to: string;
  tokenID: string;
  tokenValue: string;
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

interface TransferGroup {
  erc20: EtherscanTokenTransfer[];
  nft: EtherscanNFTTransfer[];
  erc1155: EtherscanERC1155Transfer[];
}

interface TxEvent {
  type: string;
  attributes: { key: string; value: string }[];
}
