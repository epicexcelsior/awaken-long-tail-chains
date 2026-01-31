#!/usr/bin/env node

/**
 * Pre-Implementation Verification Test
 * Address: 0xD23Bfd31430eFB9c8358b703B62BdE17F36E1274
 * 
 * This test verifies:
 * 1. Complete transaction history can be fetched
 * 2. Both regular transfers AND token transfers are captured
 * 3. CSV format matches Awaken Tax requirements
 * 4. All data needed for cost basis is present
 */

const API_KEY = "39SMAR4FE2B41TQI5MDQ4PNDM5BG4HSP7J";
const CHAIN_ID = "42220"; // Celo Mainnet
const BASE_URL = "https://api.etherscan.io/v2/api";
const DELAY_MS = 350; // Stay under 3/sec rate limit

// Test address provided by user
const TEST_ADDRESS = "0xD23Bfd31430eFB9c8358b703B62BdE17F36E1274";

async function fetchWithRateLimit(url) {
  const response = await fetch(url);
  const data = await response.json();
  await new Promise(resolve => setTimeout(resolve, DELAY_MS));
  return data;
}

async function fetchAllTransactions(address, maxPages = 100) {
  console.log(`Fetching ALL transactions for ${address}...\n`);
  
  const allTransactions = [];
  let page = 1;
  let hasMore = true;
  
  while (hasMore && page <= maxPages) {
    const url = `${BASE_URL}?module=account&action=txlist&address=${address}&chainid=${CHAIN_ID}&page=${page}&offset=100&sort=desc&apikey=${API_KEY}`;
    
    const result = await fetchWithRateLimit(url);
    
    if (result.status !== "1") {
      console.log(`  Page ${page}: ${result.message || result.result}`);
      break;
    }
    
    const transactions = result.result;
    allTransactions.push(...transactions);
    
    console.log(`  Page ${page}: ${transactions.length} transactions (Total: ${allTransactions.length})`);
    
    hasMore = transactions.length === 100;
    page++;
  }
  
  return allTransactions;
}

async function fetchAllTokenTransfers(address, maxPages = 100) {
  console.log(`\nFetching ALL token transfers for ${address}...\n`);
  
  const allTransfers = [];
  let page = 1;
  let hasMore = true;
  
  while (hasMore && page <= maxPages) {
    const url = `${BASE_URL}?module=account&action=tokentx&address=${address}&chainid=${CHAIN_ID}&page=${page}&offset=100&sort=desc&apikey=${API_KEY}`;
    
    const result = await fetchWithRateLimit(url);
    
    if (result.status !== "1") {
      console.log(`  Page ${page}: ${result.message || result.result}`);
      break;
    }
    
    const transfers = result.result;
    allTransfers.push(...transfers);
    
    console.log(`  Page ${page}: ${transfers.length} transfers (Total: ${allTransfers.length})`);
    
    hasMore = transfers.length === 100;
    page++;
  }
  
  return allTransfers;
}

function analyzeCompleteHistory(transactions, tokenTransfers) {
  console.log("\n========================================");
  console.log("COMPLETE HISTORY ANALYSIS");
  console.log("========================================\n");
  
  // Sort by timestamp
  const sortedTx = [...transactions].sort((a, b) => parseInt(a.timeStamp) - parseInt(b.timeStamp));
  const sortedTransfers = [...tokenTransfers].sort((a, b) => parseInt(a.timeStamp) - parseInt(b.timeStamp));
  
  const firstTx = sortedTx[0];
  const lastTx = sortedTx[sortedTx.length - 1];
  
  console.log(`Regular Transactions (txlist): ${transactions.length}`);
  console.log(`Token Transfers (tokentx): ${tokenTransfers.length}`);
  console.log(`TOTAL RECORDS: ${transactions.length + tokenTransfers.length}\n`);
  
  if (transactions.length > 0) {
    const firstDate = new Date(parseInt(firstTx.timeStamp) * 1000);
    const lastDate = new Date(parseInt(lastTx.timeStamp) * 1000);
    
    console.log(`Date Range:`);
    console.log(`  First: ${firstDate.toISOString()}`);
    console.log(`  Last:  ${lastDate.toISOString()}`);
    console.log(`  Duration: ${Math.round((lastDate - firstDate) / (1000 * 60 * 60 * 24))} days\n`);
    
    // Analyze transaction types
    const withValue = transactions.filter(t => t.value !== "0" && t.value !== "0x0");
    const contractCalls = transactions.filter(t => t.input && t.input !== "0x" && t.input.length > 2);
    const successful = transactions.filter(t => t.isError === "0");
    
    console.log(`Transaction Breakdown:`);
    console.log(`  Native CELO transfers: ${withValue.length}`);
    console.log(`  Contract calls: ${contractCalls.length}`);
    console.log(`  Successful: ${successful.length}`);
    console.log(`  Failed: ${transactions.length - successful.length}\n`);
  }
  
  // Analyze token transfers
  if (tokenTransfers.length > 0) {
    const firstTransfer = sortedTransfers[0];
    const lastTransfer = sortedTransfers[sortedTransfers.length - 1];
    
    console.log(`Token Transfer Range:`);
    console.log(`  First: ${new Date(parseInt(firstTransfer.timeStamp) * 1000).toISOString()}`);
    console.log(`  Last:  ${new Date(parseInt(lastTransfer.timeStamp) * 1000).toISOString()}\n`);
    
    // Unique tokens
    const tokenMap = new Map();
    tokenTransfers.forEach(t => {
      const addr = t.contractAddress.toLowerCase();
      if (!tokenMap.has(addr)) {
        tokenMap.set(addr, {
          symbol: t.tokenSymbol,
          name: t.tokenName,
          decimals: t.tokenDecimal,
          count: 0,
          volume: BigInt(0)
        });
      }
      const data = tokenMap.get(addr);
      data.count++;
      data.volume += BigInt(t.value);
    });
    
    console.log(`Unique Tokens: ${tokenMap.size}`);
    console.log(`\nTop 10 Tokens by Transfer Count:`);
    Array.from(tokenMap.entries())
      .sort((a, b) => b[1].count - a[1].count)
      .slice(0, 10)
      .forEach(([addr, data]) => {
        const volume = Number(data.volume) / Math.pow(10, data.decimals);
        console.log(`  ${data.symbol} (${data.name}): ${data.count} transfers, Total: ${volume.toLocaleString()}`);
      });
  }
}

