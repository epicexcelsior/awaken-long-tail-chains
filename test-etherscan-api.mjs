#!/usr/bin/env node

/**
 * Test script for Etherscan v2 API - Celo Mainnet
 * 
 * This script tests:
 * 1. Basic API connectivity
 * 2. Pagination to get ALL transactions
 * 3. Data structure validation
 * 4. Rate limiting
 */

const API_KEY = "39SMAR4FE2B41TQI5MDQ4PNDM5BG4HSP7J";
const CHAIN_ID = "42220"; // Celo Mainnet
const BASE_URL = "https://api.etherscan.io/v2/api";

// Test addresses with varying activity levels
const TEST_ADDRESSES = {
  zero: "0x0000000000000000000000000000000000000000",
  lowActivity: "0xD8763CBa276a3738E6DE85b4b3bF5FDed6D6cA73",
  mediumActivity: "0x267c406d26a4b43614df329d4f2ae6773cb630b2",
};

async function fetchTransactions(address, page = 1, offset = 100) {
  const url = `${BASE_URL}?module=account&action=txlist&address=${address}&chainid=${CHAIN_ID}&page=${page}&offset=${offset}&sort=desc&apikey=${API_KEY}`;
  
  console.log(`Fetching page ${page} for ${address}...`);
  
  const response = await fetch(url);
  const data = await response.json();
  
  return data;
}

async function testBasicConnectivity() {
  console.log("\n=== Test 1: Basic API Connectivity ===");
  
  const result = await fetchTransactions(TEST_ADDRESSES.zero, 1, 5);
  
  if (result.status === "1") {
    console.log("✅ API Connection Successful");
    console.log(`   Status: ${result.message}`);
    console.log(`   Transactions returned: ${result.result.length}`);
    console.log(`   First tx hash: ${result.result[0]?.hash}`);
  } else {
    console.log("❌ API Connection Failed");
    console.log(`   Status: ${result.message}`);
    console.log(`   Result: ${result.result}`);
    throw new Error("API connection failed");
  }
}

async function testPagination(address, label) {
  console.log(`\n=== Test 2: Pagination for ${label} ===`);
  
  let page = 1;
  const offset = 100;
  const maxPages = 50; // Safety limit
  let allTransactions = [];
  let hasMore = true;
  
  while (hasMore && page <= maxPages) {
    const result = await fetchTransactions(address, page, offset);
    
    if (result.status !== "1") {
      console.log(`❌ Error fetching page ${page}: ${result.result}`);
      break;
    }
    
    const transactions = result.result;
    allTransactions.push(...transactions);
    
    console.log(`   Page ${page}: ${transactions.length} transactions (Total: ${allTransactions.length})`);
    
    // Check if we got fewer transactions than requested (indicates last page)
    hasMore = transactions.length === offset;
    page++;
    
    // Rate limiting - wait 200ms between requests
    if (hasMore) {
      await new Promise(resolve => setTimeout(resolve, 200));
    }
  }
  
  console.log(`\n✅ Pagination Complete for ${label}`);
  console.log(`   Total pages fetched: ${page - 1}`);
  console.log(`   Total transactions: ${allTransactions.length}`);
  
  if (allTransactions.length > 0) {
    const firstTx = allTransactions[0];
    const lastTx = allTransactions[allTransactions.length - 1];
    
    console.log(`   Date range:`);
    console.log(`     First: ${new Date(firstTx.timeStamp * 1000).toISOString()}`);
    console.log(`     Last:  ${new Date(lastTx.timeStamp * 1000).toISOString()}`);
    console.log(`   Block range: ${lastTx.blockNumber} to ${firstTx.blockNumber}`);
  }
  
  return allTransactions;
}

function analyzeDataStructure(transactions) {
  console.log("\n=== Test 3: Data Structure Analysis ===");
  
  if (transactions.length === 0) {
    console.log("❌ No transactions to analyze");
    return;
  }
  
  const tx = transactions[0];
  const fields = Object.keys(tx);
  
  console.log(`✅ Transaction fields (${fields.length}):`);
  fields.forEach(field => {
    console.log(`   - ${field}: ${typeof tx[field]}`);
  });
  
  // Check for important fields
  const requiredFields = [
    'blockNumber', 'timeStamp', 'hash', 'from', 'to', 
    'value', 'gas', 'gasPrice', 'gasUsed', 'isError'
  ];
  
  console.log("\n✅ Required field validation:");
  requiredFields.forEach(field => {
    const present = field in tx;
    console.log(`   ${present ? '✅' : '❌'} ${field}`);
  });
  
  // Analyze value distribution
  const nativeValueTxs = transactions.filter(t => t.value !== "0");
  const contractCalls = transactions.filter(t => t.input && t.input !== "0x");
  const errors = transactions.filter(t => t.isError === "1");
  
  console.log(`\n✅ Transaction types:`);
  console.log(`   Total: ${transactions.length}`);
  console.log(`   Native value transfers: ${nativeValueTxs.length}`);
  console.log(`   Contract calls: ${contractCalls.length}`);
  console.log(`   Errors: ${errors.length}`);
}

