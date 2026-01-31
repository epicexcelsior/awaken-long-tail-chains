import {
  ChainTransaction,
  ParsedTransaction,
  TransactionType,
  ChainId,
} from "../types";

/**
 * Pikespeak API client for NEAR Protocol
 * Fetches comprehensive transaction history including:
 * - Native NEAR transfers
 * - Contract calls (DeFi, DEX, NFTs)
 * - Staking/rewards
 * - Token transfers (FT/NFT)
 * 
 * API Key: 3847be2e-2f13-48ec-86fd-e5d1751fcb09
 * Base URL: https://api.pikespeak.ai
 */

import { getApiKey } from "../utils/apiKeys";

const PIKESPEAK_BASE_URL = "https://api.pikespeak.ai";

// Maximum transactions per page for Pikespeak API
const PAGE_SIZE = 50;

// Maximum pages to fetch (safety limit - 100 pages = 5,000 transactions)
const MAX_PAGES = 100;

interface PikespeakTransaction {
  receipt_id: string;
  block_height: number;
  block_timestamp: number;
  predecessor_account_id: string;
  receiver_account_id: string;
  receipt_kind: string;
  args: {
    method_name?: string;
    args_json?: Record<string, any>;
    args_base64?: string;
  };
  actions: Array<{
    action: string;
    args?: Record<string, any>;
  }>;
  receipt_outcome: {
    status: boolean | { SuccessValue?: string; SuccessReceiptId?: string };
    gas_burnt: number;
    tokens_burnt: string;
    logs: string[];
  };
}

interface PikespeakBalanceResponse {
  contract: string;
  amount: number;
  symbol: string;
  isParsed: boolean;
  icon?: string;
}

/**
 * Validate NEAR address format
 * NEAR addresses can be:
 * - named accounts: alice.near, bob.testnet
 * - implicit accounts: 64 hex characters
 */
export function isValidNearAddress(address: string): boolean {
  // Named account: lowercase letters, digits, hyphens, underscores, dots
  const namedRegex = /^[a-z0-9_-]+(\.[a-z0-9_-]+)*$/i;
  // Implicit account: exactly 64 hex characters
  const implicitRegex = /^[a-f0-9]{64}$/i;
  
  return namedRegex.test(address) || implicitRegex.test(address);
}

/**
 * Fetch account balances to verify account exists
 */
async function fetchAccountBalances(address: string): Promise<PikespeakBalanceResponse[]> {
  const url = `${PIKESPEAK_BASE_URL}/account/balance/${address}`;
  
  const response = await fetch(url, {
    headers: {
      "accept": "application/json",
      "x-api-key": getApiKey("near") || "",
    },
  });
  
  if (!response.ok) {
    if (response.status === 404) {
      throw new Error(`Account ${address} not found`);
    }
    throw new Error(`Pikespeak API error: ${response.status}`);
  }
  
  return await response.json();
}

/**
 * Fetch ALL transactions for a NEAR account using Pikespeak API
 * Uses pagination to get complete history
 */
