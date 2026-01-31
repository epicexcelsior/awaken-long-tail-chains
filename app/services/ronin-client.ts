import {
  ChainTransaction,
  ParsedTransaction,
  TransactionType,
  ChainId,
} from "../types";

const CHAIN_ID: ChainId = "ronin";
const COVALENT_CHAIN_ID = "2020"; // Ronin mainnet chain ID
const API_KEY = "cqt_rQX6pj3BJWcjjPWd7pWwgTDvk8PQ";

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

export function parseTransaction(
  tx: ChainTransaction,
  walletAddress: string,
): ParsedTransaction {
  const messages = tx.tx?.body?.messages || [];
  const message = messages[0];

  let type: TransactionType = "unknown";
  let from = "";
  let to = "";
  let amount = "";
  let currency = "RON";
  let amount2 = "";
  let currency2 = "";
  let fee = "";
  let feeCurrency = "RON";

  if (message) {
    from = message.from_address || "";
    to = message.to_address || "";

    // Determine transaction type
    const isIncoming = from.toLowerCase() !== walletAddress.toLowerCase();
    const isOutgoing = to.toLowerCase() !== walletAddress.toLowerCase();

    if (isIncoming && !isOutgoing) {
      type = "receive";
    } else if (isOutgoing && !isIncoming) {
      type = "send";
    } else {
      type = "send"; // Default to send if both match or neither match
    }

    // Handle native token transfer
    if (message.amount && Array.isArray(message.amount) && message.amount.length > 0) {
      const rawAmount = message.amount[0].amount;
      if (rawAmount && rawAmount !== "0") {
        // Convert from wei (10^18) to RON
        const num = parseFloat(rawAmount) / 1e18;
        amount = num.toFixed(6);
      }
    }

    // Handle token transfers from logs (previously log_events)
    if (tx.logs && tx.logs.length > 0) {
      for (const log of tx.logs) {
        if (log.events && Array.isArray(log.events)) {
          for (const event of log.events) {
            if (event.type === "token_transfer" && event.attributes) {
              const attrs: Record<string, string> = {};
              for (const attr of event.attributes) {
                attrs[attr.key] = attr.value;
              }

              const tokenSymbol = attrs["token_symbol"] || attrs["sender_address"]?.slice(0, 8) || "TOKEN";
              const decodedStr = attrs["decoded"] || "{}";
              let decoded: any = {};
              try {
                decoded = JSON.parse(decodedStr);
              } catch (e) {
                // Ignore parse error
              }

              // Try to extract transfer value from decoded data
              if (decoded && decoded.name === "Transfer" && decoded.params) {
                const valueParam = decoded.params.find((p: any) => p.name === "value");
                if (valueParam && valueParam.value) {
                  const decimals = parseInt(attrs["decimals"] || "18", 10);
                  const tokenAmount = parseFloat(valueParam.value) / Math.pow(10, decimals);

                  // Determine if this is the primary or secondary asset
                  if (!amount2 && amount && amount !== "0") {
                    // Already have native amount, this is secondary
                    amount2 = tokenAmount.toFixed(6);
                    currency2 = tokenSymbol;
                  } else if (!amount || amount === "0") {
                    // No native amount yet, use this as primary
                    amount = tokenAmount.toFixed(6);
                    currency = tokenSymbol;
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
    memo: tx.tx?.body?.memo || "",
    status: tx.code === 0 ? "success" : "failed",
    chain: CHAIN_ID,
  };
}
