import {
  OsmosisTransaction,
  ParsedTransaction,
  TransactionType,
  ChainId,
} from "../types";
import { getApiKey } from "../utils/apiKeys";

const CHAIN_ID: ChainId = "osmosis";
const MINTSCAN_API_KEY = getApiKey("mintscan") || "";

/**
 * Client-side transaction fetcher with improved pagination
 * Fetches ALL transactions without arbitrary page limits
 */
export async function fetchAllTransactionsClientSide(
  address: string,
  onProgress?: (count: number, total: number) => void,
): Promise<{ transactions: OsmosisTransaction[]; metadata: any }> {
  console.log(`[Osmosis] Starting comprehensive fetch for ${address}`);

  const allTransactions = new Map<string, OsmosisTransaction>();
  const LCD_ENDPOINTS = [
    "https://lcd.osmosis.zone",
    "https://osmosis-api.polkachu.com",
    "https://rest-osmosis.blockapsis.com",
  ];

  // Query types to catch all transaction types
  const queryTypes = [
    { name: "message.sender", query: `message.sender='${address}'` },
    { name: "transfer.recipient", query: `transfer.recipient='${address}'` },
    { name: "transfer.sender", query: `transfer.sender='${address}'` },
    { name: "ibc_transfer.sender", query: `ibc_transfer.sender='${address}'` },
    {
      name: "ibc_transfer.receiver",
      query: `ibc_transfer.receiver='${address}'`,
    },
    {
      name: "delegate.delegator",
      query: `delegate.delegator_address='${address}'`,
    },
    {
      name: "begin_redelegate",
      query: `begin_redelegate.delegator_address='${address}'`,
    },
    {
      name: "begin_unbonding",
      query: `begin_unbonding.delegator_address='${address}'`,
    },
    {
      name: "withdraw_rewards",
      query: `withdraw_rewards.delegator_address='${address}'`,
    },
    {
      name: "set_withdraw_address",
      query: `set_withdraw_address.delegator_address='${address}'`,
    },
    {
      name: "swap_exact_amount_in",
      query: `swap_exact_amount_in.sender='${address}'`,
    },
    {
      name: "swap_exact_amount_out",
      query: `swap_exact_amount_out.sender='${address}'`,
    },
    { name: "join_pool", query: `join_pool.sender='${address}'` },
    { name: "exit_pool", query: `exit_pool.sender='${address}'` },
    { name: "lock_tokens", query: `lock_tokens.owner='${address}'` },
    { name: "begin_unlocking", query: `begin_unlocking.owner='${address}'` },
    { name: "vote", query: `vote.voter='${address}'` },
    { name: "submit_proposal", query: `submit_proposal.proposer='${address}'` },
    { name: "deposit", query: `deposit.depositor='${address}'` },
    { name: "send", query: `send.from_address='${address}'` },
    { name: "create_denom", query: `create_denom.sender='${address}'` },
    { name: "mint", query: `mint.sender='${address}'` },
    { name: "burn", query: `burn.sender='${address}'` },
  ];

  let lastSuccessfulEndpoint = "";
  let queriesWithData: string[] = [];

  // Try each endpoint
  for (const endpoint of LCD_ENDPOINTS) {
    console.log(`[Osmosis] Trying LCD: ${endpoint}`);
    let endpointSuccess = false;

    for (const queryType of queryTypes) {
      let offset = 0;
      let hasMore = true;
      let queryTotalReported = 0;
      let pagesFetched = 0;
      let consecutiveErrors = 0;

      // NO page limit - fetch until we get all data
      while (hasMore) {
        try {
          const url = `${endpoint}/cosmos/tx/v1beta1/txs?query=${encodeURIComponent(queryType.query)}&pagination.offset=${offset}&pagination.limit=100&order_by=ORDER_BY_DESC`;

          if (pagesFetched === 0) {
            console.log(`[Osmosis] ${queryType.name} - starting fetch...`);
          }

          const response = await fetch(url, {
            headers: { Accept: "application/json" },
          });

          if (!response.ok) {
            consecutiveErrors++;
            if (response.status === 500 || consecutiveErrors >= 3) {
              console.log(
                `[Osmosis] ${queryType.name} - Error at offset ${offset}, stopping`,
              );
              break;
            }
            // Retry with delay
            await new Promise((resolve) => setTimeout(resolve, 500));
            continue;
          }

          consecutiveErrors = 0;
          const data: any = await response.json();
          const batch: OsmosisTransaction[] = data.tx_responses || [];

          if (batch.length === 0) {
            hasMore = false;
            break;
          }

          // Add transactions to map (deduplication by hash)
          let newTxCount = 0;
          for (const tx of batch) {
            if (tx.txhash && !allTransactions.has(tx.txhash)) {
              allTransactions.set(tx.txhash, tx);
              newTxCount++;
            }
          }

          // Get total on first page
          if (offset === 0 && data.pagination?.total) {
            queryTotalReported = parseInt(data.pagination.total, 10);
            console.log(
              `[Osmosis] ${queryType.name}: ${queryTotalReported} total reported`,
            );
          }

          if (onProgress) {
            onProgress(allTransactions.size, queryTotalReported);
          }

          // Continue if we got a full page (100 items)
          hasMore = batch.length === 100;

          // Also stop if we've fetched more than the reported total
          if (
            queryTotalReported > 0 &&
            offset + batch.length >= queryTotalReported
          ) {
            hasMore = false;
          }

          offset += 100;
          pagesFetched++;

          // Small delay to avoid rate limiting
          if (pagesFetched % 5 === 0) {
            await new Promise((resolve) => setTimeout(resolve, 100));
          }
        } catch (error) {
          console.error(
            `[Osmosis] ${queryType.name} offset ${offset} error:`,
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
          `[Osmosis] ${queryType.name}: done, ${allTransactions.size} total unique`,
        );
      }
    }

    // If we got meaningful data, we can stop
    if (endpointSuccess && allTransactions.size > 0) {
      console.log(`[Osmosis] Got ${allTransactions.size} txs from ${endpoint}`);
      break;
    }
  }

  // Convert to array and sort by timestamp (newest first)
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

  console.log(`[Osmosis] FINAL: ${uniqueTxs.length} unique transactions`);
  console.log(
    `[Osmosis] Date range: ${firstDate?.toLocaleDateString()} - ${lastDate?.toLocaleDateString()}`,
  );

  return {
    transactions: uniqueTxs,
    metadata: {
      address,
      chain: CHAIN_ID,
      totalFetched: uniqueTxs.length,
      firstTransactionDate: firstDate?.toISOString(),
      lastTransactionDate: lastDate?.toISOString(),
      dataSource: `LCD API (${lastSuccessfulEndpoint})`,
      queryTypesUsed: queriesWithData.length,
      endpoints: [lastSuccessfulEndpoint],
    },
  };
}

export function isValidOsmosisAddress(address: string): boolean {
  return /^osmo[a-z0-9]{39}$/i.test(address);
}

export function parseTransaction(
  tx: OsmosisTransaction,
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
        const coin = Array.isArray(message.amount)
          ? message.amount[0]
          : message.amount;
        if (coin) {
          amount = formatAmount(coin.amount);
          currency = formatDenom(coin.denom);
        }
      }
    } else if (
      msgType.includes("MsgSwap") ||
      msgType.includes("SwapExactAmountIn") ||
      msgType.includes("SwapExactAmountOut")
    ) {
      type = "swap";
      from = message.sender || walletAddress;
    } else if (msgType.includes("MsgTransfer")) {
      type = "ibc_transfer";
      from = message.sender || "";
      to = message.receiver || "";

      if (message.token) {
        amount = formatAmount(message.token.amount);
        currency = formatDenom(message.token.denom);
      }
    } else if (msgType.includes("MsgDelegate")) {
      type = "delegate";
      from = message.delegator_address || walletAddress;
      to = message.validator_address || "";

      if (message.amount) {
        const coin = Array.isArray(message.amount)
          ? message.amount[0]
          : message.amount;
        if (coin) {
          amount = formatAmount(coin.amount);
          currency = formatDenom(coin.denom);
        }
      }
    } else if (
      msgType.includes("MsgUndelegate") ||
      msgType.includes("MsgBeginUnbonding")
    ) {
      type = "undelegate";
      from = message.delegator_address || walletAddress;
    } else if (msgType.includes("MsgWithdrawDelegatorReward")) {
      type = "claim_rewards";
      from = message.delegator_address || walletAddress;
    } else if (msgType.includes("MsgVote")) {
      type = "governance_vote";
      from = message.voter || walletAddress;
    } else if (
      msgType.includes("JoinPool") ||
      msgType.includes("JoinSwapExternAmountIn")
    ) {
      type = "pool_deposit";
      from = message.sender || walletAddress;
    } else if (
      msgType.includes("ExitPool") ||
      msgType.includes("ExitSwapShareAmountIn")
    ) {
      type = "pool_withdraw";
      from = message.sender || walletAddress;
    }
  }

  let fee = "";
  let feeCurrency = "";
  if (tx.tx?.auth_info?.fee?.amount && tx.tx.auth_info.fee.amount.length > 0) {
    fee = formatAmount(tx.tx.auth_info.fee.amount[0].amount);
    feeCurrency = formatDenom(tx.tx.auth_info.fee.amount[0].denom);
  }

  return {
    hash: tx.txhash,
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
  const num = parseInt(amount, 10);
  if (isNaN(num)) return "0";
  return (num / 1_000_000).toFixed(6);
}

function formatDenom(denom: string): string {
  if (!denom) return "";
  if (denom.startsWith("ibc/")) return "IBC-Token";

  const denomMap: Record<string, string> = {
    uosmo: "OSMO",
    uatom: "ATOM",
    uusdc: "USDC",
    uion: "ION",
  };

  return denomMap[denom] || denom.toUpperCase();
}
