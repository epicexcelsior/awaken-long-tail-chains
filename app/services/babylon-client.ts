import {
  ChainTransaction,
  ParsedTransaction,
  TransactionType,
  ChainId,
} from "../types";
import { getChainConfig } from "../config/chains";
import { getApiKey } from "../utils/apiKeys";

const CHAIN_ID: ChainId = "babylon";
const API_KEY = getApiKey("babylon") || "";

/**
 * Fetch ALL transactions from Babylon using AllThatNode REST API
 * Uses the same pattern as Osmosis - LCD/REST API with pagination
 */
export async function fetchAllTransactionsClientSide(
  address: string,
  onProgress?: (count: number, query: string, page: number) => void,
): Promise<{ transactions: ChainTransaction[]; metadata: any }> {
  console.log(`[Babylon] Starting comprehensive fetch for ${address}`);

  const config = getChainConfig(CHAIN_ID);
  const allTransactions = new Map<string, ChainTransaction>();

  // Use REST API endpoints (LCD style)
  const restEndpoints = config.apiEndpoints;

  // Query patterns for Babylon (Cosmos SDK based)
  const queryTypes = [
    { name: "message.sender", query: `message.sender='${address}'` },
    { name: "transfer.recipient", query: `transfer.recipient='${address}'` },
    { name: "transfer.sender", query: `transfer.sender='${address}'` },
    {
      name: "ibc_transfer.receiver",
      query: `ibc_transfer.receiver='${address}'`,
    },
    { name: "ibc_transfer.sender", query: `ibc_transfer.sender='${address}'` },
    {
      name: "delegate.delegator",
      query: `delegate.delegator_address='${address}'`,
    },
    {
      name: "withdraw_rewards",
      query: `withdraw_rewards.delegator_address='${address}'`,
    },
    { name: "send.from_address", query: `send.from_address='${address}'` },
    { name: "vote.voter", query: `vote.voter='${address}'` },
  ];

  let lastSuccessfulEndpoint = "";
  let queriesWithData: string[] = [];

  // Try each REST endpoint
  for (const endpoint of restEndpoints) {
    console.log(`[Babylon] Trying REST API: ${endpoint}`);
    let endpointSuccess = false;

    for (const queryType of queryTypes) {
      let offset = 0;
      let hasMore = true;
      let queryTotalReported = 0;
      let pagesFetched = 0;
      let consecutiveErrors = 0;

      while (hasMore) {
        try {
          const url = `${endpoint}/cosmos/tx/v1beta1/txs?query=${encodeURIComponent(queryType.query)}&pagination.offset=${offset}&pagination.limit=100&order_by=ORDER_BY_DESC`;

          if (pagesFetched === 0) {
            console.log(`[Babylon] ${queryType.name} - starting fetch...`);
          }

          const response = await fetch(url, {
            headers: {
              Accept: "application/json",
            },
          });

          if (!response.ok) {
            consecutiveErrors++;
            if (response.status === 500 || consecutiveErrors >= 3) {
              console.log(
                `[Babylon] ${queryType.name} - Error at offset ${offset}`,
              );
              break;
            }
            await new Promise((resolve) => setTimeout(resolve, 500));
            continue;
          }

          consecutiveErrors = 0;
          const data: any = await response.json();
          const batch = data.tx_responses || [];

          if (batch.length === 0) {
            hasMore = false;
            break;
          }

          // Add transactions (convert to ChainTransaction format)
          let newTxCount = 0;
          for (const tx of batch) {
            if (tx.txhash && !allTransactions.has(tx.txhash)) {
              const converted: ChainTransaction = {
                hash: tx.txhash,
                height: tx.height,
                timestamp: tx.timestamp,
                code: tx.code || 0,
                chain: CHAIN_ID,
                logs: tx.logs,
                tx: tx.tx,
              };
              allTransactions.set(tx.txhash, converted);
              newTxCount++;
            }
          }

          // Get total on first page
          if (offset === 0 && data.pagination?.total) {
            queryTotalReported = parseInt(data.pagination.total, 10);
            console.log(
              `[Babylon] ${queryType.name}: ${queryTotalReported} total reported`,
            );
          }

          if (onProgress) {
            onProgress(allTransactions.size, queryType.name, pagesFetched);
          }

          hasMore = batch.length === 100;
          if (
            queryTotalReported > 0 &&
            offset + batch.length >= queryTotalReported
          ) {
            hasMore = false;
          }

          offset += 100;
          pagesFetched++;

          if (pagesFetched % 5 === 0) {
            await new Promise((resolve) => setTimeout(resolve, 100));
          }
        } catch (error) {
          console.error(
            `[Babylon] ${queryType.name} offset ${offset} error:`,
            error,
          );
          consecutiveErrors++;
          if (consecutiveErrors >= 3) {
            hasMore = false;
          } else {
            await new Promise((resolve) => setTimeout(resolve, 500));
          }
        }
      }

      if (pagesFetched > 0) {
        endpointSuccess = true;
        lastSuccessfulEndpoint = endpoint;
        if (queryTotalReported > 0) {
          queriesWithData.push(`${queryType.name}: ${queryTotalReported}`);
        }
        console.log(
          `[Babylon] ${queryType.name}: done, ${allTransactions.size} total unique`,
        );
      }
    }

    if (endpointSuccess && allTransactions.size > 0) {
      console.log(`[Babylon] Got ${allTransactions.size} txs from ${endpoint}`);
      break;
    }
  }

  // Convert to array and sort
  const uniqueTxs = Array.from(allTransactions.values());
  uniqueTxs.sort(
    (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime(),
  );

  const dates = uniqueTxs.map((tx) => new Date(tx.timestamp));
  const firstDate =
    dates.length > 0
      ? new Date(Math.min(...dates.map((d) => d.getTime())))
      : null;
  const lastDate =
    dates.length > 0
      ? new Date(Math.max(...dates.map((d) => d.getTime())))
      : null;

  console.log(`[Babylon] FINAL: ${uniqueTxs.length} unique transactions`);

  return {
    transactions: uniqueTxs,
    metadata: {
      address,
      chain: CHAIN_ID,
      totalFetched: uniqueTxs.length,
      firstTransactionDate: firstDate?.toISOString(),
      lastTransactionDate: lastDate?.toISOString(),
      dataSource: `REST API (${lastSuccessfulEndpoint || "none"})`,
      queryTypesUsed: queriesWithData.length,
      endpoints: [lastSuccessfulEndpoint],
    },
  };
}

export function isValidBabylonAddress(address: string): boolean {
  const config = getChainConfig(CHAIN_ID);
  return config.addressRegex.test(address);
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
  let currency = "";

  if (message) {
    const msgType = message["@type"] || "";

    if (msgType.includes("MsgSend")) {
      type = message.from_address === walletAddress ? "send" : "receive";
      from = message.from_address || "";
      to = message.to_address || "";

      if (message.amount) {
        const amountArr = Array.isArray(message.amount)
          ? message.amount
          : [message.amount];
        if (amountArr.length > 0) {
          amount = formatAmount(amountArr[0].amount);
          currency = formatDenom(amountArr[0].denom);
        }
      }
    } else if (msgType.includes("MsgDelegate")) {
      type = "delegate";
      from = message.delegator_address || "";

      if (message.amount) {
        const coin = Array.isArray(message.amount)
          ? message.amount[0]
          : message.amount;
        if (coin) {
          amount = formatAmount(coin.amount);
          currency = formatDenom(coin.denom);
        }
      }
    } else if (msgType.includes("MsgWithdrawDelegatorReward")) {
      type = "claim_rewards";
      from = message.delegator_address || "";
    } else if (msgType.includes("MsgTransfer")) {
      type = "ibc_transfer";
      from = message.sender || "";
      to = message.receiver || "";

      if (message.token) {
        amount = formatAmount(message.token.amount);
        currency = formatDenom(message.token.denom);
      }
    } else if (msgType.includes("MsgVote")) {
      type = "governance_vote";
      from = message.voter || walletAddress;
    }
  }

  let fee = "";
  let feeCurrency = "";
  if (tx.tx?.auth_info?.fee?.amount && tx.tx.auth_info.fee.amount.length > 0) {
    fee = formatAmount(tx.tx.auth_info.fee.amount[0].amount);
    feeCurrency = formatDenom(tx.tx.auth_info.fee.amount[0].denom);
  }

  return {
    hash: tx.hash,
    timestamp: new Date(tx.timestamp),
    height: parseInt(tx.height, 10),
    type,
    from,
    to,
    amount,
    currency,
    fee,
    feeCurrency,
    memo: tx.tx?.body?.memo || "",
    status: tx.code === 0 ? "success" : "failed",
    chain: CHAIN_ID,
  };
}

function formatAmount(amount: string): string {
  const config = getChainConfig(CHAIN_ID);
  const num = parseInt(amount, 10);
  if (isNaN(num)) return "0";
  return (num / Math.pow(10, config.decimals)).toFixed(config.decimals);
}

function formatDenom(denom: string): string {
  if (!denom) return "";
  if (denom.startsWith("ibc/")) return "IBC-Token";

  const config = getChainConfig(CHAIN_ID);
  const denomMap: Record<string, string> = {
    [config.nativeDenom]: config.nativeSymbol,
    ubbn: "BABY",
    uatom: "ATOM",
  };

  return denomMap[denom] || denom.toUpperCase();
}
