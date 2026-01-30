import { AwakenTaxRow, ParsedTransaction } from '../types';

/**
 * Convert parsed transactions to Awaken Tax CSV format
 * Format documentation: https://help.awaken.tax/en/articles/10422149-how-to-format-your-csv-for-awaken-tax
 */
export function convertToAwakenCSV(transactions: ParsedTransaction[], walletAddress: string): AwakenTaxRow[] {
  return transactions.map((tx) => {
    const date = formatDateForAwaken(tx.timestamp);
    
    // Determine received/sent based on transaction type
    let receivedQty = '';
    let receivedCurrency = '';
    let sentQty = '';
    let sentCurrency = '';
    
    if (tx.type === 'receive') {
      receivedQty = tx.amount;
      receivedCurrency = tx.currency;
    } else if (tx.type === 'send') {
      sentQty = tx.amount;
      sentCurrency = tx.currency;
    }
    
    // Map transaction type to Awaken Tag
    const tag = mapTransactionTypeToTag(tx.type);
    
    return {
      'Date': date,
      'Received Quantity': receivedQty,
      'Received Currency': receivedCurrency,
      'Received Fiat Amount': '', // Optional - user can fill in if they want
      'Sent Quantity': sentQty,
      'Sent Currency': sentCurrency,
      'Sent Fiat Amount': '', // Optional - user can fill in if they want
      'Fee Amount': tx.fee,
      'Fee Currency': tx.feeCurrency,
      'Transaction Hash': tx.hash,
      'Notes': tx.memo || '',
      'Tag': tag,
    };
  });
}

/**
 * Format date as required by Awaken Tax: MM/DD/YYYY HH:MM:SS in UTC
 */
function formatDateForAwaken(date: Date): string {
  const utcDate = new Date(date.toISOString());
  
  const month = String(utcDate.getUTCMonth() + 1).padStart(2, '0');
  const day = String(utcDate.getUTCDate()).padStart(2, '0');
  const year = utcDate.getUTCFullYear();
  const hours = String(utcDate.getUTCHours()).padStart(2, '0');
  const minutes = String(utcDate.getUTCMinutes()).padStart(2, '0');
  const seconds = String(utcDate.getUTCSeconds()).padStart(2, '0');
  
  return `${month}/${day}/${year} ${hours}:${minutes}:${seconds}`;
}

/**
 * Map internal transaction types to Awaken Tax tags
 */
function mapTransactionTypeToTag(type: string): string {
  const tagMap: Record<string, string> = {
    'send': 'transfer',
    'receive': 'transfer',
    'swap': 'trade',
    'ibc_transfer': 'transfer',
    'delegate': 'staking',
    'undelegate': 'staking',
    'claim_rewards': 'income',
    'pool_deposit': 'deposit',
    'pool_withdraw': 'withdrawal',
    'governance_vote': 'other',
    'unknown': 'other',
  };
  
  return tagMap[type] || 'other';
}

/**
 * Generate CSV content from AwakenTaxRow array
 */
export function generateCSVContent(rows: AwakenTaxRow[]): string {
  if (rows.length === 0) {
    return '';
  }
  
  // Get headers from first row
  const headers = Object.keys(rows[0]) as (keyof AwakenTaxRow)[];
  
  // Create header row
  const headerRow = headers.join(',');
  
  // Create data rows
  const dataRows = rows.map((row) => {
    return headers.map((header) => {
      const value = row[header];
      // Escape values that contain commas, quotes, or newlines
      if (value && (value.includes(',') || value.includes('"') || value.includes('\n'))) {
        return `"${value.replace(/"/g, '""')}"`;
      }
      return value;
    }).join(',');
  });
  
  // Combine all rows
  return [headerRow, ...dataRows].join('\n');
}

/**
 * Download CSV file in browser
 */
export function downloadCSV(csvContent: string, filename: string): void {
  if (typeof window === 'undefined') {
    return; // Server-side, do nothing
  }
  
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  
  // Create download link
  const url = URL.createObjectURL(blob);
  link.setAttribute('href', url);
  link.setAttribute('download', filename);
  link.style.visibility = 'hidden';
  
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  
  // Clean up
  URL.revokeObjectURL(url);
}

/**
 * Generate filename for the CSV export
 */
export function generateFilename(walletAddress: string): string {
  const date = new Date().toISOString().split('T')[0];
  const shortAddress = walletAddress.slice(0, 8);
  return `osmosis-awaken-${shortAddress}-${date}.csv`;
}