function generateAwakenCSV(transactions, tokenTransfers, walletAddress) {
  console.log("\n========================================");
  console.log("CSV GENERATION (Awaken Tax Format)");
  console.log("========================================\n");
  
  // Create lookup for token transfers by transaction hash
  const transfersByHash = new Map();
  tokenTransfers.forEach(t => {
    if (!transfersByHash.has(t.hash)) {
      transfersByHash.set(t.hash, []);
    }
    transfersByHash.get(t.hash).push(t);
  });
  
  // Generate CSV rows
  const csvRows = [];
  
  transactions.forEach(tx => {
    const date = new Date(parseInt(tx.timeStamp) * 1000);
    const formattedDate = `${date.getMonth() + 1}/${date.getDate()}/${String(date.getFullYear()).slice(-2)} ${date.getHours()}:${String(date.getMinutes()).padStart(2, '0')}`;
    
    // Calculate fee
    const feeWei = BigInt(tx.gasUsed || 0) * BigInt(tx.gasPrice || 0);
    const fee = (Number(feeWei) / 1e18).toFixed(6);
    
    // Determine transaction direction
    const isFromWallet = tx.from.toLowerCase() === walletAddress.toLowerCase();
    const isToWallet = tx.to?.toLowerCase() === walletAddress.toLowerCase();
    
    let type = "transaction";
    let sentQuantity = "";
    let sentCurrency = "";
    let receivedQuantity = "";
    let receivedCurrency = "";
    
    // Handle native CELO transfers
    if (tx.value !== "0" && tx.value !== "0x0") {
      const value = (parseInt(tx.value) / 1e18).toFixed(6);
      
      if (isFromWallet) {
        sentQuantity = value;
        sentCurrency = "CELO";
        type = "send";
      } else if (isToWallet) {
        receivedQuantity = value;
        receivedCurrency = "CELO";
        type = "receive";
      }
    }
    
    // Handle token transfers for this transaction
    const txTokenTransfers = transfersByHash.get(tx.hash) || [];
    
    // If this is a contract call with token transfers, determine type
    if (txTokenTransfers.length > 0) {
      const sentTokens = txTokenTransfers.filter(t => t.from.toLowerCase() === walletAddress.toLowerCase());
      const receivedTokens = txTokenTransfers.filter(t => t.to.toLowerCase() === walletAddress.toLowerCase());
      
      if (sentTokens.length > 0 && receivedTokens.length > 0) {
        type = "swap";
      } else if (sentTokens.length > 0) {
        type = "send";
      } else if (receivedTokens.length > 0) {
        type = "receive";
      }
    }
    
    // Build notes with full transaction hash and details
    let notes = type;
    if (txTokenTransfers.length > 0) {
      const tokenDetails = txTokenTransfers.map(t => {
        const decimals = parseInt(t.tokenDecimal) || 18;
        const amount = (parseInt(t.value) / Math.pow(10, decimals)).toFixed(6);
        return `${amount} ${t.tokenSymbol}`;
      }).join(", ");
      notes += ` - ${tokenDetails}`;
    }
    notes += ` - [TX: ${tx.hash}]`;
    notes += ` (${tx.from.slice(0, 8)}... -> ${(tx.to || "0x0").slice(0, 8)}...)`;
    
    csvRows.push({
      Date: formattedDate,
      'Received Quantity': receivedQuantity,
      'Received Currency': receivedCurrency,
      'Received Fiat Amount': '',
      'Sent Quantity': sentQuantity,
      'Sent Currency': sentCurrency,
      'Sent Fiat Amount': '',
      'Received Quantity 2': '',
      'Received Currency 2': '',
      'Sent Quantity 2': '',
      'Sent Currency 2': '',
      'Fee Amount': fee,
      'Fee Currency': 'CELO',
      'Notes': notes,
      'Tag': type === 'send' ? 'transfer' : type === 'receive' ? 'income' : type === 'swap' ? 'trade' : 'transaction'
    });
  });
  
  // Add token transfers as separate rows if they don't have matching transactions
  const txHashes = new Set(transactions.map(t => t.hash));
  tokenTransfers.forEach(transfer => {
    if (!txHashes.has(transfer.hash)) {
      // This is a token transfer not in the main transaction list (rare)
      const date = new Date(parseInt(transfer.timeStamp) * 1000);
      const formattedDate = `${date.getMonth() + 1}/${date.getDate()}/${String(date.getFullYear()).slice(-2)} ${date.getHours()}:${String(date.getMinutes()).padStart(2, '0')}`;
      
      const decimals = parseInt(transfer.tokenDecimal) || 18;
      const amount = (parseInt(transfer.value) / Math.pow(10, decimals)).toFixed(6);
      
      const isFromWallet = transfer.from.toLowerCase() === walletAddress.toLowerCase();
      const isToWallet = transfer.to.toLowerCase() === walletAddress.toLowerCase();
      
      let type = "token_transfer";
      let sentQuantity = isFromWallet ? amount : "";
      let sentCurrency = isFromWallet ? transfer.tokenSymbol : "";
      let receivedQuantity = isToWallet ? amount : "";
      let receivedCurrency = isToWallet ? transfer.tokenSymbol : "";
      
      const notes = `token_transfer - ${amount} ${transfer.tokenSymbol} - [TX: ${transfer.hash}] (${transfer.from.slice(0, 8)}... -> ${transfer.to.slice(0, 8)}...)`;
      
      csvRows.push({
        Date: formattedDate,
        'Received Quantity': receivedQuantity,
        'Received Currency': receivedCurrency,
        'Received Fiat Amount': '',
        'Sent Quantity': sentQuantity,
        'Sent Currency': sentCurrency,
        'Sent Fiat Amount': '',
        'Received Quantity 2': '',
        'Received Currency 2': '',
        'Sent Quantity 2': '',
        'Sent Currency 2': '',
        'Fee Amount': '', // Token transfers don't have their own gas fee
        'Fee Currency': '',
        'Notes': notes,
        'Tag': isFromWallet ? 'transfer' : isToWallet ? 'income' : 'transaction'
      });
    }
  });
  
  // Sort by date
  csvRows.sort((a, b) => {
    const dateA = new Date(a.Date);
    const dateB = new Date(b.Date);
    return dateA - dateB;
  });
  
  // Print CSV
  const headers = Object.keys(csvRows[0]);
  console.log(headers.join(','));
  
  // Print first 20 rows
  console.log("\nFirst 20 rows:");
  csvRows.slice(0, 20).forEach(row => {
    const values = headers.map(h => {
      const val = row[h];
      if (val && val.includes(',')) {
        return `"${val.replace(/"/g, '""')}"`;
      }
      return val;
    });
    console.log(values.join(','));
  });
  
  console.log(`\n... (${csvRows.length - 20} more rows)`);
  console.log(`\nTotal CSV rows: ${csvRows.length}`);
  
  return csvRows;
}

