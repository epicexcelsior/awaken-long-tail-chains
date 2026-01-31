import {
  ChainTransaction,
  ParsedTransaction,
  TransactionType,
  ChainId,
} from "../types";

const CHAIN_ID: ChainId = "tezos";
const BASE_URL = "https://api.tzkt.io/v1";

// Known Tezos token contract to symbol mapping
const TEZOS_TOKEN_MAP: Record<string, { symbol: string; decimals: number; name: string }> = {
  // Add known tokens here as we discover them
  // Format: "KT1...": { symbol: "SYMBOL", decimals: 6, name: "Token Name" }
  "KT1VQuYs6vH2t1p9TRB3A2EPLFAeQ2iWYu1C": { symbol: "UT1", decimals: 0, name: "U_T_1" },
  "KT1PWx2mnDueood7fEmfbBDKx1D9BAnnXitn": { symbol: "tzBTC", decimals: 8, name: "tzBTC" },
  "KT1LN4LPSqTMS7Sd2CJw4bbDGRkMv2t68Fy9": { symbol: "USDtz", decimals: 6, name: "USDtez" },
  "KT1EctCuorV2NfVb1XTQgvzJ88MQtWP8cMMv": { symbol: "STKR", decimals: 0, name: "StakerDAO" },
  // Add more known tokens as needed
};

// Cache for token metadata to ensure consistent symbol usage
const tokenMetadataCache: Map<string, { symbol: string; decimals: number; name: string }> = new Map();

// Rate limiting: TzKT API is free but let's be respectful
const DELAY_MS = 200;
const PAGE_SIZE = 1000;
const MAX_PAGES = 50;

/**
 * Fetch ALL transactions for Tezos address using TzKT API
 * Comprehensive fetch including:
 * 1. Native XTZ transactions (sent)
 * 2. Native XTZ transactions (received)
 * 3. Token transfers (FA1.2 and FA2)
 */
export async function fetchAllTransactionsClientSide(
  address: string,
  onProgress?: (count: number, page: number) => void,
): Promise<{ transactions: ChainTransaction[]; metadata: any }> {
  console.log(`[Tezos] Starting comprehensive fetch for ${address}`);

  let totalCount = 0;
  const reportProgress = (count: number, page: number) => {
    totalCount += count;
    if (onProgress) {
      onProgress(totalCount, page);
    }
  };

  // Fetch native XTZ transactions (sent and received separately for complete coverage)
  const outgoingTransactions = await fetchOutgoingTransactions(address, reportProgress);
  await new Promise(resolve => setTimeout(resolve, DELAY_MS));
  
  const incomingTransactions = await fetchIncomingTransactions(address, reportProgress);
  await new Promise(resolve => setTimeout(resolve, DELAY_MS));
  
  // Fetch token transfers
  const tokenTransfers = await fetchTokenTransfers(address, reportProgress);

  // Merge all transactions and filter out any with invalid data
  const allTransactions: ChainTransaction[] = [
    ...outgoingTransactions,
    ...incomingTransactions,
    ...tokenTransfers,
  ].filter(tx => tx && tx.timestamp && tx.hash); // Filter out null/invalid transactions

  // Sort by timestamp (newest first) with error handling
  allTransactions.sort((a, b) => {
    try {
      const dateA = new Date(a.timestamp).getTime();
      const dateB = new Date(b.timestamp).getTime();
      if (isNaN(dateA) || isNaN(dateB)) return 0;
      return dateB - dateA;
    } catch (e) {
      return 0;
    }
  });

  // Safely parse dates with error handling
  const dates = allTransactions
    .map((tx) => {
      try {
        const d = new Date(tx.timestamp);
        return isNaN(d.getTime()) ? null : d;
      } catch (e) {
        return null;
      }
    })
    .filter((d): d is Date => d !== null);
  
  const firstDate = dates.length > 0 ? new Date(Math.min(...dates.map((d) => d.getTime()))) : null;
  const lastDate = dates.length > 0 ? new Date(Math.max(...dates.map((d) => d.getTime()))) : null;

  console.log(`[Tezos] FINAL: ${allTransactions.length} unique transactions`);
  console.log(`[Tezos] - Outgoing XTZ: ${outgoingTransactions.length}`);
  console.log(`[Tezos] - Incoming XTZ: ${incomingTransactions.length}`);
  console.log(`[Tezos] - Token transfers: ${tokenTransfers.length}`);

  return {
    transactions: allTransactions,
    metadata: {
      address,
      chain: CHAIN_ID,
      totalFetched: allTransactions.length,
      outgoingCount: outgoingTransactions.length,
      incomingCount: incomingTransactions.length,
      tokenTransferCount: tokenTransfers.length,
      firstTransactionDate: firstDate?.toISOString(),
      lastTransactionDate: lastDate?.toISOString(),
      dataSource: "TzKT API",
    },
  };
}