export async function fetchAllTransactionsClientSide(
  address: string,
  onProgress?: (count: number, page: number) => void,
): Promise<{ transactions: ChainTransaction[]; metadata: any }> {
  console.log(`[Pikespeak] Starting fetch for ${address}`);
  
  // First verify account exists
  try {
    await fetchAccountBalances(address);
  } catch (error) {
    console.warn(`[Pikespeak] Account verification failed:`, error);
    // Continue anyway - account might just have no transactions
  }
  
  const allTransactions: ChainTransaction[] = [];
  let page = 1;
  let hasMore = true;
  let totalPages = 0;
  
  while (hasMore && page <= MAX_PAGES) {
    try {
      const url = `${PIKESPEAK_BASE_URL}/account/transactions/${address}?page=${page}&per_page=${PAGE_SIZE}`;
      
      console.log(`[Pikespeak] Fetching page ${page}...`);
      
      const response = await fetch(url, {
        headers: {
          "accept": "application/json",
          "x-api-key": getApiKey("near") || "",
        },
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error(`[Pikespeak] HTTP Error ${response.status}:`, errorText);
        
        if (allTransactions.length === 0) {
          throw new Error(`Pikespeak API error: ${response.status}`);
        }
        break;
      }
      
      const data = await response.json();
      const txs: PikespeakTransaction[] = data.transactions || [];
      
      if (txs.length === 0) {
        hasMore = false;
        console.log(`[Pikespeak] No more transactions on page ${page}`);
        break;
      }
      
      // Convert to ChainTransaction format
      for (const tx of txs) {
        const converted = convertPikespeakToChainTransaction(tx, address);
        if (converted) {
          allTransactions.push(converted);
        }
      }
      
      if (onProgress) {
        onProgress(allTransactions.length, page);
      }
      
      console.log(
        `[Pikespeak] Page ${page}: +${txs.length} | Total: ${allTransactions.length}`,
      );
      
      // Continue if we got a full page
      hasMore = txs.length === PAGE_SIZE;
      page++;
      totalPages++;
      
      // Rate limiting - be nice to the API
      await new Promise((resolve) => setTimeout(resolve, 100));
      
    } catch (error) {
      console.error(`[Pikespeak] Fetch error on page ${page}:`, error);
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
  const firstDate = dates.length > 0 ? new Date(Math.min(...dates.map((d) => d.getTime()))) : null;
  const lastDate = dates.length > 0 ? new Date(Math.max(...dates.map((d) => d.getTime()))) : null;
  
  console.log(
    `[Pikespeak] COMPLETE: ${allTransactions.length} transactions over ${totalPages} pages`,
  );
  
  return {
    transactions: allTransactions,
    metadata: {
      address,
      chain: "near" as ChainId,
      totalFetched: allTransactions.length,
      totalPages,
      firstTransactionDate: firstDate?.toISOString(),
      lastTransactionDate: lastDate?.toISOString(),
      dataSource: "Pikespeak API",
    },
  };
}

/**
 * Convert Pikespeak transaction to ChainTransaction format
 */
function convertPikespeakToChainTransaction(
  tx: PikespeakTransaction,
  walletAddress: string,
): ChainTransaction | null {
  // Convert timestamp from nanoseconds to milliseconds
  const timestampMs = Math.floor(tx.block_timestamp / 1_000_000);
  
  // Determine transaction type and details
  const { type, amount, currency, from, to, memo } = parseTransactionDetails(tx, walletAddress);
  
  // Skip failed transactions
  const isSuccess = tx.receipt_outcome.status === true || 
    (typeof tx.receipt_outcome.status === 'object' && 
     (tx.receipt_outcome.status.SuccessValue !== undefined || 
      tx.receipt_outcome.status.SuccessReceiptId !== undefined));
  
  // Build messages array
  const messages: any[] = [];
  
  // Add the main action as a message
  if (tx.args.method_name) {
    messages.push({
      "@type": `/near.${tx.receipt_kind}.${tx.args.method_name}`,
      from_address: tx.predecessor_account_id,
      to_address: tx.receiver_account_id,
      sender: tx.predecessor_account_id,
      receiver: tx.receiver_account_id,
      amount: amount ? [{ amount, denom: currency }] : undefined,
    });
  } else {
    // Native transfer
    messages.push({
      "@type": "/near.bank.MsgSend",
      from_address: tx.predecessor_account_id,
      to_address: tx.receiver_account_id,
      amount: amount ? [{ amount, denom: currency }] : undefined,
    });
  }
  
  // Calculate fee (tokens_burnt is in yoctoNEAR)
  const feeYocto = tx.receipt_outcome.tokens_burnt || "0";
  const feeNear = (BigInt(feeYocto) / BigInt("1000000000000000000000000")).toString();
  
  return {
    hash: tx.receipt_id,
    height: String(tx.block_height),
    timestamp: new Date(timestampMs).toISOString(),
    code: isSuccess ? 0 : 1,
    chain: "near" as ChainId,
    logs: tx.receipt_outcome.logs.map((log, i) => ({
      msg_index: i,
      log,
      events: [],
    })),
    tx: {
      body: {
        messages,
        memo: memo || `${tx.receipt_kind} - ${tx.args.method_name || 'transfer'}`,
      },
      auth_info: {
        fee: {
          amount: [
            {
              amount: feeYocto,
              denom: "near",
            },
          ],
        },
      },
    },
  };
}

/**
 * Parse transaction details from Pikespeak data
 */
function parseTransactionDetails(
  tx: PikespeakTransaction,
  walletAddress: string,
): {
  type: TransactionType;
  amount: string;
  currency: string;
  from: string;
  to: string;
  memo: string;
} {
  const methodName = tx.args.method_name || "";
  const predecessor = tx.predecessor_account_id;
  const receiver = tx.receiver_account_id;
  
  let type: TransactionType = "unknown";
  let amount = "";
  let currency = "NEAR";
  let from = predecessor;
  let to = receiver;
  let memo = "";
  
  // Check action type
  const action = tx.actions?.[0];
  
  if (methodName === "transfer" || !methodName) {
    // Native NEAR transfer
    type = predecessor === walletAddress ? "send" : "receive";
    
    // Try to extract amount from args
    if (tx.args.args_json?.amount) {
      amount = formatNearAmount(tx.args.args_json.amount);
    } else if (action?.args?.deposit) {
      amount = formatNearAmount(action.args.deposit);
    }
    
  } else if (methodName.includes("swap") || methodName.includes("ft_transfer")) {
    type = "swap";
    
    if (tx.args.args_json?.amount) {
      amount = formatTokenAmount(tx.args.args_json.amount, tx.args.args_json.decimals || 24);
    }
    
    if (tx.args.args_json?.token_id || receiver) {
      currency = tx.args.args_json?.token_id || "UNKNOWN";
    }
    
  } else if (methodName.includes("stake") || methodName.includes("unstake")) {
    type = methodName.includes("unstake") ? "undelegate" : "delegate";
    
    if (tx.args.args_json?.amount) {
      amount = formatNearAmount(tx.args.args_json.amount);
    }
    
  } else if (methodName.includes("claim") || methodName.includes("harvest")) {
    type = "claim_rewards";
    
  } else if (methodName.includes("deposit") || methodName.includes("add_liquidity")) {
    type = "pool_deposit";
    
  } else if (methodName.includes("withdraw") || methodName.includes("remove_liquidity")) {
    type = "pool_withdraw";
    
  } else if (receiver === walletAddress && predecessor !== walletAddress) {
    type = "receive";
    
  } else if (predecessor === walletAddress && receiver !== walletAddress) {
    type = "send";
  }
  
  // Build memo from method and contract
  memo = `${tx.receipt_kind}: ${methodName || "transfer"}`;
  if (receiver && !receiver.includes(walletAddress)) {
    memo += ` to ${receiver.slice(0, 15)}...`;
  }
  
  return { type, amount, currency, from, to, memo };
}

/**
 * Format yoctoNEAR amount to NEAR (24 decimals)
 */
function formatNearAmount(yoctoAmount: string | number): string {
  try {
    const amount = BigInt(String(yoctoAmount));
    const near = Number(amount) / 1e24;
    return near.toFixed(6);
  } catch {
    return String(yoctoAmount);
  }
}

/**
 * Format token amount with custom decimals
 */
function formatTokenAmount(amount: string | number, decimals: number): string {
  try {
    const value = BigInt(String(amount));
    const divisor = BigInt(10 ** Math.min(decimals, 18)); // Cap at 18 to avoid overflow
    const formatted = Number(value) / Number(divisor);
    return formatted.toFixed(6);
  } catch {
    return String(amount);
  }
}

/**
 * Parse a ChainTransaction to ParsedTransaction for UI display
 */
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
  let currency = "NEAR";
  let amount2 = "";
  let currency2 = "";
  let fee = "";
  let feeCurrency = "NEAR";
  
  if (message) {
    const msgType = message["@type"] || "";
    
    // Determine direction
    if (msgType.includes("Receive") || message.from_address === walletAddress) {
      type = "receive";
      from = message.from_address || "";
      to = message.to_address || walletAddress;
    } else if (msgType.includes("Send") || message.sender === walletAddress) {
      type = "send";
      from = message.sender || walletAddress;
      to = message.receiver || "";
    } else if (msgType.includes("swap")) {
      type = "swap";
      from = message.sender || walletAddress;
      to = message.receiver || "";
    }
    
    // Extract amount
    if (message.amount) {
      const amountArr = Array.isArray(message.amount) ? message.amount : [message.amount];
      if (amountArr.length > 0) {
        amount = formatNearAmount(amountArr[0].amount);
        currency = amountArr[0].denom === "near" ? "NEAR" : amountArr[0].denom;
      }
      if (amountArr.length > 1) {
        amount2 = formatNearAmount(amountArr[1].amount);
        currency2 = amountArr[1].denom === "near" ? "NEAR" : amountArr[1].denom;
      }
    }
  }
  
  // Extract fee (convert from yoctoNEAR)
  const feeAmount = tx.tx?.auth_info?.fee?.amount?.[0];
  if (feeAmount && feeAmount.amount) {
    fee = formatNearAmount(feeAmount.amount);
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
    chain: "near",
  };
}
