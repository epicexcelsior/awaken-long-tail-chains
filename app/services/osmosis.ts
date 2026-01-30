import { OsmosisTransaction, ParsedTransaction, TransactionType, Coin, Message } from '../types';

const LCD_ENDPOINT = process.env.NEXT_PUBLIC_LCD_ENDPOINT || 'https://lcd.osmosis.zone';
const RPC_ENDPOINT = process.env.NEXT_PUBLIC_RPC_ENDPOINT || 'https://rpc.osmosis.zone';
const MINTSCAN_API_KEY = process.env.NEXT_PUBLIC_MINTSCAN_API_KEY || '';

/**
 * Fetch transactions from Osmosis LCD REST API
 * This is the primary free method that doesn't require an API key
 */
export async function fetchTransactionsLCD(
  address: string,
  limit: number = 100,
  offset: number = 0
): Promise<OsmosisTransaction[]> {
  try {
    // Query transactions where address is sender OR receiver
    const [senderResponse, receiverResponse] = await Promise.all([
      fetch(`${LCD_ENDPOINT}/cosmos/tx/v1beta1/txs?events=transfer.sender='${address}'&pagination.limit=${limit}&pagination.offset=${offset}&order_by=ORDER_BY_DESC`, {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
        },
      }),
      fetch(`${LCD_ENDPOINT}/cosmos/tx/v1beta1/txs?events=transfer.recipient='${address}'&pagination.limit=${limit}&pagination.offset=${offset}&order_by=ORDER_BY_DESC`, {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
        },
      }),
    ]);

    if (!senderResponse.ok && !receiverResponse.ok) {
      throw new Error('Failed to fetch transactions from LCD endpoint');
    }

    const senderData = senderResponse.ok ? await senderResponse.json() : { tx_responses: [] };
    const receiverData = receiverResponse.ok ? await receiverResponse.json() : { tx_responses: [] };

    // Combine and deduplicate transactions
    const allTxs = [...senderData.tx_responses, ...receiverData.tx_responses];
    const uniqueTxs = Array.from(new Map(allTxs.map((tx: OsmosisTransaction) => [tx.txhash, tx])).values());

    // Sort by timestamp descending
    uniqueTxs.sort((a: OsmosisTransaction, b: OsmosisTransaction) => 
      new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    );

    return uniqueTxs.slice(0, limit);
  } catch (error) {
    console.error('LCD fetch error:', error);
    throw error;
  }
}

/**
 * Fetch transactions using Mintscan API
 * Requires API key for production use, but has higher rate limits
 * API Key placeholder: Get yours at https://api.mintscan.io
 */
export async function fetchTransactionsMintscan(
  address: string,
  limit: number = 100,
  offset: number = 0
): Promise<OsmosisTransaction[]> {
  if (!MINTSCAN_API_KEY) {
    console.warn('Mintscan API key not configured. Set NEXT_PUBLIC_MINTSCAN_API_KEY environment variable.');
    throw new Error('Mintscan API key required');
  }

  try {
    const response = await fetch(
      `https://api.mintscan.io/v1/osmosis/accounts/${address}/transactions?limit=${limit}&offset=${offset}`,
      {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
          'Authorization': `Bearer ${MINTSCAN_API_KEY}`,
        },
      }
    );

    if (!response.ok) {
      throw new Error(`Mintscan API error: ${response.status}`);
    }

    const data = await response.json();
    return data.data || [];
  } catch (error) {
    console.error('Mintscan fetch error:', error);
    throw error;
  }
}

/**
 * Main transaction fetcher with fallback
 * Tries LCD first (free), then falls back to Mintscan if configured
 */
export async function fetchAllTransactions(
  address: string,
  limit: number = 100
): Promise<OsmosisTransaction[]> {
  try {
    // Try LCD first (free, no API key needed)
    const lcdTxs = await fetchTransactionsLCD(address, limit);
    
    if (lcdTxs.length > 0) {
      console.log(`Fetched ${lcdTxs.length} transactions from LCD endpoint`);
      return lcdTxs;
    }

    // Fallback to Mintscan if LCD returns empty and API key is configured
    if (MINTSCAN_API_KEY) {
      console.log('LCD returned empty, trying Mintscan API...');
      return await fetchTransactionsMintscan(address, limit);
    }

    return [];
  } catch (error) {
    console.error('Error fetching transactions:', error);
    
    // If LCD fails and we have Mintscan key, try that
    if (MINTSCAN_API_KEY) {
      try {
        return await fetchTransactionsMintscan(address, limit);
      } catch (mintscanError) {
        console.error('Mintscan also failed:', mintscanError);
        throw mintscanError;
      }
    }
    
    throw error;
  }
}

/**
 * Parse raw Osmosis transaction into simplified format for display
 */
export function parseTransaction(tx: OsmosisTransaction, walletAddress: string): ParsedTransaction {
  const messages = tx.tx?.body?.messages || [];
  const message = messages[0];
  
  let type: TransactionType = 'unknown';
  let from = '';
  let to = '';
  let amount = '';
  let currency = '';

  if (message) {
    // Determine transaction type and extract details
    if (message['@type'].includes('MsgSend')) {
      type = message.from_address === walletAddress ? 'send' : 'receive';
      from = message.from_address || '';
      to = message.to_address || '';
      
      if (message.amount && message.amount.length > 0) {
        amount = formatAmount(message.amount[0].amount);
        currency = formatDenom(message.amount[0].denom);
      }
    } else if (message['@type'].includes('MsgSwap')) {
      type = 'swap';
      // Extract swap details from events if available
    } else if (message['@type'].includes('MsgTransfer')) {
      type = 'ibc_transfer';
      from = message.sender || '';
      to = message.receiver || '';
      
      if (message.token) {
        amount = formatAmount(message.token.amount);
        currency = formatDenom(message.token.denom);
      }
    }
  }

  // Extract fee
  let fee = '';
  let feeCurrency = '';
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
    memo: tx.tx?.body?.memo || '',
    status: tx.code === 0 ? 'success' : 'failed',
  };
}

/**
 * Format amount from micro units to readable format
 */
function formatAmount(amount: string): string {
  const num = parseInt(amount, 10);
  if (isNaN(num)) return '0';
  
  // Convert from micro (6 decimals) to standard units
  return (num / 1_000_000).toFixed(6);
}

/**
 * Format denomination from blockchain format to readable
 */
function formatDenom(denom: string): string {
  if (!denom) return '';
  
  // Handle IBC tokens
  if (denom.startsWith('ibc/')) {
    return 'IBC-Token';
  }
  
  // Handle standard denominations
  const denomMap: Record<string, string> = {
    'uosmo': 'OSMO',
    'uatom': 'ATOM',
    'uusdc': 'USDC',
    'uusd': 'UST',
    'uluna': 'LUNA',
  };
  
  return denomMap[denom] || denom.toUpperCase();
}

/**
 * Validate Osmosis wallet address
 */
export function isValidOsmosisAddress(address: string): boolean {
  // Osmosis addresses start with 'osmo' followed by alphanumeric characters
  return /^osmo[a-z0-9]{39}$/i.test(address);
}
