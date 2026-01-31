import {
  ChainTransaction,
  ParsedTransaction,
  TransactionType,
  ChainId,
} from "../types";

const CHAIN_ID: ChainId = "celestia";
const BASE_URL = "https://api-mainnet.celenium.io/v1";
const NATIVE_DECIMALS = 6;
const NATIVE_DENOM = "utia";

/**
 * Fetch ALL messages from Celestia using Celenium API
 * Uses /messages endpoint which provides full message data including amounts
 */
export async function fetchAllTransactionsClientSide(
  address: string,
  onProgress?: (count: number, page: number) => void,
): Promise<{ transactions: ChainTransaction[]; metadata: any }> {
  console.log(`[Celestia] Starting comprehensive fetch for ${address}`);

  const transactions = await fetchAllPages(address, onProgress);

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

  console.log(`[Celestia] FINAL: ${transactions.length} unique transactions`);

  return {
    transactions,
    metadata: {
      address,
      chain: CHAIN_ID,
      totalFetched: transactions.length,
      firstTransactionDate: firstDate?.toISOString(),
      lastTransactionDate: lastDate?.toISOString(),
      dataSource: "Celenium API (messages endpoint)",
    },
  };
}

/**
 * Fetch all pages from Celenium API messages endpoint with pagination
 */
async function fetchAllPages(
  address: string,
  onProgress?: (count: number, page: number) => void,
): Promise<ChainTransaction[]> {
  const allTransactions: ChainTransaction[] = [];
  let offset = 0;
  const limit = 100;
  let hasMore = true;
  const maxPages = 50;

  while (hasMore && offset / limit < maxPages) {
    try {
      const page = Math.floor(offset / limit);
      const url = `${BASE_URL}/address/${address}/messages?limit=${limit}&offset=${offset}`;

      console.log(`[Celestia] Fetching messages page ${page} (offset ${offset})...`);

      const response = await fetch(url, {
        headers: {
          Accept: "application/json",
        },
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`[Celestia] Page ${page} HTTP ${response.status}:`, errorText);
        if (response.status === 429) {
          console.log(`[Celestia] Rate limit hit, waiting before retry...`);
          await new Promise((resolve) => setTimeout(resolve, 2000));
          continue;
        }
        break;
      }

      const data = await response.json();

      if (!Array.isArray(data)) {
        console.error(`[Celestia] Unexpected response format:`, data);
        break;
      }

      if (data.length === 0) {
        hasMore = false;
        break;
      }

      for (const item of data) {
        const converted = convertMessageToTransaction(item);
        if (converted) {
          allTransactions.push(converted);
        }
      }

      if (onProgress) {
        onProgress(allTransactions.length, page);
      }

      console.log(`[Celestia] Page ${page}: +${data.length} | Total: ${allTransactions.length}`);

      hasMore = data.length === limit;
      offset += limit;

      // Rate limiting (200ms between requests)
      if (hasMore) {
        await new Promise((resolve) => setTimeout(resolve, 200));
      }
    } catch (error) {
      console.error(`[Celestia] Page ${Math.floor(offset / limit)} exception:`, error);
      break;
    }
  }

  return allTransactions;
}

/**
 * Convert Celenium API message to ChainTransaction format
 */
function convertMessageToTransaction(item: any): ChainTransaction | null {
  try {
    if (!item.tx?.hash) return null;

    // Extract data from message
    const data = item.data || {};
    const tx = item.tx || {};

    // Get from/to addresses
    const fromAddress = data.FromAddress || data.from_address || "";
    const toAddress = data.ToAddress || data.to_address || "";
    const sender = data.Sender || data.sender || "";
    const receiver = data.Receiver || data.receiver || "";

    // Get amount if available
    let amounts = [];
    if (data.Amount && Array.isArray(data.Amount)) {
      amounts = data.Amount;
    } else if (data.amount && Array.isArray(data.amount)) {
      amounts = data.amount;
    }

    // Determine message type
    const messageType = item.type || "MsgSend";

    return {
      hash: tx.hash,
      height: String(item.height || 0),
      timestamp: item.time || new Date().toISOString(),
      code: tx.status === "success" ? 0 : 1,
      chain: CHAIN_ID,
      logs: [
        {
          msg_index: item.position || 0,
          log: "Message data",
          events: [
            {
              type: messageType,
              attributes: [
                { key: "invocation_type", value: item.invocation_type || "" },
                { key: "from_address", value: fromAddress },
                { key: "to_address", value: toAddress },
                { key: "sender", value: sender },
                { key: "receiver", value: receiver },
                { key: "message_type", value: messageType },
                {
                  key: "amount_data",
                  value: JSON.stringify(amounts),
                },
              ],
            },
          ],
        },
      ],
      tx: {
        body: {
          messages: [
            {
              "@type": `/cosmos.bank.v1beta1.${messageType}`,
              from_address: fromAddress,
              to_address: toAddress,
              sender: sender,
              receiver: receiver,
              amount: amounts,
              delegator_address: data.DelegatorAddress || data.delegator_address || "",
              validator_address: data.ValidatorAddress || data.validator_address || "",
            },
          ],
          memo: tx.memo || item.memo || "",
        },
        auth_info: {
          fee: {
            amount: [
              {
                amount: tx.fee || "0",
                denom: NATIVE_DENOM,
              },
            ],
          },
        },
      },
    };
  } catch (error) {
    console.error(`[Celestia] Error converting message:`, error);
    return null;
  }
}