/**
 * Fetch outgoing native XTZ transactions
 */
async function fetchOutgoingTransactions(
  address: string,
  onProgress?: (count: number, page: number) => void
): Promise<ChainTransaction[]> {
  const allTransactions: ChainTransaction[] = [];
  let offset = 0;
  let hasMore = true;
  let page = 0;

  while (hasMore && page < MAX_PAGES) {
    try {
      const url = `${BASE_URL}/operations/transactions?sender=${address}&limit=${PAGE_SIZE}&offset=${offset}&quote=usd`;
      console.log(`[Tezos] Fetching outgoing page ${page} (offset: ${offset})...`);

      const response = await fetch(url);
      if (!response.ok) {
        console.error(`[Tezos] Outgoing page ${page} HTTP ${response.status}`);
        break;
      }

      const data = await response.json();
      if (!Array.isArray(data) || data.length === 0) {
        hasMore = false;
        break;
      }

      for (const item of data) {
        const converted = convertNativeTransaction(item, address, "outgoing");
        if (converted) {
          allTransactions.push(converted);
        }
      }

      if (onProgress) {
        onProgress(allTransactions.length, page);
      }

      console.log(`[Tezos] Outgoing page ${page}: +${data.length} | Total: ${allTransactions.length}`);

      hasMore = data.length === PAGE_SIZE;
      offset += data.length;
      page++;

      if (hasMore) {
        await new Promise(resolve => setTimeout(resolve, DELAY_MS));
      }
    } catch (error) {
      console.error(`[Tezos] Outgoing page ${page} exception:`, error);
      break;
    }
  }

  return allTransactions;
}

/**
 * Fetch incoming native XTZ transactions
 */
async function fetchIncomingTransactions(
  address: string,
  onProgress?: (count: number, page: number) => void
): Promise<ChainTransaction[]> {
  const allTransactions: ChainTransaction[] = [];
  let offset = 0;
  let hasMore = true;
  let page = 0;

  while (hasMore && page < MAX_PAGES) {
    try {
      const url = `${BASE_URL}/operations/transactions?target=${address}&limit=${PAGE_SIZE}&offset=${offset}&quote=usd`;
      console.log(`[Tezos] Fetching incoming page ${page} (offset: ${offset})...`);

      const response = await fetch(url);
      if (!response.ok) {
        console.error(`[Tezos] Incoming page ${page} HTTP ${response.status}`);
        break;
      }

      const data = await response.json();
      if (!Array.isArray(data) || data.length === 0) {
        hasMore = false;
        break;
      }

      for (const item of data) {
        const converted = convertNativeTransaction(item, address, "incoming");
        if (converted) {
          allTransactions.push(converted);
        }
      }

      if (onProgress) {
        onProgress(allTransactions.length, page);
      }

      console.log(`[Tezos] Incoming page ${page}: +${data.length} | Total: ${allTransactions.length}`);

      hasMore = data.length === PAGE_SIZE;
      offset += data.length;
      page++;

      if (hasMore) {
        await new Promise(resolve => setTimeout(resolve, DELAY_MS));
      }
    } catch (error) {
      console.error(`[Tezos] Incoming page ${page} exception:`, error);
      break;
    }
  }

  return allTransactions;
}