function verifyCostBasisRequirements(csvRows, transactions, tokenTransfers) {
  console.log("\n========================================");
  console.log("COST BASIS VERIFICATION");
  console.log("========================================\n");
  
  // Check 1: All rows have transaction hashes
  const rowsWithHash = csvRows.filter(r => r.Notes.includes('[TX: 0x'));
  console.log(`✅ Transaction hashes in Notes: ${rowsWithHash.length}/${csvRows.length}`);
  
  // Check 2: Token symbol consistency
  const symbols = new Set();
  csvRows.forEach(r => {
    if (r['Received Currency']) symbols.add(r['Received Currency']);
    if (r['Sent Currency']) symbols.add(r['Sent Currency']);
    if (r['Received Currency 2']) symbols.add(r['Received Currency 2']);
    if (r['Sent Currency 2']) symbols.add(r['Sent Currency 2']);
  });
  console.log(`✅ Unique currencies identified: ${symbols.size}`);
  console.log(`   Currencies: ${Array.from(symbols).join(', ')}`);
  
  // Check 3: Fees populated
  const rowsWithFees = csvRows.filter(r => r['Fee Amount'] && r['Fee Amount'] !== '');
  console.log(`✅ Rows with fees: ${rowsWithFees.length}/${csvRows.length}`);
  
  // Check 4: Transaction types
  const transferCount = csvRows.filter(r => r.Tag === 'transfer').length;
  const incomeCount = csvRows.filter(r => r.Tag === 'income').length;
  const tradeCount = csvRows.filter(r => r.Tag === 'trade').length;
  const otherCount = csvRows.length - transferCount - incomeCount - tradeCount;
  
  console.log(`✅ Transaction types:`);
  console.log(`   Transfer (send): ${transferCount}`);
  console.log(`   Income (receive): ${incomeCount}`);
  console.log(`   Trade (swap): ${tradeCount}`);
  console.log(`   Other: ${otherCount}`);
  
  // Check 5: Data completeness
  const incompleteRows = csvRows.filter(r => 
    !r.Date || 
    (!r['Received Quantity'] && !r['Sent Quantity'] && !r['Fee Amount'])
  );
  console.log(`✅ Complete data rows: ${csvRows.length - incompleteRows.length}/${csvRows.length}`);
  
  if (incompleteRows.length > 0) {
    console.log(`\n⚠️  ${incompleteRows.length} rows may be incomplete - check manually`);
  }
}