/**
 * Validate Celestia address format
 */
export function isValidCelestiaAddress(address: string): boolean {
  return /^celestia[a-z0-9]{39}$/i.test(address);
}

/**
 * Parse ChainTransaction to ParsedTransaction format
 */
export function parseTransaction(
  tx: ChainTransaction,
  walletAddress: string,
): ParsedTransaction {
  const messages = tx.tx?.body?.messages || [];
  const message = messages[0];
  const walletLower = walletAddress.toLowerCase();

  // Get invocation_type from logs to determine direction
  const invocationType = tx.logs?.[0]?.events?.[0]?.attributes?.find(
    (attr: any) => attr.key === "invocation_type",
  )?.value || "";

  let type: TransactionType = "unknown";
  let from = "";
  let to = "";
  let amount = "0";
  let currency = "TIA";
  let fee = "0";
  let feeCurrency = "TIA";

  if (message) {
    from = message.from_address || message.sender || "";
    to = message.to_address || message.receiver || "";
    const fromLower = from.toLowerCase();
    const toLower = to.toLowerCase();

    // Use invocation_type to determine direction
    if (invocationType === "fromAddress") {
      type = "send";
    } else if (invocationType === "toAddress") {
      type = "receive";
    } else if (invocationType === "sender") {
      type = "send";
    } else if (invocationType === "receiver") {
      type = "receive";
    } else if (invocationType === "delegator") {
      type = "delegate";
    } else if (invocationType === "validatorSrc") {
      type = "undelegate";
    } else if (invocationType === "validatorDst") {
      type = "receive";
    } else {
      // Fallback to address comparison
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
    }

    // Get message type
    const messageType = message["@type"] || "";
    if (messageType.includes("MsgDelegate")) {
      type = "delegate";
    } else if (messageType.includes("MsgUndelegate")) {
      type = "undelegate";
    } else if (messageType.includes("MsgWithdrawDelegatorReward")) {
      type = "claim_rewards";
    } else if (messageType.includes("MsgSend")) {
      // Keep determined by invocation_type
    }

    // Handle token amounts
    if (message.amount && Array.isArray(message.amount) && message.amount.length > 0) {
      const coin = message.amount[0];
      if (coin.amount && coin.amount !== "0") {
        // Convert from utia (10^6) to TIA
        const rawAmount = BigInt(coin.amount);
        const divisor = BigInt(10 ** NATIVE_DECIMALS);
        const whole = rawAmount / divisor;
        const remainder = rawAmount % divisor;
        const fraction = Number(remainder) / Math.pow(10, NATIVE_DECIMALS);
        amount = `${whole}.${fraction.toFixed(6).substring(2)}`;
      }
    }
  }

  // Extract fee (convert from utia to TIA)
  const feeAmount = tx.tx?.auth_info?.fee?.amount?.[0];
  if (feeAmount && feeAmount.amount && feeAmount.amount !== "0") {
    const rawFee = BigInt(feeAmount.amount);
    const divisor = BigInt(10 ** NATIVE_DECIMALS);
    const whole = rawFee / divisor;
    const remainder = rawFee % divisor;
    const fraction = Number(remainder) / Math.pow(10, NATIVE_DECIMALS);
    fee = `${whole}.${fraction.toFixed(8).substring(2)}`;
  }

  // Build comprehensive notes for cost basis tracking
  let notes = `${type}`;

  // Always include full transaction hash for matching
  notes += ` [TX: ${tx.hash}]`;

  // Add from/to addresses for better tracking
  if (from && to) {
    const shortFrom = from.slice(0, 8);
    const shortTo = to.slice(0, 8);
    notes += ` (${shortFrom}... -> ${shortTo}...)`;
  }

  // Add message types if available
  if (tx.logs && tx.logs.length > 0) {
    const messageTypes = tx.tx?.body?.messages?.map((m: any) => {
      const type = m["@type"] || "";
      return type.split(".").pop();
    }).filter(Boolean).join(", ");
    if (messageTypes) {
      notes += ` [Type: ${messageTypes}]`;
    }
  }

  // Add memo if present
  if (tx.tx?.body?.memo && tx.tx.body.memo.length > 0) {
    notes += ` Memo: ${tx.tx.body.memo}`;
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
    fee,
    feeCurrency,
    memo: notes,
    status: tx.code === 0 ? "success" : "failed",
    chain: CHAIN_ID,
  };
}