/**
 * Fetch token transfers (FA1.2 and FA2)
 */
async function fetchTokenTransfers(
  address: string,
  onProgress?: (count: number, page: number) => void
): Promise<ChainTransaction[]> {
  const allTransfers: ChainTransaction[] = [];
  let offset = 0;
  let hasMore = true;
  let page = 0;

  while (hasMore && page < MAX_PAGES) {
    try {
      const url = `${BASE_URL}/tokens/transfers?anyof.from.to=${address}&limit=${PAGE_SIZE}&offset=${offset}&quote=usd`;
      console.log(`[Tezos] Fetching token transfers page ${page} (offset: ${offset})...`);

      const response = await fetch(url);
      if (!response.ok) {
        console.error(`[Tezos] Token page ${page} HTTP ${response.status}`);
        break;
      }

      const data = await response.json();
      if (!Array.isArray(data) || data.length === 0) {
        hasMore = false;
        break;
      }

      for (const item of data) {
        const converted = convertTokenTransfer(item, address);
        if (converted) {
          allTransfers.push(converted);
        }
      }

      if (onProgress) {
        onProgress(allTransfers.length, page);
      }

      console.log(`[Tezos] Token page ${page}: +${data.length} | Total: ${allTransfers.length}`);

      hasMore = data.length === PAGE_SIZE;
      offset += data.length;
      page++;

      if (hasMore) {
        await new Promise(resolve => setTimeout(resolve, DELAY_MS));
      }
    } catch (error) {
      console.error(`[Tezos] Token page ${page} exception:`, error);
      break;
    }
  }

  return allTransfers;
}

/**
 * Convert native XTZ transaction to ChainTransaction
 */
function convertNativeTransaction(
  item: any,
  walletAddress: string,
  direction: "outgoing" | "incoming"
): ChainTransaction | null {
  try {
    if (!item.hash) return null;

    // Calculate total fee in micro-tez
    const bakerFee = item.bakerFee || 0;
    const storageFee = item.storageFee || 0;
    const allocationFee = item.allocationFee || 0;
    const totalFee = bakerFee + storageFee + allocationFee;

    const from = direction === "outgoing" 
      ? walletAddress 
      : item.sender?.address || "";
    const to = direction === "incoming"
      ? walletAddress
      : item.target?.address || "";

    // Capture USD quote if available
    const usdQuote = item.quote?.usd;
    const logs: any[] = [];
    
    if (usdQuote) {
      logs.push({
        msg_index: 0,
        log: "Price quote",
        events: [{
          type: "quote",
          attributes: [
            { key: "usd_price", value: String(usdQuote) },
          ],
        }],
      });
    }

    return {
      hash: item.hash,
      height: String(item.level || 0),
      timestamp: item.timestamp || new Date().toISOString(),
      code: item.status === "applied" ? 0 : 1,
      chain: CHAIN_ID,
      logs: logs.length > 0 ? logs : undefined,
      tx: {
        body: {
          messages: [
            {
              "@type": "/cosmos.bank.v1beta1.MsgSend",
              from_address: from,
              to_address: to,
              amount: [
                {
                  amount: String(item.amount || 0),
                  denom: "microtez",
                },
              ],
            },
          ],
          memo: direction === "outgoing" ? "Send XTZ" : "Receive XTZ",
        },
        auth_info: {
          fee: {
            amount: [
              {
                amount: String(totalFee),
                denom: "microtez",
              },
            ],
          },
        },
      },
    };
  } catch (error) {
    console.error(`[Tezos] Error converting native transaction:`, error);
    return null;
  }
}

/**
 * Convert token transfer to ChainTransaction
 */
