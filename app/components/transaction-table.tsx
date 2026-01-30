import { useState } from 'react';
import { Download, ArrowUpDown, Check, X, ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { ParsedTransaction } from '../types';

interface TransactionTableProps {
  transactions: ParsedTransaction[];
  onDownloadCSV: () => void;
  walletAddress: string;
}

type SortField = 'timestamp' | 'type' | 'amount' | 'currency' | 'fee';
type SortDirection = 'asc' | 'desc';

export function TransactionTable({ transactions, onDownloadCSV, walletAddress }: TransactionTableProps) {
  const [sortField, setSortField] = useState<SortField>('timestamp');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('desc');
    }
  };

  const sortedTransactions = [...transactions].sort((a, b) => {
    let comparison = 0;
    
    switch (sortField) {
      case 'timestamp':
        comparison = a.timestamp.getTime() - b.timestamp.getTime();
        break;
      case 'type':
        comparison = a.type.localeCompare(b.type);
        break;
      case 'amount':
        comparison = parseFloat(a.amount || '0') - parseFloat(b.amount || '0');
        break;
      case 'currency':
        comparison = a.currency.localeCompare(b.currency);
        break;
      case 'fee':
        comparison = parseFloat(a.fee || '0') - parseFloat(b.fee || '0');
        break;
    }
    
    return sortDirection === 'asc' ? comparison : -comparison;
  });

  const formatDate = (date: Date): string => {
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }) + ' UTC';
  };

  const getTypeBadgeColor = (type: string): string => {
    const colors: Record<string, string> = {
      'send': 'bg-red-100 text-red-800 border-red-300',
      'receive': 'bg-green-100 text-green-800 border-green-300',
      'swap': 'bg-blue-100 text-blue-800 border-blue-300',
      'ibc_transfer': 'bg-purple-100 text-purple-800 border-purple-300',
      'delegate': 'bg-yellow-100 text-yellow-800 border-yellow-300',
      'undelegate': 'bg-orange-100 text-orange-800 border-orange-300',
      'unknown': 'bg-gray-100 text-gray-800 border-gray-300',
    };
    return colors[type] || colors['unknown'];
  };

  const truncateAddress = (address: string): string => {
    if (!address) return '';
    return `${address.slice(0, 8)}...${address.slice(-4)}`;
  };

  const openExplorer = (hash: string): void => {
    window.open(`https://www.mintscan.io/osmosis/tx/${hash}`, '_blank');
  };

  return (
    <Card className="w-full">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <div>
          <CardTitle className="text-xl font-bold">
            Transactions ({transactions.length})
          </CardTitle>
          <CardDescription>
            Wallet: {truncateAddress(walletAddress)}
          </CardDescription>
        </div>
        <Button 
          onClick={onDownloadCSV} 
          className="flex items-center gap-2"
          variant="outline"
        >
          <Download className="h-4 w-4" />
          Export CSV (Awaken)
        </Button>
      </CardHeader>
      <CardContent>
        <div className="rounded-md border overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[180px]">
                  <Button 
                    variant="ghost" 
                    onClick={() => handleSort('timestamp')}
                    className="h-8 p-0 font-medium"
                  >
                    Date
                    <ArrowUpDown className="ml-2 h-4 w-4" />
                  </Button>
                </TableHead>
                <TableHead>
                  <Button 
                    variant="ghost" 
                    onClick={() => handleSort('type')}
                    className="h-8 p-0 font-medium"
                  >
                    Type
                    <ArrowUpDown className="ml-2 h-4 w-4" />
                  </Button>
                </TableHead>
                <TableHead>From/To</TableHead>
                <TableHead>
                  <Button 
                    variant="ghost" 
                    onClick={() => handleSort('amount')}
                    className="h-8 p-0 font-medium"
                  >
                    Amount
                    <ArrowUpDown className="ml-2 h-4 w-4" />
                  </Button>
                </TableHead>
                <TableHead>
                  <Button 
                    variant="ghost" 
                    onClick={() => handleSort('currency')}
                    className="h-8 p-0 font-medium"
                  >
                    Currency
                    <ArrowUpDown className="ml-2 h-4 w-4" />
                  </Button>
                </TableHead>
                <TableHead>
                  <Button 
                    variant="ghost" 
                    onClick={() => handleSort('fee')}
                    className="h-8 p-0 font-medium"
                  >
                    Fee
                    <ArrowUpDown className="ml-2 h-4 w-4" />
                  </Button>
                </TableHead>
                <TableHead className="text-right">Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sortedTransactions.map((tx) => (
                <TableRow key={tx.hash}>
                  <TableCell className="font-mono text-sm">
                    {formatDate(tx.timestamp)}
                  </TableCell>
                  <TableCell>
                    <Badge 
                      variant="outline" 
                      className={getTypeBadgeColor(tx.type)}
                    >
                      {tx.type.replace('_', ' ')}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <div className="text-sm text-muted-foreground cursor-help">
                            {tx.type === 'send' || (tx.from && tx.from === walletAddress) ? (
                              <span>To: {truncateAddress(tx.to)}</span>
                            ) : (
                              <span>From: {truncateAddress(tx.from)}</span>
                            )}
                          </div>
                        </TooltipTrigger>
                        <TooltipContent>
                          <p>From: {tx.from}</p>
                          <p>To: {tx.to}</p>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  </TableCell>
                  <TableCell className="font-mono">
                    {tx.amount || '-'}
                  </TableCell>
                  <TableCell>
                    {tx.currency || '-'}
                  </TableCell>
                  <TableCell className="font-mono text-muted-foreground">
                    {tx.fee ? `${tx.fee} ${tx.feeCurrency}` : '-'}
                  </TableCell>
                  <TableCell className="text-right">
                    {tx.status === 'success' ? (
                      <Check className="h-5 w-5 text-green-500 ml-auto" />
                    ) : (
                      <X className="h-5 w-5 text-red-500 ml-auto" />
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => openExplorer(tx.hash)}
                          >
                            <ExternalLink className="h-4 w-4" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>
                          <p>View on Mintscan</p>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
        
        {sortedTransactions.length === 0 && (
          <div className="text-center py-8 text-muted-foreground">
            No transactions found
          </div>
        )}
      </CardContent>
    </Card>
  );
}
