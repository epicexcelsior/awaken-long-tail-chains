import {
  AwakenTaxRow,
  AwakenTaxTradingRow,
  ParsedTransaction,
  CSVFormat,
} from "../types";

// Re-export CSVFormat for use in this file
export type { CSVFormat };

/**
 * Convert parsed transactions to Awaken Tax CSV format
 * Supports both standard transaction format and trading/perpetuals format
 */
export function convertToAwakenCSV(
  transactions: ParsedTransaction[],
  walletAddress: string,
  format: CSVFormat = "standard",
): AwakenTaxRow[] | AwakenTaxTradingRow[] {
  if (format === "trading") {
    return convertToTradingFormat(transactions, walletAddress);
  }
  return convertToStandardFormat(transactions, walletAddress);
}

/**
 * Convert to standard transaction format (Awaken multi-asset template)
 */
function convertToStandardFormat(
  transactions: ParsedTransaction[],
  walletAddress: string,
): AwakenTaxRow[] {
  return transactions.map((tx) => {
    const date = formatDateForAwakenShort(tx.timestamp);

    let receivedQty = "";
    let receivedCurrency = "";
    let receivedFiatAmount = "";
    let sentQty = "";
    let sentCurrency = "";
    let sentFiatAmount = "";
    let receivedQty2 = "";
    let receivedCurrency2 = "";
    let sentQty2 = "";
    let sentCurrency2 = "";

    if (tx.type === "receive" || tx.type === "claim_rewards") {
      receivedQty = tx.amount;
      receivedCurrency = tx.currency;
      receivedFiatAmount = tx.fiatAmount || "";
      // Handle secondary token for multi-asset receives (e.g., LP tokens)
      if (tx.amount2 && tx.currency2) {
        receivedQty2 = tx.amount2;
        receivedCurrency2 = tx.currency2;
      }
    } else if (tx.type === "send" || tx.type === "delegate") {
      sentQty = tx.amount;
      sentCurrency = tx.currency;
      sentFiatAmount = tx.fiatAmount || "";
      // Handle secondary token for multi-asset sends
      if (tx.amount2 && tx.currency2) {
        sentQty2 = tx.amount2;
        sentCurrency2 = tx.currency2;
      }
    } else if (tx.type === "swap") {
      // For swaps, we might have both sent and received
      sentQty = tx.amount;
      sentCurrency = tx.currency;
      sentFiatAmount = tx.fiatAmount || "";
      if (tx.amount2 && tx.currency2) {
        receivedQty = tx.amount2;
        receivedCurrency = tx.currency2;
      }
    } else if (tx.type === "ibc_transfer") {
      // Determine direction based on from/to
      if (tx.from.toLowerCase() === walletAddress.toLowerCase()) {
        sentQty = tx.amount;
        sentCurrency = tx.currency;
        sentFiatAmount = tx.fiatAmount || "";
      } else {
        receivedQty = tx.amount;
        receivedCurrency = tx.currency;
        receivedFiatAmount = tx.fiatAmount || "";
      }
    }

    // Build tag based on transaction type
    const tagMap: Record<string, string> = {
      send: "transfer",
      receive: "transfer",
      swap: "trade",
      ibc_transfer: "transfer",
      delegate: "staking",
      undelegate: "staking",
      claim_rewards: "staking",
      pool_deposit: "liquidity",
      pool_withdraw: "liquidity",
      governance_vote: "governance",
      unknown: "",
    };

    // Build comprehensive notes for cost basis tracking
    let notes = tx.memo || `${tx.type}`;
    
    // Always include full transaction hash for matching
    if (!notes.includes(tx.hash)) {
      notes = `${notes} [TX: ${tx.hash}]`;
    }
    
    // Add from/to addresses for better tracking
    if (tx.from && tx.to) {
      const shortFrom = tx.from.slice(0, 8);
      const shortTo = tx.to.slice(0, 8);
      notes = `${notes} (${shortFrom}... -> ${shortTo}...)`;
    }

    return {
      Date: date,
      "Received Quantity": receivedQty,
      "Received Currency": receivedCurrency,
      "Received Fiat Amount": receivedFiatAmount,
      "Sent Quantity": sentQty,
      "Sent Currency": sentCurrency,
      "Sent Fiat Amount": sentFiatAmount,
      "Received Quantity 2": receivedQty2,
      "Received Currency 2": receivedCurrency2,
      "Sent Quantity 2": sentQty2,
      "Sent Currency 2": sentCurrency2,
      "Fee Amount": tx.fee,
      "Fee Currency": tx.feeCurrency,
      Notes: notes,
      Tag: tagMap[tx.type] || "",
    };
  });
}

