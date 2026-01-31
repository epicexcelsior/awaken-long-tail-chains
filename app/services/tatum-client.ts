import {
  ChainTransaction,
  ParsedTransaction,
  TransactionType,
  ChainId,
} from "../types";
import { getApiKey } from "../utils/apiKeys";

const API_KEY = getApiKey("fantom") || "";

/**
 * Blockscout/Etherscan-style API client for EVM chains
 * This provides FULL indexed transaction history with proper pagination
 */

interface ExplorerConfig {
  baseUrl: string;
  name: string;
  nativeSymbol: string;
}

const EXPLORER_CONFIGS: Record<string, ExplorerConfig> = {
  celo: {
    baseUrl: "https://explorer.celo.org/mainnet/api",
    name: "Celo Explorer",
    nativeSymbol: "CELO",
  },
  fantom: {
    // Using Blockscout for Fantom Opera
    baseUrl: "https://explorer.fantom.network/api",
    name: "Fantom Explorer",
    nativeSymbol: "FTM",
  },
};

interface ExplorerTransaction {
  hash: string;
  blockNumber: string;
  timeStamp: string;
  from: string;
  to: string;
  value: string;
  gas: string;
  gasUsed: string;
  gasPrice: string;
  isError: string;
  txreceipt_status: string;
  input: string;
  contractAddress?: string;
  methodId?: string;
}

/**
 * Fetch ALL transactions from Blockscout/Etherscan-style API
 * Uses offset pagination to get complete history
 */
export async function fetchAllTransactionsClientSide(
  chainId: ChainId,
  address: string,
  onProgress?: (count: number) => void,
): Promise<{ transactions: ChainTransaction[]; metadata: any }> {
  const config = EXPLORER_CONFIGS[chainId];
  if (!config) {
    throw new Error(`Chain ${chainId} not supported by explorer API`);
  }

  console.log(`[${config.name}] Starting fetch for ${address}`);

  const allTransactions: ChainTransaction[] = [];
  let page = 1;
  const pageSize = 100; // Max allowed by most Etherscan-style APIs
  let hasMore = true;
  let totalPages = 0;

  while (hasMore) {
    try {
      const url = `${config.baseUrl}?module=account&action=txlist&address=${address}&page=${page}&offset=${pageSize}&sort=desc`;

      console.log(`[${config.name}] Fetching page ${page}...`);

      const response = await fetch(url, {
        headers: {
          Accept: "application/json",
        },
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`[${config.name}] HTTP Error:`, errorText);
        // Don't break, try to continue
        if (allTransactions.length === 0) {
          throw new Error(
            `Failed to fetch from ${config.name}: ${response.status}`,
          );
        }
        break;
      }

      const data = await response.json();

      // Check for API error
      if (data.status === "0" && data.message !== "No transactions found") {
        console.error(`[${config.name}] API Error:`, data.message, data.result);
        if (allTransactions.length === 0) {
          throw new Error(
            `${config.name} API error: ${data.result || data.message}`,
          );
        }
        break;
      }

      const txs: ExplorerTransaction[] = data.result || [];

      if (txs.length === 0 || data.status === "0") {
        hasMore = false;
        console.log(`[${config.name}] No more transactions on page ${page}`);
        break;
      }

      // Convert to ChainTransaction format
      for (const tx of txs) {
        const isReceive = tx.to.toLowerCase() === address.toLowerCase();

        const converted: ChainTransaction = {
          hash: tx.hash,
          height: tx.blockNumber,
          timestamp: new Date(parseInt(tx.timeStamp) * 1000).toISOString(),
          code: tx.isError === "1" ? 1 : 0,
          chain: chainId,
          tx: {
            body: {
              messages: [
                {
                  "@type": `/cosmos.bank.v1beta1.Msg${isReceive ? "Receive" : "Send"}`,
                  from_address: tx.from,
                  to_address: tx.to,
                  amount: [
                    {
                      amount: tx.value,
                      denom: "native",
                    },
                  ],
                },
              ],
              memo:
                tx.input && tx.input !== "0x"
                  ? `Method: ${tx.methodId || "unknown"}`
                  : "",
            },
            auth_info: {
              fee: {
                amount: [
                  {
                    amount: String(
                      BigInt(tx.gasUsed || "0") * BigInt(tx.gasPrice || "0"),
                    ),
                    denom: "native",
                  },
                ],
              },
            },
          },
        };
        allTransactions.push(converted);
      }

      if (onProgress) {
        onProgress(allTransactions.length);
      }

      console.log(
        `[${config.name}] Page ${page}: +${txs.length} | Total: ${allTransactions.length}`,
      );

      // Continue if we got a full page
      hasMore = txs.length === pageSize;
      page++;
      totalPages++;

      // Rate limiting - be nice to free APIs
      await new Promise((resolve) => setTimeout(resolve, 200));

      // Safety limit - 100 pages = 10,000 transactions
      if (page > 100) {
        console.warn(
          `[${config.name}] Hit safety limit of 10,000 transactions`,
        );
        break;
      }
    } catch (error) {
      console.error(`[${config.name}] Fetch error:`, error);
      if (allTransactions.length === 0) {
        throw error;
      }
      break;
    }
  }

  // Sort by timestamp (newest first)
  allTransactions.sort(
    (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime(),
  );

  const dates = allTransactions.map((tx) => new Date(tx.timestamp));
  const firstDate =
    dates.length > 0
      ? new Date(Math.min(...dates.map((d) => d.getTime())))
      : null;
  const lastDate =
    dates.length > 0
      ? new Date(Math.max(...dates.map((d) => d.getTime())))
      : null;

  console.log(
    `[${config.name}] COMPLETE: ${allTransactions.length} transactions over ${totalPages} pages`,
  );

  return {
    transactions: allTransactions,
    metadata: {
      address,
      chain: chainId,
      totalFetched: allTransactions.length,
      totalPages,
      firstTransactionDate: firstDate?.toISOString(),
      lastTransactionDate: lastDate?.toISOString(),
      dataSource: config.name,
    },
  };
}

export function isValidEvmAddress(address: string): boolean {
  return /^0x[a-fA-F0-9]{40}$/.test(address);
}

export function parseTransaction(
  tx: ChainTransaction,
  walletAddress: string,
): ParsedTransaction {
  const messages = tx.tx?.body?.messages || [];
  const message = messages[0];
  const config = EXPLORER_CONFIGS[tx.chain];

  let type: TransactionType = "unknown";
  let from = "";
  let to = "";
  let amount = "";
  let currency = config?.nativeSymbol || "ETH";
  let fee = "";
  let feeCurrency = currency;

  if (message) {
    const msgType = message["@type"] || "";

    if (msgType.includes("Receive")) {
      type = "receive";
      from = message.from_address || "";
      to = message.to_address || walletAddress;
    } else if (msgType.includes("Send")) {
      type = "send";
      from = message.from_address || walletAddress;
      to = message.to_address || "";
    }

    if (message.amount) {
      const amountArr = Array.isArray(message.amount)
        ? message.amount
        : [message.amount];
      if (amountArr.length > 0) {
        // Convert from wei (10^18) for EVM chains
        const rawAmount = amountArr[0].amount;
        if (rawAmount && rawAmount !== "0") {
          const num = parseFloat(rawAmount) / 1e18;
          amount = num.toFixed(6);
        } else {
          amount = "0";
        }
      }
    }
  }

  // Extract fee
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
    fee,
    feeCurrency,
    memo: tx.tx?.body?.memo || "",
    status: tx.code === 0 ? "success" : "failed",
    chain: tx.chain,
  };
}
