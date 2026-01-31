import {
  ChainTransaction,
  ParsedTransaction,
  TransactionType,
  ChainId,
} from "../types";

const CHAIN_ID: ChainId = "ronin";
const COVALENT_CHAIN_ID = "2020"; // Ronin mainnet chain ID
const API_KEY = "cqt_rQX6pj3BJWcjjPWd7pWwgTDvk8PQ";

// Common Ronin token address to symbol mapping for better cost basis matching
const RONIN_TOKEN_MAP: Record<string, string> = {
  // Add known tokens here if needed
  // Format: "0x...": "SYMBOL"
};

// Cache for token metadata to ensure consistent symbol usage
const tokenMetadataCache: Map<string, { symbol: string; decimals: number; name: string }> = new Map();

/**
 * Fetch ALL transactions from Ronin using GoldRush REST API
 * Comprehensive pagination to ensure we get complete history
 */
export async function fetchAllTransactionsClientSide(
  address: string,
  onProgress?: (count: number, page: number) => void,
): Promise<{ transactions: ChainTransaction[]; metadata: any }> {
  console.log(`[Ronin] Starting comprehensive fetch for ${address}`);

  const transactions = await fetchWithREST(address, onProgress);

  // Sort by timestamp (newest first)
  transactions.sort(
    (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime(),
  );

  const dates = transactions.map((tx) => new Date(tx.timestamp));
  const firstDate =
    dates.length > 0
      ? new Date(Math.min(...dates.map((d) => d.getTime())))
      : null;
  const lastDate =
    dates.length > 0
      ? new Date(Math.max(...dates.map((d) => d.getTime())))
      : null;

  console.log(`[Ronin] FINAL: ${transactions.length} unique transactions`);

  return {
    transactions,
    metadata: {
      address,
      chain: CHAIN_ID,
      totalFetched: transactions.length,
      firstTransactionDate: firstDate?.toISOString(),
      lastTransactionDate: lastDate?.toISOString(),
      dataSource: "GoldRush REST API",
      chainId: COVALENT_CHAIN_ID,
    },
  };
}

/**
 * Fetch transactions using GoldRush REST API
 */
async function fetchWithREST(
  address: string,
  onProgress?: (count: number, page: number) => void,
): Promise<ChainTransaction[]> {
  const allTransactions: ChainTransaction[] = [];
  const BASE_URL = `https://api.covalenthq.com/v1/${COVALENT_CHAIN_ID}/address/${address}/transactions_v3/page`;

  let page = 0;
  let hasMore = true;
  const maxPages = 50;

  while (hasMore && page < maxPages) {
    try {
      const url = `${BASE_URL}/${page}/?quote-currency=USD`;

      console.log(`[Ronin REST] Fetching page ${page}...`);

      const response = await fetch(url, {
        headers: {
          Authorization: `Bearer ${API_KEY}`,
          Accept: "application/json",
        },
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`[Ronin REST] Page ${page} HTTP ${response.status}:`, errorText);
        break;
      }

      const data = await response.json();

      if (data.error) {
        console.error(`[Ronin REST] Page ${page} API error:`, data.error);
        break;
      }

      const items = data.data?.items || [];

      if (items.length === 0) {
        hasMore = false;
        break;
      }

      // Convert REST response to ChainTransaction format
      for (const item of items) {
        const converted = convertRESTTransaction(item);
        if (converted) {
          allTransactions.push(converted);
        }
      }

      if (onProgress) {
        onProgress(allTransactions.length, page);
      }

      console.log(`[Ronin REST] Page ${page}: +${items.length} | Total: ${allTransactions.length}`);

      hasMore = items.length === 100;
      page++;

      // Rate limiting
      if (hasMore) {
        await new Promise((resolve) => setTimeout(resolve, 200));
      }
    } catch (error) {
      console.error(`[Ronin REST] Page ${page} exception:`, error);
      break;
    }
  }

  return allTransactions;
}

/**
 * Convert REST API transaction item to ChainTransaction format
 */
function convertRESTTransaction(item: any): ChainTransaction | null {
  try {
    if (!item.tx_hash) return null;

    // Extract value and fee
    const value = item.value || "0";
    const gasSpent = item.gas_spent || "0";
    const gasPrice = item.gas_price || "0";
    const fee = (BigInt(gasSpent) * BigInt(gasPrice)).toString();

    // Build log events for token transfers - stored in logs instead of message
    const logEvents: any[] = [];
    if (item.log_events && Array.isArray(item.log_events)) {
      for (const event of item.log_events) {
        logEvents.push({
          sender_contract_decimals: event.sender_contract_decimals,
          sender_name: event.sender_name,
          sender_contract_ticker_symbol: event.sender_contract_ticker_symbol,
          sender_address: event.sender_address,
          decoded: event.decoded,
          sender_contract_label: event.sender_contract_label,
        });
      }
    }

    return {
      hash: item.tx_hash,
      height: String(item.block_height || 0),
      timestamp: item.block_signed_at || new Date().toISOString(),
      code: item.successful === false ? 1 : 0,
      chain: CHAIN_ID,
      logs: logEvents.length > 0 ? [{
        msg_index: 0,
        log: "Token transfers",
        events: logEvents.map((evt, idx) => ({
          type: "token_transfer",
          attributes: [
            { key: "sender_address", value: evt.sender_address || "" },
            { key: "token_symbol", value: evt.sender_contract_ticker_symbol || "" },
            { key: "token_name", value: evt.sender_name || evt.sender_contract_label || "" },
            { key: "decimals", value: String(evt.sender_contract_decimals || 18) },
            { key: "decoded", value: JSON.stringify(evt.decoded || {}) },
          ],
        })),
      }] : undefined,
      tx: {
        body: {
          messages: [
            {
              "@type": "/cosmos.bank.v1beta1.MsgSend",
              from_address: item.from_address,
              to_address: item.to_address,
              amount: [
                {
                  amount: value,
                  denom: "wei",
                },
              ],
            },
          ],
          memo: item.input && item.input !== "0x" ? `Input: ${item.input.slice(0, 20)}...` : "",
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
  } catch (error) {
    console.error(`[Ronin] Error converting REST transaction:`, error);
    return null;
  }
}

export function isValidRoninAddress(address: string): boolean {
  return /^0x[a-fA-F0-9]{40}$/.test(address);
}

/**
 * Get standardized token symbol from various sources
 * Ensures consistent token identification for cost basis matching
 */
function getTokenSymbol(senderAddress: string, tickerSymbol: string | null, tokenName: string | null): string {
  const address = senderAddress?.toLowerCase() || "";
  
  // Check cache first for consistency
  if (tokenMetadataCache.has(address)) {
    return tokenMetadataCache.get(address)!.symbol;
  }
  
  // Use provided ticker symbol if available and valid
  if (tickerSymbol && tickerSymbol.length > 0 && tickerSymbol !== "null" && tickerSymbol !== "undefined") {
    // Cache it for future consistency
    tokenMetadataCache.set(address, {
      symbol: tickerSymbol,
      decimals: 18,
      name: tokenName || tickerSymbol
    });
    return tickerSymbol;
  }
  
  // Check hardcoded mapping
  if (RONIN_TOKEN_MAP[address]) {
    return RONIN_TOKEN_MAP[address];
  }
  
  // Fall back to shortened address with 0x prefix for traceability
  // This ensures the same token always has the same identifier
  const shortAddr = address.slice(0, 10);
  return shortAddr;
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
  let currency = "RON";
  let amount2 = "";
  let currency2 = "";
  let fee = "";
  let feeCurrency = "RON";
  const tokenTransfers: Array<{ symbol: string; amount: string; from: string; to: string }> = [];

  if (message) {
    from = message.from_address || "";
    to = message.to_address || "";
    const fromLower = from.toLowerCase();
    const toLower = to.toLowerCase();

    // Determine transaction type based on wallet involvement
    const isOutgoing = fromLower === walletLower;
    const isIncoming = toLower === walletLower;

    if (isIncoming && !isOutgoing) {
      type = "receive";
    } else if (isOutgoing && !isIncoming) {
      type = "send";
    } else if (isOutgoing && isIncoming) {
      type = "send"; // Self-transfer
    } else {
      type = "receive"; // Default if wallet is involved somehow
    }

    // Handle native RON transfer
    if (message.amount && Array.isArray(message.amount) && message.amount.length > 0) {
      const rawAmount = message.amount[0].amount;
      if (rawAmount && rawAmount !== "0") {
        // Convert from wei (10^18) to RON
        const num = parseFloat(rawAmount) / 1e18;
        amount = num.toFixed(6);
      }
    }

    // Handle ALL token transfers from logs for complete history
    if (tx.logs && tx.logs.length > 0) {
      for (const log of tx.logs) {
        if (log.events && Array.isArray(log.events)) {
          for (const event of log.events) {
            if (event.type === "token_transfer" && event.attributes) {
              const attrs: Record<string, string> = {};
              for (const attr of event.attributes) {
                attrs[attr.key] = attr.value;
              }

              const senderAddress = attrs["sender_address"] || "";
              const tickerSymbol = attrs["token_symbol"] || null;
              const tokenName = attrs["token_name"] || null;
              const tokenSymbol = getTokenSymbol(senderAddress, tickerSymbol, tokenName);
              const decodedStr = attrs["decoded"] || "{}";
              let decoded: any = {};
              try {
                decoded = JSON.parse(decodedStr);
              } catch (e) {
                // Ignore parse error
              }

              // Extract transfer details from decoded data
              if (decoded && decoded.name === "Transfer" && decoded.params) {
                const valueParam = decoded.params.find((p: any) => p.name === "value");
                const fromParam = decoded.params.find((p: any) => p.name === "from")?.value;
                const toParam = decoded.params.find((p: any) => p.name === "to")?.value;
                
                if (valueParam && valueParam.value) {
                  const decimals = parseInt(attrs["decimals"] || "18", 10);
                  const tokenAmount = parseFloat(valueParam.value) / Math.pow(10, decimals);
                  
                  // Store for potential use as primary or secondary
                  tokenTransfers.push({
                    symbol: tokenSymbol,
                    amount: tokenAmount.toFixed(6),
                    from: fromParam || "",
                    to: toParam || ""
                  });

                  // If no native RON amount, use first token as primary
                  if (!amount || amount === "0") {
                    amount = tokenAmount.toFixed(6);
                    currency = tokenSymbol;
                    // Update from/to if token transfer has better info
                    if (fromParam) from = fromParam;
                    if (toParam) to = toParam;
                  } else if (!amount2) {
                    // Use as secondary if we already have native amount
                    amount2 = tokenAmount.toFixed(6);
                    currency2 = tokenSymbol;
                  }
                }
              }
            }
          }
        }
      }
    }
  }

  // Extract fee (convert from wei to RON)
  const feeAmount = tx.tx?.auth_info?.fee?.amount?.[0];
  if (feeAmount && feeAmount.amount && feeAmount.amount !== "0") {
    const feeNum = parseFloat(feeAmount.amount) / 1e18;
    fee = feeNum.toFixed(8);
  }

  // Build comprehensive notes for cost basis tracking
  let notes = `${type} - ${tx.hash}`;
  
  // Add token transfer details to notes if multiple transfers
  if (tokenTransfers.length > 0) {
    const transferSummary = tokenTransfers.map(t => `${t.amount} ${t.symbol}`).join(", ");
    notes += ` [Tokens: ${transferSummary}]`;
  }
  
  // Add memo if present and not empty
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