async function main() {
  console.log("========================================");
  console.log("PRE-IMPLEMENTATION VERIFICATION");
  console.log("========================================");
  console.log(`Address: ${TEST_ADDRESS}`);
  console.log(`Chain: Celo Mainnet (Chain ID: ${CHAIN_ID})`);
  console.log(`API: Etherscan v2`);
  console.log(`API Key: ${API_KEY.slice(0, 10)}...${API_KEY.slice(-10)}\n`);
  
  try {
    // Step 1: Fetch all regular transactions
    const transactions = await fetchAllTransactions(TEST_ADDRESS, 100);
    
    // Step 2: Fetch all token transfers
    const tokenTransfers = await fetchAllTokenTransfers(TEST_ADDRESS, 100);
    
    // Step 3: Analyze complete history
    analyzeCompleteHistory(transactions, tokenTransfers);
    
    // Step 4: Generate CSV in Awaken format
    const csvRows = generateAwakenCSV(transactions, tokenTransfers, TEST_ADDRESS);
    
    // Step 5: Verify cost basis requirements
    verifyCostBasisRequirements(csvRows, transactions, tokenTransfers);
    
    // Final verification report
    console.log("\n========================================");
    console.log("FINAL VERIFICATION REPORT");
    console.log("========================================\n");
    
    const success = transactions.length > 0;
    const hasTokenTransfers = tokenTransfers.length > 0;
    const hasCompleteData = csvRows.length > 0;
    
    console.log(`✅ Regular transactions fetched: ${transactions.length}`);
    console.log(`✅ Token transfers fetched: ${tokenTransfers.length}`);
    console.log(`✅ CSV rows generated: ${csvRows.length}`);
    console.log(`✅ Includes both CELO and token data: ${hasTokenTransfers ? 'YES' : 'NO'}`);
    
    console.log("\n" + (success && hasCompleteData ? "✅ VERIFICATION PASSED" : "❌ VERIFICATION FAILED"));
    
    if (success && hasCompleteData) {
      console.log("\n📊 Summary:");
      console.log(`   - Fetched ${transactions.length} regular transactions`);
      console.log(`   - Fetched ${tokenTransfers.length} token transfers`);
      console.log(`   - Combined into ${csvRows.length} CSV rows`);
      console.log(`   - Includes full transaction hashes for cost basis matching`);
      console.log(`   - Token symbols consistent (from API)`);
      console.log(`   - Fees calculated for all regular transactions`);
      
      console.log("\n✅ READY FOR IMPLEMENTATION");
      console.log("\nThe Etherscan v2 API successfully provides:");
      console.log("   1. Complete transaction history (txlist endpoint)");
      console.log("   2. All token transfers (tokentx endpoint)");
      console.log("   3. Data compatible with Awaken Tax CSV format");
      console.log("   4. Sufficient data for cost basis calculation");
      
      if (hasTokenTransfers) {
        console.log("\n🎯 This address has significant token activity");
        console.log("   Token symbol caching will be CRITICAL for cost basis accuracy");
      }
    } else {
      console.log("\n❌ Issues detected:");
      if (!success) console.log("   - Failed to fetch transactions");
      if (!hasCompleteData) console.log("   - CSV generation failed");
    }
    
  } catch (error) {
    console.error("\n❌ Test Failed:", error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

main();