function convertTokenTransfer(item: any, walletAddress: string): ChainTransaction | null {
  try {
    if (!item.id) return null;

    const contractAddress = item.token?.contract?.address || "";
    const metadata = getTokenMetadata(
      contractAddress,
      item.token?.metadata?.symbol,
      item.token?.metadata?.name,
      item.token?.metadata?.decimals
    );

    const from = item.from?.address || "";
    const to = item.to?.address || "";
    const isOutgoing = from.toLowerCase() === walletAddress.toLowerCase();

    return {
      hash: String(item.id), // Use transfer ID as identifier
      height: String(item.level || 0),
      timestamp: item.timestamp || new Date().toISOString(),
      code: 0,
      chain: CHAIN_ID,
      logs: [{
        msg_index: 0,
        log: "Token transfer",
        events: [{
          type: "token_transfer",
          attributes: [
            { key: "sender_address", value: contractAddress },
            { key: "token_symbol", value: metadata.symbol },
            { key: "token_name", value: metadata.name },
            { key: "decimals", value: String(metadata.decimals) },
            { key: "value", value: item.amount || "0" },
            { key: "from", value: from },
            { key: "to", value: to },
            { key: "token_type", value: item.token?.standard || "fa2" },
          ],
        }],
      }],
      tx: {
        body: {
          messages: [
            {
              "@type": "/cosmos.bank.v1beta1.MsgSend",
              from_address: from,
              to_address: to,
              amount: [
                {
                  amount: item.amount || "0",
                  denom: metadata.symbol,
                },
              ],
            },
          ],
          memo: `${isOutgoing ? "Send" : "Receive"} ${metadata.symbol}`,
        },
        auth_info: {
          fee: {
            amount: [],
          },
        },
      },
    };
  } catch (error) {
    console.error(`[Tezos] Error converting token transfer:`, error);
    return null;
  }
}

/**
 * Get token metadata with caching
 */
function getTokenMetadata(
  contractAddress: string,
  apiSymbol: string | null | undefined,
  apiName: string | null | undefined,
  apiDecimals: string | null | undefined
): { symbol: string; decimals: number; name: string } {
  const address = contractAddress?.toLowerCase() || "";
  
  // Check cache first
  if (tokenMetadataCache.has(address)) {
    return tokenMetadataCache.get(address)!;
  }
  
  // Check hardcoded mapping
  if (TEZOS_TOKEN_MAP[contractAddress]) {
    const metadata = TEZOS_TOKEN_MAP[contractAddress];
    tokenMetadataCache.set(address, metadata);
    return metadata;
  }
  
  // Use API data
  const symbol = apiSymbol && apiSymbol.length > 0 
    ? apiSymbol 
    : address.slice(0, 10);
  
  const decimals = apiDecimals ? parseInt(apiDecimals) : 0;
  const name = apiName || symbol;
  
  const metadata = { symbol, decimals, name };
  tokenMetadataCache.set(address, metadata);
  return metadata;
}