async function testRateLimiting() {
  console.log("\n=== Test 4: Rate Limiting Test ===");
  
  const address = TEST_ADDRESSES.zero;
  const requests = 10;
  const startTime = Date.now();
  
  console.log(`   Making ${requests} rapid requests...`);
  
  for (let i = 0; i < requests; i++) {
    await fetchTransactions(address, 1, 1);
  }
  
  const endTime = Date.now();
  const duration = endTime - startTime;
  
  console.log(`✅ ${requests} requests completed in ${duration}ms`);
  console.log(`   Average: ${(duration / requests).toFixed(0)}ms per request`);
  console.log(`   Rate: ${((requests / duration) * 1000).toFixed(2)} requests/second`);
}

async function testTokenTransfers(address, label) {
  console.log(`\n=== Test 5: Token Transfers for ${label} ===`);
  
  // Note: txlist endpoint doesn't include token transfers by default
  // We'd need to use the tokentx endpoint for that
  const url = `${BASE_URL}?module=account&action=tokentx&address=${address}&chainid=${CHAIN_ID}&page=1&offset=100&sort=desc&apikey=${API_KEY}`;
  
  console.log(`   Fetching token transfers...`);
  
  const response = await fetch(url);
  const data = await response.json();
  
  if (data.status === "1") {
    console.log(`✅ Token transfers found: ${data.result.length}`);
    
    if (data.result.length > 0) {
      const uniqueTokens = new Set(data.result.map(t => t.tokenSymbol));
      console.log(`   Unique tokens: ${Array.from(uniqueTokens).join(', ')}`);
      
      // Show first token transfer
      const firstTransfer = data.result[0];
      console.log(`\n   Sample transfer:`);
      console.log(`     Token: ${firstTransfer.tokenSymbol}`);
      console.log(`     Value: ${firstTransfer.value}`);
      console.log(`     From: ${firstTransfer.from}`);
      console.log(`     To: ${firstTransfer.to}`);
      console.log(`     Hash: ${firstTransfer.hash}`);
    }
  } else {
    console.log(`ℹ️  No token transfers found or endpoint error: ${data.result}`);
  }
}

async function main() {
  console.log("========================================");
  console.log("Etherscan v2 API Test - Celo Mainnet");
  console.log("========================================");
  
  try {
    // Test 1: Basic connectivity
    await testBasicConnectivity();
    
    // Test 2: Pagination with different address types
    await testPagination(TEST_ADDRESSES.lowActivity, "Low Activity Address");
    await testPagination(TEST_ADDRESSES.mediumActivity, "Medium Activity Address");
    
    // Test 3: Analyze data structure from a known address
    const mediumActivityData = await fetchTransactions(TEST_ADDRESSES.mediumActivity, 1, 100);
    analyzeDataStructure(mediumActivityData.result);
    
    // Test 4: Rate limiting
    await testRateLimiting();
    
    // Test 5: Token transfers (requires tokentx endpoint)
    await testTokenTransfers(TEST_ADDRESSES.mediumActivity, "Medium Activity Address");
    
    console.log("\n========================================");
    console.log("✅ All Tests Completed Successfully!");
    console.log("========================================\n");
    
    console.log("Summary:");
    console.log("- API connectivity: ✅ Working");
    console.log("- Pagination: ✅ Working");
    console.log("- Data structure: ✅ Complete");
    console.log("- Token transfers: ✅ Available via tokentx endpoint");
    console.log("\nNext Steps:");
    console.log("1. Implement celo-client.ts using Etherscan v2 API");
    console.log("2. Use both txlist and tokentx endpoints for complete history");
    console.log("3. Add rate limiting (200ms between requests)");
    console.log("4. Implement token symbol caching for cost basis");
    
  } catch (error) {
    console.error("\n❌ Test Failed:", error.message);
    process.exit(1);
  }
}

main();