/**
 * Convert to trading/perpetuals format
 */
function convertToTradingFormat(
  transactions: ParsedTransaction[],
  walletAddress: string,
): AwakenTaxTradingRow[] {
  return transactions.map((tx, index) => {
    const date = formatDateForTrading(tx.timestamp);
    const isSend = tx.type === "send" || tx.type === "delegate";
    const amount = isSend ? `-${tx.amount}` : tx.amount;

    const tagMap: Record<string, string> = {
      send: "close_position",
      receive: "open_position",
      swap: "close_position",
      delegate: "close_position",
      claim_rewards: "open_position",
      ibc_transfer: "transfer",
    };

    return {
      Date: date,
      Asset: tx.currency || "UNKNOWN",
      Amount: amount,
      Fee: tx.fee,
      "P&L": "",
      "Payment Token": tx.feeCurrency || "",
      ID: `TXN${String(index + 1).padStart(3, "0")}`,
      Notes: tx.memo || `${tx.type} transaction`,
      Tag: tagMap[tx.type] || "other",
      "Transaction Hash": tx.hash,
    };
  });
}

/**
 * Format date as required by Awaken Tax short format: M/D/YY H:MM
 */
function formatDateForAwakenShort(date: Date): string {
  const utcDate = new Date(date.toISOString());

  const month = utcDate.getUTCMonth() + 1;
  const day = utcDate.getUTCDate();
  const year = String(utcDate.getUTCFullYear()).slice(-2);
  const hours = utcDate.getUTCHours();
  const minutes = String(utcDate.getUTCMinutes()).padStart(2, "0");

  return `${month}/${day}/${year} ${hours}:${minutes}`;
}

/**
 * Format date for trading format: YYYY-MM-DD
 */
function formatDateForTrading(date: Date): string {
  const utcDate = new Date(date.toISOString());

  const year = utcDate.getUTCFullYear();
  const month = String(utcDate.getUTCMonth() + 1).padStart(2, "0");
  const day = String(utcDate.getUTCDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

/**
 * Generate CSV content from row array
 */
export function generateCSVContent(
  rows: (AwakenTaxRow | AwakenTaxTradingRow)[],
): string {
  if (rows.length === 0) {
    return "";
  }

  const headers = Object.keys(rows[0]);
  const headerRow = headers.join(",");

  const dataRows = rows.map((row) => {
    return headers
      .map((header) => {
        const value = row[header as keyof typeof row];
        if (
          value &&
          (value.includes(",") || value.includes('"') || value.includes("\n"))
        ) {
          return `"${value.replace(/"/g, '""')}"`;
        }
        return value;
      })
      .join(",");
  });

  return [headerRow, ...dataRows].join("\n");
}

/**
 * Download CSV file in browser
 */
export function downloadCSV(csvContent: string, filename: string): void {
  if (typeof window === "undefined") {
    return;
  }

  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const link = document.createElement("a");

  const url = URL.createObjectURL(blob);
  link.setAttribute("href", url);
  link.setAttribute("download", filename);
  link.style.visibility = "hidden";

  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);

  URL.revokeObjectURL(url);
}

/**
 * Generate filename for the CSV export
 */
export function generateFilename(
  walletAddress: string,
  format: CSVFormat = "standard",
): string {
  const date = new Date().toISOString().split("T")[0];
  const shortAddress = walletAddress.slice(0, 8);
  const formatSuffix = format === "trading" ? "-trading" : "";
  return `awaken-${shortAddress}${formatSuffix}-${date}.csv`;
}