export function isValidTezosAddress(address: string): boolean {
  // Tezos implicit addresses start with tz1, tz2, or tz3
  // Format: tz1 + 33 base58 characters (total 36 chars)
  return /^(tz1|tz2|tz3)[1-9A-Za-z]{33}$/.test(address);
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
  let currency = "XTZ";
  let amount2 = "";
  let currency2 = "";
  let fee = "";
  let feeCurrency = "XTZ";
  let fiatAmount = "";
  let fiatCurrency = "USD";
  let memo = "";
  
  // Extract USD quote from logs if available
  let usdQuote: number | null = null;
  if (tx.logs && tx.logs.length > 0) {
    for (const log of tx.logs) {
      if (log.events && Array.isArray(log.events)) {
        for (const event of log.events) {
          if (event.type === "quote" && event.attributes) {
            for (const attr of event.attributes) {
              if (attr.key === "usd_price") {
                usdQuote = parseFloat(attr.value);
              }
            }
          }
        }
      }
    }
  }

  if (message) {
    from = message.from_address || "";
    to = message.to_address || "";
    const fromLower = from.toLowerCase();
    const toLower = to.toLowerCase();

    // Determine transaction type
    const isOutgoing = fromLower === walletLower;
    const isIncoming = toLower === walletLower;

    if (isIncoming && !isOutgoing) {
      type = "receive";
    } else if (isOutgoing && !isIncoming) {
      type = "send";
    } else if (isOutgoing && isIncoming) {
      type = "send";
    } else {
      type = "receive";
    }

    // Handle native XTZ transfer
    if (message.amount && Array.isArray(message.amount) && message.amount.length > 0) {
      const rawAmount = message.amount[0].amount;
      const denom = message.amount[0].denom;
      
      if (rawAmount && rawAmount !== "0") {
        if (denom === "microtez") {
          // Convert from micro-tez (10^6) to XTZ
          const num = parseFloat(rawAmount) / 1e6;
          amount = num.toFixed(6);
          
          // Calculate fiat amount if we have a USD quote
          if (usdQuote && num > 0) {
            const fiatValue = num * usdQuote;
            fiatAmount = fiatValue.toFixed(2);
          }
        } else {
          // Token transfer - use decimals from metadata
          amount = rawAmount;
          currency = denom;
          // Token transfers don't have USD quotes from TzKT
          fiatAmount = "";
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

              const tokenSymbol = attrs["token_symbol"] || "UNKNOWN";
              const decimals = parseInt(attrs["decimals"] || "0");
              const value = attrs["value"] || "0";
              const fromAddr = attrs["from"] || "";
              const toAddr = attrs["to"] || "";

              // Calculate token amount
              const tokenAmount = parseFloat(value) / Math.pow(10, decimals);
              const formattedAmount = decimals === 0 
                ? tokenAmount.toFixed(0) 
                : tokenAmount.toFixed(6);

              // Update currency and amount
              if (!amount || amount === "" || amount === "0") {
                amount = formattedAmount;
                currency = tokenSymbol;
                from = fromAddr;
                to = toAddr;
                
                const tokenIsOutgoing = fromAddr.toLowerCase() === walletLower;
                type = tokenIsOutgoing ? "send" : "receive";
              } else if (!amount2) {
                amount2 = formattedAmount;
                currency2 = tokenSymbol;
              }
            }
          }
        }
      }
    }
  }

  // Extract fee (convert from micro-tez to XTZ)
  const feeAmount = tx.tx?.auth_info?.fee?.amount?.[0];
  if (feeAmount && feeAmount.amount && feeAmount.amount !== "0") {
    const feeNum = parseFloat(feeAmount.amount) / 1e6;
    fee = feeNum.toFixed(8);
  }

  // Build comprehensive notes for cost basis tracking
  let notes = type;
  
  // Add full transaction hash
  notes += ` - [TX: ${tx.hash}]`;
  
  // Add from/to addresses
  if (from && to) {
    const shortFrom = from.slice(0, 8);
    const shortTo = to.slice(0, 8);
    notes += ` (${shortFrom}... -> ${shortTo}...)`;
  }
  
  // Add memo if present
  if (tx.tx?.body?.memo && tx.tx.body.memo.length > 0) {
    notes += ` (${tx.tx.body.memo})`;
  }

  // Safely parse timestamp
  let parsedTimestamp: Date;
  try {
    parsedTimestamp = new Date(tx.timestamp);
    if (isNaN(parsedTimestamp.getTime())) {
      parsedTimestamp = new Date();
    }
  } catch (e) {
    parsedTimestamp = new Date();
  }

  return {
    hash: tx.hash,
    timestamp: parsedTimestamp,
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
    fiatAmount,
    fiatCurrency,
    memo: notes,
    status: tx.code === 0 ? "success" : "failed",
    chain: CHAIN_ID,
  };
}
